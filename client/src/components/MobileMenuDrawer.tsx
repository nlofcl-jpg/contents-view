import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { X, Home, LogOut, User, ShieldCheck } from "lucide-react";
import { useState } from "react";

interface MobileMenuDrawerProps {
  panelType: "account" | "menu" | null;
  onClose: () => void;
  onOpenMyPageModal?: () => void;
  onNavigate?: () => void;
}

export function MobileMenuDrawer({
  panelType,
  onClose,
  onOpenMyPageModal,
  onNavigate,
}: MobileMenuDrawerProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [isTrendOpen, setIsTrendOpen] = useState(true);

  const isOpen = panelType !== null;

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const handleNavigation = (path: string) => {
    navigate(path);
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
  const isSavedContentsPage = location === "/saved-contents";
  const isCommunityPage = location === "/community";
  const isAIStudioPage = location === "/ai-studio";
  const isAdminPage = location === "/admin";
  const isAdmin = isAuthenticated && user?.role === "admin";

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="mobileMenuOverlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div className={`mobileMenuDrawer ${isOpen ? "open" : ""}`}>
        {/* 닫기 버튼 */}
        <button
          className="mobileMenuClose"
          onClick={onClose}
          type="button"
          aria-label="메뉴 닫기"
        >
          <X size={24} />
        </button>

        <div className="mobileDrawerContent">
          {/* 계정 패널 */}
          {panelType === "account" && (
            <>
              {isAuthenticated && user ? (
                <div className="mobileMenuSection">
                  <div className="mobileAccountCard">
                    <div className="mobileAccountHeader">
                      <div className="mobileAccountAvatar">
                        {user.name?.charAt(0).toUpperCase() || "U"}
                      </div>
                      <div className="mobileAccountInfo">
                        <div className="mobileAccountName">{user.name || "사용자"}</div>
                        {user.email && (
                          <div className="mobileAccountEmail">{user.email}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mobileMenuSectionTitle">계정</div>

                  <button
                    className="mobileMenuAction"
                    onClick={handleMyPage}
                    type="button"
                  >
                    <User size={18} />
                    <span>마이페이지</span>
                  </button>
                  {isAdmin && (
                    <button
                      className="mobileMenuAction"
                      onClick={() => handleNavigation("/admin")}
                      type="button"
                    >
                      <ShieldCheck size={18} />
                      <span>관리자 센터</span>
                    </button>
                  )}
                  <button
                    className="mobileMenuAction logout"
                    onClick={handleLogout}
                    type="button"
                  >
                    <LogOut size={18} />
                    <span>로그아웃</span>
                  </button>
                </div>
              ) : (
                <div className="mobileMenuSection">
                  <div className="mobileLoginPrompt">
                    로그인하여 모든 기능을 이용하세요
                  </div>
                  <a href={getLoginUrl()} className="mobileMenuAction">
                    <User size={18} />
                    <span>로그인</span>
                  </a>
                </div>
              )}
            </>
          )}

          {/* 메뉴 패널 */}
          {panelType === "menu" && (
            <div className="mobileMenuSection">
              <div className="mobileMenuSectionTitle">메뉴</div>

              <button
                className={`mobileNavItem ${isHomePage ? "active" : ""}`}
                onClick={() => handleNavigation("/")}
                type="button"
              >
                <Home size={18} />
                <span>홈</span>
              </button>

              {/* 실시간 트렌드 그룹 */}
              <button
                className="mobileNavItem groupTitle"
                onClick={() => setIsTrendOpen(!isTrendOpen)}
                type="button"
              >
                <span>실시간 트렌드</span>
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
                    <span>YouTube</span>
                  </button>

                  <button
                    className="mobileNavItem subNavItem"
                    onClick={() => handleNavigation("/trends/naver")}
                    type="button"
                  >
                    <span>쇼핑 인사이트</span>
                  </button>

                  <button
                    className="mobileNavItem subNavItem"
                    onClick={() => handleNavigation("#")}
                    type="button"
                  >
                    <span>Google Trends</span>
                  </button>
                </>
              )}

              <button
                className="mobileNavItem"
                onClick={() => handleNavigation("/news")}
                type="button"
              >
                <span>뉴스 &amp; 이슈</span>
              </button>

              <button
                className={`mobileNavItem ${isCommunityPage ? "active" : ""}`}
                onClick={() => handleNavigation("/community")}
                type="button"
              >
                <span>커뮤니티 반응</span>
              </button>

              <button
                className={`mobileNavItem ${isAIStudioPage ? "active" : ""}`}
                onClick={() => handleNavigation("/ai-studio")}
                type="button"
              >
                <span>AI 스튜디오</span>
              </button>

              <button
                className={`mobileNavItem ${isSavedContentsPage ? "active" : ""}`}
                onClick={() => handleNavigation("/saved-contents")}
                type="button"
              >
                <span>내 보관함</span>
              </button>

              {isAdmin && (
                <button
                  className={`mobileNavItem ${isAdminPage ? "active" : ""}`}
                  onClick={() => handleNavigation("/admin")}
                  type="button"
                >
                  <span>관리자</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
