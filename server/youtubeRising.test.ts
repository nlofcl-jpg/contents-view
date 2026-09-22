import { describe, expect, it } from "vitest";
import { isYouTubeTopicChannel, selectBalancedRisingVideos } from "./youtubeRising";

function makeVideos(prefix: string, count: number, subscriberCount: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    channelId: `${prefix}-channel-${index}`,
    categoryId: String((index % 4) + 1),
    subscriberCount,
    hiddenSubscribers: false,
  }));
}

describe("YouTube rising discovery filters", () => {
  it("excludes auto-generated Topic channels", () => {
    expect(isYouTubeTopicChannel("Artist - Topic")).toBe(true);
    expect(isYouTubeTopicChannel("Artist – Topic")).toBe(true);
    expect(isYouTubeTopicChannel("Artist Official")).toBe(false);
  });

  it("reserves the all-channel list for emerging and growing channels", () => {
    const videos = [
      ...makeVideos("major", 30, 2_000_000),
      ...makeVideos("growing", 30, 300_000),
      ...makeVideos("emerging", 30, 50_000),
    ];

    const selected = selectBalancedRisingVideos(videos, 30, true, "all");

    expect(selected).toHaveLength(30);
    expect(selected.filter(video => video.subscriberCount >= 1_000_000)).toHaveLength(6);
    expect(selected.filter(video => video.subscriberCount < 100_000)).toHaveLength(12);
    expect(selected.filter(video => video.subscriberCount >= 100_000 && video.subscriberCount < 1_000_000)).toHaveLength(12);
  });
});
