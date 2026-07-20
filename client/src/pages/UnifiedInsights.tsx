import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { UnifiedChart } from "@/components/UnifiedChart";
import { ChevronDown, CircleAlert, ListFilter } from "lucide-react";

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
  similarity: number | null;
};

type ShoppingCompetition = {
  productCount: number | null;
  averagePrice: number | null;
  monthlySearches: number | null;
  competitionRatio: number | null;
  strength: string | null;
  error?: string | null;
};

type ShoppingRelatedKeyword = {
  keyword: string;
  monthlySearches: number | null;
  productCount: number | null;
  averagePrice: number | null;
  competitionRatio: number | null;
  strength: string | null;
};

const PERIOD_OPTIONS = [
  { value: "30", label: "1개월", days: 30, unit: "date" },
  { value: "90", label: "3개월", days: 90, unit: "week" },
  { value: "180", label: "6개월", days: 180, unit: "week" },
  { value: "365", label: "1년", days: 365, unit: "month" },
] as const;

const TIME_UNIT_OPTIONS = [
  { value: "date", label: "일간" },
  { value: "week", label: "주간" },
  { value: "month", label: "월간" },
] as const;

const DEVICE_OPTIONS = ["전체", "PC", "모바일"] as const;
const GENDER_OPTIONS = ["전체", "여성", "남성"] as const;

const AGE_OPTIONS = [
  { value: "", label: "전체" },
  { value: "1", label: "12세 이하" },
  { value: "2", label: "10대" },
  { value: "3,4", label: "20대" },
  { value: "5,6", label: "30대" },
  { value: "7,8", label: "40대" },
  { value: "9,10", label: "50대" },
  { value: "11", label: "60대+" },
] as const;

type TrendFilterMenu = "period" | "unit" | "device" | "gender" | "age" | null;
type InsightTab = "content" | "seller";

type TabSearchState = {
  keywords: string[];
  keywordInput: string;
  queryError: string;
  querySuccess: boolean;
  chartData: any;
  trendComparisonData: any;
  trendFilterError: string;
  startDateForChart: string;
  endDateForChart: string;
  timeUnitForChart: string;
  filterLabelForChart: string;
};

const createEmptyTabSearchState = (): TabSearchState => ({
  keywords: [],
  keywordInput: "",
  queryError: "",
  querySuccess: false,
  chartData: null,
  trendComparisonData: null,
  trendFilterError: "",
  startDateForChart: "",
  endDateForChart: "",
  timeUnitForChart: "date",
  filterLabelForChart: "1개월 · 일간 · 전체",
});

