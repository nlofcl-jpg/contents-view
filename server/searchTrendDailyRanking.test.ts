import { describe, expect, it } from "vitest";
import { aggregateDailySearchRanks, getSeoulDayBounds } from "../shared/searchTrendDailyRanking";

describe("daily search trend rankings", () => {
  it("uses the calendar day in Korea and rejects invalid dates", () => {
    expect(getSeoulDayBounds("2026-11-21")).toEqual({
      start: "2026-11-20T15:00:00.000Z",
      end: "2026-11-21T15:00:00.000Z",
    });
    expect(getSeoulDayBounds("2026-02-30")).toBeNull();
  });

  it("sums rank points across rounds and counts a keyword once per round", () => {
    expect(aggregateDailySearchRanks([
      [{ keyword: "AI", rank: 8 }, { keyword: "ai", rank: 9 }, { keyword: "단독", rank: 1 }],
      [{ keyword: "ＡＩ", rank: 10 }, { keyword: "마지막", rank: 20 }, { keyword: "범위 밖", rank: 21 }],
    ])).toEqual([
      { keyword: "AI", points: 24, appearances: 2, rank: 1 },
      { keyword: "단독", points: 20, appearances: 1, rank: 2 },
      { keyword: "마지막", points: 1, appearances: 1, rank: 3 },
    ]);
  });

  it("keeps only the daily top 20", () => {
    const round = (prefix: string) => Array.from({ length: 20 }, (_, i) => ({ keyword: `${prefix}${i}`, rank: i + 1 }));
    const result = aggregateDailySearchRanks([round("a"), round("b")]);
    expect(result).toHaveLength(20);
    expect(result[19]).toMatchObject({ rank: 20, points: 11 });
  });
});
