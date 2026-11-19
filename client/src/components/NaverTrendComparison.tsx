import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { UnifiedChart } from "@/components/UnifiedChart";
import { trpc } from "@/lib/trpc";

type InsightPoint = {
  period: string;
  ratio: number;
};

type TrendComparison = {
  sourceKeywords: string[];
  keywords: string[];
  keywordBySeries: Record<string, string>;
  trend: Record<string, InsightPoint[]>;
  shopping: Record<string, InsightPoint[]>;
};

type ComparisonResponse = Partial<Pick<TrendComparison, "trend" | "shopping">> & { success?: boolean };

const MAX_COMPARISON_KEYWORDS = 3;
const TREND_FILTER_GRID_CLASS = "grid grid-cols-2 items-end gap-2 md:grid-cols-[repeat(5,minmax(0,1fr))_6.5rem]";
const TREND_FILTER_BUTTON_CLASS = "h-10 min-w-0 rounded-lg bg-blue-600 px-2 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400";

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

type ComparisonOptions = {
  chartData?: Pick<TrendComparison, "keywords" | "trend" | "shopping"> | null;
  authLoading: boolean;
  isLoading?: boolean;
  metric: "trend" | "shopping";
  onError: (error: unknown, fallback: string) => string;
};

export function useNaverTrendComparison({
  chartData = null,
  authLoading,
  isLoading = false,
  metric,
  onError,
}: ComparisonOptions) {
  const [trendComparisonData, setTrendComparisonData] = useState<TrendComparison | null>(null);
  const [comparisonKeywordInput, setComparisonKeywordInput] = useState("");
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
  const displayedTrendData = trendComparisonData || chartData;
  const comparisonKeywords: string[] = trendComparisonData?.sourceKeywords ?? chartData?.keywords ?? [];
  const shoppingOnly = metric === "shopping";
  const chartKeywords = (displayedTrendData?.keywords ?? []).filter(keyword => displayedTrendData?.[metric]?.[keyword]?.length);
  const hasComparisonResults = !isLoading && chartKeywords.length > 0;
  const comparisonChartTitle = shoppingOnly ? "쇼핑 트렌드 비교" : "검색 트렌드 비교";
  const comparisonChartData = {
    keywords: chartKeywords,
    trend: shoppingOnly ? {} : displayedTrendData?.trend || {},
    shopping: shoppingOnly ? displayedTrendData?.shopping || {} : {},
  };
  const comparisonChartLayers = { trend: !shoppingOnly, shopping: shoppingOnly };
  const { mutateAsync: queryTrendFilterInsight } = trpc.naver.unifiedInsightBatch.useMutation();

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

  const clearComparison = () => {
    setTrendComparisonData(null);
    setTrendFilterError("");
  };

  const resetComparison = () => {
    clearComparison();
    setComparisonKeywordInput("");
    setOpenTrendFilterMenu(null);
    setSelectedPeriod("30");
    setSelectedTimeUnit("date");
    setSelectedDevices(["전체"]);
    setSelectedGenders(["전체"]);
    setSelectedAges([""]);
    setStartDateForChart("");
    setEndDateForChart("");
    setTimeUnitForChart("date");
    setFilterLabelForChart("1개월 · 일간 · 전체");
  };

  const getBaseRequest = () => {
    const { startDateStr, endDateStr, timeUnit } = getTrendDateRange();
    setStartDateForChart(startDateStr);
    setEndDateForChart(endDateStr);
    setTimeUnitForChart(timeUnit);
    setFilterLabelForChart(getFilterLabel());
    return {
      startDate: startDateStr,
      endDate: endDateStr,
      timeUnit,
      device: selectedDevices.includes("전체") ? undefined : selectedDevices[0],
      gender: selectedGenders.includes("전체") ? undefined : selectedGenders[0],
      ages: selectedAges.includes("") ? undefined : selectedAges[0]?.split(","),
    };
  };

  const loadTrendComparison = async (nextKeywords: string[]) => {
    if (authLoading || isLoading || isTrendFilterLoading || nextKeywords.length === 0) return false;

    const combinations = getChartFilterCombinations();
    if (combinations.length > 12) {
      setTrendFilterError("필터 조합은 한 번에 최대 12개까지 조회할 수 있습니다.");
      return false;
    }

    const { startDateStr, endDateStr, timeUnit } = getTrendDateRange();

    setIsTrendFilterLoading(true);
    setTrendFilterError("");
    setOpenTrendFilterMenu(null);

    try {
      const responses = await queryTrendFilterInsight({
        requests: combinations.map(combination => ({
          keywords: nextKeywords,
          startDate: startDateStr,
          endDate: endDateStr,
          timeUnit,
          device: combination.device.value,
          gender: combination.gender.value,
          ages: combination.age.values,
        })),
      });
      const results = combinations.map((combination, index) => ({ combination, response: responses[index] as ComparisonResponse | undefined }));

      const trend: Record<string, InsightPoint[]> = {};
      const shopping: Record<string, InsightPoint[]> = {};
      const chartKeywords: string[] = [];
      const keywordBySeries: Record<string, string> = {};

      results.forEach(({ combination, response }) => {
        if (!response?.success) return;
        nextKeywords.forEach(keyword => {
          const label = getChartSeriesLabel(keyword, combination, combinations.length);
          const series = response[metric]?.[keyword];
          if (!Array.isArray(series) || !series.length) return;

          chartKeywords.push(label);
          keywordBySeries[label] = keyword;
          (shoppingOnly ? shopping : trend)[label] = series;
        });
      });

      if (chartKeywords.length === 0) {
        setTrendFilterError(shoppingOnly ? "선택한 조건의 쇼핑 클릭 데이터를 찾지 못했습니다." : "선택한 조건의 검색 트렌드 데이터를 찾지 못했습니다.");
        return false;
      }

      setTrendComparisonData({
        sourceKeywords: nextKeywords,
        keywords: chartKeywords,
        keywordBySeries,
        trend,
        shopping,
      });
      setStartDateForChart(startDateStr);
      setEndDateForChart(endDateStr);
      setTimeUnitForChart(timeUnit);
      setFilterLabelForChart(getFilterLabel());
      return true;
    } catch (error) {
      setTrendFilterError(onError(error, "필터 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."));
      return false;
    } finally {
      setIsTrendFilterLoading(false);
    }
  };

  const addComparisonKeyword = async () => {
    const keyword = comparisonKeywordInput.trim().replace(/\s+/g, " ");
    if (!keyword) return;
    if (comparisonKeywords.some(value => value.toLowerCase() === keyword.toLowerCase())) {
      setTrendFilterError("이미 추가한 키워드입니다.");
      return;
    }
    if (comparisonKeywords.length >= MAX_COMPARISON_KEYWORDS) {
      setTrendFilterError(`비교 키워드는 최대 ${MAX_COMPARISON_KEYWORDS}개까지 추가할 수 있습니다.`);
      return;
    }
    if (await loadTrendComparison([...comparisonKeywords, keyword])) {
      setComparisonKeywordInput(current => current.trim().replace(/\s+/g, " ") === keyword ? "" : current);
    }
  };

  const removeComparisonKeyword = (keyword: string) => {
    setTrendComparisonData(current => {
      if (!current) return current;
      const keep = (label: string) => current.keywordBySeries[label] !== keyword;
      return {
        sourceKeywords: current.sourceKeywords.filter(value => value !== keyword),
        keywords: current.keywords.filter(keep),
        keywordBySeries: Object.fromEntries(Object.entries(current.keywordBySeries).filter(([label]) => keep(label))),
        trend: Object.fromEntries(Object.entries(current.trend).filter(([label]) => keep(label))),
        shopping: Object.fromEntries(Object.entries(current.shopping).filter(([label]) => keep(label))),
      };
    });
    setTrendFilterError("");
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
    <div className="mt-4">
      <div className={`${TREND_FILTER_GRID_CLASS} mb-2 px-[13px]`}>
        <h4 className="col-span-full pb-1 text-sm font-semibold text-slate-200 md:col-span-4">필터 적용</h4>
        <form
          className="col-span-2 grid grid-cols-subgrid items-end gap-2 md:col-start-5"
          onSubmit={event => {
            event.preventDefault();
            void addComparisonKeyword();
          }}
        >
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-400">
            <span className="sr-only">비교 키워드</span>
            <input
              value={comparisonKeywordInput}
              onChange={event => setComparisonKeywordInput(event.target.value)}
              placeholder="키워드 입력"
              maxLength={100}
              className="h-10 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus:border-blue-500"
            />
          </label>
          <button
            type="submit"
            className={TREND_FILTER_BUTTON_CLASS}
            disabled={authLoading || isLoading || isTrendFilterLoading || !comparisonKeywordInput.trim()}
          >
            추가
          </button>
        </form>
      </div>
      <div className="rounded-lg border border-slate-700/70 bg-slate-950/35 p-3">
        <div className={TREND_FILTER_GRID_CLASS}>
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
            onClick={() => void loadTrendComparison(comparisonKeywords)}
            disabled={authLoading || isLoading || isTrendFilterLoading || comparisonKeywords.length === 0}
            className={TREND_FILTER_BUTTON_CLASS}
          >
            필터 적용
          </button>
        </div>
        {trendComparisonData && comparisonKeywords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2" aria-label="비교 키워드 목록">
            {comparisonKeywords.map(keyword => (
              <button
                key={keyword}
                type="button"
                title={`${keyword} 제거`}
                aria-label={`${keyword} 제거`}
                disabled={isTrendFilterLoading}
                onClick={() => removeComparisonKeyword(keyword)}
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-blue-500 focus-visible:outline focus-visible:outline-blue-400 disabled:opacity-50"
              >
                <span className="truncate">{keyword}</span>
                <X size={13} className="shrink-0" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
        {trendFilterError && <p className="mt-3 text-xs text-red-300">{trendFilterError}</p>}
      </div>
    </div>
  );

  const renderPanel = () => (
    <div className="bg-slate-900 bg-opacity-50 border border-cyan-700 border-opacity-30 rounded-lg px-4 pt-4 pb-5 md:px-6 md:pt-6 md:pb-6 h-auto min-h-0">
      {/* Chart Header */}
      <div className="mb-4 md:mb-6">
        <h3 className="mb-1 text-base font-medium text-white md:mb-2 md:text-lg md:font-semibold">
          {comparisonChartTitle}
        </h3>
        {hasComparisonResults && <div className="text-xs font-normal text-slate-400 md:text-sm">
          {!trendComparisonData && <p className="mb-1">{comparisonKeywords.join(", ")}</p>}
          <p>{startDateForChart} – {endDateForChart}</p>
          <p className="mt-1 text-xs text-slate-500">
            {filterLabelForChart}
          </p>
        </div>}
        {renderTrendFilters()}
      </div>

      {/* Chart Container */}
      <div className="relative h-[300px] md:h-[480px]">
        {isTrendFilterLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-slate-950/70 backdrop-blur-sm">
            <div className="rounded-lg border border-blue-500/20 bg-slate-900 px-5 py-3 text-sm font-medium text-slate-200 shadow-xl shadow-black/30">
              {comparisonChartTitle} 데이터를 불러오는 중입니다...
            </div>
          </div>
        )}
        {hasComparisonResults && <UnifiedChart
          data={comparisonChartData}
          visibleLayers={comparisonChartLayers}
          timeUnit={timeUnitForChart}
          startDate={startDateForChart}
          endDate={endDateForChart}
        />}
      </div>
    </div>
  );

  return { renderPanel, getBaseRequest, clearComparison, resetComparison, isTrendFilterLoading };
}
