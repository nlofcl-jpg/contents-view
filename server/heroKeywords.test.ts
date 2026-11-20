import { describe, expect, it } from "vitest";
import { addHeroKeywordToDraft, cleanHeroKeyword, parseRankedHeroKeywords, readHeroKeywords } from "../client/src/lib/heroKeywords";

describe("hero search keywords", () => {
  it("removes a leading hash and surrounding whitespace", () => {
    expect(cleanHeroKeyword("  ## LCK  ")).toBe("LCK");
  });

  it("keeps up to twenty unique, usable keywords in their saved order", () => {
    expect(readHeroKeywords([" #아이브 ", "LCK", "lck", "", null, "AI", "넷플릭스", "챌린지", "흑백요리사", "연말시상식", "추가", "검색", "열번째", "초과"])).toEqual([
      "아이브", "LCK", "AI", "넷플릭스", "챌린지", "흑백요리사", "연말시상식", "추가", "검색", "열번째", "초과",
    ]);
  });

  it("parses pipe-separated ranked keywords", () => {
    expect(parseRankedHeroKeywords("1. 한국 일본 축구 | 2. 아시안게임 | 3. AI 해킹 | 4. 신한은행 | 5. 북한 미사일 | 6. 서채현 | 7. 누리호 | 8. 김지용 | 9. 부정청약 | 10. 아시안게임 폐막식")).toEqual([
      "한국 일본 축구", "아시안게임", "AI 해킹", "신한은행", "북한 미사일", "서채현", "누리호", "김지용", "부정청약", "아시안게임 폐막식",
    ]);
  });

  it("parses comma-separated ranked keywords by rank", () => {
    expect(parseRankedHeroKeywords("2. 아시안게임,1. 한국 일본 축구")).toEqual([
      "한국 일본 축구", "아시안게임",
    ]);
  });

  it("accepts an unnumbered list and rejects missing or duplicate ranks", () => {
    expect(parseRankedHeroKeywords("한국 일본 축구, 아시안게임")).toEqual(["한국 일본 축구", "아시안게임"]);
    expect(() => parseRankedHeroKeywords("1. 한국 일본 축구,3. 아시안게임")).toThrow("순위 번호");
    expect(() => parseRankedHeroKeywords("1. 한국 일본 축구,1. 아시안게임")).toThrow("순위 번호");
  });

  it("accepts twenty keywords but rejects a twenty-first", () => {
    expect(parseRankedHeroKeywords(Array.from({ length: 20 }, (_, index) => `${index + 1}. 키워드${index + 1}`).join(",")).length).toBe(20);
    expect(() => parseRankedHeroKeywords(Array.from({ length: 21 }, (_, index) => `키워드${index + 1}`).join(","))).toThrow("최대 20개");
  });

  it("returns no keywords for an invalid stored value", () => {
    expect(readHeroKeywords(null)).toEqual([]);
  });

  it("starts a new draft without modifying a full saved list", () => {
    const saved = Array.from({ length: 20 }, (_, index) => `검색어 ${index + 1}`);
    const draft = addHeroKeywordToDraft([...saved], saved, " #신규 ");
    expect(draft).toEqual({ keywords: ["신규"], startsNewRound: true });
    expect(saved).toHaveLength(20);
    expect(addHeroKeywordToDraft(draft.keywords, saved, "두 번째").keywords).toEqual(["신규", "두 번째"]);
  });

  it("does not discard a full unsaved draft", () => {
    const draft = Array.from({ length: 20 }, (_, index) => `검색어 ${index + 1}`);
    expect(() => addHeroKeywordToDraft(draft, ["저장된 검색어"], "신규")).toThrow("먼저 저장하거나 취소");
    expect(() => addHeroKeywordToDraft(draft, draft, "검색어 1")).toThrow("이미 등록");
  });
});
