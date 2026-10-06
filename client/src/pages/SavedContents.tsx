import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useBookmark } from "@/contexts/BookmarkContext";
import { trpc } from "@/lib/trpc";
import { YouTubeVideoDetailModal } from "@/components/YouTubeVideoDetailModal";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import { GoogleLogo, YouTubeLogo } from "@/components/ServiceLogos";
import { Bookmark, ChevronDown, Trash2, ExternalLink, Instagram, MessageCircleMore, Music2, Newspaper, RefreshCw } from "lucide-react";
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

export default function SavedContents() {
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { bookmarkedYouTubeVideos, removeYouTubeBookmark, isBookmarkPending } = useBookmark();
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
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const activeSection = SECTIONS.find((section) => section.id === activeSectionId) || SECTIONS[0];
  const selectedVideoPlatform =
    VIDEO_PLATFORMS.find((platform) => platform.id === selectedVideoPlatformId) || VIDEO_PLATFORMS[0];
  const utils = trpc.useUtils();
  const { data: channelBookmarks = [] } = trpc.youtubeBookmarks.listChannels.useQuery(undefined, {
    enabled: isAuthenticated && activeSectionId === "youtube" && selectedVideoPlatformId === "youtube",
  });
  const removeChannelBookmark = trpc.youtubeBookmarks.removeChannel.useMutation({
    onSuccess: () => {
      utils.youtubeBookmarks.listChannels.invalidate();
      utils.youtubeBookmarks.trackSavedVideos.invalidate();
    },
    onError: () => toast.error("채널 보관을 해제하지 못했습니다."),
  });
  const { data: trackedData, error: trackingError, isFetching: isTracking, refetch: refreshTracking } = trpc.youtubeBookmarks.trackSavedVideos.useQuery({ accountKey: user?.id || "" }, {
    enabled: isAuthenticated && activeSectionId === "youtube" && selectedVideoPlatformId === "youtube" && (bookmarkedYouTubeVideos.length > 0 || channelBookmarks.length > 0),
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
  const savedChannels = channelBookmarks.map(bookmark =>
    videoChannels.find(channel => channel.channelId === bookmark.channelId) || {
      ...bookmark,
      latestVideos: [],
    },
  );

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedSection = params.get("tab");
    const requestedPlatform = params.get("platform");
    setActiveSectionId(SECTIONS.some(section => section.id === requestedSection) ? requestedSection! : SECTIONS[0].id);
    setSelectedVideoPlatformId(
      VIDEO_PLATFORMS.some(platform => platform.id === requestedPlatform) ? requestedPlatform! : VIDEO_PLATFORMS[0].id,
    );
  }, [location]);

  const syncSavedContentsUrl = (sectionId: string, platformId = selectedVideoPlatformId) => {
    const params = new URLSearchParams();
    if (sectionId !== SECTIONS[0].id) params.set("tab", sectionId);
    if (sectionId === "youtube" && platformId !== VIDEO_PLATFORMS[0].id) params.set("platform", platformId);
    const queryString = params.toString();
    setLocation(`/saved-contents${queryString ? `?${queryString}` : ""}`);
  };

  const renderSectionContent = () => {
    if (
      activeSection.id === "youtube" &&
      selectedVideoPlatform.id === "youtube" &&
      (bookmarkedYouTubeVideos.length > 0 || channelBookmarks.length > 0)
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
          {savedChannels.length > 0 && (
            <section className="savedYouTubeChannelSection" aria-label="보관한 채널">
              <div className="savedYouTubeGroupHeading">
                <h3>보관한 채널</h3>
              </div>
              <div className="savedYouTubeChannelGrid">
                {savedChannels.map(channel => (
                  <article key={channel.channelId || channel.title} className="savedYouTubeChannelCard">
                    <div className="savedYouTubeChannelHeader">
                      {channel.thumbnail ? <img src={channel.thumbnail} alt="" /> : <span className="savedYouTubeChannelAvatar"><YouTubeLogo /></span>}
                      <div>
                        <h4>{channel.title}</h4>
                        {channel.channelId && (
                          <a href={`https://www.youtube.com/channel/${channel.channelId}`} target="_blank" rel="noopener noreferrer">채널 보기 <ExternalLink size={12} /></a>
                        )}
                      </div>
                      <button
                        type="button"
                        className="savedYouTubeChannelRemove"
                        title="채널 보관 해제"
                        aria-label={`${channel.title} 채널 보관 해제`}
                        disabled={removeChannelBookmark.isPending}
                        onClick={() => removeChannelBookmark.mutate({ channelId: channel.channelId })}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="savedYouTubeRecentVideos">
                      {channel.latestVideos.length > 0 ? channel.latestVideos.slice(0, 3).map(recent => (
                        <button
                          key={recent.videoId}
                          type="button"
                          className="savedYouTubeRecentVideo"
                          onClick={() => openRecentVideo(recent, channel)}
                          title={recent.title}
                        >
                          <img src={recent.thumbnail} alt="" />
                          <span className="savedYouTubeRecentTitle">{recent.title}</span>
                          <span className="savedYouTubeRecentViews">조회수 {formatViewCount(String(recent.viewCount))}</span>
                        </button>
                      )) : (
                        <p className="savedYouTubeRecentEmpty">{isTracking ? "최근 영상을 확인하고 있습니다." : "최근 영상을 확인할 수 없습니다."}</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      );
    }

    return (
      <div className="emptyStateContainer">
        <p className="emptyStateText">아직 저장된 콘텐츠가 없습니다.</p>
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
        {isAuthenticated && <p className="pageDescription">저장한 콘텐츠를 플랫폼별로 확인하고 관리하세요.</p>}
      </div>

      {!authLoading && isAuthenticated && (
      <>
      <div
        className="savedContentsTabsArea"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsVideoPlatformMenuOpen(false);
          }
        }}
      >
        <div className="savedContentsTabs" role="tablist" aria-label="보관함 콘텐츠 분류">
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
                  <span className="savedContentsTabIcon">{section.icon}</span>
                  <span>{section.label}</span>
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

      <section className="savedContentsSection" aria-labelledby="saved-contents-section-title">
        <div className="sectionHeader">
          <span className="sectionIcon">
            {activeSection.id === "youtube" ? selectedVideoPlatform.icon : activeSection.icon}
          </span>
          <h2 id="saved-contents-section-title" className="sectionTitle">
            {activeSection.id === "youtube" ? selectedVideoPlatform.label : activeSection.label}
          </h2>
        </div>

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
