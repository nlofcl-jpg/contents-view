export type ParsedYouTubeVideoUrl = {
  videoId: string;
  contentType: "video" | "shorts";
};

export function parseYouTubeVideoUrl(value: string): ParsedYouTubeVideoUrl | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  let videoId = "";
  let contentType: ParsedYouTubeVideoUrl["contentType"] = "video";

  if (host === "youtu.be") {
    videoId = parts[0] || "";
  } else if (["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
    if (parts[0] === "watch") videoId = url.searchParams.get("v") || "";
    if (["shorts", "live", "embed"].includes(parts[0])) {
      videoId = parts[1] || "";
      if (parts[0] === "shorts") contentType = "shorts";
    }
  }

  return /^[A-Za-z0-9_-]{11}$/.test(videoId) ? { videoId, contentType } : null;
}

export async function fetchYouTubeBookmarkVideo(
  parsed: ParsedYouTubeVideoUrl,
  apiKey: string,
  fetcher: typeof fetch = fetch,
) {
  const params = new URLSearchParams({
    part: "snippet,statistics,contentDetails",
    id: parsed.videoId,
    key: apiKey,
  });
  const response = await fetcher(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
  if (!response.ok) throw new Error(`YouTube videos.list failed: ${response.status}`);

  const data = await response.json();
  const item = data.items?.[0];
  if (item?.id !== parsed.videoId || typeof item.snippet?.title !== "string") return null;

  return {
    videoId: parsed.videoId,
    contentType: parsed.contentType,
    title: item.snippet.title,
    thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${parsed.videoId}/hqdefault.jpg`,
    channelId: item.snippet.channelId || "",
    channelTitle: item.snippet.channelTitle || "",
    videoUrl: `https://www.youtube.com/watch?v=${parsed.videoId}`,
    duration: item.contentDetails?.duration || "",
    viewCount: String(item.statistics?.viewCount || "0"),
    publishedAt: item.snippet.publishedAt || "",
  };
}
