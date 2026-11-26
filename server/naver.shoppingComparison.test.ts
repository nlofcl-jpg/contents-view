import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "./naver.cache";
import { shoppingStatisticsProcedure, unifiedInsightBatchProcedure } from "./naver.unifiedInsight";
import { router } from "./_core/trpc";

vi.mock("./naverAnalysisQuota", async () => {
  const { publicProcedure } = await import("./_core/trpc");
  return { naverAnalysisProcedure: publicProcedure };
});

const caller = router({ compare: unifiedInsightBatchProcedure, statistics: shoppingStatisticsProcedure }).createCaller({ user: null, req: {} as any, res: {} as any });
const request = {
  keywords: ["러닝 화", "노트북"],
  startDate: "2026-05-01",
  endDate: "2026-06-01",
  timeUnit: "date" as const,
  device: "모바일",
  ages: ["20"],
};
const endpoint = "https://openapi.naver.com/v1/datalab/shopping/category/keywords";
const point = { period: request.startDate, ratio: 100 };

beforeEach(() => {
  clearCache();
  vi.stubEnv("NAVER_CLIENT_ID", "test-id");
  vi.stubEnv("NAVER_CLIENT_SECRET", "test-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("shopping trend comparison", () => {
  it("uses shopping clicks only and finds keywords in different categories", async () => {
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      expect(url).toBe(endpoint);
      const body = JSON.parse(String(options.body));
      expect(body).toMatchObject({ device: "mo", ages: ["20"] });
      const results = body.category === "50000001" ? [{ title: "러닝화", data: [point] }]
        : body.category === "50000003" ? [{ title: "노트북", data: [point] }] : [];
      if (body.category === "50000001") expect(body.keyword).toContainEqual({ name: "러닝화", param: ["러닝화"] });
      if (body.category === "50000003") expect(body.keyword).toEqual([{ name: "노트북", param: ["노트북"] }]);
      return Response.json({ results });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(caller.compare({ requests: [request], metric: "shopping" })).resolves.toEqual([
      { success: true, shopping: { "러닝 화": [point], 노트북: [point] } },
    ]);
    await caller.compare({ requests: [request], metric: "shopping" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("distinguishes empty results from authorization errors and stops retrying on 403", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ results: [] }))
      .mockResolvedValueOnce(Response.json({}, { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(caller.compare({ requests: [{ ...request, category: "50000003" }], metric: "shopping" }))
      .resolves.toEqual([{ success: false, shopping: {} }]);
    await expect(caller.compare({ requests: [request], metric: "shopping" }))
      .resolves.toEqual([{ success: false, shopping: {}, error: expect.stringContaining("쇼핑인사이트") }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps keyword classification automatic and reads the selected subcategory separately", async () => {
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body));
      if (url === endpoint) {
        const results = body.category === "50000000" ? [{ title: "노트북", data: [point] }] : [];
        return Response.json({ results });
      }
      expect(url).toBe("https://openapi.naver.com/v1/datalab/shopping/categories");
      expect(body.category[0].param).toEqual(["50000815"]);
      return Response.json({ results: [{ data: [{ ...point, ratio: 75 }] }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await caller.statistics({
      requests: [{ ...request, keywords: ["노트북"] }],
      categoryCode: "50000815",
      categoryFilters: { startDate: request.startDate, endDate: request.endDate, timeUnit: request.timeUnit },
    });
    expect(result).toMatchObject({
      success: true,
      comparisons: [{ matchedCategories: { 노트북: "50000000" }, shopping: { 노트북: [point] } }],
      category: { categoryCode: "50000815", data: [{ ...point, ratio: 75 }] },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses the auto-matched category for the second chart when no category is selected", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body));
      if (url === endpoint) return Response.json({ results: [{ title: "노트북", data: [point] }] });
      expect(body.category[0].param).toEqual(["50000000"]);
      return Response.json({ results: [{ data: [point] }] });
    }));

    await expect(caller.statistics({
      requests: [{ ...request, keywords: ["노트북"] }],
      categoryFilters: { startDate: request.startDate, endDate: request.endDate, timeUnit: request.timeUnit },
    })).resolves.toMatchObject({ category: { success: true, categoryCode: "50000000" } });
  });

  it("resolves and returns the three category levels for a newly submitted keyword", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: URL | string, options: RequestInit) => {
      if (url instanceof URL) {
        const pid = Number(url.searchParams.get("cid"));
        const item = pid === 50000000
          ? { cid: 50000167, name: "여성의류", level: 2 }
          : { cid: 50000815, name: "재킷", level: 3 };
        return Response.json({ childList: [{ ...item, pid, deleted: false, svcUse: true }] });
      }
      if (url === endpoint) return Response.json({ results: [{ title: "여성 재킷", data: [point] }] });
      expect(JSON.parse(String(options.body)).category[0].param).toEqual(["50000815"]);
      return Response.json({ results: [{ data: [point] }] });
    }));

    await expect(caller.statistics({
      requests: [{ ...request, keywords: ["여성 재킷"] }],
      keywordForCategory: "여성 재킷",
      categoryFilters: { startDate: request.startDate, endDate: request.endDate, timeUnit: request.timeUnit },
    })).resolves.toMatchObject({
      categoryPath: [
        { value: "50000000", label: "패션의류" },
        { value: "50000167", label: "여성의류" },
        { value: "50000815", label: "재킷" },
      ],
      category: { success: true, categoryCode: "50000815" },
    });
  });
});
