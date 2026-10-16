import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useBookmark } from "@/contexts/BookmarkContext";
import { trpc } from "@/lib/trpc";
import { YouTubeVideoDetailModal } from "@/components/YouTubeVideoDetailModal";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import { GoogleLogo, YouTubeLogo } from "@/components/ServiceLogos";
import { Bookmark, ChevronDown, Instagram, LoaderCircle, MessageCircleMore, Music2, Newspaper, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

// Format view count (e.g., 74540 → 7.4만)
const formatViewCount = (count: string): string => {
  const num = parseInt(count, 10);
  if (isNaN(num)) return count;
  
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}백만`;
  } else if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}만`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}천`;
  }
  return num.toString();
};

const formatCheckedAt = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}.${month}.${day} ${hours}:${minutes} 기준`;
};

// Format saved date (today → "오늘", yesterday → "어제", else → "M월 D일")
const formatSavedDate = (savedAt?: string): string => {
  if (!savedAt) return "방금";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const currentDate = new Date(savedAt);
  if (Number.isNaN(currentDate.getTime())) return "-";
  currentDate.setHours(0, 0, 0, 0);
  
  if (currentDate.getTime() === today.getTime()) {
    return "오늘";
  } else if (currentDate.getTime() === yesterday.getTime()) {
    return "어제";
  } else {
    const month = currentDate.getMonth() + 1;
    const date = currentDate.getDate();
    return `${month}월 ${date}일`;
  }
};

const SECTIONS = [
  { id: "youtube", label: "YouTube", icon: <YouTubeLogo className="savedContentsBrandIcon" /> },
  { id: "naver", label: "네이버", icon: <img className="savedContentsBrandIcon" src="/naver-favicon.png" alt="" /> },
  { id: "google-trends", label: "검색 트렌드", icon: <GoogleLogo className="savedContentsBrandIcon" /> },
  { id: "news-issues", label: "뉴스 & 이슈", icon: <Newspaper className="savedContentsBrandIcon" aria-hidden="true" /> },
  { id: "community", label: "커미니티 반응", icon: <MessageCircleMore className="savedContentsBrandIcon" aria-hidden="true" /> },
];

const VIDEO_PLATFORMS = [
  { id: "youtube", label: "YouTube", icon: <YouTubeLogo className="savedContentsBrandIcon" /> },
  { id: "tiktok", label: "TikTok", icon: <Music2 className="savedContentsBrandIcon" aria-hidden="true" /> },
  { id: "instagram", label: "Instagram", icon: <Instagram className="savedContentsBrandIcon" aria-hidden="true" /> },
];

type SavedTikTokVideo = {
  videoId: string;
  videoUrl: string;
  title: string;
  authorName: string;
  authorUrl: string;
  thumbnailUrl: string | null;
  savedAt: string;
};

type SavedInstagramPost = {
  shortcode: string;
  mediaType: "p" | "reel";
  postUrl: string;
  title: string;
  authorName: string | null;
  authorUrl: string | null;
  thumbnailUrl: string | null;
  savedAt: string;
};

