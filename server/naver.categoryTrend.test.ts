import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { appRouter } from "./routers";

describe("Naver Category Trend API", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    // Set environment variables for testing
    process.env.NAVER_CLIENT_ID = "test-client-id";
    process.env.NAVER_CLIENT_SECRET = "test-client-secret";

    // Create caller with empty context (publicProcedure doesn't require auth)
    caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });
  });

  it("should return error when credentials are not configured", async () => {
    // Temporarily unset credentials
    const originalClientId = process.env.NAVER_CLIENT_ID;
    const originalClientSecret = process.env.NAVER_CLIENT_SECRET;

    delete process.env.NAVER_CLIENT_ID;
    delete process.env.NAVER_CLIENT_SECRET;

    // Create new caller with unset credentials
    const testCaller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await testCaller.naver.categoryTrend({
      categoryCode: "50000000",
      startDate: "2026-05-14",
      endDate: "2026-06-12",
      timeUnit: "date",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("credentials not configured");
    expect(result.data).toEqual([]);

    // Restore credentials
    process.env.NAVER_CLIENT_ID = originalClientId;
    process.env.NAVER_CLIENT_SECRET = originalClientSecret;
  });

  it("should accept valid input parameters", async () => {
    // Mock fetch to avoid actual API calls
    const mockFetch = vi.fn();
    global.fetch = mockFetch as any;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            data: [
              { period: "2026-05-14", ratio: 50 },
              { period: "2026-05-15", ratio: 55 },
            ],
          },
        ],
      }),
    });

    const result = await caller.naver.categoryTrend({
      categoryCode: "50000000",
      startDate: "2026-05-14",
      endDate: "2026-06-12",
      timeUnit: "date",
      device: "all",
      gender: "all",
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toHaveProperty("period");
    expect(result.data[0]).toHaveProperty("ratio");
  });

  it("should include optional filters in request when provided", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch as any;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            data: [{ period: "2026-05-14", ratio: 50 }],
          },
        ],
      }),
    });

    await caller.naver.categoryTrend({
      categoryCode: "50000000",
      startDate: "2026-05-14",
      endDate: "2026-06-12",
      timeUnit: "date",
      device: "pc",
      gender: "m",
      ages: ["20", "30"],
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const callArgs = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(callArgs[1].body);

    expect(requestBody.device).toBe("pc");
    expect(requestBody.gender).toBe("m");
    expect(requestBody.ages).toEqual(["20", "30"]);
  });

  it("should exclude optional filters when set to 'all'", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch as any;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            data: [{ period: "2026-05-14", ratio: 50 }],
          },
        ],
      }),
    });

    await caller.naver.categoryTrend({
      categoryCode: "50000000",
      startDate: "2026-05-14",
      endDate: "2026-06-12",
      timeUnit: "date",
      device: "all",
      gender: "all",
    });

    const callArgs = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(callArgs[1].body);

    expect(requestBody.device).toBeUndefined();
    expect(requestBody.gender).toBeUndefined();
  });

  it("should handle API error responses", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch as any;

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        message: "Invalid category code",
      }),
    });

    const result = await caller.naver.categoryTrend({
      categoryCode: "invalid",
      startDate: "2026-05-14",
      endDate: "2026-06-12",
      timeUnit: "date",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid category code");
    expect(result.data).toEqual([]);
  });

  it("should handle missing data in API response", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch as any;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [],
      }),
    });

    const result = await caller.naver.categoryTrend({
      categoryCode: "50000000",
      startDate: "2026-05-14",
      endDate: "2026-06-12",
      timeUnit: "date",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("데이터가 없습니다");
    expect(result.data).toEqual([]);
  });

  it("should handle network errors", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch as any;

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await caller.naver.categoryTrend({
      categoryCode: "50000000",
      startDate: "2026-05-14",
      endDate: "2026-06-12",
      timeUnit: "date",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("데이터를 불러오지 못했습니다");
    expect(result.data).toEqual([]);
  });

  it("should convert timeUnit correctly", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch as any;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ data: [] }],
      }),
    });

    // Test date
    await caller.naver.categoryTrend({
      categoryCode: "50000000",
      startDate: "2026-05-14",
      endDate: "2026-06-12",
      timeUnit: "date",
    });

    let requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.timeUnit).toBe("date");

    // Test week
    await caller.naver.categoryTrend({
      categoryCode: "50000000",
      startDate: "2026-05-14",
      endDate: "2026-06-12",
      timeUnit: "week",
    });

    requestBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(requestBody.timeUnit).toBe("week");

    // Test month
    await caller.naver.categoryTrend({
      categoryCode: "50000000",
      startDate: "2026-05-14",
      endDate: "2026-06-12",
      timeUnit: "month",
    });

    requestBody = JSON.parse(mockFetch.mock.calls[2][1].body);
    expect(requestBody.timeUnit).toBe("month");
  });
});
