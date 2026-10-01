import { beforeEach, describe, expect, it, vi } from "vitest";

const { getStoredRisingVideos } = vi.hoisted(() => ({
  getStoredRisingVideos: vi.fn(),
}));

vi.mock("./youtubeRising", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./youtubeRising")>()),
  getStoredYouTubeRisingVideos: getStoredRisingVideos,
}));

import { appRouter } from "./routers";

const input = {
  regionCode: "KR",
  period: "realtime" as const,
  subscriberRange: "all" as const,
  sortBy: "score" as const,
  maxResults: 5,
};

describe("collected YouTube rising videos", () => {
  beforeEach(() => getStoredRisingVideos.mockReset());

  it("serves stored videos to a guest without calling YouTube", async () => {
    const stored = {
      success: true,
      videos: [{ id: "video-1", title: "Stored video" }],
      previousVideos: [],
      collectedAt: "2026-10-01T00:00:00.000Z",
      metricMode: "snapshot",
    };
    getStoredRisingVideos.mockResolvedValue(stored);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    try {
      const caller = appRouter.createCaller({ user: null, req: {} as any, res: {} as any });
      const result = await caller.youtube.getCollectedRisingVideos(input);

      expect(result).toEqual(stored);
      expect(getStoredRisingVideos).toHaveBeenCalledWith(input);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("does not fall back to a user API key when collection is unavailable", async () => {
    getStoredRisingVideos.mockResolvedValue(null);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    try {
      const caller = appRouter.createCaller({ user: null, req: {} as any, res: {} as any });
      const result = await caller.youtube.getCollectedRisingVideos(input);

      expect(result.success).toBe(false);
      expect(result.videos).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
