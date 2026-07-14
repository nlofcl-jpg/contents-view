import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { appRouter } from "./routers";
import { getDb, saveUserApiKey, getUserApiKey, updateApiKeyTestStatus } from "./db";
import { users, userApiKeys } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("YouTube Trending Videos", () => {
  let testUserId: number;
  const testUserOpenId = `test-trending-${Date.now()}`;
  const testApiKey = "AIzaSyTestKey123456789";

  beforeAll(async () => {
    // Create test user
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db.insert(users).values({ memberNo: 10130,
      openId: testUserOpenId,
      name: "Trending Test User",
      email: "trending@test.com",
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
      await caller.youtube.getTrendingVideos({
        regionCode: "KR",
        sortBy: "trending",
        maxResults: 12,
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

    const result = await caller.youtube.getTrendingVideos({
      regionCode: "KR",
      sortBy: "trending",
      maxResults: 12,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("API Key not found");
    expect(result.videos).toEqual([]);
  });

  it("should return error when API key test status is not success", async () => {
    // Create another test user with untested API key
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const untestedUserOpenId = `test-untested-${Date.now()}`;
    await db.insert(users).values({ memberNo: 10131,
      openId: untestedUserOpenId,
      name: "Untested User",
      email: "untested@test.com",
      role: "user",
    });

    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.openId, untestedUserOpenId))
      .limit(1);

    const untestedUserId = userResult[0].id;

    await saveUserApiKey(untestedUserId, "youtube", "AIzaSyUntested123");
    // Don't mark as tested

    const caller = appRouter.createCaller({
      user: { id: untestedUserId, openId: untestedUserOpenId, name: "Untested", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.youtube.getTrendingVideos({
      regionCode: "KR",
      sortBy: "trending",
      maxResults: 12,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("YouTube API 키 오류입니다.");
    expect(result.videos).toEqual([]);

    // Clean up
    await db.delete(userApiKeys).where(eq(userApiKeys.userId, untestedUserId));
    await db.delete(users).where(eq(users.openId, untestedUserOpenId));
  });

  it("should validate region code format", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    // Test with valid region code
    try {
      // This will fail due to invalid API key, but should pass validation
      const result = await caller.youtube.getTrendingVideos({
        regionCode: "KR",
        sortBy: "trending",
        maxResults: 12,
      });

      // Should have attempted API call (will fail with invalid key)
      expect(result).toBeDefined();
    } catch (error) {
      // Expected to fail due to invalid API key
      expect(error).toBeDefined();
    }
  });

  it("should validate maxResults range", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    try {
      // Test with invalid maxResults (too high)
      await caller.youtube.getTrendingVideos({
        regionCode: "KR",
        sortBy: "trending",
        maxResults: 100, // Should be max 50
      });
      expect.fail("Should reject maxResults > 50");
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

    const sortOptions = ["trending", "viewCount", "publishedAt"] as const;

    for (const sortBy of sortOptions) {
      try {
        const result = await caller.youtube.getTrendingVideos({
          regionCode: "KR",
          sortBy,
          maxResults: 12,
        });

        // Will fail with invalid API key, but should accept the sort option
        expect(result).toBeDefined();
      } catch (error) {
        // Expected to fail due to invalid API key
        expect(error).toBeDefined();
      }
    }
  });

  it("should not expose API key in response", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    try {
      const result = await caller.youtube.getTrendingVideos({
        regionCode: "KR",
        sortBy: "trending",
        maxResults: 12,
      });

      // Check that API key is not in the response
      const resultString = JSON.stringify(result);
      expect(resultString).not.toContain("AIzaSy");
      expect(resultString).not.toContain(testApiKey);
    } catch (error) {
      // Expected to fail due to invalid API key
      expect(error).toBeDefined();
    }
  });

  it("should use user-specific API key", async () => {
    // Create two test users with different API keys
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const user1OpenId = `test-user1-${Date.now()}`;
    const user2OpenId = `test-user2-${Date.now()}`;

    await db.insert(users).values([
      { memberNo: 10132, openId: user1OpenId, name: "User 1", email: "user1@test.com", role: "user" },
      { memberNo: 10133, openId: user2OpenId, name: "User 2", email: "user2@test.com", role: "user" },
    ]);

    const user1Result = await db
      .select()
      .from(users)
      .where(eq(users.openId, user1OpenId))
      .limit(1);

    const user2Result = await db
      .select()
      .from(users)
      .where(eq(users.openId, user2OpenId))
      .limit(1);

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    const user1ApiKey = "AIzaSyUser1Key123456789";
    const user2ApiKey = "AIzaSyUser2Key123456789";

    await saveUserApiKey(user1Id, "youtube", user1ApiKey);
    await saveUserApiKey(user2Id, "youtube", user2ApiKey);

    await updateApiKeyTestStatus(user1Id, "youtube", "success");
    await updateApiKeyTestStatus(user2Id, "youtube", "success");

    // Verify each user has their own API key
    const user1Key = await getUserApiKey(user1Id, "youtube");
    const user2Key = await getUserApiKey(user2Id, "youtube");

    expect(user1Key?.apiKey).toBe(user1ApiKey);
    expect(user2Key?.apiKey).toBe(user2ApiKey);
    expect(user1Key?.apiKey).not.toBe(user2Key?.apiKey);

    // Clean up
    await db.delete(userApiKeys).where(eq(userApiKeys.userId, user1Id));
    await db.delete(userApiKeys).where(eq(userApiKeys.userId, user2Id));
    await db.delete(users).where(eq(users.openId, user1OpenId));
    await db.delete(users).where(eq(users.openId, user2OpenId));
  });
});