export default function UnifiedInsights() {
  // State management
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [isKeywordInputFocused, setIsKeywordInputFocused] = useState(false);
  const [infoPopup, setInfoPopup] = useState<{ title: string; body: string } | null>(null);
  const [activeInsightTab, setActiveInsightTab] = useState<InsightTab>("content");
  const [tabSearchStates, setTabSearchStates] = useState<Record<InsightTab, TabSearchState>>({
    content: createEmptyTabSearchState(),
    seller: createEmptyTabSearchState(),
  });
  const [isKeywordGradeInfoOpen, setIsKeywordGradeInfoOpen] = useState(false);
  const [relatedSortMode, setRelatedSortMode] = useState<"related" | "recommended">("related");
  const [isRelatedSortOpen, setIsRelatedSortOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [queryError, setQueryError] = useState("");
  const [querySuccess, setQuerySuccess] = useState(false);
  const [chartData, setChartData] = useState<any>(null);
  const [trendComparisonData, setTrendComparisonData] = useState<any>(null);
  const [isTrendFilterLoading, setIsTrendFilterLoading] = useState(false);
  const [trendFilterError, setTrendFilterError] = useState("");
  const [openTrendFilterMenu, setOpenTrendFilterMenu] = useState<TrendFilterMenu>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<(typeof PERIOD_OPTIONS)[number]["value"]>("30");
  const [selectedTimeUnit, setSelectedTimeUnit] = useState<(typeof TIME_UNIT_OPTIONS)[number]["value"]>("date");
  const [selectedDevices, setSelectedDevices] = useState<string[]>(["전체"]);
  const [selectedGenders, setSelectedGenders] = useState<string[]>(["전체"]);
  const [selectedAges, setSelectedAges] = useState<string[]>([""]);
  const [startDateForChart, setStartDateForChart] = useState("");
  const [endDateForChart, setEndDateForChart] = useState("");
  const [timeUnitForChart, setTimeUnitForChart] = useState("date");
  const [filterLabelForChart, setFilterLabelForChart] = useState("1개월 · 일간 · 전체");

  const getCurrentTabSearchState = (): TabSearchState => ({
    keywords,
    keywordInput,
    queryError,
    querySuccess,
    chartData,
    trendComparisonData,
    trendFilterError,
    startDateForChart,
    endDateForChart,
    timeUnitForChart,
    filterLabelForChart,
  });

  const applyTabSearchState = (state: TabSearchState) => {
    setKeywords(state.keywords);
    setKeywordInput(state.keywordInput);
    setQueryError(state.queryError);
    setQuerySuccess(state.querySuccess);
    setChartData(state.chartData);
    setTrendComparisonData(state.trendComparisonData);
    setTrendFilterError(state.trendFilterError);
    setStartDateForChart(state.startDateForChart);
    setEndDateForChart(state.endDateForChart);
    setTimeUnitForChart(state.timeUnitForChart);
    setFilterLabelForChart(state.filterLabelForChart);
  };

  const handleInsightTabChange = (nextTab: InsightTab) => {
    if (nextTab === activeInsightTab) return;

    const currentState = getCurrentTabSearchState();
    const nextState = tabSearchStates[nextTab] || createEmptyTabSearchState();

    setTabSearchStates(prev => ({
      ...prev,
      [activeInsightTab]: currentState,
    }));
    applyTabSearchState(nextState);
    setIsLoading(false);
    setIsTrendFilterLoading(false);
    setOpenTrendFilterMenu(null);
    setIsKeywordGradeInfoOpen(false);
    setIsRelatedSortOpen(false);
    setActiveInsightTab(nextTab);
  };

  const getInitialKeywordFromUrl = () => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("keyword")?.trim() || "";
  };

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

  const getSeriesAverage = (series?: InsightPoint[]) => {
    if (!series || series.length === 0) return null;
    const total = series.reduce((sum, item) => sum + item.ratio, 0);
    return total / series.length;
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

  const getShoppingIndexGrade = (indexValue: number | null | undefined) => {
    if (indexValue === null || indexValue === undefined || Number.isNaN(indexValue)) return "-";
    if (indexValue < 5) return "낮음";
    if (indexValue < 15) return "보통";
    if (indexValue < 30) return "높음";
    return "최악";
  };

  const primaryKeyword = chartData?.keywords?.[0] || keywords[0] || "";
  const primaryTrendSummary = getSeriesSummary(primaryKeyword ? chartData?.trend?.[primaryKeyword] : undefined);
  const primaryShoppingSeries: InsightPoint[] | undefined = primaryKeyword ? chartData?.shopping?.[primaryKeyword] : undefined;
  const primaryShoppingSummary = getSeriesSummary(primaryShoppingSeries);
  const primaryShoppingMonthlyClickIndex = getSeriesAverage(primaryShoppingSeries);
  const displayedTrendData = trendComparisonData || chartData;
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
  const visibleRelatedKeywords = sortedRelatedKeywords.slice(0, 10);
  const hasLockedRelatedKeywords = relatedKeywords.length > visibleRelatedKeywords.length;
  const contentVolume = chartData?.meta?.contentVolume;
  const blogTotalDocuments = contentVolume?.sources?.find((item: any) => item.key === "blog")?.totalDocuments ?? null;
  const shoppingStatus = primaryKeyword ? chartData?.meta?.shoppingStatus?.[primaryKeyword] : null;
  const shoppingCompetition: ShoppingCompetition | null = chartData?.meta?.shoppingCompetition || null;
  const shoppingRelatedKeywords: ShoppingRelatedKeyword[] = chartData?.meta?.shoppingRelatedKeywords || [];
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

  const getShoppingCompetitionStrength = () => shoppingCompetition?.strength || "-";

  const getFilterLabel = () => {
    const periodLabel = PERIOD_OPTIONS.find(option => option.value === selectedPeriod)?.label || "1개월";
    const unitLabel = TIME_UNIT_OPTIONS.find(option => option.value === selectedTimeUnit)?.label || "일간";
    const deviceLabel = selectedDevices.includes("전체") ? "전체" : selectedDevices.join(", ");
    const genderLabel = selectedGenders.includes("전체") ? "전체" : selectedGenders.join(", ");
    const ageLabel = selectedAges.includes("")
      ? "전체 연령"
      : selectedAges.map(value => AGE_OPTIONS.find(option => option.value === value)?.label || value).join(", ");
    return [
      periodLabel,
      unitLabel,
      deviceLabel,
      genderLabel,
      ageLabel,
    ].join(" · ");
  };

  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getTrendDateRange = () => {
    const now = new Date();
    const periodOption = PERIOD_OPTIONS.find(option => option.value === selectedPeriod) || PERIOD_OPTIONS[0];
    const startDate = new Date();
    startDate.setDate(now.getDate() - periodOption.days);

    return {
      periodOption,
      startDateStr: formatLocalDate(startDate),
      endDateStr: formatLocalDate(now),
      timeUnit: selectedTimeUnit || periodOption.unit,
    };
  };

  const toggleMultiFilter = (
    currentValues: string[],
    nextValue: string,
    allValue: string,
    setter: (values: string[]) => void
  ) => {
    if (nextValue === allValue) {
      setter([allValue]);
      return;
    }

    const withoutAll = currentValues.filter(value => value !== allValue);
    const nextValues = withoutAll.includes(nextValue)
      ? withoutAll.filter(value => value !== nextValue)
      : [...withoutAll, nextValue];

    setter(nextValues.length > 0 ? nextValues : [allValue]);
  };

  const getFilterSummary = (values: string[], allValue: string, allLabel: string, labelMap?: Record<string, string>) => {
    if (values.includes(allValue)) return allLabel;
    const labels = values.map(value => labelMap?.[value] || value);
    if (labels.length <= 2) return labels.join(", ");
    return `${labels.slice(0, 2).join(", ")} 외 ${labels.length - 2}`;
  };

  const getChartFilterCombinations = () => {
    const deviceOptions = selectedDevices.includes("전체")
      ? [{ value: undefined as string | undefined, label: "전체" }]
      : selectedDevices.map(value => ({ value, label: value }));

    const genderOptions = selectedGenders.includes("전체")
      ? [{ value: undefined as string | undefined, label: "전체" }]
      : selectedGenders.map(value => ({ value, label: value }));

    const ageLabelMap = Object.fromEntries(AGE_OPTIONS.map(option => [option.value, option.label]));
    const ageOptions = selectedAges.includes("")
      ? [{ values: undefined as string[] | undefined, label: "전체 연령" }]
      : selectedAges.map(value => ({
          values: value.split(","),
          label: ageLabelMap[value] || value,
        }));

    return deviceOptions.flatMap(device =>
      genderOptions.flatMap(gender =>
        ageOptions.map(age => ({ device, gender, age }))
      )
    );
  };

  const getChartSeriesLabel = (keyword: string, combination: ReturnType<typeof getChartFilterCombinations>[number], totalCount: number) => {
    if (totalCount === 1) return keyword;
    const parts = [combination.device.label, combination.gender.label, combination.age.label]
      .filter(label => label !== "전체" && label !== "전체 연령");
    return parts.length > 0 ? `${keyword} · ${parts.join(" · ")}` : `${keyword} · 전체`;
  };

  // tRPC mutation
  const { mutate: queryUnifiedInsight } = trpc.naver.unifiedInsight.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        // Store chart data
        setChartData(data);
        setTrendComparisonData(data);
        setQuerySuccess(true);
        setQueryError("");
        setTrendFilterError("");
      } else {
        setQueryError(data.error || "데이터를 불러오지 못했습니다.");
        setQuerySuccess(false);
        setChartData(null);
        setTrendComparisonData(null);
      }
      setIsLoading(false);
    },
    onError: (error) => {
      setQueryError("조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      setQuerySuccess(false);
      setChartData(null);
      setTrendComparisonData(null);
      setIsLoading(false);
    },
  });

  const { mutateAsync: queryTrendFilterInsight } = trpc.naver.unifiedInsight.useMutation();

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

    const { periodOption, startDateStr, endDateStr, timeUnit } = getTrendDateRange();
    const firstDevice = selectedDevices.includes("전체") ? undefined : selectedDevices[0];
    const firstGender = selectedGenders.includes("전체") ? undefined : selectedGenders[0];
    const firstAge = selectedAges.includes("") ? undefined : selectedAges[0]?.split(",");

    // Logging for diagnosis
    console.log('[Frontend] Date Calculation:', {
      chartPeriodDays: periodOption.days,
      chartUnit: timeUnit,
      device: firstDevice,
      gender: firstGender,
      age: firstAge,
      startDateStr,
      endDateStr,
      nowTime: new Date().toLocaleString('ko-KR'),
    });

    // Store dates for chart display
    setStartDateForChart(startDateStr);
    setEndDateForChart(endDateStr);
    setTimeUnitForChart(timeUnit);
    setFilterLabelForChart(getFilterLabel());

    queryUnifiedInsight({
      keywords: nextKeywords,
      startDate: startDateStr,
      endDate: endDateStr,
      timeUnit: timeUnit as any,
      device: firstDevice,
      gender: firstGender,
      ages: firstAge,
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

  useEffect(() => {
    const initialKeyword = getInitialKeywordFromUrl();
    if (!initialKeyword) return;

    setKeywordInput(initialKeyword);
    runQuery([initialKeyword]);
    // URL로 들어온 최초 키워드만 자동 조회합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyTrendFilters = async () => {
    const nextKeywords = keywords.length > 0 ? keywords : [keywordInput.trim()].filter(Boolean);
    const baseKeyword = nextKeywords[0];

    if (!baseKeyword) {
      setTrendFilterError("검색어를 먼저 입력해주세요.");
      return;
    }

    const combinations = getChartFilterCombinations();
    if (combinations.length > 12) {
      setTrendFilterError("필터 조합은 한 번에 최대 12개까지 조회할 수 있습니다.");
      return;
    }

    const { startDateStr, endDateStr, timeUnit } = getTrendDateRange();

    setIsTrendFilterLoading(true);
    setTrendFilterError("");
    setOpenTrendFilterMenu(null);

    try {
      const results = await Promise.all(
        combinations.map(async (combination) => {
          const response: any = await queryTrendFilterInsight({
            keywords: [baseKeyword],
            startDate: startDateStr,
            endDate: endDateStr,
            timeUnit: timeUnit as any,
            device: combination.device.value,
            gender: combination.gender.value,
            ages: combination.age.values,
          });

          return {
            combination,
            response,
          };
        })
      );

      const trend: Record<string, InsightPoint[]> = {};
      const chartKeywords: string[] = [];

      results.forEach(({ combination, response }) => {
        if (!response?.success) return;
        const label = getChartSeriesLabel(baseKeyword, combination, combinations.length);
        chartKeywords.push(label);
        trend[label] = response.trend?.[baseKeyword] || [];
      });

      if (chartKeywords.length === 0) {
        setTrendFilterError("선택한 필터의 검색 트렌드 데이터를 불러오지 못했습니다.");
        return;
      }

      setTrendComparisonData({
        keywords: chartKeywords,
        trend,
        shopping: {},
        meta: chartData?.meta || {},
      });
      setStartDateForChart(startDateStr);
      setEndDateForChart(endDateStr);
      setTimeUnitForChart(timeUnit);
      setFilterLabelForChart(getFilterLabel());
    } catch {
      setTrendFilterError("필터 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsTrendFilterLoading(false);
    }
  };

  const renderSingleCheckFilter = (
    menu: Exclude<TrendFilterMenu, null>,
    label: string,
    options: Array<{ value: string; label: string; checked: boolean; onChange: () => void }>,
    summary: string
  ) => (
    <div className="relative flex flex-col gap-1 text-xs font-medium text-slate-400">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => setOpenTrendFilterMenu(openTrendFilterMenu === menu ? null : menu)}
        className="flex h-10 min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-left text-sm text-slate-100 outline-none transition-colors hover:border-blue-500"
      >
        <span className="min-w-0 truncate">{summary}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${openTrendFilterMenu === menu ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {openTrendFilterMenu === menu && (
        <div className="absolute left-0 top-[4.25rem] z-30 w-full min-w-40 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 shadow-xl shadow-black/30">
          {options.map(option => (
            <label
              key={option.value || "all"}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
            >
              <input
                type="checkbox"
                checked={option.checked}
                onChange={option.onChange}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-blue-500"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );

  const renderTrendFilters = () => (
    <div className="mt-4 rounded-lg border border-slate-700/70 bg-slate-950/35 p-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
        {renderSingleCheckFilter("period", "기간", PERIOD_OPTIONS.map(option => ({
          value: option.value,
          label: option.label,
          checked: selectedPeriod === option.value,
          onChange: () => {
            setSelectedPeriod(option.value);
            setSelectedTimeUnit(option.unit);
          },
        })), PERIOD_OPTIONS.find(option => option.value === selectedPeriod)?.label || "1개월")}
        {renderSingleCheckFilter("unit", "단위", TIME_UNIT_OPTIONS.map(option => ({
          value: option.value,
          label: option.label,
          checked: selectedTimeUnit === option.value,
          onChange: () => setSelectedTimeUnit(option.value),
        })), TIME_UNIT_OPTIONS.find(option => option.value === selectedTimeUnit)?.label || "일간")}
        {renderSingleCheckFilter("device", "기기", DEVICE_OPTIONS.map(option => ({
          value: option,
          label: option,
          checked: selectedDevices.includes(option),
          onChange: () => toggleMultiFilter(selectedDevices, option, "전체", setSelectedDevices),
        })), getFilterSummary(selectedDevices, "전체", "전체"))}
        {renderSingleCheckFilter("gender", "성별", GENDER_OPTIONS.map(option => ({
          value: option,
          label: option,
          checked: selectedGenders.includes(option),
          onChange: () => toggleMultiFilter(selectedGenders, option, "전체", setSelectedGenders),
        })), getFilterSummary(selectedGenders, "전체", "전체"))}
        {renderSingleCheckFilter("age", "연령", AGE_OPTIONS.map(option => ({
          value: option.value,
          label: option.label,
          checked: selectedAges.includes(option.value),
          onChange: () => toggleMultiFilter(selectedAges, option.value, "", setSelectedAges),
        })), getFilterSummary(
          selectedAges,
          "",
          "전체",
          Object.fromEntries(AGE_OPTIONS.map(option => [option.value, option.label]))
        ))}
        <button
          type="button"
          onClick={handleApplyTrendFilters}
          disabled={isTrendFilterLoading || keywords.length === 0}
          className="col-span-2 h-10 self-end rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 md:col-span-1"
        >
          필터 적용
        </button>
      </div>
      {trendFilterError && <p className="mt-3 text-xs text-red-300">{trendFilterError}</p>}
    </div>
  );

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
      <div className="mb-8 w-full max-w-full min-w-0 overflow-visible rounded-[28px] border border-white/35 bg-white p-2 shadow-[0_18px_48px_rgba(21,140,255,0.24),0_0_70px_rgba(21,140,255,0.14)]">
        <div className="flex items-center gap-0">
          <input
            id="keyword"
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onFocus={() => setIsKeywordInputFocused(true)}
            onBlur={() => setIsKeywordInputFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder={isKeywordInputFocused ? "" : "분석할 검색어를 입력하세요."}
            autoComplete="off"
            className="h-12 min-w-0 flex-1 rounded-[22px] border-0 bg-transparent px-4 text-base font-semibold text-slate-950 placeholder-slate-400 outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="h-12 rounded-[22px] bg-blue-600 px-7 font-semibold text-white transition-colors hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500 md:w-28"
          >
            검색
          </button>
        </div>
        {queryError && !isLoading && !querySuccess && !chartData && (
          <p className="mt-3 text-sm text-red-300">{queryError}</p>
        )}
      </div>

      <div className="mb-6 flex w-full justify-center">
        <div className="inline-flex rounded-full border border-slate-700/80 bg-slate-950/55 p-1">
          {[
            { value: "content" as const, label: "컨텐츠" },
            { value: "seller" as const, label: "셀러" },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleInsightTabChange(tab.value)}
              className={`h-9 min-w-24 rounded-full px-5 text-sm transition-colors ${
                activeInsightTab === tab.value
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-950/40"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
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
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-slate-800/70 p-2 text-center md:p-3">
                  <p className="text-xs text-slate-500">PC</p>
                  <p className="mt-2 max-w-full truncate text-sm font-medium text-slate-300 md:text-xl md:font-bold">{formatNumber(primaryMetric?.monthlyPcSearches)}</p>
                </div>
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-slate-800/70 p-2 text-center md:p-3">
                  <p className="text-xs text-slate-500">모바일</p>
                  <p className="mt-2 max-w-full truncate text-sm font-medium text-slate-300 md:text-xl md:font-bold">{formatNumber(primaryMetric?.monthlyMobileSearches)}</p>
                </div>
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-blue-950/50 p-2 text-center md:p-3">
                  <p className="text-xs text-blue-300">전체</p>
                  <p className="mt-2 max-w-full truncate text-sm font-medium text-white md:text-xl md:font-bold">{formatNumber(primaryMetric?.monthlyTotalSearches)}</p>
                </div>
              </div>
              {keywordTool?.error && <p className="mt-3 text-xs text-slate-500">{keywordTool.error}</p>}
            </div>

            {activeInsightTab === "content" ? (
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
                    {formatNumber(blogTotalDocuments)}
                  </p>
                </div>
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-slate-800/70 p-2 text-center md:p-3">
                  <p className="text-xs text-slate-500">경쟁강도</p>
                  <p className="mt-2 max-w-full truncate text-sm font-medium text-slate-300 md:text-xl md:font-bold">{getBlogCompetitionStrength(searchRatio)}</p>
                </div>
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-blue-950/50 p-2 text-center md:p-3">
                  <p className="text-xs text-blue-300">검색 비율</p>
                  <p className="mt-2 max-w-full truncate text-sm font-medium text-white md:text-xl md:font-bold">{formatDecimal(searchRatio)}</p>
                </div>
              </div>
            </div>
            ) : (
            <div className="rounded-lg border border-blue-500/20 bg-slate-900/50 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Shopping Competition</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <h3 className="text-lg font-semibold text-white">쇼핑 경쟁도</h3>
                    <button
                      type="button"
                      aria-label="쇼핑 경쟁도 안내"
                      onClick={() => setInfoPopup({
                        title: "쇼핑 경쟁도",
                        body: "해당 키워드의 쇼핑 데이터와 검색광고 지표를 함께 참고해 셀러 관점의 경쟁 정도를 표시합니다.",
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
                  <p className="text-xs text-slate-500">상품 수</p>
                  <p className="mt-2 max-w-full truncate text-sm font-medium text-slate-300 md:text-xl md:font-bold">
                    {formatNumber(shoppingCompetition?.productCount)}
                  </p>
                </div>
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-slate-800/70 p-2 text-center md:p-3">
                  <p className="text-xs text-slate-500">경쟁강도</p>
                  <p className="mt-2 max-w-full truncate text-sm font-medium text-slate-300 md:text-xl md:font-bold">{getShoppingCompetitionStrength()}</p>
                </div>
                <div className="flex h-20 min-w-0 flex-col items-center justify-between rounded-lg bg-blue-950/50 p-2 text-center md:p-3">
                  <p className="text-xs text-blue-300">월 검색량</p>
                  <p className="mt-2 max-w-full truncate text-sm font-medium text-white md:text-xl md:font-bold">
                    {formatNumber(shoppingCompetition?.monthlySearches)}
                  </p>
                </div>
              </div>
              {shoppingCompetition?.error && <p className="mt-3 text-xs text-slate-500">{shoppingCompetition.error}</p>}
            </div>
            )}
          </div>

          <div className={`grid grid-cols-1 gap-4 ${activeInsightTab === "content" ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
            <div className="rounded-lg border border-blue-500/20 bg-slate-900/50 p-4 text-center">
              <p className="text-xs font-semibold text-slate-200">{activeInsightTab === "content" ? "검색 관심도" : "쇼핑 관심도"}</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {activeInsightTab === "content" ? (
                  formatRatio(primaryTrendSummary.latest)
                ) : (
                  <span className="inline-flex items-baseline justify-center gap-2">
                    <span>{getShoppingIndexGrade(primaryShoppingSummary.latest)}</span>
                    <span className="text-sm font-medium text-slate-300">{formatRatio(primaryShoppingSummary.latest)}</span>
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-slate-300">
                직전 구간 대비 {activeInsightTab === "content" ? formatDelta(primaryTrendSummary.delta) : formatDelta(primaryShoppingSummary.delta)}
              </p>
            </div>
            <div className="rounded-lg border border-blue-500/20 bg-slate-900/50 p-4 text-center">
              <p className="text-xs font-semibold text-slate-200">
                {activeInsightTab === "content" ? "월간 클릭량" : "월간 쇼핑 클릭량"}
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {activeInsightTab === "content"
                  ? formatDecimal(primaryMetric?.monthlyTotalClicks)
                  : getShoppingIndexGrade(primaryShoppingMonthlyClickIndex)}
              </p>
              <p className="mt-1 text-xs text-slate-300">
                {activeInsightTab === "content"
                  ? `PC ${formatDecimal(primaryMetric?.monthlyPcClicks)} · 모바일 ${formatDecimal(primaryMetric?.monthlyMobileClicks)}`
                  : formatRatio(primaryShoppingMonthlyClickIndex)}
              </p>
            </div>
            {activeInsightTab === "seller" && (
              <div className="rounded-lg border border-blue-500/20 bg-slate-900/50 p-4 text-center">
                <p className="text-xs font-semibold text-slate-200">상품 평균가</p>
                <p className="mt-2 text-2xl font-bold text-white">{formatNumber(shoppingCompetition?.averagePrice, "원")}</p>
                <p className="mt-1 text-xs text-slate-300">상위 상품 기준</p>
              </div>
            )}
            <div className="relative rounded-lg border border-blue-500/20 bg-slate-900/50 p-4 text-center">
              <div className="relative inline-flex items-center justify-center gap-1.5">
                <p className="text-xs font-semibold text-slate-200">{activeInsightTab === "content" ? "키워드 등급" : "쇼핑 광고"}</p>
                {activeInsightTab === "content" && (
                  <button
                    type="button"
                    aria-label="키워드 등급 기준 안내"
                    onClick={() => setIsKeywordGradeInfoOpen((isOpen) => !isOpen)}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500 transition-colors hover:text-blue-300"
                  >
                    <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
                {activeInsightTab === "content" && isKeywordGradeInfoOpen && (
                  <div className="absolute left-1/2 top-6 z-20 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-xl shadow-black/20">
                    <p className="text-xs font-medium text-slate-900">수치 기준 안내</p>
                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      키워드 등급은 네이버 검색광고의 경쟁도입니다. 광고 노출 깊이는 검색광고 API에서 제공되는 평균 노출 깊이 참고 수치입니다.
                    </p>
                  </div>
                )}
              </div>
              <p className="mt-2 text-2xl font-bold text-white">{getCompetitionLabel(primaryMetric?.competition)}</p>
              <p className="mt-1 text-xs text-slate-300">
                {activeInsightTab === "content"
                  ? `광고 노출 깊이 ${formatDecimal(primaryMetric?.averageAdDepth)}`
                  : formatDecimal(primaryMetric?.averageAdDepth)}
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
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/35 p-4">
            <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">{activeInsightTab === "content" ? "연관 키워드" : "쇼핑 연관 키워드"}</h3>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-700/70">
              <div className="grid min-w-[620px] grid-cols-[150px_76px_120px_120px_96px] gap-0 border-b border-slate-700/70 bg-slate-950/50 px-4 py-3 text-sm font-semibold text-slate-100 md:grid-cols-[minmax(180px,2fr)_minmax(76px,0.7fr)_minmax(96px,0.9fr)_minmax(96px,0.9fr)_minmax(86px,0.8fr)]">
                <span className="sticky left-0 z-10 relative pr-3 after:pointer-events-none after:absolute after:bottom-0 after:right-0 after:top-0 after:w-4 after:bg-gradient-to-r after:from-transparent after:to-slate-950/20">키워드</span>
                <span className="text-right">{activeInsightTab === "content" ? "등급" : "경쟁"}</span>
                <span className="text-right">검색량</span>
                <span className="text-right">{activeInsightTab === "content" ? "클릭량" : "상품 수"}</span>
                {activeInsightTab === "content" ? (
                <div className="relative flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsRelatedSortOpen(!isRelatedSortOpen)}
                    className="inline-flex items-center gap-1 text-right text-slate-100 transition-colors hover:text-blue-300"
                  >
                    <span>유사도</span>
                    <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  {isRelatedSortOpen && (
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
                ) : (
                  <span className="text-right">평균가</span>
                )}
              </div>
              {activeInsightTab === "content" ? visibleRelatedKeywords.map((item) => (
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
              )) : shoppingRelatedKeywords.map((item) => (
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
                  <span className="text-right text-blue-300">{item.strength || "-"}</span>
                  <span className="text-right text-slate-300">{formatNumber(item.monthlySearches)}</span>
                  <span className="text-right text-slate-400">{formatNumber(item.productCount)}</span>
                  <span className="text-right text-slate-300">{formatNumber(item.averagePrice, "원")}</span>
                </button>
              ))}
              {activeInsightTab === "seller" && shoppingRelatedKeywords.length === 0 && (
                <div className="px-4 py-5 text-center text-sm text-slate-500">
                  쇼핑 연관 키워드를 확인할 수 없습니다.
                </div>
              )}
            </div>
            {activeInsightTab === "content" && hasLockedRelatedKeywords && (
              <div className="mt-4 flex flex-col items-center gap-3">
                <div className="flex flex-col items-center py-1">
                  {[0, 1, 2].map((index) => (
                    <ChevronDown
                      key={index}
                      className="relatedMoreArrow h-4 w-4 text-blue-400"
                      style={{ animationDelay: `${index * 220}ms` }}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="min-h-11 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold leading-none text-white transition-colors hover:bg-blue-500"
                >
                  더 많은 연관 키워드 확인
                </button>
              </div>
            )}
          </div>

          <div className="bg-slate-900 bg-opacity-50 border border-cyan-700 border-opacity-30 rounded-lg px-4 pt-4 pb-5 md:px-6 md:pt-6 md:pb-6 h-auto min-h-0">
            {/* Chart Header */}
            <div className="mb-4 md:mb-6">
              <h3 className="mb-1 text-base font-medium text-white md:mb-2 md:text-lg md:font-semibold">
                {activeInsightTab === "content" ? "검색 트렌드 비교" : "쇼핑 트렌드 비교"}
              </h3>
              <div className="text-xs font-normal text-slate-400 md:text-sm">
                <p className="mb-1">{keywords.join(", ")}</p>
                <p>{startDateForChart} – {endDateForChart}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {activeInsightTab === "content" ? filterLabelForChart : "쇼핑 데이터랩 기준"}
                </p>
              </div>
              {activeInsightTab === "content" && renderTrendFilters()}
            </div>

            {/* Chart Container */}
            <div className="relative h-[300px] md:h-[480px]">
              {isTrendFilterLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-slate-950/70 backdrop-blur-sm">
                  <div className="rounded-lg border border-blue-500/20 bg-slate-900 px-5 py-3 text-sm font-medium text-slate-200 shadow-xl shadow-black/30">
                    검색 트렌드 데이터를 불러오는 중입니다...
                  </div>
                </div>
              )}
              <UnifiedChart
                data={{
                  keywords: activeInsightTab === "content" ? displayedTrendData?.keywords || [] : chartData?.keywords || [],
                  trend: activeInsightTab === "content" ? displayedTrendData?.trend || {} : {},
                  shopping: activeInsightTab === "content" ? {} : chartData?.shopping || {},
                  shoppingStatus: chartData?.meta?.shoppingStatus,
                }}
                visibleLayers={{
                  trend: activeInsightTab === "content",
                  shopping: activeInsightTab === "seller",
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
          <div className="bg-slate-900 bg-opacity-50 border border-cyan-700 border-opacity-30 rounded-lg px-4 pt-4 pb-5 md:p-6">
            <div className="mb-4 md:mb-6">
              <h3 className="mb-1 text-base font-medium text-white md:mb-2 md:text-lg md:font-semibold">
                {activeInsightTab === "content" ? "검색 트렌드 비교" : "쇼핑 트렌드 비교"}
              </h3>
              <div className="text-xs font-normal text-slate-400 md:text-sm">
                <p className="mb-1">{keywords.join(", ")}</p>
                <p>{startDateForChart} – {endDateForChart}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {activeInsightTab === "content" ? filterLabelForChart : "쇼핑 데이터랩 기준"}
                </p>
              </div>
              {activeInsightTab === "content" && renderTrendFilters()}
            </div>
            <div className="relative h-[300px] md:h-[480px]">
              {isTrendFilterLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-slate-950/70 backdrop-blur-sm">
                  <div className="rounded-lg border border-blue-500/20 bg-slate-900 px-5 py-3 text-sm font-medium text-slate-200 shadow-xl shadow-black/30">
                    검색 트렌드 데이터를 불러오는 중입니다...
                  </div>
                </div>
              )}
              <UnifiedChart
                data={{
                  keywords: activeInsightTab === "content" ? displayedTrendData?.keywords || [] : chartData?.keywords || [],
                  trend: activeInsightTab === "content" ? displayedTrendData?.trend || {} : {},
                  shopping: activeInsightTab === "content" ? {} : chartData?.shopping || {},
                  shoppingStatus: chartData?.meta?.shoppingStatus,
                }}
                visibleLayers={{
                  trend: activeInsightTab === "content",
                  shopping: activeInsightTab === "seller",
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
