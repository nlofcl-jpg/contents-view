import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { UnifiedChart } from "@/components/UnifiedChart";
import { ChevronDown } from "lucide-react";

type InsightPoint = {
  period: string;
  ratio: number;
};

export default function UnifiedInsights() {
  // State management
  const [selectedCategory, setSelectedCategory] = useState("패션의류");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [chartPeriodDays, setChartPeriodDays] = useState(30);
  const [chartUnit, setChartUnit] = useState("일간");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedDevice, setSelectedDevice] = useState("전체");
  const [selectedGender, setSelectedGender] = useState("전체");
  const [selectedAge, setSelectedAge] = useState("전체");
  const [showTrend, setShowTrend] = useState(true);
  const [showShopping, setShowShopping] = useState(true);
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
  const primaryShoppingSummary = getSeriesSummary(primaryKeyword ? chartData?.shopping?.[primaryKeyword] : undefined);
  const shoppingStatus = primaryKeyword ? chartData?.meta?.shoppingStatus?.[primaryKeyword] : undefined;


  // Category mapping (1차 카테고리만)
  const categoryMap: Record<string, string> = {
    "패션의류": "50000000",
    "패션잡화": "50000001",
    "화장품/미용": "50000002",
    "디지털/가전": "50000003",
    "가구/인테리어": "50000004",
    "식품": "50000005",
    "스포츠/레저": "50000006",
    "생활/건강": "50000007",
    "출산/육아": "50000008",
    "도서/음반/DVD": "50000009",
  };

  const categories = Object.keys(categoryMap);
  const devices = ["전체", "PC", "모바일"];
  const genders = ["전체", "남성", "여성"];
  const ages = ["전체", "10대", "20대", "30대", "40대", "50대", "60대 이상"];
  const timeUnits = ["일간", "주간", "월간"];

  // Handle layer toggle with validation
  const handleToggleTrend = () => {
    if (showTrend && !showShopping) {
      // Cannot disable trend if shopping is already disabled
      return;
    }
    setShowTrend(!showTrend);
  };

  const handleToggleShopping = () => {
    if (showShopping && !showTrend) {
      // Cannot disable shopping if trend is already disabled
      return;
    }
    setShowShopping(!showShopping);
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

    if (chartPeriodDays === 0 && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
      timeUnit = chartUnit === "일간" ? "date" : chartUnit === "주간" ? "week" : "month";
    } else {
      startDate.setDate(now.getDate() - chartPeriodDays);
      timeUnit = "date";
    }

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
      chartPeriodDays,
      chartUnit,
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
      category: categoryMap[selectedCategory],
      startDate: startDateStr,
      endDate: endDateStr,
      timeUnit: timeUnit as any,
      device: selectedDevice !== "전체" ? selectedDevice : undefined,
      gender: selectedGender !== "전체" ? selectedGender : undefined,
      ages: selectedAge !== "전체" ? [selectedAge] : undefined,
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-blue-500/20 bg-slate-900/50 p-4">
              <p className="text-xs font-semibold text-slate-400">검색 관심도</p>
              <p className="mt-2 text-2xl font-bold text-white">{formatRatio(primaryTrendSummary.latest)}</p>
              <p className="mt-1 text-xs text-slate-500">직전 구간 대비 {formatDelta(primaryTrendSummary.delta)}</p>
            </div>
            <div className="rounded-lg border border-blue-500/20 bg-slate-900/50 p-4">
              <p className="text-xs font-semibold text-slate-400">쇼핑 클릭 반응</p>
              <p className="mt-2 text-2xl font-bold text-white">{formatRatio(primaryShoppingSummary.latest)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {shoppingStatus === "NO_DATA" ? "쇼핑 데이터 없음" : `직전 구간 대비 ${formatDelta(primaryShoppingSummary.delta)}`}
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/35 p-4">
              <p className="text-xs font-semibold text-slate-400">월간 검색량</p>
              <p className="mt-2 text-xl font-bold text-slate-300">연결 필요</p>
              <p className="mt-1 text-xs text-slate-500">네이버 검색광고 API 연결 후 표시</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/35 p-4">
              <p className="text-xs font-semibold text-slate-400">연관 키워드</p>
              <p className="mt-2 text-xl font-bold text-slate-300">연결 필요</p>
              <p className="mt-1 text-xs text-slate-500">검색광고 API에서 확장 예정</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/35 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">현재 구현 단계</h3>
                <p className="mt-1 text-sm text-slate-400">
                  지금은 네이버 데이터랩 기반의 검색 트렌드와 쇼핑 클릭량을 통합 표시합니다.
                </p>
              </div>
              <span className="w-fit rounded-full border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-300">
                검색광고 API 연결 전
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-cyan-700/30 bg-slate-900/50 p-4 md:p-5">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">쇼핑 클릭량 분석</h3>
                <p className="mt-1 text-sm text-slate-400">
                  기간, 카테고리, 성별, 연령, 디바이스 조건을 조정해 쇼핑 반응을 확인하세요.
                </p>
              </div>
              <button
                onClick={() => runQuery()}
                disabled={isLoading}
                className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-700"
              >
                필터 적용
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="category" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  카테고리
                </label>
                <div className="relative">
                  <select
                    id="category"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-10 w-full appearance-none rounded-lg border border-slate-600 bg-slate-800 px-3 text-sm text-white"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">기간</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "1개월", days: 30 },
                    { label: "3개월", days: 90 },
                    { label: "6개월", days: 180 },
                    { label: "1년", days: 365 },
                    { label: "직접", days: 0 },
                  ].map((option) => (
                    <button
                      key={option.days}
                      onClick={() => setChartPeriodDays(option.days)}
                      className={`h-10 rounded-lg px-2 text-xs font-semibold transition-colors ${
                        chartPeriodDays === option.days
                          ? "bg-blue-600 text-white"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      } ${option.days === 0 ? "col-span-2" : ""}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="device" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  디바이스
                </label>
                <div className="relative">
                  <select
                    id="device"
                    value={selectedDevice}
                    onChange={(e) => setSelectedDevice(e.target.value)}
                    className="h-10 w-full appearance-none rounded-lg border border-slate-600 bg-slate-800 px-3 text-sm text-white"
                  >
                    {devices.map((device) => (
                      <option key={device} value={device}>
                        {device}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="gender" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  성별
                </label>
                <div className="relative">
                  <select
                    id="gender"
                    value={selectedGender}
                    onChange={(e) => setSelectedGender(e.target.value)}
                    className="h-10 w-full appearance-none rounded-lg border border-slate-600 bg-slate-800 px-3 text-sm text-white"
                  >
                    {genders.map((gender) => (
                      <option key={gender} value={gender}>
                        {gender}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="age" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  연령
                </label>
                <div className="relative">
                  <select
                    id="age"
                    value={selectedAge}
                    onChange={(e) => setSelectedAge(e.target.value)}
                    className="h-10 w-full appearance-none rounded-lg border border-slate-600 bg-slate-800 px-3 text-sm text-white"
                  >
                    {ages.map((age) => (
                      <option key={age} value={age}>
                        {age}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>

            {chartPeriodDays === 0 && (
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <label htmlFor="start-date" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    시작일
                  </label>
                  <input
                    id="start-date"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="h-10 rounded-lg border border-slate-600 bg-slate-800 px-3 text-sm text-white"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="end-date" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    종료일
                  </label>
                  <input
                    id="end-date"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="h-10 rounded-lg border border-slate-600 bg-slate-800 px-3 text-sm text-white"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="time-unit" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    시간 단위
                  </label>
                  <div className="relative">
                    <select
                      id="time-unit"
                      value={chartUnit}
                      onChange={(e) => setChartUnit(e.target.value)}
                      className="h-10 w-full appearance-none rounded-lg border border-slate-600 bg-slate-800 px-3 text-sm text-white"
                    >
                      {timeUnits.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={handleToggleTrend}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  showTrend
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                검색 트렌드
              </button>
              <button
                onClick={handleToggleShopping}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  showShopping
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                쇼핑 클릭량
              </button>
            </div>
          </div>

          <div className="bg-slate-900 bg-opacity-50 border border-cyan-700 border-opacity-30 rounded-lg px-6 pt-6 pb-8 md:p-6 md:pb-6 h-auto min-h-0">
            {/* Chart Header */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                검색 트렌드 · 쇼핑 클릭량 비교
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
                  trend: showTrend,
                  shopping: showShopping,
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
                검색 트렌드 · 쇼핑 클릭량 비교
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
                  trend: showTrend,
                  shopping: showShopping,
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
