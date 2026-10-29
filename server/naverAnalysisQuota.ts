import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";
import { NAVER_GUEST_DAILY_LIMIT_MESSAGE, NAVER_MEMBER_DAILY_LIMIT_MESSAGE } from "@shared/naverAnalysisQuota";
import { ENV } from "./_core/env";
import { publicProcedure } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";

const quotaStore = ENV.supabaseUrl && ENV.supabaseServiceRoleKey
  ? createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

export function getNaverQuotaDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function getNaverQuotaSubject(ctx: TrpcContext, secret: string, day: string) {
  let identity: string;
  if (ctx.user) {
    identity = `member:${ctx.user.loginMethod}:${ctx.user.openId || ctx.user.id}`;
  } else {
    const forwarded = process.env.VERCEL
      ? ctx.req.headers["x-vercel-forwarded-for"] || ctx.req.headers["x-forwarded-for"]
      : undefined;
    const address = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim()
      || ctx.req.socket?.remoteAddress || ctx.req.ip;
    if (!address) throw new TRPCError({ code: "BAD_REQUEST", message: "접속 정보를 확인할 수 없습니다. 새로고침 후 다시 시도해 주세요." });
    identity = `guest:${address.replace(/^::ffff:/, "")}`;
  }
  return createHmac("sha256", secret).update(`${day}:${identity}`).digest("hex");
}

function hasSuccessfulAnalysis(data: unknown): boolean {
  if (Array.isArray(data)) return data.some(hasSuccessfulAnalysis);
  return typeof data === "object" && data !== null && "success" in data && data.success === true;
}

export const naverAnalysisProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!quotaStore) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "분석 이용 횟수를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." });
  }

  const day = getNaverQuotaDay();
  const subject = getNaverQuotaSubject(ctx, ENV.supabaseServiceRoleKey, day);
  const { data, error } = await quotaStore.rpc("consume_naver_analysis_quota", {
    p_subject_hash: subject,
    p_actor_kind: ctx.user ? "member" : "guest",
    p_usage_day: day,
  });
  if (error || !data?.[0]) {
    console.error("[Naver quota] Failed to reserve analysis", error?.code);
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "분석 이용 횟수를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." });
  }
  if (!data[0].allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: ctx.user ? NAVER_MEMBER_DAILY_LIMIT_MESSAGE : NAVER_GUEST_DAILY_LIMIT_MESSAGE,
    });
  }

  let succeeded = false;
  try {
    const result = await next();
    succeeded = result.ok && hasSuccessfulAnalysis(result.data);
    return result;
  } finally {
    if (!succeeded) {
      const { error: refundError } = await quotaStore.rpc("refund_naver_analysis_quota", {
        p_subject_hash: subject, p_usage_day: day,
      });
      if (refundError) console.error("[Naver quota] Failed to refund analysis", refundError.code);
    }
  }
});
