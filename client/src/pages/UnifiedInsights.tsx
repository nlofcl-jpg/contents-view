import { useState, useRef, useEffect } from "react";
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
  const [isPeriodExpanded, setIsPeriodExpanded] = useState(false);
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

  // Add keyword
  const handleAddKeyword = () => {
    const trimmed = keywordInput.trim();
    if (!trimmed) return;
    if (keywords.includes(trimmed)) {
      alert("중복된 키워드입니다.");
      return;
    }
    if (keywords.length >= 5) {
      alert("최대 5개까지만 추가할 수 있습니다.");
      return;
    }
    setKeywords([...keywords, trimmed]);
    setKeywordInput("");
  };

  // Remove keyword
  const handleRemoveKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  // Handle query button click
  const handleQuery = () => {
    // Allow category-only searches (keywords optional)
    // No validation needed - category is always set, keywords can be empty

    setIsLoading(true);
    setQueryError("");
    setQuerySuccess(false);

    const now = new Date();
    let startDate = new Date();
    let timeUnit = "date";

    if (isPeriodExpanded && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
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
    const endDateStr = formatLocalDate(now);

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
      keywords,
      category: categoryMap[selectedCategory],
      startDate: startDateStr,
      endDate: endDateStr,
      timeUnit: timeUnit as any,
      device: selectedDevice !== "전체" ? selectedDevice : undefined,
      gender: selectedGender !== "전체" ? selectedGender : undefined,
      ages: selectedAge !== "전체" ? [selectedAge] : undefined,
    });
  };

  return (
    <div className="w-full">

      {/* Filter Card */}
      <div className="w-full max-w-full min-w-0 bg-slate-900 bg-opacity-50 border border-slate-700 rounded-lg p-4 md:p-6 mb-8 overflow-hidden">
        {/* Row 1: Category + Keyword Input + Add Button + Query Button */}
        <div className="mb-6">
          <div className="grid gap-4 items-end" style={{
            gridTemplateColumns: typeof window !== 'undefined' && window.innerWidth < 768 ? "1fr" : "220px 1fr 100px 100px"
          }}>
            <div className="flex flex-col gap-2">
              <label htmlFor="category" className="text-sm font-medium text-slate-300">
                쇼핑 카테고리
              </label>
              <div className="relative">
                <select
                  id="category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full h-10 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white appearance-none cursor-pointer"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="keyword" className="text-sm font-medium text-slate-300">
                검색어 입력 <span className="text-xs text-slate-400">(선택)</span>
              </label>
              <input
                id="keyword"
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddKeyword();
                }}
                placeholder="예: 원피스, 블라우스"
                autoComplete="off"
                className="w-full h-10 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500"
              />
            </div>

            <button
              onClick={handleAddKeyword}
              className="h-10 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              추가
            </button>

            <button
              onClick={handleQuery}
              disabled={isLoading}
              className="h-10 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-lg font-medium transition-colors"
            >
              조회
            </button>
          </div>
        </div>

        {/* Row 2: Keyword Chips */}
        {keywords.length > 0 && (
          <div className="mb-6">
            <label className="text-sm font-medium text-slate-300 block mb-2">
              선택된 키워드
            </label>
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-3 py-1 bg-blue-600 bg-opacity-20 border border-blue-500 border-opacity-30 rounded-full"
                >
                  <span className="text-sm text-blue-300">{keyword}</span>
                  <button
                    onClick={() => handleRemoveKeyword(index)}
                    className="text-blue-300 hover:text-blue-200"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Row 3: Period Header with Toggle */}

        {/* Row 4: Period Header with Toggle */}
        <div className="mb-6">
          <button
            onClick={() => setIsPeriodExpanded(!isPeriodExpanded)}
            className="flex items-center gap-2 w-full mb-2"
          >
            <label className="text-sm font-medium text-slate-300 cursor-pointer">
              기간
            </label>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                isPeriodExpanded ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Collapsible Section: Period Buttons + Device + Gender + Age */}
          {isPeriodExpanded && (
            <>
              {/* Period Buttons */}
              <div className={typeof window !== 'undefined' && window.innerWidth < 768 ? "grid grid-cols-2 gap-3 mb-6" : "flex gap-2 mb-6"}>
                {[
                  { label: "1개월", days: 30 },
                  { label: "3개월", days: 90 },
                  { label: "6개월", days: 180 },
                  { label: "1년", days: 365 },
                ].map((option) => (
                  <button
                    key={option.days}
                    onClick={() => {
                      setChartPeriodDays(option.days);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                      chartPeriodDays === option.days
                        ? "bg-blue-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  onClick={() => setIsPeriodExpanded(true)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${typeof window !== 'undefined' && window.innerWidth < 768 ? "col-span-2" : ""} ${
                    chartPeriodDays === 0
                      ? "bg-blue-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  사용자 정의
                </button>
              </div>

              {/* Custom Date + Time Unit */}
              {chartPeriodDays === 0 && (
                <div className="mb-6">
                  <div className="grid gap-4 items-end" style={{
                    gridTemplateColumns: typeof window !== 'undefined' && window.innerWidth < 768 ? "1fr" : "1fr 1fr 1fr"
                  }}>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="start-date" className="text-sm font-medium text-slate-300">
                        시작일
                      </label>
                      <input
                        id="start-date"
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full h-10 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="end-date" className="text-sm font-medium text-slate-300">
                        종료일
                      </label>
                      <input
                        id="end-date"
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full h-10 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="time-unit" className="text-sm font-medium text-slate-300">
                        시간 단위
                      </label>
                      <div className="relative">
                        <select
                          id="time-unit"
                          value={chartUnit}
                          onChange={(e) => setChartUnit(e.target.value)}
                          className="w-full h-10 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white appearance-none cursor-pointer"
                        >
                          {timeUnits.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Device / Gender / Age Filters */}
              <div className="mb-6">
                <div className="grid gap-4 items-end" style={{
                  gridTemplateColumns: typeof window !== 'undefined' && window.innerWidth < 768 ? "1fr 1fr" : "1fr 1fr 1fr"
                }}>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="device" className="text-sm font-medium text-slate-300">
                      기기
                    </label>
                    <div className="relative">
                      <select
                        id="device"
                        value={selectedDevice}
                        onChange={(e) => setSelectedDevice(e.target.value)}
                        className="w-full h-10 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white appearance-none cursor-pointer"
                      >
                        {devices.map((device) => (
                          <option key={device} value={device}>
                            {device}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="gender" className="text-sm font-medium text-slate-300">
                      성별
                    </label>
                    <div className="relative">
                      <select
                        id="gender"
                        value={selectedGender}
                        onChange={(e) => setSelectedGender(e.target.value)}
                        className="w-full h-10 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white appearance-none cursor-pointer"
                      >
                        {genders.map((gender) => (
                          <option key={gender} value={gender}>
                            {gender}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="age" className="text-sm font-medium text-slate-300">
                      연령대
                    </label>
                    <div className="relative">
                      <select
                        id="age"
                        value={selectedAge}
                        onChange={(e) => setSelectedAge(e.target.value)}
                        className="w-full h-10 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white appearance-none cursor-pointer"
                      >
                        {ages.map((age) => (
                          <option key={age} value={age}>
                            {age}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Row 3: Data Layer Toggles */}
        <div className="mb-0">
          <label className="text-sm font-medium text-slate-300 block mb-3">
            데이터 레이어
          </label>
          <div className="grid w-full grid-cols-2 gap-3 md:flex md:flex-wrap">
            <button
              onClick={handleToggleTrend}
              className={`px-4 py-2 rounded-lg font-medium transition-colors min-w-0 md:min-w-auto ${
                showTrend
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              검색어 트렌드
            </button>
            <button
              onClick={handleToggleShopping}
              className={`px-4 py-2 rounded-lg font-medium transition-colors min-w-0 md:min-w-auto ${
                showShopping
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              쇼핑 클릭량
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {keywords.length === 0 && !isLoading && !querySuccess && (
        <div className="mt-8 p-8 text-center bg-slate-900 bg-opacity-30 border border-slate-700 rounded-lg min-h-[260px] sm:min-h-[320px] lg:min-h-[380px] flex items-center justify-center">
          <p className="text-slate-400">
            키워드를 추가한 후 조회해주세요.
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
