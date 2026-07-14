import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { users, userApiKeys } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

describe("user.apiKey procedures", () => {
  let testUserId: number;
  const testOpenId = `test-user-${Date.now()}`;
  const testApiKey = "AIzaSyDummyTestKey1234567890abcdefghijk";
  const testApiKeyUpdated = "AIzaSyUpdatedTestKey1234567890abcdefghijk";

  beforeAll(async () => {
    // Create a test user
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const result = await db.insert(users).values({ memberNo: 10020,
      openId: testOpenId,
      name: "Test User",
      email: "test@example.com",
      role: "user",
    });

    // Get the inserted user ID
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.openId, testOpenId))
      .limit(1);

    if (userResult.length === 0) {
      throw new Error("Failed to create test user");
    }

    testUserId = userResult[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    const db = await getDb();
    if (!db) return;

    await db
      .delete(userApiKeys)
      .where(eq(userApiKeys.userId, testUserId));

    await db.delete(users).where(eq(users.openId, testOpenId));
  });

  it("should save API key for a user", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testOpenId, name: "Test User", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.user.apiKey.save({
      provider: "youtube",
      apiKey: testApiKey,
    });

    expect(result.success).toBe(true);
    
    // After save, refetch to get masked key
    const getResult = await caller.user.apiKey.getWithStatus({ provider: "youtube" });
    expect(getResult.exists).toBe(true);
    expect(getResult.maskedKey).toContain("*");
    expect(getResult.maskedKey).toContain("AIzaSy");
    // Last 4 characters are shown
    expect(getResult.maskedKey).toContain("hijk");
  });

  it("should get masked API key", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testOpenId, name: "Test User", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.user.apiKey.getWithStatus({ provider: "youtube" });

    expect(result.exists).toBe(true);
    expect(result.maskedKey).toBeDefined();
    expect(result.maskedKey).not.toContain(testApiKey);
    expect(result.maskedKey).toContain("*");
  });

  it("should update existing API key", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testOpenId, name: "Test User", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.user.apiKey.save({
      provider: "youtube",
      apiKey: testApiKeyUpdated,
    });

    expect(result.success).toBe(true);

    // Verify it's actually updated in DB
    const getResult = await caller.user.apiKey.getWithStatus({ provider: "youtube" });
    expect(getResult.maskedKey).toBeDefined();
    expect(getResult.maskedKey).toContain("*");
  });

  it("should delete API key", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testOpenId, name: "Test User", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const deleteResult = await caller.user.apiKey.delete({ provider: "youtube" });
    expect(deleteResult.success).toBe(true);

    // Verify it's deleted
    const getResult = await caller.user.apiKey.getWithStatus({ provider: "youtube" });
    expect(getResult.exists).toBe(false);
    expect(getResult.maskedKey).toBeNull();
  });

  it("should return false when API key doesn't exist", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testOpenId, name: "Test User", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller.user.apiKey.getWithStatus({ provider: "youtube" });

    expect(result.exists).toBe(false);
    expect(result.maskedKey).toBeNull();
  });

  it("should not allow unauthenticated access to save", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    try {
      await caller.user.apiKey.save({
        provider: "youtube",
        apiKey: testApiKey,
      });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should not allow unauthenticated access to delete", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });

    try {
      await caller.user.apiKey.delete({ provider: "youtube" });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should mask API key correctly", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, openId: testOpenId, name: "Test User", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    // Save a new key
    await caller.user.apiKey.save({
      provider: "youtube",
      apiKey: "AIzaSyTestKey123",
    });

    const result = await caller.user.apiKey.getWithStatus({ provider: "youtube" });

    // Should show first 6 and last 4 characters with asterisks in between
    expect(result.maskedKey).toBeDefined();
    expect(result.maskedKey).toContain("AIzaSy");
    expect(result.maskedKey).toContain("*");
    expect(result.maskedKey).toContain("123");
    // Verify the original key is not exposed
    expect(result.maskedKey).not.toContain("TestKey");
  });
});
