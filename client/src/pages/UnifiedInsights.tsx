import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { UnifiedChart } from "@/components/UnifiedChart";
import { CircleAlert, Lock } from "lucide-react";

type InsightPoint = {
  period: string;
  ratio: number;
};

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
};

export default function UnifiedInsights() {
  // State management
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [infoPopup, setInfoPopup] = useState<{ title: string; body: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [queryError, setQueryError] = useState("");
  const [querySuccess, setQuerySuccess] = useState(false);
  const [chartData, setChartData] = useState<any>(null);
  const [startDateForChart, setStartDateForChart] = useState("");
  const [endDateForChart, setEndDateForChart] = useState("");
  const [timeUnitForChart, setTimeUnitForChart] = useState("date");

  const getSeriesSummary = (series?: InsightPoint[]) => {
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
  const keywordTool = chartData?.meta?.keywordTool;
  const primaryMetric: KeywordMetric | null = keywordTool?.primary || null;
  const recommendedKeywords: KeywordMetric[] = keywordTool?.recommended || [];
  const relatedKeywords: KeywordMetric[] = keywordTool?.related || [];
  const visibleRelatedKeywords = relatedKeywords.slice(0, 10);
  const hasLockedRelatedKeywords = relatedKeywords.length > visibleRelatedKeywords.length;
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
        // Store chart data
        setChartData(data);
        setQuerySuccess(true);
        setQueryError("");
      } else {
        setQueryError(data.error || "데이터를 불러오지 못했습니다.");
        setQuerySuccess(false);
        setChartData(null);
      }
      setIsLoading(false);
    },
    onError: (error) => {
      setQueryError("조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      setQuerySuccess(false);
      setChartData(null);
      setIsLoading(false);
    },
  });

  const runQuery = (requestedKeywords?: string[]) => {
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

    const now = new Date();
    let startDate = new Date();
    let timeUnit = "date";

    let endDate = now;

    startDate.setDate(now.getDate() - 30);
    timeUnit = "date";

    // Format date as local date string (YYYY-MM-DD) without UTC conversion
    const formatLocalDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const startDateStr = formatLocalDate(startDate);
    const endDateStr = formatLocalDate(endDate);

    // Logging for diagnosis
    console.log('[Frontend] Date Calculation:', {
      chartPeriodDays: 30,
      chartUnit: "일간",
      startDateStr,
      endDateStr,
      nowTime: now.toLocaleString('ko-KR'),
    });

    // Store dates for chart display
    setStartDateForChart(startDateStr);
    setEndDateForChart(endDateStr);
    setTimeUnitForChart(timeUnit);

    queryUnifiedInsight({
      keywords: nextKeywords,
      startDate: startDateStr,
      endDate: endDateStr,
      timeUnit: timeUnit as any,
    });
  };

  const handleSearch = () => {
    const trimmed = keywordInput.trim();
    if (!trimmed) {
      setQueryError("검색어를 입력해주세요.");
      setQuerySuccess(false);
      return;
    }
    runQuery([trimmed]);
  };

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

      {/* Search Card */}
      <div className="w-full max-w-full min-w-0 bg-slate-900 bg-opacity-50 border border-slate-700 rounded-lg p-4 md:p-6 mb-8 overflow-hidden">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            id="keyword"
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="검색어를 입력하세요. 예: 원피스"
            autoComplete="off"
            className="h-12 min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 text-base text-white placeholder-slate-500 outline-none transition-colors focus:border-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="h-12 rounded-lg bg-blue-600 px-8 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-700 md:w-32"
          >
            검색
          </button>
        </div>
        {queryError && !isLoading && !querySuccess && !chartData && (
          <p className="mt-3 text-sm text-red-300">{queryError}</p>
        )}
      </div>

      {/* Empty State */}
      {keywords.length === 0 && !isLoading && !querySuccess && (
        <div className="mt-8 p-8 text-center bg-slate-900 bg-opacity-30 border border-slate-700 rounded-lg min-h-[260px] sm:min-h-[320px] lg:min-h-[380px] flex items-center justify-center">
          <p className="text-slate-400">
            검색어를 입력하고 검색 버튼을 눌러주세요.
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="mt-8 p-8 text-center bg-slate-900 bg-opacity-30 border border-slate-700 rounded-lg">
          <p className="text-slate-400">데이터를 불러오는 중입니다...</p>
        </div>
      )}

      {/* Chart Display */}
      {!isLoading && querySuccess && chartData && (
        <div className="mt-8 space-y-6">
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
              <div className="grid grid-cols-3 gap-3">
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-slate-800/70 p-3 text-center">
                  <p className="text-xs text-slate-500">PC</p>
                  <p className="mt-2 text-xl font-bold text-slate-300">{formatNumber(primaryMetric?.monthlyPcSearches)}</p>
                </div>
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-slate-800/70 p-3 text-center">
                  <p className="text-xs text-slate-500">모바일</p>
                  <p className="mt-2 text-xl font-bold text-slate-300">{formatNumber(primaryMetric?.monthlyMobileSearches)}</p>
                </div>
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-blue-950/50 p-3 text-center">
                  <p className="text-xs text-blue-300">전체</p>
                  <p className="mt-2 text-xl font-bold text-white">{formatNumber(primaryMetric?.monthlyTotalSearches)}</p>
                </div>
              </div>
              {keywordTool?.error && <p className="mt-3 text-xs text-slate-500">{keywordTool.error}</p>}
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
              <div className="grid grid-cols-3 gap-3">
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-slate-800/70 p-3 text-center">
                  <p className="text-xs text-slate-500">블로그 발행수</p>
                  <p className="mt-2 text-xl font-bold text-slate-300">
                    {formatNumber(blogTotalDocuments)}
                  </p>
                </div>
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-slate-800/70 p-3 text-center">
                  <p className="text-xs text-slate-500">경쟁강도</p>
                  <p className="mt-2 text-xl font-bold text-slate-300">{getBlogCompetitionStrength(searchRatio)}</p>
                </div>
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-blue-950/50 p-3 text-center">
                  <p className="text-xs text-blue-300">검색 비율</p>
                  <p className="mt-2 text-xl font-bold text-white">{formatDecimal(searchRatio)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-blue-500/20 bg-slate-900/50 p-4">
              <p className="text-xs font-semibold text-slate-400">검색 관심도</p>
              <p className="mt-2 text-2xl font-bold text-white">{formatRatio(primaryTrendSummary.latest)}</p>
              <p className="mt-1 text-xs text-slate-500">직전 구간 대비 {formatDelta(primaryTrendSummary.delta)}</p>
            </div>
            <div className="rounded-lg border border-blue-500/20 bg-slate-900/50 p-4">
              <p className="text-xs font-semibold text-slate-400">월간 클릭량</p>
              <p className="mt-2 text-2xl font-bold text-white">{formatDecimal(primaryMetric?.monthlyTotalClicks)}</p>
              <p className="mt-1 text-xs text-slate-500">PC {formatDecimal(primaryMetric?.monthlyPcClicks)} · 모바일 {formatDecimal(primaryMetric?.monthlyMobileClicks)}</p>
            </div>
            <div className="rounded-lg border border-blue-500/20 bg-slate-900/50 p-4">
              <p className="text-xs font-semibold text-slate-400">키워드 등급</p>
              <p className="mt-2 text-2xl font-bold text-white">{getCompetitionLabel(primaryMetric?.competition)}</p>
              <p className="mt-1 text-xs text-slate-500">광고 노출 깊이 {formatDecimal(primaryMetric?.averageAdDepth)}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/35 p-4">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">추천 키워드</h3>
                <p className="mt-1 text-sm text-slate-400">
                  우선 확인하면 좋은 키워드를 10개 내외로 모아 표시합니다.
                </p>
              </div>
            </div>
            <div className="-mx-1 overflow-x-auto pb-1">
              <div className="flex w-max max-w-none gap-2 px-1">
                {recommendedKeywords.map((item) => (
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

            <div className="mt-5 border-t border-slate-700/70 pt-4">
              <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">연관 키워드</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    검색어와 연결된 키워드를 최대한 많이 리스트로 표시합니다.
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-slate-700/70">
                <div className="grid grid-cols-[minmax(120px,1fr)_92px_92px_72px] gap-0 border-b border-slate-700/70 bg-slate-950/50 px-3 py-2 text-xs font-semibold text-slate-400">
                  <span>키워드</span>
                  <span className="text-right">검색량</span>
                  <span className="text-right">클릭량</span>
                  <span className="text-right">등급</span>
                </div>
                {visibleRelatedKeywords.map((item) => (
                  <button
                    key={item.keyword}
                    type="button"
                    onClick={() => {
                      setKeywordInput(item.keyword);
                      runQuery([item.keyword]);
                    }}
                    className="grid min-h-11 w-full grid-cols-[minmax(120px,1fr)_92px_92px_72px] gap-0 border-b border-slate-800/80 px-3 py-2 text-left text-sm text-slate-200 transition-colors last:border-b-0 hover:bg-slate-800/70"
                  >
                    <span className="min-w-0 truncate">{item.keyword}</span>
                    <span className="text-right text-slate-300">{formatNumber(item.monthlyTotalSearches)}</span>
                    <span className="text-right text-slate-400">{formatDecimal(item.monthlyTotalClicks)}</span>
                    <span className="text-right text-blue-300">{getCompetitionLabel(item.competition)}</span>
                  </button>
                ))}
              </div>
              {hasLockedRelatedKeywords && (
                <div className="mt-3 flex justify-center">
                  <div className="flex w-full max-w-sm flex-col items-center rounded-xl border border-blue-500/20 bg-slate-950/80 px-5 py-5 text-center shadow-2xl shadow-blue-950/30">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-blue-400/25 bg-blue-500/10">
                      <Lock className="h-5 w-5 text-blue-300" aria-hidden="true" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-slate-200">
                      더 많은 연관 키워드를 확인하려면 가입하세요.
                    </p>
                    <button
                      type="button"
                      className="mt-4 h-10 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
                    >
                      무료 체험하기
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 bg-opacity-50 border border-cyan-700 border-opacity-30 rounded-lg px-6 pt-6 pb-8 md:p-6 md:pb-6 h-auto min-h-0">
            {/* Chart Header */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                검색 트렌드 비교
              </h3>
              <div className="text-sm text-slate-400">
                <p className="mb-1">{keywords.join(", ")}</p>
                <p>{startDateForChart} – {endDateForChart}</p>
              </div>
            </div>

            {/* Chart Container */}
            <div className="md:h-[480px] h-[520px]">
              <UnifiedChart
                data={{
                  keywords: chartData.keywords || [],
                  trend: chartData.trend || {},
                  shopping: chartData.shopping || {},
                  shoppingStatus: chartData.meta?.shoppingStatus,
                }}
                visibleLayers={{
                  trend: true,
                  shopping: false,
                }}
                timeUnit={timeUnitForChart}
                startDate={startDateForChart}
                endDate={endDateForChart}
              />
            </div>
          </div>
        </div>
      )}

      {/* Error State with Chart Fallback */}
      {!isLoading && !querySuccess && queryError && chartData && (
        <div className="mt-8">
          <div className="p-4 bg-red-500 bg-opacity-20 border border-red-500 border-opacity-30 rounded-lg mb-6 text-red-300 text-sm">
            {queryError}
          </div>
          {/* Show previous chart if available */}
          <div className="bg-slate-900 bg-opacity-50 border border-cyan-700 border-opacity-30 rounded-lg px-6 pt-6 pb-4 md:p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                검색 트렌드 비교
              </h3>
              <div className="text-sm text-slate-400">
                <p className="mb-1">{keywords.join(", ")}</p>
                <p>{startDateForChart} – {endDateForChart}</p>
              </div>
            </div>
            <div className="md:h-[480px] h-[520px]">
              <UnifiedChart
                data={{
                  keywords: chartData.keywords || [],
                  trend: chartData.trend || {},
                  shopping: chartData.shopping || {},
                  shoppingStatus: chartData.meta?.shoppingStatus,
                }}
                visibleLayers={{
                  trend: true,
                  shopping: false,
                }}
                timeUnit={timeUnitForChart}
                startDate={startDateForChart}
                endDate={endDateForChart}
              />
            </div>
            {/* Mobile-specific bottom padding */}
            <div className="md:hidden h-8"></div>
          </div>
        </div>
      )}
    </div>
  );
}
