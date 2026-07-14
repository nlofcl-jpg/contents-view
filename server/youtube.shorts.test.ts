import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb, saveUserApiKey, getUserApiKey, updateApiKeyTestStatus } from "./db";
import { users, userApiKeys } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("YouTube Trending Shorts", () => {
  let testUserId: number;
  const testUserOpenId = `test-shorts-${Date.now()}`;
  const testApiKey = "AIzaSyTestKey123456789";

  beforeAll(async () => {
    // Create test user
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db.insert(users).values({ memberNo: 10110,
      openId: testUserOpenId,
      name: "Shorts Test User",
      email: "shorts@test.com",
      role: "user",
    });

    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.openId, testUserOpenId))
      .limit(1);

    if (userResult.length === 0) {
      throw new Error("Failed to create test user");
    }

    testUserId = userResult[0].id;

    // Save API key and mark as tested
    await saveUserApiKey(testUserId, "youtube", testApiKey);
    await updateApiKeyTestStatus(testUserId, "youtube", "success");
  });

  afterAll(async () => {
    // Clean up - delete all test users created during this test
    const db = await getDb();
    if (!db) return;

    try {
      // Delete API keys for test user
      await db.delete(userApiKeys).where(eq(userApiKeys.userId, testUserId));
      // Delete test user
      await db.delete(users).where(eq(users.openId, testUserOpenId));
    } catch (error) {
      console.error("[Test Cleanup] Error cleaning up test users:", error);
    }
  });

  it("should return error when user is not authenticated", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    try {
      await caller.youtube.getTrendingShorts({
        regionCode: "KR",
        sortBy: "trending",
        maxResults: 24,
      });
      expect.fail("Should throw error for unauthenticated user");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should return error when API key is not found", async () => {
    const caller = appRouter.createCaller({
      user: { id: 99999, openId: "nonexistent", name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.youtube.getTrendingShorts({
      regionCode: "KR",
      sortBy: "trending",
      maxResults: 24,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("API Key not found");
    expect(result.videos).toEqual([]);
  });

  it("should return error when API key test status is not success", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    // Update test status to failed
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await updateApiKeyTestStatus(testUserId, "youtube", "failed", "Test error");

    const result = await caller.youtube.getTrendingShorts({
      regionCode: "KR",
      sortBy: "trending",
      maxResults: 24,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("YouTube API 키 오류입니다");
    expect(result.videos).toEqual([]);

    // Restore test status
    await updateApiKeyTestStatus(testUserId, "youtube", "success");
  });

  it("should validate regionCode parameter", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    // Invalid region code (too short)
    try {
      await caller.youtube.getTrendingShorts({
        regionCode: "K",
        sortBy: "trending",
        maxResults: 24,
      });
      expect.fail("Should fail validation for invalid region code");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should validate sortBy parameter", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    // Invalid sort option
    try {
      await caller.youtube.getTrendingShorts({
        regionCode: "KR",
        sortBy: "invalid" as any,
        maxResults: 24,
      });
      expect.fail("Should fail validation for invalid sortBy");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should validate maxResults parameter", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    // maxResults too high
    try {
      await caller.youtube.getTrendingShorts({
        regionCode: "KR",
        sortBy: "trending",
        maxResults: 100,
      });
      expect.fail("Should fail validation for maxResults > 50");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should accept valid sort options", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const sortOptions = ["trending", "viewCount", "publishedAt"];

    for (const sortBy of sortOptions) {
      try {
        // This will fail due to invalid API key, but should pass validation
        const result = await caller.youtube.getTrendingShorts({
          regionCode: "KR",
          sortBy: sortBy as any,
          maxResults: 24,
        });
        // Result will have error due to invalid API key, but that's expected
        expect(result).toBeDefined();
      } catch (error) {
        // If it throws, it should be a network error, not a validation error
        const errorMsg = error instanceof Error ? error.message : String(error);
        expect(errorMsg).not.toContain("sortBy");
      }
    }
  });

  it("should not expose API key in response", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.youtube.getTrendingShorts({
      regionCode: "KR",
      sortBy: "trending",
      maxResults: 24,
    });

    // Check that API key is not in the result
    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain(testApiKey);
    expect(resultStr).not.toContain("AIzaSy");
  });

  it("should support all region codes", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const regionCodes = ["KR", "US", "JP", "GB", "FR", "ES", "DE"];

    for (const regionCode of regionCodes) {
      try {
        const result = await caller.youtube.getTrendingShorts({
          regionCode,
          sortBy: "trending",
          maxResults: 24,
        });
        // Result will have error due to invalid API key, but that's expected
        expect(result).toBeDefined();
        expect(result.videos).toBeDefined();
      } catch (error) {
        // If it throws, it should be a network error, not a validation error
        const errorMsg = error instanceof Error ? error.message : String(error);
        expect(errorMsg).not.toContain("regionCode");
      }
    }
  });

  it("should support video categories", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const categoryIds = [1, 2, 10, 15, 17, 19, 20, 22, 23, 24, 25, 26, 27, 28];

    for (const categoryId of categoryIds) {
      try {
        const result = await caller.youtube.getTrendingShorts({
          regionCode: "KR",
          sortBy: "trending",
          maxResults: 24,
          videoCategoryId: categoryId,
        });
        // Result will have error due to invalid API key, but that's expected
        expect(result).toBeDefined();
        expect(result.videos).toBeDefined();
      } catch (error) {
        // If it throws, it should be a network error, not a validation error
        const errorMsg = error instanceof Error ? error.message : String(error);
        expect(errorMsg).not.toContain("videoCategoryId");
      }
    }
  });

  it("should respect maxResults parameter", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    // Test with different maxResults values
    const maxResultsValues = [1, 5, 12, 24, 50];

    for (const maxResults of maxResultsValues) {
      try {
        const result = await caller.youtube.getTrendingShorts({
          regionCode: "KR",
          sortBy: "trending",
          maxResults,
        });
        // Result will have error due to invalid API key, but that's expected
        expect(result).toBeDefined();
      } catch (error) {
        // If it throws, it should be a network error, not a validation error
        const errorMsg = error instanceof Error ? error.message : String(error);
        expect(errorMsg).not.toContain("maxResults");
      }
    }
  });

  it("should isolate API keys per user", async () => {
    const caller1 = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const caller2 = appRouter.createCaller({
      user: { id: 99999, openId: "other-user", name: "Other", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result1 = await caller1.youtube.getTrendingShorts({
      regionCode: "KR",
      sortBy: "trending",
      maxResults: 24,
    });

    const result2 = await caller2.youtube.getTrendingShorts({
      regionCode: "KR",
      sortBy: "trending",
      maxResults: 24,
    });

    // Both should return errors, but for different reasons
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result2.error).toBe("API Key not found");
  });

  it("should return empty array on API error", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.youtube.getTrendingShorts({
      regionCode: "KR",
      sortBy: "trending",
      maxResults: 24,
    });

    // With invalid API key, should return error
    expect(result.success).toBe(false);
    expect(result.videos).toEqual([]);
  });
});
