import { Link } from "wouter";
import SocialIcons from "@/components/SocialIcons";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <div className="siteFooterBrand">
          <Link href="/" className="siteFooterLogo" aria-label="CONTENTS VIEW 홈">
            <span>
              CONTENTS <strong>VIEW</strong>
            </span>
          </Link>
          <p className="siteFooterDescription">
            크리에이터 트렌드와 이슈 흐름을
            <br />
            한 곳에서 확인하는 콘텐츠 인사이트 서비스
          </p>
        </div>

        <nav className="siteFooterLegalLinks" aria-label="하단 안내">
          <Link href="/privacy">개인정보처리방침</Link>
          <Link href="/terms">이용약관</Link>
        </nav>

        <SocialIcons className="siteFooterSocialIcons" />
      </div>

      <div className="siteFooterBottom">
        <span>© {year} CONTENTS VIEW</span>
        <span>Trend, news, community, and creator intelligence.</span>
      </div>
    </footer>
  );
}
