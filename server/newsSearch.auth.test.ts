import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("news search access", () => {
  it("rejects guest searches before calling the news provider", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    });
    await expect(caller.news.searchNews({ query: "테스트", limit: 80 }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
