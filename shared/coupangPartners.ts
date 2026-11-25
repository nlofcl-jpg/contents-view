export const coupangCategories = [
  { id: "1016", label: "가전·디지털" },
  { id: "1010", label: "뷰티" },
  { id: "1012", label: "식품" },
  { id: "1014", label: "생활용품" },
  { id: "1001", label: "여성패션" },
  { id: "1002", label: "남성패션" },
  { id: "1030", label: "유아동패션" },
  { id: "1011", label: "출산·유아동" },
  { id: "1013", label: "주방용품" },
  { id: "1015", label: "홈인테리어" },
  { id: "1017", label: "스포츠·레저" },
  { id: "1018", label: "자동차용품" },
  { id: "1019", label: "도서·음반·DVD" },
  { id: "1020", label: "완구·취미" },
  { id: "1021", label: "문구·오피스" },
  { id: "1024", label: "헬스·건강식품" },
  { id: "1025", label: "국내여행" },
  { id: "1026", label: "해외여행" },
  { id: "1029", label: "반려동물용품" },
] as const;

export type CoupangCategoryId = typeof coupangCategories[number]["id"];
