import { describe, expect, it } from "vitest";
import { aggregateDailySearchRanks, getSeoulDayBounds, placeNewContentsKeywords } from "../shared/searchTrendDailyRanking";

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

  it("honors submitted positions for new keywords and keeps the cumulative order of the others", () => {
    const cumulative = [
      { rank: 1, keyword: "누적 1위", points: 90, rankChange: "same" },
      { rank: 2, keyword: "누적 2위", points: 80, rankChange: "same" },
      { rank: 3, keyword: "신규 A", points: 19, rankChange: "new" },
      { rank: 4, keyword: "신규 B", points: 17, rankChange: "new" },
    ];
    const result = placeNewContentsKeywords(cumulative, ["누적 2위", "신규 Ａ", "누적 1위", "신규 B"]);
    expect(result.map(entry => [entry.rank, entry.keyword])).toEqual([[1, "누적 1위"], [2, "신규 A"], [3, "누적 2위"], [4, "신규 B"]]);
    expect(result[1]).toMatchObject({ points: 19, rankChange: "new" });
  });

  it("brings a newly registered keyword into the live list even if its points place it outside the top 50", () => {
    const cumulative = Array.from({ length: 50 }, (_, index) => ({ rank: index + 1, keyword: `누적 ${index + 1}`, rankChange: "same" }));
    const result = placeNewContentsKeywords([...cumulative, { rank: 51, keyword: "신규", rankChange: "new" }], ["신규"]);
    expect(result).toHaveLength(50);
    expect(result[0]).toMatchObject({ rank: 1, keyword: "신규", rankChange: "new" });
    expect(result[49].keyword).toBe("누적 49");
  });
});
