import { useState, useEffect, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import { GoogleTrendRankChange, type RankChange } from "@/components/GoogleTrendRankChange";
import { MAX_HERO_KEYWORDS, readHeroKeywords } from "@/lib/heroKeywords";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";

interface NewsItem {
  title: string;
  source: string;
  url: string;
  image: string;
}

interface TrendItem {
  rank: number;
  rankChange?: RankChange;
  keyword: string;
  traffic?: string;
  trafficCount?: number;
  news?: NewsItem[];
  source: string;
  country: string;
}

const GOOGLE_TRENDS_PAGE_SIZE = 20;

function SearchKeywordTrends() {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.from("hero_search_settings").select("keywords").eq("id", 1).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setHasError(Boolean(error));
        setKeywords(readHeroKeywords(data?.keywords));
        setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <section aria-labelledby="search-keyword-trends-heading">
      <h2 id="search-keyword-trends-heading" className="mb-5 hidden text-xl font-bold text-foreground lg:block">검색어 트렌드</h2>
      {isLoading || hasError ? (
        <div className="flex h-[562px] items-center justify-center rounded-md border border-slate-800 bg-slate-900/25 p-8 text-center text-sm text-slate-400">
          {isLoading ? "불러오는 중..." : "인기 검색어를 불러오지 못했습니다."}
        </div>
      ) : (
        <ol id="search-keyword-ranking" className="flex min-h-[562px] flex-col gap-1.5 rounded-md border border-slate-800 bg-slate-900/25 p-1.5">
          {Array.from({ length: MAX_HERO_KEYWORDS }, (_, index) => (
            <li key={index} className={`flex min-h-[49px] items-center gap-2 rounded-md px-4 py-2 ${index % 2 === 0 ? "bg-slate-800/35" : "bg-slate-900/45"}`}>
              <span className="w-5 shrink-0 text-center text-sm font-semibold text-blue-400">{index + 1}</span>
              {keywords[index] && <span className="min-w-0 truncate text-sm font-medium text-slate-100" title={keywords[index]}>{keywords[index]}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function TrendNews({ news }: { news?: NewsItem[] }) {
  return (
    <div>
      <h4 className="mb-4 text-lg font-semibold text-foreground">관련 뉴스</h4>
      {news && news.length > 0 ? (
        <div className="space-y-4">
          {news.map((newsItem, idx) => (
            <a
              key={idx}
              href={newsItem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex gap-4 rounded-lg bg-slate-800/50 p-3 transition hover:bg-slate-800"
            >
              {newsItem.image && (
                <img
                  src={newsItem.image}
                  alt={newsItem.title}
                  className="h-16 w-16 flex-shrink-0 rounded object-cover transition group-hover:opacity-80 sm:h-20 sm:w-20"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium text-foreground transition group-hover:text-blue-400">
                  {newsItem.title}
                </p>
                <p className="mt-2 text-xs text-slate-400">{newsItem.source}</p>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">관련 뉴스가 없습니다.</p>
      )}
    </div>
  );
}

export default function GoogleTrends() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const getInitialParams = () => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("trend") || "";
  };

  const [selectedKeywordFromUrl, setSelectedKeywordFromUrl] = useState(getInitialParams);
  const [popularSearches, setPopularSearches] = useState<TrendItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrend, setSelectedTrend] = useState<TrendItem | null>(null);
  const [isNewsOpen, setIsNewsOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(GOOGLE_TRENDS_PAGE_SIZE);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [mobileTab, setMobileTab] = useState<"google" | "keywords">("google");

  const handleMobileTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const nextTab = event.key === "ArrowRight" || event.key === "End"
      ? "keywords"
      : event.key === "ArrowLeft" || event.key === "Home"
        ? "google"
        : null;
    if (!nextTab) return;
    event.preventDefault();
    setMobileTab(nextTab);
    document.getElementById(nextTab === "google" ? "google-trends-tab" : "search-keyword-trends-tab")?.focus();
  };

  const handleMore = () => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setShowGuestPrompt(true);
      return;
    }
    setVisibleCount(count => Math.min(count + GOOGLE_TRENDS_PAGE_SIZE, popularSearches.length));
  };

  // Fetch Google Trends data
  const { data: trendsData, isLoading: isTrendsLoading, error: trendsError } = trpc.googleTrends.realtimeTrending.useQuery(
    { country: "KR" },
    {
      enabled: true,
      retry: 1,
      refetchInterval: 10 * 60 * 1000,
    }
  );

  // Update popular searches when data changes
  useEffect(() => {
    if (trendsData?.success && trendsData.data && trendsData.data.length > 0) {
      setPopularSearches(trendsData.data);
      setError(null);
      setSelectedTrend(previous => {
        const keyword = selectedKeywordFromUrl || previous?.keyword;
        return trendsData.data.find((item: TrendItem) => item.keyword === keyword) || null;
      });
      if (selectedKeywordFromUrl) {
        const hasMatchingTrend = trendsData.data.some((item: TrendItem) => item.keyword === selectedKeywordFromUrl);
        setIsNewsOpen(hasMatchingTrend && !window.matchMedia("(max-width: 1023px)").matches);
        setSelectedKeywordFromUrl("");
      }
    } else if (trendsData?.success && (!trendsData.data || trendsData.data.length === 0)) {
      setError("실시간 인기 검색어 데이터를 불러올 수 없습니다.");
      setPopularSearches([]);
      setSelectedTrend(null);
      setIsNewsOpen(false);
    } else if (trendsData?.error) {
      setError("실시간 인기 검색어 데이터를 불러올 수 없습니다.");
      setPopularSearches([]);
      setSelectedTrend(null);
      setIsNewsOpen(false);
    }
    setIsLoading(isTrendsLoading);
  }, [trendsData, isTrendsLoading, selectedKeywordFromUrl]);

  // Handle error from tRPC
  useEffect(() => {
    if (trendsError) {
      setError("실시간 인기 검색어 데이터를 불러올 수 없습니다.");
      setPopularSearches([]);
      setSelectedTrend(null);
      setIsNewsOpen(false);
    }
  }, [trendsError]);

  const handleSelectTrend = (item: TrendItem) => {
    setSelectedKeywordFromUrl("");
    setSelectedTrend(item);
    setIsNewsOpen(true);
  };

  return (
    <div className="youtubePageContainer">
      {/* 페이지 상단 타이틀 */}
      <div className="pageHeader">
        <h1 className="pageTitle">
          검색 트렌드
        </h1>
        <p className="pageDescription">
          한국 검색 흐름과 인기 검색어를 확인하세요.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 border-b border-slate-700 lg:hidden" role="tablist" aria-label="검색 트렌드 종류">
        <button
          id="google-trends-tab"
          type="button"
          role="tab"
          aria-selected={mobileTab === "google"}
          aria-controls="google-trends-panel"
          tabIndex={mobileTab === "google" ? 0 : -1}
          onClick={() => setMobileTab("google")}
          onKeyDown={handleMobileTabKeyDown}
          className={`min-h-11 border-b-2 px-2 text-xs font-semibold transition-colors ${mobileTab === "google" ? "border-blue-400 text-blue-300" : "border-transparent text-slate-400"}`}
        >
          구글 트렌드
        </button>
        <button
          id="search-keyword-trends-tab"
          type="button"
          role="tab"
          aria-selected={mobileTab === "keywords"}
          aria-controls="search-keyword-trends-panel"
          tabIndex={mobileTab === "keywords" ? 0 : -1}
          onClick={() => setMobileTab("keywords")}
          onKeyDown={handleMobileTabKeyDown}
          className={`min-h-11 border-b-2 px-2 text-xs font-semibold transition-colors ${mobileTab === "keywords" ? "border-blue-400 text-blue-300" : "border-transparent text-slate-400"}`}
        >
          검색어 트렌드
        </button>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        <section
          id="google-trends-panel"
          role="tabpanel"
          aria-labelledby="google-trends-tab"
          className={`min-w-0 ${mobileTab === "google" ? "block" : "hidden"} lg:block`}
        >
          <h2 id="google-trends-heading" className="mb-5 hidden text-xl font-bold text-foreground lg:block">
            구글 트렌드
          </h2>

        {error ? (
          <div className="flex h-[562px] items-center justify-center rounded-md border border-slate-800 bg-slate-900/25 p-8 text-center">
            <p className="text-slate-500">{error}</p>
          </div>
        ) : isLoading ? (
          <div className="flex h-[562px] items-center justify-center rounded-md border border-slate-800 bg-slate-900/25 p-8 text-center">
            <p className="text-slate-500">로딩 중...</p>
          </div>
        ) : popularSearches.length === 0 ? (
          <div className="flex h-[562px] items-center justify-center rounded-md border border-slate-800 bg-slate-900/25 p-8 text-center">
            <p className="text-slate-500">실시간 인기 검색어 데이터를 불러올 수 없습니다.</p>
          </div>
        ) : (
          <div className="min-w-0">
            <div className="min-w-0">
              <div id="google-trend-ranking" className="min-h-[562px] rounded-md border border-slate-800 bg-slate-900/25">
                <div className="flex flex-col gap-1.5 p-1.5">
                  {popularSearches.slice(0, visibleCount).map((item, index) => (
                    <div
                      key={item.keyword}
                      className={`grid min-h-[49px] grid-cols-[1.25rem_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md px-4 py-2 transition-colors cursor-pointer ${
                        selectedTrend?.keyword === item.keyword
                          ? "bg-blue-500/15 ring-1 ring-inset ring-blue-400/45"
                          : index % 2 === 0
                            ? "bg-slate-800/35 hover:bg-slate-800/55"
                            : "bg-slate-900/45 hover:bg-slate-800/40"
                      }`}
                      onClick={() => handleSelectTrend(item)}
                    >
                      <div className="text-center text-sm font-semibold text-blue-400">{item.rank}</div>
                      <div className="min-w-0 truncate text-sm font-medium text-foreground" title={item.keyword}>{item.keyword}</div>
                      <GoogleTrendRankChange change={item.rankChange} />
                      <div className="text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectTrend(item);
                          }}
                          className="whitespace-nowrap text-sm font-medium text-blue-500 transition hover:text-blue-400"
                        >
                          자세히
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
              {(!isAuthenticated || popularSearches.length > visibleCount || visibleCount > GOOGLE_TRENDS_PAGE_SIZE) && (
                <div className="mt-4 flex justify-center gap-5">
                  {(!isAuthenticated || popularSearches.length > visibleCount) && (
                    <button
                      type="button"
                      onClick={handleMore}
                      disabled={authLoading}
                      aria-controls="google-trend-ranking"
                      aria-expanded={visibleCount > GOOGLE_TRENDS_PAGE_SIZE}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 transition-colors hover:text-blue-300 disabled:cursor-wait disabled:opacity-50"
                    >
                      더보기
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                  {isAuthenticated && visibleCount > GOOGLE_TRENDS_PAGE_SIZE && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount(GOOGLE_TRENDS_PAGE_SIZE)}
                      aria-controls="google-trend-ranking"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 transition-colors hover:text-blue-300"
                    >
                      접기
                      <ChevronDown className="h-4 w-4 rotate-180" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        )}
        </section>
        <div
          id="search-keyword-trends-panel"
          role="tabpanel"
          aria-labelledby="search-keyword-trends-tab"
          className={`min-w-0 ${mobileTab === "keywords" ? "block" : "hidden"} lg:block`}
        >
          <SearchKeywordTrends />
        </div>
      </div>
      <Dialog
        open={isNewsOpen && Boolean(selectedTrend)}
        onOpenChange={(open) => {
          setIsNewsOpen(open);
          if (!open) setSelectedTrend(null);
        }}
      >
        {selectedTrend && (
          <DialogContent
            className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden border-slate-700 bg-slate-950 p-0 text-foreground sm:max-w-xl"
            overlayClassName="bg-black/75"
          >
            <DialogHeader className="shrink-0 border-b border-slate-800 px-5 py-5 pr-12 text-left">
              <DialogTitle className="text-lg leading-snug">{selectedTrend.keyword}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-1 text-xs text-slate-400">
                <span>순위 {selectedTrend.rank} ·</span>
                <GoogleTrendRankChange change={selectedTrend.rankChange} />
                <span>· Google Trends</span>
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <TrendNews news={selectedTrend.news} />
            </div>
          </DialogContent>
        )}
      </Dialog>
      <GuestAccessPrompt
        open={showGuestPrompt && !isAuthenticated}
        onBrowse={() => setShowGuestPrompt(false)}
        onLogin={() => {
          setShowGuestPrompt(false);
          setLocation("/login?redirect=%2Ftrends%2Fgoogle");
        }}
        onSignup={() => {
          setShowGuestPrompt(false);
          setLocation("/login?mode=signup&redirect=%2Ftrends%2Fgoogle");
        }}
      />
    </div>
  );
}
