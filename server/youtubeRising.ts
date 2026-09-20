import { createClient } from "@supabase/supabase-js";
import { ENV } from "./_core/env";

type RisingPeriod = "realtime" | "1h" | "6h" | "24h";
type SubscriberRange = "all" | "lt10k" | "10k-100k" | "100k-1m" | "gt1m";
type RisingSort = "score" | "hourly" | "outlier" | "newest";

type StoredRisingInput = {
  regionCode: string;
  videoCategoryId?: number;
  period: RisingPeriod;
  subscriberRange: SubscriberRange;
  sortBy: RisingSort;
  maxResults: number;
};

const supabaseAdmin =
  ENV.supabaseUrl && ENV.supabaseServiceRoleKey
    ? createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const periodHours: Record<RisingPeriod, number> = {
  realtime: 0.5,
  "1h": 1,
  "6h": 6,
  "24h": 24,
};

function parseDurationSeconds(duration: string) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function toIsoDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${remaining || (!hours && !minutes) ? `${remaining}S` : ""}`;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

async function fetchYouTube(path: string, params: Record<string, string>, apiKey: string) {
  const searchParams = new URLSearchParams({ ...params, key: apiKey });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${searchParams.toString()}`);
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || `YouTube ${path} request failed`);
  }
  return body;
}

