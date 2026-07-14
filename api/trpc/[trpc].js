// server/vercel-trpc.ts
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";

// server/db.ts
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
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
  memberNo: int("memberNo").unique().notNull()
});
var userApiKeys = mysqlTable("userApiKeys", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var youtubeBookmarks = mysqlTable(
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
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => ({
    /** Unique constraint: one bookmark per user per video per content type */
    userVideoUnique: { unique: true, columns: [table.userId, table.videoId, table.contentType] }
  })
);

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
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
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const existingUser = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    const isNewUser = existingUser.length === 0;
    let nextMemberNo = 1;
    if (isNewUser) {
      const maxMemberNo = await db.select({ max: users.memberNo }).from(users);
      const currentMax = maxMemberNo[0]?.max;
      nextMemberNo = currentMax && currentMax > 0 ? currentMax + 1 : 1;
    }
    const values = {
      openId: user.openId,
      memberNo: isNewUser ? nextMemberNo : 0
      // 0 is placeholder for existing users, won't be used
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (user.approvalStatus !== void 0) {
      values.approvalStatus = user.approvalStatus;
      updateSet.approvalStatus = user.approvalStatus;
    } else if (user.openId === ENV.ownerOpenId) {
      values.approvalStatus = "approved";
      updateSet.approvalStatus = "approved";
    } else {
      values.approvalStatus = "pending";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (isNewUser) {
      await db.insert(users).values(values);
    } else {
      const existingUserValues = {
        openId: user.openId,
        memberNo: 0
        // placeholder
      };
      Object.keys(values).forEach((key) => {
        if (key !== "memberNo" && key in values) {
          existingUserValues[key] = values[key];
        }
      });
      await db.insert(users).values(existingUserValues).onDuplicateKeyUpdate({
        set: updateSet
      });
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function updateUserName(openId, name) {
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
async function getUserApiKey(userId, provider) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get API key: database not available");
    return void 0;
  }
  try {
    const result = await db.select().from(userApiKeys).where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider))).limit(1);
    return result.length > 0 ? result[0] : void 0;
  } catch (error) {
    console.error("[Database] Failed to get API key:", error);
    throw error;
  }
}
async function saveUserApiKey(userId, provider, apiKey) {
  if (!userId || !provider || !apiKey) {
    throw new Error("userId, provider, and apiKey are required");
  }
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error("API key cannot be empty or whitespace only");
  }
  console.log("[API Key Save] Saving API key", {
    userId,
    provider,
    keyLength: trimmedKey.length,
    keyPrefix: trimmedKey.slice(0, 6),
    keySuffix: trimmedKey.slice(-4),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot save API key: database not available");
    return;
  }
  try {
    const existing = await db.select().from(userApiKeys).where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider))).limit(1);
    if (existing.length > 0) {
      await db.update(userApiKeys).set({ apiKey: trimmedKey, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)));
    } else {
      await db.insert(userApiKeys).values({
        userId,
        provider,
        apiKey: trimmedKey
      });
    }
  } catch (error) {
    console.error("[Database] Failed to save API key:", error);
    throw error;
  }
}
async function deleteUserApiKey(userId, provider) {
  if (!userId || !provider) {
    throw new Error("userId and provider are required");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete API key: database not available");
    return;
  }
  try {
    await db.delete(userApiKeys).where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)));
  } catch (error) {
    console.error("[Database] Failed to delete API key:", error);
    throw error;
  }
}
async function getUserYouTubeBookmarks(userId) {
  if (!userId) {
    throw new Error("userId is required");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get bookmarks: database not available");
    return [];
  }
  try {
    const result = await db.select().from(youtubeBookmarks).where(eq(youtubeBookmarks.userId, userId)).orderBy(youtubeBookmarks.createdAt);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get YouTube bookmarks:", error);
    throw error;
  }
}
async function isYouTubeVideoBookmarked(userId, videoId, contentType) {
  if (!userId || !videoId || !contentType) {
    throw new Error("userId, videoId, and contentType are required");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot check bookmark: database not available");
    return false;
  }
  try {
    const result = await db.select().from(youtubeBookmarks).where(
      and(
        eq(youtubeBookmarks.userId, userId),
        eq(youtubeBookmarks.videoId, videoId),
        eq(youtubeBookmarks.contentType, contentType)
      )
    ).limit(1);
    return result.length > 0;
  } catch (error) {
    console.error("[Database] Failed to check bookmark:", error);
    throw error;
  }
}
async function addYouTubeBookmark(userId, bookmark) {
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
      userId
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY" || error.message?.includes("Duplicate entry")) {
      console.log("[Database] Video already bookmarked by user");
      return;
    }
    console.error("[Database] Failed to add YouTube bookmark:", error);
    throw error;
  }
}
async function removeYouTubeBookmark(userId, videoId, contentType) {
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
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    const existingBookmarks = await db.select().from(youtubeBookmarks).where(
      and(
        eq(youtubeBookmarks.userId, userId),
        eq(youtubeBookmarks.videoId, videoId),
        eq(youtubeBookmarks.contentType, contentType)
      )
    );
    console.log("[Bookmark Remove] Found bookmarks before deletion", {
      count: existingBookmarks.length
    });
    await db.delete(youtubeBookmarks).where(
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
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    const remainingBookmarks = await db.select().from(youtubeBookmarks).where(
      and(
        eq(youtubeBookmarks.userId, userId),
        eq(youtubeBookmarks.videoId, videoId),
        eq(youtubeBookmarks.contentType, contentType)
      )
    );
    console.log("[Bookmark Remove] Verification after deletion", {
      remainingCount: remainingBookmarks.length,
      success: remainingBookmarks.length === 0
    });
  } catch (error) {
    console.error("[Database] Failed to remove YouTube bookmark:", error);
    throw error;
  }
}
async function updateApiKeyTestStatus(userId, provider, status, errorMessage) {
  if (!userId || !provider) {
    throw new Error("userId and provider are required");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update API key test status: database not available");
    return;
  }
  try {
    await db.update(userApiKeys).set({
      testStatus: status,
      testError: errorMessage || null,
      lastTestedAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)));
  } catch (error) {
    console.error("[Database] Failed to update API key test status:", error);
    throw error;
  }
}

