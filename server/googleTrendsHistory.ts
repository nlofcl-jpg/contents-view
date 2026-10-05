export type GoogleTrendNews = {
  title: string;
  source: string;
  url: string;
  image: string;
};

export type GoogleTrendItem = {
  rank: number;
  rankChange: GoogleTrendRankChange;
  keyword: string;
  traffic: string;
  trafficCount: number;
  news: GoogleTrendNews[];
  source: string;
  country: string;
  isCurrent: boolean;
  lastSeenAt: string;
  sourceRank?: number;
};

export type GoogleTrendRankChange = "up" | "down" | "same" | "new";
export type UnrankedGoogleTrendItem = Omit<GoogleTrendItem, "rank" | "rankChange">;

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

export function rankGoogleTrends(items: UnrankedGoogleTrendItem[]): GoogleTrendItem[] {
  return [...items]
    .sort((a, b) =>
      Number(b.isCurrent) - Number(a.isCurrent) ||
      b.trafficCount - a.trafficCount ||
      Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt) ||
      (a.sourceRank != null && b.sourceRank != null ? a.sourceRank - b.sourceRank : 0) ||
      a.keyword.localeCompare(b.keyword),
    )
    .map((item, index) => ({ ...item, rank: index + 1, rankChange: "same" as const }));
}

export function compareGoogleTrendRanks(
  items: GoogleTrendItem[],
  previousRanks: Record<string, number> | null,
): GoogleTrendItem[] {
  if (!previousRanks) return items;

  return items.map(item => {
    const key = item.keyword.normalize("NFKC").toLocaleLowerCase();
    const previousRank = Object.prototype.hasOwnProperty.call(previousRanks, key)
      ? previousRanks[key]
      : undefined;
    const rankChange: GoogleTrendRankChange = previousRank === undefined
      ? "new"
      : item.rank < previousRank
        ? "up"
        : item.rank > previousRank
          ? "down"
          : "same";
    return { ...item, rankChange };
  });
}
