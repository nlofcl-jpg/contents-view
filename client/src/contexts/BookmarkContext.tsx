import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

export interface BookmarkedYouTubeVideo {
  id: string;
  contentType?: "video" | "shorts";
  title: string;
  thumbnail: string;
  channelId?: string;
  channelTitle: string;
  channelThumbnail?: string;
  viewCount: string;
  publishedAt: string;
  duration: string;
  categoryId?: number;
  country?: string;
  savedAt?: string;
}

interface BookmarkContextType {
  bookmarkedYouTubeVideos: BookmarkedYouTubeVideo[];
  toggleYouTubeBookmark: (video: BookmarkedYouTubeVideo, contentType: "video" | "shorts") => Promise<void>;
  isYouTubeVideoBookmarked: (videoId: string) => boolean;
  removeYouTubeBookmark: (videoId: string) => void;
  isLoading: boolean;
  isBookmarkPending: (videoId: string) => boolean;
}

const BookmarkContext = createContext<BookmarkContextType | undefined>(undefined);

export function BookmarkProvider({ children }: { children: ReactNode }) {
  const [bookmarkedYouTubeVideos, setBookmarkedYouTubeVideos] = useState<BookmarkedYouTubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingBookmarkIds, setPendingBookmarkIds] = useState<Set<string>>(new Set());

  // ✅ Get auth state to check if user is authenticated
  const { user, loading: authLoading } = useAuth();

  // ✅ Move trpc.useUtils() to component top level (Hook rule compliance)
  const utils = trpc.useUtils();

  // ✅ Only fetch bookmarks when user is authenticated and auth loading is complete
  const { data: dbBookmarks, isLoading: dbLoading, refetch } = trpc.youtubeBookmarks.list.useQuery(undefined, {
    enabled: !!user && !authLoading,
  });

  // Add mutation hooks with optimistic updates
  const removeBookmarkMutation = trpc.youtubeBookmarks.remove.useMutation({
    onMutate: async ({ videoId, contentType }) => {
      // Cancel any outgoing refetches (using utils from component top level)
      await utils.youtubeBookmarks.list.cancel();

      // Snapshot previous state
      const previousBookmarks = bookmarkedYouTubeVideos;

      // Optimistically update local state
      setBookmarkedYouTubeVideos((prev) => prev.filter((v) => v.id !== videoId));

      return { previousBookmarks };
    },
    onError: (err, { videoId }, context) => {
      // Rollback to previous state on error
      if (context?.previousBookmarks) {
        setBookmarkedYouTubeVideos(context.previousBookmarks);
      }
      console.error("Failed to remove bookmark:", err);
      toast.error("북마크를 해제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    },
    onSettled: (data, err, { videoId }) => {
      // Remove from pending set
      setPendingBookmarkIds((prev) => {
        const next = new Set(prev);
        next.delete(videoId);
        return next;
      });
      // Sync with database (using utils from component top level)
      utils.youtubeBookmarks.list.invalidate();
      utils.youtubeBookmarks.trackSavedVideos.invalidate();
    },
  });

  const addBookmarkMutation = trpc.youtubeBookmarks.add.useMutation({
    onMutate: async (input) => {
      // Cancel any outgoing refetches (using utils from component top level)
      await utils.youtubeBookmarks.list.cancel();

      // Snapshot previous state
      const previousBookmarks = bookmarkedYouTubeVideos;

      // Optimistically update local state
      const newVideo: BookmarkedYouTubeVideo = {
        id: input.videoId,
        contentType: input.contentType,
        title: input.title,
        thumbnail: input.thumbnailUrl || "",
        channelId: input.channelId,
        channelTitle: input.channelTitle || "",
        channelThumbnail: input.channelThumbnailUrl,
        viewCount: String(input.viewCount || ""),
        publishedAt: input.publishedAt || "",
        duration: input.duration || "",
      };

      setBookmarkedYouTubeVideos((prev) => [...prev, newVideo]);

      return { previousBookmarks };
    },
    onError: (err, input, context) => {
      // Rollback to previous state on error
      if (context?.previousBookmarks) {
        setBookmarkedYouTubeVideos(context.previousBookmarks);
      }
      console.error("Failed to add bookmark:", err);
      toast.error("북마크를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    },
    onSettled: (data, err, input) => {
      // Remove from pending set
      setPendingBookmarkIds((prev) => {
        const next = new Set(prev);
        next.delete(input.videoId);
        return next;
      });
      // Sync with database (using utils from component top level)
      utils.youtubeBookmarks.list.invalidate();
      utils.youtubeBookmarks.trackSavedVideos.invalidate();
    },
  });

  // Load bookmarks from database on mount or when user changes
  useEffect(() => {
    if (dbBookmarks) {
      const videos: BookmarkedYouTubeVideo[] = dbBookmarks.map((bookmark: any) => ({
        id: bookmark.videoId,
        contentType: bookmark.contentType,
        title: bookmark.title,
        thumbnail: bookmark.thumbnailUrl || "",
        channelId: bookmark.channelId || undefined,
        channelTitle: bookmark.channelTitle || "",
        channelThumbnail: bookmark.channelThumbnailUrl,
        viewCount: bookmark.viewCount || "",
        publishedAt: bookmark.publishedAt || "",
        duration: bookmark.duration || "",
        savedAt: bookmark.createdAt instanceof Date ? bookmark.createdAt.toISOString() : String(bookmark.createdAt || ""),
      }));
      setBookmarkedYouTubeVideos(videos);
    }
    setIsLoading(dbLoading);
  }, [dbBookmarks, dbLoading]);

  // ✅ Clear bookmarks when user logs out
  useEffect(() => {
    if (!user && !authLoading) {
      setBookmarkedYouTubeVideos([]);
      setIsLoading(false);
    }
  }, [user, authLoading]);

  const toggleYouTubeBookmark = async (video: BookmarkedYouTubeVideo, contentType: "video" | "shorts") => {
    const isBookmarked = bookmarkedYouTubeVideos.some((v) => v.id === video.id);

    // Add to pending set
    setPendingBookmarkIds((prev) => new Set(prev).add(video.id));

    try {
      if (isBookmarked) {
        // Remove bookmark - optimistic update happens in onMutate
        await removeBookmarkMutation.mutateAsync({
          videoId: video.id,
          contentType,
        });
      } else {
        // Add bookmark - optimistic update happens in onMutate
        await addBookmarkMutation.mutateAsync({
          videoId: video.id,
          contentType,
          title: video.title,
          thumbnailUrl: video.thumbnail,
          channelId: video.channelId,
          channelTitle: video.channelTitle,
          channelThumbnailUrl: video.channelThumbnail,
          videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
          duration: video.duration,
          viewCount: video.viewCount,
          publishedAt: video.publishedAt,
        });
      }
    } catch (error) {
      console.error("Failed to toggle bookmark:", error);
      // Error handling is done in onError callbacks
    }
  };

  const isYouTubeVideoBookmarked = (videoId: string): boolean => {
    return bookmarkedYouTubeVideos.some((v) => v.id === videoId);
  };

  const isBookmarkPending = (videoId: string): boolean => {
    return pendingBookmarkIds.has(videoId);
  };

  const removeYouTubeBookmark = (videoId: string) => {
    // Find the video to get contentType
    const video = bookmarkedYouTubeVideos.find((v) => v.id === videoId);
    if (!video) return;
    
    // Add to pending set
    setPendingBookmarkIds((prev) => new Set(prev).add(videoId));
    
    // Call the actual mutation (not just remove from state)
    removeBookmarkMutation.mutate({
      videoId,
      contentType: video.contentType || "video",
    });
  };

  return (
    <BookmarkContext.Provider
      value={{
        bookmarkedYouTubeVideos,
        toggleYouTubeBookmark,
        isYouTubeVideoBookmarked,
        removeYouTubeBookmark,
        isLoading,
        isBookmarkPending,
      }}
    >
      {children}
    </BookmarkContext.Provider>
  );
}

export function useBookmark() {
  const context = useContext(BookmarkContext);
  if (!context) {
    throw new Error("useBookmark must be used within BookmarkProvider");
  }
  return context;
}
