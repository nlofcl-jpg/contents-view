import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { router } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
import { NAVER_GUEST_DAILY_LIMIT_MESSAGE, NAVER_MEMBER_DAILY_LIMIT_MESSAGE } from "@shared/naverAnalysisQuota";

const store = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => store }));
vi.mock("./_core/env", () => ({ ENV: { supabaseUrl: "https://test.supabase.co", supabaseServiceRoleKey: "test-only-secret" } }));

import { getNaverQuotaDay, getNaverQuotaSubject, naverAnalysisProcedure } from "./naverAnalysisQuota";

const executeAnalysis = vi.fn();
const testRouter = router({
  analyze: naverAnalysisProcedure.input(z.object({ keyword: z.string().min(1) })).mutation(executeAnalysis),
});

function context(member = false, address = "192.0.2.1"): TrpcContext {
  return {
    user: member ? { id: 7, loginMethod: "supabase", openId: "member-7" } : null,
    req: { headers: {}, socket: { remoteAddress: address } },
    res: {},
  } as TrpcContext;
}

beforeEach(() => {
  vi.stubEnv("VERCEL", "");
  executeAnalysis.mockReset().mockResolvedValue({ success: true });
  const counts = new Map<string, number>();
  store.rpc.mockReset().mockImplementation(async (operation, input) => {
    const key = `${input.p_usage_day}:${input.p_subject_hash}`;
    const used = counts.get(key) || 0;
    if (operation === "refund_naver_analysis_quota") {
      counts.set(key, Math.max(used - 1, 0));
      return { data: null, error: null };
    }
    const limit = input.p_actor_kind === "member" ? 10 : 1;
    const allowed = used < limit;
    if (allowed) counts.set(key, used + 1);
    return { data: [{ allowed, used: allowed ? used + 1 : used }], error: null };
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Naver daily analysis quota", () => {
  it("allows only one concurrent guest request and rejects others before analysis", async () => {
    const caller = testRouter.createCaller(context());
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => caller.analyze({ keyword: "테스트" })));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(executeAnalysis).toHaveBeenCalledTimes(1);
    await expect(caller.analyze({ keyword: "다른 검색어" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS", message: NAVER_GUEST_DAILY_LIMIT_MESSAGE });
    await expect(testRouter.createCaller(context()).analyze({ keyword: "재접속" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("allows ten requests per member across addresses", async () => {
    for (let index = 0; index < 10; index++) {
      await testRouter.createCaller(context(true, `192.0.2.${index + 1}`)).analyze({ keyword: "테스트" });
    }
    await expect(testRouter.createCaller(context(true)).analyze({ keyword: "초과" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS", message: NAVER_MEMBER_DAILY_LIMIT_MESSAGE });
    expect(executeAnalysis).toHaveBeenCalledTimes(10);
  });

  it("restores quota after failed responses and thrown errors", async () => {
    const caller = testRouter.createCaller(context());
    executeAnalysis.mockResolvedValueOnce({ success: false });
    await caller.analyze({ keyword: "실패" });
    executeAnalysis.mockRejectedValueOnce(new Error("upstream failed"));
    await expect(caller.analyze({ keyword: "오류" })).rejects.toThrow();
    await expect(caller.analyze({ keyword: "성공" })).resolves.toEqual({ success: true });
    expect(store.rpc.mock.calls.filter(([operation]) => operation === "refund_naver_analysis_quota")).toHaveLength(2);
  });

  it("counts a batch once when at least one comparison succeeds", async () => {
    executeAnalysis.mockResolvedValue([{ success: false }, { success: true }]);
    const caller = testRouter.createCaller(context());
    await caller.analyze({ keyword: "일괄 비교" });
    await expect(caller.analyze({ keyword: "추가 분석" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(store.rpc.mock.calls.filter(([operation]) => operation === "refund_naver_analysis_quota")).toHaveLength(0);
  });

  it("resets at Korean midnight rather than UTC midnight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T14:59:59Z"));
    const caller = testRouter.createCaller(context());
    expect(getNaverQuotaDay()).toBe("2026-10-30");
    await caller.analyze({ keyword: "오늘" });
    vi.setSystemTime(new Date("2026-10-30T15:00:00Z"));
    expect(getNaverQuotaDay()).toBe("2026-10-31");
    await expect(caller.analyze({ keyword: "내일" })).resolves.toEqual({ success: true });
  });

  it("fails closed on storage errors without running analysis", async () => {
    store.rpc.mockResolvedValueOnce({ data: null, error: { code: "test_storage_error" } });
    await expect(testRouter.createCaller(context()).analyze({ keyword: "테스트" })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(executeAnalysis).not.toHaveBeenCalled();
  });

  it("hashes identity daily and ignores spoofed proxy headers outside Vercel", () => {
    const ctx = context();
    ctx.req.headers["x-forwarded-for"] = "198.51.100.1";
    const key = getNaverQuotaSubject(ctx, "secret", "2026-10-30");
    expect(key).toBe(getNaverQuotaSubject(context(), "secret", "2026-10-30"));
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toBe(getNaverQuotaSubject(ctx, "secret", "2026-10-31"));
    vi.stubEnv("VERCEL", "1");
    ctx.req.headers["x-vercel-forwarded-for"] = "203.0.113.1";
    expect(getNaverQuotaSubject(ctx, "secret", "2026-10-30")).toBe(getNaverQuotaSubject(context(false, "203.0.113.1"), "secret", "2026-10-30"));
  });
});
