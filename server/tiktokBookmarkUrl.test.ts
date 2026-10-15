import { describe, expect, it, vi } from "vitest";
import { fetchTikTokBookmarkVideo, parseTikTokVideoUrl } from "./tiktokBookmarkUrl";

const videoId = "6718335390845095173";
const videoUrl = `https://www.tiktok.com/@scout2015/video/${videoId}`;

describe("parseTikTokVideoUrl", () => {
  it.each([
    [videoUrl, videoId],
    [`${videoUrl}?is_from_webapp=1`, videoId],
    ["https://vm.tiktok.com/ZMshort123/", null],
    ["https://vt.tiktok.com/ZMshort123/", null],
    ["https://www.tiktok.com/t/ZMshort123/", null],
  ])("accepts %s", (url, id) => {
    expect(parseTikTokVideoUrl(url)?.videoId).toBe(id);
  });

  it.each([
    "not a url",
    "https://tiktok.com.evil.example/@user/video/6718335390845095173",
    "https://www.tiktok.com/@user",
    "http://www.tiktok.com/@user/video/6718335390845095173",
    "https://user:pass@www.tiktok.com/@user/video/6718335390845095173",
    "https://www.tiktok.com:8080/@user/video/6718335390845095173",
  ])("rejects %s", url => {
    expect(parseTikTokVideoUrl(url)).toBeNull();
  });
});

describe("fetchTikTokBookmarkVideo", () => {
  const metadata = {
    provider_name: "TikTok",
    title: "Sample video #test",
    author_name: "Scout & Suki",
    author_url: "https://www.tiktok.com/@scout2015",
    thumbnail_url: "https://example.com/thumbnail.jpg",
    html: `<blockquote class="tiktok-embed" cite="${videoUrl}" data-video-id="${videoId}"></blockquote>`,
  };

  it("maps official oEmbed metadata for a saved video", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(metadata), { status: 200 })) as typeof fetch;
    expect(await fetchTikTokBookmarkVideo(parseTikTokVideoUrl(videoUrl)!, fetcher)).toEqual({
      videoId,
      videoUrl,
      title: "Sample video #test",
      authorName: "Scout & Suki",
      authorUrl: "https://www.tiktok.com/@scout2015",
      thumbnailUrl: "https://example.com/thumbnail.jpg",
    });
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("https://www.tiktok.com/oembed?url="), expect.any(Object));
  });

  it("uses the canonical video URL returned for a short share link", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(metadata), { status: 200 })) as typeof fetch;
    const bookmark = await fetchTikTokBookmarkVideo(parseTikTokVideoUrl("https://vm.tiktok.com/ZMshort123/")!, fetcher);
    expect(bookmark?.videoId).toBe(videoId);
    expect(bookmark?.videoUrl).toBe(videoUrl);
  });

  it("rejects a mismatched video ID", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(metadata), { status: 200 })) as typeof fetch;
    expect(await fetchTikTokBookmarkVideo(parseTikTokVideoUrl("https://www.tiktok.com/@other/video/1234567890123456789")!, fetcher)).toBeNull();
  });

  it("returns null for a missing video", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 404 })) as typeof fetch;
    expect(await fetchTikTokBookmarkVideo(parseTikTokVideoUrl(videoUrl)!, fetcher)).toBeNull();
  });
});
