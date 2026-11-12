export const issueFocusCategories = [
  { id: "all", label: "전체" },
  { id: "commerce", label: "커머스·비즈니스" },
  { id: "technology", label: "AI·기술" },
  { id: "digital", label: "디지털·콘텐츠" },
  { id: "society", label: "사회·정책" },
  { id: "culture", label: "문화·화제" },
] as const;

export type IssueFocusCategory = typeof issueFocusCategories[number]["id"];
export type IssueFocusCategoryId = Exclude<IssueFocusCategory, "all">;

export function matchesIssueFocusCategory(savedCategory: IssueFocusCategoryId | null, category: IssueFocusCategory) {
  return category === "all" || savedCategory === category;
}
