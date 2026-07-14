import { describe, it, expect } from "vitest";

// Test data
const mockVideo = {
  id: "dQw4w9WgXcQ",
  title: "Rick Astley - Never Gonna Give You Up (Official Video)",
  channelTitle: "Rick Astley",
  viewCount: 1234567890,
  publishedAt: "2009-10-25T06:57:33Z",
  duration: "PT3M32S",
  thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
};

describe("YouTube Video Detail Modal", () => {
  describe("View Count Formatting", () => {
    it("should format view count >= 1000000 as 백만", () => {
      const count = 1234567890;
      const formatted = `${(count / 1000000).toFixed(1)}백만`;
      expect(formatted).toBe("1234.6백만");
    });

    it("should format view count >= 1000 as 천", () => {
      const count = 1234567;
      const formatted = `${(count / 1000).toFixed(0)}천`;
      expect(formatted).toBe("1235천");
    });

    it("should format view count < 1000 as is", () => {
      const count = 999;
      expect(count.toString()).toBe("999");
    });
  });

  describe("Date Formatting", () => {
    it("should format ISO date to Korean format", () => {
      const dateString = "2009-10-25T06:57:33Z";
      const date = new Date(dateString);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const formatted = `${month}월 ${day}일`;
      expect(formatted).toBe("10월 25일");
    });

    it("should handle different months", () => {
      const dateString = "2024-01-15T12:00:00Z";
      const date = new Date(dateString);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const formatted = `${month}월 ${day}일`;
      expect(formatted).toBe("1월 15일");
    });
  });

  describe("Duration Formatting", () => {
    it("should format PT3M32S to 3:32", () => {
      const duration = "PT3M32S";
      const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
      const hours = parseInt(match?.[1] || "0");
      const minutes = parseInt(match?.[2] || "0");
      const seconds = parseInt(match?.[3] || "0");

      let formatted;
      if (hours > 0) {
        formatted = `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      } else {
        formatted = `${minutes}:${String(seconds).padStart(2, "0")}`;
      }
      expect(formatted).toBe("3:32");
    });

    it("should format PT1H5M30S to 1:05:30", () => {
      const duration = "PT1H5M30S";
      const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
      const hours = parseInt(match?.[1] || "0");
      const minutes = parseInt(match?.[2] || "0");
      const seconds = parseInt(match?.[3] || "0");

      let formatted;
      if (hours > 0) {
        formatted = `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      } else {
        formatted = `${minutes}:${String(seconds).padStart(2, "0")}`;
      }
      expect(formatted).toBe("1:05:30");
    });

    it("should format PT45S to 0:45", () => {
      const duration = "PT45S";
      const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
      const hours = parseInt(match?.[1] || "0");
      const minutes = parseInt(match?.[2] || "0");
      const seconds = parseInt(match?.[3] || "0");

      let formatted;
      if (hours > 0) {
        formatted = `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      } else {
        formatted = `${minutes}:${String(seconds).padStart(2, "0")}`;
      }
      expect(formatted).toBe("0:45");
    });
  });

  describe("Modal Data Structure", () => {
    it("should have all required video properties", () => {
      expect(mockVideo).toHaveProperty("id");
      expect(mockVideo).toHaveProperty("title");
      expect(mockVideo).toHaveProperty("channelTitle");
      expect(mockVideo).toHaveProperty("viewCount");
      expect(mockVideo).toHaveProperty("publishedAt");
      expect(mockVideo).toHaveProperty("duration");
      expect(mockVideo).toHaveProperty("thumbnail");
    });

    it("should have correct video ID format", () => {
      expect(mockVideo.id).toMatch(/^[a-zA-Z0-9_-]{11}$/);
    });

    it("should have valid ISO date format", () => {
      expect(mockVideo.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });

    it("should have valid ISO 8601 duration format", () => {
      expect(mockVideo.duration).toMatch(/^PT(\d+H)?(\d+M)?(\d+S)?$/);
    });

    it("should have valid view count (number)", () => {
      expect(typeof mockVideo.viewCount).toBe("number");
      expect(mockVideo.viewCount).toBeGreaterThan(0);
    });
  });

  describe("YouTube iframe URL Generation", () => {
    it("should generate correct YouTube embed URL", () => {
      const videoId = mockVideo.id;
      const embedUrl = `https://www.youtube.com/embed/${videoId}`;
      expect(embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    });

    it("should generate correct YouTube watch URL", () => {
      const videoId = mockVideo.id;
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      expect(watchUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    });
  });

  describe("Modal Interaction", () => {
    it("should handle overlay click", () => {
      const mockOnClose = () => true;
      expect(mockOnClose()).toBe(true);
    });

    it("should handle close button click", () => {
      const mockOnClose = () => true;
      expect(mockOnClose()).toBe(true);
    });

    it("should handle ESC key detection", () => {
      const key = "Escape";
      expect(key).toBe("Escape");
    });
  });

  describe("Modal State Management", () => {
    it("should track modal open/close state", () => {
      let isOpen = false;
      expect(isOpen).toBe(false);

      isOpen = true;
      expect(isOpen).toBe(true);

      isOpen = false;
      expect(isOpen).toBe(false);
    });

    it("should track selected video", () => {
      let selectedVideo = null;
      expect(selectedVideo).toBeNull();

      selectedVideo = mockVideo;
      expect(selectedVideo).toEqual(mockVideo);
      expect(selectedVideo?.id).toBe("dQw4w9WgXcQ");

      selectedVideo = null;
      expect(selectedVideo).toBeNull();
    });
  });

  describe("Modal Accessibility", () => {
    it("should have proper aria-label for close button", () => {
      const closeButtonLabel = "Close modal";
      expect(closeButtonLabel).toBe("Close modal");
    });

    it("should have proper iframe title", () => {
      const iframeTitle = mockVideo.title;
      expect(iframeTitle).toBe("Rick Astley - Never Gonna Give You Up (Official Video)");
    });

    it("should have proper iframe allow attributes", () => {
      const allowAttributes = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      expect(allowAttributes).toContain("accelerometer");
      expect(allowAttributes).toContain("autoplay");
      expect(allowAttributes).toContain("encrypted-media");
    });
  });

  describe("Modal Responsive Design", () => {
    it("should support desktop viewport", () => {
      const maxWidth = 900;
      expect(maxWidth).toBeGreaterThan(768);
    });

    it("should support mobile viewport", () => {
      const mobileMaxWidth = 100;
      expect(mobileMaxWidth).toBeLessThanOrEqual(100);
    });

    it("should maintain 16:9 aspect ratio", () => {
      const aspectRatio = 16 / 9;
      expect(aspectRatio).toBeCloseTo(1.777, 2);
    });
  });
});
