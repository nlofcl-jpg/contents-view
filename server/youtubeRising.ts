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

export function isYouTubeTopicChannel(channelTitle: string | null | undefined) {
  return /\s[-–—]\s*topic$/i.test(channelTitle?.trim() || "");
}

function getSubscriberBand(subscriberCount: number, hiddenSubscribers: boolean) {
  if (hiddenSubscribers || subscriberCount >= 1_000_000) return "major";
  if (subscriberCount < 10_000) return "micro";
  if (subscriberCount < 100_000) return "emerging";
  return "growing";
}

function percentileRank(value: number | null, values: number[]) {
  if (value === null || values.length === 0) return 0;
  if (values.length === 1) return 0.5;

  const sorted = [...values].sort((a, b) => a - b);
  const lowerIndex = sorted.findIndex(candidate => candidate >= value);
  const upperIndex = sorted.findLastIndex(candidate => candidate <= value);
  const averageIndex = (Math.max(0, lowerIndex) + Math.max(0, upperIndex)) / 2;
  return averageIndex / (sorted.length - 1);
}

type RisingScoreCandidate = {
  categoryId: string;
  subscriberCount: number;
  hiddenSubscribers: boolean;
  velocityPerHour: number | null;
  averageHourlyViews: number;
  acceleration: number | null;
  outlierScore: number | null;
  freshness: number;
};

export function scoreRisingCandidates<T extends RisingScoreCandidate>(videos: T[]) {
  const bandGroups = new Map<string, T[]>();
  const categoryBandGroups = new Map<string, T[]>();

  for (const video of videos) {
    const band = getSubscriberBand(video.subscriberCount, video.hiddenSubscribers);
    const categoryBand = `${video.categoryId}:${band}`;
    bandGroups.set(band, [...(bandGroups.get(band) || []), video]);
    categoryBandGroups.set(categoryBand, [...(categoryBandGroups.get(categoryBand) || []), video]);
  }

  return videos.map(video => {
    const band = getSubscriberBand(video.subscriberCount, video.hiddenSubscribers);
    const primaryCohort = categoryBandGroups.get(`${video.categoryId}:${band}`) || [];
    const bandCohort = bandGroups.get(band) || [];
    const cohort = primaryCohort.length >= 5
      ? primaryCohort
      : bandCohort.length >= 5
        ? bandCohort
        : videos;
    const getVelocityRatio = (candidate: T) => {
      if (candidate.hiddenSubscribers || candidate.subscriberCount <= 0) return null;
      return (candidate.velocityPerHour ?? candidate.averageHourlyViews) / candidate.subscriberCount;
    };
    const velocityRatio = getVelocityRatio(video);
    const outlierPercentile = percentileRank(
      video.outlierScore,
      cohort.map(candidate => candidate.outlierScore).filter((value): value is number => value !== null),
    );
    const velocityPercentile = percentileRank(
      velocityRatio,
      cohort.map(getVelocityRatio).filter((value): value is number => value !== null),
    );
    const accelerationPercentile = percentileRank(
      video.acceleration,
      cohort.map(candidate => candidate.acceleration).filter((value): value is number => value !== null),
    );
    const discoveryScore =
      outlierPercentile * 0.4 +
      velocityPercentile * 0.3 +
      accelerationPercentile * 0.2 +
      video.freshness * 0.1;

    return {
      ...video,
      velocityRatio: velocityRatio === null ? null : Number(velocityRatio.toFixed(6)),
      scorePercentiles: {
        outlier: Number(outlierPercentile.toFixed(4)),
        velocity: Number(velocityPercentile.toFixed(4)),
        acceleration: Number(accelerationPercentile.toFixed(4)),
      },
      discoveryScore: Number((discoveryScore * 100).toFixed(2)),
    };
  });
}

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

const DISCOVERY_STOP_WORDS = new Set([
  "official", "video", "music", "shorts", "short", "live", "full", "episode", "trailer",
  "the", "and", "with", "from", "this", "that", "you", "new", "2026",
  "공식", "영상", "뮤직비디오", "라이브", "하이라이트", "예고편", "다시보기", "오늘",
]);

