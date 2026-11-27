export const getSeriesSummary = (series?: { ratio: number }[]) => {
  if (!series || series.length === 0) {
    return { latest: null as number | null, delta: null as number | null, peak: null as number | null };
  }

  const latest = series[series.length - 1]?.ratio ?? null;
  const previous = series.length > 1 ? series[series.length - 2]?.ratio : null;
  const delta = latest !== null && previous !== null ? latest - previous : null;
  const peak = Math.max(...series.map((item) => item.ratio));
  return { latest, delta, peak };
};

export const formatRatio = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "-";
  return `${Math.round(value * 10) / 10}`;
};

export const formatDelta = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "비교 데이터 없음";
  if (value === 0) return "변동 없음";
  return `${value > 0 ? "+" : ""}${Math.round(value * 10) / 10}p`;
};

export const formatNumber = (value: number | null | undefined, suffix = "") => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${Math.round(value).toLocaleString("ko-KR")}${suffix}`;
};

export const formatDecimal = (value: number | null | undefined, suffix = "") => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${Math.round(value * 10) / 10}${suffix}`;
};

export const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${Math.round(value)}%`;
};

export const getCompetitionLabel = (competition: string | null | undefined) => {
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

export const getBlogCompetitionStrength = (ratio: number | null) => {
  if (ratio === null || Number.isNaN(ratio)) return "-";
  if (ratio < 1) return "낮음";
  if (ratio < 5) return "보통";
  if (ratio < 20) return "높음";
  return "포화";
};
export type KeywordMetric = {
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

export const getBlogSearchRatio = (documents: number | null, searches?: number | null) =>
  searches && documents !== null ? documents / searches : null;

