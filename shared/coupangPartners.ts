export const coupangCategories = [
  { id: "1016", label: "가전·디지털" },
  { id: "1011", label: "뷰티" },
  { id: "1012", label: "식품" },
  { id: "1014", label: "생활용품" },
] as const;

export type CoupangCategoryId = typeof coupangCategories[number]["id"];
