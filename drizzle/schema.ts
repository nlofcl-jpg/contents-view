import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  approvalStatus: mysqlEnum("approvalStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  /** Management number for user management (1, 2, 3...). Displayed as 0001, 0002, etc. in UI */
  memberNo: int("memberNo").unique().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * User API Keys table for storing platform-specific API credentials.
 * Each user can have one API key per provider (e.g., one YouTube key).
 * API keys are stored securely and never exposed in full to the client.
 */
export const userApiKeys = mysqlTable("userApiKeys", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key to users table */
  userId: int("userId").notNull(),
  /** Provider name (e.g., 'youtube') */
  provider: varchar("provider", { length: 32 }).notNull(),
  /** Encrypted or hashed API key - never exposed in full to client */
  apiKey: text("apiKey").notNull(),
  /** Test status: 'untested', 'success', 'failed' */
  testStatus: mysqlEnum("testStatus", ["untested", "success", "failed"]).default("untested").notNull(),
  /** Last test error message (if any) */
  testError: text("testError"),
  /** Last test timestamp */
  lastTestedAt: timestamp("lastTestedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserApiKey = typeof userApiKeys.$inferSelect;
export type InsertUserApiKey = typeof userApiKeys.$inferInsert;

/**
 * YouTube Bookmarks table for storing user-saved YouTube videos.
 * Each bookmark is associated with a specific user and video.
 * Unique constraint ensures no duplicate bookmarks per user per video.
 */
export const youtubeBookmarks = mysqlTable(
  "youtubeBookmarks",
  {
    id: int("id").autoincrement().primaryKey(),
    /** Foreign key to users table */
    userId: int("userId").notNull(),
    /** YouTube video ID */
    videoId: varchar("videoId", { length: 64 }).notNull(),
    /** Content type: 'video' or 'shorts' */
    contentType: mysqlEnum("contentType", ["video", "shorts"]).notNull(),
    /** Video title */
    title: text("title").notNull(),
    /** Thumbnail URL */
    thumbnailUrl: text("thumbnailUrl"),
    /** Channel ID */
    channelId: varchar("channelId", { length: 64 }),
    /** Channel title */
    channelTitle: varchar("channelTitle", { length: 255 }),
    /** Channel thumbnail URL */
    channelThumbnailUrl: text("channelThumbnailUrl"),
    /** YouTube video URL */
    videoUrl: text("videoUrl"),
    /** Video duration */
    duration: varchar("duration", { length: 32 }),
    /** View count at time of bookmark */
    viewCount: varchar("viewCount", { length: 32 }),
    /** Video published date */
    publishedAt: varchar("publishedAt", { length: 64 }),
    /** Bookmark creation timestamp */
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    /** Unique constraint: one bookmark per user per video per content type */
    userVideoUnique: { unique: true, columns: [table.userId, table.videoId, table.contentType] },
  })
);

export type YouTubeBookmark = typeof youtubeBookmarks.$inferSelect;
export type InsertYouTubeBookmark = typeof youtubeBookmarks.$inferInsert;

// TODO: Add your tables here