import React, { useState } from "react";
import {
  TrendingUp,
  ChevronDown,
  Calendar,
  CircleHelp,
} from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import UnifiedInsights from "./UnifiedInsights";
import InfoBottomSheet from "@/components/InfoBottomSheet";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function NaverTrends() {
  // Mobile detection
  const isMobile = useIsMobile();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<"shopping" | "unified" | "experience">("unified");

  const [selectedCategory, setSelectedCategory] = useState("패션의류");
  const [chartData, setChartData] = useState<Array<{ period: string; ratio: number }>>([]);
  const [chartPeriodDays, setChartPeriodDays] = useState(30);
  const [chartUnit, setChartUnit] = useState("일간");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isPeriodExpanded, setIsPeriodExpanded] = useState(false);
  const [dateValidationError, setDateValidationError] = useState("");
  const [selectedDevice, setSelectedDevice] = useState("전체");
  const [selectedGender, setSelectedGender] = useState("전체");
  const [selectedAge, setSelectedAge] = useState("전체");
  const [isLoading, setIsLoading] = useState(false);
  const [queryError, setQueryError] = useState("");

  // Applied filter state - only updated on successful query
  const [appliedChartPeriodDays, setAppliedChartPeriodDays] = useState(30);
  const [appliedChartUnit, setAppliedChartUnit] = useState("일간");
  const [appliedCustomStartDate, setAppliedCustomStartDate] = useState("");
  const [appliedCustomEndDate, setAppliedCustomEndDate] = useState("");
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const infoPopoverRef = React.useRef<HTMLDivElement>(null);
  const infoButtonRef = React.useRef<HTMLButtonElement>(null);

  // Close info popover when tab changes (only for shopping tab)
  React.useEffect(() => {
    if (activeTab !== "shopping" && isInfoOpen) {
      setIsInfoOpen(false);
    }
  }, [activeTab]);

  // Handle click outside and Esc key for info popovers
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isClickOnButton = infoButtonRef.current?.contains(target);
      const isClickOnPopover = infoPopoverRef.current?.contains(target);
      
      if (!isClickOnButton && !isClickOnPopover && isInfoOpen) {
        setIsInfoOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isInfoOpen) {
        setIsInfoOpen(false);
      }
    };

    if (isInfoOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isInfoOpen])


  // tRPC mutation for category trend
  const categoryTrendMutation = trpc.naver.categoryTrend.useMutation();

  // Category code mapping
  const categoryMap: Record<string, string> = {
    "패션의류": "50000000",
    "패션잡화": "50000001",
    "화장품/미용": "50000002",
    "디지털/가전": "50000003",
    "가구/인테리어": "50000004",
    "출산/육아": "50000005",
    "식품": "50000006",
    "스포츠/레저": "50000007",
    "생활/건강": "50000008",
    "여가/생활편의": "50000009",
    "면세점": "50000010",
    "도서": "50005542",
  };

  // 조회할 카테고리 코드 결정
  const getQueryCategoryCode = () => {
    return categoryMap[selectedCategory];
  };

  // Filter value mapping
  const deviceMap: Record<string, string | undefined> = {
    "전체": undefined,
    "PC": "pc",
    "모바일": "mo",
  };

  const genderMap: Record<string, string | undefined> = {
    "전체": undefined,
    "남성": "m",
    "여성": "f",
  };

  const ageMap: Record<string, string[]> = {
    "전체": [],
    "10대": ["10"],
    "20대": ["20"],
    "30대": ["30"],
    "40대": ["40"],
    "50대": ["50"],
    "60대 이상": ["60"],
  };

  const timeUnitMap: Record<string, "date" | "week" | "month"> = {
    "일간": "date",
    "주간": "week",
    "월간": "month",
  };

  const categories = Object.keys(categoryMap);
  const devices = ["전체", "PC", "모바일"];
  const genders = ["전체", "남성", "여성"];
  const ages = ["전체", "10대", "20대", "30대", "40대", "50대", "60대 이상"];
  const timeUnits = ["일간", "주간", "월간"];

  const tabs = [
    { id: "unified", label: "키워드 통합 분석" },
    { id: "shopping", label: "쇼핑 클릭량" },
    { id: "experience", label: "체험단" },
  ] as const;

  // Get chart title
  const getChartTitle = () => {
    return `${selectedCategory} - 기간별 클릭 추이`;
  };

  // Calculate date range
  const getDateRange = () => {
    if (customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate };
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - chartPeriodDays);

    return {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    };
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // Get date range display - uses applied filter state
  const getDateRangeDisplay = () => {
    if (appliedCustomStartDate && appliedCustomEndDate) {
      return `${formatDate(appliedCustomStartDate)} – ${formatDate(appliedCustomEndDate)}`;
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - appliedChartPeriodDays);

    return `${startDate.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })} – ${endDate.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })}`;
  };

  const handlePeriodChange = (days: number) => {
    setChartPeriodDays(days);
    setCustomStartDate("");
    setCustomEndDate("");
    setDateValidationError("");
  };

  // Safe error message extraction
  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return error.message;
    }
    return "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
  };

  const handleQueryClick = async () => {
    if (!selectedCategory) {
      setQueryError("쇼핑 카테고리를 선택해주세요.");
      return;
    }

    // Validate custom date range if selected
    if (chartPeriodDays === 0) {
      if (!customStartDate || !customEndDate) {
        setDateValidationError("시작일과 종료일을 모두 입력해주세요.");
        return;
      }

      const startDate = new Date(customStartDate);
      const endDate = new Date(customEndDate);

      if (startDate > endDate) {
        setDateValidationError("시작일이 종료일보다 클 수 없습니다.");
        return;
      }
    }

    setDateValidationError("");
    setQueryError("");
    setIsLoading(true);

    try {
      const { startDate, endDate } = getDateRange();
      const categoryCode = getQueryCategoryCode();
      const device = deviceMap[selectedDevice];
      const gender = genderMap[selectedGender];
      const ages_arr = ageMap[selectedAge];
      const timeUnit = timeUnitMap[chartUnit];

      // Call Naver API through tRPC
      const queryInput = {
        categoryCode,
        startDate,
        endDate,
        timeUnit,
        device,
        gender,
        ages: ages_arr.length > 0 ? ages_arr : undefined,
      };

      // Use tRPC mutation hook
      const result = await categoryTrendMutation.mutateAsync(queryInput);

      if (result?.success && result?.data && Array.isArray(result.data)) {
        setChartData(result.data);
        // Update applied filter state only on successful query
        setAppliedChartPeriodDays(chartPeriodDays);
        setAppliedChartUnit(chartUnit);
        setAppliedCustomStartDate(customStartDate);
        setAppliedCustomEndDate(customEndDate);
      } else {
        const errorMsg = result?.error || "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
        setQueryError(errorMsg);
        setChartData([]);
      }
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      setQueryError(errorMsg);
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const maxChartValue = Math.max(...chartData.map(d => d.ratio), 100);

  // Calculate days between first and last date in chart data
  const getChartDurationDays = () => {
    if (chartData.length < 2) return 0;
    const firstDate = new Date(chartData[0].period);
    const lastDate = new Date(chartData[chartData.length - 1].period);
    return Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Get monthly ticks for 6개월 이상 (one tick per unique month)
  const getMonthlyTicks = () => {
    if (chartData.length === 0) return [];
    
    const durationDays = getChartDurationDays();
    if (durationDays <= 90) return []; // Use default interval for shorter periods
    
    const ticks: string[] = [];
    const seenMonths = new Set<string>();
    
    chartData.forEach((item) => {
      const date = new Date(item.period);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${month}`;
      
      if (!seenMonths.has(monthKey)) {
        seenMonths.add(monthKey);
        ticks.push(item.period);
      }
    });
    
    return ticks;
  };

  // Create mobile label indexes for proper distribution
  const createMobileLabelIndexes = (
    dataLength: number,
    labelCount = 7
  ): Set<number> => {
    const indexes = Array.from(
      { length: labelCount },
      (_, index) =>
        Math.round(
          (index * (dataLength - 1)) / (labelCount - 1)
        )
    );

    indexes[0] = 0;
    indexes[indexes.length - 1] = dataLength - 1;

    return new Set(indexes);
  };

  // Format mobile tick with period-specific date formatting
  const formatMobileTick = (
    value: string,
    mode: "3m" | "6m" | "1y"
  ): string => {
    const [year, month, day] = value.split("-").map(Number);

    if (mode === "3m") {
      return `${month}.${day}`;
    }

    if (mode === "6m") {
      return `${String(year).slice(2)}.${month}`;
    }

    return `${String(year).slice(2)}.${month}`;
  };

  // Get mobile-optimized ticks for 1-year period (reduce label density)
  const getMobileOptimizedTicks = () => {
    if (chartData.length === 0) return [];
    
    const durationDays = getChartDurationDays();
    
    // For 1-year period, show 7 labels
    if (durationDays > 180) {
      const labelIndexes = createMobileLabelIndexes(chartData.length, 7);
      return Array.from(labelIndexes)
        .sort((a, b) => a - b)
        .map(index => chartData[index].period);
    }
    
    // For 6-month period, show 7 labels
    if (durationDays > 90) {
      const labelIndexes = createMobileLabelIndexes(chartData.length, 7);
      return Array.from(labelIndexes)
        .sort((a, b) => a - b)
        .map(index => chartData[index].period);
    }
    
    // For 3-month period, show 7 labels
    if (durationDays > 30) {
      const labelIndexes = createMobileLabelIndexes(chartData.length, 7);
      return Array.from(labelIndexes)
        .sort((a, b) => a - b)
        .map(index => chartData[index].period);
    }
    
    return [];
  };

  // Format X-axis tick label with period-specific formatting
  const formatXAxisTick = (value: string) => {
    const durationDays = getChartDurationDays();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    
    if (durationDays <= 7) {
      // 7일: M.D 형식
      return formatMobileTick(value, "3m");
    } else if (durationDays <= 30) {
      // 30일: M.D 형식
      return formatMobileTick(value, "3m");
    } else if (durationDays <= 90) {
      // 3개월: M.D 형식 (모바일)
      if (isMobile) {
        return formatMobileTick(value, "3m");
      }
      // 데스크톱: 기존 방식
      const date = new Date(value);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}.${day}`;
    } else if (durationDays <= 180) {
      // 6개월: 월 단위
      if (isMobile) {
        return formatMobileTick(value, "6m");
      }
      // 데스크톱: 기존 방식
      const date = new Date(value);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const isFirstTick = chartData.length > 0 && chartData[0].period === value;
      return isFirstTick ? `${year}.${month}` : `${month}월`;
    } else {
      // 1년: 월 단위
      if (isMobile) {
        return formatMobileTick(value, "1y");
      }
      // 데스크톱: 기존 방식
      const date = new Date(value);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const isFirstTick = chartData.length > 0 && chartData[0].period === value;
      const currentIndex = chartData.findIndex(d => d.period === value);
      const prevDate = currentIndex > 0 ? new Date(chartData[currentIndex - 1].period) : null;
      const prevYear = prevDate ? prevDate.getFullYear() : year;
      const yearChanged = year !== prevYear;
      return (isFirstTick || yearChanged) ? `${year}. ${month}월` : `${month}월`;
    }
  };

  // Get X-axis interval based on data length
  const getXAxisInterval = () => {
    const durationDays = getChartDurationDays();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    
    if (durationDays <= 7) return 0; // Show all
    if (durationDays <= 30) return isMobile ? Math.ceil(chartData.length / 7) - 1 : 0;
    if (durationDays <= 90) return isMobile ? Math.ceil(chartData.length / 7) - 1 : Math.ceil(chartData.length / 15) - 1;
    if (durationDays <= 180) return isMobile ? Math.ceil(chartData.length / 7) - 1 : Math.ceil(chartData.length / 10) - 1;
    return isMobile ? Math.ceil(chartData.length / 7) - 1 : Math.ceil(chartData.length / 12) - 1;
  };

  // Get X-axis ticks
  const getXAxisTicks = () => {
    if (chartData.length === 0) return [];
    
    const durationDays = getChartDurationDays();
    
    if (durationDays > 180) {
      return getMonthlyTicks();
    }
    
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return getMobileOptimizedTicks();
    }
    
    return [];
  };

  const tabContainerRef = React.useRef<HTMLDivElement>(null);
  const activeTabRef = React.useRef<HTMLButtonElement>(null);

  // Scroll active tab into view
  React.useEffect(() => {
    if (activeTabRef.current && tabContainerRef.current) {
      const container = tabContainerRef.current;
      const activeButton = activeTabRef.current;
      
      const containerRect = container.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      
      if (buttonRect.left < containerRect.left) {
        container.scrollLeft -= containerRect.left - buttonRect.left + 10;
      } else if (buttonRect.right > containerRect.right) {
        container.scrollLeft += buttonRect.right - containerRect.right + 10;
      }
    }
  }, [activeTab]);

  return (
    <div className="youtubePageContainer">
      {/* Page Header */}
      <div className="pageHeader">
        <h1 className="pageTitle">네이버 트렌드</h1>
        <p className="pageDescription">
          검색어 하나로 네이버 검색 수요와 쇼핑 반응을 한 페이지에서 확인하세요.
        </p>
      </div>

      {/* Tab Menu */}
      <div className="mt-8 mb-6 border-b border-slate-700 relative">
        {/* Desktop: flex layout, Mobile: horizontal scroll */}
        <div
          ref={tabContainerRef}
          className="flex gap-8 overflow-x-auto md:overflow-x-visible scrollbar-hide snap-x snap-mandatory md:gap-8"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={activeTab === tab.id ? activeTabRef : null}
              data-active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium relative transition-colors flex-1 md:flex-none md:min-w-[180px] min-w-max whitespace-nowrap snap-start ${
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: '#158cff' }}></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Bottom Sheet for Shopping Info */}
      {isMobile && (
        <InfoBottomSheet
          isOpen={isInfoOpen && activeTab === "shopping"}
          onClose={() => setIsInfoOpen(false)}
          title="쇼핑 클릭량 추이 안내"
          content={
            <div className="space-y-3">
              <p>
                네이버 쇼핑 카테고리의 기간별 상대 클릭 추이를 확인할 수 있습니다.
              </p>
              <p>
                수치는 실제 클릭 수가 아닌, 조회 기간 내 상대적인 변화 지표입니다.
              </p>
            </div>
          }
          triggerRef={infoButtonRef}
        />
      )}

      {/* Mobile Bottom Sheet for Unified Insights Info */}
      {isMobile && (
        <InfoBottomSheet
          isOpen={isInfoOpen && activeTab === "unified"}
          onClose={() => setIsInfoOpen(false)}
          title="통합 인사이트 안내"
          content={
            <div className="space-y-3">
              <p>
                검색 트렌드와 쇼핑 클릭량을 함께 비교하여 키워드의 관심도와 소비 반응 흐름을 한눈에 확인할 수 있습니다.
              </p>
              <p>
                각 수치는 실제 검색량이나 클릭 수가 아닌, 선택한 기간 내 상대적인 변화 지표입니다.
              </p>
            </div>
          }
          triggerRef={infoButtonRef}
        />
      )}

      {/* Section: Shopping Click Trend */}
      {activeTab === "shopping" && (
      <section className="mt-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-green-500" />
            <div className="flex items-center gap-2 relative">
              <h2 className="text-2xl font-bold text-foreground">
                쇼핑 클릭량 추이
              </h2>
              <button
                ref={infoButtonRef}
                type="button"
                onClick={() => setIsInfoOpen(!isInfoOpen)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsInfoOpen(!isInfoOpen);
                  }
                }}
                aria-label="쇼핑 클릭량 추이 설명"
                aria-expanded={isInfoOpen}
                aria-controls="shopping-click-trend-info"
                className="relative inline-flex items-center justify-center w-5 h-5 text-slate-400 hover:text-slate-300 transition-colors"
              >
                <CircleHelp className="w-4 h-4" />
              </button>

              {!isMobile && isInfoOpen && activeTab === "shopping" && (
                <div
                  ref={infoPopoverRef}
                  id="shopping-click-trend-info"
                  className="absolute left-full top-1/2 -translate-y-1/2 z-50 ml-3 w-[380px] max-w-[calc(100vw-32px)] bg-slate-800 border border-slate-600 rounded-lg px-6 py-5 shadow-lg"
                >
                  <p className="text-sm text-slate-300 leading-relaxed">
                    네이버 쇼핑 카테고리의 기간별 상대 클릭 추이를 확인할 수 있습니다.
                  </p>
                  <p className="text-sm text-slate-400 leading-relaxed mt-3">
                    수치는 실제 클릭 수가 아닌, 조회 기간 내 상대적인 변화 지표입니다.
                  </p>
                </div>
              )}
            </div>
          </div>
          <p className="pageDescription">
            쇼핑 카테고리별 클릭 추이를 분석하여 시장 수요를 파악하세요.
          </p>
        </div>

        {/* Filter Section */}
        <div className="mb-8 space-y-4">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              카테고리 선택
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-foreground focus:outline-none focus:border-blue-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Period and Time Unit Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                기간
              </label>
              <button
                onClick={() => setIsPeriodExpanded(!isPeriodExpanded)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-foreground flex items-center justify-between hover:border-slate-500 transition-colors"
              >
                <span>{chartPeriodDays === 0 ? "사용자 정의" : `${chartPeriodDays}일`}</span>
                <ChevronDown
                  size={18}
                  className={`transition-transform ${isPeriodExpanded ? "rotate-180" : ""}`}
                />
              </button>

              {isPeriodExpanded && (
                <div className="mt-2 p-3 bg-slate-800 border border-slate-600 rounded-lg space-y-2">
                  <button
                    onClick={() => handlePeriodChange(7)}
                    className={`w-full px-3 py-2 text-sm rounded transition-colors ${
                      chartPeriodDays === 7
                        ? "bg-blue-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    7일
                  </button>
                  <button
                    onClick={() => handlePeriodChange(30)}
                    className={`w-full px-3 py-2 text-sm rounded transition-colors ${
                      chartPeriodDays === 30
                        ? "bg-blue-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    30일
                  </button>
                  <button
                    onClick={() => handlePeriodChange(90)}
                    className={`w-full px-3 py-2 text-sm rounded transition-colors ${
                      chartPeriodDays === 90
                        ? "bg-blue-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    3개월
                  </button>
                  <button
                    onClick={() => handlePeriodChange(180)}
                    className={`w-full px-3 py-2 text-sm rounded transition-colors ${
                      chartPeriodDays === 180
                        ? "bg-blue-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    6개월
                  </button>
                  <button
                    onClick={() => handlePeriodChange(365)}
                    className={`w-full px-3 py-2 text-sm rounded transition-colors ${
                      chartPeriodDays === 365
                        ? "bg-blue-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    1년
                  </button>
                  <button
                    onClick={() => handlePeriodChange(0)}
                    className={`w-full px-3 py-2 text-sm rounded transition-colors ${
                      chartPeriodDays === 0
                        ? "bg-blue-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    사용자 정의
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                시간 단위
              </label>
              <select
                value={chartUnit}
                onChange={(e) => setChartUnit(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-foreground focus:outline-none focus:border-blue-500"
              >
                {timeUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Date Range */}
          {chartPeriodDays === 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  시작일
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-foreground focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  종료일
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-foreground focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {dateValidationError && (
            <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg text-red-400 text-sm">
              {dateValidationError}
            </div>
          )}

          {/* Device, Gender, Age Selection */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                기기
              </label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-foreground focus:outline-none focus:border-blue-500"
              >
                {devices.map((device) => (
                  <option key={device} value={device}>
                    {device}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                성별
              </label>
              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-foreground focus:outline-none focus:border-blue-500"
              >
                {genders.map((gender) => (
                  <option key={gender} value={gender}>
                    {gender}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                연령
              </label>
              <select
                value={selectedAge}
                onChange={(e) => setSelectedAge(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-foreground focus:outline-none focus:border-blue-500"
              >
                {ages.map((age) => (
                  <option key={age} value={age}>
                    {age}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Query Button */}
          <button
            onClick={handleQueryClick}
            disabled={isLoading}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition-colors"
          >
            {isLoading ? "조회 중..." : "조회"}
          </button>

          {queryError && (
            <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg text-red-400 text-sm">
              {queryError}
            </div>
          )}
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="mb-8 p-6 bg-slate-800/50 border border-slate-700 rounded-lg">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {getChartTitle()}
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              {getDateRangeDisplay()}
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis
                  dataKey="period"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                  interval={getXAxisInterval()}
                  ticks={getXAxisTicks()}
                  tickFormatter={formatXAxisTick}
                />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} domain={[0, maxChartValue]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                  formatter={(value: any) => [typeof value === 'number' ? value.toFixed(2) : value, "클릭 추이"]}
                />
                <Line
                  type="monotone"
                  dataKey="ratio"
                  stroke="#158cff"
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
      )}

      {/* Section: Unified Insights */}
      {activeTab === "unified" && (
      <section className="mt-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-blue-500" />
            <h2 className="text-2xl font-bold text-foreground">
              통합 인사이트
            </h2>

            {!isMobile && isInfoOpen && activeTab === "unified" && (
              <div
                ref={infoPopoverRef}
                id="unified-insights-info-popover"
                className="absolute left-full top-1/2 -translate-y-1/2 z-50 ml-3 w-[380px] max-w-[calc(100vw-32px)] bg-slate-800 border border-slate-600 rounded-lg px-6 py-5 shadow-lg"
              >
                <p className="text-sm text-slate-300 leading-relaxed">
                  검색 트렌드와 쇼핑 클릭량을 함께 비교하여 키워드의 관심도와 소비 반응 흐름을 한눈에 확인할 수 있습니다.
                </p>
                <p className="text-sm text-slate-400 leading-relaxed mt-3">
                  각 수치는 실제 검색량이나 클릭 수가 아닌, 선택한 기간 내 상대적인 변화 지표입니다.
                </p>
              </div>
            )}
          </div>
          <p className="pageDescription">
            검색 트렌드와 쇼핑 클릭량을 한 화면에서 비교 분석하세요.
          </p>
        </div>
        <UnifiedInsights />
      </section>
      )}

      {/* Section: Experience Tab */}
      {activeTab === "experience" && (
      <section className="mt-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            체험단
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            셀러와 크리에이터를 연결하는 체험단 페이지를 준비 중입니다.
          </p>
        </div>
        {!isMobile && (
            <div className="p-8 rounded-lg border border-slate-700 bg-slate-900/50">
            </div>
        )}
      </section>
      )}
    </div>
  );
}