export async function collectYouTubeRisingSnapshots() {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is not configured");
  if (!supabaseAdmin) throw new Error("Supabase service configuration is missing");

  const configuredRegions = (process.env.YOUTUBE_RISING_REGIONS || "KR,US,JP")
    .split(",")
    .map(value => value.trim().toUpperCase())
    .filter(value => /^[A-Z]{2}$/.test(value));
  const regions = configuredRegions.length > 0 ? configuredRegions : ["KR"];
  const videoById = new Map<string, any>();
  const regionLinks = new Map<string, Set<string>>();

  for (const regionCode of regions) {
    const popular = await fetchYouTube("videos", {
      part: "snippet,statistics,contentDetails",
      chart: "mostPopular",
      regionCode,
      maxResults: "50",
    }, apiKey);
    for (const item of popular.items || []) {
      videoById.set(item.id, item);
      const linkedRegions = regionLinks.get(item.id) || new Set<string>();
      linkedRegions.add(regionCode);
      regionLinks.set(item.id, linkedRegions);
    }
  }

  const searchRegion = regions[Math.floor(Date.now() / 1_800_000) % regions.length];
  const recentSearch = await fetchYouTube("search", {
    part: "snippet",
    type: "video",
    regionCode: searchRegion,
    publishedAfter: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    order: "viewCount",
    maxResults: "50",
  }, apiKey);
  const discoveredIds = (recentSearch.items || []).map((item: any) => item.id?.videoId).filter(Boolean);
  for (const idBatch of chunks(discoveredIds, 50)) {
    const details = await fetchYouTube("videos", {
      part: "snippet,statistics,contentDetails",
      id: idBatch.join(","),
    }, apiKey);
    for (const item of details.items || []) {
      videoById.set(item.id, item);
      const linkedRegions = regionLinks.get(item.id) || new Set<string>();
      linkedRegions.add(searchRegion);
      regionLinks.set(item.id, linkedRegions);
    }
  }

  const trackingCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: trackedVideos, error: trackedVideosError } = await supabaseAdmin
    .from("youtube_rising_videos")
    .select("video_id")
    .gte("published_at", trackingCutoff)
    .limit(5000);
  if (trackedVideosError) throw trackedVideosError;

  const trackedVideoIds = (trackedVideos || []).map(row => row.video_id);
  if (trackedVideoIds.length > 0) {
    const { data: trackedRegions, error: trackedRegionsError } = await supabaseAdmin
      .from("youtube_rising_video_regions")
      .select("video_id,region_code")
      .in("region_code", regions)
      .limit(10000);
    if (trackedRegionsError) throw trackedRegionsError;
    for (const row of trackedRegions || []) {
      const linkedRegions = regionLinks.get(row.video_id) || new Set<string>();
      linkedRegions.add(row.region_code);
      regionLinks.set(row.video_id, linkedRegions);
    }
  }

  const missingTrackedIds = trackedVideoIds.filter(videoId => !videoById.has(videoId));
  for (const idBatch of chunks(missingTrackedIds, 50)) {
    const details = await fetchYouTube("videos", {
      part: "snippet,statistics,contentDetails",
      id: idBatch.join(","),
    }, apiKey);
    for (const item of details.items || []) videoById.set(item.id, item);
  }

  const videos = Array.from(videoById.values());
  const channelIds = Array.from(new Set(videos.map(item => item.snippet?.channelId).filter(Boolean)));
  const channelById = new Map<string, any>();
  for (const channelBatch of chunks(channelIds, 50)) {
    const channelData = await fetchYouTube("channels", {
      part: "snippet,statistics",
      id: channelBatch.join(","),
    }, apiKey);
    for (const channel of channelData.items || []) channelById.set(channel.id, channel);
  }

  const capturedAt = new Date().toISOString();
  const channelRows = Array.from(channelById.values()).map(channel => ({
    channel_id: channel.id,
    title: channel.snippet?.title || "",
    thumbnail_url: channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url || null,
    subscriber_count: Number(channel.statistics?.subscriberCount || 0),
    hidden_subscribers: Boolean(channel.statistics?.hiddenSubscriberCount),
    country: channel.snippet?.country || null,
    updated_at: capturedAt,
  }));
  if (channelRows.length > 0) {
    const { error } = await supabaseAdmin.from("youtube_rising_channels").upsert(channelRows, { onConflict: "channel_id" });
    if (error) throw error;
  }

  const eligibleVideos = videos.filter(item => channelById.has(item.snippet?.channelId));
  const videoRows = eligibleVideos.map(item => ({
    video_id: item.id,
    channel_id: item.snippet.channelId,
    title: item.snippet.title,
    description: item.snippet.description || null,
    thumbnail_url: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || null,
    category_id: Number(item.snippet.categoryId || 0),
    published_at: item.snippet.publishedAt,
    duration_seconds: parseDurationSeconds(item.contentDetails?.duration || "PT0S"),
    updated_at: capturedAt,
  }));
  if (videoRows.length > 0) {
    const { error } = await supabaseAdmin.from("youtube_rising_videos").upsert(videoRows, { onConflict: "video_id" });
    if (error) throw error;
  }

  const regionRows = eligibleVideos.flatMap(item =>
    Array.from(regionLinks.get(item.id) || []).map(regionCode => ({
      video_id: item.id,
      region_code: regionCode,
      discovered_at: capturedAt,
    })),
  );
  if (regionRows.length > 0) {
    const { error } = await supabaseAdmin.from("youtube_rising_video_regions").upsert(regionRows, { onConflict: "video_id,region_code" });
    if (error) throw error;
  }

  const snapshotRows = eligibleVideos.map(item => ({
    video_id: item.id,
    captured_at: capturedAt,
    view_count: Number(item.statistics?.viewCount || 0),
    like_count: Number(item.statistics?.likeCount || 0),
    comment_count: Number(item.statistics?.commentCount || 0),
  }));
  if (snapshotRows.length > 0) {
    const { error } = await supabaseAdmin.from("youtube_rising_snapshots").insert(snapshotRows);
    if (error) throw error;
  }

  await supabaseAdmin
    .from("youtube_rising_snapshots")
    .delete()
    .lt("captured_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());

  return {
    regions,
    searchedRegion: searchRegion,
    videoCount: eligibleVideos.length,
    snapshotCount: snapshotRows.length,
    capturedAt,
  };
}

function matchesSubscriberRange(count: number, hidden: boolean, range: SubscriberRange) {
  if (range === "all") return true;
  if (hidden) return false;
  if (range === "lt10k") return count < 10_000;
  if (range === "10k-100k") return count >= 10_000 && count < 100_000;
  if (range === "100k-1m") return count >= 100_000 && count < 1_000_000;
  return count >= 1_000_000;
}