export default function SavedContents() {
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { bookmarkedYouTubeVideos, removeYouTubeBookmark, isBookmarkPending, isLoading: bookmarksLoading } = useBookmark();
  const [showGuestPrompt, setShowGuestPrompt] = useState(true);
  const [activeSectionId, setActiveSectionId] = useState(() => {
    if (typeof window === "undefined") return SECTIONS[0].id;
    const requestedSection = new URLSearchParams(window.location.search).get("tab");
    return SECTIONS.some(section => section.id === requestedSection) ? requestedSection! : SECTIONS[0].id;
  });
  const [selectedVideoPlatformId, setSelectedVideoPlatformId] = useState(() => {
    if (typeof window === "undefined") return VIDEO_PLATFORMS[0].id;
    const requestedPlatform = new URLSearchParams(window.location.search).get("platform");
    return VIDEO_PLATFORMS.some(platform => platform.id === requestedPlatform) ? requestedPlatform! : VIDEO_PLATFORMS[0].id;
  });
  const [isVideoPlatformMenuOpen, setIsVideoPlatformMenuOpen] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [tiktokUrlInput, setTikTokUrlInput] = useState("");
  const [instagramUrlInput, setInstagramUrlInput] = useState("");
  const [tabsWidth, setTabsWidth] = useState<number | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTikTokVideo, setSelectedTikTokVideo] = useState<SavedTikTokVideo | null>(null);
  const [selectedInstagramPost, setSelectedInstagramPost] = useState<SavedInstagramPost | null>(null);
  const activeSection = SECTIONS.find((section) => section.id === activeSectionId) || SECTIONS[0];
  const selectedVideoPlatform =
    VIDEO_PLATFORMS.find((platform) => platform.id === selectedVideoPlatformId) || VIDEO_PLATFORMS[0];
  const utils = trpc.useUtils();
  const addVideoFromUrl = trpc.youtubeBookmarks.addFromUrl.useMutation();
  const addTikTokFromUrl = trpc.tiktokBookmarks.addFromUrl.useMutation();
  const addInstagramFromUrl = trpc.instagramBookmarks.addFromUrl.useMutation();
  const removeTikTokBookmark = trpc.tiktokBookmarks.remove.useMutation({
    onSuccess: () => void utils.tiktokBookmarks.list.invalidate(),
    onError: () => toast.error("TikTok 영상 보관을 해제하지 못했습니다."),
  });
  const { data: tiktokBookmarks = [], isLoading: tiktokLoading, error: tiktokError, refetch: refetchTikTok } = trpc.tiktokBookmarks.list.useQuery(undefined, {
    enabled: isAuthenticated && activeSectionId === "youtube" && selectedVideoPlatformId === "tiktok",
  });
  const removeInstagramBookmark = trpc.instagramBookmarks.remove.useMutation({
    onSuccess: () => void utils.instagramBookmarks.list.invalidate(),
    onError: () => toast.error("Instagram 보관을 해제하지 못했습니다."),
  });
  const { data: instagramBookmarks = [], isLoading: instagramLoading, error: instagramError, refetch: refetchInstagram } = trpc.instagramBookmarks.list.useQuery(undefined, {
    enabled: isAuthenticated && activeSectionId === "youtube" && selectedVideoPlatformId === "instagram",
  });
  const { data: trackedData, error: trackingError, isFetching: isTracking, refetch: refreshTracking } = trpc.youtubeBookmarks.trackSavedVideos.useQuery({ accountKey: user?.id || "" }, {
    enabled: isAuthenticated && activeSectionId === "youtube" && selectedVideoPlatformId === "youtube" && bookmarkedYouTubeVideos.length > 0,
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const trackedVideoById = new Map(trackedData?.videos.map(video => [video.id, video]) || []);
  const videoChannels = trackedData?.channels ?? Array.from(new Map(bookmarkedYouTubeVideos
    .filter(video => video.channelId || video.channelTitle)
    .map(video => [video.channelId || video.channelTitle, {
      channelId: video.channelId || "",
      title: video.channelTitle,
      thumbnail: video.channelThumbnail || "",
      latestVideos: [],
    }])).values());

  const openRecentVideo = (
    recent: { videoId: string; title: string; thumbnail: string; publishedAt: string; viewCount: number; commentCount: number; duration: string; categoryId: string; tags: string[] },
    channel: { title: string; thumbnail: string },
  ) => {
    setSelectedVideo({
      id: recent.videoId,
      title: recent.title,
      channelTitle: channel.title,
      channelThumbnail: channel.thumbnail,
      viewCount: recent.viewCount,
      commentCount: recent.commentCount,
      publishedAt: recent.publishedAt,
      duration: recent.duration,
      categoryId: recent.categoryId,
      tags: recent.tags,
      useStoredSnapshot: true,
    });
    setIsModalOpen(true);
  };

  const saveVideoFromUrl = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthenticated) {
      setShowGuestPrompt(true);
      return;
    }
    if (selectedVideoPlatform.id === "tiktok") {
      if (addTikTokFromUrl.isPending) return;
      try {
        const result = await addTikTokFromUrl.mutateAsync({ url: tiktokUrlInput.trim() });
        if (result.alreadySaved) {
          toast.info("이미 보관한 TikTok 영상입니다.");
          return;
        }
        setTikTokUrlInput("");
        await utils.tiktokBookmarks.list.invalidate();
        toast.success("TikTok 영상을 보관했습니다.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "TikTok 영상을 보관하지 못했습니다.");
      }
      return;
    }
    if (selectedVideoPlatform.id === "instagram") {
      if (addInstagramFromUrl.isPending) return;
      try {
        const result = await addInstagramFromUrl.mutateAsync({ url: instagramUrlInput.trim() });
        if (result.alreadySaved) {
          toast.info("이미 보관한 Instagram 게시물입니다.");
          return;
        }
        setInstagramUrlInput("");
        await utils.instagramBookmarks.list.invalidate();
        toast.success("Instagram 게시물을 보관했습니다.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Instagram 게시물을 보관하지 못했습니다.");
      }
      return;
    }
    if (addVideoFromUrl.isPending) return;

    try {
      const result = await addVideoFromUrl.mutateAsync({ url: videoUrlInput.trim() });
      if (result.alreadySaved) {
        toast.info("이미 보관한 영상입니다.");
        return;
      }
      setVideoUrlInput("");
      await utils.youtubeBookmarks.list.invalidate();
      void utils.youtubeBookmarks.trackSavedVideos.invalidate();
      toast.success("영상을 보관했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "영상을 보관하지 못했습니다.");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedSection = params.get("tab");
    const requestedPlatform = params.get("platform");
    setActiveSectionId(SECTIONS.some(section => section.id === requestedSection) ? requestedSection! : SECTIONS[0].id);
    setSelectedVideoPlatformId(
      VIDEO_PLATFORMS.some(platform => platform.id === requestedPlatform) ? requestedPlatform! : VIDEO_PLATFORMS[0].id,
    );
  }, [location]);

  useEffect(() => {
    const tabs = tabsRef.current;
    if (!tabs) return;
    const observer = new ResizeObserver(() => setTabsWidth(tabs.getBoundingClientRect().width));
    observer.observe(tabs);
    return () => observer.disconnect();
  }, [authLoading, isAuthenticated]);

  const syncSavedContentsUrl = (sectionId: string, platformId = selectedVideoPlatformId) => {
    const params = new URLSearchParams();
    if (sectionId !== SECTIONS[0].id) params.set("tab", sectionId);
    if (sectionId === "youtube" && platformId !== VIDEO_PLATFORMS[0].id) params.set("platform", platformId);
    const queryString = params.toString();
    setLocation(`/saved-contents${queryString ? `?${queryString}` : ""}`);
  };

  const renderSectionContent = () => {
    if (!isAuthenticated) {
      return (
        <div className="savedContentsStatus" role="status">
          <p>로그인 후 저장한 내용을 확인할 수 있습니다.</p>
        </div>
      );
    }

    if (activeSection.id === "youtube" && selectedVideoPlatform.id === "tiktok") {
      if (tiktokLoading) {
        return <div className="savedContentsStatus" role="status"><LoaderCircle className="refreshIconSpinning" aria-hidden="true" /><span>저장된 내용을 불러오는 중</span></div>;
      }
      if (tiktokError) {
        return <div className="savedContentsStatus" role="status"><p>TikTok 보관함을 불러오지 못했습니다.</p><button type="button" onClick={() => void refetchTikTok()}>다시 시도</button></div>;
      }
      if (tiktokBookmarks.length === 0) {
        return <div className="savedContentsStatus" role="status"><p>저장된 내용이 없습니다.</p></div>;
      }
      return (
        <div className="tiktokSavedGrid">
          {tiktokBookmarks.map(video => (
            <article key={video.videoId} className="tiktokSavedCard">
              <div className="tiktokSavedThumbnail">
                <button type="button" className="tiktokSavedPreview" onClick={() => setSelectedTikTokVideo(video)} aria-label={`${video.title} 재생`}>
                  <Music2 size={26} aria-hidden="true" />
                  {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = "none"; }} />}
                </button>
                <button
                  type="button"
                  className="tiktokSavedRemove"
                  title="보관 해제"
                  aria-label={`${video.title} 보관 해제`}
                  disabled={removeTikTokBookmark.isPending}
                  onClick={() => removeTikTokBookmark.mutate({ videoId: video.videoId })}
                >
                  <Bookmark size={19} fill="currentColor" aria-hidden="true" />
                </button>
              </div>
              <div className="tiktokSavedDetails">
                <button type="button" className="tiktokSavedTitle" onClick={() => setSelectedTikTokVideo(video)}>{video.title}</button>
                <div className="tiktokSavedMeta">
                  <a className="tiktokSavedAuthor" href={video.authorUrl} target="_blank" rel="noopener noreferrer">
                    <span className="tiktokSavedAvatar" aria-hidden="true">{video.authorName.trim().charAt(0).toUpperCase() || "T"}</span>
                    <span className="tiktokSavedAuthorName">{video.authorName}</span>
                  </a>
                  <span className="tiktokSavedDate">{formatSavedDate(video.savedAt)} 저장</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      );
    }

    if (activeSection.id === "youtube" && selectedVideoPlatform.id === "instagram") {
      if (instagramLoading) {
        return <div className="savedContentsStatus" role="status"><LoaderCircle className="refreshIconSpinning" aria-hidden="true" /><span>저장된 내용을 불러오는 중</span></div>;
      }
      if (instagramError) {
        return <div className="savedContentsStatus" role="status"><p>Instagram 보관함을 불러오지 못했습니다.</p><button type="button" onClick={() => void refetchInstagram()}>다시 시도</button></div>;
      }
      if (instagramBookmarks.length === 0) {
        return <div className="savedContentsStatus" role="status"><p>저장된 내용이 없습니다.</p></div>;
      }
      return (
        <div className="tiktokSavedGrid">
          {instagramBookmarks.map(post => (
            <article key={`${post.mediaType}-${post.shortcode}`} className="tiktokSavedCard">
              <div className="tiktokSavedThumbnail">
                <button type="button" className="tiktokSavedPreview instagramSavedPreview" onClick={() => setSelectedInstagramPost(post)} aria-label={`${post.title} 보기`}>
                  <Instagram size={28} aria-hidden="true" />
                  {post.thumbnailUrl && <img src={post.thumbnailUrl} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = "none"; }} />}
                </button>
                <button
                  type="button"
                  className="tiktokSavedRemove"
                  title="보관 해제"
                  aria-label={`${post.title} 보관 해제`}
                  disabled={removeInstagramBookmark.isPending}
                  onClick={() => removeInstagramBookmark.mutate({ shortcode: post.shortcode, mediaType: post.mediaType })}
                >
                  <Bookmark size={19} fill="currentColor" aria-hidden="true" />
                </button>
              </div>
              <div className="tiktokSavedDetails">
                <button type="button" className="tiktokSavedTitle" onClick={() => setSelectedInstagramPost(post)}>{post.title}</button>
                <div className="tiktokSavedMeta">
                  {post.authorUrl ? (
                    <a className="tiktokSavedAuthor" href={post.authorUrl} target="_blank" rel="noopener noreferrer">
                      <span className="tiktokSavedAvatar" aria-hidden="true">{post.authorName?.trim().charAt(0).toUpperCase() || "I"}</span>
                      <span className="tiktokSavedAuthorName">{post.authorName || "Instagram"}</span>
                    </a>
                  ) : (
                    <span className="tiktokSavedAuthor">
                      <span className="tiktokSavedAvatar" aria-hidden="true">I</span>
                      <span className="tiktokSavedAuthorName">{post.authorName || "Instagram"}</span>
                    </span>
                  )}
                  <span className="tiktokSavedDate">{formatSavedDate(post.savedAt)} 저장</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      );
    }

    if (activeSection.id === "youtube" && selectedVideoPlatform.id === "youtube" && bookmarksLoading) {
      return (
        <div className="savedContentsStatus" role="status">
          <LoaderCircle className="refreshIconSpinning" aria-hidden="true" />
          <span>저장된 내용을 불러오는 중</span>
        </div>
      );
    }

    if (
      activeSection.id === "youtube" &&
      selectedVideoPlatform.id === "youtube" &&
      bookmarkedYouTubeVideos.length > 0
    ) {
      return (
        <div className="savedYouTubeGroups">
          {bookmarkedYouTubeVideos.length > 0 && <><div className="savedYouTubeGroupHeading">
            <h3>저장한 영상</h3>
            <div className="savedYouTubeTrackingStatus">
              {trackedData?.checkedAt && <span>{formatCheckedAt(trackedData.checkedAt)}</span>}
              <button type="button" onClick={() => refreshTracking()} disabled={isTracking} title="최신 정보 확인" aria-label="최신 정보 확인">
                <RefreshCw size={15} className={isTracking ? "refreshIconSpinning" : ""} />
              </button>
            </div>
          </div>
          {trackingError && <p className="savedYouTubeTrackingNotice">현재 정보를 불러오지 못했습니다. 저장 당시 정보로 표시합니다.</p>}
          <div className="youtubeCardsGrid">
          {bookmarkedYouTubeVideos.map((savedVideo) => {
            const trackedVideo = trackedVideoById.get(savedVideo.id);
            const video = trackedVideo || savedVideo;
            const savedViewCount = Number(savedVideo.viewCount || 0);
            const viewIncrease = trackedVideo && savedViewCount > 0
              ? trackedVideo.viewCount - savedViewCount
              : null;
            const channel = videoChannels.find(item => item.channelId
              ? item.channelId === video.channelId
              : item.title === video.channelTitle);
            const recentVideos = channel?.latestVideos.filter(item => item.videoId !== video.id).slice(0, 3) || [];
            return (
            <div
              key={video.id}
              className="youtubeContentCard"
              onClick={() => {
                setSelectedVideo({ ...video, viewCount: Number(video.viewCount || 0) });
                setIsModalOpen(true);
              }}
              style={{ cursor: "pointer" }}
            >
              <div className="cardThumbnail">
                <img src={video.thumbnail} alt={video.title} />
                <button
                  type="button"
                  className="savedVideoBookmarkButton"
                  title="보관 해제"
                  aria-label={`${video.title} 보관 해제`}
                  disabled={isBookmarkPending(video.id)}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeYouTubeBookmark(video.id);
                  }}
                >
                  <Bookmark size={20} fill="currentColor" />
                </button>
              </div>
              <div className="cardContent">
                <h3 className="cardTitle">{video.title}</h3>
                <div className="cardChannel">
                  {video.channelThumbnail || channel?.thumbnail ? (
                    <img src={video.channelThumbnail || channel?.thumbnail} alt="" />
                  ) : (
                    <span className="cardChannelFallback" aria-hidden="true">{video.channelTitle?.charAt(0) || "Y"}</span>
                  )}
                  <span>{video.channelTitle}</span>
                </div>
                <div className="cardMeta">
                  <div className="savedVideoViewRow">
                    <span>{trackedVideo?.available ? "현재" : "저장 당시"} {formatViewCount(String(video.viewCount))} 조회</span>
                    {viewIncrease !== null && <span className={`savedYouTubeViewIncrease${viewIncrease < 0 ? " decreased" : ""}`}>저장 후 {viewIncrease < 0 ? "-" : "+"}{formatViewCount(String(Math.abs(viewIncrease)))} 조회</span>}
                  </div>
                  <span className="cardSavedDate">저장일: {formatSavedDate(savedVideo.savedAt || trackedVideo?.savedAt)}</span>
                </div>
              </div>
              {channel && recentVideos.length > 0 && (
                <div className="savedYouTubeCardRecent">
                  <span>채널 최근 영상</span>
                  <div className="savedYouTubeRecentVideos">
                    {recentVideos.map(recent => (
                      <button
                        key={recent.videoId}
                        type="button"
                        className="savedYouTubeRecentVideo"
                        onClick={(event) => {
                          event.stopPropagation();
                          openRecentVideo(recent, channel);
                        }}
                        title={recent.title}
                      >
                        <img src={recent.thumbnail} alt="" />
                        <span className="savedYouTubeRecentTitle">{recent.title}</span>
                        <span className="savedYouTubeRecentViews">조회수 {formatViewCount(String(recent.viewCount))}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
          })}
          </div>
          </>}
        </div>
      );
    }

    return (
      <div className="savedContentsStatus" role="status">
        <p>저장된 내용이 없습니다.</p>
      </div>
    );
  };

  const handleSectionChange = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setIsVideoPlatformMenuOpen(false);
    syncSavedContentsUrl(sectionId);
  };

  const handleGuestAuth = (mode: "login" | "signup") => {
    const params = new URLSearchParams({ redirect: "/saved-contents" });
    if (mode === "signup") params.set("mode", "signup");
    setShowGuestPrompt(false);
    setLocation(`/login?${params.toString()}`);
  };

  return (
    <div className="savedContentsPageContainer">
      {/* Page Header */}
      <div className="pageHeader">
        <h1 className="pageTitle">내 보관함</h1>
        <p className="pageDescription">저장한 콘텐츠를 플랫폼별로 확인하고 관리하세요.</p>
      </div>

      {!authLoading && (
      <>
      <div
        className="savedContentsTabsArea"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsVideoPlatformMenuOpen(false);
          }
        }}
      >
        <div ref={tabsRef} className="savedContentsTabs" role="tablist" aria-label="보관함 콘텐츠 분류">
          {SECTIONS.map((section) => {
            if (section.id === "youtube") {
              return (
                <div key={section.id} className="savedContentsTabDropdown">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeSection.id === section.id}
                  aria-haspopup="listbox"
                  aria-expanded={isVideoPlatformMenuOpen}
                  className={`savedContentsTab savedContentsTabWithChevron ${activeSection.id === section.id ? "active" : ""}`}
                  onClick={() => {
                    setActiveSectionId(section.id);
                    syncSavedContentsUrl(section.id);
                    setIsVideoPlatformMenuOpen((isOpen) => !isOpen);
                  }}
                >
                  <span className="savedContentsTabIcon">{selectedVideoPlatform.icon}</span>
                  <span>{selectedVideoPlatform.label}</span>
                  <ChevronDown
                    className={`savedContentsTabChevron ${isVideoPlatformMenuOpen ? "open" : ""}`}
                    size={14}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </button>
              </div>
            );
          }

            return (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={activeSection.id === section.id}
                className={`savedContentsTab ${activeSection.id === section.id ? "active" : ""}`}
                onClick={() => handleSectionChange(section.id)}
              >
                <span className="savedContentsTabIcon">{section.icon}</span>
                <span>{section.label}</span>
              </button>
            );
          })}
        </div>

        {isVideoPlatformMenuOpen && (
          <div className="savedContentsTabMenu" role="listbox" aria-label="영상 플랫폼 선택">
            {VIDEO_PLATFORMS.map((platform) => (
              <button
                key={platform.id}
                type="button"
                role="option"
                aria-selected={selectedVideoPlatform.id === platform.id}
                className={`savedContentsTabMenuItem ${selectedVideoPlatform.id === platform.id ? "active" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setSelectedVideoPlatformId(platform.id);
                  setActiveSectionId("youtube");
                  syncSavedContentsUrl("youtube", platform.id);
                  setIsVideoPlatformMenuOpen(false);
                }}
              >
                <span>{platform.icon}</span>
                <span>{platform.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <section className="savedContentsSection" aria-label={activeSection.id === "youtube" ? selectedVideoPlatform.label : activeSection.label}>
        {activeSection.id !== "youtube" && (
          <div className="sectionHeader">
            <span className="sectionIcon">{activeSection.icon}</span>
            <h2 className="sectionTitle">{activeSection.label}</h2>
          </div>
        )}
        {activeSection.id === "youtube" && ["youtube", "tiktok", "instagram"].includes(selectedVideoPlatform.id) && (
          <div className="sectionHeader savedContentsVideoHeader">
            <form
              className="savedContentsVideoUrlForm"
              style={tabsWidth ? { width: `min(100%, ${tabsWidth}px)` } : undefined}
              onSubmit={saveVideoFromUrl}
              noValidate={!isAuthenticated}
            >
              <input
                type="url"
                value={selectedVideoPlatform.id === "tiktok" ? tiktokUrlInput : selectedVideoPlatform.id === "instagram" ? instagramUrlInput : videoUrlInput}
                onChange={event => selectedVideoPlatform.id === "tiktok" ? setTikTokUrlInput(event.target.value) : selectedVideoPlatform.id === "instagram" ? setInstagramUrlInput(event.target.value) : setVideoUrlInput(event.target.value)}
                placeholder={selectedVideoPlatform.id === "instagram" ? "Instagram 게시물·릴스 URL" : `${selectedVideoPlatform.label} 영상 URL`}
                aria-label={selectedVideoPlatform.id === "instagram" ? "보관할 Instagram 게시물 또는 릴스 URL" : `보관할 ${selectedVideoPlatform.label} 영상 URL`}
                autoComplete="url"
                required={isAuthenticated}
              />
              <button type="submit" disabled={isAuthenticated && (selectedVideoPlatform.id === "tiktok" ? addTikTokFromUrl.isPending || !tiktokUrlInput.trim() : selectedVideoPlatform.id === "instagram" ? addInstagramFromUrl.isPending || !instagramUrlInput.trim() : addVideoFromUrl.isPending || !videoUrlInput.trim())}>
                {(selectedVideoPlatform.id === "tiktok" ? addTikTokFromUrl.isPending : selectedVideoPlatform.id === "instagram" ? addInstagramFromUrl.isPending : addVideoFromUrl.isPending) ? "저장 중" : "저장"}
              </button>
            </form>
          </div>
        )}

        <div className="contentListArea">
          {renderSectionContent()}
        </div>
      </section>

      {/* YouTube Video Detail Modal */}
      {selectedVideo && (
        <YouTubeVideoDetailModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedVideo(null);
          }}
          video={selectedVideo}
          useStoredSnapshot={Boolean(selectedVideo.useStoredSnapshot)}
        />
      )}
      <Dialog open={Boolean(selectedTikTokVideo)} onOpenChange={open => { if (!open) setSelectedTikTokVideo(null); }}>
        {selectedTikTokVideo && (
          <DialogContent className="tiktokSavedDialog">
            <div className="tiktokSavedPlayer">
              <iframe
                src={`https://www.tiktok.com/player/v1/${encodeURIComponent(selectedTikTokVideo.videoId)}`}
                title={selectedTikTokVideo.title}
                allow="fullscreen; autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
            <div className="tiktokSavedDialogDetails tiktokSavedVideoDialogDetails">
              <span className="tiktokSavedDialogDate">저장일: {formatSavedDate(selectedTikTokVideo.savedAt)}</span>
              <DialogTitle>{selectedTikTokVideo.title}</DialogTitle>
              <DialogDescription className="sr-only">TikTok 영상 상세보기</DialogDescription>
              <div className="tiktokSavedDialogFooter">
                <a className="tiktokSavedDialogAuthor" href={selectedTikTokVideo.authorUrl} target="_blank" rel="noopener noreferrer">{selectedTikTokVideo.authorName}</a>
                <a className="youtubeVideoModalButton" href={selectedTikTokVideo.videoUrl} target="_blank" rel="noopener noreferrer">틱톡에서 보기</a>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
      <Dialog open={Boolean(selectedInstagramPost)} onOpenChange={open => { if (!open) setSelectedInstagramPost(null); }}>
        {selectedInstagramPost && (
          <DialogContent overlayClassName="z-[10030]" className="tiktokSavedDialog instagramSavedDialog z-[10031]">
            <DialogTitle className="sr-only">{selectedInstagramPost.title}</DialogTitle>
            <DialogDescription className="sr-only">Instagram 릴스 상세보기</DialogDescription>
            <div className="tiktokSavedPlayer instagramSavedPlayer">
              <iframe
                src={`https://www.instagram.com/${selectedInstagramPost.mediaType}/${encodeURIComponent(selectedInstagramPost.shortcode)}/embed/`}
                title={selectedInstagramPost.title}
                allow="encrypted-media"
                loading="lazy"
              />
            </div>
            <div className="instagramSavedDialogFooter">
              <span>저장일: {formatSavedDate(selectedInstagramPost.savedAt)}</span>
            </div>
          </DialogContent>
        )}
      </Dialog>
      </>
      )}
      <GuestAccessPrompt
        open={!authLoading && !isAuthenticated && showGuestPrompt}
        onBrowse={() => setShowGuestPrompt(false)}
        onLogin={() => handleGuestAuth("login")}
        onSignup={() => handleGuestAuth("signup")}
      />
    </div>
  );
}
