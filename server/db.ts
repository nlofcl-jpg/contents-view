import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, userApiKeys, UserApiKey, youtubeBookmarks, YouTubeBookmark, InsertYouTubeBookmark } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    const isNewUser = existingUser.length === 0;

    // For new users, assign next memberNo
    let nextMemberNo = 1;
    if (isNewUser) {
      const maxMemberNo = await db.select({ max: users.memberNo }).from(users);
      const currentMax = maxMemberNo[0]?.max;
      // Ensure memberNo is at least 1, and increment from current max
      nextMemberNo = (currentMax && currentMax > 0) ? currentMax + 1 : 1;
    }

    const values: InsertUser = {
      openId: user.openId,
      memberNo: isNewUser ? nextMemberNo : 0, // 0 is placeholder for existing users, won't be used
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    // Handle approvalStatus: admin always approved, new users pending
    if (user.approvalStatus !== undefined) {
      values.approvalStatus = user.approvalStatus;
      updateSet.approvalStatus = user.approvalStatus;
    } else if (user.openId === ENV.ownerOpenId) {
      // Admin users are always approved
      values.approvalStatus = 'approved';
      updateSet.approvalStatus = 'approved';
    } else {
      // New regular users default to pending
      values.approvalStatus = 'pending';
      // Don't add to updateSet - only set on INSERT, not on UPDATE
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // memberNo is only set for new users via spread operator above

    // For new users, use regular insert; for existing users, use onDuplicateKeyUpdate
    if (isNewUser) {
      // For new users, memberNo is set to nextMemberNo
      await db.insert(users).values(values);
    } else {
      // For existing users, memberNo should not be updated, so remove it from values
      const existingUserValues: InsertUser = {
        openId: user.openId,
        memberNo: 0, // placeholder
      };
      // Copy only non-memberNo fields
      Object.keys(values).forEach(key => {
        if (key !== 'memberNo' && key in values) {
          (existingUserValues as any)[key] = (values as any)[key];
        }
      });
      await db.insert(users).values(existingUserValues).onDuplicateKeyUpdate({
        set: updateSet,
      });
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserName(openId: string, name: string): Promise<void> {
  if (!openId) {
    throw new Error("User openId is required for update");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update user: database not available");
    return;
  }

  try {
    await db.update(users).set({ name }).where(eq(users.openId, openId));
  } catch (error) {
    console.error("[Database] Failed to update user name:", error);
    throw error;
  }
}

/**
 * Get user's API key for a specific provider (returns masked key)
 */
export async function getUserApiKey(userId: number, provider: string): Promise<UserApiKey | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get API key: database not available");
    return undefined;
  }

  try {
    const result = await db
      .select()
      .from(userApiKeys)
      .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)))
      .limit(1);

    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] Failed to get API key:", error);
    throw error;
  }
}

/**
 * Save or update user's API key for a specific provider
 */
export async function saveUserApiKey(userId: number, provider: string, apiKey: string): Promise<void> {
  if (!userId || !provider || !apiKey) {
    throw new Error("userId, provider, and apiKey are required");
  }

  // Additional validation: ensure apiKey is not empty after trimming
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error("API key cannot be empty or whitespace only");
  }

  // Diagnostic logging (without exposing full key)
  console.log("[API Key Save] Saving API key", {
    userId,
    provider,
    keyLength: trimmedKey.length,
    keyPrefix: trimmedKey.slice(0, 6),
    keySuffix: trimmedKey.slice(-4),
    timestamp: new Date().toISOString(),
  });

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot save API key: database not available");
    return;
  }

  try {
    // Check if key already exists
    const existing = await db
      .select()
      .from(userApiKeys)
      .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)))
      .limit(1);

    if (existing.length > 0) {
      // Update existing key
      await db
        .update(userApiKeys)
        .set({ apiKey: trimmedKey, updatedAt: new Date() })
        .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)));
    } else {
      // Insert new key
      await db.insert(userApiKeys).values({
        userId,
        provider,
        apiKey: trimmedKey,
      });
    }
  } catch (error) {
    console.error("[Database] Failed to save API key:", error);
    throw error;
  }
}

/**
 * Delete user's API key for a specific provider
 */
export async function deleteUserApiKey(userId: number, provider: string): Promise<void> {
  if (!userId || !provider) {
    throw new Error("userId and provider are required");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete API key: database not available");
    return;
  }

  try {
    await db
      .delete(userApiKeys)
      .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)));
  } catch (error) {
    console.error("[Database] Failed to delete API key:", error);
    throw error;
  }
}

/**
 * Get all YouTube bookmarks for a user
 */
