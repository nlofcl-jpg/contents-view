import { describe, expect, it, vi } from "vitest";
import { fetchYouTubeBookmarkVideo, parseYouTubeVideoUrl } from "./youtubeBookmarkUrl";

const videoId = "dQw4w9WgXcQ";

describe("parseYouTubeVideoUrl", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${videoId}&t=30`, "video"],
    [`https://m.youtube.com/watch?v=${videoId}`, "video"],
    [`https://youtu.be/${videoId}?si=share`, "video"],
    [`https://www.youtube.com/shorts/${videoId}`, "shorts"],
    [`https://www.youtube.com/live/${videoId}`, "video"],
  ] as const)("accepts %s", (url, contentType) => {
    expect(parseYouTubeVideoUrl(url)).toEqual({ videoId, contentType });
  });

  it.each([
    "not a url",
    `https://youtube.com.evil.example/watch?v=${videoId}`,
    "https://www.youtube.com/watch?v=short",
    `https://www.youtube.com/channel/${videoId}`,
    `javascript:alert(1)`,
  ])("rejects %s", url => {
    expect(parseYouTubeVideoUrl(url)).toBeNull();
  });
});

describe("fetchYouTubeBookmarkVideo", () => {
  it("maps YouTube metadata to a bookmark", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ items: [{
      id: videoId,
      snippet: {
        title: "Sample video",
        channelId: "channel-1",
        channelTitle: "Sample channel",
        publishedAt: "2026-10-01T00:00:00Z",
        thumbnails: { high: { url: "https://example.com/thumb.jpg" } },
      },
      statistics: { viewCount: "1234" },
      contentDetails: { duration: "PT1M" },
    }] }), { status: 200 })) as typeof fetch;

    const bookmark = await fetchYouTubeBookmarkVideo({ videoId, contentType: "shorts" }, "test-key", fetcher);

    expect(bookmark).toMatchObject({
      videoId,
      contentType: "shorts",
      title: "Sample video",
      thumbnailUrl: "https://example.com/thumb.jpg",
      channelId: "channel-1",
      channelTitle: "Sample channel",
      duration: "PT1M",
      viewCount: "1234",
    });
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(`id=${videoId}`));
  });

  it("does not create a bookmark for a missing video", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })) as typeof fetch;
    expect(await fetchYouTubeBookmarkVideo({ videoId, contentType: "video" }, "test-key", fetcher)).toBeNull();
  });
});
