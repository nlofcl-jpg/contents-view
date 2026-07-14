import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { BookmarkProvider, useBookmark, BookmarkedYouTubeVideo } from "./BookmarkContext";

const STORAGE_KEY = "contents-view-youtube-bookmarks";

describe("BookmarkContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should initialize with empty bookmarked videos", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BookmarkProvider>{children}</BookmarkProvider>
    );
    const { result } = renderHook(() => useBookmark(), { wrapper });

    expect(result.current.bookmarkedYouTubeVideos).toEqual([]);
  });

  it("should add a YouTube video to bookmarks", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BookmarkProvider>{children}</BookmarkProvider>
    );
    const { result } = renderHook(() => useBookmark(), { wrapper });

    const video: BookmarkedYouTubeVideo = {
      id: "test-video-1",
      title: "Test Video",
      thumbnail: "https://example.com/thumb.jpg",
      channelTitle: "Test Channel",
      viewCount: "1000",
      publishedAt: "2024-01-01",
      duration: "PT10M30S",
    };

    act(() => {
      result.current.toggleYouTubeBookmark(video);
    });

    expect(result.current.bookmarkedYouTubeVideos).toHaveLength(1);
    expect(result.current.bookmarkedYouTubeVideos[0]).toEqual(video);
  });

  it("should remove a YouTube video from bookmarks", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BookmarkProvider>{children}</BookmarkProvider>
    );
    const { result } = renderHook(() => useBookmark(), { wrapper });

    const video: BookmarkedYouTubeVideo = {
      id: "test-video-1",
      title: "Test Video",
      thumbnail: "https://example.com/thumb.jpg",
      channelTitle: "Test Channel",
      viewCount: "1000",
      publishedAt: "2024-01-01",
      duration: "PT10M30S",
    };

    act(() => {
      result.current.toggleYouTubeBookmark(video);
    });

    expect(result.current.bookmarkedYouTubeVideos).toHaveLength(1);

    act(() => {
      result.current.toggleYouTubeBookmark(video);
    });

    expect(result.current.bookmarkedYouTubeVideos).toHaveLength(0);
  });

  it("should check if a video is bookmarked", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BookmarkProvider>{children}</BookmarkProvider>
    );
    const { result } = renderHook(() => useBookmark(), { wrapper });

    const video: BookmarkedYouTubeVideo = {
      id: "test-video-1",
      title: "Test Video",
      thumbnail: "https://example.com/thumb.jpg",
      channelTitle: "Test Channel",
      viewCount: "1000",
      publishedAt: "2024-01-01",
      duration: "PT10M30S",
    };

    expect(result.current.isYouTubeVideoBookmarked("test-video-1")).toBe(false);

    act(() => {
      result.current.toggleYouTubeBookmark(video);
    });

    expect(result.current.isYouTubeVideoBookmarked("test-video-1")).toBe(true);
  });

  it("should remove a YouTube video by ID", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BookmarkProvider>{children}</BookmarkProvider>
    );
    const { result } = renderHook(() => useBookmark(), { wrapper });

    const video: BookmarkedYouTubeVideo = {
      id: "test-video-1",
      title: "Test Video",
      thumbnail: "https://example.com/thumb.jpg",
      channelTitle: "Test Channel",
      viewCount: "1000",
      publishedAt: "2024-01-01",
      duration: "PT10M30S",
    };

    act(() => {
      result.current.toggleYouTubeBookmark(video);
    });

    expect(result.current.bookmarkedYouTubeVideos).toHaveLength(1);

    act(() => {
      result.current.removeYouTubeBookmark("test-video-1");
    });

    expect(result.current.bookmarkedYouTubeVideos).toHaveLength(0);
  });

  it("should handle multiple bookmarked videos", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BookmarkProvider>{children}</BookmarkProvider>
    );
    const { result } = renderHook(() => useBookmark(), { wrapper });

    const video1: BookmarkedYouTubeVideo = {
      id: "test-video-1",
      title: "Test Video 1",
      thumbnail: "https://example.com/thumb1.jpg",
      channelTitle: "Test Channel 1",
      viewCount: "1000",
      publishedAt: "2024-01-01",
      duration: "PT10M30S",
    };

    const video2: BookmarkedYouTubeVideo = {
      id: "test-video-2",
      title: "Test Video 2",
      thumbnail: "https://example.com/thumb2.jpg",
      channelTitle: "Test Channel 2",
      viewCount: "2000",
      publishedAt: "2024-01-02",
      duration: "PT15M00S",
    };

    act(() => {
      result.current.toggleYouTubeBookmark(video1);
      result.current.toggleYouTubeBookmark(video2);
    });

    expect(result.current.bookmarkedYouTubeVideos).toHaveLength(2);
    expect(result.current.isYouTubeVideoBookmarked("test-video-1")).toBe(true);
    expect(result.current.isYouTubeVideoBookmarked("test-video-2")).toBe(true);

    act(() => {
      result.current.removeYouTubeBookmark("test-video-1");
    });

    expect(result.current.bookmarkedYouTubeVideos).toHaveLength(1);
    expect(result.current.isYouTubeVideoBookmarked("test-video-1")).toBe(false);
    expect(result.current.isYouTubeVideoBookmarked("test-video-2")).toBe(true);
  });

  it("should save bookmarks to localStorage when added", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BookmarkProvider>{children}</BookmarkProvider>
    );
    const { result } = renderHook(() => useBookmark(), { wrapper });

    const video: BookmarkedYouTubeVideo = {
      id: "test-video-1",
      title: "Test Video",
      thumbnail: "https://example.com/thumb.jpg",
      channelTitle: "Test Channel",
      viewCount: "1000",
      publishedAt: "2024-01-01",
      duration: "PT10M30S",
    };

    act(() => {
      result.current.toggleYouTubeBookmark(video);
    });

    // Wait a bit for localStorage to be updated
    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("test-video-1");
  });

  it("should load bookmarks from localStorage on initialization", () => {
    const testVideos: BookmarkedYouTubeVideo[] = [
      {
        id: "test-video-1",
        title: "Video 1",
        thumbnail: "https://example.com/thumb1.jpg",
        channelTitle: "Channel 1",
        viewCount: "1000",
        publishedAt: "2024-01-01",
        duration: "PT10M",
      },
      {
        id: "test-video-2",
        title: "Video 2",
        thumbnail: "https://example.com/thumb2.jpg",
        channelTitle: "Channel 2",
        viewCount: "2000",
        publishedAt: "2024-01-02",
        duration: "PT15M",
      },
    ];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(testVideos));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BookmarkProvider>{children}</BookmarkProvider>
    );
    const { result } = renderHook(() => useBookmark(), { wrapper });

    // After hydration, bookmarks should be loaded from localStorage
    expect(result.current.bookmarkedYouTubeVideos).toHaveLength(2);
    expect(result.current.bookmarkedYouTubeVideos[0].id).toBe("test-video-1");
    expect(result.current.bookmarkedYouTubeVideos[1].id).toBe("test-video-2");
  });

  it("should persist bookmarks to localStorage when removed", () => {
    const testVideos: BookmarkedYouTubeVideo[] = [
      {
        id: "test-video-1",
        title: "Video 1",
        thumbnail: "https://example.com/thumb1.jpg",
        channelTitle: "Channel 1",
        viewCount: "1000",
        publishedAt: "2024-01-01",
        duration: "PT10M",
      },
    ];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(testVideos));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BookmarkProvider>{children}</BookmarkProvider>
    );
    const { result } = renderHook(() => useBookmark(), { wrapper });

    expect(result.current.bookmarkedYouTubeVideos).toHaveLength(1);

    act(() => {
      result.current.removeYouTubeBookmark("test-video-1");
    });

    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(0);
  });
});
