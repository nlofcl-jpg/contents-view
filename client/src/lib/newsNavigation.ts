export const issueFocusLabel = "이슈 포커스";
export const issueBriefingLabel = "이슈 브리핑";

export const newsLinks = [
  { label: "최신 뉴스", href: "/news" },
  { label: issueFocusLabel, href: "/news/issues" },
  { label: issueBriefingLabel, href: "/news/clips" },
  { label: "뉴스 검색", href: "/news/search" },
];

export function getActiveNewsPath(location: string) {
  const path = location.split("?")[0];
  return newsLinks.find(({ href }) => path === href || (href !== "/news" && path.startsWith(`${href}/`)))?.href ?? path;
}
