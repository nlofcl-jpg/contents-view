import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";
import type { Request, Response } from "express";
import { z } from "zod";
import { issueBodyImages } from "../shared/issueDocument";
import {
  DEFAULT_NEWS_MEDIA_ORIGIN, NEWS_ATTACHMENT_LIMIT, NEWS_IMAGE_LIMIT,
  newsImageKeyFromUrl, newsMediaHref, newsMediaMime, parseNewsMediaKey,
} from "../shared/newsMedia";
import { SUPABASE_ACCESS_TOKEN_COOKIE } from "../shared/const";
import { ENV } from "./_core/env";
import { authenticateSupabaseBearer } from "./_core/supabase";

const uploadInput = z.object({
  action: z.literal("upload"),
  kind: z.enum(["images", "attachments"]),
  extension: z.string().regex(/^[a-z0-9]+$/).max(5),
  bytes: z.number().int().positive().max(NEWS_ATTACHMENT_LIMIT),
});
const deleteInput = z.object({ action: z.literal("delete"), keys: z.array(z.string().max(90)).min(1).max(50) });
const input = z.discriminatedUnion("action", [uploadInput, deleteInput]);
const supabase = ENV.supabaseUrl && ENV.supabaseServiceRoleKey ? createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;

function getStorage() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_NEWS_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !/^[a-f0-9]{32}$/i.test(R2_ACCOUNT_ID) || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_NEWS_BUCKET) return null;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return { client, bucket: R2_NEWS_BUCKET };
}

async function isAdmin(req: Request) {
  const cookie = req.headers.cookie?.split(";").map(part => part.trim())
    .find(part => part.startsWith(`${SUPABASE_ACCESS_TOKEN_COOKIE}=`));
  const token = cookie?.slice(SUPABASE_ACCESS_TOKEN_COOKIE.length + 1);
  const bearer = req.headers.authorization ?? (token ? `Bearer ${decodeURIComponent(token)}` : undefined);
  return (await authenticateSupabaseBearer(bearer))?.role === "admin";
}

export async function findNewsMediaReference(key: string, publishedOnly: boolean) {
  if (!supabase) throw new Error("News database unavailable");
  const media = parseNewsMediaKey(key);
  if (!media) return null;
  for (const table of ["issues", "news_clips"]) {
    const source = supabase.from(table);
    if (media.kind === "attachments") {
      let request = source.select("attachment_name").eq("attachment_path", key);
      if (publishedOnly) request = request.eq("is_published", true);
      const { data, error } = await request.limit(1).maybeSingle();
      if (error) throw error;
      if (data) return { name: typeof data.attachment_name === "string" ? data.attachment_name : null };
      continue;
    }
    // Match the UUID first, then verify that the stored URL names this exact image object.
    const id = key.split("/").pop()!.split(".")[0];
    let request = source.select("thumbnail_url,summary").or(`thumbnail_url.like.*${id}*,summary.like.*${id}*`);
    if (publishedOnly) request = request.eq("is_published", true);
    const { data, error } = await request;
    if (error) throw error;
    if (data.some(row => [row.thumbnail_url, ...issueBodyImages(row.summary)].some(url => url && newsImageKeyFromUrl(url) === key))) return { name: null };
  }
  return null;
}

function safeDownloadName(name: string) {
  return encodeURIComponent(name.slice(0, 255)).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

export default async function newsMediaHandler(req: Request, res: Response) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST") {
    res.setHeader("Allow", "GET, HEAD, POST");
    return res.status(405).json({ error: "지원하지 않는 요청입니다." });
  }
  try {
    if (req.method === "POST" && !await isAdmin(req)) return res.status(403).json({ error: "관리자 권한이 필요합니다." });
    const storage = getStorage();
    if (!storage || !supabase) return res.status(503).json({ error: "Cloudflare R2 저장소가 아직 연결되지 않았습니다." });
    const { client, bucket: Bucket } = storage;

    if (req.method === "GET" || req.method === "HEAD") {
      const media = parseNewsMediaKey(req.query.key);
      if (!media) return res.status(404).end();
      const reference = await findNewsMediaReference(media.key, true);
      if (!reference && (media.kind !== "images" || !await isAdmin(req))) return res.status(404).end();
      const inline = /^(image|video|audio)\//.test(media.contentType);
      const download = inline && req.query.download !== "1" ? undefined :
        `attachment; filename*=UTF-8''${safeDownloadName(reference?.name ?? media.key.split("/").pop()!)}`;
      const command = req.method === "HEAD" ? new HeadObjectCommand({ Bucket, Key: media.key })
        : new GetObjectCommand({ Bucket, Key: media.key, ResponseContentDisposition: download });
      const signed = await getSignedUrl(client, command, { expiresIn: 900 });
      return res.redirect(302, signed);
    }

    const parsed = input.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "잘못된 파일 요청입니다." });
    if (parsed.data.action === "delete") {
      const keys = Array.from(new Set(parsed.data.keys));
      if (keys.some(key => !parseNewsMediaKey(key))) return res.status(400).json({ error: "잘못된 파일 경로입니다." });
      for (const Key of keys) {
        if (!await findNewsMediaReference(Key, false)) await client.send(new DeleteObjectCommand({ Bucket, Key }));
      }
      return res.json({ success: true });
    }

    const { kind, extension, bytes } = parsed.data;
    const ContentType = newsMediaMime(kind, extension);
    if (!ContentType || bytes > (kind === "images" ? NEWS_IMAGE_LIMIT : NEWS_ATTACHMENT_LIMIT)) {
      return res.status(400).json({ error: "지원하지 않는 파일 형식 또는 크기입니다." });
    }
    const Key = `r2/${kind}/${randomUUID()}.${extension}`;
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket, Key, ContentType, ContentLength: bytes }), {
      expiresIn: 300,
      signableHeaders: new Set(["content-type", "content-length"]),
    });
    const mediaUrl = new URL(newsMediaHref(Key), process.env.NEWS_MEDIA_SITE_ORIGIN || DEFAULT_NEWS_MEDIA_ORIGIN).href;
    return res.json({ key: Key, uploadUrl, mediaUrl });
  } catch (error) {
    console.error("[News media] Request failed", error instanceof Error ? error.name : "unknown");
    return res.status(502).json({ error: "미디어 저장소에 연결하지 못했습니다." });
  }
}
