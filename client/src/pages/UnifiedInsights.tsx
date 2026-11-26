import { useEffect, useRef, useState } from "react";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { CompactSegmentedControl } from "@/components/CompactSegmentedControl";
import { SearchGlowForm } from "@/components/SearchGlowForm";
import { useAuth } from "@/_core/hooks/useAuth";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import VoiceSearchButton from "@/components/VoiceSearchButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NAVER_GUEST_DAILY_LIMIT_MESSAGE, NAVER_MEMBER_DAILY_LIMIT_MESSAGE } from "@shared/naverAnalysisQuota";
import { trpc } from "@/lib/trpc";
import { useNaverTrendComparison } from "@/components/NaverTrendComparison";
import { ChevronDown, CircleAlert, ExternalLink, Heart, ListFilter, Loader2, MessageCircle, RotateCcw, Search, UserRound } from "lucide-react";
import { useLocation } from "wouter";


type KeywordMetric = {
  keyword: string;
  monthlyPcSearches: number | null;
  monthlyMobileSearches: number | null;
  monthlyTotalSearches: number | null;
  monthlyPcClicks: number | null;
  monthlyMobileClicks: number | null;
  monthlyTotalClicks: number | null;
  competition: string | null;
  averageAdDepth: number | null;
  similarity: number | null;
};

type BlogAnalysisPost = {
  rank: number;
  title: string;
  link: string;
  pubDate: string;
  category?: string;
  blogTitle?: string;
  tags?: string[];
  keywords?: string[];
};

type BlogAnalysisData = {
  success: boolean;
  error?: string;
  blog?: {
    blogId: string;
    title: string;
    link: string;
    description: string;
    profileImageUrl?: string | null;
    rssUrl: string;
  };
  posts?: BlogAnalysisPost[];
  fetchedAt?: string;
};

type BlogPostDetailsData = {
  success: boolean;
  error?: string;
  post?: BlogAnalysisPost;
};

type BlogPostKeywordResult = {
  keyword: string;
  monthlySearches: number | null;
  rank: number | null;
  matchedTitle: string | null;
  matchedLink: string | null;
  checkedCount: number;
  error?: string | null;
};

type BlogPostAnalysisData = {
  success: boolean;
  error?: string;
  postUrl?: string;
  title?: string;
  results?: BlogPostKeywordResult[];
  searchedAt?: string;
  searchVolumeAvailable?: boolean;
};

type BlogPostEngagement = {
  likeCount: number | null;
  commentCount: number | null;
  characterCount: number | null;
  imageCount: number | null;
  videoCount: number | null;
};

type SearchMode = "analysis" | "rank" | "postRank";

const SEARCH_MODE_OPTIONS: Array<{ value: SearchMode; label: string }> = [
  { value: "analysis", label: "키워드 분석" },
  { value: "rank", label: "블로그 분석" },
  { value: "postRank", label: "블로그 순위" },
];

