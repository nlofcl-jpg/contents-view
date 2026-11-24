// server/newsMedia.ts
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient as createClient2 } from "@supabase/supabase-js";
import { z } from "zod";

// shared/issueDocument.ts
var ISSUE_DOCUMENT_PREFIX = "<!--contents-view-editor:v1-->";
function readIssueDocument(value) {
  if (!value.startsWith(ISSUE_DOCUMENT_PREFIX)) return null;
  try {
    const doc = JSON.parse(value.slice(ISSUE_DOCUMENT_PREFIX.length));
    const valid = (node, depth = 0) => {
      if (!node || typeof node !== "object" || depth > 100) return false;
      const item = node;
      return typeof item.type === "string" && (item.text === void 0 || typeof item.text === "string") && (item.content === void 0 || Array.isArray(item.content) && item.content.every((child) => valid(child, depth + 1))) && (item.marks === void 0 || Array.isArray(item.marks) && item.marks.every((mark) => mark && typeof mark.type === "string"));
    };
    return doc?.type === "doc" && Array.isArray(doc.content) && valid(doc) ? doc : null;
  } catch {
    return null;
  }
}
function safeIssueUrl(value) {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
  }
}
function issueBodyImages(value) {
  const urls = /* @__PURE__ */ new Set();
  const visit = (node) => {
    const src = node.type === "image" && safeIssueUrl(node.attrs?.src);
    if (src) urls.add(src);
    node.content?.forEach(visit);
  };
  const doc = readIssueDocument(value);
  if (doc) visit(doc);
  return Array.from(urls);
}

// shared/newsMedia.ts
var NEWS_IMAGE_LIMIT = 5 * 1024 * 1024;
var NEWS_ATTACHMENT_LIMIT = 25 * 1024 * 1024;
var NEWS_MEDIA_ENDPOINT = "/api/news-media";
var DEFAULT_NEWS_MEDIA_ORIGIN = "https://contents-view-chi.vercel.app";
var newsImageMime = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
var newsAttachmentMime = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  pdf: "application/pdf",
  txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
};
function newsMediaMime(kind, extension) {
  const types = kind === "images" ? newsImageMime : newsAttachmentMime;
  return Object.prototype.hasOwnProperty.call(types, extension) ? types[extension] : void 0;
}
function parseNewsMediaKey(value) {
  if (typeof value !== "string") return null;
  const match = /^r2\/(images|attachments)\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\.([a-z0-9]+)$/.exec(value);
  if (!match) return null;
  const kind = match[1];
  const contentType = newsMediaMime(kind, match[3]);
  return contentType ? { key: value, kind, contentType } : null;
}
function newsMediaHref(key) {
  return `${NEWS_MEDIA_ENDPOINT}?key=${encodeURIComponent(key)}`;
}
function newsImageKeyFromUrl(value) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.pathname !== NEWS_MEDIA_ENDPOINT) return null;
    const media = parseNewsMediaKey(url.searchParams.get("key"));
    return media?.kind === "images" ? media.key : null;
  } catch {
    return null;
  }
}

// shared/const.ts
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var SUPABASE_ACCESS_TOKEN_COOKIE = "contents_view_supabase_access_token";

// server/_core/env.ts
function normalizeSupabaseProjectUrl(value) {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  supabaseUrl: normalizeSupabaseProjectUrl(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  ),
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
};

