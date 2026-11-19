import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useAuth, useVideoAnalysis } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useVideoAnalysis: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth }));
vi.mock("@/lib/trpc", () => ({
  trpc: { youtube: { getVideoAnalysis: { useQuery: useVideoAnalysis } } },
}));

import { YouTubeVideoDetailModal } from "../client/src/components/YouTubeVideoDetailModal";

const video = {
  id: "stored-video",
  title: "Stored video title",
  channelTitle: "Stored channel",
  viewCount: 120,
  publishedAt: "2026-10-01T00:00:00.000Z",
  duration: "PT45S",
};

describe("YouTube rising video detail", () => {
  beforeEach(() => {
    useVideoAnalysis.mockReset().mockReturnValue({
      data: { success: true, video: { ...video, title: "Live analysis title" } },
      isFetching: true,
    });
  });

  it.each([false, true])("uses the stored snapshot on repeated opens (authenticated: %s)", isAuthenticated => {
    useAuth.mockReturnValue({ isAuthenticated });
    for (const id of [video.id, video.id, "another-video"]) {
      const html = renderToStaticMarkup(createElement(YouTubeVideoDetailModal, {
        video: { ...video, id },
        isOpen: true,
        onClose: () => {},
        useStoredSnapshot: true,
      }));
      expect(useVideoAnalysis).toHaveBeenLastCalledWith({ videoId: id }, expect.objectContaining({ enabled: false }));
      expect(html).toContain(video.title);
      expect(html).not.toContain("Live analysis title");
      expect(html).not.toContain("최신 분석 중");
    }
  });

  it("still queries live analysis for an authenticated user outside the rising list", () => {
    useAuth.mockReturnValue({ isAuthenticated: true });
    const html = renderToStaticMarkup(createElement(YouTubeVideoDetailModal, {
      video,
      isOpen: true,
      onClose: () => {},
    }));
    expect(useVideoAnalysis).toHaveBeenCalledWith({ videoId: video.id }, expect.objectContaining({ enabled: true }));
    expect(html).toContain("Live analysis title");
  });
});
