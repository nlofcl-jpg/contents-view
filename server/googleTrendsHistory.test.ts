import { describe, expect, it } from "vitest";
import { compareGoogleTrendRanks, parseGoogleTrendTraffic, rankGoogleTrends } from "./googleTrendsHistory";

describe("Google Trends search-volume ranking", () => {
  it("parses RSS traffic labels", () => {
    expect(parseGoogleTrendTraffic("100+")).toBe(100);
    expect(parseGoogleTrendTraffic("10,000+")).toBe(10_000);
    expect(parseGoogleTrendTraffic("2.5K+")).toBe(2_500);
    expect(parseGoogleTrendTraffic("3만+")).toBe(30_000);
    expect(parseGoogleTrendTraffic("")).toBe(0);
  });

  it("ranks current RSS terms ahead of previous terms, then by traffic", () => {
    const base = { news: [], source: "Google Trends", country: "KR", lastSeenAt: "2026-09-30T00:00:00Z" };
    const result = rankGoogleTrends([
      { ...base, keyword: "current", traffic: "100+", trafficCount: 100, isCurrent: true },
      { ...base, keyword: "current-high", traffic: "1K+", trafficCount: 1000, isCurrent: true },
      { ...base, keyword: "previous", traffic: "1K+", trafficCount: 1000, isCurrent: false },
    ]);
    expect(result.map(({ keyword, rank, isCurrent }) => ({ keyword, rank, isCurrent }))).toEqual([
      { keyword: "current-high", rank: 1, isCurrent: true },
      { keyword: "current", rank: 2, isCurrent: true },
      { keyword: "previous", rank: 3, isCurrent: false },
    ]);
  });

  it("uses the first snapshot as a baseline", () => {
    const items = rankGoogleTrends([
      { keyword: "새 검색어", traffic: "1K+", trafficCount: 1000, news: [], source: "Google Trends", country: "KR", isCurrent: true, lastSeenAt: "2026-10-04T00:00:00Z" },
    ]);
    expect(compareGoogleTrendRanks(items, null)[0].rankChange).toBe("same");
  });

  it("distinguishes rising, falling, unchanged and newly entered terms", () => {
    const base = { traffic: "1K+", trafficCount: 1000, news: [], source: "Google Trends", country: "KR", isCurrent: true, lastSeenAt: "2026-10-04T00:00:00Z", rankChange: "same" as const };
    const items = [
      { ...base, keyword: "상승", rank: 1 },
      { ...base, keyword: "하락", rank: 2 },
      { ...base, keyword: "유지", rank: 3 },
      { ...base, keyword: "새 진입", rank: 4 },
    ];
    expect(compareGoogleTrendRanks(items, { 상승: 2, 하락: 1, 유지: 3 }).map(item => item.rankChange)).toEqual([
      "up", "down", "same", "new",
    ]);
  });
});
