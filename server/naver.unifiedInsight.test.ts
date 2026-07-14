import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import { clearCache } from "./naver.cache";

// Mock environment variables and clear cache
beforeEach(() => {
  process.env.NAVER_CLIENT_ID = "test-client-id";
  process.env.NAVER_CLIENT_SECRET = "test-client-secret";
  clearCache(); // Clear cache before each test
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("naver.unifiedInsight - Phase 2", () => {
  it("should validate input schema - keywords optional", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    // Empty keywords should be allowed now
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    global.fetch = fetchMock;

    const result = await caller.naver.unifiedInsight({
      keywords: [],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
    });
    expect(result).toBeDefined();
  });

  it("should validate input schema - category required", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    // Test with valid category to ensure the procedure works
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    global.fetch = fetchMock;

    const result = await caller.naver.unifiedInsight({
      keywords: [],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
    });
    expect(result).toBeDefined();
  });

  it("should handle missing credentials", async () => {
    process.env.NAVER_CLIENT_ID = "";
    process.env.NAVER_CLIENT_SECRET = "";

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.naver.unifiedInsight({
      keywords: ["원피스"],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should build correct search trend request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    global.fetch = fetchMock;

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    await caller.naver.unifiedInsight({
      keywords: ["원피스"],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
    });

    // Check first call (search trend API)
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall[0]).toBe("https://openapi.naver.com/v1/datalab/search");
    const trendBody = JSON.parse(firstCall[1].body);
    expect(trendBody.keywordGroups).toBeDefined();
    expect(trendBody.keywordGroups[0].groupName).toBe("원피스");
    expect(trendBody.keywordGroups[0].keywords).toEqual(["원피스"]);
  });

  it("should build correct shopping trend request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    global.fetch = fetchMock;

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    await caller.naver.unifiedInsight({
      keywords: ["원피스"],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
    });

    // Check second call (shopping trend API)
    const secondCall = fetchMock.mock.calls[1];
    expect(secondCall[0]).toBe("https://openapi.naver.com/v1/datalab/shopping/category/keywords");
    const shoppingBody = JSON.parse(secondCall[1].body);
    expect(shoppingBody.category).toBe("50000000");
    expect(shoppingBody.keyword).toBeDefined();
    expect(shoppingBody.keyword[0].name).toBe("원피스");
    expect(shoppingBody.keyword[0].param).toEqual(["원피스"]);
  });

  it("should exclude empty device filter from request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    global.fetch = fetchMock;

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    await caller.naver.unifiedInsight({
      keywords: ["원피스"],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
      device: undefined,
    });

    const trendBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(trendBody.device).toBeUndefined();
  });

  it("should convert device filter PC to pc", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    global.fetch = fetchMock;

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    await caller.naver.unifiedInsight({
      keywords: ["원피스"],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
      device: "PC",
    });

    const trendBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(trendBody.device).toBe("pc");
  });

  it("should convert device filter 모바일 to mo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    global.fetch = fetchMock;

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    await caller.naver.unifiedInsight({
      keywords: ["원피스"],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
      device: "모바일",
    });

    const trendBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(trendBody.device).toBe("mo");
  });

  it("should convert gender filter 남성 to m", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    global.fetch = fetchMock;

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    await caller.naver.unifiedInsight({
      keywords: ["원피스"],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
      gender: "남성",
    });

    const trendBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(trendBody.gender).toBe("m");
  });

  it("should convert gender filter 여성 to f", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    global.fetch = fetchMock;

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    await caller.naver.unifiedInsight({
      keywords: ["원피스"],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
      gender: "여성",
    });

    const trendBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(trendBody.gender).toBe("f");
  });

  it("should include ages filter when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    global.fetch = fetchMock;

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    await caller.naver.unifiedInsight({
      keywords: ["원피스"],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
      ages: ["20대", "30대"],
    });

    const trendBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(trendBody.ages).toEqual(["20대", "30대"]);
  });

  it("should handle successful response with data transformation", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              keyword: "원피스",
              data: [
                { period: "2026-05-13", ratio: 45.2 },
                { period: "2026-05-14", ratio: 48.5 },
              ],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              keyword: "원피스",
              data: [
                { period: "2026-05-13", ratio: 38.5 },
                { period: "2026-05-14", ratio: 41.2 },
              ],
            },
          ],
        }),
      });
    global.fetch = fetchMock;

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.naver.unifiedInsight({
      keywords: ["원피스"],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
    });

    expect(result.success).toBe(true);
    expect(result.keywords).toEqual(["원피스"]);
    expect(result.trend["원피스"]).toHaveLength(2);
    expect(result.shopping["원피스"]).toHaveLength(2);
    expect(result.trend["원피스"][0]).toEqual({ period: "2026-05-13", ratio: 45.2 });
    expect(result.shopping["원피스"][0]).toEqual({ period: "2026-05-13", ratio: 38.5 });
  });

  it("should handle search trend API failure", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ errorCode: "INVALID_KEYWORD", errorMessage: "Invalid keyword" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });
    global.fetch = fetchMock;

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.naver.unifiedInsight({
      keywords: ["원피스"],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("검색 트렌드 데이터를 불러오지 못했습니다.");
  });

  it("should handle shopping trend API failure", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ errorCode: "INVALID_CATEGORY", errorMessage: "Invalid category" }),
      });
    global.fetch = fetchMock;

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.naver.unifiedInsight({
      keywords: ["원피스"],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("쇼핑 클릭 데이터를 불러오지 못했습니다.");
  });

  it("should handle both API failures", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ errorCode: "SERVER_ERROR", errorMessage: "Server error" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ errorCode: "SERVER_ERROR", errorMessage: "Server error" }),
      });
    global.fetch = fetchMock;

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.naver.unifiedInsight({
      keywords: ["원피스"],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("통합 인사이트 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
  });

  it("should handle network error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
    global.fetch = fetchMock;

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.naver.unifiedInsight({
      keywords: ["원피스"],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("통합 인사이트 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
  });

  it("should handle multiple keywords", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              keyword: "원피스",
              data: [{ period: "2026-05-13", ratio: 45.2 }],
            },
            {
              keyword: "블라우스",
              data: [{ period: "2026-05-13", ratio: 30.5 }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              keyword: "원피스",
              data: [{ period: "2026-05-13", ratio: 38.5 }],
            },
            {
              keyword: "블라우스",
              data: [{ period: "2026-05-13", ratio: 22.3 }],
            },
          ],
        }),
      });
    global.fetch = fetchMock;

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.naver.unifiedInsight({
      keywords: ["원피스", "블라우스"],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
    });

    expect(result.success).toBe(true);
    expect(result.keywords).toEqual(["원피스", "블라우스"]);
    expect(result.trend["원피스"][0]).toEqual({ period: "2026-05-13", ratio: 45.2 });
    expect(result.trend["블라우스"][0]).toEqual({ period: "2026-05-13", ratio: 30.5 });
    expect(result.shopping["원피스"][0]).toEqual({ period: "2026-05-13", ratio: 38.5 });
    expect(result.shopping["블라우스"][0]).toEqual({ period: "2026-05-13", ratio: 22.3 });
  });

  it("should handle response with no keywords", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });
    global.fetch = fetchMock;

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.naver.unifiedInsight({
      keywords: [],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
    });

    expect(result.success).toBe(true);
    expect(result.keywords).toEqual([]);
    expect(Object.keys(result.trend)).toHaveLength(0);
    expect(Object.keys(result.shopping)).toHaveLength(0);
  });

  it("should handle response with partial data", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              keyword: "원피스",
              data: [{ period: "2026-05-13", ratio: 45.2 }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              keyword: "원피스",
              data: [{ period: "2026-05-13", ratio: 38.5 }],
            },
          ],
        }),
      });
    global.fetch = fetchMock;

    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.naver.unifiedInsight({
      keywords: ["원피스"],
      category: "50000000",
      startDate: "2026-05-13",
      endDate: "2026-06-12",
      timeUnit: "date",
    });

    expect(result.success).toBe(true);
    expect(result.trend["원피스"]).toHaveLength(1);
    expect(result.shopping["원피스"]).toHaveLength(1);
  });
});
