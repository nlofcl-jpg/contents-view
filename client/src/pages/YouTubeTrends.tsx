import { useState, useEffect, type FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { YouTubeApiStatusCard } from "@/components/YouTubeApiStatusCard";
import { YouTubeVideoDetailModal } from "@/components/YouTubeVideoDetailModal";
import { AlertCircle, Clock, Play, ChevronDown, RotateCw, Users, Bookmark, Search } from "lucide-react";
import { useBookmark } from "@/contexts/BookmarkContext";
import { useLocation } from "wouter";

type TabType = "analysis" | "trending" | "category" | "channels" | "shorts";
type AnalysisSortType = "relevance" | "publishedAt" | "viewCount";

const YOUTUBE_API_KEY_ERROR_MESSAGE = "YouTube API 키 오류입니다.\nAPI 키 확인 후 다시 입력해주세요.";

const TABS = [
  { id: "analysis", label: "영상 분석" },
  { id: "trending", label: "인기 급상승 영상" },
  { id: "category", label: "카테고리별 인기" },
  { id: "channels", label: "인기 채널" },
  { id: "shorts", label: "쇼츠 트렌드" },
] as const;

const ANALYSIS_SORT_OPTIONS: { value: AnalysisSortType; label: string }[] = [
  { value: "relevance", label: "관련도순" },
  { value: "publishedAt", label: "최신순" },
  { value: "viewCount", label: "인기순" },
];

const COUNTRIES = [
  { value: "KR", label: "한국" },
  { value: "US", label: "미국" },
  { value: "JP", label: "일본" },
  { value: "GB", label: "영국" },
  { value: "FR", label: "프랑스" },
  { value: "ES", label: "스페인" },
  { value: "DE", label: "독일" },
  { value: "global", label: "글로벌" },
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
  channels: [
    { value: "trending", label: "인기순" },
    { value: "subscribers", label: "구독자순" },
    { value: "views", label: "조회수순" },
  ],
  shorts: [
    { value: "trending", label: "인기순" },
    { value: "viewCount", label: "조회수순" },
    { value: "publishedAt", label: "최신순" },
  ],
};

const TAB_MESSAGES = {
  analysis: "YouTube 영상 분석 기능을 준비 중입니다.",
  trending: "YouTube API 키 오류입니다.\nAPI 키 확인 후 다시 입력해주세요.",
  category: "YouTube API 키 오류입니다.\nAPI 키 확인 후 다시 입력해주세요.",
  channels: "YouTube API 키 오류입니다.\nAPI 키 확인 후 다시 입력해주세요.",
  shorts: "YouTube API 키 오류입니다.\nAPI 키 확인 후 다시 입력해주세요.",
};

const EMPTY_STATE_MESSAGES = {
  analysis: "영상 링크 또는 키워드 분석 기능을 준비 중입니다.",
  trending: "선택한 국가의 인기 영상 데이터를 찾을 수 없습니다.",
  category: "선택한 국가와 카테고리의 인기 영상을 찾을 수 없습니다.",
  channels: "선택한 조건에서 인기 채널을 찾을 수 없습니다.",
  shorts: "선택한 조건에서 쇼츠 영상을 찾을 수 없습니다.",
};

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

// Format Korean number (e.g., 81400000 -> 8140만, 461500000000 -> 461.5억)
function formatKoreanNumber(value: number): string {
  if (!Number.isFinite(value)) return "-";

  // 1억 이상: 억 단위
  if (value >= 100000000) {
    const eok = value / 100000000;
    const formatted = Number(eok.toFixed(1));
    return formatted % 1 === 0 ? `${Math.floor(formatted)}억` : `${formatted}억`;
  }

  // 1만 이상: 만 단위
  if (value >= 10000) {
    const man = value / 10000;
    const formatted = Number(man.toFixed(1));
    return formatted % 1 === 0 ? `${Math.floor(formatted)}만` : `${formatted}만`;
  }

  // 1만 미만: 그대로 표시
  return value.toLocaleString("ko-KR");
}

function isYouTubeUrl(value: string): boolean {
  const trimmedValue = value.trim();
  if (!trimmedValue) return false;

  try {
    const url = new URL(trimmedValue);
    return url.hostname.includes("youtube.com") || url.hostname.includes("youtu.be");
  } catch {
    return /(?:youtube\.com|youtu\.be|youtube\.com\/shorts)/i.test(trimmedValue);
  }
}

function getSearchParamsFromLocation(location: string) {
  const queryString = location.includes("?") ? location.split("?")[1] : "";
  return new URLSearchParams(queryString);
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

export default function YouTubeTrends() {
  const [location] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { toggleYouTubeBookmark, isYouTubeVideoBookmarked, isBookmarkPending } = useBookmark();
  const [activeTab, setActiveTab] = useState<TabType>("trending");
  const [isMobileTabMenuOpen, setIsMobileTabMenuOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [analysisInput, setAnalysisInput] = useState("");
  const [submittedAnalysisKeyword, setSubmittedAnalysisKeyword] = useState("");
  const [analysisMode, setAnalysisMode] = useState<"keyword" | "url" | null>(null);
  const [analysisSort, setAnalysisSort] = useState<AnalysisSortType>("relevance");
  const [visibleAnalysisCount, setVisibleAnalysisCount] = useState(10);
  const [lastUpdateTimesByKey, setLastUpdateTimesByKey] = useState<Record<string, number>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [videoCache, setVideoCache] = useState<Record<string, { data: any; fetchedAt: number }>>({});
  const [channelProfileCache, setChannelProfileCache] = useState<Record<string, { url: string; title: string }>>({});
  const [channelCache, setChannelCache] = useState<Record<string, { data: any; fetchedAt: number }>>({});
  const [shortsCache, setShortsCache] = useState<Record<string, { data: any; fetchedAt: number }>>({});
  const [shouldForceRefresh, setShouldForceRefresh] = useState(false);

  useEffect(() => {
    const searchParams = getSearchParamsFromLocation(location);
    const targetTab = searchParams.get("tab");
    const keywordFromUrl = searchParams.get("keyword")?.trim() || "";

    if (targetTab !== "analysis" || !keywordFromUrl || isYouTubeUrl(keywordFromUrl)) {
      return;
    }

    setActiveTab("analysis");
    setAnalysisInput(keywordFromUrl);
    setSubmittedAnalysisKeyword(keywordFromUrl);
    setAnalysisMode("keyword");
    setAnalysisSort("relevance");
    setVisibleAnalysisCount(10);
  }, [location]);

  // Manage filters per tab
  const [filtersByTab, setFiltersByTab] = useState({
    analysis: {
      country: "KR",
      sort: "trending",
    },
    trending: {
      country: "KR",
      sort: "trending",
    },
    category: {
      country: "KR",
      category: "movies",
      sort: "trending",
    },
    channels: {
      country: "KR",
      category: "all",
      sort: "trending",
    },
    shorts: {
      country: "KR",
      category: "all",
      sort: "trending",
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

  // Query to get API key status
  const { data: apiKeyData } = trpc.user.apiKey.getWithStatus.useQuery(
    { provider: "youtube" },
    { enabled: isAuthenticated }
  );

  const analysisInputValue = analysisInput.trim();
  const isAnalysisUrl = isYouTubeUrl(analysisInputValue);
  const canSearchAnalysisKeyword = analysisInputValue.length > 0 && !isAnalysisUrl;
  const canAnalyzeVideoUrl = analysisInputValue.length > 0 && isAnalysisUrl;

  const {
    data: analysisSearchData,
    isLoading: isAnalysisSearchLoading,
    error: analysisSearchError,
  } = trpc.youtube.searchVideos.useQuery(
    {
      query: submittedAnalysisKeyword,
      regionCode: "KR",
      sortBy: analysisSort,
      maxResults: 50,
    },
    {
      enabled:
        activeTab === "analysis" &&
        isAuthenticated &&
        Boolean(submittedAnalysisKeyword) &&
        apiKeyData?.exists &&
        apiKeyData?.testStatus === "success",
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  // Map country value to region code
  const regionCode = country === "global" ? "US" : country;
  const isGlobalSelected = country === "global";

  // Map sort value to API sort parameter
  const apiSortBy =
    activeTab === "channels"
      ? sortBy === "trending"
        ? "trending"
        : sortBy === "subscribers"
          ? "subscribers"
          : "views"
      : sortBy === "trending"
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
    : `youtube:${activeTab}:${regionCode}:${category}:${apiSortBy}:v3`;
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
        !isGlobalSelected &&
        apiKeyData?.exists &&
        apiKeyData?.testStatus === "success" &&
        shouldCallAPI,
    }
  );

  // Query for popular channels
  const { data: channelsData, isLoading: isChannelsLoading, error: channelsError, refetch: refetchChannels } = trpc.youtube.getPopularChannels.useQuery(
    {
      regionCode,
      sortBy: apiSortBy as "trending" | "subscribers" | "views",
      maxResults: 24,
      videoCategoryId,
    },
    {
      enabled:
        isAuthenticated &&
        activeTab === "channels" &&
        !isGlobalSelected &&
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
        !isGlobalSelected &&
        apiKeyData?.exists &&
        apiKeyData?.testStatus === "success" &&
        shouldCallAPI,
    }
  );

  // Use cache if available and valid, otherwise use API response
  const displayVideosData = isCacheValid && !shouldForceRefresh
    ? { success: true, videos: cached.data }
    : videosData;

  // Check if we should use channel cache before making API call
  const cachedChannels = channelCache[cacheKey];
  const isChannelCacheValid = cachedChannels && (Date.now() - cachedChannels.fetchedAt) < 3600000; // 1 hour in ms

  // Use cache if available and valid, otherwise use API response
  // But propagate error from channelsData if it exists
  const displayChannelsData = isChannelCacheValid && !shouldForceRefresh && !channelsData?.error
    ? { success: true, channels: cachedChannels.data }
    : channelsData;

  // Check if we should use shorts cache before making API call
  const cachedShorts = shortsCache[cacheKey];
  const isShortsCacheValid = cachedShorts && (Date.now() - cachedShorts.fetchedAt) < 3600000; // 1 hour in ms

  // Use cache if available and valid, otherwise use API response
  const displayShortsData = isShortsCacheValid && !shouldForceRefresh && !shortsData?.error
    ? { success: true, videos: cachedShorts.data }
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

  // When channel cache is used, update lastUpdateTimesByKey with cachedChannels.fetchedAt
  useEffect(() => {
    if (isChannelCacheValid && !shouldForceRefresh && cachedChannels) {
      setLastUpdateTimesByKey((prev) => ({
        ...prev,
        [cacheKey]: cachedChannels.fetchedAt,
      }));
    }
  }, [cacheKey, isChannelCacheValid, shouldForceRefresh, cachedChannels]);

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
          fetchedAt,
        },
      }));
      setLastUpdateTimesByKey((prev) => ({
        ...prev,
        [cacheKey]: fetchedAt,
      }));
    }
  }, [videosData, cacheKey, shouldCallAPI]);

  // Update channel cache and last update time when data is fetched successfully (only on API call, not cache)
  useEffect(() => {
    if (channelsData?.success && channelsData?.channels && channelsData.channels.length > 0 && shouldCallAPI) {
      const fetchedAt = Date.now();
      setChannelCache((prev) => ({
        ...prev,
        [cacheKey]: {
          data: channelsData.channels,
          fetchedAt,
        },
      }));
      setLastUpdateTimesByKey((prev) => ({
        ...prev,
        [cacheKey]: fetchedAt,
      }));
    }
  }, [channelsData, cacheKey, shouldCallAPI]);

  // Update shorts cache and last update time when data is fetched successfully (only on API call, not cache)
  useEffect(() => {
    if (shortsData?.success && shortsData?.videos && shortsData.videos.length > 0 && shouldCallAPI) {
      const fetchedAt = Date.now();
      setShortsCache((prev) => ({
        ...prev,
        [cacheKey]: {
          data: shortsData.videos,
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
      if (activeTab === "channels") {
        const result = await refetchChannels();
        // Update time only if refetch was successful
        if (result.data?.success && result.data?.channels && result.data.channels.length > 0) {
          const fetchedAt = Date.now();
          setChannelCache((prev) => ({
            ...prev,
            [cacheKey]: {
              data: result.data.channels,
              fetchedAt,
            },
          }));
          setLastUpdateTimesByKey((prev) => ({
            ...prev,
            [cacheKey]: fetchedAt,
          }));
        }
      } else if (activeTab === "shorts") {
        const result = await refetchShorts();
        // Update time only if refetch was successful
        if (result.data?.success && result.data?.videos && result.data.videos.length > 0) {
          const fetchedAt = Date.now();
          setShortsCache((prev) => ({
            ...prev,
            [cacheKey]: {
              data: result.data.videos,
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
  const tabMessage = TAB_MESSAGES[activeTab as keyof typeof TAB_MESSAGES];

  // Handler functions for current tab
  const handleCountryChange = (value: string) => updateCurrentFilter("country", value);
  const handleCategoryChange = (value: string) => updateCurrentFilter("category", value);
  const handleSortChange = (value: string) => updateCurrentFilter("sort", value);
  const activeTabLabel = TABS.find((tab) => tab.id === activeTab)?.label || "인기 급상승 영상";

  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId);
    setIsMobileTabMenuOpen(false);
  };

  const handleAnalysisKeywordSearch = () => {
    if (!canSearchAnalysisKeyword) return;
    setAnalysisMode("keyword");
    setSubmittedAnalysisKeyword(analysisInputValue);
    setAnalysisSort("relevance");
    setVisibleAnalysisCount(10);
  };

  const handleAnalysisUrlAnalyze = () => {
    if (!canAnalyzeVideoUrl) return;
    setAnalysisMode("url");
    setSubmittedAnalysisKeyword("");
    setVisibleAnalysisCount(10);
  };

  const handleAnalysisSortChange = (sortValue: AnalysisSortType) => {
    setAnalysisSort(sortValue);
    setVisibleAnalysisCount(10);
  };

  const handleAnalysisSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSearchAnalysisKeyword) {
      handleAnalysisKeywordSearch();
      return;
    }
    if (canAnalyzeVideoUrl) {
      handleAnalysisUrlAnalyze();
    }
  };

  const formatLastUpdateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  // Render trending videos
  const renderAnalysisTab = () => {
    const analysisVideos = analysisSearchData?.success ? analysisSearchData.videos || [] : [];
    const visibleAnalysisVideos = analysisVideos.slice(0, visibleAnalysisCount);

    return (
      <section className="youtubeAnalysisPanel" aria-labelledby="youtube-analysis-title">
        <div className="youtubeAnalysisHeader">
          <h2 id="youtube-analysis-title" className="youtubeAnalysisTitle">영상 분석</h2>
          <p className="youtubeAnalysisDescription">
            키워드는 관련 인기 영상 리스트로, 유튜브 URL은 개별 영상 분석으로 연결됩니다.
          </p>
        </div>

        <form className="youtubeAnalysisSearchForm" onSubmit={handleAnalysisSubmit}>
          <div className="youtubeAnalysisInputWrap">
            <Search size={18} strokeWidth={1.9} aria-hidden="true" />
            <input
              type="text"
              value={analysisInput}
              onChange={(event) => setAnalysisInput(event.target.value)}
              placeholder="키워드 또는 YouTube URL을 입력하세요"
              className="youtubeAnalysisInput"
            />
          </div>
          <div className="youtubeAnalysisActions">
            <button
              type="button"
              className="youtubeAnalysisActionButton"
              disabled={!canSearchAnalysisKeyword}
              onClick={handleAnalysisKeywordSearch}
            >
              검색
            </button>
            <button
              type="button"
              className="youtubeAnalysisActionButton"
              disabled={!canAnalyzeVideoUrl}
              onClick={handleAnalysisUrlAnalyze}
            >
              분석
            </button>
          </div>
        </form>

        {!apiKeyData?.exists || apiKeyData?.testStatus !== "success" ? (
          <div className="emptyStateContainer youtubeAnalysisState">
            <AlertCircle className="emptyStateIcon" size={42} />
            <p className="emptyStateText">
              YouTube API 키 오류입니다.
              <br />
              API 키 확인 후 다시 입력해주세요.
            </p>
          </div>
        ) : analysisMode === "url" ? (
          <div className="youtubeAnalysisUrlNotice">
            URL 영상 분석 화면은 다음 단계에서 연결됩니다.
          </div>
        ) : isAnalysisSearchLoading ? (
          <div className="emptyStateContainer youtubeAnalysisState">
            <Clock className="emptyStateIcon" size={42} />
            <p className="emptyStateText">키워드 관련 인기 영상을 불러오는 중입니다...</p>
          </div>
        ) : analysisSearchError ? (
          <div className="emptyStateContainer youtubeAnalysisState">
            <AlertCircle className="emptyStateIcon" size={42} />
            <p className="emptyStateText">YouTube 검색 데이터를 불러오지 못했습니다.</p>
          </div>
        ) : analysisMode === "keyword" && !analysisSearchData?.success ? (
          <div className="emptyStateContainer youtubeAnalysisState">
            <AlertCircle className="emptyStateIcon" size={42} />
            <p className="emptyStateText">
              {analysisSearchData?.error || "검색 결과를 불러오지 못했습니다."}
            </p>
          </div>
        ) : analysisMode === "keyword" && analysisVideos.length === 0 && submittedAnalysisKeyword ? (
          <div className="emptyStateContainer youtubeAnalysisState">
            <AlertCircle className="emptyStateIcon" size={42} />
            <p className="emptyStateText">관련 인기 영상을 찾을 수 없습니다.</p>
          </div>
        ) : analysisMode === "keyword" && analysisVideos.length > 0 ? (
          <div className="youtubeAnalysisResults">
            <div className="youtubeAnalysisResultHeader">
              <div className="youtubeAnalysisResultTitle">
                <span>검색 결과</span>
                <strong>{submittedAnalysisKeyword}</strong>
              </div>
              <div className="youtubeAnalysisSortGroup" aria-label="영상 분석 결과 정렬">
                {ANALYSIS_SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`youtubeAnalysisSortButton ${analysisSort === option.value ? "active" : ""}`}
                    onClick={() => handleAnalysisSortChange(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="videosGrid">
              {visibleAnalysisVideos.map((video: any) => {
                const isBookmarked = isYouTubeVideoBookmarked(video.id);
                return (
                  <article key={video.id} className="videoCardWrapper">
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
                              <div className="channelProfilePlaceholder">
                                {video.channelTitle.charAt(0).toUpperCase()}
                              </div>
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
                    >
                      <Bookmark size={20} fill={isBookmarked ? "currentColor" : "none"} />
                    </button>
                  </article>
                );
              })}
            </div>
            {visibleAnalysisCount < analysisVideos.length && (
              <button
                type="button"
                className="youtubeAnalysisMoreButton"
                onClick={() => setVisibleAnalysisCount((count) => Math.min(count + 10, analysisVideos.length))}
                aria-label="유튜브 검색 결과 더보기"
              >
                <ChevronDown size={24} strokeWidth={1.8} />
              </button>
            )}
          </div>
        ) : null}
      </section>
    );
  };

  const renderTrendingTab = () => {
    if (isGlobalSelected) {
      return (
        <div className="emptyStateContainer">
          <AlertCircle className="emptyStateIcon" size={48} />
          <p className="emptyStateText">
            글로벌 통합 차트는 YouTube API에서 별도 제공되지 않아 국가를 선택해주세요.
          </p>
        </div>
      );
    }

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
        <div className="emptyStateContainer">
          <Clock className="emptyStateIcon" size={48} />
          <p className="emptyStateText">YouTube 트렌드 데이터를 불러오는 중입니다...</p>
        </div>
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
              마지막 업데이트: {formatLastUpdateTime(lastUpdateTime)}
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
                마지막 업데이트: {formatLastUpdateTime(lastUpdateTime)}
              </span>
              <span className="updateInfoDot">·</span>
              <span className="updateInfoSubtext">데이터는 최대 1시간 단위로 갱신됩니다</span>
            </div>
            <button
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="refreshButton"
              title="새로고침"
            >
              <RotateCw size={16} className={isRefreshing ? "refreshIconSpinning" : ""} />
              {isRefreshing ? "새로고침 중..." : "새로고침"}
            </button>
          </div>
        )}
        <div className="videosGrid">
          {displayVideosData.videos.map((video: any) => {
            const isBookmarked = isYouTubeVideoBookmarked(video.id);
            return (
              <article key={video.id} className="videoCardWrapper">
                <div
                  className="videoCard"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedVideo(video);
                    setIsModalOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedVideo(video);
                      setIsModalOpen(true);
                    }
                  }}
                >
                  <div className="videoThumbnail">
                    <img src={video.thumbnail} alt={video.title} />
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
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleYouTubeBookmark({
                      id: video.id,
                      title: video.title,
                      thumbnail: video.thumbnail,
                      channelTitle: video.channelTitle,
                      channelThumbnail: video.channelThumbnail,
                      viewCount: video.viewCount,
                      publishedAt: video.publishedAt,
                      duration: video.duration,
                    }, 'video');
                  }}
                  disabled={isBookmarkPending(video.id)}
                  className={`bookmarkButton ${isBookmarked ? 'bookmarked' : ''} ${isBookmarkPending(video.id) ? 'pending' : ''}`}
                  title={isBookmarked ? '북마크 해제' : '북마크'}
                >
                  <Bookmark size={20} fill={isBookmarked ? 'currentColor' : 'none'} />
                </button>
              </article>
            );
          })}
        </div>
      </div>
    );
  };

  // Render channels tab
  const renderChannelsTab = () => {
    if (isGlobalSelected) {
      return (
        <div className="emptyStateContainer">
          <AlertCircle className="emptyStateIcon" size={48} />
          <p className="emptyStateText">
            글로벌 통합 차트는 YouTube API에서 별도 제공되지 않아 국가를 선택해주세요.
          </p>
        </div>
      );
    }

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

    if (isChannelsLoading && !isChannelCacheValid) {
      return (
        <div className="emptyStateContainer">
          <Clock className="emptyStateIcon" size={48} />
          <p className="emptyStateText">인기 채널 데이터를 불러오는 중입니다...</p>
        </div>
      );
    }

    if (channelsError && !isChannelCacheValid) {
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
    if (displayChannelsData?.error) {
      return (
        <div className="emptyStateContainer">
          <AlertCircle className="emptyStateIcon" size={48} />
          <p className="emptyStateText">
            {displayChannelsData.error.includes("\n") ? (
              <>
                {displayChannelsData.error.split("\n").map((line, idx) => (
                  <span key={idx}>
                    {line}
                    {idx === 0 && <br />}
                  </span>
                ))}
              </>
            ) : (
              displayChannelsData.error
            )}
          </p>
        </div>
      );
    }

    if (!displayChannelsData?.success || !displayChannelsData?.channels || displayChannelsData.channels.length === 0) {
      return (
        <div className="emptyStateContainer">
          <AlertCircle className="emptyStateIcon" size={48} />
          <p className="emptyStateText">
            선택한 조건에서 인기 채널을 찾을 수 없습니다.
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
              마지막 업데이트: {formatLastUpdateTime(lastUpdateTime)}
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
                마지막 업데이트: {formatLastUpdateTime(lastUpdateTime)}
              </span>
              <span className="updateInfoDot">·</span>
              <span className="updateInfoSubtext">데이터는 최대 1시간 단위로 갱신됩니다</span>
            </div>
            <button
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="refreshButton"
              title="새로고침"
            >
              <RotateCw size={16} className={isRefreshing ? "refreshIconSpinning" : ""} />
              {isRefreshing ? "새로고침 중..." : "새로고침"}
            </button>
          </div>
        )}
        <div className="channelsGrid">
          {displayChannelsData.channels.map((channel: any) => (
            <a
              key={channel.channelId}
              href={`https://www.youtube.com/channel/${channel.channelId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="channelCard"
            >
              <div className="channelThumbnailWrapper">
                <img src={channel.thumbnail} alt={channel.channelTitle} className="channelThumbnail" />
              </div>
              <div className="channelInfo">
                <h3 className="channelTitle">{channel.channelTitle}</h3>
                <div className="channelStats">
                  <span>{formatKoreanNumber(channel.subscriberCount)} 구독자</span>
                  <span>·</span>
                  <span>{formatKoreanNumber(channel.viewCount)} 조회</span>
                </div>
                <div className="channelStats">
                  <span>{channel.videoCount.toLocaleString("ko-KR")}개 영상</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    );
  };

  // Render shorts tab
  const renderShortsTab = () => {
    if (isGlobalSelected) {
      return (
        <div className="emptyStateContainer">
          <AlertCircle className="emptyStateIcon" size={48} />
          <p className="emptyStateText">
            글로벌 통합 차트는 YouTube API에서 별도 제공되지 않아 국가를 선택해주세요.
          </p>
        </div>
      );
    }

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
        <div className="emptyStateContainer">
          <Clock className="emptyStateIcon" size={48} />
          <p className="emptyStateText">쇼츠 트렌드 데이터를 불러오는 중입니다...</p>
        </div>
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

    return (
      <div>
        {/* Last Update Info - Mobile */}
        {lastUpdateTime && (
          <div className="updateInfoSection updateInfoSectionMobile">
            <span className="updateInfoText">
              마지막 업데이트: {formatLastUpdateTime(lastUpdateTime)}
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
                마지막 업데이트: {formatLastUpdateTime(lastUpdateTime)}
              </span>
              <span className="updateInfoDot">·</span>
              <span className="updateInfoSubtext">데이터는 최대 1시간 단위로 갱신됩니다</span>
            </div>
            <button
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="refreshButton"
              title="새로고침"
            >
              <RotateCw size={16} className={isRefreshing ? "refreshIconSpinning" : ""} />
              {isRefreshing ? "새로고침 중..." : "새로고침"}
            </button>
          </div>
        )}
        <div className="videosGrid">
          {displayShortsData.videos.map((video: any) => (
            <button
              key={video.id}
              onClick={() => {
                setSelectedVideo(video);
                setIsModalOpen(true);
              }}
              className="videoCard"
            >
              <div className="videoThumbnail">
                <img src={video.thumbnail} alt={video.title} />
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
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="youtubePageContainer">
      {/* Page Header */}
      <div className="pageHeader">
        <h1 className="pageTitle">YouTube 트렌드</h1>
        <p className="pageDescription">
          국가별, 카테고리별 YouTube 콘텐츠 트렌드를 확인하세요.
        </p>
        {activeTab === "shorts" && (
          <div className="youtubeSubNotice">
            <span className="youtubeSubNoticeIcon">ⓘ</span>
            <span>쇼츠 트렌드는 최근 7일 인기 데이터를 기반으로 제공되고 있습니다.</span>
          </div>
        )}
      </div>

      {/* Tab Menu */}
      <div className="youtubeMobileTabFilter">
        <button
          type="button"
          className={`youtubeMobileTabTrigger ${isMobileTabMenuOpen ? "open" : ""}`}
          onClick={() => setIsMobileTabMenuOpen((isOpen) => !isOpen)}
          aria-expanded={isMobileTabMenuOpen}
        >
          <span>{activeTabLabel}</span>
          <ChevronDown size={22} strokeWidth={2.4} aria-hidden="true" />
        </button>
        {isMobileTabMenuOpen && (
          <div className="youtubeMobileTabPanel">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`youtubeMobileTabOption ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => handleTabChange(tab.id as TabType)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="tabMenu">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id as TabType)}
            className={`tabButton ${activeTab === tab.id ? "active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Section */}
      {activeTab !== "analysis" && <div className="filterSection">
        <div className="filterGroup">
          <label htmlFor="country-select" className="filterLabel">
            국가
          </label>
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

        {(activeTab === "category" || activeTab === "channels") && (
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
      </div>}

      {/* Content Section */}
      {authLoading ? (
        <div className="emptyStateContainer">
          <Clock className="emptyStateIcon" size={48} />
          <p className="emptyStateText">인증 상태를 확인하는 중입니다...</p>
        </div>
      ) : !isAuthenticated ? (
        <div className="emptyStateContainer">
          <AlertCircle className="emptyStateIcon" size={48} />
          <p className="emptyStateText">
            로그인 후 서비스를 계속 이용해주세요
            <br />
            <span style={{ fontSize: "0.875rem", opacity: 0.8, marginTop: "0.5rem", display: "block" }}>
              YouTube 트렌드와 개인 API 키 기능은 로그인 후 이용할 수 있습니다.
            </span>
          </p>
          <button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            style={{
              marginTop: "1.5rem",
              padding: "0.75rem 1.5rem",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#3b82f6")}
          >
            로그인
          </button>
        </div>
      ) : activeTab === "analysis" ? (
        renderAnalysisTab()
      ) : isAuthenticated && !apiKeyData?.exists ? (
        <YouTubeApiStatusCard activeTab={activeTab} apiKeyMessage={TAB_MESSAGES.trending} />
      ) : activeTab === "trending" || activeTab === "category" ? (
        renderTrendingTab()
      ) : activeTab === "channels" ? (
        renderChannelsTab()
      ) : activeTab === "shorts" ? (
        renderShortsTab()
      ) : null}

      {/* Video Detail Modal */}
      <YouTubeVideoDetailModal
        video={selectedVideo}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedVideo(null);
        }}
      />
    </div>
  );
}
