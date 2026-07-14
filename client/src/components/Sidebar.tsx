import { useState } from "react";
import { useLocation, Link } from "wouter";

const trendItems = [
  { name: "YouTube", badge: "▶", path: "/trends/youtube" },
  { name: "네이버", badge: "N", path: "/trends/naver" },
  { name: "Google Trends", badge: "G", path: "/trends/google" },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ isMobileOpen = false, onCloseMobile }: SidebarProps) {
  const [isTrendOpen, setIsTrendOpen] = useState(true);
  const [location] = useLocation();

  const handleNavClick = () => {
    if (isMobileOpen && onCloseMobile) {
      onCloseMobile();
    }
  };

  const handleLinkClick = () => {
    handleNavClick();
  };

  return (
    <aside className={`sidebar ${isMobileOpen ? "mobile-open" : ""}`}>
      <nav className="sidebarPanel">
        <Link href="/" className={`navItem ${location === "/" ? "active" : ""}`} onClick={handleLinkClick}>
          <span className="navIcon home">⌂</span>
          <span className="navLabel">홈</span>
        </Link>

        <div className="navGroup">
          <button
            type="button"
            className="navItem groupTitle"
            onClick={() => setIsTrendOpen(!isTrendOpen)}
            aria-expanded={isTrendOpen}
          >
            <span className="navIcon">◉</span>
            <span className="navLabel">실시간 트렌드</span>
            <span className={`groupChevron ${isTrendOpen ? "open" : ""}`}>⌄</span>
          </button>

          {isTrendOpen && (
            <div className="subNav">
              {trendItems.map((item) => (
                <Link href={item.path} key={item.name} className={`subNavItem ${location === item.path ? "active" : ""}`} onClick={handleLinkClick}>
                  <span className={`platformBadge badge-${item.name}`}>{item.badge}</span>
                  <span className="subNavLabel">{item.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <Link href="/news" className={`navItem ${location === "/news" ? "active" : ""}`} onClick={handleLinkClick}>
          <span className="navIcon">▤</span>
          <span className="navLabel">뉴스 &amp; 이슈</span>
        </Link>

        <Link href="/community" className={`navItem ${location === "/community" ? "active" : ""}`} onClick={handleLinkClick}>
          <span className="navIcon">☷</span>
          <span className="navLabel">커뮤니티 반응</span>
        </Link>

        <Link href="/saved-contents" className={`navItem ${location === "/saved-contents" ? "active" : ""}`} onClick={handleLinkClick}>
          <span className="navIcon">◇</span>
          <span className="navLabel">내 보관함</span>
        </Link>
      </nav>

      <div className="sidebarNote">
        <strong>트렌드를 놓치지 마세요</strong>
        <p>관심 키워드를 등록하고 핵심 변화와 실시간 알림을 받아볼 수 있어요.</p>
        <button type="button" className="noteButton">키워드 알림 설정</button>
      </div>
    </aside>
  );
}
