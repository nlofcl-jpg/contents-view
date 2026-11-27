const studioProductionHref = "/ai-studio/video";
export const studioProgramsHref = "/ai-studio/programs";

export const studioLinks = [
  { href: studioProgramsHref, label: "프로그램" },
  { href: studioProductionHref, label: "콘텐츠 제작" },
  { href: "/ai-studio/open-source", label: "오픈소스" },
  { href: "/ai-studio/resources", label: "도구" },
];

export function getStudioActiveHref(path: string, search: string) {
  const section = studioLinks.find(({ href }) => path === href || path.startsWith(`${href}/`));
  const isLegacyProduction = path === "/ai-studio" && new URLSearchParams(search).get("tab") === "upcoming";
  return section?.href ?? (isLegacyProduction ? studioProductionHref : studioProgramsHref);
}
