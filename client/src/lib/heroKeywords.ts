export const MAX_HERO_KEYWORDS = 20;
export const MAX_HERO_KEYWORD_LENGTH = 30;

export function cleanHeroKeyword(value: string): string {
  return value.trim().replace(/^#+/, "").trim();
}

export function parseRankedHeroKeywords(value: string): string[] {
  const entries = value.split(/[|,\n]+/).map(entry => entry.trim()).filter(Boolean);
  if (entries.length === 0) throw new Error("검색어를 입력하세요.");
  if (entries.length > MAX_HERO_KEYWORDS) throw new Error(`검색어는 최대 ${MAX_HERO_KEYWORDS}개까지 등록할 수 있습니다.`);

  const ranked = entries.map(entry => {
    const match = entry.match(/^(\d{1,2})[.)]\s*(.+)$/);
    return { rank: match ? Number(match[1]) : null, keyword: cleanHeroKeyword(match ? match[2] : entry) };
  });
  const numbered = ranked.filter(entry => entry.rank !== null).length;
  if (numbered > 0 && numbered !== ranked.length) throw new Error("순위 번호를 모두 입력하거나 모두 생략해 주세요.");
  if (numbered > 0) {
    ranked.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    if (ranked.some((entry, index) => entry.rank !== index + 1)) {
      throw new Error("순위 번호는 1부터 빠짐없이 한 번씩 입력해 주세요.");
    }
  }

  const keywords = ranked.map(entry => entry.keyword);
  if (keywords.some(keyword => !keyword || keyword.length > MAX_HERO_KEYWORD_LENGTH)) {
    throw new Error(`각 검색어를 1~${MAX_HERO_KEYWORD_LENGTH}자로 입력하세요.`);
  }
  if (new Set(keywords.map(keyword => keyword.toLocaleLowerCase())).size !== keywords.length) {
    throw new Error("중복된 검색어가 있습니다.");
  }
  return keywords;
}

export function readHeroKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const keyword = cleanHeroKeyword(item);
    const key = keyword.toLocaleLowerCase();
    if (!keyword || keyword.length > MAX_HERO_KEYWORD_LENGTH || seen.has(key)) continue;
    seen.add(key);
    keywords.push(keyword);
    if (keywords.length === MAX_HERO_KEYWORDS) break;
  }
  return keywords;
}
