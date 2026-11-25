import { MessageCircle, Youtube } from "lucide-react";
import { Link } from "wouter";

function NaverLineIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 18V6l12 12V6" />
    </svg>
  );
}

const links = [
  { id: "youtube", href: "/trends/youtube", label: "유튜브 트렌드", mobileLabel: "유튜브", Icon: Youtube },
  { id: "naver", href: "/trends/naver", label: "네이버 트렌드", mobileLabel: "네이버", Icon: NaverLineIcon },
  { id: "community", href: "/community", label: "커뮤니티 트렌드", mobileLabel: "커뮤니티", Icon: MessageCircle },
  { id: "search", href: "/trends/google", label: "검색 트렌드", mobileLabel: "검색어", logo: "/google-trends-favicon.png" },
] as const;

export default function LiveTrendNavigation({ active }: { active: (typeof links)[number]["id"] }) {
  return (
    <>
      <nav className="tabMenu youtubeTabMenu liveTrendNavigation" aria-label="크리에이터 트렌드 이동">
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
      <nav aria-label="크리에이터 트렌드 하단 메뉴" className="creatorTrendMobileNav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 px-2 pb-[env(safe-area-inset-bottom,0px)] md:hidden">
        {links.map(item => (
          <Link
            key={item.id}
            href={item.href}
            aria-current={active === item.id ? "page" : undefined}
            className="flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded text-xs font-medium text-slate-300 no-underline outline-sky-300 focus-visible:outline-2 aria-[current=page]:text-sky-300"
          >
            {"logo" in item
              ? <img src={item.logo} className="mobileTrendLogo" alt="" aria-hidden="true" />
              : <item.Icon size={18} aria-hidden="true" />}
            {item.mobileLabel}
          </Link>
        ))}
      </nav>
    </>
  );
}
