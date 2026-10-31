import { Link, useLocation } from "wouter";

const trendLinks = [
  { label: "유튜브 트렌드", href: "/trends/youtube" },
  { label: "네이버 트렌드", href: "/trends/naver" },
  { label: "검색 트렌드", href: "/trends/google" },
];
const newsLinks = [
  { label: "뉴스", href: "/news" },
  { label: "이슈", href: "/news/issues" },
  { label: "검색", href: "/news/search" },
];

export default function SectionSubnav() {
  const [location] = useLocation();
  const path = location.split("?")[0];
  const isTrends = trendLinks.some(link => link.href === path);
  const isNews = path === "/news" || path.startsWith("/news/");
  if (!isTrends && !isNews) return null;

  const links = isTrends ? trendLinks : newsLinks;
  const selectedPath = path.startsWith("/news/issues/") ? "/news/issues" : path;
  return (
    <nav className="studioSubnav sectionSubnav" aria-label={isTrends ? "실시간 트렌드 하위 메뉴" : "뉴스 및 이슈 하위 메뉴"}>
      {links.map(link => (
        <Link key={link.href} href={link.href} className={`studioSubnavLink${selectedPath === link.href ? " active" : ""}`} aria-current={selectedPath === link.href ? "page" : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
