export type GoogleTrendNews = {
  title: string;
  source: string;
  url: string;
  image: string;
};

export type GoogleTrendItem = {
  rank: number;
  keyword: string;
  traffic: string;
  trafficCount: number;
  news: GoogleTrendNews[];
  source: string;
  country: string;
  isCurrent: boolean;
  lastSeenAt: string;
};

export const GOOGLE_TREND_HISTORY_MS = 24 * 60 * 60 * 1000;

export function parseGoogleTrendTraffic(value: string): number {
  const match = value.replace(/,/g, "").trim().match(/^([\d.]+)\s*(K|M|B|천|만|억)?/i);
  if (!match) return 0;

  const multiplier: Record<string, number> = {
    K: 1_000,
    M: 1_000_000,
    B: 1_000_000_000,
    "천": 1_000,
    "만": 10_000,
    "억": 100_000_000,
  };
  return Math.round(Number(match[1]) * (multiplier[match[2]?.toUpperCase() ?? ""] ?? 1));
}

export function rankGoogleTrends(items: Omit<GoogleTrendItem, "rank">[]): GoogleTrendItem[] {
  return [...items]
    .sort((a, b) =>
      b.trafficCount - a.trafficCount ||
      Number(b.isCurrent) - Number(a.isCurrent) ||
      Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt) ||
      a.keyword.localeCompare(b.keyword),
    )
    .map((item, index) => ({ ...item, rank: index + 1 }));
}
