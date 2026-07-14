import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface DataPoint {
  period: string;
  ratio: number;
}

interface UnifiedChartData {
  keywords: string[];
  trend: Record<string, DataPoint[]>;
  shopping: Record<string, DataPoint[]>;
  shoppingStatus?: Record<string, 'AVAILABLE' | 'NO_DATA'>;
}

interface UnifiedChartProps {
  data: UnifiedChartData;
  visibleLayers: {
    trend: boolean;
    shopping: boolean;
  };
  timeUnit: string;
  startDate: string;
  endDate: string;
}

// 색상 팔레트 (다중 키워드 지원)
const colorPalettes = [
  {
    trend: '#3b82f6', // 블루 실선
    shopping: '#06b6d4', // 청록 점선
  },
  {
    trend: '#a855f7', // 보라 실선
    shopping: '#d946ef', // 보라 계열 점선
  },
  {
    trend: '#f59e0b', // 주황 실선
    shopping: '#fbbf24', // 주황 계열 점선
  },
  {
    trend: '#10b981', // 초록 실선
    shopping: '#34d399', // 초록 계열 점선
  },
  {
    trend: '#ef4444', // 빨강 실선
    shopping: '#f87171', // 빨강 계열 점선
  },
];

/**
 * 로컬 날짜 문자열을 Date 객체로 변환 (UTC 변환 문제 해결)
 * "2025-06-13" → Date(2025, 5, 13) → UTC 자정
 */
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

/**
 * 두 날짜 사이의 일수 계산
 */
const getDaysBetween = (start: Date, end: Date): number => {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
};

/**
 * 모든 날짜 수집
 */
const getAllDates = (data: UnifiedChartData): string[] => {
  const dates = new Set<string>();

  data.keywords.forEach((keyword) => {
    if (data.trend[keyword]) {
      data.trend[keyword].forEach((point) => dates.add(point.period));
    }
    if (data.shopping[keyword]) {
      data.shopping[keyword].forEach((point) => dates.add(point.period));
    }
  });

  return Array.from(dates).sort();
};

/**
 * 기간별 모바일 라벨 개수 결정
 */
const getMobileLabelCount = (startDate: string, endDate: string): number => {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const durationDays = getDaysBetween(start, end);

  if (durationDays <= 30) {
    return 6; // 1개월: 6개
  } else if (durationDays <= 90) {
    return 7; // 3개월: 7개
  } else if (durationDays <= 180) {
    return 7; // 6개월: 7개
  } else {
    return 7; // 1년: 7개
  }
};

/**
 * 라벨 표시 인덱스 계산 (데이터 배열 길이 기준)
 * 첫 번째와 마지막은 반드시 포함, 중간은 균등 분배
 */
const createLabelIndexes = (
  dataLength: number,
  labelCount = 7
): Set<number> => {
  if (dataLength <= labelCount) {
    return new Set(
      Array.from({ length: dataLength }, (_, index) => index)
    );
  }

  const indexes = Array.from(
    { length: labelCount },
    (_, index) =>
      Math.round(
        (index * (dataLength - 1)) / (labelCount - 1)
      )
  );

  // 첫 번째와 마지막 강제 설정
  indexes[0] = 0;
  indexes[indexes.length - 1] = dataLength - 1;

  return new Set(indexes);
};

/**
 * 모바일 기간별 날짜 포맷팅
 */
const formatMobileDateLabel = (
  dateStr: string,
  startDate: string,
  endDate: string
): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const durationDays = getDaysBetween(start, end);

  if (durationDays <= 30) {
    // 1개월: M.D
    return `${month}.${day}`;
  } else if (durationDays <= 90) {
    // 3개월: M.D
    return `${month}.${day}`;
  } else {
    // 6개월, 1년: YY.M
    const shortYear = String(year).slice(2);
    return `${shortYear}.${month}`;
  }
};

/**
 * 날짜를 라벨로 포맷팅
 * 첫/마지막: YYYY.M.D
 * 중간: M.D (단, 연도 변경 지점은 YYYY.M.D)
 */
