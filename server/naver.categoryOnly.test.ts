import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import { clearCache } from "./naver.cache";

// Mock environment variables and clear cache
beforeEach(() => {
  process.env.NAVER_CLIENT_ID = "test-client-id";
  process.env.NAVER_CLIENT_SECRET = "test-client-secret";
  clearCache();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("naver.unifiedInsight - Category-Only Search", () => {
  it("should allow category-only search without keywords", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    // Mock fetch for both APIs
    global.fetch = vi.fn((url: string) => {
      if (url.includes("search")) {
        // Search Trend API
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                title: "패션의류",
                keyword: "패션의류",
                data: [
                  { period: "2026-05-15", ratio: 100 },
                  { period: "2026-05-16", ratio: 105 },
                ],
              },
            ],
          }),
        } as any);
      } else {
        // Shopping Trend API
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                keyword: "패션의류",
                data: [
                  { period: "2026-05-15", ratio: 100 },
                  { period: "2026-05-16", ratio: 105 },
                ],
              },
            ],
          }),
        } as any);
      }
    });

    // Call with empty keywords array
    const result = await caller.naver.unifiedInsight({
      keywords: [],
      category: "50000000",
      startDate: "2026-05-15",
      endDate: "2026-06-14",
      timeUnit: "date",
    });

    expect(result.success).toBe(true);
    expect(result.keywords).toEqual([]);
    expect(result.trend).toBeDefined();
    expect(result.shopping).toBeDefined();
  });

  it("should cache category-only search results", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    let callCount = 0;
    global.fetch = vi.fn((url: string) => {
      callCount++;
      if (url.includes("search")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                title: "패션의류",
                keyword: "패션의류",
                data: [{ period: "2026-05-15", ratio: 100 }],
              },
            ],
          }),
        } as any);
      } else {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                keyword: "패션의류",
                data: [{ period: "2026-05-15", ratio: 100 }],
              },
            ],
          }),
        } as any);
      }
    });

    // First call - should hit API
    const result1 = await caller.naver.unifiedInsight({
      keywords: [],
      category: "50000000",
      startDate: "2026-05-15",
      endDate: "2026-06-14",
      timeUnit: "date",
    });

    const firstCallCount = callCount;

    // Second call - should hit cache
    const result2 = await caller.naver.unifiedInsight({
      keywords: [],
      category: "50000000",
      startDate: "2026-05-15",
      endDate: "2026-06-14",
      timeUnit: "date",
    });

    // Cache should prevent additional API calls
    expect(callCount).toBe(firstCallCount);
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1).toEqual(result2);
  });

  it("should differentiate cache by category", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    let callCount = 0;
    global.fetch = vi.fn((url: string) => {
      callCount++;
      if (url.includes("search")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                title: "category",
                keyword: "category",
                data: [{ period: "2026-05-15", ratio: 100 }],
              },
            ],
          }),
        } as any);
      } else {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                keyword: "category",
                data: [{ period: "2026-05-15", ratio: 100 }],
              },
            ],
          }),
        } as any);
      }
    });

    // Call with category 1
    await caller.naver.unifiedInsight({
      keywords: [],
      category: "50000000",
      startDate: "2026-05-15",
      endDate: "2026-06-14",
      timeUnit: "date",
    });

    const callsAfterFirst = callCount;

    // Call with category 2 - should hit API again
    await caller.naver.unifiedInsight({
      keywords: [],
      category: "50000001",
      startDate: "2026-05-15",
      endDate: "2026-06-14",
      timeUnit: "date",
    });

    // Different category should trigger new API calls
    expect(callCount).toBeGreaterThan(callsAfterFirst);
  });

  it("should handle category-only search with optional filters", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    global.fetch = vi.fn((url: string) => {
      if (url.includes("search")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                title: "패션의류",
                keyword: "패션의류",
                data: [{ period: "2026-05-15", ratio: 100 }],
              },
            ],
          }),
        } as any);
      } else {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                keyword: "패션의류",
                data: [{ period: "2026-05-15", ratio: 100 }],
              },
            ],
          }),
        } as any);
      }
    });

    const result = await caller.naver.unifiedInsight({
      keywords: [],
      category: "50000000",
      startDate: "2026-05-15",
      endDate: "2026-06-14",
      timeUnit: "date",
      device: "PC",
      gender: "여성",
      ages: ["20대", "30대"],
    });

    expect(result.success).toBe(true);
    expect(result.keywords).toEqual([]);
  });
});