export default function UnifiedInsights() {
  // State management
  const [, setLocation] = useLocation();
  const { loading: authLoading } = useAuth();
  const [guestAnalysisPromptOpen, setGuestAnalysisPromptOpen] = useState(false);
  const initialKeywordQueried = useRef(false);

  const analysisErrorMessage = (error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : "";
    if (message === NAVER_GUEST_DAILY_LIMIT_MESSAGE) {
      setGuestAnalysisPromptOpen(true);
      return "";
    }
    if (message === NAVER_MEMBER_DAILY_LIMIT_MESSAGE) return message;
    return fallback;
  };

  const goToAnalysisAuth = () => {
    const params = new URLSearchParams({ redirect: `/trends/naver${window.location.search}` });
    setGuestAnalysisPromptOpen(false);
    setLocation(`/login?${params.toString()}`);
  };
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [voiceInputKey, setVoiceInputKey] = useState(0);
  const [selectedSearchMode, setSearchMode] = useState<SearchMode | null>("analysis");
  const searchMode = selectedSearchMode ?? "analysis";
  const showKeywordAnalysis = searchMode === "analysis" && (selectedSearchMode === "analysis" || keywords.length > 0);
  const [infoPopup, setInfoPopup] = useState<{ title: string; body: string } | null>(null);
  const [isKeywordGradeInfoOpen, setIsKeywordGradeInfoOpen] = useState(false);
  const [relatedSortMode, setRelatedSortMode] = useState<"related" | "recommended">("related");
  const [isRelatedSortOpen, setIsRelatedSortOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBlogLoading, setIsBlogLoading] = useState(false);
  const [blogAnalysisData, setBlogAnalysisData] = useState<BlogAnalysisData | null>(null);
  const [blogPostRankData, setBlogPostRankData] = useState<BlogPostDetailsData | null>(null);
  const [isBlogPostRankLoading, setIsBlogPostRankLoading] = useState(false);
  const [blogPostAnalysisData, setBlogPostAnalysisData] = useState<Record<string, BlogPostAnalysisData>>({});
  const [blogPostAnalysisErrors, setBlogPostAnalysisErrors] = useState<Record<string, string>>({});
  const [blogPostAnalysisLoading, setBlogPostAnalysisLoading] = useState<string | null>(null);
  const [blogPostKeywordInputs, setBlogPostKeywordInputs] = useState<Record<string, string>>({});
  const [blogPostEngagementData, setBlogPostEngagementData] = useState<Record<string, BlogPostEngagement>>({});
  const [blogPostEngagementLoading, setBlogPostEngagementLoading] = useState<string | null>(null);
  const [queryError, setQueryError] = useState("");
  const [querySuccess, setQuerySuccess] = useState(false);
  const [chartData, setChartData] = useState<any>(null);
  const { renderPanel: renderTrendComparison, getBaseRequest, clearComparison, resetComparison, isTrendFilterLoading } = useNaverTrendComparison({
    chartData,
    metric: "trend",
    authLoading,
    isLoading,
    onError: analysisErrorMessage,
  });
  const isResetDisabled = isLoading || isTrendFilterLoading || isBlogLoading || isBlogPostRankLoading || Boolean(blogPostAnalysisLoading || blogPostEngagementLoading);
  const resetLabel = `${SEARCH_MODE_OPTIONS.find(option => option.value === searchMode)?.label ?? "분석"} 초기화`;

  const resetAnalysis = () => {
    if (isResetDisabled) return;
    setKeywordInput("");
    setQueryError("");
    setGuestAnalysisPromptOpen(false);
    setInfoPopup(null);

    if (searchMode === "analysis") {
      setVoiceInputKey(key => key + 1);
      setKeywords([]);
      setQuerySuccess(false);
      setChartData(null);
      resetComparison();
      setIsKeywordGradeInfoOpen(false);
      setIsRelatedSortOpen(false);
      setRelatedSortMode("related");

      const url = new URL(window.location.href);
      if (url.searchParams.has("keyword")) {
        url.searchParams.delete("keyword");
        setLocation(`${url.pathname}${url.search}${url.hash}`, { replace: true });
      }
      return;
    }

    if (searchMode === "rank") setBlogAnalysisData(null);
    else setBlogPostRankData(null);
    setBlogPostAnalysisData({});
    setBlogPostAnalysisErrors({});
    setBlogPostKeywordInputs({});
    setBlogPostEngagementData({});
  };

  const getInitialKeywordFromUrl = () => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("keyword")?.trim() || "";
  };

  const getSeriesSummary = (series?: { ratio: number }[]) => {
    if (!series || series.length === 0) {
      return { latest: null as number | null, delta: null as number | null, peak: null as number | null };
    }

    const latest = series[series.length - 1]?.ratio ?? null;
    const previous = series.length > 1 ? series[series.length - 2]?.ratio : null;
    const delta = latest !== null && previous !== null ? latest - previous : null;
    const peak = Math.max(...series.map((item) => item.ratio));
    return { latest, delta, peak };
  };

  const formatRatio = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return "-";
    return `${Math.round(value * 10) / 10}`;
  };

  const formatDelta = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return "비교 데이터 없음";
    if (value === 0) return "변동 없음";
    return `${value > 0 ? "+" : ""}${Math.round(value * 10) / 10}p`;
  };

  const primaryKeyword = chartData?.keywords?.[0] || keywords[0] || "";
  const primaryTrendSummary = getSeriesSummary(primaryKeyword ? chartData?.trend?.[primaryKeyword] : undefined);
  const hasAnalysisResults = !isLoading && querySuccess && Boolean(chartData);
  const keywordTool = chartData?.meta?.keywordTool;
  const primaryMetric: KeywordMetric | null = keywordTool?.primary || null;
  const recommendedKeywords: KeywordMetric[] = keywordTool?.recommended || [];
  const relatedKeywords: KeywordMetric[] = keywordTool?.related || [];
  const sortedRelatedKeywords = [...relatedKeywords].sort((a, b) => {
    if (relatedSortMode === "recommended") {
      return (b.monthlyTotalSearches || 0) - (a.monthlyTotalSearches || 0);
    }
    return (b.similarity || 0) - (a.similarity || 0) || (b.monthlyTotalSearches || 0) - (a.monthlyTotalSearches || 0);
  });
  const visibleRelatedKeywords = sortedRelatedKeywords.slice(0, 1);
  const contentVolume = chartData?.meta?.contentVolume;
  const blogTotalDocuments = contentVolume?.sources?.find((item: any) => item.key === "blog")?.totalDocuments ?? null;
  const searchRatio = primaryMetric?.monthlyTotalSearches
    ? blogTotalDocuments / primaryMetric.monthlyTotalSearches
    : null;

  const formatNumber = (value: number | null | undefined, suffix = "") => {
    if (value === null || value === undefined || Number.isNaN(value)) return "-";
    return `${Math.round(value).toLocaleString("ko-KR")}${suffix}`;
  };

  const formatDecimal = (value: number | null | undefined, suffix = "") => {
    if (value === null || value === undefined || Number.isNaN(value)) return "-";
    return `${Math.round(value * 10) / 10}${suffix}`;
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return "-";
    return `${Math.round(value)}%`;
  };

  const formatBlogDate = (value: string | undefined) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const getCompetitionLabel = (competition: string | null | undefined) => {
    if (!competition) return "-";
    const labels: Record<string, string> = {
      높음: "높음",
      중간: "중간",
      낮음: "낮음",
      HIGH: "높음",
      MID: "중간",
      LOW: "낮음",
    };
    return labels[competition] || competition;
  };

  const getBlogCompetitionStrength = (ratio: number | null) => {
    if (ratio === null || Number.isNaN(ratio)) return "-";
    if (ratio < 1) return "낮음";
    if (ratio < 5) return "보통";
    if (ratio < 20) return "높음";
    return "포화";
  };


  // tRPC mutation
  const { mutate: queryUnifiedInsight } = trpc.naver.unifiedInsight.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        setChartData(data);
        clearComparison();
        setQuerySuccess(true);
        setQueryError("");
      } else {
        setQueryError(data.error || "데이터를 불러오지 못했습니다.");
        setQuerySuccess(false);
        setChartData(null);
        clearComparison();
      }
      setIsLoading(false);
    },
    onError: (error) => {
      setQueryError(analysisErrorMessage(error, "조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."));
      setQuerySuccess(false);
      setChartData(null);
      clearComparison();
      setIsLoading(false);
    },
  });

  const { mutate: queryBlogAnalysis } = trpc.naver.blogAnalysis.useMutation({
    onSuccess: (data: BlogAnalysisData) => {
      if (data.success) {
        setBlogAnalysisData(data);
        setQueryError("");
      } else {
        setBlogAnalysisData(null);
        setQueryError(data.error || "블로그 정보를 불러오지 못했습니다.");
      }
      setIsBlogLoading(false);
    },
    onError: (error) => {
      setBlogAnalysisData(null);
      setQueryError(analysisErrorMessage(error, "블로그 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."));
      setIsBlogLoading(false);
    },
  });

  const { mutateAsync: queryBlogPostAnalysis } = trpc.naver.blogPostAnalysis.useMutation();
  const { mutateAsync: queryBlogPostDetails } = trpc.naver.blogPostDetails.useMutation();
  const { mutateAsync: queryBlogPostEngagement } = trpc.naver.blogPostEngagement.useMutation();

  const runBlogAnalysis = (blogUrl: string) => {
    setIsBlogLoading(true);
    setQueryError("");
    setQuerySuccess(false);
    setKeywords([]);
    setChartData(null);
    clearComparison();
    setBlogAnalysisData(null);
    setBlogPostAnalysisData({});
    setBlogPostAnalysisErrors({});
    setBlogPostKeywordInputs({});
    setBlogPostEngagementData({});
    setBlogPostEngagementLoading(null);
    queryBlogAnalysis({ blogUrl });
  };

  const runBlogPostRankAnalysis = async (postUrl: string) => {
    setIsBlogPostRankLoading(true);
    setQueryError("");
    setBlogPostRankData(null);
    setBlogPostAnalysisData({});
    setBlogPostAnalysisErrors({});
    setBlogPostKeywordInputs({});
    setBlogPostEngagementData({});

    try {
      const data = await queryBlogPostDetails({ postUrl }) as BlogPostDetailsData;
      if (!data.success || !data.post) {
        setQueryError(data.error || "게시글 정보를 불러오지 못했습니다.");
        return;
      }

      setBlogPostRankData(data);
      runBlogPostEngagement(data.post);
    } catch (error) {
      setQueryError(analysisErrorMessage(error, "게시글 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."));
    } finally {
      setIsBlogPostRankLoading(false);
    }
  };

  const runBlogPostEngagement = async (post: BlogAnalysisPost) => {
    if (blogPostEngagementData[post.link]) return;

    setBlogPostEngagementLoading(post.link);
    try {
      const data = await queryBlogPostEngagement({ postUrl: post.link }) as {
        success: boolean;
        engagement: BlogPostEngagement | null;
      };
      const engagement = data.engagement;
      if (data.success && engagement) {
        setBlogPostEngagementData(prev => ({ ...prev, [post.link]: engagement }));
      }
    } catch {
      // Engagement counts are supplementary, so keyword analysis remains usable.
    } finally {
      setBlogPostEngagementLoading(null);
    }
  };

  const runBlogPostAnalysis = async (post: BlogAnalysisPost, extraKeyword?: string) => {
    const requestedKeyword = extraKeyword?.trim();
    const previousKeywords = blogPostAnalysisData[post.link]?.results?.map(result => result.keyword) || [];
    const keywordsToAnalyze = Array.from(new Set([
      ...previousKeywords,
      ...(requestedKeyword ? [requestedKeyword] : []),
    ])).slice(0, 10);

    if (keywordsToAnalyze.length === 0) {
      setBlogPostAnalysisErrors(prev => ({
        ...prev,
        [post.link]: "분석할 키워드가 없습니다.",
      }));
      return;
    }

    setBlogPostAnalysisLoading(post.link);
    setBlogPostAnalysisErrors(prev => ({ ...prev, [post.link]: "" }));

    try {
      const data = await queryBlogPostAnalysis({
        postUrl: post.link,
        title: post.title,
        keywords: keywordsToAnalyze,
      }) as BlogPostAnalysisData;

      if (!data.success) {
        setBlogPostAnalysisErrors(prev => ({
          ...prev,
          [post.link]: data.error || "게시글 분석에 실패했습니다.",
        }));
        return;
      }

      setBlogPostAnalysisData(prev => ({
        ...prev,
        [post.link]: data,
      }));
      if (requestedKeyword) {
        setBlogPostKeywordInputs(prev => ({ ...prev, [post.link]: "" }));
      }
    } catch (error) {
      const message = analysisErrorMessage(error, "게시글 분석에 실패했습니다. 잠시 후 다시 시도해주세요.");
      setBlogPostAnalysisErrors(prev => ({
        ...prev,
        [post.link]: message,
      }));
    } finally {
      setBlogPostAnalysisLoading(null);
    }
  };

  const runQuery = (requestedKeywords?: string[]) => {
    if (isTrendFilterLoading) return;
    const nextKeywords = requestedKeywords ?? (keywords.length > 0 ? keywords : [keywordInput.trim()].filter(Boolean));

    if (nextKeywords.length === 0) {
      setQueryError("검색어를 입력해주세요.");
      setQuerySuccess(false);
      return;
    }

    setIsLoading(true);
    setQueryError("");
    setQuerySuccess(false);
    setKeywords(nextKeywords);

    queryUnifiedInsight({ keywords: nextKeywords, ...getBaseRequest() });
  };

  const handleSearch = () => {
    if (authLoading) return;
    const trimmed = keywordInput.trim();
    if (!trimmed) {
      setQueryError(
        searchMode === "rank"
          ? "블로그 주소를 입력해주세요."
          : searchMode === "postRank"
            ? "블로그 게시글 URL을 입력해주세요."
            : "검색어를 입력해주세요."
      );
      setQuerySuccess(false);
      return;
    }
    if (searchMode === "rank") {
      runBlogAnalysis(trimmed);
      return;
    }
    if (searchMode === "postRank") {
      setBlogAnalysisData(null);
      setQuerySuccess(false);
      runBlogPostRankAnalysis(trimmed);
      return;
    }
    setBlogAnalysisData(null);
    runQuery([trimmed]);
  };

  useEffect(() => {
    if (authLoading || initialKeywordQueried.current) return;
    initialKeywordQueried.current = true;
    const initialKeyword = getInitialKeywordFromUrl();
    if (!initialKeyword) return;

    setKeywordInput(initialKeyword);
    runQuery([initialKeyword]);
    // URL로 들어온 최초 키워드만 자동 조회합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);


  const blog = !isBlogLoading ? blogAnalysisData?.blog : undefined;
  const blogPosts = searchMode === "postRank"
    ? [blogPostRankData?.post ?? null]
    : blog ? (blogAnalysisData?.posts ?? []) : [null];

  return (
    <div className="w-full">
      {infoPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
          onClick={() => setInfoPopup(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-blue-500/20 bg-slate-950 p-5 text-center shadow-2xl shadow-blue-950/40"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-white">{infoPopup.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{infoPopup.body}</p>
            <button
              type="button"
              onClick={() => setInfoPopup(null)}
              className="mt-5 h-9 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              확인
            </button>
          </div>
        </div>
      )}

      <div className="flex w-full flex-col items-center">
        <SearchGlowForm
          className="heroSearch naverAnalysisComposer"
          role="search"
          aria-label="네이버 트렌드 분석"
          onSubmit={event => {
            event.preventDefault();
            if (!authLoading && !isLoading && !isBlogLoading && !isBlogPostRankLoading) handleSearch();
          }}
        >
          <input
            id="keyword"
            type="text"
            value={keywordInput}
            onChange={event => setKeywordInput(event.target.value)}
            placeholder={
              searchMode === "rank" ? "블로그 주소 입력"
                : searchMode === "postRank" ? "게시글 URL 입력"
                  : "검색어 입력"
            }
            aria-label={searchMode === "analysis" ? "분석할 검색어" : "분석할 블로그 주소"}
            autoComplete="off"
            className="heroSearchInput"
          />
          <div className="flex items-center gap-1">
            {searchMode === "analysis" && !isLoading && (
              <VoiceSearchButton key={voiceInputKey} onTranscript={text => setKeywordInput(value => [value.trimEnd(), text].filter(Boolean).join(" "))} />
            )}
            <button
              type="submit"
              className="heroSearchButton"
              aria-label="분석"
              title="분석"
              disabled={!keywordInput.trim() || authLoading || isLoading || isTrendFilterLoading || isBlogLoading || isBlogPostRankLoading}
            >
              <Search size={18} aria-hidden="true" />
            </button>
          </div>
        </SearchGlowForm>
        <div className="mt-4">
          <CompactSegmentedControl
            label="네이버 트렌드 분석 방식"
            options={SEARCH_MODE_OPTIONS}
            value={selectedSearchMode}
            onChange={mode => setSearchMode(current => current === mode ? null : mode)}
          />
        </div>
        {queryError && !isLoading && !isBlogLoading && !querySuccess && !chartData && !blogAnalysisData && (
          <p className="mt-3 text-sm text-red-300" role="alert">{queryError}</p>
        )}
      </div>

      <div className="mt-5 flex justify-end md:mt-7">
        <button
          type="button"
          onClick={resetAnalysis}
          disabled={isResetDisabled}
          aria-label={resetLabel}
          title={resetLabel}
          className="inline-grid size-9 place-items-center text-slate-400 transition-colors hover:text-white focus-visible:outline focus-visible:outline-blue-400 disabled:opacity-40"
        >
          <RotateCcw size={16} aria-hidden="true" />
        </button>
      </div>

      {(isLoading || isBlogLoading || isBlogPostRankLoading) && <AnalysisProgress />}

      {searchMode === "rank" && queryError && !isBlogLoading && !blogAnalysisData && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-950/30 p-5 text-sm text-red-200">
          {queryError}
        </div>
      )}

      {searchMode !== "analysis" && (
        <div className="mt-3 space-y-6">
          {searchMode === "rank" && (
            <div className="rounded-lg border border-blue-500/20 bg-slate-900/50 p-5">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 md:flex md:gap-x-5">
                <Avatar className={`size-10 border border-slate-700 md:size-28 ${blog && !blog.profileImageUrl ? "md:hidden" : ""}`}>
                  <AvatarImage src={blog?.profileImageUrl ?? undefined} alt="" className="object-cover" />
                  <AvatarFallback className="bg-slate-800 text-slate-400">
                    <UserRound size={18} aria-hidden="true" />
                  </AvatarFallback>
                </Avatar>
                <div className="contents md:flex md:min-w-0 md:flex-col md:justify-center md:py-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className="min-w-0 break-words text-base font-semibold text-white md:truncate md:text-2xl">{blog?.title || "블로그 이름"}</h3>
                    {blog ? <a
                      href={blog.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-800 hover:text-blue-200"
                      aria-label="블로그 원문 보기"
                      title="원문 보기"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a> : (
                      <button type="button" disabled aria-label="블로그 원문 보기" className="inline-grid size-7 shrink-0 place-items-center text-slate-500">
                        <ExternalLink size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <p className="col-span-2 mt-3 whitespace-pre-line break-words text-xs leading-5 text-slate-400 md:mt-2 md:line-clamp-2 md:whitespace-normal md:text-sm">
                    {blog ? blog.description || "블로그 설명 정보가 없습니다." : "블로그 메인 주소를 입력하고 검색 버튼을 눌러주세요."}
                  </p>
                  <div className="col-span-2 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 md:mt-3 md:text-sm">
                    <span className="break-all">블로그 ID{blog ? ` ${blog.blogId}` : ""}</span>
                    {(!blog || blogAnalysisData?.fetchedAt) && <span>최근 확인{blogAnalysisData?.fetchedAt && blog ? ` ${formatBlogDate(blogAnalysisData.fetchedAt)}` : ""}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-700 bg-slate-900/35 p-4">
            {searchMode !== "postRank" && (
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-white">최신글</h3>
                {blog && <span className="text-xs text-slate-500">{blogPosts.length}개 표시</span>}
              </div>
            )}
            <div className="divide-y divide-slate-800/80">
              {blogPosts.map((post) => {
                const postLink = post?.link ?? "";
                const postAnalysis = blogPostAnalysisData[postLink];
                const postError = blogPostAnalysisErrors[postLink];
                const isPostLoading = blogPostAnalysisLoading === postLink;
                const keywordInputValue = blogPostKeywordInputs[postLink] || "";
                const postEngagement = blogPostEngagementData[postLink];
                const isEngagementLoading = blogPostEngagementLoading === postLink;

                return (
                <article
                  key={postLink || "empty"}
                  className={searchMode === "postRank" ? "py-1" : "py-4 transition-colors hover:bg-slate-800/30 md:px-2"}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className={`flex min-w-0 flex-1 ${searchMode === "postRank" ? "" : "gap-3"}`}>
                    {searchMode !== "postRank" && (
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-xs font-semibold text-blue-200">
                        {post?.rank}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      {searchMode === "postRank" && (
                        <p className="mb-1 text-xs text-slate-500">
                          블로그 이름 {post && <span className="ml-1 text-slate-300">{post.blogTitle || "블로그 이름 정보 없음"}</span>}
                        </p>
                      )}
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        {post ? <a
                          href={post.link}
                          target="_blank"
                          rel="noreferrer"
                          className="line-clamp-1 text-sm font-medium text-slate-100 transition-colors hover:text-blue-200 md:text-base"
                        >
                          {post.title}
                        </a> : (
                          <h3 className="text-sm font-medium text-slate-100 md:text-base">
                            {searchMode === "postRank" ? "블로그 게시글 순위" : "게시글 제목"}
                          </h3>
                        )}
                      </div>
                      {!post && searchMode === "postRank" && (
                        <p className="mt-2 text-xs leading-5 text-slate-400">블로그 게시글 URL을 입력해 키워드별 검색 노출 순위를 분석합니다.</p>
                      )}
                      {searchMode === "postRank" ? (
                        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(270px,360px)] lg:items-stretch">
                          <div className="space-y-3 rounded-lg border border-slate-700/70 bg-slate-950/40 px-3.5 py-3">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                              <span className="text-slate-500">발행일</span>
                              {post && <span className="text-slate-300">{formatBlogDate(post.pubDate)}</span>}
                            </div>
                            <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5 text-xs">
                              <span className="pt-0.5 text-slate-500">태그</span>
                              <div className="flex flex-1 flex-wrap gap-1.5">
                                {post?.tags?.map((tag) => <span key={tag} className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">#{tag}</span>)}
                                {post && !post.tags?.length && <span className="text-slate-500">등록된 태그 없음</span>}
                              </div>
                            </div>
                            {postEngagement ? (
                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                                {postEngagement.likeCount !== null && <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5 text-rose-300" aria-hidden="true" />공감 {formatNumber(postEngagement.likeCount)}</span>}
                                {postEngagement.commentCount !== null && <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />댓글 {formatNumber(postEngagement.commentCount)}</span>}
                              </div>
                            ) : isEngagementLoading ? (
                              <div className="inline-flex items-center gap-1.5 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />공감·댓글 확인 중</div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-1"><Heart size={14} aria-hidden="true" />공감</span>
                                <span className="inline-flex items-center gap-1"><MessageCircle size={14} aria-hidden="true" />댓글</span>
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="flex min-w-0 flex-col items-center justify-center rounded-lg border border-slate-700/70 bg-slate-950/40 px-2 py-3 text-center">
                              <span className="text-[11px] text-slate-500">글자 수</span>
                              <span className="mt-1 min-h-6 text-base font-medium text-slate-100">{postEngagement && formatNumber(postEngagement.characterCount)}</span>
                            </div>
                            <div className="flex min-w-0 flex-col items-center justify-center rounded-lg border border-slate-700/70 bg-slate-950/40 px-2 py-3 text-center">
                              <span className="text-[11px] text-slate-500">이미지 수</span>
                              <span className="mt-1 min-h-6 text-base font-medium text-slate-100">{postEngagement && formatNumber(postEngagement.imageCount)}</span>
                            </div>
                            <div className="flex min-w-0 flex-col items-center justify-center rounded-lg border border-slate-700/70 bg-slate-950/40 px-2 py-3 text-center">
                              <span className="text-[11px] text-slate-500">영상 수</span>
                              <span className="mt-1 min-h-6 text-base font-medium text-slate-100">{postEngagement && formatNumber(postEngagement.videoCount)}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span>{post ? formatBlogDate(post.pubDate) : "발행일"}</span>
                            {!post && <span>카테고리</span>}
                            {post?.category && <span>{post.category}</span>}
                          </div>
                          {post?.tags && post.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {post.tags.map((tag) => <span key={`${post.link}-tag-${tag}`} className="rounded-full border border-slate-600/40 bg-slate-800/45 px-2 py-0.5 text-[11px] text-slate-300">#{tag}</span>)}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    </div>
                    {searchMode === "rank" && <button
                      type="button"
                      disabled={!post}
                      onClick={() => {
                        if (!post) return;
                        setSearchMode("postRank");
                        setKeywordInput(post.link);
                        setBlogAnalysisData(null);
                        setQuerySuccess(false);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                        runBlogPostRankAnalysis(post.link);
                      }}
                      className="h-9 shrink-0 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 md:self-center"
                    >
                      순위 확인
                    </button>}
                  </div>
                  {postError && (
                    <div className="mt-4 rounded-lg border border-red-500/25 bg-red-950/30 p-3 text-sm text-red-200">
                      {postError}
                    </div>
                  )}
                  {searchMode === "postRank" && (
                    <div className="mt-4 rounded-lg border border-blue-500/15 bg-slate-950/45 p-4">
                      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-white">키워드 순위 분석</h4>
                          <p className="mt-1 text-xs text-slate-500">
                            네이버 블로그 검색 상위 {postAnalysis?.results?.[0]?.checkedCount || 100}개 기준
                          </p>
                          {postAnalysis?.searchVolumeAvailable === false && (
                            <p className="mt-1 text-xs text-amber-300">
                              검색광고 키를 확인하지 못해 검색량은 비어 있을 수 있습니다.
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            disabled={!post}
                            value={keywordInputValue}
                            onChange={(event) => setBlogPostKeywordInputs(prev => ({
                              ...prev,
                              [postLink]: event.target.value,
                            }))}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && post && !isPostLoading && keywordInputValue.trim()) {
                                runBlogPostAnalysis(post, keywordInputValue);
                              }
                            }}
                            placeholder="키워드 입력"
                            className="h-9 w-36 min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500 md:w-48"
                          />
                          <button
                            type="button"
                            onClick={() => post && runBlogPostAnalysis(post, keywordInputValue)}
                            disabled={!post || isPostLoading || !keywordInputValue.trim()}
                            className="inline-flex h-9 min-w-14 items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 px-3 text-sm text-blue-100 transition-colors hover:border-blue-400 hover:text-white disabled:border-slate-700 disabled:text-slate-500"
                          >
                            {isPostLoading ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                분석 중
                              </>
                            ) : "추가"}
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <div className="overflow-hidden rounded-lg border border-slate-800">
                          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-400">
                            <span>키워드</span>
                            <span className="text-right">검색량</span>
                            <span className="text-right">게시글 순위</span>
                            <span className="text-right">상태</span>
                          </div>
                          {(postAnalysis?.results || []).map((result) => (
                            <div
                              key={result.keyword}
                              className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-t border-slate-800 px-3 py-2 text-sm text-slate-200"
                            >
                              <span className="truncate pr-2">{result.keyword}</span>
                              <span className="text-right text-slate-300">{formatNumber(result.monthlySearches)}</span>
                              <span className="text-right text-blue-200">
                                {result.rank ? `${result.rank}위` : "-"}
                              </span>
                              <span className="text-right text-xs text-slate-400">
                                {result.error || (result.rank ? "노출" : "100위 밖")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </article>
                );
              })}
              {searchMode === "rank" && blog && blogPosts.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-500">표시할 최신글이 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {!selectedSearchMode && !showKeywordAnalysis && (
        <div className="analysisEmptyState">
          <p>분석할 메뉴를 선택하세요.</p>
        </div>
      )}

      {/* Chart Display */}
      {showKeywordAnalysis && (
        <div className="mt-3 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-blue-500/20 bg-slate-900/50 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Monthly Search Volume</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <h3 className="text-lg font-semibold text-white">월간 검색량</h3>
                    <button
                      type="button"
                      aria-label="월간 검색량 안내"
                      onClick={() => setInfoPopup({
                        title: "월간 검색량",
                        body: "최근 한달간 네이버 통합 검색에서 키워드가 검색된 수가 표시됩니다.",
                      })}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500 transition-colors hover:text-blue-300"
                    >
                      <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-slate-800/70 p-2 text-center md:p-3">
                  <p className="text-xs text-slate-500">PC</p>
                  <p className="mt-2 max-w-full truncate text-sm font-medium text-slate-300 md:text-xl md:font-bold">{hasAnalysisResults && formatNumber(primaryMetric?.monthlyPcSearches)}</p>
                </div>
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-slate-800/70 p-2 text-center md:p-3">
                  <p className="text-xs text-slate-500">모바일</p>
                  <p className="mt-2 max-w-full truncate text-sm font-medium text-slate-300 md:text-xl md:font-bold">{hasAnalysisResults && formatNumber(primaryMetric?.monthlyMobileSearches)}</p>
                </div>
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-blue-950/50 p-2 text-center md:p-3">
                  <p className="text-xs text-blue-300">전체</p>
                  <p className="mt-2 max-w-full truncate text-sm font-medium text-white md:text-xl md:font-bold">{hasAnalysisResults && formatNumber(primaryMetric?.monthlyTotalSearches)}</p>
                </div>
              </div>
              {hasAnalysisResults && keywordTool?.error && <p className="mt-3 text-xs text-slate-500">{keywordTool.error}</p>}
            </div>

            <div className="rounded-lg border border-blue-500/20 bg-slate-900/50 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Blog Competition</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <h3 className="text-lg font-semibold text-white">블로그 경쟁도</h3>
                    <button
                      type="button"
                      aria-label="블로그 경쟁도 안내"
                      onClick={() => setInfoPopup({
                        title: "블로그 경쟁도",
                        body: "해당 키워드의 블로그 전체 문서 수를 월간 검색량과 비교해 경쟁 정도를 표시합니다.",
                      })}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500 transition-colors hover:text-blue-300"
                    >
                      <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-slate-800/70 p-2 text-center md:p-3">
                  <p className="text-xs text-slate-500">블로그 발행수</p>
                  <p className="mt-2 max-w-full truncate text-sm font-medium text-slate-300 md:text-xl md:font-bold">
                    {hasAnalysisResults && formatNumber(blogTotalDocuments)}
                  </p>
                </div>
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-slate-800/70 p-2 text-center md:p-3">
                  <p className="text-xs text-slate-500">경쟁강도</p>
                  <p className="mt-2 max-w-full truncate text-sm font-medium text-slate-300 md:text-xl md:font-bold">{hasAnalysisResults && getBlogCompetitionStrength(searchRatio)}</p>
                </div>
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-blue-950/50 p-2 text-center md:p-3">
                  <p className="text-xs text-blue-300">검색 비율</p>
                  <p className="mt-2 max-w-full truncate text-sm font-medium text-white md:text-xl md:font-bold">{hasAnalysisResults && formatDecimal(searchRatio)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-blue-500/20 bg-slate-900/50 p-4 text-center">
              <p className="text-xs font-semibold text-slate-200">검색 관심도</p>
              <p className="mt-2 min-h-[1lh] text-2xl font-bold text-white">
                {hasAnalysisResults && formatRatio(primaryTrendSummary.latest)}
              </p>
              <p className="mt-1 min-h-[1lh] text-xs text-slate-300">
                {hasAnalysisResults && `직전 구간 대비 ${formatDelta(primaryTrendSummary.delta)}`}
              </p>
            </div>
            <div className="rounded-lg border border-blue-500/20 bg-slate-900/50 p-4 text-center">
              <p className="text-xs font-semibold text-slate-200">월간 클릭량</p>
              <p className="mt-2 min-h-[1lh] text-2xl font-bold text-white">
                {hasAnalysisResults && formatDecimal(primaryMetric?.monthlyTotalClicks)}
              </p>
              <p className="mt-1 min-h-[1lh] text-xs text-slate-300">
                {hasAnalysisResults && `PC ${formatDecimal(primaryMetric?.monthlyPcClicks)} · 모바일 ${formatDecimal(primaryMetric?.monthlyMobileClicks)}`}
              </p>
            </div>
            <div className="relative rounded-lg border border-blue-500/20 bg-slate-900/50 p-4 text-center">
              <div className="relative inline-flex items-center justify-center gap-1.5">
                <p className="text-xs font-semibold text-slate-200">키워드 등급</p>
                <button
                  type="button"
                  aria-label="키워드 등급 기준 안내"
                  onClick={() => setIsKeywordGradeInfoOpen((isOpen) => !isOpen)}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500 transition-colors hover:text-blue-300"
                >
                  <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                {isKeywordGradeInfoOpen && (
                  <div className="absolute left-1/2 top-6 z-20 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-xl shadow-black/20">
                    <p className="text-xs font-medium text-slate-900">수치 기준 안내</p>
                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      키워드 등급은 네이버 검색광고의 경쟁도입니다. 광고 노출 깊이는 검색광고 API에서 제공되는 평균 노출 깊이 참고 수치입니다.
                    </p>
                  </div>
                )}
              </div>
              <p className="mt-2 min-h-[1lh] text-2xl font-bold text-white">{hasAnalysisResults && getCompetitionLabel(primaryMetric?.competition)}</p>
              <p className="mt-1 min-h-[1lh] text-xs text-slate-300">
                {hasAnalysisResults && `광고 노출 깊이 ${formatDecimal(primaryMetric?.averageAdDepth)}`}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/35 p-4">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">추천 키워드</h3>
              </div>
            </div>
            <div className="-mx-1 overflow-x-auto pb-1">
              <div className="flex w-max max-w-none gap-2 px-1">
                {hasAnalysisResults && recommendedKeywords.map((item) => (
                  <button
                    key={item.keyword}
                    type="button"
                    onClick={() => {
                      setKeywordInput(item.keyword);
                      runQuery([item.keyword]);
                    }}
                    className="whitespace-nowrap rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1.5 text-sm font-medium text-blue-100 transition-colors hover:border-blue-400/50 hover:bg-blue-500/20"
                  >
                    {item.keyword}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/35 p-4">
            <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">연관 키워드</h3>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-700/70">
              <div className="grid min-w-[620px] grid-cols-[150px_76px_120px_120px_96px] gap-0 border-b border-slate-700/70 bg-slate-950/50 px-4 py-3 text-sm font-semibold text-slate-100 md:grid-cols-[minmax(180px,2fr)_minmax(76px,0.7fr)_minmax(96px,0.9fr)_minmax(96px,0.9fr)_minmax(86px,0.8fr)]">
                <span className="sticky left-0 z-10 relative pr-3 after:pointer-events-none after:absolute after:bottom-0 after:right-0 after:top-0 after:w-4 after:bg-gradient-to-r after:from-transparent after:to-slate-950/20">키워드</span>
                <span className="text-right">등급</span>
                <span className="text-right">검색량</span>
                <span className="text-right">클릭량</span>
                <div className="relative flex justify-end">
                  {hasAnalysisResults ? <button
                    type="button"
                    onClick={() => setIsRelatedSortOpen(!isRelatedSortOpen)}
                    className="inline-flex items-center gap-1 text-right text-slate-100 transition-colors hover:text-blue-300"
                  >
                    <span>유사도</span>
                    <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
                  </button> : <span>유사도</span>}
                  {hasAnalysisResults && isRelatedSortOpen && (
                    <div className="absolute right-0 top-6 z-20 w-24 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 shadow-xl shadow-black/30">
                      {[
                        { value: "related" as const, label: "관련순" },
                        { value: "recommended" as const, label: "추천순" },
                      ].map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setRelatedSortMode(option.value);
                            setIsRelatedSortOpen(false);
                          }}
                          className={`block w-full px-3 py-2 text-left text-xs transition-colors hover:bg-slate-800 ${
                            relatedSortMode === option.value ? "text-blue-300" : "text-slate-300"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {hasAnalysisResults && visibleRelatedKeywords.map((item) => (
                <button
                  key={item.keyword}
                  type="button"
                  onClick={() => {
                    setKeywordInput(item.keyword);
                    runQuery([item.keyword]);
                  }}
                  className="group grid min-h-11 min-w-[620px] grid-cols-[150px_76px_120px_120px_96px] gap-0 border-b border-slate-800/80 px-4 py-2 text-left text-sm text-slate-200 transition-colors last:border-b-0 hover:bg-slate-800/70 md:w-full md:grid-cols-[minmax(180px,2fr)_minmax(76px,0.7fr)_minmax(96px,0.9fr)_minmax(96px,0.9fr)_minmax(86px,0.8fr)]"
                >
                  <span className="sticky left-0 z-10 relative min-w-0 truncate pr-3 after:pointer-events-none after:absolute after:bottom-0 after:right-0 after:top-0 after:w-4 after:bg-gradient-to-r after:from-transparent after:to-slate-900/20">{item.keyword}</span>
                  <span className="text-right text-blue-300">{getCompetitionLabel(item.competition)}</span>
                  <span className="text-right text-slate-300">{formatNumber(item.monthlyTotalSearches)}</span>
                  <span className="text-right text-slate-400">{formatDecimal(item.monthlyTotalClicks)}</span>
                  <span className="text-right text-slate-300">{formatPercent(item.similarity)}</span>
                </button>
              ))}
            </div>
          </div>

          {renderTrendComparison()}
        </div>
      )}

      <GuestAccessPrompt
        open={guestAnalysisPromptOpen}
        description={NAVER_GUEST_DAILY_LIMIT_MESSAGE}
        onBrowse={() => setGuestAnalysisPromptOpen(false)}
        onLogin={goToAnalysisAuth}
      />
    </div>
  );
}