const formatDateLabel = (
  dateStr: string,
  isFirstOrLast: boolean,
  previousYear?: number
): string => {
  const [year, month, day] = dateStr.split('-').map(Number);

  // 첫 번째와 마지막은 연도 포함
  if (isFirstOrLast) {
    return `${year}.${month}.${day}`;
  }

  // 연도가 바뀌는 지점은 연도 포함
  if (previousYear !== undefined && previousYear !== year) {
    return `${year}.${month}.${day}`;
  }

  // 그 외는 월.일만
  return `${month}.${day}`;
};

export const UnifiedChart: React.FC<UnifiedChartProps> = ({
  data,
  visibleLayers,
  timeUnit,
  startDate,
  endDate,
}) => {
  // 모든 날짜 수집 (원본 데이터 전체)
  const allDates = useMemo(() => getAllDates(data), [data]);

  // 모바일 여부 확인
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // 기간별 모바일 라벨 개수 결정
  const mobileLabelCount = useMemo(() => {
    if (!isMobile) return 7;
    return getMobileLabelCount(startDate, endDate);
  }, [isMobile, startDate, endDate]);

  // 라벨 표시 인덱스 계산
  const labelIndexes = useMemo(() => {
    const count = isMobile ? mobileLabelCount : 7;
    return createLabelIndexes(allDates.length, count);
  }, [allDates.length, isMobile, mobileLabelCount]);

  // 라벨 배열 생성 (표시할 라벨만)
  const displayLabels = useMemo(() => {
    const labels: string[] = [];
    let previousYear: number | undefined;

    allDates.forEach((dateStr, index) => {
      if (labelIndexes.has(index)) {
        let label: string;
        if (isMobile) {
          label = formatMobileDateLabel(dateStr, startDate, endDate);
        } else {
          const isFirstOrLast = index === 0 || index === allDates.length - 1;
          label = formatDateLabel(dateStr, isFirstOrLast, previousYear);
        }
        labels.push(label);

        const [year] = dateStr.split('-').map(Number);
        previousYear = year;
      }
    });

    return labels;
  }, [allDates, labelIndexes, isMobile, startDate, endDate]);

  // 차트 데이터 생성 (원본 데이터 전체 유지)
  const chartData = useMemo(() => {
    const datasets: any[] = [];

    data.keywords.forEach((keyword, keywordIndex) => {
      const palette = colorPalettes[keywordIndex % colorPalettes.length];

      // 검색 트렌드 데이터셋
      if (visibleLayers.trend && data.trend[keyword]) {
        const trendData = data.trend[keyword];
        const values = allDates.map((date) => {
          const point = trendData.find((p) => p.period === date);
          return point ? { x: date, y: Number(point.ratio) } : { x: date, y: null };
        });

        datasets.push({
          label: `${keyword} · 검색 트렌드`,
          data: values,
          borderColor: palette.trend,
          backgroundColor: `${palette.trend}10`,
          borderWidth: 2,
          borderDash: [],
          pointRadius: 0,
          pointHoverRadius: 5,
          pointBackgroundColor: palette.trend,
          pointBorderColor: 'transparent',
          pointBorderWidth: 0,
          tension: 0.3,
          fill: false,
        });
      }

      // 쇼핑 클릭량 데이터셋
      if (visibleLayers.shopping && data.shopping[keyword]) {
        const shoppingData = data.shopping[keyword];
        const values = allDates.map((date) => {
          const point = shoppingData.find((p) => p.period === date);
          return point ? { x: date, y: Number(point.ratio) } : { x: date, y: null };
        });

        datasets.push({
          label: `${keyword} · 쇼핑 클릭량`,
          data: values,
          borderColor: palette.shopping,
          backgroundColor: `${palette.shopping}10`,
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          pointHoverRadius: 5,
          pointBackgroundColor: palette.shopping,
          pointBorderColor: 'transparent',
          pointBorderWidth: 0,
          tension: 0.3,
          fill: false,
        });
      }
    });

    return {
      labels: allDates, // 원본 모든 날짜 (데이터 전체 기준)
      datasets,
    };
  }, [data, visibleLayers, allDates]);



  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    layout: {
      padding: {
        top: 0,
      },
    },
    plugins: {
      legend: {
        display: !isMobile,
        position: 'top',
        padding: isMobile ? { bottom: 24 } : { bottom: 12 },
        fullWidth: true,
        labels: {
          color: '#cbd5e1',
          font: {
            size: 13,
            weight: 'bold' as any,
          },
          padding: 22,
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 14,
          boxHeight: 14,
        },
      } as any,
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#e2e8f0',
        bodyColor: '#cbd5e1',
        borderColor: '#475569',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          title: (context: any) => {
            if (context.length === 0) return '';
            const dateStr = context[0].label;
            if (!dateStr) return '';

            // dateStr이 "YYYY-MM-DD" 형식이므로 포맷팅
            const [year, month, day] = dateStr.split('-').map(Number);
            return `${year}.${month}.${day}`;
          },
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (value === null) return '';
            return `${label}: ${value.toFixed(1)}`;
          },
        } as any,
      },
    },
    scales: {
      x: {
        type: 'category' as any,
        display: true,
        grid: {
          color: '#334155',
          drawTicks: false,
          drawOnChartArea: false,
        },
        ticks: {
          color: '#94a3b8',
          font: {
            size: 12,
          },
          maxRotation: 0,
          autoSkip: false,
          // 모바일에서 라벨과 축선 사이 간격 확대
          padding: isMobile ? 8 : 0,
          // tickFormatter: 선택된 인덱스만 라벨 표시
          callback: function (value: any, index: number) {
            if (labelIndexes.has(index)) {
              if (isMobile) {
                return formatMobileDateLabel(allDates[index], startDate, endDate);
              }
              return allDates[index];
            }
            return '';
          },
        },
        // X축 선 표시 (Y축과 동일하게 통일)
        border: {
          display: true,
          color: '#64748b',
          width: 1,
        } as any,
      },
      y: {
        display: true,
        min: 0,
        max: 100,
        ticks: {
          stepSize: 25,
          color: '#94a3b8',
          font: {
            size: 12,
          },
          // 모바일에서 Y축 숫자와 축선 사이 간격
          padding: isMobile ? 8 : 0,
        },
        grid: {
          color: '#334155',
          drawTicks: false,
        },
        // Y축 세로 축선 표시 (Chart.js border 설정)
        border: {
          display: true,
          color: '#64748b',
          width: 1,
        } as any,
      }
    },
  };

  // Check if any keyword has no shopping data
  const hasNoShoppingData = data.keywords.some(
    (keyword) => data.shoppingStatus?.[keyword] === 'NO_DATA'
  );

  return (
    <div className="w-full h-full">
      {hasNoShoppingData && (
        <div className="mb-4 inline-flex w-fit max-w-full px-5 py-3 border border-red-500/40 bg-red-950/45 rounded text-sm text-red-200 shopping-no-data-alert">
          <p className="whitespace-nowrap max-md:whitespace-normal">
            선택한 카테고리에서 해당 검색어의 쇼핑 클릭량 데이터를 찾지 못했습니다. 카테고리를 변경하거나 다른 검색어를 입력해 주세요.
          </p>
        </div>
      )}
      {isMobile && data.keywords.length > 0 && (
        <div className="mb-6 flex flex-col gap-3">
          {data.keywords.map((keyword) => (
            <div key={keyword} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: chartData.datasets[0]?.borderColor || '#3b82f6',
                  }}
                />
                <span className="text-xs font-bold text-slate-200">
                  {keyword} · 검색 트렌드
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: chartData.datasets[1]?.borderColor || '#06b6d4',
                  }}
                />
                <span className="text-xs font-bold text-slate-200">
                  {keyword} · 쇼핑 클릭량
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="md:min-h-[400px] min-h-0 h-[480px]">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};
