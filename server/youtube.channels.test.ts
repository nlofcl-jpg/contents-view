import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb, saveUserApiKey, getUserApiKey, updateApiKeyTestStatus } from "./db";
import { users, userApiKeys } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("YouTube Popular Channels", () => {
  let testUserId: number;
  const testUserOpenId = `test-channels-${Date.now()}`;
  const testApiKey = "AIzaSyTestKey123456789";

  beforeAll(async () => {
    // Create test user
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db.insert(users).values({ memberNo: 10060,
      openId: testUserOpenId,
      name: "Channels Test User",
      email: "channels@test.com",
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
      // Delete API keys for all test users
      const testUsers = await db
        .select()
        .from(users)
        .where(eq(users.openId, testUserOpenId));
      
      for (const user of testUsers) {
        await db.delete(userApiKeys).where(eq(userApiKeys.userId, user.id));
      }

      // Delete all test users from this test file
      await db.delete(users).where(eq(users.openId, testUserOpenId));
      
      // Also clean up any test-channels- users that might have been created
      const allTestUsers = await db
        .select()
        .from(users)
        .where(eq(users.openId, testUserOpenId));
      
      for (const user of allTestUsers) {
        await db.delete(userApiKeys).where(eq(userApiKeys.userId, user.id));
        await db.delete(users).where(eq(users.openId, user.openId));
      }
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
      await caller.youtube.getPopularChannels({
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

    const result = await caller.youtube.getPopularChannels({
      regionCode: "KR",
      sortBy: "trending",
      maxResults: 12,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("API Key not found");
    expect(result.channels).toEqual([]);
  });

  it("should return error when API key test status is not success", async () => {
    // Create another test user with untested API key
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const untestedUserOpenId = `test-untested-channels-${Date.now()}`;
    await db.insert(users).values({ memberNo: 10061,
      openId: untestedUserOpenId,
      name: "Untested Channels User",
      email: "untested-channels@test.com",
      role: "user",
    });

    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.openId, untestedUserOpenId))
      .limit(1);

    if (userResult.length === 0) {
      throw new Error("Failed to create untested user");
    }

    const untestedUserId = userResult[0].id;

    // Save API key but don't mark as tested
    await saveUserApiKey(untestedUserId, "youtube", testApiKey);

    const caller = appRouter.createCaller({
      user: { id: untestedUserId, openId: untestedUserOpenId, name: "Untested", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.youtube.getPopularChannels({
      regionCode: "KR",
      sortBy: "trending",
      maxResults: 12,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("YouTube API 키 오류입니다.");
    expect(result.channels).toEqual([]);

    // Clean up
    await db.delete(userApiKeys).where(eq(userApiKeys.userId, untestedUserId));
    await db.delete(users).where(eq(users.openId, untestedUserOpenId));
  });

  it("should validate regionCode input", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    try {
      await caller.youtube.getPopularChannels({
        regionCode: "INVALID",
        sortBy: "trending",
        maxResults: 12,
      });
      expect.fail("Should throw error for invalid region code");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should validate sortBy input", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    try {
      await caller.youtube.getPopularChannels({
        regionCode: "KR",
        sortBy: "invalid" as any,
        maxResults: 12,
      });
      expect.fail("Should throw error for invalid sortBy");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should validate maxResults input", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    try {
      await caller.youtube.getPopularChannels({
        regionCode: "KR",
        sortBy: "trending",
        maxResults: 100, // Exceeds max of 50
      });
      expect.fail("Should throw error for maxResults > 50");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it.skip("should accept valid sortBy options", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const sortByOptions = ["trending", "subscribers", "views"];

    for (const sortBy of sortByOptions) {
      try {
        // Note: This will fail with API error since test key is invalid,
        // but we're testing that the input validation passes
        await caller.youtube.getPopularChannels({
          regionCode: "KR",
          sortBy: sortBy as any,
          maxResults: 12,
        });
      } catch (error: any) {
        // Expected to fail with API error, not validation error
        expect(error.message).not.toContain("Invalid enum value");
      }
    }
  });

  it("should accept optional videoCategoryId", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    try {
      // Should not throw validation error
      await caller.youtube.getPopularChannels({
        regionCode: "KR",
        sortBy: "trending",
        maxResults: 12,
        videoCategoryId: 10, // Music category
      });
    } catch (error: any) {
      // Expected to fail with API error, not validation error
      expect(error.message).not.toContain("videoCategoryId");
    }
  });

  it("should not expose API key in response", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    try {
      const result = await caller.youtube.getPopularChannels({
        regionCode: "KR",
        sortBy: "trending",
        maxResults: 12,
      });

      // Check that API key is not in the response
      const responseString = JSON.stringify(result);
      expect(responseString).not.toContain(testApiKey);
      expect(responseString).not.toContain("AIzaSy");
    } catch (error) {
      // Expected to fail with API error
    }
  });

  it("should maintain per-user API key isolation", async () => {
    // Create another test user
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const anotherUserOpenId = `test-another-channels-${Date.now()}`;
    await db.insert(users).values({ memberNo: 10062,
      openId: anotherUserOpenId,
      name: "Another Channels User",
      email: "another-channels@test.com",
      role: "user",
    });

    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.openId, anotherUserOpenId))
      .limit(1);

    if (userResult.length === 0) {
      throw new Error("Failed to create another user");
    }

    const anotherUserId = userResult[0].id;
    const anotherApiKey = "AIzaSyAnotherTestKey987654321";

    // Save different API key for another user
    await saveUserApiKey(anotherUserId, "youtube", anotherApiKey);
    await updateApiKeyTestStatus(anotherUserId, "youtube", "success");

    // Verify that first user's API key is different
    const firstUserKey = await getUserApiKey(testUserId, "youtube");
    const secondUserKey = await getUserApiKey(anotherUserId, "youtube");

    expect(firstUserKey?.apiKey).not.toBe(secondUserKey?.apiKey);
    expect(firstUserKey?.apiKey).toBe(testApiKey);
    expect(secondUserKey?.apiKey).toBe(anotherApiKey);

    // Clean up
    await db.delete(userApiKeys).where(eq(userApiKeys.userId, anotherUserId));
    await db.delete(users).where(eq(users.openId, anotherUserOpenId));
  });
});
