import { describe, expect, it } from "vitest";
import { isYouTubeTopicChannel, scoreRisingCandidates, selectBalancedRisingVideos } from "./youtubeRising";

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
      ...makeVideos("micro", 30, 5_000),
    ];

    const selected = selectBalancedRisingVideos(videos, 30, true, "all");

    expect(selected).toHaveLength(30);
    expect(selected.filter(video => video.subscriberCount >= 1_000_000)).toHaveLength(6);
    expect(selected.filter(video => video.subscriberCount < 10_000)).toHaveLength(8);
    expect(selected.filter(video => video.subscriberCount >= 10_000 && video.subscriberCount < 100_000)).toHaveLength(8);
    expect(selected.filter(video => video.subscriberCount >= 100_000 && video.subscriberCount < 1_000_000)).toHaveLength(8);
  });

  it("allows only one video from the same channel", () => {
    const videos = Array.from({ length: 12 }, (_, index) => ({
      id: `video-${index}`,
      channelId: index < 4 ? "duplicate-channel" : `channel-${index}`,
      categoryId: "20",
      subscriberCount: 50_000,
      hiddenSubscribers: false,
    }));

    const selected = selectBalancedRisingVideos(videos, 10, true, "all");

    expect(selected.filter(video => video.channelId === "duplicate-channel")).toHaveLength(1);
    expect(new Set(selected.map(video => video.channelId)).size).toBe(selected.length);
  });

  it("does not backfill the list with major channels beyond their cap", () => {
    const videos = [
      ...makeVideos("major", 30, 2_000_000),
      ...makeVideos("micro", 3, 5_000),
    ];

    const selected = selectBalancedRisingVideos(videos, 30, true, "all");

    expect(selected.filter(video => video.subscriberCount >= 1_000_000)).toHaveLength(6);
    expect(selected).toHaveLength(9);
  });

  it("scores velocity by subscriber-normalized percentile within its cohort", () => {
    const candidates = Array.from({ length: 5 }, (_, index) => ({
      id: `candidate-${index}`,
      categoryId: "24",
      subscriberCount: 10_000,
      hiddenSubscribers: false,
      velocityPerHour: (index + 1) * 100,
      averageHourlyViews: (index + 1) * 100,
      acceleration: index + 1,
      outlierScore: index + 1,
      freshness: 0.8,
    }));

    const scored = scoreRisingCandidates(candidates);

    expect(scored[4].velocityRatio).toBe(0.05);
    expect(scored[4].scorePercentiles.velocity).toBe(1);
    expect(scored[4].discoveryScore).toBeGreaterThan(scored[0].discoveryScore);
  });
});
