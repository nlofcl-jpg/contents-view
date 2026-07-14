import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Menu } from "lucide-react";

interface HeaderProps {
  onOpenMyPageModal?: () => void;
  onOpenApiKeyModal?: () => void;
  onToggleMobileMenu?: (panelType: "menu" | "account") => void;
}

type NoticeItem = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

const NOTICE_LAST_SEEN_KEY = "contents-view-last-seen-notice-id";

export default function Header({ 
  onOpenMyPageModal, 
  onOpenApiKeyModal, 
  onToggleMobileMenu,
}: HeaderProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [openTrendMenu, setOpenTrendMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const trendMenuRef = useRef<HTMLDivElement>(null);
  const trendMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const trendItems = [
    { name: "YouTube", path: "/trends/youtube" },
    { name: "쇼핑 인사이트", path: "/trends/naver" },
    { name: "Google Trends", path: "/trends/google" },
  ];

  const latestNoticeId = notices[0]?.id ?? null;
  const lastSeenNoticeId = typeof window === "undefined"
    ? null
    : window.localStorage.getItem(NOTICE_LAST_SEEN_KEY);
  const hasUnreadNotice = Boolean(latestNoticeId && latestNoticeId !== lastSeenNoticeId);

  const loadNotices = async () => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("notices")
      .select("id,title,body,created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) {
      setNotices(data as NoticeItem[]);
    }
  };

  useEffect(() => {
    loadNotices();
    const intervalId = window.setInterval(loadNotices, 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  // 트렌드 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (trendMenuRef.current && !trendMenuRef.current.contains(event.target as Node)) {
        setOpenTrendMenu(false);
      }
    }

    if (openTrendMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openTrendMenu]);

  // Query to get YouTube API key status
  const { data: apiKeyData } = trpc.user.apiKey.getWithStatus.useQuery(
    { provider: "youtube" },
    { enabled: isAuthenticated }
  );

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isDropdownOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (noticeRef.current && !noticeRef.current.contains(event.target as Node)) {
        setIsNoticeOpen(false);
      }
    }

    if (isNoticeOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isNoticeOpen]);

  const handleTrendMenuHover = (isHovering: boolean) => {
    if (trendMenuTimeoutRef.current) {
      clearTimeout(trendMenuTimeoutRef.current);
      trendMenuTimeoutRef.current = null;
    }

    if (isHovering) {
      setOpenTrendMenu(true);
    } else {
      trendMenuTimeoutRef.current = setTimeout(() => {
        setOpenTrendMenu(false);
      }, 200);
    }
  };

  const handleTrendItemClick = (path: string) => {
    if (path !== "#") {
      setLocation(path);
      setOpenTrendMenu(false);
    }
  };

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    await logout();
  };

  const handleMyPage = () => {
    setIsDropdownOpen(false);
    onOpenMyPageModal?.();
  };

  const handleApiKeySetting = () => {
    setIsDropdownOpen(false);
    onOpenApiKeyModal?.();
  };

  const handleLogoClick = () => {
    setLocation('/');
  };

  const handleYouTubeApiStatusClick = () => {
    onOpenApiKeyModal?.();
  };

  const handleNoticeClick = () => {
    const nextOpen = !isNoticeOpen;
    setIsNoticeOpen(nextOpen);

    if (!isNoticeOpen && latestNoticeId) {
      window.localStorage.setItem(NOTICE_LAST_SEEN_KEY, latestNoticeId);
    }
  };

  // Determine YouTube API status based on actual connection test result
  const getYouTubeApiStatus = () => {
    if (!isAuthenticated) return null;
    
    // No API Key saved
    if (!apiKeyData?.exists) {
      return { text: "YouTube API 설정 필요", status: "missing", color: "text-red-400" };
    }
    
    // Connection test successful
    if (apiKeyData?.testStatus === "success") {
      return { text: "YouTube API 연결 완료", status: "success", color: "text-emerald-400" };
    }
    
    // Connection test failed (or any other status)
    return { text: "YouTube API Key 오류", status: "failed", color: "text-red-400" };
  };

  const youtubeStatus = getYouTubeApiStatus();
  const isAdmin = isAuthenticated && user?.role === "admin";

  return (
    <header className="header">
      <div className="headerContentWrapper">
        {/* 모바일: 왼쪽 메뉴 버튼 */}
        <div className="mobileMenuButtonWrapper">
          <button
            className="mobileMenuButton mobileMenuButtonLeft"
            onClick={() => onToggleMobileMenu?.("menu")}
            type="button"
            aria-label="메뉴"
          >
            <Menu size={24} />
          </button>
        </div>

        {/* 로고 중앙 배치 */}
        <div className="headerBrandWrapper">
          <button
            className="headerBrand headerBrandCenter"
            onClick={handleLogoClick}
            type="button"
            aria-label="홈으로 이동"
            title="홈으로 이동"
          >
            <img src="/contents-view-symbol.png" alt="CONTENTS VIEW" className="headerBrandLogo" />
            <span className="headerBrandText">CONTENTS <strong>VIEW</strong></span>
          </button>
        </div>

        {/* 헤더 중앙 네비게이션 메뉴 */}
        <nav className="headerNavMenu desktopOnly">
        <div 
          className="headerNavItem"
          ref={trendMenuRef}
          onMouseEnter={() => handleTrendMenuHover(true)}
          onMouseLeave={() => handleTrendMenuHover(false)}
        >
          <button 
            type="button"
            className="headerNavButton"
            onClick={() => setOpenTrendMenu(!openTrendMenu)}
          >
            실시간 트렌드
          </button>
          {openTrendMenu && (
            <div className="headerNavDropdown" onMouseEnter={() => handleTrendMenuHover(true)} onMouseLeave={() => handleTrendMenuHover(false)}>
              {trendItems.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  className="headerNavDropdownItem"
                  onClick={() => handleTrendItemClick(item.path)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <Link href="/news" className={`headerNavItem headerNavLink ${location === "/news" ? "active" : ""}`}>
          뉴스&이슈
        </Link>

        <a href="/community" className={`headerNavItem headerNavLink ${location === "/community" ? "active" : ""}`}>
          커뮤니티 반응
        </a>

        <a href="/ai-studio" className={`headerNavItem headerNavLink ${location === "/ai-studio" ? "active" : ""}`}>
          AI 스튜디오
        </a>

        <a href="/saved-contents" className={`headerNavItem headerNavLink ${location === "/saved-contents" ? "active" : ""}`}>
          내 보관함
        </a>
        {isAdmin && (
          <a href="/admin" className={`headerNavItem headerNavLink ${location === "/admin" ? "active" : ""}`}>
            관리자
          </a>
        )}
        </nav>

        {/* 모바일: 오른쪽 프로필 영역 */}
        <div className="mobileProfileWrapper">
          {isAuthenticated && user ? (
            <button
              className="mobileAvatarButton"
              onClick={() => onToggleMobileMenu?.("account")}
              type="button"
              title="프로필 메뉴"
            >
              <div className="mobileAvatar">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </div>
            </button>
          ) : (
            <a href={getLoginUrl()} className="mobileLoginButton">
              <div className="mobileAvatar">G</div>
            </a>
          )}
        </div>

        {/* 오른쪽 영역 */}
        <div className="headerRight">
          {/* 데스크톡: YouTube API 상태 표시 */}
          {youtubeStatus && (
          <button
            className="youtubeApiStatus desktopOnly"
            onClick={handleYouTubeApiStatusClick}
            type="button"
            title="YouTube API 상태"
          >
            <span className={`youtubeApiStatusDot ${youtubeStatus.status}`}></span>
            <span className={`youtubeApiStatusText ${youtubeStatus.color}`}>
              {youtubeStatus.text}
            </span>
          </button>
          )}

          {/* 데스크톡: 알림 아이콘 */}
          <div className="notificationArea desktopOnly" ref={noticeRef}>
            <button
              className="notificationButton"
              type="button"
              aria-label="공지사항"
              onClick={handleNoticeClick}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {hasUnreadNotice && <span className="notificationUnreadDot" />}
            </button>
            {isNoticeOpen && (
              <div className="noticePopover">
                <div className="noticePopoverHeader">공지사항</div>
                {notices.length > 0 ? (
                  <div className="noticeList">
                    {notices.map(notice => (
                      <article key={notice.id} className="noticeItem">
                        <div className="noticeItemTitle">{notice.title}</div>
                        <div className="noticeItemBody">{notice.body}</div>
                        <time className="noticeItemDate">
                          {new Date(notice.created_at).toLocaleDateString("ko-KR")}
                        </time>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="noticeEmpty">등록된 공지가 없습니다.</div>
                )}
              </div>
            )}
          </div>

          {/* 데스크톡: 프로필 영역 */}
          <div className="profileArea desktopOnly" ref={dropdownRef}>
            {isAuthenticated && user ? (
              <>
                <button
                className="avatarButton"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                type="button"
                title="프로필 메뉴"
              >
                <div className="avatar">
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </div>
              </button>
              <button
                className="profileText"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                type="button"
                title="프로필 메뉴"
              >
                {user.name || "사용자"}
              </button>
              {isDropdownOpen && (
                <div className="profileDropdown">
                  {onOpenMyPageModal ? (
                    <button
                      className="dropdownItem"
                      onClick={handleMyPage}
                      type="button"
                    >
                      마이페이지
                    </button>
                  ) : (
                    <a href="/mypage" className="dropdownItem">
                      마이페이지
                    </a>
                  )}
                  <button
                    className="dropdownItem"
                    onClick={handleApiKeySetting}
                    type="button"
                  >
                    API 키 설정
                  </button>
                  {isAdmin && (
                    <a href="/admin" className="dropdownItem">
                      관리자 센터
                    </a>
                  )}
                  <button
                    className="dropdownItem dropdownLogout"
                    onClick={handleLogout}
                    type="button"
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <button
                className="avatarButton"
                type="button"
                title="로그인"
              >
                <div className="avatar">G</div>
              </button>
              <a href={getLoginUrl()} className="profileText">
                로그인
              </a>
            </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
