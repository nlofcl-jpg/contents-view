const TOP_COUNT = 20;
export const CONTENTS_LIVE_RANK_LIMIT = 50;
const HOUR_MS = 3_600_000;
const seoulDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });

export function getSeoulDate(date = new Date()) {
  const parts = seoulDate.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function getSeoulDayBounds(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const start = Date.parse(`${day}T00:00:00+09:00`);
  if (!Number.isFinite(start) || getSeoulDate(new Date(start)) !== day) return null;
  return { start: new Date(start).toISOString(), end: new Date(start + 24 * HOUR_MS).toISOString() };
}

export function placeNewContentsKeywords<T extends { keyword: string; rank: number; rankChange: string }>(
  cumulative: readonly T[], latestKeywords: readonly string[],
): T[] {
  const keywordKey = (keyword: string) => keyword.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
  const newEntries = new Map(cumulative.filter(entry => entry.rankChange === "new").map(entry => [keywordKey(entry.keyword), entry]));
  const slots = Array<T | undefined>(Math.min(CONTENTS_LIVE_RANK_LIMIT, cumulative.length)).fill(undefined);
  const placed = new Set<T>();
  latestKeywords.slice(0, slots.length).forEach((keyword, index) => {
    const entry = newEntries.get(keywordKey(keyword));
    if (!entry || placed.has(entry)) return;
    slots[index] = entry;
    placed.add(entry);
  });

  const remaining = cumulative.filter(entry => !placed.has(entry));
  let next = 0;
  return slots.map((entry, index) => ({ ...(entry ?? remaining[next++]), rank: index + 1 }));
}

export function aggregateDailySearchRanks(snapshots: ReadonlyArray<ReadonlyArray<{ keyword: string; rank: number }>>) {
  type Score = { keyword: string; points: number; appearances: number; bestRank: number };
  const scores = new Map<string, Score>();
  for (const snapshot of snapshots) {
    const entries = new Map<string, { keyword: string; rank: number }>();
    for (const item of snapshot) {
      const keyword = item.keyword.trim();
      const key = keyword.normalize("NFKC").replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
      if (!key || !Number.isInteger(item.rank) || item.rank < 1 || item.rank > TOP_COUNT) continue;
      const previous = entries.get(key);
      if (!previous || item.rank < previous.rank) entries.set(key, { keyword, rank: item.rank });
    }

    entries.forEach(({ keyword, rank }, key) => {
      const score = scores.get(key) ?? { keyword, points: 0, appearances: 0, bestRank: rank };
      score.points += TOP_COUNT + 1 - rank;
      score.appearances += 1;
      score.bestRank = Math.min(score.bestRank, rank);
      scores.set(key, score);
    });
  }

  return Array.from(scores.values())
    .sort((a, b) => b.points - a.points || b.appearances - a.appearances || a.bestRank - b.bestRank || a.keyword.localeCompare(b.keyword, "ko-KR"))
    .slice(0, TOP_COUNT)
    .map(({ keyword, points, appearances }, index) => ({ keyword, points, appearances, rank: index + 1 }));
}
