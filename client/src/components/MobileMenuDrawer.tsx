import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation, useSearch } from "wouter";
import { ChevronDown, X, Home, LogOut, User, ShieldCheck, Bookmark, MessageCircle, FileText, Send, Handshake } from "lucide-react";
import { useState } from "react";
import { getActiveNewsPath, newsLinks } from "@/lib/newsNavigation";
import { commerceLinks, getCommerceTab } from "@/lib/commerceNavigation";
import { getStudioActiveHref, studioLinks } from "@/lib/studioNavigation";
import SocialIcons from "@/components/SocialIcons";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const accountPlaceholders = [
  { label: "약관 및 정책", Icon: FileText },
  { label: "의견 보내기", Icon: Send },
  { label: "제휴 문의", Icon: Handshake },
];

interface MobileMenuDrawerProps {
  panelType: "account" | "menu" | null;
  onClose: () => void;
  onOpenMyPageModal?: () => void;
  onNavigate?: () => void;
  onGuestMenuAccess?: (path: string) => boolean;
}

export function MobileMenuDrawer({
  panelType,
  onClose,
  onOpenMyPageModal,
  onNavigate,
  onGuestMenuAccess,
}: MobileMenuDrawerProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const [location, navigate] = useLocation();
  const search = useSearch();
  const [isTrendOpen, setIsTrendOpen] = useState(true);
  const [isNewsOpen, setIsNewsOpen] = useState(false);
  const [isCommerceOpen, setIsCommerceOpen] = useState(false);
  const [isStudioOpen, setIsStudioOpen] = useState(false);

  const isOpen = panelType === "menu";
  const isAccountOpen = panelType === "account" && isAuthenticated && Boolean(user);

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const handleNavigation = (path: string) => {
    const showGuestPrompt = path !== "/" && !path.startsWith("/login") && onGuestMenuAccess?.(path);
    if (!showGuestPrompt) navigate(path);
    onNavigate?.();
    onClose();
  };

  const handleMyPage = () => {
    if (onOpenMyPageModal) {
      onOpenMyPageModal();
      onClose();
    }
  };

  // 현재 페이지 확인
  const isHomePage = location === "/";
  const isYouTubePage = location?.startsWith("/trends/youtube");
  const activeNewsPath = getActiveNewsPath(location);
  const isSavedContentsPage = location === "/saved-contents";
  const isCommunityPage = location === "/community";
  const isCommercePage = location === "/commerce";
  const activeCommerceTab = isCommercePage ? getCommerceTab(search) : null;
  const isAIStudioPage = location === "/ai-studio" || location.startsWith("/ai-studio/");
  const activeStudioHref = isAIStudioPage ? getStudioActiveHref(location.replace(/\/$/, ""), search) : null;
  const isAdminPage = location === "/admin";
  const isAdmin = isAuthenticated && user?.role === "admin";

  return (
    <>
      <Sheet open={isAccountOpen} onOpenChange={open => { if (!open) onClose(); }}>
        <SheetContent
          id="mobile-account-drawer"
          side="right"
          aria-describedby={undefined}
          className="mobileAccountDrawer z-[10020] w-[min(100%,320px)] gap-0 overflow-y-auto overscroll-contain border-0 text-slate-100 motion-reduce:animate-none"
          overlayClassName="z-[10010] bg-black/50 motion-reduce:animate-none"
        >
          <SheetTitle className="sr-only">내 정보</SheetTitle>
          <div className="px-4 pt-14 pb-6">
            <button className="mobileNavItem" type="button" aria-current={isHomePage ? "page" : undefined} onClick={() => handleNavigation("/")}>
              <Home size={18} aria-hidden="true" />
              <span>홈</span>
            </button>
            <div className="mobileAccountCard">
              <div className="mobileAccountHeader">
                <div className="mobileAccountAvatar">{user?.name?.trim().charAt(0).toUpperCase() || "U"}</div>
                <div className="mobileAccountInfo">
                  <div className="mobileAccountName">{user?.name || "사용자"}</div>
                  {user?.email && <div className="mobileAccountEmail">{user.email}</div>}
                </div>
              </div>
            </div>
            <div className="mobileMenuSectionTitle">계정</div>
            <button className="mobileMenuAction" type="button" onClick={handleMyPage}>
              <User size={18} aria-hidden="true" />
              <span>내 정보</span>
            </button>
            <button className={`mobileMenuAction ${isSavedContentsPage ? "active" : ""}`} type="button" onClick={() => handleNavigation("/saved-contents")}>
              <Bookmark size={18} aria-hidden="true" />
              <span>내 보관함</span>
            </button>
            {accountPlaceholders.map(({ label, Icon }) => (
              <button key={label} className="mobileMenuAction" type="button" disabled>
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
            {isAdmin && (
              <button className="mobileMenuAction" type="button" onClick={() => handleNavigation("/admin")}>
                <ShieldCheck size={18} aria-hidden="true" />
                <span>Admin</span>
              </button>
            )}
          </div>
          <div className="mt-auto px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
            <button className="mobileMenuAction logout" type="button" onClick={handleLogout}>
              <LogOut size={18} aria-hidden="true" />
              <span>로그아웃</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Overlay */}
      {isOpen && (
        <div
          className="mobileMenuOverlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div className={`mobileMenuDrawer ${isOpen ? "open" : ""}`} inert={!isOpen}>
        {/* 닫기 버튼 */}
        <button
          className="mobileMenuClose"
          onClick={onClose}
          type="button"
          aria-label="메뉴 닫기"
        >
          <X size={16} />
        </button>

        <div className={`mobileDrawerContent${panelType === "menu" ? " mobileDrawerNavigation" : ""}`}>
          {isOpen && (
            <button
              className={`mobileNavItem ${isHomePage ? "active" : ""}`}
              aria-current={isHomePage ? "page" : undefined}
              onClick={() => handleNavigation("/")}
              type="button"
            >
              <Home size={18} aria-hidden="true" />
              <span>홈</span>
            </button>
          )}

          {/* 메뉴 패널 */}
          {panelType === "menu" && (
            <div className="mobileMenuSection mobileNavigationSection">
              {!(isAuthenticated && user) && (
                <div className="mobileMenuTopActions">
                  <a href={getLoginUrl()} className="neonAuthLink">
                    로그인 / 가입
                  </a>
                </div>
              )}

              {/* 크리에이터 트렌드 그룹 */}
              <button
                className="mobileNavItem groupTitle"
                onClick={() => setIsTrendOpen(!isTrendOpen)}
                type="button"
              >
                <span>크리에이터 트렌드</span>
                <span style={{ marginLeft: "auto", transition: "transform 0.2s" }}>
                  {isTrendOpen ? "⌄" : "⌃"}
                </span>
              </button>

              {isTrendOpen && (
                <>
                  <button
                    className={`mobileNavItem subNavItem ${isYouTubePage ? "active" : ""}`}
                    onClick={() => handleNavigation("/trends/youtube")}
                    type="button"
                  >
                    <img className="mobileTrendLogo" src="/youtube-favicon.png" alt="" aria-hidden="true" />
                    <span>유튜브 트렌드</span>
                  </button>

                  <button
                    className="mobileNavItem subNavItem"
                    onClick={() => handleNavigation("/trends/naver")}
                    type="button"
                  >
                    <img className="mobileTrendLogo" src="/naver-favicon.png" alt="" aria-hidden="true" />
                    <span>네이버 트렌드</span>
                  </button>

                  <button
                    className={`mobileNavItem subNavItem ${isCommunityPage ? "active" : ""}`}
                    aria-current={isCommunityPage ? "page" : undefined}
                    onClick={() => handleNavigation("/community")}
                    type="button"
                  >
                    <MessageCircle className="mobileTrendLogo" aria-hidden="true" />
                    <span>커뮤니티 트렌드</span>
                  </button>

                  <button
                    className="mobileNavItem subNavItem"
                    onClick={() => handleNavigation("/trends/google")}
                    type="button"
                  >
                    <img className="mobileTrendLogo" src="/google-trends-favicon.png" alt="" aria-hidden="true" />
                    <span>검색 트렌드</span>
                  </button>
                </>
              )}

              <button
                className="mobileNavItem groupTitle"
                onClick={() => setIsNewsOpen(!isNewsOpen)}
                type="button"
                aria-expanded={isNewsOpen}
                aria-controls="mobile-news-submenu"
              >
                <span>뉴스 트렌드</span>
                <span style={{ marginLeft: "auto", transition: "transform 0.2s" }}>
                  {isNewsOpen ? "⌄" : "⌃"}
                </span>
              </button>

              {isNewsOpen && (
                <div id="mobile-news-submenu">
                  {newsLinks.map(({ label, href }) => (
                    <button
                      key={href}
                      className={`mobileNavItem subNavItem ${activeNewsPath === href ? "active" : ""}`}
                      aria-current={activeNewsPath === href ? "page" : undefined}
                      onClick={() => handleNavigation(href)}
                      type="button"
                    >
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}

              <button
                className={`mobileNavItem groupTitle ${isCommercePage ? "active" : ""}`}
                aria-expanded={isCommerceOpen}
                aria-controls="mobile-commerce-submenu"
                onClick={() => setIsCommerceOpen(open => !open)}
                type="button"
              >
                <span>커머스 트렌드</span>
                <ChevronDown size={16} className={`ml-auto transition-transform${isCommerceOpen ? " rotate-180" : ""}`} aria-hidden="true" />
              </button>

              {isCommerceOpen && (
                <div id="mobile-commerce-submenu">
                  {commerceLinks.map(({ id, label, href }) => (
                    <button
                      key={id}
                      type="button"
                      className={`mobileNavItem subNavItem ${activeCommerceTab === id ? "active" : ""}`}
                      aria-current={activeCommerceTab === id ? "page" : undefined}
                      onClick={() => handleNavigation(href)}
                    >
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}

              <button
                className={`mobileNavItem groupTitle ${isAIStudioPage ? "active" : ""}`}
                onClick={() => setIsStudioOpen(!isStudioOpen)}
                type="button"
                aria-expanded={isStudioOpen}
                aria-controls="mobile-studio-submenu"
              >
                <span>스튜디오</span>
                <span style={{ marginLeft: "auto", transition: "transform 0.2s" }}>
                  {isStudioOpen ? "⌄" : "⌃"}
                </span>
              </button>

              {isStudioOpen && (
                <div id="mobile-studio-submenu">
                  {studioLinks.map(({ href, label }) => (
                    <button
                      key={href}
                      className={`mobileNavItem subNavItem ${activeStudioHref === href ? "active" : ""}`}
                      aria-current={activeStudioHref === href ? "page" : undefined}
                      onClick={() => handleNavigation(href)}
                      type="button"
                    >
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}

              {isAdmin && (
                <button
                  className={`mobileNavItem ${isAdminPage ? "active" : ""}`}
                  onClick={() => handleNavigation("/admin")}
                  type="button"
                >
                  <span>관리자</span>
                </button>
              )}

              {isAuthenticated && user && (
                <div className="mobileMenuBottomActions">
                  <button
                    className="mobileMenuAction"
                    onClick={handleMyPage}
                    type="button"
                  >
                    <User size={18} />
                    <span>내 정보</span>
                  </button>
                  <button className={`mobileMenuAction ${isSavedContentsPage ? "active" : ""}`} onClick={() => handleNavigation("/saved-contents")} type="button">
                    <Bookmark size={18} />
                    <span>내 보관함</span>
                  </button>
                  <button
                    className="mobileMenuAction logout"
                    onClick={handleLogout}
                    type="button"
                  >
                    <LogOut size={18} />
                    <span>로그아웃</span>
                  </button>
                </div>
              )}
            </div>
          )}
          {panelType === "menu" && <SocialIcons className="mobileMenuSocialIcons" />}
        </div>
      </div>
    </>
  );
}
