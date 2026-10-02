export const MAX_HERO_KEYWORDS = 7;
export const MAX_HERO_KEYWORD_LENGTH = 30;

export function cleanHeroKeyword(value: string): string {
  return value.trim().replace(/^#+/, "").trim();
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