function extractDiscoveryQuery(items: any[]) {
  const frequencies = new Map<string, number>();
  for (const item of items) {
    const title = String(item.snippet?.title || "").toLowerCase();
    const tokens = title.split(/[\s|/()[\]{}.,!?;:"'`~…·•<>+=_-]+/).filter(Boolean);
    for (const rawToken of tokens) {
      const token = rawToken.replace(/^#+/, "").trim();
      if (
        token.length < 2 ||
        token.length > 24 ||
        /^\d+$/.test(token) ||
        DISCOVERY_STOP_WORDS.has(token)
      ) continue;
      frequencies.set(token, (frequencies.get(token) || 0) + 1);
    }
  }

  return Array.from(frequencies.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([token]) => token)[0] || "";
}

export function selectBalancedRisingVideos<T extends { channelId: string; categoryId: string; subscriberCount: number; hiddenSubscribers: boolean }>(
  videos: T[],
  maxResults: number,
  categoryIsFiltered: boolean,
  subscriberRange: SubscriberRange,
) {
  const channelCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const categoryLimit = Math.ceil(maxResults / 2);
  const diverseVideos = videos.filter(video => {
    const channelCount = channelCounts.get(video.channelId) || 0;
    const categoryCount = categoryCounts.get(video.categoryId) || 0;
    if (channelCount >= 1) return false;
    if (!categoryIsFiltered && categoryCount >= categoryLimit) return false;
    channelCounts.set(video.channelId, channelCount + 1);
    categoryCounts.set(video.categoryId, categoryCount + 1);
    return true;
  });

  if (subscriberRange !== "all") return diverseVideos.slice(0, maxResults);

  const micro = diverseVideos.filter(video => getSubscriberBand(video.subscriberCount, video.hiddenSubscribers) === "micro");
  const emerging = diverseVideos.filter(video => getSubscriberBand(video.subscriberCount, video.hiddenSubscribers) === "emerging");
  const growing = diverseVideos.filter(video => getSubscriberBand(video.subscriberCount, video.hiddenSubscribers) === "growing");
  const major = diverseVideos.filter(video => getSubscriberBand(video.subscriberCount, video.hiddenSubscribers) === "major");
  const majorLimit = Math.floor(maxResults * 0.2);
  const nonMajorSlots = maxResults - majorLimit;
  const baseNonMajorLimit = Math.floor(nonMajorSlots / 3);
  const remainingNonMajorSlots = nonMajorSlots % 3;
  const quotas = [
    { videos: micro, limit: baseNonMajorLimit + (remainingNonMajorSlots > 0 ? 1 : 0) },
    { videos: emerging, limit: baseNonMajorLimit + (remainingNonMajorSlots > 1 ? 1 : 0) },
    { videos: growing, limit: baseNonMajorLimit },
    { videos: major, limit: majorLimit },
  ];
  const selected = quotas.flatMap(group => group.videos.slice(0, group.limit));
  const selectedVideos = new Set(selected);
  let selectedMajorCount = selected.filter(video => getSubscriberBand(video.subscriberCount, video.hiddenSubscribers) === "major").length;

  for (const video of diverseVideos) {
    if (selected.length >= maxResults) break;
    if (selectedVideos.has(video)) continue;
    const isMajor = getSubscriberBand(video.subscriberCount, video.hiddenSubscribers) === "major";
    if (isMajor && selectedMajorCount >= majorLimit) continue;
    selected.push(video);
    selectedVideos.add(video);
    if (isMajor) selectedMajorCount += 1;
  }

  return selected.sort((a, b) => videos.indexOf(a) - videos.indexOf(b));
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

async function fetchEmergingChannelUploads(regionCode: string, apiKey: string) {
  if (!supabaseAdmin) return [];

  const { data: regionRows, error: regionError } = await supabaseAdmin
    .from("youtube_rising_video_regions")
    .select("video_id")
    .eq("region_code", regionCode)
    .limit(600);
  if (regionError || !regionRows?.length) return [];

  const linkedChannelIds = new Set<string>();
  for (const videoIdBatch of chunks(regionRows.map(row => row.video_id), 200)) {
    const { data: videoRows, error: videoError } = await supabaseAdmin
      .from("youtube_rising_videos")
      .select("channel_id")
      .in("video_id", videoIdBatch);
    if (videoError) continue;
    for (const row of videoRows || []) linkedChannelIds.add(row.channel_id);
  }
  if (linkedChannelIds.size === 0) return [];

  const emergingChannels: Array<{ channel_id: string; updated_at: string | null }> = [];
  for (const channelIdBatch of chunks(Array.from(linkedChannelIds), 200)) {
    const { data: channelRows, error: channelError } = await supabaseAdmin
      .from("youtube_rising_channels")
      .select("channel_id,updated_at")
      .in("channel_id", channelIdBatch)
      .eq("hidden_subscribers", false)
      .gte("subscriber_count", 1_000)
      .lt("subscriber_count", 100_000);
    if (channelError) continue;
    emergingChannels.push(...(channelRows || []));
  }

  const seedChannelIds = emergingChannels
    .sort((a, b) => {
      const aUpdatedAt = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bUpdatedAt = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return aUpdatedAt - bUpdatedAt;
    })
    .slice(0, 12)
    .map(channel => channel.channel_id);
  if (seedChannelIds.length === 0) return [];

  const channelDetails = await fetchYouTube("channels", {
    part: "contentDetails",
    id: seedChannelIds.join(","),
  }, apiKey);
  const uploadPlaylists = (channelDetails.items || []).map((channel: any) =>
    channel.contentDetails?.relatedPlaylists?.uploads
  ).filter(Boolean);
  const uploadResponses = await Promise.all(uploadPlaylists.map((playlistId: string) =>
    fetchYouTube("playlistItems", {
      part: "contentDetails",
      playlistId,
      maxResults: "3",
    }, apiKey)
  ));

  const uploadVideoIds = new Set<string>();
  for (const uploads of uploadResponses) {
    for (const item of uploads.items || []) {
      if (item.contentDetails?.videoId) uploadVideoIds.add(item.contentDetails.videoId);
    }
  }

  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const uploadVideos: any[] = [];
  for (const videoIdBatch of chunks(Array.from(uploadVideoIds), 50)) {
    const details = await fetchYouTube("videos", {
      part: "snippet,statistics,contentDetails",
      id: videoIdBatch.join(","),
    }, apiKey);
    uploadVideos.push(...(details.items || []).filter((item: any) =>
      new Date(item.snippet?.publishedAt || 0).getTime() >= recentCutoff
    ));
  }
  return uploadVideos;
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

  const collectionSlot = Math.floor(Date.now() / 1_800_000);
  const hourlySlot = Math.floor(collectionSlot / 2);
  const searchRegion = regions[hourlySlot % regions.length];
  const discoveryCategories = ["1", "2", "10", "15", "17", "19", "20", "22", "23", "24", "25", "26", "27", "28"];
  const discoveryCategory = discoveryCategories[hourlySlot % discoveryCategories.length];
  const shouldDiscover = collectionSlot % 2 === 0;
  const regionalPopularVideos = Array.from(videoById.values()).filter(item => regionLinks.get(item.id)?.has(searchRegion));
  const discoveryQuery = extractDiscoveryQuery(regionalPopularVideos);
  const discoveryModes = shouldDiscover
    ? [
        { order: "date", lookbackHours: 6 },
        discoveryQuery
          ? { order: "relevance", query: discoveryQuery, videoCategoryId: discoveryCategory, lookbackHours: 24 }
          : { order: "viewCount", videoCategoryId: discoveryCategory, lookbackHours: 24 },
      ]
    : [];
  const discoveredIds = new Set<string>();
  for (const mode of discoveryModes) {
    const discoveryParams: Record<string, string> = {
      part: "snippet",
      type: "video",
      regionCode: searchRegion,
      publishedAfter: new Date(Date.now() - mode.lookbackHours * 60 * 60 * 1000).toISOString(),
      order: mode.order,
      maxResults: "50",
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
        const linkedRegions = regionLinks.get(item.id) || new Set<string>();
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
  const channelRows = Array.from(channelById.values())
    .filter(channel => !isYouTubeTopicChannel(channel.snippet?.title))
    .map(channel => ({
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

  const eligibleVideos = videos.filter(item => {
    const channel = channelById.get(item.snippet?.channelId);
    return channel && !isYouTubeTopicChannel(channel.snippet?.title);
  });
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
    discoveryModes,
    discoveryCategory,
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
    const freshness = Math.max(0, 1 - elapsedHours / (24 * 7));

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
      freshness,
      elapsedHours: Number(elapsedHours.toFixed(1)),
      capturedAt: row.captured_at,
    };
  }).filter((video: any) =>
    video.viewCount >= 500 &&
    video.elapsedHours >= 0.5 &&
    !isYouTubeTopicChannel(video.channelTitle) &&
    matchesSubscriberRange(video.subscriberCount, video.hiddenSubscribers, input.subscriberRange)
  );

  videos = scoreRisingCandidates(videos);

  if (input.sortBy === "hourly") videos.sort((a: any, b: any) => (b.velocityPerHour ?? b.averageHourlyViews) - (a.velocityPerHour ?? a.averageHourlyViews));
  else if (input.sortBy === "outlier") videos.sort((a: any, b: any) => (b.outlierScore || 0) - (a.outlierScore || 0));
  else if (input.sortBy === "newest") videos.sort((a: any, b: any) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  else videos.sort((a: any, b: any) => b.discoveryScore - a.discoveryScore);

  videos = selectBalancedRisingVideos(
    videos,
    input.maxResults,
    input.videoCategoryId !== undefined,
    input.subscriberRange,
  );

  return {
    success: true as const,
    videos,
    collectedAt: videos[0]?.capturedAt || new Date().toISOString(),
    metricMode: videos.some((video: any) => video.velocityAvailable) ? "snapshot" as const : "collecting" as const,
  };
}
