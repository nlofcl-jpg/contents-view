import { describe, expect, it } from "vitest";
import { cleanHeroKeyword, readHeroKeywords } from "../client/src/lib/heroKeywords";

describe("hero search keywords", () => {
  it("removes a leading hash and surrounding whitespace", () => {
    expect(cleanHeroKeyword("  ## LCK  ")).toBe("LCK");
  });

  it("keeps seven unique, usable keywords in their saved order", () => {
    expect(readHeroKeywords([" #아이브 ", "LCK", "lck", "", null, "AI", "넷플릭스", "챌린지", "흑백요리사", "연말시상식", "추가"])).toEqual([
      "아이브", "LCK", "AI", "넷플릭스", "챌린지", "흑백요리사", "연말시상식",
    ]);
  });

  it("returns no keywords for an invalid stored value", () => {
    expect(readHeroKeywords(null)).toEqual([]);
  });
});
