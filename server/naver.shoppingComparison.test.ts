import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "./naver.cache";
import { unifiedInsightBatchProcedure } from "./naver.unifiedInsight";
import { router } from "./_core/trpc";

vi.mock("./naverAnalysisQuota", async () => {
  const { publicProcedure } = await import("./_core/trpc");
  return { naverAnalysisProcedure: publicProcedure };
});

const caller = router({ compare: unifiedInsightBatchProcedure }).createCaller({ user: null, req: {} as any, res: {} as any });
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
});
