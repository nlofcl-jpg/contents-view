import { Link } from "wouter";
import { useState } from "react";
import PartnershipInquiryDialog from "@/components/PartnershipInquiryDialog";

export default function Footer() {
  const year = new Date().getFullYear();
  const [inquiryOpen, setInquiryOpen] = useState(false);

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

        <nav className="siteFooterLegalLinks" aria-label="하단 안내">
            <Link href="/privacy">개인정보처리방침</Link>
            <span>이용약관</span>
            <a href="mailto:edenofcls@gmail.com">이메일</a>
            <button type="button" className="siteFooterInquiryButton" onClick={() => setInquiryOpen(true)}>제휴 문의</button>
        </nav>
      </div>

      <div className="siteFooterBottom">
        <span>© {year} CONTENTS VIEW</span>
        <span>Trend, news, community, and creator intelligence.</span>
      </div>
      <PartnershipInquiryDialog open={inquiryOpen} onOpenChange={setInquiryOpen} />
    </footer>
  );
}
