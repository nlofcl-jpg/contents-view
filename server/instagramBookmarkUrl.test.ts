import { describe, expect, it, vi } from "vitest";
import { fetchInstagramBookmarkMetadata, parseInstagramUrl } from "./instagramBookmarkUrl";

describe("parseInstagramUrl", () => {
  it.each([
    ["https://www.instagram.com/reel/DABC12xyz_0/?igsh=abc", "reel", "DABC12xyz_0"],
    ["https://instagram.com/reels/ABC_12345/", "reel", "ABC_12345"],
    ["https://m.instagram.com/p/CFJDs93A7Kz/", "p", "CFJDs93A7Kz"],
  ])("accepts supported post URLs", (url, mediaType, shortcode) => {
    expect(parseInstagramUrl(url)).toEqual({
      shortcode,
      mediaType,
      url: `https://www.instagram.com/${mediaType}/${shortcode}/`,
    });
  });

  it.each([
    "https://evil.com/reel/DABC12xyz_0/",
    "https://www.instagram.com.evil.com/reel/DABC12xyz_0/",
    "http://www.instagram.com/reel/DABC12xyz_0/",
    "https://user@www.instagram.com/reel/DABC12xyz_0/",
    "https://www.instagram.com:444/reel/DABC12xyz_0/",
    "https://www.instagram.com/stories/example/123456789/",
    "https://www.instagram.com/example/",
  ])("rejects unsupported URLs", url => {
    expect(parseInstagramUrl(url)).toBeNull();
  });
});

describe("fetchInstagramBookmarkMetadata", () => {
  const parsed = parseInstagramUrl("https://www.instagram.com/reel/DABC12xyz_0/")!;

  it("uses available oEmbed fields", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      provider_name: "Instagram",
      title: "A short reel",
      author_name: "creator",
      author_url: "https://instagram.com/creator/",
      thumbnail_url: "https://cdninstagram.com/example.jpg",
    }), { status: 200 })) as unknown as typeof fetch;
    expect(await fetchInstagramBookmarkMetadata(parsed, fetcher)).toEqual({
      title: "A short reel",
      authorName: "creator",
      authorUrl: "https://www.instagram.com/creator/",
      thumbnailUrl: "https://cdninstagram.com/example.jpg",
    });
  });

  it("saves a URL even when oEmbed fields are unavailable", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 403 })) as unknown as typeof fetch;
    expect(await fetchInstagramBookmarkMetadata(parsed, fetcher)).toEqual({
      title: "Instagram 릴스", authorName: null, authorUrl: null, thumbnailUrl: null,
    });
  });
});
