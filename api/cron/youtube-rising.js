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
var DISCOVERY_STOP_WORDS = /* @__PURE__ */ new Set([
  "official",
  "video",
  "music",
  "shorts",
  "short",
  "live",
  "full",
  "episode",
  "trailer",
  "the",
  "and",
  "with",
  "from",
  "this",
  "that",
  "you",
  "new",
  "2026",
  "\uACF5\uC2DD",
  "\uC601\uC0C1",
  "\uBBA4\uC9C1\uBE44\uB514\uC624",
  "\uB77C\uC774\uBE0C",
  "\uD558\uC774\uB77C\uC774\uD2B8",
  "\uC608\uACE0\uD3B8",
  "\uB2E4\uC2DC\uBCF4\uAE30",
  "\uC624\uB298"
]);
function extractDiscoveryQuery(items) {
  const frequencies = /* @__PURE__ */ new Map();
  for (const item of items) {
    const title = String(item.snippet?.title || "").toLowerCase();
    const tokens = title.split(/[\s|/()[\]{}.,!?;:"'`~…·•<>+=_-]+/).filter(Boolean);
    for (const rawToken of tokens) {
      const token = rawToken.replace(/^#+/, "").trim();
      if (token.length < 2 || token.length > 24 || /^\d+$/.test(token) || DISCOVERY_STOP_WORDS.has(token)) continue;
      frequencies.set(token, (frequencies.get(token) || 0) + 1);
    }
  }
  return Array.from(frequencies.entries()).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).map(([token]) => token)[0] || "";
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
async function fetchEmergingChannelUploads(regionCode, apiKey) {
  if (!supabaseAdmin) return [];
  const { data: regionRows, error: regionError } = await supabaseAdmin.from("youtube_rising_video_regions").select("video_id").eq("region_code", regionCode).limit(600);
  if (regionError || !regionRows?.length) return [];
  const linkedChannelIds = /* @__PURE__ */ new Set();
  for (const videoIdBatch of chunks(regionRows.map((row) => row.video_id), 200)) {
    const { data: videoRows, error: videoError } = await supabaseAdmin.from("youtube_rising_videos").select("channel_id").in("video_id", videoIdBatch);
    if (videoError) continue;
    for (const row of videoRows || []) linkedChannelIds.add(row.channel_id);
  }
  if (linkedChannelIds.size === 0) return [];
  const emergingChannels = [];
  for (const channelIdBatch of chunks(Array.from(linkedChannelIds), 200)) {
    const { data: channelRows, error: channelError } = await supabaseAdmin.from("youtube_rising_channels").select("channel_id,updated_at").in("channel_id", channelIdBatch).eq("hidden_subscribers", false).gte("subscriber_count", 1e3).lt("subscriber_count", 1e5);
    if (channelError) continue;
    emergingChannels.push(...channelRows || []);
  }
  const seedChannelIds = emergingChannels.sort((a, b) => {
    const aUpdatedAt = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bUpdatedAt = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return aUpdatedAt - bUpdatedAt;
  }).slice(0, 12).map((channel) => channel.channel_id);
  if (seedChannelIds.length === 0) return [];
  const channelDetails = await fetchYouTube("channels", {
    part: "contentDetails",
    id: seedChannelIds.join(",")
  }, apiKey);
  const uploadPlaylists = (channelDetails.items || []).map(
    (channel) => channel.contentDetails?.relatedPlaylists?.uploads
  ).filter(Boolean);
  const uploadResponses = await Promise.all(uploadPlaylists.map(
    (playlistId) => fetchYouTube("playlistItems", {
      part: "contentDetails",
      playlistId,
      maxResults: "3"
    }, apiKey)
  ));
  const uploadVideoIds = /* @__PURE__ */ new Set();
  for (const uploads of uploadResponses) {
    for (const item of uploads.items || []) {
      if (item.contentDetails?.videoId) uploadVideoIds.add(item.contentDetails.videoId);
    }
  }
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1e3;
  const uploadVideos = [];
  for (const videoIdBatch of chunks(Array.from(uploadVideoIds), 50)) {
    const details = await fetchYouTube("videos", {
      part: "snippet,statistics,contentDetails",
      id: videoIdBatch.join(",")
    }, apiKey);
    uploadVideos.push(...(details.items || []).filter(
      (item) => new Date(item.snippet?.publishedAt || 0).getTime() >= recentCutoff
    ));
  }
  return uploadVideos;
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
  const collectionSlot = Math.floor(Date.now() / 18e5);
  const hourlySlot = Math.floor(collectionSlot / 2);
  const searchRegion = regions[hourlySlot % regions.length];
  const discoveryCategories = ["1", "2", "10", "15", "17", "19", "20", "22", "23", "24", "25", "26", "27", "28"];
  const discoveryCategory = discoveryCategories[hourlySlot % discoveryCategories.length];
  const shouldDiscover = collectionSlot % 2 === 0;
  const regionalPopularVideos = Array.from(videoById.values()).filter((item) => regionLinks.get(item.id)?.has(searchRegion));
  const discoveryQuery = extractDiscoveryQuery(regionalPopularVideos);
  const discoveryModes = shouldDiscover ? [
    { order: "date", lookbackHours: 6 },
    discoveryQuery ? { order: "relevance", query: discoveryQuery, videoCategoryId: discoveryCategory, lookbackHours: 24 } : { order: "viewCount", videoCategoryId: discoveryCategory, lookbackHours: 24 }
  ] : [];
  const discoveredIds = /* @__PURE__ */ new Set();
  for (const mode of discoveryModes) {
    const discoveryParams = {
      part: "snippet",
      type: "video",
      regionCode: searchRegion,
      publishedAfter: new Date(Date.now() - mode.lookbackHours * 60 * 60 * 1e3).toISOString(),
      order: mode.order,
      maxResults: "50"
    };
    if (mode.query) discoveryParams.q = mode.query;
    if (mode.videoCategoryId) discoveryParams.videoCategoryId = mode.videoCategoryId;
    const recentSearch = await fetchYouTube("search", discoveryParams, apiKey);
    for (const item of recentSearch.items || []) {
      if (item.id?.videoId) discoveredIds.add(item.id.videoId);
    }
  }
  if (shouldDiscover) {
    try {
      const emergingUploads = await fetchEmergingChannelUploads(searchRegion, apiKey);
      for (const item of emergingUploads) {
        videoById.set(item.id, item);
        const linkedRegions = regionLinks.get(item.id) || /* @__PURE__ */ new Set();
        linkedRegions.add(searchRegion);
        regionLinks.set(item.id, linkedRegions);
      }
    } catch (error) {
      console.error("[YouTube Rising] Emerging channel upload discovery failed:", error);
    }
  }
  for (const idBatch of chunks(Array.from(discoveredIds), 50)) {
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
    tags: Array.isArray(item.snippet.tags) ? item.snippet.tags.slice(0, 20) : [],
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
    discoveryModes,
    discoveryCategory,
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
