import { Link, useLocation } from "wouter";
import { Search } from "lucide-react";
import LatestNewsInfo from "@/components/LatestNewsInfo";
import SectionMobileNav from "@/components/SectionMobileNav";
import { getActiveNewsPath, newsLinks } from "@/lib/newsNavigation";

const mobileLinks = newsLinks.map(({ href, label }) => href === "/news/search"
  ? { href, label: "검색", Icon: Search }
  : { href, label: label.replace(" ", "\n") });

export default function NewsTrendHeader() {
  const [location] = useLocation();
  const selectedPath = getActiveNewsPath(location.replace(/\/$/, ""));
  const title = newsLinks.find(link => link.href === selectedPath)?.label ?? "뉴스 트렌드";

  return (
    <header className="pageHeader newsTrendHeader">
      {selectedPath === "/news" ? (
        <div className="flex items-center gap-1">
          <h1 className="pageTitle">{title}</h1>
          <LatestNewsInfo />
        </div>
      ) : (
        <h1 className="pageTitle">{title}</h1>
      )}
      <p className="pageDescription">오늘 주목받는 이슈를 빠르게 확인하고 콘텐츠 아이디어로 연결해보세요.</p>
      <nav className="tabMenu newsTrendTabMenu" aria-label="뉴스 트렌드 하위 메뉴">
        {newsLinks.map(({ href, label }) => (
          <Link key={href} href={href} className={`tabButton${selectedPath === href ? " active" : ""}`} aria-current={selectedPath === href ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      <SectionMobileNav label="뉴스 트렌드 하단 메뉴" activeHref={selectedPath} items={mobileLinks} />
    </header>
  );
}
