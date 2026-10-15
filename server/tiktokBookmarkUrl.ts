import { load } from "cheerio";

const CANONICAL_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com"]);
const SHORT_HOSTS = new Set(["vm.tiktok.com", "vt.tiktok.com"]);

export type ParsedTikTokVideoUrl = {
  url: string;
  videoId: string | null;
};

export function parseTikTokVideoUrl(value: string): ParsedTikTokVideoUrl | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;

  const host = url.hostname.toLowerCase();
  if (CANONICAL_HOSTS.has(host)) {
    const match = url.pathname.match(/^\/@[^/]+\/video\/(\d{10,25})\/?$/);
    if (match) return { url: `https://www.tiktok.com${url.pathname.replace(/\/$/, "")}`, videoId: match[1] };
    if (/^\/t\/[A-Za-z0-9]+\/?$/.test(url.pathname)) return { url: `https://www.tiktok.com${url.pathname}`, videoId: null };
  }
  if (SHORT_HOSTS.has(host) && /^\/[A-Za-z0-9]+\/?$/.test(url.pathname)) {
    return { url: `https://${host}${url.pathname}`, videoId: null };
  }
  return null;
}

export async function fetchTikTokBookmarkVideo(
  parsed: ParsedTikTokVideoUrl,
  fetcher: typeof fetch = fetch,
) {
  const endpoint = new URL("https://www.tiktok.com/oembed");
  endpoint.searchParams.set("url", parsed.url);
  const response = await fetcher(endpoint.toString(), { signal: AbortSignal.timeout(10000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`TikTok oEmbed failed: ${response.status}`);

  const data: unknown = await response.json();
  if (!data || typeof data !== "object") return null;
  const item = data as Record<string, unknown>;
  if (item.provider_name !== "TikTok" || typeof item.html !== "string") return null;

  const embed = load(item.html)("blockquote.tiktok-embed").first();
  const canonical = parseTikTokVideoUrl(embed.attr("cite") || "");
  const videoId = canonical?.videoId;
  if (!videoId || embed.attr("data-video-id") !== videoId) return null;
  if (parsed.videoId && parsed.videoId !== videoId) return null;

  const authorUrl = typeof item.author_url === "string" ? item.author_url : "";
  const author = parseTikTokAuthorUrl(authorUrl);
  if (!author) return null;

  const thumbnailUrl = typeof item.thumbnail_url === "string" && item.thumbnail_url.startsWith("https://")
    ? item.thumbnail_url
    : null;

  return {
    videoId,
    videoUrl: canonical.url,
    title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : "TikTok 영상",
    authorName: typeof item.author_name === "string" && item.author_name.trim() ? item.author_name.trim() : author.handle,
    authorUrl: author.url,
    thumbnailUrl,
  };
}

function parseTikTokAuthorUrl(value: string): { url: string; handle: string } | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !CANONICAL_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.port) return null;
  const match = url.pathname.match(/^\/@([^/]+)\/?$/);
  return match ? { url: `https://www.tiktok.com/@${match[1]}`, handle: match[1] } : null;
}