// server/_core/sdk.ts
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers?.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt,
          memberNo: 0
          // Will be auto-assigned for new users in upsertUser
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
      memberNo: user.memberNo
      // Preserve existing memberNo for existing users
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/supabase.ts
import { createClient } from "@supabase/supabase-js";
var supabaseAuthClient = ENV.supabaseUrl && ENV.supabaseAnonKey ? createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
}) : null;
function getBearerToken(authorization) {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}
function mapSupabaseUser(user) {
  const metadata = user.user_metadata ?? {};
  const name = typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : user.email ?? null;
  return {
    id: 0,
    openId: user.id,
    name,
    email: user.email ?? null,
    loginMethod: "supabase",
    role: "user",
    approvalStatus: "approved",
    createdAt: new Date(user.created_at),
    updatedAt: /* @__PURE__ */ new Date(),
    lastSignedIn: user.last_sign_in_at ? new Date(user.last_sign_in_at) : /* @__PURE__ */ new Date(),
    memberNo: 0
  };
}
async function authenticateSupabaseBearer(authorization) {
  if (!supabaseAuthClient) return null;
  const token = getBearerToken(authorization);
  if (!token) return null;
  const { data, error } = await supabaseAuthClient.auth.getUser(token);
  if (error || !data.user) return null;
  return mapSupabaseUser(data.user);
}

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  if (!user) {
    const req = opts.req;
    const authorizationHeader = req.headers?.["authorization"];
    const supabaseTokenHeader = req.headers?.["x-supabase-access-token"];
    const authorization = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
    const supabaseToken = Array.isArray(supabaseTokenHeader) ? supabaseTokenHeader[0] : supabaseTokenHeader;
    user = await authenticateSupabaseBearer(
      authorization || (supabaseToken ? `Bearer ${supabaseToken}` : void 0)
    );
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers?.["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);
var approvedProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (ctx.user.approvalStatus !== "approved") {
      throw new TRPCError2({
        code: "FORBIDDEN",
        message: "\uC0AC\uC6A9\uC790 \uC2B9\uC778 \uB300\uAE30 \uC911\uC785\uB2C8\uB2E4. \uAD00\uB9AC\uC790 \uC2B9\uC778 \uD6C4 \uC774\uC6A9 \uAC00\uB2A5\uD569\uB2C8\uB2E4."
      });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
import { z as z3 } from "zod";

// server/naver.unifiedInsight.ts
import { z as z2 } from "zod";

// server/naver.cache.ts
var CACHE_TTL_MS = 10 * 60 * 1e3;
var cache = /* @__PURE__ */ new Map();
function generateCacheKey(type, keywords, category, startDate, endDate, timeUnit, device, gender, ages) {
  const keywordStr = [...keywords].sort().join("|");
  const ageStr = ages ? [...ages].sort().join("|") : "";
  return `${type}:${keywordStr}:${category}:${startDate}:${endDate}:${timeUnit}:${device || ""}:${gender || ""}:${ageStr}`;
}
function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}
function setInCache(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

// server/naver.unifiedInsight.ts
var REQUEST_TIMEOUT_MS = 8e3;
async function fetchWithTimeout(url, options, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
var unifiedInsightProcedure = publicProcedure.input(z2.object({
  keywords: z2.array(z2.string()).min(0).max(5),
  category: z2.string(),
  startDate: z2.string(),
  endDate: z2.string(),
  timeUnit: z2.enum(["date", "week", "month"]),
  device: z2.string().optional(),
  gender: z2.string().optional(),
  ages: z2.array(z2.string()).optional()
})).mutation(async ({ input }) => {
  const cacheKey = generateCacheKey(
    "unified",
    input.keywords,
    input.category,
    input.startDate,
    input.endDate,
    input.timeUnit,
    input.device,
    input.gender,
    input.ages
  );
  const cachedData = getFromCache(cacheKey);
  if (cachedData) {
    console.log("[Naver API] Cache hit for unified insight", {
      cacheKey,
      keywords: input.keywords.length,
      category: input.category
    });
    return cachedData;
  }
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("[Naver API] Credentials not configured");
    return {
      success: false,
      error: "\uD1B5\uD569 \uC778\uC0AC\uC774\uD2B8 \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.",
      keywords: input.keywords,
      trend: {},
      shopping: {}
    };
  }
  try {
    console.log("[Server] Input dates:", {
      startDate: input.startDate,
      endDate: input.endDate,
      timeUnit: input.timeUnit
    });
    const trendRequestBody = {
      startDate: input.startDate,
      endDate: input.endDate,
      timeUnit: input.timeUnit,
      keywordGroups: input.keywords.map((kw) => ({
        groupName: kw,
        keywords: [kw]
      }))
    };
    if (input.device && input.device !== "") {
      trendRequestBody.device = input.device === "PC" ? "pc" : input.device === "\uBAA8\uBC14\uC77C" ? "mo" : "";
      if (!trendRequestBody.device) delete trendRequestBody.device;
    }
    if (input.gender && input.gender !== "") {
      trendRequestBody.gender = input.gender === "\uB0A8\uC131" ? "m" : input.gender === "\uC5EC\uC131" ? "f" : "";
      if (!trendRequestBody.gender) delete trendRequestBody.gender;
    }
    if (input.ages && input.ages.length > 0) {
      trendRequestBody.ages = input.ages;
    }
    const shoppingRequestBody = {
      startDate: input.startDate,
      endDate: input.endDate,
      timeUnit: input.timeUnit,
      category: input.category,
      keyword: input.keywords.map((kw) => ({
        name: kw,
        param: [kw]
      }))
    };
    if (input.device && input.device !== "") {
      shoppingRequestBody.device = input.device === "PC" ? "pc" : input.device === "\uBAA8\uBC14\uC77C" ? "mo" : "";
      if (!shoppingRequestBody.device) delete shoppingRequestBody.device;
    }
    if (input.gender && input.gender !== "") {
      shoppingRequestBody.gender = input.gender === "\uB0A8\uC131" ? "m" : input.gender === "\uC5EC\uC131" ? "f" : "";
      if (!shoppingRequestBody.gender) delete shoppingRequestBody.gender;
    }
    if (input.ages && input.ages.length > 0) {
      shoppingRequestBody.ages = input.ages;
    }
    const trendStartTime = Date.now();
    const shoppingStartTime = Date.now();
    const [trendSettled, shoppingSettled] = await Promise.allSettled([
      (async () => {
        console.log("[Naver API] Search Trend API - Request started", {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          keywords: input.keywords.length,
          startDate: input.startDate,
          endDate: input.endDate,
          timeUnit: input.timeUnit
        });
        const response = await fetchWithTimeout(
          "https://openapi.naver.com/v1/datalab/search",
          {
            method: "POST",
            headers: {
              "X-Naver-Client-Id": clientId,
              "X-Naver-Client-Secret": clientSecret,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(trendRequestBody)
          },
          REQUEST_TIMEOUT_MS
        );
        const trendEndTime = Date.now();
        const trendResponseTime = trendEndTime - trendStartTime;
        const trendData2 = await response.json();
        if (!response.ok) {
          console.error("[Naver API] Search Trend API - Failed", {
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            statusCode: response.status,
            responseTime: trendResponseTime,
            errorCode: trendData2.errorCode,
            errorMessage: trendData2.errorMessage
          });
          throw new Error(`Search Trend API failed: ${response.status} - ${trendData2.errorMessage}`);
        }
        console.log("[Naver API] Search Trend API - Success", {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          statusCode: response.status,
          responseTime: trendResponseTime,
          resultCount: trendData2.results?.length || 0,
          dataPointCount: (trendData2.results || []).reduce((sum, item) => sum + (item.data?.length || 0), 0)
        });
        console.log("[Naver API] Search Trend API - Response Details", {
          topLevelKeys: Object.keys(trendData2),
          resultsExists: !!trendData2.results,
          resultsLength: trendData2.results?.length,
          firstResult: trendData2.results?.[0] ? {
            keys: Object.keys(trendData2.results[0]),
            title: trendData2.results[0].title,
            keyword: trendData2.results[0].keyword,
            keywords: trendData2.results[0].keywords,
            dataLength: trendData2.results[0].data?.length,
            firstData: trendData2.results[0].data?.[0],
            lastData: trendData2.results[0].data?.[trendData2.results[0].data.length - 1]
          } : "N/A"
        });
        return trendData2;
      })(),
      (async () => {
        console.log("[Naver API] Shopping Trend API - Request started", {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          keywords: input.keywords.length,
          category: input.category,
          startDate: input.startDate,
          endDate: input.endDate,
          timeUnit: input.timeUnit
        });
        const response = await fetchWithTimeout(
          "https://openapi.naver.com/v1/datalab/shopping/category/keywords",
          {
            method: "POST",
            headers: {
              "X-Naver-Client-Id": clientId,
              "X-Naver-Client-Secret": clientSecret,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(shoppingRequestBody)
          },
          REQUEST_TIMEOUT_MS
        );
        const shoppingEndTime = Date.now();
        const shoppingResponseTime = shoppingEndTime - shoppingStartTime;
        const shoppingData2 = await response.json();
        if (!response.ok) {
          console.error("[Naver API] Shopping Trend API - Failed", {
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            statusCode: response.status,
            responseTime: shoppingResponseTime,
            errorCode: shoppingData2.errorCode,
            errorMessage: shoppingData2.errorMessage
          });
          throw new Error(`Shopping Trend API failed: ${response.status} - ${shoppingData2.errorMessage}`);
        }
        console.log("[Naver API] Shopping Trend API - Success", {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          statusCode: response.status,
          responseTime: shoppingResponseTime,
          resultCount: shoppingData2.results?.length || 0,
          dataPointCount: (shoppingData2.results || []).reduce((sum, item) => sum + (item.data?.length || 0), 0)
        });
        return shoppingData2;
      })()
    ]);
    const trendSuccess = trendSettled.status === "fulfilled";
    const shoppingSuccess = shoppingSettled.status === "fulfilled";
    if (!trendSuccess && !shoppingSuccess) {
      console.error("[Naver API] Both APIs failed", {
        trendError: trendSettled.status === "rejected" ? trendSettled.reason?.message : "N/A",
        shoppingError: shoppingSettled.status === "rejected" ? shoppingSettled.reason?.message : "N/A"
      });
      return {
        success: false,
        error: "\uD1B5\uD569 \uC778\uC0AC\uC774\uD2B8 \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.",
        keywords: input.keywords,
        trend: {},
        shopping: {}
      };
    }
    if (!trendSuccess) {
      console.error("[Naver API] Search Trend API failed", {
        error: trendSettled.reason?.message
      });
      return {
        success: false,
        error: "\uAC80\uC0C9 \uD2B8\uB80C\uB4DC \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
        keywords: input.keywords,
        trend: {},
        shopping: {}
      };
    }
    if (!shoppingSuccess) {
      console.error("[Naver API] Shopping Trend API failed", {
        error: shoppingSettled.reason?.message
      });
      return {
        success: false,
        error: "\uC1FC\uD551 \uD074\uB9AD \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
        keywords: input.keywords,
        trend: {},
        shopping: {}
      };
    }
    const trendData = trendSettled.value;
    const trendResult = {};
    if (trendData.results && Array.isArray(trendData.results)) {
      trendData.results.forEach((item) => {
        const keyName = item.title || item.keyword;
        if (keyName && item.data) {
          trendResult[keyName] = item.data.map((d) => ({
            period: d.period,
            ratio: d.ratio
          }));
        }
      });
    }
    console.log("[Naver API] Trend Data Transform", {
      resultsCount: trendData.results?.length,
      trendResultKeys: Object.keys(trendResult),
      trendResultSample: Object.entries(trendResult).map(([key, data]) => ({
        key,
        dataLength: data.length,
        firstPeriod: data[0]?.period,
        lastPeriod: data[data.length - 1]?.period,
        last3Periods: data.slice(-3).map((d) => d.period)
      }))
    });
    const shoppingData = shoppingSettled.value;
    const shoppingResult = {};
    if (shoppingData.results && Array.isArray(shoppingData.results)) {
      shoppingData.results.forEach((item) => {
        if (item.keyword && item.data) {
          shoppingResult[item.keyword] = item.data.map((d) => ({
            period: d.period,
            ratio: d.ratio
          }));
        }
      });
    }
    console.log("[Naver API] Unified Insight success", {
      keywords: input.keywords.length,
      category: input.category,
      trendKeywords: Object.keys(trendResult).length,
      shoppingKeywords: Object.keys(shoppingResult).length,
      trendDataPoints: Object.values(trendResult).reduce((sum, arr) => sum + arr.length, 0),
      shoppingDataPoints: Object.values(shoppingResult).reduce((sum, arr) => sum + arr.length, 0)
    });
    const shoppingStatus = {};
    input.keywords.forEach((keyword) => {
      const shoppingData2 = shoppingResult[keyword];
      if (shoppingData2 && Array.isArray(shoppingData2) && shoppingData2.length > 0) {
        shoppingStatus[keyword] = "AVAILABLE";
      } else {
        shoppingStatus[keyword] = "NO_DATA";
      }
    });
    console.log("[Naver API] Shopping Status", {
      keywords: input.keywords,
      shoppingStatus
    });
    const result = {
      success: true,
      keywords: input.keywords,
      trend: trendResult,
      shopping: shoppingResult,
      meta: {
        shoppingStatus
      }
    };
    setInCache(cacheKey, result);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Connection failed";
    console.error("[Naver API] Unified Insight Exception", {
      error: errorMsg,
      keywords: input.keywords.length,
      category: input.category
    });
    return {
      success: false,
      error: "\uD1B5\uD569 \uC778\uC0AC\uC774\uD2B8 \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.",
      keywords: input.keywords,
      trend: {},
      shopping: {}
    };
  }
});

// server/naver.diagnostic.ts
async function testSearchTrendAPI(clientId, clientSecret, keywords, startDate, endDate, timeUnit) {
  const startTime = /* @__PURE__ */ new Date();
  const result = {
    api: "Search Trend API",
    startTime: startTime.toISOString(),
    endTime: "",
    responseTimes: 0,
    statusCode: null,
    errorCode: null,
    errorMessage: null,
    resultCount: 0,
    dataPointCount: 0,
    success: false
  };
  try {
    const requestBody = {
      startDate,
      endDate,
      timeUnit,
      keywordGroups: keywords.map((kw) => ({
        groupName: kw,
        keywords: [kw]
      }))
    };
    console.log("[Diagnostic] Search Trend API - Request started", {
      timestamp: startTime.toISOString(),
      keywords: keywords.length,
      startDate,
      endDate,
      timeUnit
    });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1e4);
    const response = await fetch("https://openapi.naver.com/v1/datalab/search", {
      method: "POST",
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const endTime = /* @__PURE__ */ new Date();
    result.endTime = endTime.toISOString();
    result.responseTimes = endTime.getTime() - startTime.getTime();
    result.statusCode = response.status;
    const data = await response.json();
    if (response.ok) {
      result.success = true;
      result.resultCount = data.results?.length || 0;
      result.dataPointCount = (data.results || []).reduce(
        (sum, item) => sum + (item.data?.length || 0),
        0
      );
      result.rawResponse = data;
      console.log("[Diagnostic] Search Trend API - Success", {
        timestamp: endTime.toISOString(),
        responseTimes: result.responseTimes,
        statusCode: result.statusCode,
        resultCount: result.resultCount,
        dataPointCount: result.dataPointCount
      });
    } else {
      result.errorCode = data.errorCode || "UNKNOWN";
      result.errorMessage = data.errorMessage || "Unknown error";
      result.rawResponse = data;
      console.error("[Diagnostic] Search Trend API - Failed", {
        timestamp: endTime.toISOString(),
        responseTimes: result.responseTimes,
        statusCode: result.statusCode,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage
      });
    }
  } catch (error) {
    const endTime = /* @__PURE__ */ new Date();
    result.endTime = endTime.toISOString();
    result.responseTimes = endTime.getTime() - startTime.getTime();
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        result.errorCode = "TIMEOUT";
        result.errorMessage = "Request timeout (10 seconds)";
      } else {
        result.errorCode = "NETWORK_ERROR";
        result.errorMessage = error.message;
      }
    } else {
      result.errorCode = "UNKNOWN_ERROR";
      result.errorMessage = String(error);
    }
    console.error("[Diagnostic] Search Trend API - Exception", {
      timestamp: endTime.toISOString(),
      responseTimes: result.responseTimes,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage
    });
  }
  return result;
}
async function testShoppingTrendAPI(clientId, clientSecret, keywords, category, startDate, endDate, timeUnit) {
  const startTime = /* @__PURE__ */ new Date();
  const result = {
    api: "Shopping Trend API",
    startTime: startTime.toISOString(),
    endTime: "",
    responseTimes: 0,
    statusCode: null,
    errorCode: null,
    errorMessage: null,
    resultCount: 0,
    dataPointCount: 0,
    success: false
  };
  try {
    const requestBody = {
      startDate,
      endDate,
      timeUnit,
      category,
      keyword: keywords.map((kw) => ({
        name: kw,
        param: [kw]
      }))
    };
    console.log("[Diagnostic] Shopping Trend API - Request started", {
      timestamp: startTime.toISOString(),
      keywords: keywords.length,
      category,
      startDate,
      endDate,
      timeUnit
    });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1e4);
    const response = await fetch(
      "https://openapi.naver.com/v1/datalab/shopping/category/keywords",
      {
        method: "POST",
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);
    const endTime = /* @__PURE__ */ new Date();
    result.endTime = endTime.toISOString();
    result.responseTimes = endTime.getTime() - startTime.getTime();
    result.statusCode = response.status;
    const data = await response.json();
    if (response.ok) {
      result.success = true;
      result.resultCount = data.results?.length || 0;
      result.dataPointCount = (data.results || []).reduce(
        (sum, item) => sum + (item.data?.length || 0),
        0
      );
      result.rawResponse = data;
      console.log("[Diagnostic] Shopping Trend API - Success", {
        timestamp: endTime.toISOString(),
        responseTimes: result.responseTimes,
        statusCode: result.statusCode,
        resultCount: result.resultCount,
        dataPointCount: result.dataPointCount
      });
    } else {
      result.errorCode = data.errorCode || "UNKNOWN";
      result.errorMessage = data.errorMessage || "Unknown error";
      result.rawResponse = data;
      console.error("[Diagnostic] Shopping Trend API - Failed", {
        timestamp: endTime.toISOString(),
        responseTimes: result.responseTimes,
        statusCode: result.statusCode,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage
      });
    }
  } catch (error) {
    const endTime = /* @__PURE__ */ new Date();
    result.endTime = endTime.toISOString();
    result.responseTimes = endTime.getTime() - startTime.getTime();
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        result.errorCode = "TIMEOUT";
        result.errorMessage = "Request timeout (10 seconds)";
      } else {
        result.errorCode = "NETWORK_ERROR";
        result.errorMessage = error.message;
      }
    } else {
      result.errorCode = "UNKNOWN_ERROR";
      result.errorMessage = String(error);
    }
    console.error("[Diagnostic] Shopping Trend API - Exception", {
      timestamp: endTime.toISOString(),
      responseTimes: result.responseTimes,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage
    });
  }
  return result;
}
async function runDiagnostics(keywords, category, startDate, endDate, timeUnit) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  console.log("[Diagnostic] Starting diagnostics", {
    credentialsConfigured: !!(clientId && clientSecret),
    keywords: keywords.length,
    category,
    startDate,
    endDate,
    timeUnit
  });
  if (!clientId || !clientSecret) {
    throw new Error("Naver credentials not configured");
  }
  const [searchTrendSettled, shoppingTrendSettled] = await Promise.allSettled([
    testSearchTrendAPI(clientId, clientSecret, keywords, startDate, endDate, timeUnit),
    testShoppingTrendAPI(clientId, clientSecret, keywords, category, startDate, endDate, timeUnit)
  ]);
  const searchTrendResult = searchTrendSettled.status === "fulfilled" ? searchTrendSettled.value : {
    api: "Search Trend API",
    startTime: (/* @__PURE__ */ new Date()).toISOString(),
    endTime: (/* @__PURE__ */ new Date()).toISOString(),
    responseTimes: 0,
    statusCode: null,
    errorCode: "PROMISE_REJECTED",
    errorMessage: searchTrendSettled.reason?.message || "Promise rejected",
    resultCount: 0,
    dataPointCount: 0,
    success: false
  };
  const shoppingTrendResult = shoppingTrendSettled.status === "fulfilled" ? shoppingTrendSettled.value : {
    api: "Shopping Trend API",
    startTime: (/* @__PURE__ */ new Date()).toISOString(),
    endTime: (/* @__PURE__ */ new Date()).toISOString(),
    responseTimes: 0,
    statusCode: null,
    errorCode: "PROMISE_REJECTED",
    errorMessage: shoppingTrendSettled.reason?.message || "Promise rejected",
    resultCount: 0,
    dataPointCount: 0,
    success: false
  };
  console.log("[Diagnostic] Diagnostics complete", {
    searchTrendSuccess: searchTrendResult.success,
    searchTrendResponseTime: searchTrendResult.responseTimes,
    shoppingTrendSuccess: shoppingTrendResult.success,
    shoppingTrendResponseTime: shoppingTrendResult.responseTimes
  });
  return {
    searchTrendResult,
    shoppingTrendResult,
    credentialsConfigured: true
  };
}

// server/_core/userApiKeys.ts
import { createClient as createClient2 } from "@supabase/supabase-js";
var supabaseAdmin = ENV.supabaseUrl && ENV.supabaseServiceRoleKey ? createClient2(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
}) : null;
function isSupabaseUser(user) {
  return user.loginMethod === "supabase" && user.openId && user.openId.includes("-");
}
function maskApiKey(apiKey) {
  return apiKey.length > 10 ? `${apiKey.substring(0, 6)}${"*".repeat(Math.max(1, apiKey.length - 10))}${apiKey.substring(apiKey.length - 4)}` : `${"*".repeat(Math.max(1, apiKey.length - 4))}${apiKey.substring(Math.max(0, apiKey.length - 4))}`;
}
function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error("Supabase service role key is not configured.");
  }
  return supabaseAdmin;
}
async function saveUserApiKey2(user, provider, apiKey) {
  if (!isSupabaseUser(user)) {
    return saveUserApiKey(user.id, provider, apiKey);
  }
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error("API key cannot be empty or whitespace only");
  }
  const supabase = requireSupabaseAdmin();
  const { error } = await supabase.from("user_api_keys").upsert(
    {
      user_id: user.openId,
      provider,
      encrypted_key: trimmedKey,
      masked_key: maskApiKey(trimmedKey),
      test_status: "untested",
      test_error: null,
      last_tested_at: null,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    { onConflict: "user_id,provider" }
  );
  if (error) throw new Error(error.message);
}
async function deleteUserApiKey2(user, provider) {
  if (!isSupabaseUser(user)) {
    return deleteUserApiKey(user.id, provider);
  }
  const supabase = requireSupabaseAdmin();
  const { error } = await supabase.from("user_api_keys").delete().eq("user_id", user.openId).eq("provider", provider);
  if (error) throw new Error(error.message);
}
async function getUserApiKey2(user, provider) {
  if (!isSupabaseUser(user)) {
    const apiKey = await getUserApiKey(user.id, provider);
    if (!apiKey) return void 0;
    return {
      apiKey: apiKey.apiKey,
      testStatus: apiKey.testStatus,
      testError: apiKey.testError,
      lastTestedAt: apiKey.lastTestedAt,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt
    };
  }
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase.from("user_api_keys").select("encrypted_key,test_status,test_error,last_tested_at,created_at,updated_at").eq("user_id", user.openId).eq("provider", provider).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return void 0;
  return {
    apiKey: data.encrypted_key,
    testStatus: data.test_status,
    testError: data.test_error,
    lastTestedAt: data.last_tested_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}
async function updateApiKeyTestStatus2(user, provider, testStatus, testError = null) {
  if (!isSupabaseUser(user)) {
    return updateApiKeyTestStatus(user.id, provider, testStatus, testError ?? void 0);
  }
  const supabase = requireSupabaseAdmin();
  const { error } = await supabase.from("user_api_keys").update({
    test_status: testStatus,
    test_error: testError,
    last_tested_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("user_id", user.openId).eq("provider", provider);
  if (error) throw new Error(error.message);
}

// server/routers.ts
import { createRequire } from "module";
var require2 = createRequire(import.meta.url);
var googleTrendsCache = {};
var CACHE_TTL = 10 * 60 * 1e3;
var GOOGLE_TRENDS_RSS_URLS = {
  KR: "https://trends.google.com/trending/rss?geo=KR",
  US: "https://trends.google.com/trending/rss?geo=US",
  JP: "https://trends.google.com/trending/rss?geo=JP",
  GB: "https://trends.google.com/trending/rss?geo=GB",
  FR: "https://trends.google.com/trending/rss?geo=FR",
  DE: "https://trends.google.com/trending/rss?geo=DE",
  ES: "https://trends.google.com/trending/rss?geo=ES"
};
async function getGoogleTrendingSearches(countryCode = "KR") {
  try {
    const cacheKey = `google_trends_${countryCode}`;
    const now = Date.now();
    if (googleTrendsCache[cacheKey] && now - googleTrendsCache[cacheKey].timestamp < CACHE_TTL) {
      console.log(`[Google Trends RSS] Cache HIT for country: ${countryCode}`);
      const cachedData = googleTrendsCache[cacheKey].data;
      return cachedData.map((item) => ({
        ...item,
        source: "Google Trends",
        country: countryCode
      }));
    }
    const rssUrl = GOOGLE_TRENDS_RSS_URLS[countryCode];
    if (!rssUrl) {
      console.error(`[Google Trends RSS] Invalid country code: ${countryCode}`);
      return [];
    }
    console.log(`[Google Trends RSS] Fetching RSS for country: ${countryCode}`);
    console.log(`[Google Trends RSS] URL: ${rssUrl}`);
    const response = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    if (!response.ok) {
      console.error(`[Google Trends RSS] HTTP Error: ${response.status}`);
      return [];
    }
    const rssText = await response.text();
    console.log(`[Google Trends RSS] Fetched RSS text length: ${rssText.length}`);
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title>([^<]+)<\/title>/;
    const trafficRegex = /<ht:approx_traffic>([^<]+)<\/ht:approx_traffic>/;
    const newsItemRegex = /<ht:news_item>([\s\S]*?)<\/ht:news_item>/;
    const newsTitleRegex = /<ht:news_item_title>([^<]+)<\/ht:news_item_title>/;
    const newsSourceRegex = /<ht:news_item_source>([^<]+)<\/ht:news_item_source>/;
    const items = [];
    let match;
    let rank = 1;
    let itemCount = 0;
    while ((match = itemRegex.exec(rssText)) !== null && rank <= 20) {
      itemCount++;
      const itemContent = match[1];
      const titleMatch = titleRegex.exec(itemContent);
      if (titleMatch && titleMatch[1]) {
        const title = titleMatch[1].trim();
        const keyword = title.replace(/\s*\+\s*\d+%\s*$/, "").trim();
        if (keyword && keyword !== "Explore what's trending") {
          const trafficMatch = trafficRegex.exec(itemContent);
          const traffic = trafficMatch ? trafficMatch[1].trim() : "";
          const newsArray = [];
          const newsItemRegexGlobal = /<ht:news_item>([\s\S]*?)<\/ht:news_item>/g;
          const newsUrlRegex = /<ht:news_item_url>([^<]+)<\/ht:news_item_url>/;
          const newsPictureRegex = /<ht:news_item_picture>([^<]+)<\/ht:news_item_picture>/;
          let newsMatch;
          let newsCount = 0;
          while ((newsMatch = newsItemRegexGlobal.exec(itemContent)) !== null && newsCount < 3) {
            const newsContent = newsMatch[1];
            const newsTitleMatch = newsTitleRegex.exec(newsContent);
            const newsSourceMatch = newsSourceRegex.exec(newsContent);
            const newsUrlMatch = newsUrlRegex.exec(newsContent);
            const newsPictureMatch = newsPictureRegex.exec(newsContent);
            if (newsTitleMatch && newsTitleMatch[1]) {
              newsArray.push({
                title: newsTitleMatch[1].trim().replace(/&quot;/g, '"').replace(/&apos;/g, "'"),
                source: newsSourceMatch ? newsSourceMatch[1].trim() : "",
                url: newsUrlMatch ? newsUrlMatch[1].trim() : "",
                image: newsPictureMatch ? newsPictureMatch[1].trim() : ""
              });
              newsCount++;
            }
          }
          items.push({
            rank,
            keyword,
            traffic,
            news: newsArray
          });
          rank++;
        }
      }
    }
    console.log(`[Google Trends RSS] RSS item count: ${itemCount}`);
    console.log(`[Google Trends RSS] Parsed keywords: ${items.length}`);
    console.log(`[Google Trends RSS] Final keywords: ${items.length}`);
    if (items.length === 0) {
      console.warn(`[Google Trends RSS] No keywords parsed for country: ${countryCode}`);
      return [];
    }
    googleTrendsCache[cacheKey] = {
      data: items,
      timestamp: now
    };
    console.log(`[Google Trends RSS] Success - fetched ${items.length} trending searches for ${countryCode}`);
    return items.map((item) => ({
      ...item,
      source: "Google Trends",
      country: countryCode
    }));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Google Trends RSS] Error fetching realtime trends for ${countryCode}:`, errorMsg);
    return [];
  }
}
function parseDurationToSeconds(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  return hours * 3600 + minutes * 60 + seconds;
}
function translateYouTubeError(error) {
  const errorMap = {
    "API key not valid. Please pass a valid API key.": "YouTube API \uD0A4 \uC624\uB958\uC785\uB2C8\uB2E4.\nAPI \uD0A4 \uD655\uC778 \uD6C4 \uB2E4\uC2DC \uC785\uB825\uD574\uC8FC\uC138\uC694.",
    "Invalid Credentials": "YouTube API \uD0A4 \uC624\uB958\uC785\uB2C8\uB2E4.\nAPI \uD0A4 \uD655\uC778 \uD6C4 \uB2E4\uC2DC \uC785\uB825\uD574\uC8FC\uC138\uC694.",
    "The request is missing a valid API key.": "API Key\uAC00 \uB204\uB77D\uB418\uC5C8\uC2B5\uB2C8\uB2E4. API \uD0A4 \uC124\uC815\uC5D0\uC11C YouTube API Key\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694.",
    "YouTube Data API v3 has not been used in project": "YouTube Data API v3\uAC00 \uC0AC\uC6A9 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. Google Cloud Console\uC5D0\uC11C YouTube Data API v3\uB97C \uC0AC\uC6A9 \uC124\uC815\uD574\uC8FC\uC138\uC694.",
    "The caller does not have permission": "\uC774 API Key\uC5D0\uB294 \uD544\uC694\uD55C \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. Google Cloud Console\uC5D0\uC11C \uAD8C\uD55C\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694.",
    "Quota exceeded": "API \uD560\uB2F9\uB7C9\uC744 \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. \uB098\uC911\uC5D0 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.",
    "The request cannot be completed because you have exceeded your YouTube API quota": "YouTube API \uD560\uB2F9\uB7C9\uC744 \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4. \uB0B4\uC77C \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.",
    "Invalid region code": "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uAD6D\uAC00 \uCF54\uB4DC\uC785\uB2C8\uB2E4. \uB2E4\uC2DC \uC120\uD0DD\uD574\uC8FC\uC138\uC694."
  };
  if (errorMap[error]) {
    return errorMap[error];
  }
  for (const [key, value] of Object.entries(errorMap)) {
    if (error.includes(key)) {
      return value;
    }
  }
  return `YouTube API \uC624\uB958: ${error}. API Key \uC124\uC815\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694.`;
}
var appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  user: router({
    /**
     * Update user name
     */
    updateName: protectedProcedure.input(z3.object({ name: z3.string().min(1).max(50) })).mutation(async ({ ctx, input }) => {
      if (!ctx.user?.openId) {
        throw new Error("User not authenticated");
      }
      await updateUserName(ctx.user.openId, input.name.trim());
      return { success: true };
    }),
    /**
     * API Key management
     */
    apiKey: router({
      save: protectedProcedure.input(z3.object({ provider: z3.string().min(1), apiKey: z3.string().min(1) })).mutation(async ({ ctx, input }) => {
        if (!ctx.user) {
          throw new Error("User not authenticated");
        }
        const trimmedKey = input.apiKey.trim();
        if (!trimmedKey) {
          throw new Error("API key cannot be empty or whitespace only");
        }
        await saveUserApiKey2(ctx.user, input.provider, trimmedKey);
        return { success: true };
      }),
      delete: protectedProcedure.input(z3.object({ provider: z3.string().min(1) })).mutation(async ({ ctx, input }) => {
        if (!ctx.user) {
          throw new Error("User not authenticated");
        }
        await deleteUserApiKey2(ctx.user, input.provider);
        return { success: true };
      }),
      /**
       * Test YouTube API connection
       */
      testConnection: protectedProcedure.input(z3.object({ provider: z3.string().min(1) })).mutation(async ({ ctx, input }) => {
        if (!ctx.user) {
          throw new Error("User not authenticated");
        }
        const apiKey = await getUserApiKey2(ctx.user, input.provider);
        if (!apiKey) {
          return {
            success: false,
            error: "API Key not found"
          };
        }
        try {
          const params = new URLSearchParams({
            part: "id",
            id: "test",
            key: apiKey.apiKey
          });
          const response = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
            { method: "GET" }
          );
          const data = await response.json();
          if (data.error) {
            const errorMsg = data.error.message || "Unknown error";
            await updateApiKeyTestStatus2(ctx.user, input.provider, "failed", errorMsg);
            return {
              success: false,
              error: translateYouTubeError(errorMsg)
            };
          }
          await updateApiKeyTestStatus2(ctx.user, input.provider, "success");
          return { success: true };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Connection failed";
          await updateApiKeyTestStatus2(ctx.user, input.provider, "failed", errorMsg);
          return {
            success: false,
            error: translateYouTubeError(errorMsg)
          };
        }
      }),
      /**
       * Get API key with test status
       */
      getWithStatus: protectedProcedure.input(z3.object({ provider: z3.string().min(1) })).query(async ({ ctx, input }) => {
        if (!ctx.user) {
          throw new Error("User not authenticated");
        }
        const apiKey = await getUserApiKey2(ctx.user, input.provider);
        if (!apiKey) {
          return {
            exists: false,
            maskedKey: null,
            testStatus: null,
            testError: null,
            lastTestedAt: null
          };
        }
        return {
          exists: true,
          maskedKey: maskApiKey(apiKey.apiKey),
          testStatus: apiKey.testStatus,
          testError: apiKey.testError,
          lastTestedAt: apiKey.lastTestedAt,
          createdAt: apiKey.createdAt,
          updatedAt: apiKey.updatedAt
        };
      })
    }),
    /**
     * Admin: List pending users for approval
     */
    listPending: adminProcedure.query(async () => {
      const db = await require2("./db").getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const pendingUsers = await db.select().from(require2("../drizzle/schema").users).where(require2("drizzle-orm").eq(require2("../drizzle/schema").users.approvalStatus, "pending"));
      return pendingUsers.map((user) => ({
        id: user.id,
        memberNo: user.memberNo,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        approvalStatus: user.approvalStatus
      }));
    }),
    /**
     * Admin: Approve a pending user
     */
    approve: adminProcedure.input(z3.object({ userId: z3.number() })).mutation(async ({ input }) => {
      const db = await require2("./db").getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const { users: users2 } = require2("../drizzle/schema");
      const { eq: eq2 } = require2("drizzle-orm");
      await db.update(users2).set({ approvalStatus: "approved" }).where(eq2(users2.id, input.userId));
      return { success: true };
    }),
    /**
     * Admin: Reject a pending user
     */
    reject: adminProcedure.input(z3.object({ userId: z3.number() })).mutation(async ({ input }) => {
      const db = await require2("./db").getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      const { users: users2 } = require2("../drizzle/schema");
      const { eq: eq2 } = require2("drizzle-orm");
      await db.update(users2).set({ approvalStatus: "rejected" }).where(eq2(users2.id, input.userId));
      return { success: true };
    })
  }),
  youtube: router({
    /**
     * Get popular channels based on trending videos
     * 1. Fetch top 50 popular videos
     * 2. Extract unique channelIds
     * 3. Fetch channel details (subscribers, views, etc.)
     * 4. Calculate trending score based on frequency, views, and subscribers
     */
    getPopularChannels: protectedProcedure.input(z3.object({
      regionCode: z3.string().min(2).max(2),
      sortBy: z3.enum(["trending", "subscribers", "views"]).default("trending"),
      maxResults: z3.number().min(1).max(50).default(12),
      videoCategoryId: z3.number().optional()
    })).query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new Error("User not authenticated");
      }
      const apiKeyRecord = await getUserApiKey2(ctx.user, "youtube");
      if (!apiKeyRecord) {
        return {
          success: false,
          error: "API Key not found",
          channels: []
        };
      }
      if (apiKeyRecord.testStatus !== "success") {
        return {
          success: false,
          error: "YouTube API \uD0A4 \uC624\uB958\uC785\uB2C8\uB2E4.\nAPI \uD0A4 \uD655\uC778 \uD6C4 \uB2E4\uC2DC \uC785\uB825\uD574\uC8FC\uC138\uC694.",
          channels: []
        };
      }
      try {
        const videoParams = new URLSearchParams({
          part: "snippet,statistics,contentDetails",
          chart: "mostPopular",
          regionCode: input.regionCode,
          maxResults: "50",
          key: apiKeyRecord.apiKey
        });
        if (input.videoCategoryId !== void 0) {
          videoParams.append("videoCategoryId", input.videoCategoryId.toString());
        }
        const videoResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?${videoParams.toString()}`,
          { method: "GET" }
        );
        if (!videoResponse.ok) {
          const errorData = await videoResponse.json();
          const errorMsg = errorData.error?.message || "Failed to fetch trending videos";
          return {
            success: false,
            error: translateYouTubeError(errorMsg),
            channels: []
          };
        }
        const videoData = await videoResponse.json();
        if (videoData.error) {
          const errorMsg = videoData.error.message || "YouTube API error";
          return {
            success: false,
            error: translateYouTubeError(errorMsg),
            channels: []
          };
        }
        const channelMap = /* @__PURE__ */ new Map();
        (videoData.items || []).forEach((item) => {
          const channelId = item.snippet.channelId;
          const viewCount = parseInt(item.statistics.viewCount || "0");
          const videoTitle = item.snippet.title;
          if (channelMap.has(channelId)) {
            const existing = channelMap.get(channelId);
            existing.videoCount += 1;
            existing.totalVideoViews += viewCount;
          } else {
            channelMap.set(channelId, {
              channelId,
              channelTitle: item.snippet.channelTitle,
              videoCount: 1,
              totalVideoViews: viewCount,
              topVideoTitle: videoTitle
            });
          }
        });
        if (channelMap.size === 0) {
          return {
            success: true,
            channels: []
          };
        }
        const channelIds = Array.from(channelMap.keys());
        const channelParams = new URLSearchParams({
          part: "snippet,statistics",
          id: channelIds.join(","),
          key: apiKeyRecord.apiKey
        });
        const channelResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?${channelParams.toString()}`,
          { method: "GET" }
        );
        if (!channelResponse.ok) {
          const errorData = await channelResponse.json();
          const errorMsg = errorData.error?.message || "Failed to fetch channel details";
          return {
            success: false,
            error: translateYouTubeError(errorMsg),
            channels: []
          };
        }
        const channelData = await channelResponse.json();
        if (channelData.error) {
          const errorMsg = channelData.error.message || "YouTube API error";
          return {
            success: false,
            error: translateYouTubeError(errorMsg),
            channels: []
          };
        }
        const channels = (channelData.items || []).map((item) => {
          const aggregated = channelMap.get(item.id);
          const subscriberCount = parseInt(item.statistics.subscriberCount || "0");
          const viewCount = parseInt(item.statistics.viewCount || "0");
          const videoCount = parseInt(item.statistics.videoCount || "0");
          const frequencyScore = aggregated.videoCount * 100;
          const popularVideoViewsScore = aggregated.totalVideoViews / 1e5;
          const subscriberScore = subscriberCount / 1e4;
          const channelViewsScore = viewCount / 1e6;
          const trendingScore = frequencyScore + popularVideoViewsScore + subscriberScore + channelViewsScore;
          return {
            channelId: item.id,
            channelTitle: item.snippet.title,
            channelDescription: item.snippet.description,
            thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
            subscriberCount,
            viewCount,
            videoCount,
            videoCountInTrending: aggregated.videoCount,
            topVideoTitle: aggregated.topVideoTitle,
            trendingScore
          };
        });
        if (input.sortBy === "subscribers") {
          channels.sort((a, b) => b.subscriberCount - a.subscriberCount);
        } else if (input.sortBy === "views") {
          channels.sort((a, b) => b.viewCount - a.viewCount);
        } else {
          channels.sort((a, b) => b.trendingScore - a.trendingScore);
        }
        return {
          success: true,
          channels: channels.slice(0, input.maxResults)
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Connection failed";
        return {
          success: false,
          error: translateYouTubeError(errorMsg),
          channels: []
        };
      }
    }),
    /**
     * Get trending videos for a specific country
     */
    getTrendingVideos: protectedProcedure.input(z3.object({
      regionCode: z3.string().min(2).max(2),
      sortBy: z3.enum(["trending", "viewCount", "publishedAt"]).default("trending"),
      maxResults: z3.number().min(1).max(50).default(12),
      videoCategoryId: z3.number().optional()
    })).query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new Error("User not authenticated");
      }
      const apiKeyRecord = await getUserApiKey2(ctx.user, "youtube");
      if (!apiKeyRecord) {
        return {
          success: false,
          error: "API Key not found",
          videos: []
        };
      }
      if (apiKeyRecord.testStatus !== "success") {
        return {
          success: false,
          error: "YouTube API \uD0A4 \uC624\uB958\uC785\uB2C8\uB2E4.\nAPI \uD0A4 \uD655\uC778 \uD6C4 \uB2E4\uC2DC \uC785\uB825\uD574\uC8FC\uC138\uC694.",
          videos: []
        };
      }
      try {
        const params = new URLSearchParams({
          part: "snippet,statistics,contentDetails",
          chart: "mostPopular",
          regionCode: input.regionCode,
          maxResults: input.maxResults.toString(),
          key: apiKeyRecord.apiKey
        });
        if (input.videoCategoryId !== void 0) {
          params.append("videoCategoryId", input.videoCategoryId.toString());
        }
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
          { method: "GET" }
        );
        if (!response.ok) {
          const errorData = await response.json();
          const errorMsg = errorData.error?.message || "Failed to fetch trending videos";
          return {
            success: false,
            error: translateYouTubeError(errorMsg),
            videos: []
          };
        }
        const data = await response.json();
        if (data.error) {
          const errorMsg = data.error.message || "YouTube API error";
          return {
            success: false,
            error: translateYouTubeError(errorMsg),
            videos: []
          };
        }
        let videos = (data.items || []).map((item) => ({
          id: item.id,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
          channelTitle: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          publishedAt: item.snippet.publishedAt,
          viewCount: parseInt(item.statistics.viewCount || "0"),
          duration: item.contentDetails.duration
        }));
        const uniqueChannelIds = Array.from(new Set(videos.map((v) => v.channelId))).slice(0, 50);
        const channelThumbnails = {};
        if (uniqueChannelIds.length > 0) {
          try {
            const channelParams = new URLSearchParams({
              part: "snippet",
              id: uniqueChannelIds.join(","),
              key: apiKeyRecord.apiKey
            });
            const channelResponse = await fetch(
              `https://www.googleapis.com/youtube/v3/channels?${channelParams.toString()}`,
              { method: "GET" }
            );
            if (channelResponse.ok) {
              const channelData = await channelResponse.json();
              (channelData.items || []).forEach((channel) => {
                const thumbnailUrl = channel.snippet?.thumbnails?.high?.url || channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url;
                if (thumbnailUrl) {
                  channelThumbnails[channel.id] = thumbnailUrl;
                }
              });
            }
          } catch (channelError) {
            console.error("Failed to fetch channel thumbnails:", channelError);
          }
        }
        videos = videos.map((video) => ({
          ...video,
          channelThumbnail: channelThumbnails[video.channelId] || null
        }));
        if (videos.length > 0) {
          const firstVideo = videos[0];
          console.log("[DEBUG] getTrendingVideos - First video:", {
            title: firstVideo.title,
            channelTitle: firstVideo.channelTitle,
            channelId: firstVideo.channelId,
            channelThumbnail: firstVideo.channelThumbnail
          });
          console.log("[DEBUG] channelThumbnails map:", channelThumbnails);
        }
        if (input.sortBy === "viewCount") {
          videos.sort((a, b) => b.viewCount - a.viewCount);
        } else if (input.sortBy === "publishedAt") {
          videos.sort(
            (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
          );
        }
        return {
          success: true,
          videos
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Connection failed";
        return {
          success: false,
          error: translateYouTubeError(errorMsg),
          videos: []
        };
      }
    }),
    /**
     * Get trending shorts (videos <= 60 seconds)
     * Uses videos.list with duration filtering
     */
    getTrendingShorts: protectedProcedure.input(z3.object({
      regionCode: z3.string().min(2).max(2),
      sortBy: z3.enum(["trending", "viewCount", "publishedAt"]).default("trending"),
      maxResults: z3.number().min(1).max(50).default(24)
    })).query(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new Error("User not authenticated");
      }
      const apiKeyRecord = await getUserApiKey2(ctx.user, "youtube");
      if (!apiKeyRecord) {
        return {
          success: false,
          error: "API Key not found",
          videos: []
        };
      }
      if (apiKeyRecord.testStatus !== "success") {
        return {
          success: false,
          error: "YouTube API \uD0A4 \uC624\uB958\uC785\uB2C8\uB2E4.\nAPI \uD0A4 \uD655\uC778 \uD6C4 \uB2E4\uC2DC \uC785\uB825\uD574\uC8FC\uC138\uC694.",
          videos: []
        };
      }
      try {
        const SHORTS_LANGUAGE_BY_REGION = {
          KR: "ko",
          US: "en",
          JP: "ja",
          GB: "en",
          FR: "fr",
          ES: "es",
          DE: "de"
        };
        const SHORTS_QUERY_BY_REGION = {
          KR: "#shorts \uC1FC\uCE20",
          US: "#shorts",
          JP: "\u65E5\u672C \u30B7\u30E7\u30FC\u30C8",
          GB: "#shorts",
          FR: "shorts fran\xE7ais",
          ES: "shorts espa\xF1ol",
          DE: "kurzvideo shorts"
        };
        const publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString();
        const relevanceLanguage = SHORTS_LANGUAGE_BY_REGION[input.regionCode] || "en";
        const queryKeyword = SHORTS_QUERY_BY_REGION[input.regionCode] || "#shorts";
        const searchParams = new URLSearchParams({
          part: "snippet",
          type: "video",
          q: queryKeyword,
          regionCode: input.regionCode,
          relevanceLanguage,
          publishedAfter,
          order: "viewCount",
          videoDuration: "short",
          maxResults: "50",
          key: apiKeyRecord.apiKey
        });
        const searchResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`,
          { method: "GET" }
        );
        if (!searchResponse.ok) {
          const errorData = await searchResponse.json();
          const errorMsg = errorData.error?.message || "Failed to search shorts";
          return {
            success: false,
            error: translateYouTubeError(errorMsg),
            videos: []
          };
        }
        const searchData = await searchResponse.json();
        if (searchData.error) {
          const errorMsg = searchData.error.message || "YouTube API error";
          return {
            success: false,
            error: translateYouTubeError(errorMsg),
            videos: []
          };
        }
        const videoIds = (searchData.items || []).map((item) => item.id.videoId).filter(Boolean);
        const publishedAfterFormatted = new Date(publishedAfter).toLocaleDateString("ko-KR");
        console.log(`[getTrendingShorts] Country: ${input.regionCode}, Sort: ${input.sortBy}, Lang: ${relevanceLanguage}, PublishedAfter: ${publishedAfterFormatted}`);
        console.log(`[getTrendingShorts] search.list items: ${searchData.items?.length || 0}, videoIds extracted: ${videoIds.length}`);
        if (videoIds.length === 0) {
          return {
            success: true,
            videos: []
          };
        }
        const videosParams = new URLSearchParams({
          part: "snippet,statistics,contentDetails",
          id: videoIds.join(","),
          key: apiKeyRecord.apiKey
        });
        const videosResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?${videosParams.toString()}`,
          { method: "GET" }
        );
        if (!videosResponse.ok) {
          const errorData = await videosResponse.json();
          const errorMsg = errorData.error?.message || "Failed to fetch video details";
          return {
            success: false,
            error: translateYouTubeError(errorMsg),
            videos: []
          };
        }
        const videosData = await videosResponse.json();
        if (videosData.error) {
          const errorMsg = videosData.error.message || "YouTube API error";
          return {
            success: false,
            error: translateYouTubeError(errorMsg),
            videos: []
          };
        }
        console.log(`[getTrendingShorts] Videos.list items: ${videosData.items?.length || 0}`);
        let videos = (videosData.items || []).map((item) => ({
          id: item.id,
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
          channelTitle: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          publishedAt: item.snippet.publishedAt,
          viewCount: parseInt(item.statistics.viewCount || "0"),
          duration: item.contentDetails.duration,
          durationSeconds: parseDurationToSeconds(item.contentDetails.duration)
        })).filter((video) => video.durationSeconds <= 60);
        const uniqueChannelIds = Array.from(new Set(videos.map((v) => v.channelId))).slice(0, 50);
        const channelThumbnails = {};
        if (uniqueChannelIds.length > 0) {
          try {
            const channelParams = new URLSearchParams({
              part: "snippet",
              id: uniqueChannelIds.join(","),
              key: apiKeyRecord.apiKey
            });
            const channelResponse = await fetch(
              `https://www.googleapis.com/youtube/v3/channels?${channelParams.toString()}`,
              { method: "GET" }
            );
            if (channelResponse.ok) {
              const channelData = await channelResponse.json();
              (channelData.items || []).forEach((channel) => {
                const thumbnailUrl = channel.snippet?.thumbnails?.high?.url || channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url;
                if (thumbnailUrl) {
                  channelThumbnails[channel.id] = thumbnailUrl;
                }
              });
            }
          } catch (channelError) {
            console.error("Failed to fetch channel thumbnails for shorts:", channelError);
          }
        }
        videos = videos.map((video) => ({
          ...video,
          channelThumbnail: channelThumbnails[video.channelId] || null
        }));
        console.log(`[getTrendingShorts] After 60s filter: ${videos.length} videos`);
        if (input.sortBy === "viewCount") {
          videos.sort((a, b) => b.viewCount - a.viewCount);
        } else if (input.sortBy === "publishedAt") {
          videos.sort(
            (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
          );
        }
        videos = videos.slice(0, input.maxResults);
        return {
          success: true,
          videos
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Connection failed";
        return {
          success: false,
          error: translateYouTubeError(errorMsg),
          videos: []
        };
      }
    })
  }),
  googleTrends: router({
    realtimeTrending: publicProcedure.input(z3.object({
      country: z3.string().default("KR")
    })).query(async ({ input }) => {
      try {
        const data = await getGoogleTrendingSearches(input.country);
        return {
          success: true,
          data
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Failed to fetch Google Trends data";
        console.error(`[Google Trends Router] Error:`, errorMsg);
        return {
          success: false,
          error: errorMsg,
          data: []
        };
      }
    })
  }),
  naver: router({
    categoryTrend: publicProcedure.input(z3.object({
      categoryCode: z3.string(),
      startDate: z3.string(),
      endDate: z3.string(),
      timeUnit: z3.enum(["date", "week", "month"]),
      device: z3.string().optional(),
      gender: z3.string().optional(),
      ages: z3.array(z3.string()).optional()
    })).mutation(async ({ input }) => {
      try {
        const clientId = process.env.NAVER_CLIENT_ID;
        const clientSecret = process.env.NAVER_CLIENT_SECRET;
        console.log("[Naver API] NAVER_CLIENT_ID configured:", !!clientId);
        console.log("[Naver API] NAVER_CLIENT_SECRET configured:", !!clientSecret);
        console.log("[Naver API] Input received:", JSON.stringify(input));
        if (!clientId || !clientSecret) {
          console.error("[Naver API] Missing credentials");
          return {
            success: false,
            error: "Naver API credentials not configured",
            data: []
          };
        }
        const categoryNameMap = {
          "50000000": "\uD328\uC158\uC758\uB958",
          "50000001": "\uD328\uC158\uC7A1\uD654",
          "50000002": "\uD654\uC7A5\uD488/\uBBF8\uC6A9",
          "50000003": "\uB514\uC9C0\uD138/\uAC00\uC804",
          "50000004": "\uC2DD\uD488",
          "50000005": "\uB3C4\uC11C/\uC74C\uBC18/\uC601\uC0C1\uBB3C",
          "50000006": "\uC2A4\uD3EC\uCE20/\uB808\uC800",
          "50000007": "\uAC00\uAD6C/\uC778\uD14C\uB9AC\uC5B4",
          "50000008": "\uCD9C\uC0B0/\uC721\uC544",
          "50000009": "\uBC18\uB824\uB3D9\uBB3C\uC6A9\uD488",
          "50000010": "\uAC74\uAC15/\uC758\uB8CC",
          "50000011": "\uC0DD\uD65C/\uD3B8\uC758"
        };
        const categoryName = categoryNameMap[input.categoryCode] || "\uAE30\uD0C0";
        const requestBody = {
          startDate: input.startDate,
          endDate: input.endDate,
          timeUnit: input.timeUnit,
          category: [
            {
              name: categoryName,
              param: [input.categoryCode]
            }
          ]
        };
        if (input.device && input.device !== "all") {
          requestBody.device = input.device;
        }
        if (input.gender && input.gender !== "all") {
          requestBody.gender = input.gender;
        }
        if (input.ages && input.ages.length > 0) {
          requestBody.ages = input.ages;
        }
        console.log("[Naver API] Request body:", JSON.stringify(requestBody));
        const response = await fetch(
          "https://openapi.naver.com/v1/datalab/shopping/categories",
          {
            method: "POST",
            headers: {
              "X-Naver-Client-Id": clientId,
              "X-Naver-Client-Secret": clientSecret,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
          }
        );
        console.log("[Naver API] HTTP Status:", response.status);
        if (!response.ok) {
          const errorData = await response.json();
          console.error("[Naver API] Error response:", JSON.stringify(errorData));
          const errorMessage = errorData.message || "\uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.";
          return {
            success: false,
            error: errorMessage,
            data: []
          };
        }
        const data = await response.json();
        if (!data.results || !data.results[0] || !data.results[0].data) {
          return {
            success: false,
            error: "\uC120\uD0DD\uD55C \uC870\uAC74\uC758 \uD074\uB9AD \uCD94\uC774 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
            data: []
          };
        }
        return {
          success: true,
          data: data.results[0].data
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Connection failed";
        console.error("[Naver API] Exception:", errorMsg);
        return {
          success: false,
          error: "\uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.",
          data: []
        };
      }
    }),
    unifiedInsight: unifiedInsightProcedure,
    diagnostic: publicProcedure.input(z3.object({
      keywords: z3.array(z3.string()).min(1).max(5),
      category: z3.string(),
      startDate: z3.string(),
      endDate: z3.string(),
      timeUnit: z3.enum(["date", "week", "month"])
    })).mutation(async ({ input }) => {
      try {
        const result = await runDiagnostics(
          input.keywords,
          input.category,
          input.startDate,
          input.endDate,
          input.timeUnit
        );
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("[Diagnostic] Exception:", errorMsg);
        return {
          searchTrendResult: {
            api: "Search Trend API",
            startTime: (/* @__PURE__ */ new Date()).toISOString(),
            endTime: (/* @__PURE__ */ new Date()).toISOString(),
            responseTimes: 0,
            statusCode: null,
            errorCode: "DIAGNOSTIC_ERROR",
            errorMessage: errorMsg,
            resultCount: 0,
            dataPointCount: 0,
            success: false
          },
          shoppingTrendResult: {
            api: "Shopping Trend API",
            startTime: (/* @__PURE__ */ new Date()).toISOString(),
            endTime: (/* @__PURE__ */ new Date()).toISOString(),
            responseTimes: 0,
            statusCode: null,
            errorCode: "DIAGNOSTIC_ERROR",
            errorMessage: errorMsg,
            resultCount: 0,
            dataPointCount: 0,
            success: false
          },
          credentialsConfigured: false
        };
      }
    })
  }),
  // YouTube Bookmarks router
  youtubeBookmarks: router({
    /**
     * Get all YouTube bookmarks for the current user
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      return await getUserYouTubeBookmarks(ctx.user.id);
    }),
    /**
     * Check if a specific video is bookmarked
     */
    isBookmarked: protectedProcedure.input(
      z3.object({
        videoId: z3.string(),
        contentType: z3.enum(["video", "shorts"])
      })
    ).query(async ({ ctx, input }) => {
      return await isYouTubeVideoBookmarked(ctx.user.id, input.videoId, input.contentType);
    }),
    /**
     * Add a video to bookmarks
     */
    add: protectedProcedure.input(
      z3.object({
        videoId: z3.string(),
        contentType: z3.enum(["video", "shorts"]),
        title: z3.string(),
        thumbnailUrl: z3.string().optional(),
        channelId: z3.string().optional(),
        channelTitle: z3.string().optional(),
        channelThumbnailUrl: z3.string().optional(),
        videoUrl: z3.string().optional(),
        duration: z3.string().optional(),
        viewCount: z3.union([z3.string(), z3.number()]).optional(),
        publishedAt: z3.string().optional()
      })
    ).mutation(async ({ ctx, input }) => {
      const bookmarkData = {
        videoId: input.videoId,
        contentType: input.contentType,
        title: input.title
      };
      if (input.thumbnailUrl) bookmarkData.thumbnailUrl = input.thumbnailUrl;
      if (input.channelId) bookmarkData.channelId = input.channelId;
      if (input.channelTitle) bookmarkData.channelTitle = input.channelTitle;
      if (input.channelThumbnailUrl) bookmarkData.channelThumbnailUrl = input.channelThumbnailUrl;
      if (input.videoUrl) bookmarkData.videoUrl = input.videoUrl;
      if (input.duration) bookmarkData.duration = input.duration;
      if (input.viewCount !== void 0 && input.viewCount !== null) {
        bookmarkData.viewCount = String(input.viewCount);
      }
      if (input.publishedAt) bookmarkData.publishedAt = input.publishedAt;
      await addYouTubeBookmark(ctx.user.id, bookmarkData);
      return { success: true };
    }),
    /**
     * Remove a video from bookmarks
     */
    remove: protectedProcedure.input(
      z3.object({
        videoId: z3.string(),
        contentType: z3.enum(["video", "shorts"])
      })
    ).mutation(async ({ ctx, input }) => {
      await removeYouTubeBookmark(ctx.user.id, input.videoId, input.contentType);
      return { success: true };
    })
  }),
  community: router({
    /**
     * Fetch popular posts from DC Inside Best Gallery
     * Returns normalized data for the community content list
     */
    getDcinside: publicProcedure.input(z3.object({
      sort: z3.enum(["popular", "recommend", "views", "comments"]).default("popular")
    }).optional()).query(async ({ input }) => {
      console.log("[DC Inside] getDcinside called");
      const cacheKey = "dcinside_posts_cache";
      const cacheDuration = 10 * 60 * 1e3;
      const cache2 = global.dcinsideCache || {};
      const now = Date.now();
      if (cache2[cacheKey] && now < cache2[cacheKey].expiresAt) {
        console.log("[DC Inside] Cache HIT - returning cached data");
        console.log("[DC Inside] collectedAt:", cache2[cacheKey].collectedAt);
        const cachedPosts = [...cache2[cacheKey].posts];
        const sortedPosts = cachedPosts.sort((a, b) => {
          const sort = input?.sort || "popular";
          switch (sort) {
            case "recommend":
              return b.reactionCount - a.reactionCount;
            case "views":
              return b.viewCount - a.viewCount;
            case "comments":
              return b.commentCount - a.commentCount;
            case "popular":
            default:
              const scoreA = a.reactionCount * 2 + a.commentCount * 1.5 + a.viewCount * 0.1;
              const scoreB = b.reactionCount * 2 + b.commentCount * 1.5 + b.viewCount * 0.1;
              return scoreB - scoreA;
          }
        });
        return {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt: cache2[cacheKey].collectedAt
        };
      }
      try {
        console.log("[DC Inside] Fetching data...");
        const response = await fetch("https://gall.dcinside.com/board/lists/?id=dcbest", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });
        console.log("[DC Inside] Response status:", response.status);
        if (!response.ok) {
          console.error("[DC Inside] HTTP Error:", response.status);
          return {
            success: false,
            error: "\uB514\uC2DC\uC778\uC0AC\uC774\uB4DC \uC778\uAE30\uAE00\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
            data: []
          };
        }
        const html = await response.text();
        console.log("[DC Inside] HTML length:", html.length);
        const posts = [];
        const rowRegex = /<tr\s+class="ub-content[^>]*us-post[^>]*data-no="(\d+)"[^>]*>([\s\S]*?)<\/tr>/g;
        console.log("[DC Inside] Regex test:", rowRegex.test(html));
        let rowMatch;
        let rank = 1;
        let matchCount = 0;
        while ((rowMatch = rowRegex.exec(html)) !== null && rank <= 30) {
          matchCount++;
          const postNo = rowMatch[1];
          const rowHtml = rowMatch[2];
          const titleMatch = rowHtml.match(/<td\s+class="gall_tit[^>]*>([\s\S]*?)<\/td>/);
          const dateMatch = rowHtml.match(/<td\s+class="gall_date"[^>]*title="([^"]*)"/);
          const viewMatch = rowHtml.match(/<td\s+class="gall_count"[^>]*>(\d+)<\/td>/);
          const reactionMatch = rowHtml.match(/<td\s+class="gall_recommend"[^>]*>(\d+)<\/td>/);
          if (!titleMatch) continue;
          const titleHtml = titleMatch[1];
          const commentMatch = titleHtml.match(/<span\s+class="reply_num">\[(\d+)\]<\/span>/);
          const commentCount = commentMatch ? parseInt(commentMatch[1]) : 0;
          const titleTextMatch = titleHtml.match(/<a[^>]*>([\s\S]*?)<\/a>/);
          if (!titleTextMatch) continue;
          let title = titleTextMatch[1];
          title = title.replace(/<[^>]*>/g, "");
          title = title.replace(/^\s*\[\w+\]\s*/, "");
          title = title.trim();
          if (!title) continue;
          posts.push({
            id: `dcinside_${postNo}`,
            rank: rank++,
            community: "\uB514\uC2DC\uC778\uC0AC\uC774\uB4DC",
            externalPostId: postNo,
            title,
            url: `https://gall.dcinside.com/board/view/?id=dcbest&no=${postNo}`,
            author: "unknown",
            time: dateMatch ? dateMatch[1] : "",
            viewCount: viewMatch ? parseInt(viewMatch[1]) : 0,
            reactionCount: reactionMatch ? parseInt(reactionMatch[1]) : 0,
            commentCount
          });
        }
        console.log("[DC Inside] Total posts parsed:", posts.length);
        const collectedAt = (/* @__PURE__ */ new Date()).toISOString();
        console.log("[DC Inside] New collection - collectedAt:", collectedAt);
        const sortedPosts = [...posts].sort((a, b) => {
          const sort = input?.sort || "popular";
          switch (sort) {
            case "recommend":
              return b.reactionCount - a.reactionCount;
            case "views":
              return b.viewCount - a.viewCount;
            case "comments":
              return b.commentCount - a.commentCount;
            case "popular":
            default:
              const scoreA = a.reactionCount * 2 + a.commentCount * 1.5 + a.viewCount * 0.1;
              const scoreB = b.reactionCount * 2 + b.commentCount * 1.5 + b.viewCount * 0.1;
              return scoreB - scoreA;
          }
        });
        sortedPosts.forEach((post, index) => {
          post.rank = index + 1;
        });
        global.dcinsideCache = {
          [cacheKey]: {
            posts: sortedPosts,
            collectedAt,
            expiresAt: now + cacheDuration
          }
        };
        const result = {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt
        };
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error("[DC Inside] Exception:", errorMsg);
        return {
          success: false,
          error: "\uB514\uC2DC\uC778\uC0AC\uC774\uB4DC \uC778\uAE30\uAE00\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
          data: []
        };
      }
    }),
    /**
     * Fetch popular posts from Ppomppu
     * Returns normalized data for the community content list
     * Handles EUC-KR encoding
     */
    getPpomppu: publicProcedure.input(z3.object({ forceRefresh: z3.boolean().optional() }).optional()).query(async ({ input }) => {
      const cacheKey = "ppomppu_posts_cache";
      const cacheDuration = 10 * 60 * 1e3;
      const forceRefresh = input?.forceRefresh || false;
      const cache2 = global.ppomppuCache || {};
      const now = Date.now();
      if (!forceRefresh && cache2[cacheKey] && now - cache2[cacheKey].timestamp < cacheDuration) {
        return cache2[cacheKey].data;
      }
      try {
        const response = await fetch("https://www.ppomppu.co.kr/zboard/zboard.php?id=freeboard", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.ppomppu.co.kr/",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ko-KR,ko;q=0.9"
          }
        });
        console.log("[Ppomppu] HTTP Status:", response.status);
        if (!response.ok) {
          console.error("[Ppomppu] HTTP Error:", response.status);
          return {
            success: false,
            error: "\uBF50\uBFCC \uC778\uAE30\uAE00\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
            data: []
          };
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        let html;
        try {
          const iconv = require2("iconv-lite");
          html = iconv.decode(buffer, "euc-kr");
          console.log("[Ppomppu] Decoded with EUC-KR successfully");
        } catch (decodeError) {
          console.error("[Ppomppu] EUC-KR decode failed:", decodeError);
          html = buffer.toString("utf-8");
          console.log("[Ppomppu] Fallback to UTF-8 decode");
        }
        const posts = [];
        let rank = 1;
        console.log("[Ppomppu] HTML length:", html.length);
        const rowRegex = /<tr[^>]*class="baseList[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
        let rowMatch;
        let totalRows = 0;
        while ((rowMatch = rowRegex.exec(html)) !== null && rank <= 30) {
          totalRows++;
          const rowHtml = rowMatch[1];
          const idMatch = rowHtml.match(/<td[^>]*class="baseList-space baseList-numb"[^>]*>(\d+)<\/td>/);
          if (!idMatch) continue;
          const postId = idMatch[1];
          const titleMatch = rowHtml.match(/<a\s+class=['"]baseList-title['"][^>]*href="([^"]*?)"[^>]*><span>([^<]+)<\/span><\/a>/);
          if (!titleMatch) continue;
          const relativeUrl = titleMatch[1];
          const title = titleMatch[2].trim();
          if (!title) continue;
          const commentMatch = rowHtml.match(/<span class="baseList-c"[^>]*>(\d+)<\/span>/);
          const commentCount = commentMatch ? parseInt(commentMatch[1]) : 0;
          const timeMatch = rowHtml.match(/<time[^>]*class="baseList-time"[^>]*>([^<]+)<\/time>/);
          const time = timeMatch ? timeMatch[1] : "-";
          const recMatch = rowHtml.match(/<td[^>]*class="baseList-space baseList-rec"[^>]*>([^<]*)<\/td>/);
          let reactionCount = 0;
          if (recMatch && recMatch[1].trim()) {
            const recStr = recMatch[1].trim();
            const recParts = recStr.split(" - ");
            reactionCount = parseInt(recParts[0]) || 0;
          }
          const viewsMatch = rowHtml.match(/<td[^>]*class="baseList-space baseList-views"[^>]*>(\d+)<\/td>/);
          const viewCount = viewsMatch ? parseInt(viewsMatch[1]) : null;
          const fullUrl = relativeUrl.startsWith("http") ? relativeUrl : `https://www.ppomppu.co.kr/zboard/${relativeUrl}`;
          posts.push({
            id: `ppomppu_${postId}`,
            rank: rank++,
            community: "\uBF50\uBFCC",
            externalPostId: postId,
            title,
            url: fullUrl,
            author: "unknown",
            time,
            viewCount,
            reactionCount,
            commentCount,
            collectedAt: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
        console.log("[Ppomppu] Total rows found:", totalRows);
        console.log("[Ppomppu] Valid posts parsed:", posts.length);
        if (posts.length > 0) {
          console.log("[Ppomppu] First post:", posts[0].title);
        }
        const collectedAt = (/* @__PURE__ */ new Date()).toISOString();
        const result = {
          success: true,
          error: null,
          data: posts,
          collectedAt
        };
        global.ppomppuCache = {
          [cacheKey]: {
            data: result,
            timestamp: now
          }
        };
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error("[Ppomppu] Exception:", errorMsg);
        return {
          success: false,
          error: "\uBF50\uBFCC \uC778\uAE30\uAE00\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
          data: []
        };
      }
    }),
    /**
     * Fetch popular posts from Nate Pann Ranking
     * Returns normalized data for the community content list
     */
    getNatePann: publicProcedure.input(z3.object({
      sort: z3.enum(["popular", "recommend", "views", "comments"]).default("popular")
    }).optional()).query(async ({ input }) => {
      const cacheKey = "natepann_posts_cache";
      const cacheDuration = 10 * 60 * 1e3;
      const cache2 = global.natepannCache || {};
      const now = Date.now();
      if (cache2[cacheKey] && now < cache2[cacheKey].expiresAt) {
        console.log("[Nate Pann] Cache HIT - returning cached data");
        console.log("[Nate Pann] collectedAt:", cache2[cacheKey].collectedAt);
        const cachedPosts = [...cache2[cacheKey].posts];
        const sortedPosts = cachedPosts.sort((a, b) => {
          const sort = input?.sort || "popular";
          switch (sort) {
            case "recommend":
              return b.reactionCount - a.reactionCount;
            case "views":
              return b.viewCount - a.viewCount;
            case "comments":
              return b.commentCount - a.commentCount;
            case "popular":
            default:
              const scoreA = a.reactionCount * 2 + a.commentCount * 1.5 + a.viewCount * 0.1;
              const scoreB = b.reactionCount * 2 + b.commentCount * 1.5 + b.viewCount * 0.1;
              return scoreB - scoreA;
          }
        });
        return {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt: cache2[cacheKey].collectedAt
        };
      }
      try {
        const response = await fetch("https://pann.nate.com/talk/ranking", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });
        if (!response.ok) {
          console.error("[Nate Pann] HTTP Error:", response.status);
          return {
            success: false,
            error: "\uB124\uC774\uD2B8\uD310 \uC778\uAE30\uAE00\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
            data: []
          };
        }
        const html = await response.text();
        const posts = [];
        const rowRegex = /<li>\s*<div class="rankNum">[\s\S]*?<\/li>/g;
        let rank = 1;
        let rowMatch;
        while ((rowMatch = rowRegex.exec(html)) !== null && rank <= 30) {
          const rowHtml = rowMatch[0];
          const titleMatch = rowHtml.match(/<h2><a[^>]*href="([^"]*?)"[^>]*title="([^"]*?)"/);
          if (!titleMatch) continue;
          const relativeUrl = titleMatch[1];
          const title = titleMatch[2].trim();
          if (!title) continue;
          const commentMatch = rowHtml.match(/<span\s+class="reple-num"[^>]*>.*?\((\d+)\)<\/span>/);
          const commentCount = commentMatch ? parseInt(commentMatch[1]) : 0;
          const reactionMatch = rowHtml.match(/<span\s+class="rcm">추천\s+(\d+)<\/span>/);
          const reactionCount = reactionMatch ? parseInt(reactionMatch[1]) : 0;
          const fullUrl = relativeUrl.startsWith("http") ? relativeUrl : `https://pann.nate.com${relativeUrl}`;
          posts.push({
            id: `natepann_${rank}`,
            rank,
            community: "\uB124\uC774\uD2B8\uD310",
            externalPostId: `${rank}`,
            title,
            url: fullUrl,
            author: "-",
            time: "-",
            viewCount: null,
            reactionCount,
            commentCount
          });
          rank++;
        }
        const collectedAt = (/* @__PURE__ */ new Date()).toISOString();
        console.log("[Nate Pann] New collection - collectedAt:", collectedAt);
        const sortedPosts = [...posts].sort((a, b) => {
          const sort = input?.sort || "popular";
          switch (sort) {
            case "recommend":
              return b.reactionCount - a.reactionCount;
            case "views":
              return b.viewCount - a.viewCount;
            case "comments":
              return b.commentCount - a.commentCount;
            case "popular":
            default:
              const scoreA = a.reactionCount * 2 + a.commentCount * 1.5 + a.viewCount * 0.1;
              const scoreB = b.reactionCount * 2 + b.commentCount * 1.5 + b.viewCount * 0.1;
              return scoreB - scoreA;
          }
        });
        sortedPosts.forEach((post, index) => {
          post.rank = index + 1;
        });
        global.natepannCache = {
          [cacheKey]: {
            posts: sortedPosts,
            collectedAt,
            expiresAt: now + cacheDuration
          }
        };
        const result = {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt
        };
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error("[Nate Pann] Exception:", errorMsg);
        return {
          success: false,
          error: "\uB124\uC774\uD2B8\uD310 \uC778\uAE30\uAE00\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
          data: []
        };
      }
    }),
    /**
     * Fetch popular posts from Ruliweb Best
     * Returns normalized data for the community content list
     */
    getRuliweb: publicProcedure.input(z3.object({
      sort: z3.enum(["popular", "recommend", "views", "comments"]).default("popular")
    }).optional()).query(async ({ input }) => {
      const cacheKey = "ruliweb_posts_cache";
      const cacheDuration = 10 * 60 * 1e3;
      const cache2 = global.ruliwebCache || {};
      const now = Date.now();
      if (cache2[cacheKey] && now < cache2[cacheKey].expiresAt) {
        console.log("[Ruliweb] Cache HIT - returning cached data");
        console.log("[Ruliweb] collectedAt:", cache2[cacheKey].collectedAt);
        const cachedPosts = [...cache2[cacheKey].posts];
        const sortedPosts = cachedPosts.sort((a, b) => {
          const sort = input?.sort || "popular";
          switch (sort) {
            case "recommend":
              return b.reactionCount - a.reactionCount;
            case "views":
              return b.viewCount - a.viewCount;
            case "comments":
              return b.commentCount - a.commentCount;
            case "popular":
            default:
              const scoreA = a.reactionCount * 2 + a.commentCount * 1.5 + a.viewCount * 0.1;
              const scoreB = b.reactionCount * 2 + b.commentCount * 1.5 + b.viewCount * 0.1;
              return scoreB - scoreA;
          }
        });
        return {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt: cache2[cacheKey].collectedAt
        };
      }
      try {
        const response = await fetch("https://bbs.ruliweb.com/best/all", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });
        if (!response.ok) {
          console.error("[Ruliweb] HTTP Error:", response.status);
          return {
            success: false,
            error: "\uB8E8\uB9AC\uC6F9 \uC778\uAE30\uAE00\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
            data: []
          };
        }
        const html = await response.text();
        const posts = [];
        const rowRegex = /<tr\s+class="table_body blocktarget mode_list">[\s\S]*?<\/tr>/g;
        let rank = 1;
        let rowMatch;
        while ((rowMatch = rowRegex.exec(html)) !== null && rank <= 30) {
          const rowHtml = rowMatch[0];
          const idMatch = rowHtml.match(/<td\s+class="id[^>]*>\s*(\d+)\s*<\/td>/);
          const postId = idMatch ? idMatch[1] : null;
          if (!postId) continue;
          const titleMatch = rowHtml.match(/<a\s+class="subject_link[^>]*href="([^"]*?)"[^>]*>\s*<span\s+class="text_over">\s*([^<]+?)\s*<\/span>/);
          if (!titleMatch) continue;
          const relativeUrl = titleMatch[1];
          const title = titleMatch[2].trim();
          if (!title) continue;
          const authorMatch = rowHtml.match(/<td\s+class="writer[^>]*>\s*([^<]+?)\s*<\/td>/);
          const author = authorMatch ? authorMatch[1].trim() : "-";
          const reactionMatch = rowHtml.match(/<td\s+class="recomd">\s*(\d+)\s*<\/td>/);
          const reactionCount = reactionMatch ? parseInt(reactionMatch[1]) : 0;
          const viewMatch = rowHtml.match(/<td\s+class="hit">\s*(\d+)\s*<\/td>/);
          const viewCount = viewMatch ? parseInt(viewMatch[1]) : 0;
          const commentMatch = rowHtml.match(/<span\s+class="num_reply[^>]*>\s*\((\d+)\)\s*<\/span>/);
          const commentCount = commentMatch ? parseInt(commentMatch[1]) : 0;
          const timeMatch = rowHtml.match(/<td\s+class="time">[\s\S]*?(\d{2}:\d{2})\s*<\/td>/);
          const time = timeMatch ? timeMatch[1] : "-";
          const boardMatch = relativeUrl.match(/\/best\/board\/(\d+)/);
          const boardId = boardMatch ? boardMatch[1] : "unknown";
          const boardNameMap = {
            "300143": "\uC720\uBA38",
            "300004": "\uAC8C\uC784",
            "300006": "\uAE30\uC220",
            "300017": "\uAC8C\uC784",
            "300079": "\uAC8C\uC784",
            "300117": "\uAC8C\uC784",
            "300276": "\uAC8C\uC784",
            "300446": "\uAC8C\uC784"
          };
          const category = boardNameMap[boardId] || boardId;
          const fullUrl = relativeUrl.startsWith("http") ? relativeUrl : `https://bbs.ruliweb.com${relativeUrl}`;
          posts.push({
            id: `ruliweb_${postId}`,
            rank,
            community: "\uB8E8\uB9AC\uC6F9",
            externalPostId: postId,
            title,
            url: fullUrl,
            author,
            time,
            viewCount,
            reactionCount,
            commentCount,
            category
          });
          rank++;
        }
        const collectedAt = (/* @__PURE__ */ new Date()).toISOString();
        console.log("[Ruliweb] New collection - collectedAt:", collectedAt);
        const sortedPosts = [...posts].sort((a, b) => {
          const sort = input?.sort || "popular";
          switch (sort) {
            case "recommend":
              return b.reactionCount - a.reactionCount;
            case "views":
              return b.viewCount - a.viewCount;
            case "comments":
              return b.commentCount - a.commentCount;
            case "popular":
            default:
              const scoreA = a.reactionCount * 2 + a.commentCount * 1.5 + a.viewCount * 0.1;
              const scoreB = b.reactionCount * 2 + b.commentCount * 1.5 + b.viewCount * 0.1;
              return scoreB - scoreA;
          }
        });
        sortedPosts.forEach((post, index) => {
          post.rank = index + 1;
        });
        global.ruliwebCache = {
          [cacheKey]: {
            posts: sortedPosts,
            collectedAt,
            expiresAt: now + cacheDuration
          }
        };
        const result = {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt
        };
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error("[Ruliweb] Exception:", errorMsg);
        return {
          success: false,
          error: "\uB8E8\uB9AC\uC6F9 \uC778\uAE30\uAE00\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
          data: []
        };
      }
    }),
    getInven: publicProcedure.input(z3.object({
      sort: z3.enum(["popular", "recommend", "views", "comments"]).default("popular")
    }).optional()).query(async ({ input }) => {
      const cacheKey = "inven_best";
      const cacheDuration = 10 * 60 * 1e3;
      const cache2 = global.invenCache || {};
      const now = Date.now();
      if (cache2[cacheKey] && now < cache2[cacheKey].expiresAt) {
        console.log("[Inven] Cache HIT - returning cached data");
        console.log("[Inven] collectedAt:", cache2[cacheKey].collectedAt);
        const cachedPosts = [...cache2[cacheKey].posts];
        const sortedPosts = cachedPosts.sort((a, b) => {
          const sort = input?.sort || "popular";
          switch (sort) {
            case "recommend":
              return b.reactionCount - a.reactionCount;
            case "views":
              return b.viewCount - a.viewCount;
            case "comments":
              return b.commentCount - a.commentCount;
            case "popular":
            default:
              const scoreA = a.reactionCount * 2 + a.commentCount * 1.5 + a.viewCount * 0.1;
              const scoreB = b.reactionCount * 2 + b.commentCount * 1.5 + b.viewCount * 0.1;
              return scoreB - scoreA;
          }
        });
        return {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt: cache2[cacheKey].collectedAt
        };
      }
      try {
        const https = require2("https");
        const zlib = require2("zlib");
        const html = await new Promise((resolve, reject) => {
          https.get("https://www.inven.co.kr/board/webzine/2097", {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
              "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
              "Connection": "keep-alive",
              "Upgrade-Insecure-Requests": "1"
            }
          }, (res) => {
            let data = "";
            const stream = res.headers["content-encoding"] === "gzip" ? res.pipe(zlib.createGunzip()) : res;
            stream.on("data", (chunk) => data += chunk);
            stream.on("end", () => resolve(data));
          }).on("error", reject);
        });
        const cheerio = require2("cheerio");
        const $ = cheerio.load(html);
        const posts = [];
        const rows = $("tbody tr");
        let rank = 1;
        console.log(`[Inven] Total rows found: ${rows.length}`);
        rows.each((idx, row) => {
          if (rank > 50) return;
          const $row = $(row);
          if ($row.find(".notice-icon").length > 0) {
            return;
          }
          let title = "";
          const imgs = $row.find("img[alt]");
          imgs.each((i, img) => {
            const alt = $(img).attr("alt") || "";
            if (alt && !alt.includes("\uC544\uC774\uCF58") && !alt.includes("icon")) {
              title = alt;
              return false;
            }
          });
          if (!title) {
            return;
          }
          const subjLink = $row.find("a.subject-link");
          let url = subjLink.attr("href") || "";
          if (url && !url.startsWith("http")) {
            url = "https://www.inven.co.kr" + url;
          }
          const tds = $row.find("td");
          const category = tds.eq(1).text().trim();
          const author = $row.find("span.layerNickName").text().trim();
          const time = tds.eq(3).text().trim();
          const viewsStr = tds.eq(4).text().trim();
          const viewCount = parseInt(viewsStr.replace(/,/g, "")) || 0;
          const commentStr = tds.eq(5).text().trim();
          const commentCount = parseInt(commentStr) || 0;
          const reactionCount = 0;
          posts.push({
            id: `inven_${rank}`,
            rank,
            community: "\uC778\uBCA4",
            externalPostId: `inven_${idx}`,
            title,
            url,
            author,
            time,
            viewCount,
            reactionCount,
            commentCount,
            category
          });
          rank++;
        });
        console.log(`[Inven] Posts parsed: ${posts.length}`);
        if (posts.length > 0) {
          console.log(`[Inven] First post: ${posts[0].title}`);
        }
        const collectedAt = (/* @__PURE__ */ new Date()).toISOString();
        console.log("[Inven] New collection - collectedAt:", collectedAt);
        const sortedPosts = [...posts].sort((a, b) => {
          const sort = input?.sort || "popular";
          switch (sort) {
            case "recommend":
              return b.reactionCount - a.reactionCount;
            case "views":
              return b.viewCount - a.viewCount;
            case "comments":
              return b.commentCount - a.commentCount;
            case "popular":
            default:
              const scoreA = a.reactionCount * 2 + a.commentCount * 1.5 + a.viewCount * 0.1;
              const scoreB = b.reactionCount * 2 + b.commentCount * 1.5 + b.viewCount * 0.1;
              return scoreB - scoreA;
          }
        });
        sortedPosts.forEach((post, index) => {
          post.rank = index + 1;
        });
        global.invenCache = {
          [cacheKey]: {
            posts: sortedPosts,
            collectedAt,
            expiresAt: now + cacheDuration
          }
        };
        const result = {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt
        };
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error("[Inven] Exception:", errorMsg);
        return {
          success: false,
          error: "\uC778\uBCA4 \uAC8C\uC2DC\uD310\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
          data: []
        };
      }
    }),
    getBobaedream: publicProcedure.input(z3.object({
      sort: z3.enum(["popular", "recommend", "views", "comments"]).default("popular")
    }).optional()).query(async ({ input }) => {
      const cacheKey = "bobaedream_posts_cache";
      const cacheDuration = 10 * 60 * 1e3;
      const BOBAEDREAM_URL = "https://www.bobaedream.co.kr/list?code=best";
      const now = Date.now();
      const cache2 = global.bobaedreamCache || {};
      if (cache2[cacheKey] && now < cache2[cacheKey].expiresAt) {
        console.log("[Bobaedream] Cache HIT - returning cached data");
        console.log("[Bobaedream] collectedAt:", cache2[cacheKey].collectedAt);
        const cachedPosts = [...cache2[cacheKey].posts];
        const sortedPosts = cachedPosts.sort((a, b) => {
          const sort = input?.sort || "popular";
          switch (sort) {
            case "recommend":
              return b.reactionCount - a.reactionCount;
            case "views":
              return b.viewCount - a.viewCount;
            case "comments":
              return b.commentCount - a.commentCount;
            case "popular":
            default:
              const scoreA = a.reactionCount * 2 + a.commentCount * 1.5 + a.viewCount * 0.1;
              const scoreB = b.reactionCount * 2 + b.commentCount * 1.5 + b.viewCount * 0.1;
              return scoreB - scoreA;
          }
        });
        return {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt: cache2[cacheKey].collectedAt
        };
      }
      try {
        console.log("[Bobaedream] Fetching from:", BOBAEDREAM_URL);
        const response = await fetch(BOBAEDREAM_URL);
        if (!response.ok) {
          console.error("[Bobaedream] HTTP Error:", response.status);
          return {
            success: false,
            error: "\uBCF4\uBC30\uB4DC\uB9BC\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
            data: []
          };
        }
        const html = await response.text();
        const posts = [];
        console.log("[Bobaedream] HTML length:", html.length);
        const rowRegex = /<tr[^>]*itemscope[^>]*>([\s\S]*?)<\/tr>/g;
        let rowMatch;
        let totalRows = 0;
        let validRows = 0;
        while ((rowMatch = rowRegex.exec(html)) !== null) {
          totalRows++;
          const rowHtml = rowMatch[1];
          if (rowHtml.includes("\uACF5\uC9C0") || rowHtml.includes("\uAD11\uACE0")) {
            continue;
          }
          const titleMatch = rowHtml.match(/<a[^>]*class="bsubject"[^>]*href="([^"]*?)"[^>]*>([^<]*)<\/a>/);
          if (!titleMatch) {
            continue;
          }
          let url = titleMatch[1];
          let title = titleMatch[2].trim();
          if (!url.startsWith("http")) {
            url = `https://www.bobaedream.co.kr${url}`;
          }
          if (url.includes("list.php")) {
            continue;
          }
          let commentCount = 0;
          const commentMatch = rowHtml.match(/<strong[^>]*class="totreply"[^>]*>(\d+)<\/strong>/);
          if (commentMatch) {
            commentCount = parseInt(commentMatch[1], 10);
          }
          let author = "-";
          const authorMatch = rowHtml.match(/<span[^>]*class="author"[^>]*title="([^"]*?)"/);
          if (authorMatch) {
            author = authorMatch[1].trim();
          }
          let time = "-";
          const timeMatch = rowHtml.match(/<td[^>]*class="date"[^>]*>([^<]*)<\/td>/);
          if (timeMatch) {
            time = timeMatch[1].trim();
          }
          let reactionCount = 0;
          const reactionMatch = rowHtml.match(/<td[^>]*class="recomm"[^>]*>\s*<font[^>]*style="color:#ff7234[^>]*>(\d+)<\/font>/);
          if (reactionMatch) {
            reactionCount = parseInt(reactionMatch[1], 10);
          }
          let viewCount = 0;
          const viewMatch = rowHtml.match(/<td[^>]*class="count"[^>]*>([\s\S]*?)<\/td>/);
          if (viewMatch) {
            const countText = viewMatch[1].replace(/<[^>]*>/g, "").trim();
            const numMatch = countText.match(/(\d+)/);
            if (numMatch) {
              viewCount = parseInt(numMatch[1], 10);
            }
          }
          validRows++;
          if (validRows <= 5) {
            console.log(`[Bobaedream] Row ${validRows}: title="${title}", author="${author}", time="${time}", reaction=${reactionCount}, view=${viewCount}, comment=${commentCount}`);
          }
          posts.push({
            id: `bobaedream-${validRows}`,
            rank: validRows,
            community: "\uBCF4\uBC30\uB4DC\uB9BC",
            externalPostId: url.split("No=")[1]?.split("&")[0] || `${validRows}`,
            title,
            url,
            author,
            time,
            viewCount,
            reactionCount,
            commentCount,
            category: "\uBCA0\uC2A4\uD2B8"
          });
        }
        console.log("[Bobaedream] Total rows found:", totalRows);
        console.log("[Bobaedream] Valid posts parsed:", validRows);
        if (posts.length > 0) {
          console.log("[Bobaedream] First post:", posts[0].title);
        }
        const collectedAt = (/* @__PURE__ */ new Date()).toISOString();
        console.log("[Bobaedream] New collection - collectedAt:", collectedAt);
        const sortedPosts = [...posts].sort((a, b) => {
          const sort = input?.sort || "popular";
          switch (sort) {
            case "recommend":
              return b.reactionCount - a.reactionCount;
            case "views":
              return b.viewCount - a.viewCount;
            case "comments":
              return b.commentCount - a.commentCount;
            case "popular":
            default:
              const scoreA = a.reactionCount * 2 + a.commentCount * 1.5 + a.viewCount * 0.1;
              const scoreB = b.reactionCount * 2 + b.commentCount * 1.5 + b.viewCount * 0.1;
              return scoreB - scoreA;
          }
        });
        sortedPosts.forEach((post, index) => {
          post.rank = index + 1;
        });
        global.bobaedreamCache = {
          [cacheKey]: {
            posts: sortedPosts,
            collectedAt,
            expiresAt: now + cacheDuration
          }
        };
        const result = {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt
        };
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error("[Bobaedream] Exception:", errorMsg);
        return {
          success: false,
          error: "\uBCF4\uBC30\uB4DC\uB9BC\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
          data: []
        };
      }
    }),
    getHumorUniv: publicProcedure.input(z3.object({
      sort: z3.enum(["popular", "recommend", "views", "comments"]).default("popular")
    }).optional()).query(async ({ input }) => {
      const cacheKey = "humoruniv_posts_cache";
      const cacheDuration = 10 * 60 * 1e3;
      const HUMORUNIV_URL = "https://web.humoruniv.com/board/humor/list.html?table=pds";
      const now = Date.now();
      let timeout = null;
      const cache2 = global.humorunivCache || {};
      if (cache2[cacheKey] && now < cache2[cacheKey].expiresAt) {
        console.log("[HumorUniv] Cache HIT - returning cached data");
        console.log("[HumorUniv] collectedAt:", cache2[cacheKey].collectedAt);
        const cachedPosts = [...cache2[cacheKey].posts];
        const sortedPosts = cachedPosts.sort((a, b) => {
          const sort = input?.sort || "popular";
          switch (sort) {
            case "recommend":
              return b.reactionCount - a.reactionCount;
            case "views":
              return b.viewCount - a.viewCount;
            case "comments":
              return b.commentCount - a.commentCount;
            case "popular":
            default:
              const scoreA = a.reactionCount * 2 + a.commentCount * 1.5 + a.viewCount * 0.1;
              const scoreB = b.reactionCount * 2 + b.commentCount * 1.5 + b.viewCount * 0.1;
              return scoreB - scoreA;
          }
        });
        return {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt: cache2[cacheKey].collectedAt
        };
      }
      try {
        console.log("[HumorUniv] Fetching from:", HUMORUNIV_URL);
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), 1e4);
        const response = await fetch(HUMORUNIV_URL, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "ko-KR,ko;q=0.9"
          }
        });
        clearTimeout(timeout);
        if (!response.ok) {
          console.error("[HumorUniv] HTTP Error:", response.status);
          return {
            success: false,
            error: "\uC6C3\uAE34\uB300\uD559\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
            data: []
          };
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        let html;
        try {
          const iconv = require2("iconv-lite");
          html = iconv.decode(buffer, "euc-kr");
          console.log("[HumorUniv] Decoded with EUC-KR successfully");
        } catch (decodeError) {
          console.error("[HumorUniv] EUC-KR decode failed:", decodeError);
          html = buffer.toString("utf-8");
          console.log("[HumorUniv] Fallback to UTF-8 decode");
        }
        const posts = [];
        console.log("[HumorUniv] HTML length:", html.length);
        const extractRowWithNesting = (html2, startIdx2) => {
          const trStart = html2.indexOf("<tr", startIdx2);
          if (trStart === -1) return null;
          let depth = 1;
          let idx = html2.indexOf(">", trStart) + 1;
          while (depth > 0 && idx < html2.length) {
            if (html2.substr(idx, 4) === "<tr ") {
              depth++;
              idx += 4;
            } else if (html2.substr(idx, 4) === "<tr>") {
              depth++;
              idx += 4;
            } else if (html2.substr(idx, 5) === "</tr>") {
              depth--;
              if (depth === 0) {
                return html2.substring(trStart, idx + 5);
              }
              idx += 5;
            } else {
              idx++;
            }
          }
          return null;
        };
        let startIdx = 0;
        let totalRows = 0;
        let validRows = 0;
        while (validRows < 30) {
          const idIdx = html.indexOf('id="li_chk_pds-', startIdx);
          if (idIdx === -1) break;
          const rowHtml = extractRowWithNesting(html, idIdx - 100);
          if (!rowHtml) break;
          totalRows++;
          const idMatch = rowHtml.match(/id="li_chk_pds-([^"]+)"/);
          if (!idMatch) {
            startIdx = idIdx + 1;
            continue;
          }
          const postId = idMatch[1];
          const titleMatch = rowHtml.match(/<span[^>]*id="title_chk_pds-[^"]*"[^>]*>([\s\S]*?)<\/span>/);
          if (!titleMatch) {
            startIdx = idIdx + 1;
            continue;
          }
          let title = titleMatch[1].trim().replace(/\s+/g, " ");
          if (!title) {
            startIdx = idIdx + 1;
            continue;
          }
          let commentCount = 0;
          const commentMatch = rowHtml.match(/<span[^>]*class="list_comment_num"[^>]*>\s*\[(\d+)\]/);
          if (commentMatch) {
            commentCount = parseInt(commentMatch[1], 10);
          }
          let url = `https://web.humoruniv.com/board/humor/read.html?table=pds&number=${postId}`;
          let author = "-";
          const authorMatch = rowHtml.match(/<span[^>]*class=hu_nick_txt[^>]*>([^<]+)<\/span>/);
          if (authorMatch) {
            author = authorMatch[1].trim();
          }
          let date = "-";
          const dateMatch = rowHtml.match(/<span[^>]*class="w_date"[^>]*>([^<]+)<\/span>/);
          if (dateMatch) {
            date = dateMatch[1].trim();
          }
          let time = "-";
          const timeMatch = rowHtml.match(/<span[^>]*class="w_time"[^>]*>([^<]+)<\/span>/);
          if (timeMatch) {
            time = timeMatch[1].trim();
          }
          const fullTime = date !== "-" && time !== "-" ? `${date} ${time}` : date !== "-" ? date : time;
          let viewCount = null;
          const tdMatches = rowHtml.match(/<td[^>]*class="li_und"[^>]*>([\s\S]*?)<\/td>/g);
          if (tdMatches && tdMatches.length >= 1) {
            const viewStr = tdMatches[0].replace(/<[^>]*>/g, "").trim();
            if (viewStr && viewStr !== "-") {
              viewCount = parseInt(viewStr.replace(/,/g, ""), 10) || null;
            }
          }
          let reactionCount = 0;
          if (tdMatches && tdMatches.length >= 2) {
            const recStr = tdMatches[1].replace(/<[^>]*>/g, "").trim();
            if (recStr && recStr !== "-") {
              reactionCount = parseInt(recStr.replace(/,/g, ""), 10) || 0;
            }
          }
          validRows++;
          if (validRows <= 5) {
            console.log(`[HumorUniv] Row ${validRows}: title="${title}", author="${author}", time="${fullTime}", view=${viewCount}, reaction=${reactionCount}, comment=${commentCount}`);
          }
          posts.push({
            id: `humoruniv_${postId}`,
            rank: validRows,
            community: "\uC6C3\uAE34\uB300\uD559",
            externalPostId: postId,
            title,
            url,
            author,
            time: fullTime,
            viewCount,
            reactionCount,
            commentCount,
            category: "\uC2E4\uC2DC\uAC04"
          });
          startIdx = idIdx + 1;
        }
        console.log("[HumorUniv] Total rows found:", totalRows);
        console.log("[HumorUniv] Valid posts parsed:", validRows);
        if (posts.length > 0) {
          console.log("[HumorUniv] First post:", posts[0].title);
        }
        const collectedAt = (/* @__PURE__ */ new Date()).toISOString();
        console.log("[HumorUniv] New collection - collectedAt:", collectedAt);
        const sortedPosts = [...posts].sort((a, b) => {
          const sort = input?.sort || "popular";
          switch (sort) {
            case "recommend":
              return b.reactionCount - a.reactionCount;
            case "views":
              return b.viewCount - a.viewCount;
            case "comments":
              return b.commentCount - a.commentCount;
            case "popular":
            default:
              const scoreA = a.reactionCount * 2 + a.commentCount * 1.5 + a.viewCount * 0.1;
              const scoreB = b.reactionCount * 2 + b.commentCount * 1.5 + b.viewCount * 0.1;
              return scoreB - scoreA;
          }
        });
        sortedPosts.forEach((post, index) => {
          post.rank = index + 1;
        });
        global.humorunivCache = {
          [cacheKey]: {
            posts: sortedPosts,
            collectedAt,
            expiresAt: now + cacheDuration
          }
        };
        const result = {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt
        };
        return result;
      } catch (error) {
        if (timeout) clearTimeout(timeout);
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error("[HumorUniv] Exception:", errorMsg);
        if (errorMsg.includes("abort")) {
          console.error("[HumorUniv] Request timeout (10s exceeded)");
        }
        return {
          success: false,
          error: "\uC6C3\uAE34\uB300\uD559\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
          data: []
        };
      }
    })
  }),
  news: router({
    /**
     * Get latest news from RSS
     */
    getLatestNews: publicProcedure.input(z3.object({ limit: z3.number().default(20), category: z3.string().default("all") }).optional()).query(async ({ input }) => {
      try {
        const limit = input?.limit || 20;
        const category = input?.category || "all";
        console.log(`
[News] ===== RSS Fetch Start =====`);
        console.log(`[News] Frontend category: ${category}`);
        const categoryUrls = {
          "all": "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko",
          "nation": "https://news.google.com/rss/search?q=%EC%A0%95%EC%B9%98%20OR%20%EC%82%AC%ED%9A%8C&hl=ko&gl=KR&ceid=KR:ko",
          "business": "https://news.google.com/rss/search?q=%EA%B2%BD%EC%A0%9C&hl=ko&gl=KR&ceid=KR:ko",
          "technology": "https://news.google.com/rss/search?q=IT%20OR%20%EA%B8%B0%EC%88%A0&hl=ko&gl=KR&ceid=KR:ko",
          "science": "https://news.google.com/rss/search?q=%EA%B3%BC%ED%95%99&hl=ko&gl=KR&ceid=KR:ko",
          "entertainment": "https://news.google.com/rss/search?q=%EC%97%B0%EC%98%88&hl=ko&gl=KR&ceid=KR:ko",
          "sports": "https://news.google.com/rss/search?q=%EC%8A%A4%ED%8F%AC%EC%B8%A0&hl=ko&gl=KR&ceid=KR:ko",
          "health": "https://news.google.com/rss/search?q=%EA%B1%B4%EA%B0%95&hl=ko&gl=KR&ceid=KR:ko",
          "world": "https://news.google.com/rss/search?q=%EA%B5%AD%EC%A0%9C&hl=ko&gl=KR&ceid=KR:ko"
        };
        const rssUrl = categoryUrls[category] || categoryUrls["all"];
        console.log(`[News] Mapped topic URL: ${rssUrl}`);
        const response = await fetch(rssUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });
        console.log(`[News] Fetch status: ${response.status} ${response.statusText}`);
        console.log(`[News] Content-Type: ${response.headers.get("content-type")}`);
        if (!response.ok) {
          console.log(`[News] ===== RSS Fetch FAILED (HTTP ${response.status}) =====`);
          throw new Error(`RSS fetch failed: ${response.status}`);
        }
        let xml;
        try {
          xml = await response.text();
          console.log(`[News] Response body length: ${xml.length} chars`);
          console.log(`[News] First 300 chars: ${xml.substring(0, 300)}`);
        } catch (textError) {
          console.error(`[News] Error reading response text:`, textError);
          console.log(`[News] ===== RSS Fetch FAILED (Text read error) =====`);
          return [];
        }
        if (!xml || xml.length === 0) {
          console.log(`[News] ===== RSS Fetch FAILED (Empty response) =====`);
          return [];
        }
        const decodeHtmlEntities = (text2) => {
          const entities = {
            "&amp;": "&",
            "&lt;": "<",
            "&gt;": ">",
            "&quot;": '"',
            "&#39;": "'",
            "&apos;": "'"
          };
          let decoded = text2;
          for (const [entity, char] of Object.entries(entities)) {
            decoded = decoded.replace(new RegExp(entity, "g"), char);
          }
          return decoded;
        };
        const extractPublisher = (title) => {
          const match2 = title.match(/^(.+?)\s*-\s*([^-]+)$/);
          if (match2) {
            return {
              title: match2[1].trim(),
              publisher: match2[2].trim()
            };
          }
          return { title, publisher: "Google News" };
        };
        const cleanDescription = (text2) => {
          let cleaned = text2.replace(/<[^>]*>/g, "");
          cleaned = decodeHtmlEntities(cleaned);
          cleaned = cleaned.replace(/\s+/g, " ").trim();
          if (cleaned.length > 150) {
            cleaned = cleaned.substring(0, 150) + "...";
          }
          return cleaned;
        };
        console.log(`[News] Starting XML item parsing...`);
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        const items = [];
        let match;
        let itemCount = 0;
        try {
          while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
            itemCount++;
            const itemXml = match[1];
            const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
            const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
            const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
            const descriptionMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/);
            if (titleMatch && linkMatch) {
              const rawTitle = titleMatch[1].replace(/<[^>]*>/g, "").trim();
              const { title, publisher } = extractPublisher(rawTitle);
              const link = linkMatch[1].trim();
              const pubDate = pubDateMatch ? pubDateMatch[1].trim() : (/* @__PURE__ */ new Date()).toISOString();
              const rawDescription = descriptionMatch ? descriptionMatch[1] : "";
              const description = cleanDescription(rawDescription);
              items.push({
                title,
                link,
                pubDate,
                description,
                source: publisher,
                thumbnail: null
              });
            }
          }
        } catch (parseError) {
          console.error(`[News] XML parsing error:`, parseError);
          console.log(`[News] ===== RSS Fetch FAILED (Parsing error) =====`);
          return [];
        }
        console.log(`[News] Total items found in XML: ${itemCount}`);
        console.log(`[News] Items parsed successfully: ${items.length}`);
        console.log(`[News] ===== RSS Fetch SUCCESS =====`);
        return items;
      } catch (error) {
        console.error("[News] RSS fetch error:", error);
        console.log(`[News] ===== RSS Fetch FAILED (Exception) =====`);
        console.error("[News] Error details:", error instanceof Error ? error.message : String(error));
        return [];
      }
    }),
    /**
     * Search news from Naver News API
     */
    searchNews: publicProcedure.input(z3.object({
      query: z3.string().min(1).max(100),
      limit: z3.number().default(10)
    })).query(async ({ input }) => {
      try {
        const { query, limit } = input;
        const clientId = process.env.NAVER_CLIENT_ID || "";
        const clientSecret = process.env.NAVER_CLIENT_SECRET || "";
        if (!clientId || !clientSecret) {
          console.error("[News Search] Missing Naver API credentials");
          return [];
        }
        const encodedQuery = encodeURIComponent(query);
        console.log("[News Search] Input query:", query);
        const startPositions = [1, 101, 201];
        const allItems = [];
        const statusCodes = [];
        const itemCounts = [];
        for (const start of startPositions) {
          const naverUrl = `https://openapi.naver.com/v1/search/news.json?query=${encodedQuery}&display=100&start=${start}&sort=date`;
          console.log(`[News Search] Fetching page start=${start}`);
          const response = await fetch(naverUrl, {
            headers: {
              "X-Naver-Client-Id": clientId,
              "X-Naver-Client-Secret": clientSecret
            }
          });
          statusCodes.push(response.status);
          console.log(`[News Search] Page start=${start} status code:`, response.status);
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[News Search] Page start=${start} error:`, errorText);
            try {
              const errorData = JSON.parse(errorText);
              console.error(`[News Search] Page start=${start} errorCode:`, errorData.errorCode);
            } catch {
            }
            continue;
          }
          const data = await response.json();
          const pageItems = data.items || [];
          itemCounts.push(pageItems.length);
          console.log(`[News Search] Page start=${start} items count:`, pageItems.length);
          allItems.push(...pageItems);
          if (allItems.length >= 200) break;
        }
        console.log("[News Search] Total start positions called:", startPositions.length);
        console.log("[News Search] Status codes:", statusCodes.join(","));
        console.log("[News Search] Items per page:", itemCounts.join(","));
        console.log("[News Search] Total collected items:", allItems.length);
        const decodeHtmlEntities = (text2) => {
          const entities = {
            "&amp;": "&",
            "&lt;": "<",
            "&gt;": ">",
            "&quot;": '"',
            "&#39;": "'",
            "&apos;": "'"
          };
          let decoded = text2;
          for (const [entity, char] of Object.entries(entities)) {
            decoded = decoded.replace(new RegExp(entity, "g"), char);
          }
          return decoded;
        };
        const normalizeText = (text2) => {
          let normalized = text2.replace(/<[^>]*>/g, "");
          normalized = decodeHtmlEntities(normalized);
          normalized = normalized.toLowerCase();
          normalized = normalized.replace(/\s+/g, " ").trim();
          return normalized;
        };
        const cleanDescription = (text2) => {
          let cleaned = text2.replace(/<[^>]*>/g, "");
          cleaned = decodeHtmlEntities(cleaned);
          cleaned = cleaned.replace(/\s+/g, " ").trim();
          if (cleaned.length > 150) {
            cleaned = cleaned.substring(0, 150) + "...";
          }
          return cleaned;
        };
        const exclusionKeywords = [
          "\uC624\uB298\uC758 \uC6B4\uC138",
          "\uC6B4\uC138",
          "\uB760\uBCC4",
          "\uBCC4\uC790\uB9AC",
          "\uC0AC\uC8FC",
          "\uB85C\uB610",
          "\uB2F9\uCCA8\uBC88\uD638",
          "\uAD11\uACE0",
          "\uD64D\uBCF4",
          "\uC774\uBCA4\uD2B8",
          "\uCFE0\uD3F0",
          "\uD560\uC778",
          "\uD2B9\uAC00",
          "\uC1FC\uD540",
          "\uC99D\uAD8C\uAC00",
          "\uCD94\uCC9C\uC8FC",
          "\uC885\uBAA9\uCD94\uCC9C"
        ];
        const shouldExclude = (title, description, searchQuery) => {
          const normalizedQuery = normalizeText(searchQuery);
          const normalizedTitle = normalizeText(title);
          const normalizedDesc = normalizeText(description);
          for (const keyword of exclusionKeywords) {
            if (normalizedQuery.includes(normalizeText(keyword))) {
              return false;
            }
          }
          for (const keyword of exclusionKeywords) {
            const normalizedKeyword = normalizeText(keyword);
            if (normalizedTitle.includes(normalizedKeyword) || normalizedDesc.includes(normalizedKeyword)) {
              return true;
            }
          }
          return false;
        };
        const getMainKeywords = (query2) => {
          const normalized = normalizeText(query2);
          const words = normalized.split(" ").filter((w) => w.length > 0);
          return words.length > 1 ? words : [normalized];
        };
        const normalizeDomain = (hostname) => {
          let normalized = hostname.replace(/^(www\.|m\.|n\.|api\.|news\.|amp\.|mobile\.)/, "");
          normalized = normalized.toLowerCase();
          return normalized;
        };
        const extractMetaSiteName = async (urlString) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2e3);
            const response = await fetch(urlString, {
              signal: controller.signal,
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
              }
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
              console.log("[News Search] Meta fetch failed, status:", response.status);
              return null;
            }
            const html = await response.text();
            let match = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
            if (match && match[1]) {
              console.log("[News Search] Found og:site_name:", match[1]);
              return match[1];
            }
            match = html.match(/<meta\s+name=["']application-name["']\s+content=["']([^"']+)["']/i);
            if (match && match[1]) {
              console.log("[News Search] Found application-name:", match[1]);
              return match[1];
            }
            match = html.match(/<meta\s+name=["']twitter:site["']\s+content=["']([^"']+)["']/i);
            if (match && match[1]) {
              console.log("[News Search] Found twitter:site:", match[1]);
              return match[1];
            }
            match = html.match(/<title>([^<]+)<\/title>/i);
            if (match && match[1]) {
              const titleText = match[1].trim();
              const siteMatch = titleText.match(/([가-힣\w]+(?:뉴스|TV|신문|일보|경제|매체|미디어))/);
              if (siteMatch && siteMatch[1]) {
                console.log("[News Search] Extracted from title:", siteMatch[1]);
                return siteMatch[1];
              }
            }
            return null;
          } catch (error) {
            console.log("[News Search] Meta fetch error (timeout or network):", error instanceof Error ? error.message : "unknown");
            return null;
          }
        };
        const extractSourceFromUrl = async (urlString) => {
          const sourceMapping = {
            "hani.co.kr": "\uD55C\uACA8\uB808",
            "khan.co.kr": "\uACBD\uD5A5\uC2E0\uBB38",
            "yna.co.kr": "\uC5F0\uD569\uB274\uC2A4",
            "kbs.co.kr": "KBS",
            "imbc.com": "MBC",
            "sbs.co.kr": "SBS",
            "jtbc.co.kr": "JTBC",
            "chosun.com": "\uC870\uC120\uC77C\uBCF4",
            "joongang.co.kr": "\uC911\uC559\uC77C\uBCF4",
            "donga.com": "\uB3D9\uC544\uC77C\uBCF4",
            "mk.co.kr": "\uB9E4\uC77C\uACBD\uC81C",
            "hankyung.com": "\uD55C\uAD6D\uACBD\uC81C",
            "sedaily.com": "\uC11C\uC6B8\uACBD\uC81C",
            "sentv.co.kr": "\uC11C\uC6B8\uACBD\uC81CTV",
            "edaily.co.kr": "\uC774\uB370\uC77C\uB9AC",
            "newsis.com": "\uB274\uC2DC\uC2A4",
            "news1.kr": "\uB274\uC2A41",
            "zdnet.co.kr": "\uC9C0\uB514\uB137\uCF54\uB9AC\uC544",
            "etnews.com": "\uC804\uC790\uC2E0\uBB38",
            "bloter.net": "\uBE14\uB85C\uD130",
            "digitaltoday.co.kr": "\uB514\uC9C0\uD138\uD22C\uB370\uC774",
            "irobotnews.com": "\uB85C\uBD07\uC2E0\uBB38",
            "greened.kr": "\uADF8\uB9B0\uD3EC\uC2A4\uD2B8\uCF54\uB9AC\uC544",
            "gamevu.co.kr": "\uAC8C\uC784\uBDF0",
            "worktoday.co.kr": "\uC6CC\uD06C\uD22C\uB370\uC774",
            "areyou.co.kr": "\uC544\uC720\uACBD\uC81C",
            "fnnews.com": "\uD30C\uC774\uB0B8\uC15C\uB274\uC2A4",
            "seoul.co.kr": "\uC11C\uC6B8\uC2E0\uBB38",
            "ddaily.co.kr": "\uB514\uC9C0\uD138\uB370\uC77C\uB9AC",
            "hankooki.com": "\uD55C\uAD6D\uC77C\uBCF4",
            "theopiniontimes.news": "\uC624\uD53C\uB2C8\uC5B8\uD0C0\uC784\uC2A4",
            "businesskorea.co.kr": "\uBE44\uC988\uB2C8\uC2A4\uCF54\uB9AC\uC544",
            "ajunews.com": "\uC544\uC8FC\uACBD\uC81C",
            "dailymedi.com": "\uB370\uC77C\uB9AC\uBA54\uB514",
            "lawissue.co.kr": "\uB85C\uC774\uC288",
            "hansbiz.co.kr": "\uD55C\uC2A4\uACBD\uC81C",
            "hemophilia.co.kr": "\uD5E4\uBAA8\uD544\uB9AC\uC544\uB77C\uC774\uD504",
            "ikbc.co.kr": "KBC\uAD11\uC8FC\uBC29\uC1A1",
            "jeonmae.co.kr": "\uC804\uAD6D\uB9E4\uC77C\uC2E0\uBB38",
            "platum.kr": "\uD50C\uB798\uD140",
            "munhwa.com": "\uBB38\uD654\uC77C\uBCF4",
            "newspim.com": "\uB274\uC2A4\uD54C",
            "newscj.com": "\uB274\uC2A4\uC528\uC81C\uC774",
            "aitimes.kr": "AI\uD0C0\uC784\uC2A4",
            "game.donga.com": "\uB3D9\uC544\uC77C\uBCF4 \uAC8C\uC784",
            "itchosun.com": "IT\uC870\uC120",
            "dailian.co.kr": "\uB370\uC77C\uB9AC\uC548",
            "mt.co.kr": "\uBA38\uB2C8\uD22C\uB370\uC774",
            "asiae.co.kr": "\uC544\uC2DC\uC544\uACBD\uC81C",
            "kukinews.com": "\uCFE0\uD0A4\uB274\uC2A4",
            "nocutnews.co.kr": "\uB178\uCEF7\uB274\uC2A4",
            "ohmynews.com": "\uC624\uB9C8\uC774\uB274\uC2A4",
            "pressian.com": "\uD504\uB808\uC2DC\uC548"
          };
          const koreanTlds = [".co.kr", ".or.kr", ".ne.kr", ".go.kr", ".ac.kr", ".pe.kr", ".re.kr", ".asso.kr"];
          try {
            const url = new URL(urlString);
            let hostname = url.hostname;
            const normalizedHost = normalizeDomain(hostname);
            console.log("[News Search] originallink:", urlString);
            console.log("[News Search] hostname:", hostname);
            console.log("[News Search] normalizedHost:", normalizedHost);
            if (sourceMapping[normalizedHost]) {
              console.log("[News Search] sourceMapping result:", sourceMapping[normalizedHost]);
              return sourceMapping[normalizedHost];
            }
            const metaSiteName = await extractMetaSiteName(urlString);
            if (metaSiteName) {
              console.log("[News Search] meta site_name result:", metaSiteName);
              return metaSiteName;
            }
            let domainName = normalizedHost;
            for (const tld of koreanTlds) {
              if (normalizedHost.endsWith(tld)) {
                domainName = normalizedHost.substring(0, normalizedHost.length - tld.length);
                console.log("[News Search] Korean TLD detected, extracted domain:", domainName);
                break;
              }
            }
            if (domainName === normalizedHost) {
              const parts = normalizedHost.split(".");
              if (parts.length >= 2) {
                domainName = parts[parts.length - 2];
                console.log("[News Search] Standard TLD, extracted domain:", domainName);
              }
            }
            const invalidNames = ["co", "or", "ne", "go", "ac", "pe", "re", "com", "net", "org", "kr", "io", "tv"];
            if (invalidNames.includes(domainName.toLowerCase()) || domainName.length < 2) {
              console.log("[News Search] Invalid domain name, fallback result: \uCD9C\uCC98 \uD655\uC778\uC911");
              return "\uCD9C\uCC98 \uD655\uC778\uC911";
            }
            const capitalizedName = domainName.charAt(0).toUpperCase() + domainName.slice(1);
            console.log("[News Search] fallback result:", capitalizedName);
            return capitalizedName;
          } catch (e) {
            console.error("[News Search] Source extraction error:", e);
            return "\uCD9C\uCC98 \uD655\uC778\uC911";
          }
        };
        const isTitleMatch = (title, searchQuery) => {
          const normalizedQuery = normalizeText(searchQuery);
          const normalizedTitle = normalizeText(title);
          const mainKeywords = getMainKeywords(searchQuery);
          for (const keyword of mainKeywords) {
            if (normalizedTitle.includes(keyword)) {
              return true;
            }
          }
          return normalizedTitle.includes(normalizedQuery);
        };
        const items = await Promise.all(allItems.map(async (item) => {
          const cleanTitle = item.title.replace(/<[^>]*>/g, "");
          const decodedTitle = decodeHtmlEntities(cleanTitle);
          const description = cleanDescription(item.description);
          const link = item.originallink || item.link;
          const source = await extractSourceFromUrl(link);
          const isTitleMatched = isTitleMatch(decodedTitle, query);
          const isExcluded = shouldExclude(decodedTitle, description, query);
          return {
            title: decodedTitle,
            link,
            publishedAt: item.pubDate,
            description,
            source,
            thumbnail: null,
            isTitleMatched,
            isExcluded
          };
        }));
        const seenLinks = /* @__PURE__ */ new Set();
        const uniqueItems = items.filter((item) => {
          if (seenLinks.has(item.link)) {
            return false;
          }
          seenLinks.add(item.link);
          return true;
        });
        console.log("[News Search] Items after duplicate removal:", uniqueItems.length);
        const relevantItems = uniqueItems.filter((item) => !item.isExcluded && item.isTitleMatched);
        console.log("[News Search] Total items after all processing:", uniqueItems.length);
        console.log("[News Search] Excluded items:", uniqueItems.filter((i) => i.isExcluded).length);
        console.log("[News Search] Title-matched items:", relevantItems.length);
        let finalItems = relevantItems;
        if (relevantItems.length === 0) {
          console.log(`[News Search] No title matches found for query: "${query}"`);
          finalItems = [];
        }
        const limitedItems = finalItems.slice(0, 20);
        console.log("[News Search] Final items count:", limitedItems.length);
        console.log("[News Search] ===== Search SUCCESS =====");
        return limitedItems.map(({ isTitleMatched, isExcluded, ...item }) => item);
      } catch (error) {
        console.error("[News Search] Error:", error);
        return [];
      }
    })
  })
});

// server/vercel-trpc.ts
var app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use((req, _res, next) => {
  req.url = req.url.replace(/^\/api\/trpc\/?/, "/");
  next();
});
app.use(
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);
function handler(req, res) {
  return app(req, res);
}
export {
  handler as default
};
