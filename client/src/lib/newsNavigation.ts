export const newsLinks = [
  { label: "최신 뉴스", href: "/news" },
  { label: "뉴스 픽", href: "/news/issues" },
  { label: "뉴스 클립", href: "/news/clips" },
  { label: "검색", href: "/news/search" },
];

export function getActiveNewsPath(location: string) {
  const path = location.split("?")[0];
  return newsLinks.find(({ href }) => path === href || (href !== "/news" && path.startsWith(`${href}/`)))?.href ?? path;
}
