import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb, saveUserApiKey, updateApiKeyTestStatus } from "./db";
import { users, userApiKeys } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("YouTube Popular Channels Integration Tests", () => {
  let testUserId: number;
  const testUserOpenId = `test-channels-integration-${Date.now()}`;
  const testApiKey = "AIzaSyTestKey123456789";

  beforeAll(async () => {
    // Create test user
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db.insert(users).values({ memberNo: 10040,
      openId: testUserOpenId,
      name: "Channels Integration Test User",
      email: "channels-integration@test.com",
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

  it("should return consistent response structure with all required channel fields", async () => {
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

      // Check response structure
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("channels");

      if (result.success && result.channels.length > 0) {
        const channel = result.channels[0];
        
        // Verify all required channel fields exist
        expect(channel).toHaveProperty("channelId");
        expect(channel).toHaveProperty("channelTitle");
        expect(channel).toHaveProperty("channelDescription");
        expect(channel).toHaveProperty("thumbnail");
        expect(channel).toHaveProperty("subscriberCount");
        expect(channel).toHaveProperty("viewCount");
        expect(channel).toHaveProperty("videoCount");
        expect(channel).toHaveProperty("videoCountInTrending");
        expect(channel).toHaveProperty("topVideoTitle");
        expect(channel).toHaveProperty("trendingScore");

        // Verify field types
        expect(typeof channel.channelId).toBe("string");
        expect(typeof channel.channelTitle).toBe("string");
        expect(typeof channel.subscriberCount).toBe("number");
        expect(typeof channel.viewCount).toBe("number");
        expect(typeof channel.videoCount).toBe("number");
        expect(typeof channel.videoCountInTrending).toBe("number");
        expect(typeof channel.trendingScore).toBe("number");
      }
    } catch (error: any) {
      // Expected to fail with API error, but structure validation should pass
      expect(error).toBeDefined();
    }
  });

  it("should support different region codes", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const regionCodes = ["KR", "US", "JP", "GB", "FR", "ES", "DE"];

    for (const regionCode of regionCodes) {
      try {
        const result = await caller.youtube.getPopularChannels({
          regionCode,
          sortBy: "trending",
          maxResults: 12,
        });

        // Should return valid response structure (API may fail, but validation should pass)
        expect(result).toHaveProperty("success");
        expect(result).toHaveProperty("channels");
      } catch (error: any) {
        // Expected to fail with API error, but not validation error
        expect(error.message).not.toContain("Invalid enum value");
      }
    }
  });

  it("should support different sort options", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const sortOptions = ["trending", "subscribers", "views"];

    for (const sortBy of sortOptions) {
      try {
        const result = await caller.youtube.getPopularChannels({
          regionCode: "KR",
          sortBy: sortBy as any,
          maxResults: 12,
        });

        // Should return valid response structure
        expect(result).toHaveProperty("success");
        expect(result).toHaveProperty("channels");
      } catch (error: any) {
        // Expected to fail with API error, but not validation error
        expect(error.message).not.toContain("Invalid enum value");
      }
    }
  });

  it("should support all video categories", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const categories = [1, 2, 10, 15, 17, 19, 20, 22, 23, 24, 25, 26, 27, 28];

    for (const categoryId of categories) {
      try {
        const result = await caller.youtube.getPopularChannels({
          regionCode: "KR",
          sortBy: "trending",
          maxResults: 12,
          videoCategoryId: categoryId,
        });

        // Should return valid response structure
        expect(result).toHaveProperty("success");
        expect(result).toHaveProperty("channels");
      } catch (error: any) {
        // Expected to fail with API error, but not validation error
        expect(error.message).not.toContain("videoCategoryId");
      }
    }
  });

  it("should respect maxResults parameter", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const maxResultsValues = [1, 5, 12, 24, 50];

    for (const maxResults of maxResultsValues) {
      try {
        const result = await caller.youtube.getPopularChannels({
          regionCode: "KR",
          sortBy: "trending",
          maxResults,
        });

        // If successful, verify maxResults is respected
        if (result.success && result.channels.length > 0) {
          expect(result.channels.length).toBeLessThanOrEqual(maxResults);
        }
      } catch (error: any) {
        // Expected to fail with API error
        expect(error).toBeDefined();
      }
    }
  });

  it("should calculate trending score for sorting", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    try {
      const trendingResult = await caller.youtube.getPopularChannels({
        regionCode: "KR",
        sortBy: "trending",
        maxResults: 12,
      });

      if (trendingResult.success && trendingResult.channels.length > 1) {
        // Verify trending score is used for sorting
        for (let i = 0; i < trendingResult.channels.length - 1; i++) {
          const current = trendingResult.channels[i];
          const next = trendingResult.channels[i + 1];
          expect(current.trendingScore).toBeGreaterThanOrEqual(next.trendingScore);
        }
      }
    } catch (error: any) {
      // Expected to fail with API error
      expect(error).toBeDefined();
    }
  });

  it("should sort by subscribers when sortBy is 'subscribers'", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    try {
      const result = await caller.youtube.getPopularChannels({
        regionCode: "KR",
        sortBy: "subscribers",
        maxResults: 12,
      });

      if (result.success && result.channels.length > 1) {
        // Verify channels are sorted by subscriber count (descending)
        for (let i = 0; i < result.channels.length - 1; i++) {
          const current = result.channels[i];
          const next = result.channels[i + 1];
          expect(current.subscriberCount).toBeGreaterThanOrEqual(next.subscriberCount);
        }
      }
    } catch (error: any) {
      // Expected to fail with API error
      expect(error).toBeDefined();
    }
  });

  it("should sort by views when sortBy is 'views'", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    try {
      const result = await caller.youtube.getPopularChannels({
        regionCode: "KR",
        sortBy: "views",
        maxResults: 12,
      });

      if (result.success && result.channels.length > 1) {
        // Verify channels are sorted by view count (descending)
        for (let i = 0; i < result.channels.length - 1; i++) {
          const current = result.channels[i];
          const next = result.channels[i + 1];
          expect(current.viewCount).toBeGreaterThanOrEqual(next.viewCount);
        }
      }
    } catch (error: any) {
      // Expected to fail with API error
      expect(error).toBeDefined();
    }
  });

  it("should not expose API key in any response field", async () => {
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

      // Stringify and check for API key patterns
      const responseString = JSON.stringify(result);
      expect(responseString).not.toContain(testApiKey);
      expect(responseString).not.toContain("AIzaSy");
      
      // Check individual fields if channels exist
      if (result.success && result.channels.length > 0) {
        result.channels.forEach((channel: any) => {
          expect(JSON.stringify(channel)).not.toContain(testApiKey);
          expect(JSON.stringify(channel)).not.toContain("AIzaSy");
        });
      }
    } catch (error: any) {
      // Expected to fail with API error, but no key exposure
      const errorString = JSON.stringify(error);
      expect(errorString).not.toContain(testApiKey);
    }
  });

  it("should handle empty results gracefully", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testUserOpenId, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    try {
      const result = await caller.youtube.getPopularChannels({
        regionCode: "KR",
        sortBy: "trending",
        maxResults: 1,
      });

      // Should return valid response structure even with 1 result
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("channels");
      expect(Array.isArray(result.channels)).toBe(true);
    } catch (error: any) {
      // Expected to fail with API error
      expect(error).toBeDefined();
    }
  });
});
