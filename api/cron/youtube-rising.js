// server/youtubeRising.ts
import { createClient } from "@supabase/supabase-js";

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

// server/youtubeRising.ts
var supabaseAdmin = ENV.supabaseUrl && ENV.supabaseServiceRoleKey ? createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
}) : null;
function isYouTubeTopicChannel(channelTitle) {
  return /\s[-–—]\s*topic$/i.test(channelTitle?.trim() || "");
}
function parseDurationSeconds(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}
function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}
async function fetchYouTube(path, params, apiKey) {
  const searchParams = new URLSearchParams({ ...params, key: apiKey });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${searchParams.toString()}`);
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || `YouTube ${path} request failed`);
  }
  return body;
}
async function collectYouTubeRisingSnapshots() {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is not configured");
  if (!supabaseAdmin) throw new Error("Supabase service configuration is missing");
  const configuredRegions = (process.env.YOUTUBE_RISING_REGIONS || "KR,US,JP").split(",").map((value) => value.trim().toUpperCase()).filter((value) => /^[A-Z]{2}$/.test(value));
  const regions = configuredRegions.length > 0 ? configuredRegions : ["KR"];
  const videoById = /* @__PURE__ */ new Map();
  const regionLinks = /* @__PURE__ */ new Map();
  for (const regionCode of regions) {
    const popular = await fetchYouTube("videos", {
      part: "snippet,statistics,contentDetails",
      chart: "mostPopular",
      regionCode,
      maxResults: "50"
    }, apiKey);
    for (const item of popular.items || []) {
      videoById.set(item.id, item);
      const linkedRegions = regionLinks.get(item.id) || /* @__PURE__ */ new Set();
      linkedRegions.add(regionCode);
      regionLinks.set(item.id, linkedRegions);
    }
  }
  const searchRegion = regions[Math.floor(Date.now() / 18e5) % regions.length];
  const recentSearch = await fetchYouTube("search", {
    part: "snippet",
    type: "video",
    regionCode: searchRegion,
    publishedAfter: new Date(Date.now() - 6 * 60 * 60 * 1e3).toISOString(),
    order: "viewCount",
    maxResults: "50"
  }, apiKey);
  const discoveredIds = (recentSearch.items || []).map((item) => item.id?.videoId).filter(Boolean);
  for (const idBatch of chunks(discoveredIds, 50)) {
    const details = await fetchYouTube("videos", {
      part: "snippet,statistics,contentDetails",
      id: idBatch.join(",")
    }, apiKey);
    for (const item of details.items || []) {
      videoById.set(item.id, item);
      const linkedRegions = regionLinks.get(item.id) || /* @__PURE__ */ new Set();
      linkedRegions.add(searchRegion);
      regionLinks.set(item.id, linkedRegions);
    }
  }
  const trackingCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString();
  const { data: trackedVideos, error: trackedVideosError } = await supabaseAdmin.from("youtube_rising_videos").select("video_id").gte("published_at", trackingCutoff).limit(5e3);
  if (trackedVideosError) throw trackedVideosError;
  const trackedVideoIds = (trackedVideos || []).map((row) => row.video_id);
  if (trackedVideoIds.length > 0) {
    const { data: trackedRegions, error: trackedRegionsError } = await supabaseAdmin.from("youtube_rising_video_regions").select("video_id,region_code").in("region_code", regions).limit(1e4);
    if (trackedRegionsError) throw trackedRegionsError;
    for (const row of trackedRegions || []) {
      const linkedRegions = regionLinks.get(row.video_id) || /* @__PURE__ */ new Set();
      linkedRegions.add(row.region_code);
      regionLinks.set(row.video_id, linkedRegions);
    }
  }
  const missingTrackedIds = trackedVideoIds.filter((videoId) => !videoById.has(videoId));
  for (const idBatch of chunks(missingTrackedIds, 50)) {
    const details = await fetchYouTube("videos", {
      part: "snippet,statistics,contentDetails",
      id: idBatch.join(",")
    }, apiKey);
    for (const item of details.items || []) videoById.set(item.id, item);
  }
  const videos = Array.from(videoById.values());
  const channelIds = Array.from(new Set(videos.map((item) => item.snippet?.channelId).filter(Boolean)));
  const channelById = /* @__PURE__ */ new Map();
  for (const channelBatch of chunks(channelIds, 50)) {
    const channelData = await fetchYouTube("channels", {
      part: "snippet,statistics",
      id: channelBatch.join(",")
    }, apiKey);
    for (const channel of channelData.items || []) channelById.set(channel.id, channel);
  }
  const capturedAt = (/* @__PURE__ */ new Date()).toISOString();
  const channelRows = Array.from(channelById.values()).filter((channel) => !isYouTubeTopicChannel(channel.snippet?.title)).map((channel) => ({
    channel_id: channel.id,
    title: channel.snippet?.title || "",
    thumbnail_url: channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url || null,
    subscriber_count: Number(channel.statistics?.subscriberCount || 0),
    hidden_subscribers: Boolean(channel.statistics?.hiddenSubscriberCount),
    country: channel.snippet?.country || null,
    updated_at: capturedAt
  }));
  if (channelRows.length > 0) {
    const { error } = await supabaseAdmin.from("youtube_rising_channels").upsert(channelRows, { onConflict: "channel_id" });
    if (error) throw error;
  }
  const eligibleVideos = videos.filter((item) => {
    const channel = channelById.get(item.snippet?.channelId);
    return channel && !isYouTubeTopicChannel(channel.snippet?.title);
  });
  const videoRows = eligibleVideos.map((item) => ({
    video_id: item.id,
    channel_id: item.snippet.channelId,
    title: item.snippet.title,
    description: item.snippet.description || null,
    thumbnail_url: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || null,
    category_id: Number(item.snippet.categoryId || 0),
    published_at: item.snippet.publishedAt,
    duration_seconds: parseDurationSeconds(item.contentDetails?.duration || "PT0S"),
    updated_at: capturedAt
  }));
  if (videoRows.length > 0) {
    const { error } = await supabaseAdmin.from("youtube_rising_videos").upsert(videoRows, { onConflict: "video_id" });
    if (error) throw error;
  }
  const regionRows = eligibleVideos.flatMap(
    (item) => Array.from(regionLinks.get(item.id) || []).map((regionCode) => ({
      video_id: item.id,
      region_code: regionCode,
      discovered_at: capturedAt
    }))
  );
  if (regionRows.length > 0) {
    const { error } = await supabaseAdmin.from("youtube_rising_video_regions").upsert(regionRows, { onConflict: "video_id,region_code" });
    if (error) throw error;
  }
  const snapshotRows = eligibleVideos.map((item) => ({
    video_id: item.id,
    captured_at: capturedAt,
    view_count: Number(item.statistics?.viewCount || 0),
    like_count: Number(item.statistics?.likeCount || 0),
    comment_count: Number(item.statistics?.commentCount || 0)
  }));
  if (snapshotRows.length > 0) {
    const { error } = await supabaseAdmin.from("youtube_rising_snapshots").insert(snapshotRows);
    if (error) throw error;
  }
  await supabaseAdmin.from("youtube_rising_snapshots").delete().lt("captured_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1e3).toISOString());
  return {
    regions,
    searchedRegion: searchRegion,
    videoCount: eligibleVideos.length,
    snapshotCount: snapshotRows.length,
    capturedAt
  };
}

// server/vercel-youtube-rising-cron.ts
function getHeaderValue(value) {
  return Array.isArray(value) ? value[0] : value;
}
async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  const cronSecret = process.env.CRON_SECRET;
  const authorization = getHeaderValue(req.headers?.authorization);
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }
  try {
    const result = await collectYouTubeRisingSnapshots();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("[YouTube rising collector] Collection failed", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Collection failed"
    });
  }
}
export {
  handler as default
};
