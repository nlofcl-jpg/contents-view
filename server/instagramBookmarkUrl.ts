export type ParsedInstagramUrl = {
  shortcode: string;
  mediaType: "p" | "reel";
  url: string;
};

const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]);

export function parseInstagramUrl(value: string): ParsedInstagramUrl | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !INSTAGRAM_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.port) return null;
  const match = url.pathname.match(/^\/(p|reel|reels)\/([A-Za-z0-9_-]{5,32})\/?$/);
  if (!match) return null;
  const mediaType = match[1] === "p" ? "p" : "reel";
  return { shortcode: match[2], mediaType, url: `https://www.instagram.com/${mediaType}/${match[2]}/` };
}

export async function fetchInstagramBookmarkMetadata(parsed: ParsedInstagramUrl, fetcher: typeof fetch = fetch) {
  const fallback = {
    title: parsed.mediaType === "reel" ? "Instagram 릴스" : "Instagram 게시물",
    authorName: null as string | null,
    authorUrl: null as string | null,
    thumbnailUrl: null as string | null,
  };

  try {
    const endpoint = new URL("https://graph.facebook.com/v25.0/instagram_oembed");
    endpoint.searchParams.set("url", parsed.url);
    const response = await fetcher(endpoint.toString(), { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return fallback;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") return fallback;
    const item = data as Record<string, unknown>;
    if (item.provider_name !== "Instagram") return fallback;

    const authorName = typeof item.author_name === "string" && item.author_name.trim()
      ? item.author_name.trim().slice(0, 100)
      : null;
    const authorUrl = typeof item.author_url === "string" ? parseInstagramProfileUrl(item.author_url) : null;
    return {
      title: typeof item.title === "string" && item.title.trim() ? item.title.trim().slice(0, 500) : fallback.title,
      authorName,
      authorUrl,
      thumbnailUrl: typeof item.thumbnail_url === "string" && item.thumbnail_url.startsWith("https://")
        ? item.thumbnail_url
        : null,
    };
  } catch {
    return fallback;
  }
}

function parseInstagramProfileUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !INSTAGRAM_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.port) return null;
    const match = url.pathname.match(/^\/([A-Za-z0-9._]{1,30})\/?$/);
    return match ? `https://www.instagram.com/${match[1]}/` : null;
  } catch {
    return null;
  }
}