export async function getStoredYouTubeRisingVideos(input: StoredRisingInput) {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.rpc("get_youtube_rising_metrics", {
    p_region_code: input.regionCode,
    p_period_hours: periodHours[input.period],
    p_category_id: input.videoCategoryId ?? null,
  });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42P01" || error.code === "42883") return null;
    throw error;
  }
  if (!data || data.length === 0) {
    return {
      success: true as const,
      videos: [],
      collectedAt: new Date().toISOString(),
      metricMode: "collecting" as const,
    };
  }

  const now = Date.now();
  let videos = data.map((row: any) => {
    const viewCount = Number(row.view_count || 0);
    const subscriberCount = Number(row.subscriber_count || 0);
    const elapsedHours = Math.max((now - new Date(row.published_at).getTime()) / 3_600_000, 0.1);
    const averageHourlyViews = Math.round(viewCount / elapsedHours);
    const velocityPerHour = row.velocity_per_hour === null ? null : Math.max(0, Math.round(Number(row.velocity_per_hour)));
    const acceleration = row.acceleration === null ? null : Math.max(0, Number(Number(row.acceleration).toFixed(2)));
    const outlierScore = row.outlier_score === null ? null : Math.max(0, Number(Number(row.outlier_score).toFixed(2)));
    const rankingVelocity = velocityPerHour ?? averageHourlyViews;
    const freshness = Math.max(0, 1 - elapsedHours / (24 * 7));
    const discoveryScore =
      0.4 * Math.log1p(outlierScore || 0) +
      0.3 * Math.log1p(rankingVelocity) +
      0.2 * Math.min(acceleration ?? 1, 5) +
      0.1 * freshness;

    return {
      id: row.video_id,
      title: row.title,
      description: row.description || "",
      thumbnail: row.thumbnail_url,
      channelTitle: row.channel_title,
      channelId: row.channel_id,
      channelThumbnail: row.channel_thumbnail_url,
      publishedAt: row.published_at,
      viewCount,
      commentCount: Number(row.comment_count || 0),
      categoryId: String(row.category_id || ""),
      tags: [],
      duration: toIsoDuration(Number(row.duration_seconds || 0)),
      subscriberCount,
      hiddenSubscribers: Boolean(row.hidden_subscribers),
      averageHourlyViews,
      velocityPerHour,
      velocityAvailable: velocityPerHour !== null,
      acceleration,
      outlierScore,
      discoveryScore: Number(discoveryScore.toFixed(2)),
      elapsedHours: Number(elapsedHours.toFixed(1)),
      capturedAt: row.captured_at,
    };
  }).filter((video: any) =>
    video.viewCount >= 500 &&
    video.elapsedHours >= 0.5 &&
    matchesSubscriberRange(video.subscriberCount, video.hiddenSubscribers, input.subscriberRange)
  );

  if (input.sortBy === "hourly") videos.sort((a: any, b: any) => (b.velocityPerHour ?? b.averageHourlyViews) - (a.velocityPerHour ?? a.averageHourlyViews));
  else if (input.sortBy === "outlier") videos.sort((a: any, b: any) => (b.outlierScore || 0) - (a.outlierScore || 0));
  else if (input.sortBy === "newest") videos.sort((a: any, b: any) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  else videos.sort((a: any, b: any) => b.discoveryScore - a.discoveryScore);

  const channelCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const categoryLimit = Math.ceil(input.maxResults / 2);
  videos = videos.filter((video: any) => {
    const channelCount = channelCounts.get(video.channelId) || 0;
    const categoryCount = categoryCounts.get(video.categoryId) || 0;
    if (channelCount >= 2) return false;
    if (input.videoCategoryId === undefined && categoryCount >= categoryLimit) return false;
    channelCounts.set(video.channelId, channelCount + 1);
    categoryCounts.set(video.categoryId, categoryCount + 1);
    return true;
  }).slice(0, input.maxResults);

  return {
    success: true as const,
    videos,
    collectedAt: videos[0]?.capturedAt || new Date().toISOString(),
    metricMode: videos.some((video: any) => video.velocityAvailable) ? "snapshot" as const : "collecting" as const,
  };
}
