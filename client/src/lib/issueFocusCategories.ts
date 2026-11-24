export const issueFocusCategories = [
  { id: "all", label: "전체" },
  { id: "technology", label: "AI·테크" },
  { id: "platform", label: "플랫폼·SNS" },
  { id: "marketing", label: "마케팅·광고" },
  { id: "commerce", label: "커머스·비즈니스" },
  { id: "creator", label: "크리에이터·콘텐츠" },
  { id: "economy", label: "경제·사회" },
] as const;

export type IssueFocusCategory = typeof issueFocusCategories[number]["id"];
export type IssueFocusCategoryId = Exclude<IssueFocusCategory, "all">;

export function isIssueFocusCategoryId(value: unknown): value is IssueFocusCategoryId {
  return issueFocusCategories.some(({ id }) => id !== "all" && id === value);
}

export function normalizeIssueFocusCategory(value: unknown): IssueFocusCategoryId | null {
  if (value === "society") return "economy";
  return isIssueFocusCategoryId(value) ? value : null;
}

export function getIssueFocusCategoryValues(category: IssueFocusCategoryId) {
  return category === "economy" ? ["economy", "society"] : [category];
}

export function matchesIssueFocusCategory(savedCategory: string | null, category: IssueFocusCategory) {
  return category === "all" || normalizeIssueFocusCategory(savedCategory) === category;
}
