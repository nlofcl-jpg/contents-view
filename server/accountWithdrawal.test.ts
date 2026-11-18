import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { router } from "./_core/trpc";
import { createAccountWithdrawalProcedure } from "./accountWithdrawal";
import { canWithdrawAccount } from "../shared/accountWithdrawal";

const userId = "12345678-1234-4234-8234-123456789abc";
const otherId = "22345678-1234-4234-8234-123456789abc";

function setup() {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
      admin: {
        signOut: vi.fn().mockResolvedValue({ error: null }),
        deleteUser: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  };
  const ctx = {
    user: { openId: userId, loginMethod: "supabase", role: "user" },
    req: { headers: { authorization: "Bearer test-session" }, protocol: "https" },
    res: { clearCookie: vi.fn() },
  } as unknown as TrpcContext;
  const caller = router({
    withdraw: createAccountWithdrawalProcedure(client as unknown as SupabaseClient),
  }).createCaller(ctx);
  return { client, ctx, caller };
}

describe("account withdrawal", () => {
  it("requires the exact typed confirmation, including no spaces", async () => {
    const { client, caller } = setup();
    for (const confirmation of ["", "탈퇴", "회원 탈퇴", "회원탈퇴 "]) {
      expect(canWithdrawAccount(confirmation)).toBe(false);
      await expect(caller.withdraw({ confirmation: confirmation as "회원탈퇴" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(canWithdrawAccount("회원탈퇴")).toBe(true);
    expect(client.auth.getUser).not.toHaveBeenCalled();
    expect(client.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("rejects guests before touching the auth service", async () => {
    const { client, ctx, caller } = setup();
    ctx.user = null;
    await expect(caller.withdraw({ confirmation: "회원탈퇴" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(client.auth.getUser).not.toHaveBeenCalled();
  });

  it("never accepts a target account ID from the browser", async () => {
    const { client, caller } = setup();
    await expect(caller.withdraw({ confirmation: "회원탈퇴", userId: otherId } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(client.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("rejects missing tokens, mismatched accounts, and invalid sessions", async () => {
    for (const scenario of ["missing", "mismatch", "invalid"]) {
      const { client, ctx, caller } = setup();
      if (scenario === "missing") delete ctx.req.headers.authorization;
      if (scenario === "mismatch") client.auth.getUser.mockResolvedValue({ data: { user: { id: otherId } }, error: null });
      if (scenario === "invalid") client.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("expired") });
      await expect(caller.withdraw({ confirmation: "회원탈퇴" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(client.auth.admin.signOut).not.toHaveBeenCalled();
      expect(client.auth.admin.deleteUser).not.toHaveBeenCalled();
    }
  });

  it("revokes sessions before deleting only the authenticated account", async () => {
    const { client, ctx, caller } = setup();
    await expect(caller.withdraw({ confirmation: "회원탈퇴" })).resolves.toEqual({ success: true });
    expect(client.auth.admin.signOut).toHaveBeenCalledWith("test-session", "global");
    expect(client.auth.admin.deleteUser).toHaveBeenCalledWith(userId, false);
    expect(client.auth.admin.signOut.mock.invocationCallOrder[0]).toBeLessThan(client.auth.admin.deleteUser.mock.invocationCallOrder[0]);
    expect(ctx.res.clearCookie).toHaveBeenCalledTimes(2);
  });

  it("does not delete an account if session revocation fails", async () => {
    const { client, caller } = setup();
    client.auth.admin.signOut.mockResolvedValue({ error: new Error("failure") });
    await expect(caller.withdraw({ confirmation: "회원탈퇴" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(client.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("does not report success or clear cookies if deletion fails", async () => {
    const { client, ctx, caller } = setup();
    client.auth.admin.deleteUser.mockResolvedValue({ error: new Error("database failure") });
    await expect(caller.withdraw({ confirmation: "회원탈퇴" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(ctx.res.clearCookie).not.toHaveBeenCalled();
  });

  it("fails closed for missing server config and legacy accounts", async () => {
    const { client, ctx, caller } = setup();
    const unavailable = router({ withdraw: createAccountWithdrawalProcedure(null) }).createCaller(ctx);
    await expect(unavailable.withdraw({ confirmation: "회원탈퇴" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    ctx.user!.loginMethod = "legacy";
    await expect(caller.withdraw({ confirmation: "회원탈퇴" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(client.auth.admin.deleteUser).not.toHaveBeenCalled();
  });
});