// server/_core/supabase.ts
import { createClient } from "@supabase/supabase-js";
var supabaseAuthKey = ENV.supabaseAnonKey || ENV.supabaseServiceRoleKey;
var supabaseProfileKey = ENV.supabaseServiceRoleKey || ENV.supabaseAnonKey;
var supabaseAuthClient = ENV.supabaseUrl && supabaseAuthKey ? createClient(ENV.supabaseUrl, supabaseAuthKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
}) : null;
var supabaseProfileClient = ENV.supabaseUrl && supabaseProfileKey ? createClient(ENV.supabaseUrl, supabaseProfileKey, {
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
function normalizeApprovalStatus(value) {
  return value === "pending" || value === "rejected" ? value : "approved";
}
async function getSupabaseProfile(userId) {
  if (!supabaseProfileClient) return null;
  const { data } = await supabaseProfileClient.from("profiles").select("name,email,avatar_url,role,approval_status").eq("id", userId).maybeSingle();
  return data ?? null;
}
async function mapSupabaseUser(user) {
  const profile = await getSupabaseProfile(user.id);
  const metadata = user.user_metadata ?? {};
  const name = profile?.name || (typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : user.email ?? null);
  return {
    id: 0,
    openId: user.id,
    name,
    email: profile?.email ?? user.email ?? null,
    loginMethod: "supabase",
    role: profile?.role === "admin" ? "admin" : "user",
    approvalStatus: normalizeApprovalStatus(profile?.approval_status),
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

// server/newsMedia.ts
var uploadInput = z.object({
  action: z.literal("upload"),
  kind: z.enum(["images", "attachments"]),
  extension: z.string().regex(/^[a-z0-9]+$/).max(5),
  bytes: z.number().int().positive().max(NEWS_ATTACHMENT_LIMIT)
});
var deleteInput = z.object({ action: z.literal("delete"), keys: z.array(z.string().max(90)).min(1).max(50) });
var input = z.discriminatedUnion("action", [uploadInput, deleteInput]);
var supabase = ENV.supabaseUrl && ENV.supabaseServiceRoleKey ? createClient2(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
}) : null;
function getStorage() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_NEWS_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !/^[a-f0-9]{32}$/i.test(R2_ACCOUNT_ID) || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_NEWS_BUCKET) return null;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED"
  });
  return { client, bucket: R2_NEWS_BUCKET };
}
async function isAdmin(req) {
  const cookie = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SUPABASE_ACCESS_TOKEN_COOKIE}=`));
  const token = cookie?.slice(SUPABASE_ACCESS_TOKEN_COOKIE.length + 1);
  const bearer = req.headers.authorization ?? (token ? `Bearer ${decodeURIComponent(token)}` : void 0);
  return (await authenticateSupabaseBearer(bearer))?.role === "admin";
}
async function findNewsMediaReference(key, publishedOnly) {
  if (!supabase) throw new Error("News database unavailable");
  const media = parseNewsMediaKey(key);
  if (!media) return null;
  for (const table of ["issues", "news_clips"]) {
    const source = supabase.from(table);
    if (media.kind === "attachments") {
      let request2 = source.select("attachment_name").eq("attachment_path", key);
      if (publishedOnly) request2 = request2.eq("is_published", true);
      const { data: data2, error: error2 } = await request2.limit(1).maybeSingle();
      if (error2) throw error2;
      if (data2) return { name: typeof data2.attachment_name === "string" ? data2.attachment_name : null };
      continue;
    }
    const id = key.split("/").pop().split(".")[0];
    let request = source.select("thumbnail_url,summary").or(`thumbnail_url.like.*${id}*,summary.like.*${id}*`);
    if (publishedOnly) request = request.eq("is_published", true);
    const { data, error } = await request;
    if (error) throw error;
    if (data.some((row) => [row.thumbnail_url, ...issueBodyImages(row.summary)].some((url) => url && newsImageKeyFromUrl(url) === key))) return { name: null };
  }
  return null;
}
function safeDownloadName(name) {
  return encodeURIComponent(name.slice(0, 255)).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}
async function newsMediaHandler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST") {
    res.setHeader("Allow", "GET, HEAD, POST");
    return res.status(405).json({ error: "\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uC694\uCCAD\uC785\uB2C8\uB2E4." });
  }
  try {
    if (req.method === "POST" && !await isAdmin(req)) return res.status(403).json({ error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." });
    const storage = getStorage();
    if (!storage || !supabase) return res.status(503).json({ error: "Cloudflare R2 \uC800\uC7A5\uC18C\uAC00 \uC544\uC9C1 \uC5F0\uACB0\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." });
    const { client, bucket: Bucket } = storage;
    if (req.method === "GET" || req.method === "HEAD") {
      const media = parseNewsMediaKey(req.query.key);
      if (!media) return res.status(404).end();
      const reference = await findNewsMediaReference(media.key, true);
      if (!reference && (media.kind !== "images" || !await isAdmin(req))) return res.status(404).end();
      const inline = /^(image|video|audio)\//.test(media.contentType);
      const download = inline && req.query.download !== "1" ? void 0 : `attachment; filename*=UTF-8''${safeDownloadName(reference?.name ?? media.key.split("/").pop())}`;
      const command = req.method === "HEAD" ? new HeadObjectCommand({ Bucket, Key: media.key }) : new GetObjectCommand({ Bucket, Key: media.key, ResponseContentDisposition: download });
      const signed = await getSignedUrl(client, command, { expiresIn: 900 });
      return res.redirect(302, signed);
    }
    const parsed = input.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "\uC798\uBABB\uB41C \uD30C\uC77C \uC694\uCCAD\uC785\uB2C8\uB2E4." });
    if (parsed.data.action === "delete") {
      const keys = Array.from(new Set(parsed.data.keys));
      if (keys.some((key) => !parseNewsMediaKey(key))) return res.status(400).json({ error: "\uC798\uBABB\uB41C \uD30C\uC77C \uACBD\uB85C\uC785\uB2C8\uB2E4." });
      for (const Key2 of keys) {
        if (!await findNewsMediaReference(Key2, false)) await client.send(new DeleteObjectCommand({ Bucket, Key: Key2 }));
      }
      return res.json({ success: true });
    }
    const { kind, extension, bytes } = parsed.data;
    const ContentType = newsMediaMime(kind, extension);
    if (!ContentType || bytes > (kind === "images" ? NEWS_IMAGE_LIMIT : NEWS_ATTACHMENT_LIMIT)) {
      return res.status(400).json({ error: "\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uD30C\uC77C \uD615\uC2DD \uB610\uB294 \uD06C\uAE30\uC785\uB2C8\uB2E4." });
    }
    const Key = `r2/${kind}/${randomUUID()}.${extension}`;
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket, Key, ContentType, ContentLength: bytes }), {
      expiresIn: 300,
      signableHeaders: /* @__PURE__ */ new Set(["content-type", "content-length"])
    });
    const mediaUrl = new URL(newsMediaHref(Key), process.env.NEWS_MEDIA_SITE_ORIGIN || DEFAULT_NEWS_MEDIA_ORIGIN).href;
    return res.json({ key: Key, uploadUrl, mediaUrl });
  } catch (error) {
    console.error("[News media] Request failed", error instanceof Error ? error.name : "unknown");
    return res.status(502).json({ error: "\uBBF8\uB514\uC5B4 \uC800\uC7A5\uC18C\uC5D0 \uC5F0\uACB0\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4." });
  }
}
export {
  newsMediaHandler as default,
  findNewsMediaReference
};
