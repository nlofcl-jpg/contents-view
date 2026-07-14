import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { users, youtubeBookmarks } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("YouTube Bookmarks - viewCount Type Conversion", () => {
  let testUserId: number;
  let caller: ReturnType<typeof appRouter.createCaller>;
  const testOpenId = `test-bookmark-${Date.now()}`;

  beforeAll(async () => {
    // Create a test user
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db.insert(users).values({
      memberNo: 10030 + Math.floor(Math.random() * 1000),
      openId: testOpenId,
      name: "Test Bookmark User",
      email: "test-bookmark@example.com",
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

    // Create caller with test user context
    caller = appRouter.createCaller({
      user: { id: testUserId, openId: testOpenId, name: "Test Bookmark User", role: "user" },
      req: {} as any,
      res: {} as any,
    });
  });

  afterAll(async () => {
    // Clean up test data
    const db = await getDb();
    if (!db) return;

    // Delete bookmarks first
    await db.delete(youtubeBookmarks).where(eq(youtubeBookmarks.userId, testUserId));

    // Delete user
    await db.delete(users).where(eq(users.openId, testOpenId));
  });

  it("should accept viewCount as number and normalize to string", async () => {
    const result = await caller.youtubeBookmarks.add({
      videoId: `test-video-num-${Date.now()}`,
      contentType: "video",
      title: "Test Video with Number ViewCount",
      thumbnailUrl: "https://example.com/thumb.jpg",
      channelTitle: "Test Channel",
      viewCount: 1234567, // number type
      publishedAt: "2026-06-15T00:00:00Z",
      duration: "PT10M30S",
    });

    expect(result.success).toBe(true);

    // Verify the bookmark was saved with viewCount as string
    const bookmarks = await caller.youtubeBookmarks.list();
    const bookmark = bookmarks.find((b: any) => b.title === "Test Video with Number ViewCount");
    expect(bookmark).toBeDefined();
    expect(bookmark?.viewCount).toBe("1234567");
    expect(typeof bookmark?.viewCount).toBe("string");
  });

  it("should accept viewCount as string", async () => {
    const result = await caller.youtubeBookmarks.add({
      videoId: `test-video-str-${Date.now()}`,
      contentType: "video",
      title: "Test Video with String ViewCount",
      thumbnailUrl: "https://example.com/thumb.jpg",
      channelTitle: "Test Channel",
      viewCount: "9876543", // string type
      publishedAt: "2026-06-15T00:00:00Z",
      duration: "PT5M",
    });

    expect(result.success).toBe(true);

    // Verify the bookmark was saved
    const bookmarks = await caller.youtubeBookmarks.list();
    const bookmark = bookmarks.find((b: any) => b.title === "Test Video with String ViewCount");
    expect(bookmark).toBeDefined();
    expect(bookmark?.viewCount).toBe("9876543");
  });

  it("should handle missing viewCount gracefully", async () => {
    const result = await caller.youtubeBookmarks.add({
      videoId: `test-video-none-${Date.now()}`,
      contentType: "shorts",
      title: "Test Shorts without ViewCount",
      thumbnailUrl: "https://example.com/thumb.jpg",
      channelTitle: "Test Channel",
      publishedAt: "2026-06-15T00:00:00Z",
      duration: "PT30S",
      // viewCount omitted
    });

    expect(result.success).toBe(true);

    // Verify the bookmark was saved without viewCount
    const bookmarks = await caller.youtubeBookmarks.list();
    const bookmark = bookmarks.find((b: any) => b.title === "Test Shorts without ViewCount");
    expect(bookmark).toBeDefined();
    expect(bookmark?.viewCount).toBeNull();
  });

  it("should handle viewCount as zero", async () => {
    const result = await caller.youtubeBookmarks.add({
      videoId: `test-video-zero-${Date.now()}`,
      contentType: "video",
      title: "Test Video with Zero ViewCount",
      thumbnailUrl: "https://example.com/thumb.jpg",
      channelTitle: "Test Channel",
      viewCount: 0, // number zero
      publishedAt: "2026-06-15T00:00:00Z",
      duration: "PT1M",
    });

    expect(result.success).toBe(true);

    // Verify the bookmark was saved with viewCount as "0"
    const bookmarks = await caller.youtubeBookmarks.list();
    const bookmark = bookmarks.find((b: any) => b.title === "Test Video with Zero ViewCount");
    expect(bookmark).toBeDefined();
    expect(bookmark?.viewCount).toBe("0");
  });

  it("should handle large viewCount numbers", async () => {
    const largeViewCount = 999999999999; // Large number
    const result = await caller.youtubeBookmarks.add({
      videoId: `test-video-large-${Date.now()}`,
      contentType: "video",
      title: "Test Video with Large ViewCount",
      viewCount: largeViewCount,
    });

    expect(result.success).toBe(true);

    const bookmarks = await caller.youtubeBookmarks.list();
    const bookmark = bookmarks.find((b: any) => b.title === "Test Video with Large ViewCount");
    expect(bookmark).toBeDefined();
    expect(bookmark?.viewCount).toBe(String(largeViewCount));
  });

  it("should support both video and shorts content types with viewCount", async () => {
    const videoId = `test-video-both-${Date.now()}`;

    // Add video bookmark
    await caller.youtubeBookmarks.add({
      videoId: videoId,
      contentType: "video",
      title: "Test Video Content",
      viewCount: 1000,
    });

    // Add shorts bookmark (different content type, same video ID)
    await caller.youtubeBookmarks.add({
      videoId: videoId,
      contentType: "shorts",
      title: "Test Shorts Content",
      viewCount: 2000,
    });

    const bookmarks = await caller.youtubeBookmarks.list();
    const video = bookmarks.find((b: any) => b.videoId === videoId && b.contentType === "video");
    const shorts = bookmarks.find((b: any) => b.videoId === videoId && b.contentType === "shorts");

    expect(video).toBeDefined();
    expect(shorts).toBeDefined();
    expect(video?.viewCount).toBe("1000");
    expect(shorts?.viewCount).toBe("2000");
  });
});
