import type { SupabaseClient } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ACCOUNT_WITHDRAWAL_CONFIRMATION } from "../shared/accountWithdrawal";
import { COOKIE_NAME, SUPABASE_ACCESS_TOKEN_COOKIE } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { protectedProcedure } from "./_core/trpc";

export function createAccountWithdrawalProcedure(client: SupabaseClient | null) {
  return protectedProcedure
    .input(z.object({ confirmation: z.literal(ACCOUNT_WITHDRAWAL_CONFIRMATION) }).strict())
    .mutation(async ({ ctx }) => {
      if (!client) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "탈퇴 기능에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요." });
      }
      if (ctx.user.loginMethod !== "supabase" || !z.string().uuid().safeParse(ctx.user.openId).success) {
        throw new TRPCError({ code: "FORBIDDEN", message: "이 계정의 탈퇴는 edenofcls@gmail.com으로 문의해 주세요." });
      }
      const header = ctx.req.headers.authorization;
      const token = typeof header === "string" ? /^Bearer\s+(\S+)$/i.exec(header)?.[1] : undefined;
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "다시 로그인한 후 탈퇴해 주세요." });
      }
      const { data, error: authError } = await client.auth.getUser(token);
      if (authError || data.user?.id !== ctx.user.openId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "다시 로그인한 후 탈퇴해 주세요." });
      }

      // Revoke refresh sessions first; deleteUser then atomically cascades personal data.
      const { error: signOutError } = await client.auth.admin.signOut(token, "global");
      if (signOutError) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "로그인 연결을 해제하지 못했습니다. 다시 로그인한 후 시도해 주세요." });
      }
      const { error: deleteError } = await client.auth.admin.deleteUser(ctx.user.openId, false);
      if (deleteError) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "탈퇴를 완료하지 못했습니다. 다시 로그인하여 시도하거나 edenofcls@gmail.com으로 문의해 주세요." });
      }
      const options = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...options, maxAge: -1 });
      ctx.res.clearCookie(SUPABASE_ACCESS_TOKEN_COOKIE, { ...options, maxAge: -1 });
      return { success: true } as const;
    });
}
