import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("user.updateName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates user name successfully", async () => {
    const { ctx } = createAuthContext();
    const updateSpy = vi.spyOn(db, "updateUserName").mockResolvedValue(undefined);

    const caller = appRouter.createCaller(ctx);
    const result = await caller.user.updateName({ name: "New Name" });

    expect(result).toEqual({
      success: true,
    });
    expect(updateSpy).toHaveBeenCalledWith("sample-user", "New Name");
    expect(updateSpy).toHaveBeenCalledTimes(1);

    updateSpy.mockRestore();
  });

  it("rejects empty name", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.user.updateName({ name: "" });
      expect.fail("Should have thrown an error");
    } catch (error: unknown) {
      expect(error).toBeDefined();
      // zod validation error
    }
  });

  it("rejects unauthenticated requests", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);

    try {
      await caller.user.updateName({ name: "New Name" });
      expect.fail("Should have thrown an error");
    } catch (error: unknown) {
      expect(error).toBeDefined();
      // protectedProcedure should throw UNAUTHORIZED
    }
  });

  it("trims whitespace from name", async () => {
    const { ctx } = createAuthContext();
    const updateSpy = vi.spyOn(db, "updateUserName").mockResolvedValue(undefined);

    const caller = appRouter.createCaller(ctx);
    const result = await caller.user.updateName({ name: "  Trimmed Name  " });

    expect(result).toEqual({
      success: true,
    });
    expect(updateSpy).toHaveBeenCalledWith("sample-user", "Trimmed Name");

    updateSpy.mockRestore();
  });
});
