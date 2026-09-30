import { describe, expect, it } from "vitest";
import { parseGoogleTrendTraffic, rankGoogleTrends } from "./googleTrendsHistory";

describe("Google Trends search-volume ranking", () => {
  it("parses RSS traffic labels", () => {
    expect(parseGoogleTrendTraffic("100+")).toBe(100);
    expect(parseGoogleTrendTraffic("10,000+")).toBe(10_000);
    expect(parseGoogleTrendTraffic("2.5K+")).toBe(2_500);
    expect(parseGoogleTrendTraffic("3만+")).toBe(30_000);
    expect(parseGoogleTrendTraffic("")).toBe(0);
  });

  it("ranks current and previous terms together by traffic", () => {
    const base = { news: [], source: "Google Trends", country: "KR", lastSeenAt: "2026-09-30T00:00:00Z" };
    const result = rankGoogleTrends([
      { ...base, keyword: "current", traffic: "100+", trafficCount: 100, isCurrent: true },
      { ...base, keyword: "previous", traffic: "1K+", trafficCount: 1000, isCurrent: false },
    ]);
    expect(result.map(({ keyword, rank, isCurrent }) => ({ keyword, rank, isCurrent }))).toEqual([
      { keyword: "previous", rank: 1, isCurrent: false },
      { keyword: "current", rank: 2, isCurrent: true },
    ]);
  });
});