export async function getUserYouTubeBookmarks(userId: number): Promise<YouTubeBookmark[]> {
  if (!userId) {
    throw new Error("userId is required");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get bookmarks: database not available");
    return [];
  }

  try {
    const result = await db
      .select()
      .from(youtubeBookmarks)
      .where(eq(youtubeBookmarks.userId, userId))
      .orderBy(youtubeBookmarks.createdAt);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get YouTube bookmarks:", error);
    throw error;
  }
}

/**
 * Check if a video is bookmarked by a user
 */
export async function isYouTubeVideoBookmarked(
  userId: number,
  videoId: string,
  contentType: "video" | "shorts"
): Promise<boolean> {
  if (!userId || !videoId || !contentType) {
    throw new Error("userId, videoId, and contentType are required");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot check bookmark: database not available");
    return false;
  }

  try {
    const result = await db
      .select()
      .from(youtubeBookmarks)
      .where(
        and(
          eq(youtubeBookmarks.userId, userId),
          eq(youtubeBookmarks.videoId, videoId),
          eq(youtubeBookmarks.contentType, contentType)
        )
      )
      .limit(1);
    return result.length > 0;
  } catch (error) {
    console.error("[Database] Failed to check bookmark:", error);
    throw error;
  }
}

/**
 * Add a YouTube video to user's bookmarks
 */
export async function addYouTubeBookmark(
  userId: number,
  bookmark: InsertYouTubeBookmark
): Promise<void> {
  if (!userId || !bookmark.videoId || !bookmark.contentType) {
    throw new Error("userId, videoId, and contentType are required");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot add bookmark: database not available");
    return;
  }

  try {
    await db.insert(youtubeBookmarks).values({
      ...bookmark,
      userId,
    });
  } catch (error: any) {
    // Handle duplicate entry (UNIQUE constraint violation)
    if (error.code === "ER_DUP_ENTRY" || error.message?.includes("Duplicate entry")) {
      console.log("[Database] Video already bookmarked by user");
      return; // Silently ignore duplicate bookmarks
    }
    console.error("[Database] Failed to add YouTube bookmark:", error);
    throw error;
  }
}

/**
 * Remove a YouTube video from user's bookmarks
 */
export async function removeYouTubeBookmark(
  userId: number,
  videoId: string,
  contentType: "video" | "shorts"
): Promise<void> {
  if (!userId || !videoId || !contentType) {
    throw new Error("userId, videoId, and contentType are required");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot remove bookmark: database not available");
    return;
  }

  try {
    console.log("[Bookmark Remove] Starting deletion", {
      userId,
      videoId,
      contentType,
      timestamp: new Date().toISOString(),
    });

    // Check if bookmark exists before deletion
    const existingBookmarks = await db
      .select()
      .from(youtubeBookmarks)
      .where(
        and(
          eq(youtubeBookmarks.userId, userId),
          eq(youtubeBookmarks.videoId, videoId),
          eq(youtubeBookmarks.contentType, contentType)
        )
      );

    console.log("[Bookmark Remove] Found bookmarks before deletion", {
      count: existingBookmarks.length,
    });

    // Perform deletion
    await db
      .delete(youtubeBookmarks)
      .where(
        and(
          eq(youtubeBookmarks.userId, userId),
          eq(youtubeBookmarks.videoId, videoId),
          eq(youtubeBookmarks.contentType, contentType)
        )
      );

    console.log("[Bookmark Remove] Deletion completed", {
      userId,
      videoId,
      contentType,
      timestamp: new Date().toISOString(),
    });

    // Verify deletion
    const remainingBookmarks = await db
      .select()
      .from(youtubeBookmarks)
      .where(
        and(
          eq(youtubeBookmarks.userId, userId),
          eq(youtubeBookmarks.videoId, videoId),
          eq(youtubeBookmarks.contentType, contentType)
        )
      );

    console.log("[Bookmark Remove] Verification after deletion", {
      remainingCount: remainingBookmarks.length,
      success: remainingBookmarks.length === 0,
    });
  } catch (error) {
    console.error("[Database] Failed to remove YouTube bookmark:", error);
    throw error;
  }
}

// TODO: add feature queries here as your schema grows.

/**
 * Update API key test status after testing
 */
export async function updateApiKeyTestStatus(
  userId: number,
  provider: string,
  status: "untested" | "success" | "failed",
  errorMessage?: string
): Promise<void> {
  if (!userId || !provider) {
    throw new Error("userId and provider are required");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update API key test status: database not available");
    return;
  }

  try {
    await db
      .update(userApiKeys)
      .set({
        testStatus: status,
        testError: errorMessage || null,
        lastTestedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)));
  } catch (error) {
    console.error("[Database] Failed to update API key test status:", error);
    throw error;
  }
}
