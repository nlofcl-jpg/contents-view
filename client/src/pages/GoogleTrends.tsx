import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  news?: NewsItem[];
  source: string;
  country: string;
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

  // Fetch Google Trends data
  const { data: trendsData, isLoading: isTrendsLoading, error: trendsError } = trpc.googleTrends.realtimeTrending.useQuery(
    { country: selectedCountry },
    {
      enabled: true,
      retry: 1,
    }
  );

  // Update popular searches when data changes
  useEffect(() => {
    if (trendsData?.success && trendsData.data && trendsData.data.length > 0) {
      setPopularSearches(trendsData.data);
      setError(null);
      const matchedTrend = selectedKeywordFromUrl
        ? trendsData.data.find((item: TrendItem) => item.keyword === selectedKeywordFromUrl)
        : null;
      setSelectedTrend(matchedTrend || null);
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
  }, [trendsData, isTrendsLoading, selectedKeywordFromUrl]);

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
  };

  const handleSelectTrend = (item: TrendItem | null) => {
    setSelectedKeywordFromUrl("");
    setSelectedTrend(item);
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
          Google Trends RSS 기반으로 현재 급상승 중인 검색어를 확인하세요.
        </p>
      </div>

      {/* 실시간 인기 검색어 */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">
            실시간 인기 검색어
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
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
          <div className="flex gap-6">
            {/* 왼쪽: 인기 검색어 목록 */}
            <div className={`transition-all duration-300 ${selectedTrend ? "flex-1" : "w-full"}`}>
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-transparent">
                {/* 데스크톱 테이블 */}
                <div className="hidden md:block">
                  <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-800 bg-slate-900/30">
                    <div className="col-span-1 text-slate-400 text-sm font-medium">순위</div>
                    <div className="col-span-6 text-slate-400 text-sm font-medium">검색어</div>
                    <div className="col-span-3 text-slate-400 text-sm font-medium">검색량</div>
                    <div className="col-span-2 text-slate-400 text-sm font-medium text-right">자세히</div>
                  </div>
                  {popularSearches.map((item, idx) => (
                    <div
                      key={item.rank}
                      className={`grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-900/20 transition cursor-pointer ${
                        selectedTrend?.rank === item.rank ? "bg-slate-900/40 border-l-2 border-blue-600" : ""
                      } ${idx < popularSearches.length - 1 ? "border-b border-slate-800" : ""}`}
                      onClick={() => handleSelectTrend(item)}
                    >
                      <div className="col-span-1 text-xl font-bold text-slate-300">{item.rank}</div>
                      <div className="col-span-6 text-foreground font-medium truncate">{item.keyword}</div>
                      <div className="col-span-3 text-slate-400 text-sm">{item.traffic || "-"}</div>
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
                  {popularSearches.map((item) => (
                    <div
                      key={item.rank}
                      className={`p-4 rounded-lg bg-slate-900/20 border transition cursor-pointer ${
                        selectedTrend?.rank === item.rank
                          ? "border-blue-600 bg-slate-900/40"
                          : "border-slate-800 hover:bg-slate-900/40"
                      }`}
                      onClick={() => handleSelectTrend(item)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="text-xl font-bold text-slate-300 w-8 flex-shrink-0">{item.rank}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground font-medium truncate">{item.keyword}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400 text-sm">{item.traffic || "-"}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectTrend(item);
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
            </div>

            {/* 오른쪽: 상세 정보 박스 */}
            {selectedTrend && (
              <div className="flex-1 border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden flex flex-col animate-in slide-in-from-right-4 duration-300">
                {/* 헤더 */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-foreground truncate">{selectedTrend.keyword}</h3>
                    <p className="text-slate-400 text-sm mt-1">
                      순위 {selectedTrend.rank} · 검색량 {selectedTrend.traffic || "-"} · Google Trends
                    </p>
                  </div>
                  <button
                    onClick={() => handleSelectTrend(null)}
                    className="text-slate-400 hover:text-foreground transition flex-shrink-0 ml-4"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* 본문 */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div>
                    <h4 className="text-lg font-semibold text-foreground mb-4">관련 뉴스</h4>
                    {selectedTrend.news && selectedTrend.news.length > 0 ? (
                      <div className="space-y-4">
                        {selectedTrend.news.map((newsItem, idx) => (
                          <a
                            key={idx}
                            href={newsItem.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex gap-4 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition group"
                          >
                            {newsItem.image && (
                              <img
                                src={newsItem.image}
                                alt={newsItem.title}
                                className="w-20 h-20 object-cover rounded flex-shrink-0 group-hover:opacity-80 transition"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-foreground text-sm font-medium line-clamp-2 group-hover:text-blue-400 transition">
                                {newsItem.title}
                              </p>
                              <p className="text-slate-400 text-xs mt-2">{newsItem.source}</p>
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 text-sm">관련 뉴스가 없습니다.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
