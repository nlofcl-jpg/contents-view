import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import { appRouter } from "./routers";
import { createCallerFactory } from "@trpc/server";

describe("YouTube Shorts Debug - API Response Counts", () => {
  let caller: ReturnType<ReturnType<typeof createCallerFactory>>;
  let testUserId: string;
  let testApiKey: string;

  beforeAll(async () => {
    testApiKey = process.env.YOUTUBE_TEST_API_KEY || "";
    if (!testApiKey) {
      console.log("YOUTUBE_TEST_API_KEY not set, skipping debug tests");
      return;
    }

    testUserId = `test-user-${Date.now()}`;
    await db.saveUserApiKey(testUserId, "youtube", testApiKey);
    await db.updateUserApiKeyTestStatus(testUserId, "youtube", "success", null);

    const createCaller = createCallerFactory()(appRouter);
    caller = createCaller({
      user: { id: testUserId, openId: testUserId, role: "user" },
      req: {} as any,
      res: {} as any,
    });
  });

  afterAll(async () => {
    if (!testUserId) return;
    try {
      const database = await db.getDb();
      if (!database) return;
      // Clean up test data
      const { userApiKeys } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await database.delete(userApiKeys).where(eq(userApiKeys.userId, parseInt(testUserId)));
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });

  it("should log API response counts for KR", async () => {
    if (!testApiKey) {
      console.log("Skipping: No API key");
      return;
    }

    console.log("\n=== KR / q 없음 ===");
    const result = await caller.youtube.getTrendingShorts({
      regionCode: "KR",
      sortBy: "trending",
      maxResults: 50,
    });

    console.log(`Result: success=${result.success}, videos=${result.videos?.length || 0}`);
  });

  it("should log API response counts for US", async () => {
    if (!testApiKey) {
      console.log("Skipping: No API key");
      return;
    }

    console.log("\n=== US / q 없음 ===");
    const result = await caller.youtube.getTrendingShorts({
      regionCode: "US",
      sortBy: "trending",
      maxResults: 50,
    });

    console.log(`Result: success=${result.success}, videos=${result.videos?.length || 0}`);
  });

  it("should verify duration conversion", async () => {
    console.log("\n=== Duration Conversion Test ===");
    
    const testCases = [
      { duration: "PT59S", expected: 59 },
      { duration: "PT1M", expected: 60 },
      { duration: "PT1M1S", expected: 61 },
      { duration: "PT12M34S", expected: 754 },
    ];

    for (const testCase of testCases) {
      const match = testCase.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (match) {
        const hours = parseInt(match[1] || "0");
        const minutes = parseInt(match[2] || "0");
        const seconds = parseInt(match[3] || "0");
        const result = hours * 3600 + minutes * 60 + seconds;
        console.log(`${testCase.duration} → ${result} (expected: ${testCase.expected})`);
        expect(result).toBe(testCase.expected);
      }
    }
  });
});
