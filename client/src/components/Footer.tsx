import { Link } from "wouter";

const trendLinks = [
  { label: "YouTube", href: "/trends/youtube" },
  { label: "쇼핑 인사이트", href: "/trends/naver" },
  { label: "Google Trends", href: "/trends/google" },
];

const serviceLinks = [
  { label: "뉴스&이슈", href: "/news" },
  { label: "커뮤니티 반응", href: "/community" },
  { label: "AI 스튜디오", href: "/ai-studio" },
  { label: "내 보관함", href: "/saved-contents" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <div className="siteFooterBrand">
          <Link href="/" className="siteFooterLogo" aria-label="CONTENTS VIEW 홈">
            <img src="/contents-view-symbol.png" alt="" className="siteFooterLogoMark" />
            <span>
              CONTENTS <strong>VIEW</strong>
            </span>
          </Link>
          <p className="siteFooterDescription">
            실시간 트렌드와 이슈 흐름을 한 곳에서 확인하는 콘텐츠 인사이트 서비스
          </p>
        </div>

        <nav className="siteFooterNav" aria-label="하단 메뉴">
          <div className="siteFooterNavGroup">
            <h2>트렌드</h2>
            {trendLinks.map(link => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
          <div className="siteFooterNavGroup">
            <h2>서비스</h2>
            {serviceLinks.map(link => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>

      <div className="siteFooterBottom">
        <span>© {year} CONTENTS VIEW</span>
        <span>Trend, news, community, and creator intelligence.</span>
      </div>
    </footer>
  );
}
