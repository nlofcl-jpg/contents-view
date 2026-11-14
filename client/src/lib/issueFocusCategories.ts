export const issueFocusCategories = [
  { id: "all", label: "전체" },
  { id: "technology", label: "AI·테크" },
  { id: "platform", label: "플랫폼·SNS" },
  { id: "marketing", label: "마케팅·광고" },
  { id: "commerce", label: "커머스·비즈니스" },
  { id: "creator", label: "크리에이터·콘텐츠" },
] as const;

export type IssueFocusCategory = typeof issueFocusCategories[number]["id"];
export type IssueFocusCategoryId = Exclude<IssueFocusCategory, "all">;

export function matchesIssueFocusCategory(savedCategory: IssueFocusCategoryId | null, category: IssueFocusCategory) {
  return category === "all" || savedCategory === category;
}
