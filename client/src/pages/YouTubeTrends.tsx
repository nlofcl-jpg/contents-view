import { useState, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { YouTubeApiStatusCard } from "@/components/YouTubeApiStatusCard";
import { YouTubeVideoDetailModal } from "@/components/YouTubeVideoDetailModal";
import { AlertCircle, CircleAlert, Clock, Play, ChevronDown, RotateCw, Bookmark } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBookmark } from "@/contexts/BookmarkContext";
import { useLocation, useSearch } from "wouter";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import { useIsMobile } from "@/hooks/useMobile";
import "./youtubeRisingPreview.css";

const YOUTUBE_API_KEY_ERROR_MESSAGE = "YouTube API 키 오류입니다.\nAPI 키 확인 후 다시 입력해주세요.";

const TABS = [
  { id: "rising", label: "급상승 영상" },
  { id: "trending", label: "유튜브 추천 영상" },
  { id: "category", label: "카테고리별 인기" },
  { id: "shorts", label: "인기 쇼츠" },
] as const;

type TabType = (typeof TABS)[number]["id"];
const DEFAULT_YOUTUBE_TAB: TabType = "rising";

const COUNTRIES = [
  { value: "KR", label: "한국" },
  { value: "US", label: "미국" },
  { value: "JP", label: "일본" },
  { value: "GB", label: "영국" },
  { value: "FR", label: "프랑스" },
  { value: "ES", label: "스페인" },
  { value: "DE", label: "독일" },
];

const CATEGORIES = [
  { value: "movies", label: "영화/애니", categoryId: 1 },
  { value: "autos", label: "자동차", categoryId: 2 },
  { value: "music", label: "음악", categoryId: 10 },
  { value: "animals", label: "동물", categoryId: 15 },
  { value: "sports", label: "스포츠", categoryId: 17 },
  { value: "travel", label: "여행/이벤트", categoryId: 19 },
  { value: "gaming", label: "게임", categoryId: 20 },
  { value: "people", label: "인물/블로그", categoryId: 22 },
  { value: "comedy", label: "코미디", categoryId: 23 },
  { value: "entertainment", label: "엔터테인먼트", categoryId: 24 },
  { value: "news", label: "뉴스/시사", categoryId: 25 },
  { value: "howto", label: "노하우/스타일", categoryId: 26 },
  { value: "education", label: "교육", categoryId: 27 },
  { value: "tech", label: "과학/기술", categoryId: 28 },
];

const SORT_OPTIONS = {
  trending: [
    { value: "trending", label: "인기순" },
    { value: "viewCount", label: "조회수순" },
    { value: "publishedAt", label: "최신순" },
  ],
  category: [
    { value: "trending", label: "인기순" },
    { value: "viewCount", label: "조회수순" },
    { value: "publishedAt", label: "최신순" },
  ],
  shorts: [
    { value: "trending", label: "인기순" },
    { value: "viewCount", label: "조회수순" },
    { value: "publishedAt", label: "최신순" },
  ],
  rising: [
    { value: "score", label: "상승 지수순" },
    { value: "hourly", label: "시간당 조회순" },
    { value: "outlier", label: "채널 대비순" },
    { value: "newest", label: "최신순" },
  ],
};

const RISING_PERIOD_OPTIONS = [
  { value: "realtime", label: "실시간" },
  { value: "1h", label: "1시간" },
  { value: "6h", label: "6시간" },
  { value: "24h", label: "24시간" },
] as const;

// ISO 8601 duration to readable format (e.g., PT10M30S -> 10:30)
function formatDuration(duration: string): string {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return "0:00";

  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Format view count (e.g., 1000000 -> 100만)
function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}백만`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(0)}천`;
  }
  return count.toString();
}

// Format date (e.g., 2024-06-10T12:00:00Z -> 6월 10일)
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}월 ${day}일`;
}

function YouTubeLoadingState({ message }: { message: string }) {
  return (
    <div className="youtubeLoadingState" role="status" aria-live="polite">
      <span className="youtubeLoadingTrack" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

function YouTubeVideoListLoading({ message, centered = false }: { message: string; centered?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-3 px-3 text-center text-[13px] text-slate-300 ${centered ? "min-h-[max(12rem,calc(100dvh-24rem))] justify-center" : "min-h-28 pt-5"}`} role="status">
      <span className="naverAnalysisProgressTrack" aria-hidden="true" />
      <p className="m-0">{message}</p>
    </div>
  );
}

function YouTubeFilterRow({ children, label, mobile }: { children: ReactNode; label: string; mobile: boolean }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState(0);

  function updateEdges(row: HTMLDivElement) {
    const { scrollLeft, scrollWidth, clientWidth } = row;
    setEdges((scrollLeft > 1 ? 1 : 0) | (scrollWidth - clientWidth - scrollLeft > 1 ? 2 : 0));
  }

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!mobile || !row) return;
    const observer = new ResizeObserver(() => updateEdges(row));
    observer.observe(row);
    updateEdges(row);
    return () => observer.disconnect();
  }, [mobile]);

  return (
    <div
      ref={rowRef}
      className={mobile ? "youtubeTrendFilters" : "filterSection"}
      role="group"
      aria-label={label}
      data-more-left={mobile && Boolean(edges & 1) ? "true" : undefined}
      data-more-right={mobile && Boolean(edges & 2) ? "true" : undefined}
      onScroll={mobile ? event => updateEdges(event.currentTarget) : undefined}
    >
      {children}
    </div>
  );
}

