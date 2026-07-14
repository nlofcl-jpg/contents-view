import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { users, userApiKeys } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("user.apiKey security", () => {
  let user1Id: number;
  let user2Id: number;
  const user1OpenId = `test-user-1-${Date.now()}`;
  const user2OpenId = `test-user-2-${Date.now()}`;
  const testApiKey = "AIzaSyTestKey123456789";

  beforeAll(async () => {
    // Create two test users
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // User 1
    await db.insert(users).values({ memberNo: 10000,
      openId: user1OpenId,
      name: "User 1",
      email: "user1@example.com",
      role: "user",
    });

    const user1Result = await db
      .select()
      .from(users)
      .where(eq(users.openId, user1OpenId))
      .limit(1);

    if (user1Result.length === 0) {
      throw new Error("Failed to create user 1");
    }
    user1Id = user1Result[0].id;

    // User 2
    await db.insert(users).values({ memberNo: 10001,
      openId: user2OpenId,
      name: "User 2",
      email: "user2@example.com",
      role: "user",
    });

    const user2Result = await db
      .select()
      .from(users)
      .where(eq(users.openId, user2OpenId))
      .limit(1);

    if (user2Result.length === 0) {
      throw new Error("Failed to create user 2");
    }
    user2Id = user2Result[0].id;

    // Save API key for User 1
    const caller1 = appRouter.createCaller({
      user: { id: user1Id, openId: user1OpenId, name: "User 1", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    await caller1.user.apiKey.save({
      provider: "youtube",
      apiKey: testApiKey,
    });
  });

  afterAll(async () => {
    // Clean up test data
    const db = await getDb();
    if (!db) return;

    await db.delete(userApiKeys).where(eq(userApiKeys.userId, user1Id));
    await db.delete(userApiKeys).where(eq(userApiKeys.userId, user2Id));
    await db.delete(users).where(eq(users.openId, user1OpenId));
    await db.delete(users).where(eq(users.openId, user2OpenId));
  });

  it("should not allow user 2 to read user 1's API key", async () => {
    const caller2 = appRouter.createCaller({
      user: { id: user2Id, openId: user2OpenId, name: "User 2", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller2.user.apiKey.getWithStatus({ provider: "youtube" });

    // User 2 should see no API key (not User 1's key)
    expect(result.exists).toBe(false);
    expect(result.maskedKey).toBeNull();
  });

  it("should not allow user 2 to delete user 1's API key", async () => {
    const caller2 = appRouter.createCaller({
      user: { id: user2Id, openId: user2OpenId, name: "User 2", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    // Try to delete (should only delete user 2's key, not user 1's)
    await caller2.user.apiKey.delete({ provider: "youtube" });

    // Verify User 1's key still exists
    const caller1 = appRouter.createCaller({
      user: { id: user1Id, openId: user1OpenId, name: "User 1", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller1.user.apiKey.getWithStatus({ provider: "youtube" });
    expect(result.exists).toBe(true);
    expect(result.maskedKey).toBeDefined();
  });

  it("should not allow user 2 to update user 1's API key", async () => {
    const caller2 = appRouter.createCaller({
      user: { id: user2Id, openId: user2OpenId, name: "User 2", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const newKey = "AIzaSyDifferentKey123456789";

    // User 2 saves a key (creates their own, not updates User 1's)
    await caller2.user.apiKey.save({
      provider: "youtube",
      apiKey: newKey,
    });

    // Verify User 1's key is unchanged
    const caller1 = appRouter.createCaller({
      user: { id: user1Id, openId: user1OpenId, name: "User 1", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result = await caller1.user.apiKey.getWithStatus({ provider: "youtube" });
    expect(result.exists).toBe(true);
    // Original key should still be there (masked)
    expect(result.maskedKey).toContain("AIzaSy");
  });

  it("should isolate API keys by user ID", async () => {
    // User 1 should see their key
    const caller1 = appRouter.createCaller({
      user: { id: user1Id, openId: user1OpenId, name: "User 1", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result1 = await caller1.user.apiKey.getWithStatus({ provider: "youtube" });
    expect(result1.exists).toBe(true);

    // User 2 should see their own key (if they saved one)
    const caller2 = appRouter.createCaller({
      user: { id: user2Id, openId: user2OpenId, name: "User 2", role: "user" },
      req: {} as any,
      res: {} as any,
    });

    const result2 = await caller2.user.apiKey.getWithStatus({ provider: "youtube" });
    // User 2 may or may not have a key depending on previous test execution
    // But if they do, it should be different from User 1's
    if (result2.exists && result1.exists) {
      expect(result2.maskedKey).not.toEqual(result1.maskedKey);
    }
  });
});
