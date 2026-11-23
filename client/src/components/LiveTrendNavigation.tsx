import { Link } from "wouter";

const links = [
  { id: "youtube", href: "/trends/youtube", label: "유튜브 트렌드" },
  { id: "naver", href: "/trends/naver", label: "네이버 트렌드" },
  { id: "search", href: "/trends/google", label: "검색 트렌드" },
] as const;

export default function LiveTrendNavigation({ active }: { active: (typeof links)[number]["id"] }) {
  return (
    <nav className="tabMenu youtubeTabMenu liveTrendNavigation" aria-label="실시간 트렌드 이동">
      {links.map(({ id, href, label }) => (
        <Link
          key={id}
          href={href}
          className={`tabButton${active === id ? " active" : ""}`}
          aria-current={active === id ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