export default function YouTubeTrends() {
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const requestedTab = new URLSearchParams(useSearch()).get("tab");
  const activeTab = TABS.find(tab => tab.id === requestedTab)?.id ?? DEFAULT_YOUTUBE_TAB;
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { toggleYouTubeBookmark, isYouTubeVideoBookmarked, isBookmarkPending } = useBookmark();
  const tabMenuRef = useRef<HTMLDivElement>(null);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [selectedRisingVideo, setSelectedRisingVideo] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRisingGuestPromptOpen, setIsRisingGuestPromptOpen] = useState(false);
  const { data: apiKeyData } = trpc.user.apiKey.getWithStatus.useQuery(
    { provider: "youtube" },
    { enabled: Boolean(user?.id) && !authLoading }
  );
  const [risingGridColumns, setRisingGridColumns] = useState(1);
  const risingPreviewGridRef = useRef<HTMLDivElement>(null);
  const goToRisingAuth = () => {
    setIsRisingGuestPromptOpen(false);
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    setLocation(`/login?redirect=${redirect}`);
  };
  const guestLoginButton = (className = "") => (
    <button
      type="button"
      className={`youtubeGuestLoginButton ${className}`.trim()}
      onClick={() => { window.location.href = getLoginUrl(); }}
    >
      로그인
    </button>
  );
  const renderGuestLoginNotice = (description: string) => (
    <div className="emptyStateContainer">
      <AlertCircle className="emptyStateIcon" size={48} />
      <p className="emptyStateText">
        로그인 후 서비스를 계속 이용해주세요
        <br />
        <span style={{ fontSize: "0.875rem", opacity: 0.8, marginTop: "0.5rem", display: "block" }}>
          {description}
        </span>
      </p>
      {guestLoginButton("youtubeGuestLoginButtonEmpty")}
    </div>
  );
  const [visiblePreviousRecommendedCount, setVisiblePreviousRecommendedCount] = useState(0);
  const [visiblePreviousRisingCount, setVisiblePreviousRisingCount] = useState(0);
  const [visiblePreviousShortsCount, setVisiblePreviousShortsCount] = useState(0);
  const [isExposureCountryInfoOpen, setIsExposureCountryInfoOpen] = useState(false);
  const [lastUpdateTimesByKey, setLastUpdateTimesByKey] = useState<Record<string, number>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [videoCache, setVideoCache] = useState<Record<string, { data: any; previousData?: any[]; fetchedAt: number }>>({});
  const [shortsCache, setShortsCache] = useState<Record<string, { data: any; previousData?: any[]; fetchedAt: number }>>({});
  const [shouldForceRefresh, setShouldForceRefresh] = useState(false);

  useEffect(() => {
    if (requestedTab === "analysis") setLocation("/trends/youtube", { replace: true });
  }, [requestedTab, setLocation]);

  // Manage filters per tab
  const [filtersByTab, setFiltersByTab] = useState({
    trending: {
      country: "KR",
      sort: "trending",
    },
    category: {
      country: "KR",
      category: "movies",
      sort: "trending",
    },
    shorts: {
      country: "KR",
      category: "all",
      sort: "trending",
    },
    rising: {
      country: "KR",
      sort: "score",
      period: "realtime",
    },
  });

  // Get current tab's filters
  const currentFilters = filtersByTab[activeTab];

  // Update current tab's filter
  const updateCurrentFilter = (key: string, value: string) => {
    setFiltersByTab((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [key]: value,
      },
    }));
  };

  // Get current tab's values
  const country = currentFilters.country;
  const sortBy = currentFilters.sort;
  const category = activeTab === "trending" ? "all" : (currentFilters as any).category || "all";
  const risingPeriod = (currentFilters as any).period || "realtime";

  const regionCode = country;

  // Map sort value to API sort parameter
  const apiSortBy = sortBy === "trending"
    ? "trending"
    : sortBy === "viewCount"
      ? "viewCount"
      : "publishedAt";

  // Query for trending videos (only on trending tab)
  // Get selected category's videoCategoryId
  const selectedCategory = CATEGORIES.find((cat) => cat.value === category);
  const videoCategoryId = selectedCategory?.categoryId;

  // Create cache key for current filters
  // Shorts tab doesn't use category, so exclude it from cache key
  // v3: Force cache invalidation - channelThumbnail field must be present
  const cacheKey = activeTab === "shorts" 
    ? `youtube:${activeTab}:${regionCode}:${apiSortBy}:7d:v3`
    : `youtube:${activeTab}:${regionCode}:${category}:${apiSortBy}:v5`;
  const lastUpdateTime = lastUpdateTimesByKey[cacheKey];
  const now = Date.now();
  
  // Check if we should use cache before making API call
  const cached = videoCache[cacheKey];
  // Validate cache has channelThumbnail field (new data structure)
  const hasCacheThumbnailField = cached?.data?.[0]?.channelThumbnail !== undefined;
  // DEBUG: Disable cache for shorts tab to debug empty results
  // Also invalidate cache if it doesn't have the new channelThumbnail field
  const isCacheValid = activeTab === "shorts" ? false : (cached && (Date.now() - cached.fetchedAt) < 3600000 && hasCacheThumbnailField); // 1 hour in ms
  const isExpired = !lastUpdateTime || (now - lastUpdateTime) > 3600000; // 1 hour in ms
  const shouldCallAPI = (isExpired || shouldForceRefresh) && !isCacheValid;

  const { data: videosData, isLoading, error, refetch } = trpc.youtube.getTrendingVideos.useQuery(
    {
      regionCode,
      sortBy: apiSortBy as "trending" | "viewCount" | "publishedAt",
      maxResults: 24,
      videoCategoryId,
    },
    {
      enabled:
        isAuthenticated &&
        (activeTab === "trending" || activeTab === "category") &&
        apiKeyData?.exists &&
        apiKeyData?.testStatus === "success" &&
        shouldCallAPI,
    }
  );

  // Query for trending shorts
  const { data: shortsData, isLoading: isShortsLoading, error: shortsError, refetch: refetchShorts } = trpc.youtube.getTrendingShorts.useQuery(
    {
      regionCode,
      sortBy: apiSortBy as "trending" | "viewCount" | "publishedAt",
      maxResults: 24,
    },
    {
      enabled:
        isAuthenticated &&
        activeTab === "shorts" &&
        apiKeyData?.exists &&
        apiKeyData?.testStatus === "success" &&
        shouldCallAPI,
    }
  );

  const {
    data: risingData,
    isLoading: isRisingLoading,
    error: risingError,
    refetch: refetchRising,
  } = trpc.youtube.getCollectedRisingVideos.useQuery(
    {
      regionCode,
      period: risingPeriod as "realtime" | "1h" | "6h" | "24h",
      subscriberRange: "all",
      sortBy: sortBy as "score" | "hourly" | "outlier" | "newest",
      maxResults: 30,
    },
    {
      enabled: activeTab === "rising",
      staleTime: 5 * 60 * 1000,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  useLayoutEffect(() => {
    const grid = risingPreviewGridRef.current;
    if (!grid) return;

    const measure = () => {
      const columns = getComputedStyle(grid).gridTemplateColumns.trim();
      setRisingGridColumns(columns && columns !== "none" ? columns.split(/\s+/).length : 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [activeTab, authLoading, isAuthenticated, risingData, risingError]);

  // Use cache if available and valid, otherwise use API response
  const displayVideosData = isCacheValid && !shouldForceRefresh
    ? { success: true, videos: cached.data, previousVideos: cached.previousData || [] }
    : videosData;

  // Check if we should use shorts cache before making API call
  const cachedShorts = shortsCache[cacheKey];
  const isShortsCacheValid = cachedShorts && (Date.now() - cachedShorts.fetchedAt) < 3600000; // 1 hour in ms

  // Use cache if available and valid, otherwise use API response
  const displayShortsData = isShortsCacheValid && !shouldForceRefresh && !shortsData?.error
    ? { success: true, videos: cachedShorts.data, previousVideos: cachedShorts.previousData || [] }
    : shortsData;

  // DEBUG: Log first video data when received
  useEffect(() => {
    if (displayVideosData?.success && displayVideosData?.videos?.length > 0) {
      const firstVideo = displayVideosData.videos[0];
      console.log('[DEBUG] YouTubeTrends - First video received:', {
        title: firstVideo.title,
        channelTitle: firstVideo.channelTitle,
        channelId: firstVideo.channelId,
        channelThumbnail: firstVideo.channelThumbnail,
      });
    }
  }, [displayVideosData]);

  // When cache is used, update lastUpdateTimesByKey with cached.fetchedAt
  useEffect(() => {
    if (isCacheValid && !shouldForceRefresh && cached) {
      setLastUpdateTimesByKey((prev) => ({
        ...prev,
        [cacheKey]: cached.fetchedAt,
      }));
    }
  }, [cacheKey, isCacheValid, shouldForceRefresh, cached]);

  // When shorts cache is used, update lastUpdateTimesByKey with cachedShorts.fetchedAt
  useEffect(() => {
    if (isShortsCacheValid && !shouldForceRefresh && cachedShorts) {
      setLastUpdateTimesByKey((prev) => ({
        ...prev,
        [cacheKey]: cachedShorts.fetchedAt,
      }));
    }
  }, [cacheKey, isShortsCacheValid, shouldForceRefresh, cachedShorts]);

  // Update cache and last update time when data is fetched successfully (only on API call, not cache)
  useEffect(() => {
    if (videosData?.success && videosData?.videos && videosData.videos.length > 0 && shouldCallAPI) {
      const fetchedAt = Date.now();
      setVideoCache((prev) => ({
        ...prev,
        [cacheKey]: {
          data: videosData.videos,
          previousData: videosData.previousVideos || [],
          fetchedAt,
        },
      }));
      setLastUpdateTimesByKey((prev) => ({
        ...prev,
        [cacheKey]: fetchedAt,
      }));
    }
  }, [videosData, cacheKey, shouldCallAPI]);

  // Update shorts cache and last update time when data is fetched successfully (only on API call, not cache)
  useEffect(() => {
    if (shortsData?.success && shortsData?.videos && shortsData.videos.length > 0 && shouldCallAPI) {
      const fetchedAt = Date.now();
      setShortsCache((prev) => ({
        ...prev,
        [cacheKey]: {
          data: shortsData.videos,
          previousData: shortsData.previousVideos || [],
          fetchedAt,
        },
      }));
      setLastUpdateTimesByKey((prev) => ({
        ...prev,
        [cacheKey]: fetchedAt,
      }));
    }
  }, [shortsData, cacheKey, shouldCallAPI]);

  // Handle refresh - force refetch and update time only on success
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setShouldForceRefresh(true);
    try {
      // Force refetch by invalidating cache and bypassing 1-hour check
      if (activeTab === "rising") {
        await refetchRising();
      } else if (activeTab === "shorts") {
        const result = await refetchShorts();
        // Update time only if refetch was successful
        if (result.data?.success && result.data?.videos && result.data.videos.length > 0) {
          const fetchedAt = Date.now();
          setShortsCache((prev) => ({
            ...prev,
            [cacheKey]: {
              data: result.data.videos,
              previousData: "previousVideos" in result.data ? result.data.previousVideos || [] : [],
              fetchedAt,
            },
          }));
          setLastUpdateTimesByKey((prev) => ({
            ...prev,
            [cacheKey]: fetchedAt,
          }));
        }
      } else {
        const result = await refetch();
        // Update time only if refetch was successful
        if (result.data?.success && result.data?.videos && result.data.videos.length > 0) {
          const fetchedAt = Date.now();
          setVideoCache((prev) => ({
            ...prev,
            [cacheKey]: {
              data: result.data.videos,
              previousData: "previousVideos" in result.data ? result.data.previousVideos || [] : [],
              fetchedAt,
            },
          }));
          setLastUpdateTimesByKey((prev) => ({
            ...prev,
            [cacheKey]: fetchedAt,
          }));
        }
      }
    } finally {
      setIsRefreshing(false);
      setShouldForceRefresh(false);
    }
  };

  // Force refetch when refresh button is clicked
  const handleRefreshClick = () => {
    handleRefresh();
  };

  const currentSortOptions = SORT_OPTIONS[activeTab as keyof typeof SORT_OPTIONS] || SORT_OPTIONS.trending;

  // Handler functions for current tab
  const handleCountryChange = (value: string) => {
    updateCurrentFilter("country", value);
    setVisiblePreviousRecommendedCount(0);
    setVisiblePreviousRisingCount(0);
    setVisiblePreviousShortsCount(0);
    setIsExposureCountryInfoOpen(false);
  };
  const handleCategoryChange = (value: string) => updateCurrentFilter("category", value);
  const handleSortChange = (value: string) => {
    updateCurrentFilter("sort", value);
    setVisiblePreviousShortsCount(0);
  };
  const handleRisingPeriodChange = (value: string) => {
    updateCurrentFilter("period", value);
    setVisiblePreviousRisingCount(0);
  };
  const handleTabChange = (tabId: TabType) => {
    setVisiblePreviousRecommendedCount(0);
    setVisiblePreviousShortsCount(0);
    setIsExposureCountryInfoOpen(false);
    setLocation(tabId === DEFAULT_YOUTUBE_TAB ? "/trends/youtube" : `/trends/youtube?tab=${tabId}`);
  };

  useEffect(() => {
    const menu = tabMenuRef.current;
    if (!menu || !isMobile) return;
    const selected = menu.querySelector<HTMLElement>(".tabButton.active");
    if (!selected) return;
    const menuBounds = menu.getBoundingClientRect();
    const selectedBounds = selected.getBoundingClientRect();
    menu.scrollTo({ left: menu.scrollLeft + selectedBounds.left - menuBounds.left - 8, behavior: "smooth" });
  }, [activeTab, isMobile]);

  const formatLastUpdateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}.${month}.${day} ${hours}:${minutes} 기준`;
  };

  const renderRecommendationCard = (video: any, isPrevious = false) => {
    const isBookmarked = isYouTubeVideoBookmarked(video.id);
    return (
      <article key={`${isPrevious ? "previous-recommended" : "recommended"}-${video.id}`} className="videoCardWrapper">
        <div
          className="videoCard"
          role="button"
          tabIndex={0}
          onClick={() => {
            setSelectedVideo(video);
            setIsModalOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setSelectedVideo(video);
              setIsModalOpen(true);
            }
          }}
        >
          <div className="videoThumbnail">
            <img src={video.thumbnail} alt={video.title} />
            {isPrevious ? <span className="previousRisingBadge">이전 추천</span> : null}
            <div className="videoDurationBadge">{formatDuration(video.duration)}</div>
            <div className="videoPlayIcon">
              <Play size={32} fill="currentColor" />
            </div>
          </div>
          <div className="videoInfo">
            <h3 className="videoTitle">{video.title}</h3>
            <div className="videoChannelRow">
              <div className="channelProfileImage">
                {video.channelThumbnail ? (
                  <img src={video.channelThumbnail} alt={video.channelTitle} />
                ) : (
                  <div className="channelProfilePlaceholder">{video.channelTitle.charAt(0).toUpperCase()}</div>
                )}
              </div>
              <p className="videoChannel">{video.channelTitle}</p>
            </div>
            <div className="videoMeta">
              <span>{formatViewCount(video.viewCount)} 조회 · {formatDate(video.publishedAt)}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleYouTubeBookmark({
              id: video.id,
              title: video.title,
              thumbnail: video.thumbnail,
              channelId: video.channelId,
              channelTitle: video.channelTitle,
              channelThumbnail: video.channelThumbnail,
              viewCount: video.viewCount,
              publishedAt: video.publishedAt,
              duration: video.duration,
            }, "video");
          }}
          disabled={isBookmarkPending(video.id)}
          className={`bookmarkButton ${isBookmarked ? "bookmarked" : ""} ${isBookmarkPending(video.id) ? "pending" : ""}`}
          title={isBookmarked ? "북마크 해제" : "북마크"}
          aria-label={isBookmarked ? "북마크 해제" : "북마크"}
        >
          <Bookmark size={20} fill={isBookmarked ? "currentColor" : "none"} />
        </button>
      </article>
    );
  };

  const renderTrendingTab = () => {
    // Check API Key status first (highest priority)
    if (!apiKeyData?.exists || apiKeyData?.testStatus !== "success") {
      return (
        <div className="emptyStateContainer">
          <AlertCircle className="emptyStateIcon" size={48} />
          <p className="emptyStateText">
            YouTube API 키 오류입니다.
            <br />
            API 키 확인 후 다시 입력해주세요.
          </p>
        </div>
      );
    }

    if (isLoading && !isCacheValid) {
      return (
        <YouTubeVideoListLoading message="유튜브 트렌드 데이터를 불러오는 중입니다..." />
      );
    }

    if (error && !isCacheValid) {
      return (
        <div className="emptyStateContainer">
          <AlertCircle className="emptyStateIcon" size={48} />
          <p className="emptyStateText">
            YouTube API 키 오류입니다.
            <br />
            API 키 확인 후 다시 입력해주세요.
          </p>
        </div>
      );
    }

    if (!displayVideosData?.success || !displayVideosData?.videos || displayVideosData.videos.length === 0) {
      const emptyMessage = activeTab === "category"
        ? "선택한 국가와 카테고리의 인기 영상을 찾을 수 없습니다."
        : "선택한 국가의 인기 영상 데이터를 찾을 수 없습니다.";
      return (
        <div className="emptyStateContainer">
          <AlertCircle className="emptyStateIcon" size={48} />
          <p className="emptyStateText">
            {displayVideosData?.error || emptyMessage}
          </p>
        </div>
      );
    }

    return (
      <div>
        {/* Last Update Info - Mobile */}
        {lastUpdateTime && (
          <div className="updateInfoSection updateInfoSectionMobile">
            <span className="updateInfoText">
              {formatLastUpdateTime(lastUpdateTime)}
            </span>
            <button
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="refreshButton refreshButtonIconOnly"
              title="새로고침"
            >
              <RotateCw size={16} className={isRefreshing ? "refreshIconSpinning" : ""} />
            </button>
          </div>
        )}
        {lastUpdateTime && (
          <div className="updateInfoSubtextRow">
            <span className="updateInfoSubtext">데이터는 최대 1시간 단위로 갱신됩니다</span>
          </div>
        )}
        {/* Last Update Info - Desktop */}
        {lastUpdateTime && (
          <div className="updateInfoSection updateInfoSectionDesktop">
            <div className="updateInfoContent">
              <span className="updateInfoText">
                {formatLastUpdateTime(lastUpdateTime)}
              </span>
              <span className="updateInfoDot">·</span>
              <span className="updateInfoSubtext">데이터는 최대 1시간 단위로 갱신됩니다</span>
            </div>
            <button
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="refreshButton refreshButtonIconOnly"
              title="새로고침"
            >
              <RotateCw size={16} className={isRefreshing ? "refreshIconSpinning" : ""} />
            </button>
          </div>
        )}
        <div className="videosGrid">
          {displayVideosData.videos.map((video: any) => renderRecommendationCard(video))}
        </div>

        {activeTab === "trending" && (displayVideosData.previousVideos?.length || 0) > 0 && visiblePreviousRecommendedCount === 0 ? (
          <button
            type="button"
            className="previousRisingToggle"
            onClick={() => setVisiblePreviousRecommendedCount(12)}
          >
            이전 추천 영상 더보기
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        ) : null}

        {activeTab === "trending" && visiblePreviousRecommendedCount > 0 && (displayVideosData.previousVideos?.length || 0) > 0 ? (
          <section className="previousRisingSection">
            <div className="previousRisingHeader">
              <h2>이전 추천 영상</h2>
              <span>최근 3일 이내 목록</span>
            </div>
            <div className="videosGrid">
              {(displayVideosData.previousVideos || [])
                .slice(0, visiblePreviousRecommendedCount)
                .map((video: any) => renderRecommendationCard(video, true))}
            </div>
            {visiblePreviousRecommendedCount < (displayVideosData.previousVideos?.length || 0) ? (
              <button
                type="button"
                className="previousRisingToggle"
                onClick={() => setVisiblePreviousRecommendedCount(count => count + 12)}
              >
                더보기
                <ChevronDown size={18} aria-hidden="true" />
              </button>
            ) : null}
          </section>
        ) : null}
      </div>
    );
  };

  const renderRisingTab = () => {
    if (isRisingLoading) {
      return (
        <YouTubeVideoListLoading message="급상승 영상을 불러오는 중입니다..." centered />
      );
    }

    const risingDataError = risingData && "error" in risingData ? risingData.error : null;
    if (risingError || risingDataError) {
      return (
        <div className="emptyStateContainer">
          <AlertCircle className="emptyStateIcon" size={48} />
          <p className="emptyStateText">
            {risingDataError || "급상승 영상을 불러오지 못했습니다."}
            <br />
            새로고침 하세요.
          </p>
        </div>
      );
    }

    const risingVideos = risingData?.success ? risingData.videos || [] : [];
    const previousRisingVideos = risingData?.success && "previousVideos" in risingData
      ? risingData.previousVideos || []
      : [];
    const guestVisibleCount = risingGridColumns * 2;
    const visibleRisingVideos = isAuthenticated ? risingVideos : risingVideos.slice(0, guestVisibleCount);
    const teaserVideos = isAuthenticated ? [] : risingVideos.slice(guestVisibleCount, guestVisibleCount + risingGridColumns);
    const renderRisingVideoCard = (video: any, isPrevious = false) => {
      const isBookmarked = isYouTubeVideoBookmarked(video.id);
      return (
        <article key={`${isPrevious ? "previous" : "current"}-${video.id}`} className="videoCardWrapper">
          <div
            className="videoCard"
            role="button"
            tabIndex={0}
            onClick={() => setSelectedRisingVideo(video)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedRisingVideo(video);
              }
            }}
          >
            <div className="videoThumbnail">
              <img src={video.thumbnail} alt={video.title} />
              {isPrevious && <span className="previousRisingBadge">이전 급상승</span>}
              <div className="videoDurationBadge">{formatDuration(video.duration)}</div>
              <div className="videoPlayIcon">
                <Play size={32} fill="currentColor" />
              </div>
            </div>
            <div className="videoInfo">
              <h3 className="videoTitle">{video.title}</h3>
              <div className="videoChannelRow">
                <div className="channelProfileImage">
                  {video.channelThumbnail ? (
                    <img src={video.channelThumbnail} alt={video.channelTitle} />
                  ) : (
                    <div className="channelProfilePlaceholder">{video.channelTitle.charAt(0).toUpperCase()}</div>
                  )}
                </div>
                <p className="videoChannel">{video.channelTitle}</p>
              </div>
              <div className="videoMeta">
                <span>{formatViewCount(video.viewCount)} 조회 · {formatDate(video.publishedAt)}</span>
                {isPrevious && video.peakRank ? <span>최고 {video.peakRank}위</span> : null}
              </div>
            </div>
          </div>
          {isAuthenticated && <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              toggleYouTubeBookmark({
                id: video.id,
                title: video.title,
                thumbnail: video.thumbnail,
                channelId: video.channelId,
                channelTitle: video.channelTitle,
                channelThumbnail: video.channelThumbnail,
                viewCount: video.viewCount,
                publishedAt: video.publishedAt,
                duration: video.duration,
              }, "video");
            }}
            disabled={isBookmarkPending(video.id)}
            className={`bookmarkButton ${isBookmarked ? "bookmarked" : ""} ${isBookmarkPending(video.id) ? "pending" : ""}`}
            title={isBookmarked ? "북마크 해제" : "북마크"}
            aria-label={isBookmarked ? "북마크 해제" : "북마크"}
          >
            <Bookmark size={20} fill={isBookmarked ? "currentColor" : "none"} />
          </button>}
        </article>
      );
    };
    if (risingVideos.length === 0) {
      return (
        <div className="emptyStateContainer">
          <AlertCircle className="emptyStateIcon" size={48} />
          <p className="emptyStateText">선택한 조건의 수집된 급상승 영상이 없습니다.</p>
        </div>
      );
    }

    return (
      <section className="risingDiscoverySection">
        <div className="updateInfoSection updateInfoSectionMobile">
          <span className="updateInfoText">
            {risingData?.collectedAt ? formatLastUpdateTime(new Date(risingData.collectedAt).getTime()) : "-"}
          </span>
          <button onClick={handleRefreshClick} disabled={isRefreshing || isRisingLoading} className="refreshButton refreshButtonIconOnly" title="새로고침">
            <RotateCw size={16} className={isRefreshing ? "refreshIconSpinning" : ""} />
          </button>
        </div>
        <div className="updateInfoSection updateInfoSectionDesktop">
          <div className="updateInfoContent">
            <span className="updateInfoText">
              {risingData?.collectedAt ? formatLastUpdateTime(new Date(risingData.collectedAt).getTime()) : "-"}
            </span>
            <span className="updateInfoDot">·</span>
            <span className="updateInfoSubtext">
              {risingData?.metricMode === "snapshot" ? `${RISING_PERIOD_OPTIONS.find(option => option.value === risingPeriod)?.label} 증가 속도 기준` : "기준 스냅샷 수집 중"}
            </span>
          </div>
          <button onClick={handleRefreshClick} disabled={isRefreshing || isRisingLoading} className="refreshButton refreshButtonIconOnly" title="새로고침" aria-label="새로고침">
            <RotateCw size={16} className={isRefreshing ? "refreshIconSpinning" : ""} />
          </button>
        </div>

        <div className="videosGrid" ref={isAuthenticated ? undefined : risingPreviewGridRef}>
          {visibleRisingVideos.map((video: any) => renderRisingVideoCard(video))}
        </div>

        {teaserVideos.length > 0 && (
          <div className="videosGrid risingGuestTeaser" aria-hidden="true">
            {teaserVideos.map(video => (
              <div key={video.id} className="videoThumbnail">
                <img src={video.thumbnail} alt="" loading="lazy" />
              </div>
            ))}
          </div>
        )}

        {!isAuthenticated && (
          <button type="button" className="previousRisingToggle risingGuestMore" onClick={() => setIsRisingGuestPromptOpen(true)}>
            더보기
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        )}

        {isAuthenticated && previousRisingVideos.length > 0 && visiblePreviousRisingCount === 0 ? (
          <button
            type="button"
            className="previousRisingToggle"
            onClick={() => setVisiblePreviousRisingCount(12)}
          >
            이전 급상승 영상 더보기
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        ) : null}

        {isAuthenticated && visiblePreviousRisingCount > 0 && previousRisingVideos.length > 0 ? (
          <section className="previousRisingSection">
            <div className="previousRisingHeader">
              <h2>이전 급상승 영상</h2>
              <span>최근 3일 이내 목록</span>
            </div>
            <div className="videosGrid">
              {previousRisingVideos
                .slice(0, visiblePreviousRisingCount)
                .map((video: any) => renderRisingVideoCard(video, true))}
            </div>
            {visiblePreviousRisingCount < previousRisingVideos.length ? (
              <button
                type="button"
                className="previousRisingToggle"
                onClick={() => setVisiblePreviousRisingCount(count => count + 12)}
              >
                더보기
                <ChevronDown size={18} aria-hidden="true" />
              </button>
            ) : null}
          </section>
        ) : null}
      </section>
    );
  };

  // Render shorts tab
  const renderShortsTab = () => {
    // Check API Key status first (highest priority)
    if (!apiKeyData?.exists || apiKeyData?.testStatus !== "success") {
      return (
        <div className="emptyStateContainer">
          <AlertCircle className="emptyStateIcon" size={48} />
          <p className="emptyStateText">
            YouTube API 키 오류입니다.
            <br />
            API 키 확인 후 다시 입력해주세요.
          </p>
        </div>
      );
    }

    if (isShortsLoading && !isShortsCacheValid) {
      return (
        <YouTubeVideoListLoading message="인기 쇼츠 데이터를 불러오는 중입니다..." />
      );
    }

    if (shortsError && !isShortsCacheValid) {
      return (
        <div className="emptyStateContainer">
          <AlertCircle className="emptyStateIcon" size={48} />
          <p className="emptyStateText">
            YouTube API 키 오류입니다.
            <br />
            API 키 확인 후 다시 입력해주세요.
          </p>
        </div>
      );
    }

    // Check for API error first (higher priority than empty state)
    if (displayShortsData?.error) {
      return (
        <div className="emptyStateContainer">
          <AlertCircle className="emptyStateIcon" size={48} />
          <p className="emptyStateText">
            {displayShortsData.error.includes("\n") ? (
              <>
                {displayShortsData.error.split("\n").map((line: string, idx: number) => (
                  <span key={idx}>
                    {line}
                    {idx === 0 && <br />}
                  </span>
                ))}
              </>
            ) : (
              displayShortsData.error
            )}
          </p>
        </div>
      );
    }

    if (!displayShortsData?.success || !displayShortsData?.videos || displayShortsData.videos.length === 0) {
      return (
        <div className="emptyStateContainer">
          <AlertCircle className="emptyStateIcon" size={48} />
          <p className="emptyStateText">
            선택한 국가에서 최근 7일 인기 쇼츠를 찾을 수 없습니다.
          </p>
        </div>
      );
    }

    const previousShortsVideos = "previousVideos" in displayShortsData
      ? displayShortsData.previousVideos || []
      : [];
    const renderShortsCard = (video: any, isPrevious = false) => (
      <button
        type="button"
        key={`${isPrevious ? "previous" : "current"}-shorts-${video.id}`}
        onClick={() => {
          setSelectedVideo(video);
          setIsModalOpen(true);
        }}
        className="videoCard"
      >
        <div className="videoThumbnail">
          <img src={video.thumbnail} alt={video.title} />
          {isPrevious ? <span className="previousRisingBadge">이전 쇼츠</span> : null}
          <div className="videoDurationBadge">{formatDuration(video.duration)}</div>
          <div className="videoPlayIcon">
            <Play size={32} fill="currentColor" />
          </div>
        </div>
        <div className="videoInfo">
          <h3 className="videoTitle">{video.title}</h3>
          <p className="videoChannel">{video.channelTitle}</p>
          <div className="videoMeta">
            <span>{formatViewCount(video.viewCount)} 조회 · {formatDate(video.publishedAt)}</span>
          </div>
        </div>
      </button>
    );

    return (
      <div>
        {/* Last Update Info - Mobile */}
        {lastUpdateTime && (
          <div className="updateInfoSection updateInfoSectionMobile">
            <span className="updateInfoText">
              {formatLastUpdateTime(lastUpdateTime)}
            </span>
            <button
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="refreshButton refreshButtonIconOnly"
              title="새로고침"
            >
              <RotateCw size={16} className={isRefreshing ? "refreshIconSpinning" : ""} />
            </button>
          </div>
        )}
        {lastUpdateTime && (
          <div className="updateInfoSubtextRow">
            <span className="updateInfoSubtext">데이터는 최대 1시간 단위로 갱신됩니다</span>
          </div>
        )}
        {/* Last Update Info - Desktop */}
        {lastUpdateTime && (
          <div className="updateInfoSection updateInfoSectionDesktop">
            <div className="updateInfoContent">
              <span className="updateInfoText">
                {formatLastUpdateTime(lastUpdateTime)}
              </span>
              <span className="updateInfoDot">·</span>
              <span className="updateInfoSubtext">데이터는 최대 1시간 단위로 갱신됩니다</span>
            </div>
            <button
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="refreshButton refreshButtonIconOnly"
              title="새로고침"
            >
              <RotateCw size={16} className={isRefreshing ? "refreshIconSpinning" : ""} />
            </button>
          </div>
        )}
        <div className="videosGrid">
          {displayShortsData.videos.map((video: any) => renderShortsCard(video))}
        </div>

        {previousShortsVideos.length > 0 && visiblePreviousShortsCount === 0 ? (
          <button
            type="button"
            className="previousRisingToggle"
            onClick={() => setVisiblePreviousShortsCount(12)}
          >
            이전 쇼츠 더보기
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        ) : null}

        {visiblePreviousShortsCount > 0 && previousShortsVideos.length > 0 ? (
          <section className="previousRisingSection">
            <div className="previousRisingHeader">
              <h2>이전 쇼츠</h2>
              <span>최근 3일 이내 목록</span>
            </div>
            <div className="videosGrid">
              {previousShortsVideos
                .slice(0, visiblePreviousShortsCount)
                .map((video: any) => renderShortsCard(video, true))}
            </div>
            {visiblePreviousShortsCount < previousShortsVideos.length ? (
              <button
                type="button"
                className="previousRisingToggle"
                onClick={() => setVisiblePreviousShortsCount(count => count + 12)}
              >
                더보기
                <ChevronDown size={18} aria-hidden="true" />
              </button>
            ) : null}
          </section>
        ) : null}
      </div>
    );
  };

  const tabFilters = (
    <YouTubeFilterRow key={activeTab} mobile={isMobile} label={`${TABS.find(tab => tab.id === activeTab)?.label} 필터`}>
        <div className="filterGroup">
          <div className="filterLabelRow">
            <label htmlFor="country-select" className="filterLabel">
              {activeTab === "rising" ? "노출 국가" : "국가"}
            </label>
            {activeTab === "rising" ? (
              <Popover open={isExposureCountryInfoOpen} onOpenChange={setIsExposureCountryInfoOpen}>
                <PopoverTrigger type="button" className="exposureCountryInfoButton" aria-label="노출 국가 기준 안내">
                  <CircleAlert size={13} strokeWidth={2} aria-hidden="true" />
                </PopoverTrigger>
                <PopoverContent className="exposureCountryInfoPopup" aria-label="노출 국가 기준 안내" align="start" sideOffset={8}>
                  선택한 국가의 YouTube 추천·검색 결과에서 발견된 영상입니다. 채널 국적과는 다를 수 있으며, 같은 영상이 여러 국가에 표시될 수 있습니다.
                </PopoverContent>
              </Popover>
            ) : null}
          </div>
          <div className="selectWrapper">
            <select
              id="country-select"
              value={country}
              onChange={(e) => handleCountryChange(e.target.value)}
              className="youtubeSelect"
            >
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <ChevronDown className="selectChevron" />
          </div>
        </div>

        {activeTab === "category" && (
          <div className="filterGroup">
            <label htmlFor="category-select" className="filterLabel">
              카테고리
            </label>
            <div className="selectWrapper">
              <select
                id="category-select"
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="youtubeSelect"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="selectChevron" />
            </div>
          </div>
        )}

        {activeTab === "rising" && (
          <div className="filterGroup">
            <label htmlFor="rising-period-select" className="filterLabel">상승 구간</label>
            <div className="selectWrapper">
              <select
                id="rising-period-select"
                value={risingPeriod}
                onChange={(e) => handleRisingPeriodChange(e.target.value)}
                className="youtubeSelect"
              >
                {RISING_PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <ChevronDown className="selectChevron" />
            </div>
          </div>
        )}

        <div className="filterGroup">
          <label htmlFor="sort-select" className="filterLabel">
            정렬
          </label>
          <div className="selectWrapper">
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="youtubeSelect"
            >
              {currentSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="selectChevron" />
          </div>
        </div>
    </YouTubeFilterRow>
  );

  return (
    <div className={`youtubePageContainer ${!isAuthenticated ? "youtubeGuestUnframed" : ""}`}>
      <div className="pageHeader">
        <h1 className="pageTitle">유튜브 트렌드</h1>
        <p className="pageDescription">
          국가별, 카테고리별 YouTube 콘텐츠 트렌드를 확인하세요.
        </p>
      </div>

      <div className="tabMenu youtubeTabMenu" ref={tabMenuRef} role="group" aria-label="유튜브 트렌드 선택">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={`tabButton ${activeTab === tab.id ? "active" : ""}`}
            aria-pressed={activeTab === tab.id}
          >{tab.label}</button>
        ))}
      </div>

      {tabFilters}

      {isRefreshing && !authLoading && (
        (activeTab === "rising" && !isRisingLoading) ||
        (activeTab === "shorts" && isAuthenticated && (!isShortsLoading || isShortsCacheValid)) ||
        ((activeTab === "trending" || activeTab === "category") && isAuthenticated && (!isLoading || isCacheValid))
      ) && <YouTubeVideoListLoading message="영상 목록을 새로고침하는 중입니다..." />}

      {/* Content Section */}
      {authLoading ? (
        <YouTubeLoadingState message="인증 상태를 확인하는 중입니다..." />
      ) : activeTab === "rising" ? (
        renderRisingTab()
      ) : !isAuthenticated ? (
        renderGuestLoginNotice("유튜브 트렌드와 개인 API 키 기능은 로그인 후 이용할 수 있습니다.")
      ) : isAuthenticated && !apiKeyData?.exists ? (
        <YouTubeApiStatusCard activeTab={activeTab} apiKeyMessage={YOUTUBE_API_KEY_ERROR_MESSAGE} />
      ) : activeTab === "trending" || activeTab === "category" ? (
        renderTrendingTab()
      ) : activeTab === "shorts" ? (
        renderShortsTab()
      ) : null}

      <GuestAccessPrompt
        open={isRisingGuestPromptOpen && !isAuthenticated}
        description="로그인하거나 가입하면 급상승 영상 전체 목록을 볼 수 있어요."
        onBrowse={() => setIsRisingGuestPromptOpen(false)}
        onLogin={goToRisingAuth}
      />

      {/* Video Detail Modal */}
      <YouTubeVideoDetailModal
        video={selectedRisingVideo ?? selectedVideo}
        isOpen={Boolean(selectedRisingVideo) || isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedVideo(null);
          setSelectedRisingVideo(null);
        }}
        useStoredSnapshot={Boolean(selectedRisingVideo)}
      />
    </div>
  );
}
