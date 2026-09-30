import { useState, useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GoogleTrendTraffic } from "@/components/GoogleTrendTraffic";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";

interface NewsItem {
  title: string;
  source: string;
  url: string;
  image: string;
}

interface TrendItem {
  rank: number;
  keyword: string;
  traffic?: string;
  trafficCount?: number;
  news?: NewsItem[];
  source: string;
  country: string;
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
  const getInitialParams = () => {
    if (typeof window === "undefined") return { country: "KR", trend: "" };
    const params = new URLSearchParams(window.location.search);
    return {
      country: params.get("country") || "KR",
      trend: params.get("trend") || "",
    };
  };

  const initialParams = getInitialParams();
  const [selectedCountry, setSelectedCountry] = useState(initialParams.country);
  const [selectedKeywordFromUrl, setSelectedKeywordFromUrl] = useState(initialParams.trend);
  const [popularSearches, setPopularSearches] = useState<TrendItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrend, setSelectedTrend] = useState<TrendItem | null>(null);
  const [isMobileNewsOpen, setIsMobileNewsOpen] = useState(false);
  const [isDetailDismissed, setIsDetailDismissed] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const searchListRef = useRef<HTMLDivElement>(null);
  const [searchListHeight, setSearchListHeight] = useState<number | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) setIsMobileNewsOpen(false);
  }, [isMobile]);

  useLayoutEffect(() => {
    const list = searchListRef.current;
    if (!list) return;

    const updateHeight = () => setSearchListHeight(list.getBoundingClientRect().height);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(list);
    return () => observer.disconnect();
  }, [isLoading, error, popularSearches.length]);

  // Fetch Google Trends data
  const { data: trendsData, isLoading: isTrendsLoading, error: trendsError } = trpc.googleTrends.realtimeTrending.useQuery(
    { country: selectedCountry },
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
        if (isDetailDismissed) return null;
        const keyword = selectedKeywordFromUrl || previous?.keyword;
        return trendsData.data.find((item: TrendItem) => item.keyword === keyword) || trendsData.data[0];
      });
    } else if (trendsData?.success && (!trendsData.data || trendsData.data.length === 0)) {
      setError("실시간 인기 검색어 데이터를 불러올 수 없습니다.");
      setPopularSearches([]);
      setSelectedTrend(null);
    } else if (trendsData?.error) {
      setError("실시간 인기 검색어 데이터를 불러올 수 없습니다.");
      setPopularSearches([]);
      setSelectedTrend(null);
    }
    setIsLoading(isTrendsLoading);
  }, [trendsData, isTrendsLoading, selectedKeywordFromUrl, isDetailDismissed]);

  // Handle error from tRPC
  useEffect(() => {
    if (trendsError) {
      setError("실시간 인기 검색어 데이터를 불러올 수 없습니다.");
      setPopularSearches([]);
      setSelectedTrend(null);
    }
  }, [trendsError]);

  const handleCountryChange = (newCountry: string) => {
    setSelectedCountry(newCountry);
    setSelectedKeywordFromUrl("");
    setIsDetailDismissed(false);
    setSelectedTrend(null);
    setIsMobileNewsOpen(false);
    setVisibleCount(10);
  };

  const handleSelectTrend = (item: TrendItem | null, showMobileNews = false) => {
    setSelectedKeywordFromUrl("");
    setIsDetailDismissed(item === null);
    setSelectedTrend(item);
    setIsMobileNewsOpen(showMobileNews && Boolean(item));
  };

  const countries = [
    { code: "KR", name: "🇰🇷 한국" },
    { code: "US", name: "🇺🇸 미국" },
    { code: "JP", name: "🇯🇵 일본" },
    { code: "GB", name: "🇬🇧 영국" },
    { code: "FR", name: "🇫🇷 프랑스" },
    { code: "DE", name: "🇩🇪 독일" },
    { code: "ES", name: "🇪🇸 스페인" },
  ];

  return (
    <div className="youtubePageContainer">
      {/* 페이지 상단 타이틀 */}
      <div className="pageHeader">
        <h1 className="pageTitle">
          Google Trends
        </h1>
        <p className="pageDescription">
          인기 검색어와 관련 뉴스를 검색량순으로 확인하세요.
        </p>
      </div>

      {/* 실시간 인기 검색어 */}
      <div className="space-y-6">
        <div className="flex min-w-0 flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-bold text-foreground md:text-2xl">
            인기 검색어
          </h2>
          <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-2 md:w-auto">
            {countries.map((country) => (
              <Button
                key={country.code}
                variant={selectedCountry === country.code ? "default" : "outline"}
                size="sm"
                onClick={() => handleCountryChange(country.code)}
                className={
                  selectedCountry === country.code
                    ? "bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                    : "border-slate-600 text-slate-400 hover:bg-slate-900/50 whitespace-nowrap"
                }
              >
                {country.name}
              </Button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="p-8 text-center rounded-xl bg-transparent border border-slate-800">
            <p className="text-slate-500">{error}</p>
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center rounded-xl bg-transparent border border-slate-800">
            <p className="text-slate-500">로딩 중...</p>
          </div>
        ) : popularSearches.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-transparent border border-slate-800">
            <p className="text-slate-500">실시간 인기 검색어 데이터를 불러올 수 없습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            {/* 왼쪽: 인기 검색어 목록 */}
            <div className={`min-w-0 transition-all duration-300 ${selectedTrend ? "w-full md:flex-1" : "w-full"}`}>
              <div ref={searchListRef} className="border border-slate-800 rounded-xl overflow-hidden bg-transparent">
                {/* 데스크톱 테이블 */}
                <div className="hidden md:block">
                  <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-800 bg-slate-900/30">
                    <div className="col-span-1 text-slate-400 text-sm font-medium">순위</div>
                    <div className="col-span-6 text-slate-400 text-sm font-medium">검색어</div>
                    <div className="col-span-3 text-slate-400 text-sm font-medium">검색량</div>
                    <div className="col-span-2 text-slate-400 text-sm font-medium text-right">자세히</div>
                  </div>
                  {popularSearches.slice(0, visibleCount).map((item, idx) => (
                    <div
                      key={item.keyword}
                      className={`mx-2 grid grid-cols-12 items-center gap-4 rounded-md p-4 transition-colors cursor-pointer ${
                        selectedTrend?.keyword === item.keyword
                          ? "bg-blue-500/15 ring-1 ring-inset ring-blue-400/45"
                          : "hover:bg-slate-900/30"
                      } ${idx < Math.min(popularSearches.length, visibleCount) - 1 && selectedTrend?.keyword !== item.keyword ? "border-b border-slate-800" : ""}`}
                      onClick={() => handleSelectTrend(item)}
                    >
                      <div className="col-span-1 text-xl font-bold text-slate-300">{item.rank}</div>
                      <div className="col-span-6 text-foreground font-medium truncate">{item.keyword}</div>
                      <div className="col-span-3 text-sm"><GoogleTrendTraffic traffic={item.traffic} trafficCount={item.trafficCount} /></div>
                      <div className="col-span-2 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectTrend(item);
                          }}
                          className="text-blue-500 hover:text-blue-400 text-sm font-medium transition"
                        >
                          자세히
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 모바일 카드형 */}
                <div className="md:hidden space-y-3 p-4">
                  {popularSearches.slice(0, visibleCount).map((item) => (
                    <div
                      key={item.keyword}
                      className={`p-4 rounded-lg bg-slate-900/20 border transition cursor-pointer ${
                        selectedTrend?.keyword === item.keyword
                          ? "border-blue-400/50 bg-blue-500/15"
                          : "border-slate-800 hover:bg-slate-900/40"
                      }`}
                      onClick={() => handleSelectTrend(item, true)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="text-xl font-bold text-slate-300 w-8 flex-shrink-0">{item.rank}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground font-medium break-words">{item.keyword}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <GoogleTrendTraffic traffic={item.traffic} trafficCount={item.trafficCount} className="text-sm" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectTrend(item, true);
                          }}
                          className="text-blue-500 hover:text-blue-400 text-sm font-medium transition flex-shrink-0"
                        >
                          자세히
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {popularSearches.length > visibleCount && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount(count => count + 10)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 transition-colors hover:text-blue-300"
                  >
                    더보기
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>

            {/* 오른쪽: 상세 정보 박스 */}
            {selectedTrend && (
              <div
                className="hidden w-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 animate-in slide-in-from-right-4 duration-300 md:flex md:h-[var(--trend-list-height)] md:flex-1"
                style={{ "--trend-list-height": searchListHeight ? `${searchListHeight}px` : "auto" } as CSSProperties}
              >
                {/* 헤더 */}
                <div className="flex shrink-0 items-center justify-between p-6 border-b border-slate-800">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-foreground truncate">{selectedTrend.keyword}</h3>
                    <div className="text-slate-400 text-sm mt-1 flex flex-wrap items-center gap-x-1">
                      <span>검색량 순위 {selectedTrend.rank} · 검색량</span>
                      <GoogleTrendTraffic traffic={selectedTrend.traffic} trafficCount={selectedTrend.trafficCount} />
                      <span>· Google Trends</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSelectTrend(null)}
                    className="text-slate-400 hover:text-foreground transition flex-shrink-0 ml-4"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* 본문 */}
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <TrendNews news={selectedTrend.news} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <Dialog open={isMobile && isMobileNewsOpen} onOpenChange={setIsMobileNewsOpen}>
        {selectedTrend && (
          <DialogContent
            className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden border-slate-700 bg-slate-950 p-0 text-foreground sm:max-w-lg"
            overlayClassName="bg-black/75"
          >
            <DialogHeader className="shrink-0 border-b border-slate-800 px-5 py-5 pr-12 text-left">
              <DialogTitle className="text-lg leading-snug">{selectedTrend.keyword}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-1 text-xs text-slate-400">
                <span>검색량 순위 {selectedTrend.rank} · 검색량</span>
                <GoogleTrendTraffic traffic={selectedTrend.traffic} trafficCount={selectedTrend.trafficCount} />
                <span>· Google Trends</span>
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <TrendNews news={selectedTrend.news} />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
