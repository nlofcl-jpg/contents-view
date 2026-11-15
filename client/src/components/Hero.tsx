import { ArrowUp, ChevronRight, Plus, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { readHeroKeywords } from "@/lib/heroKeywords";
import { useAuth } from "@/_core/hooks/useAuth";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const searchPlatforms = [
  { value: "naver", label: "NAVER", className: "isNaver" },
  { value: "news", label: "뉴스", className: "isNews" },
  { value: "youtube", label: "YOUTUBE", className: "isYoutube" },
  { value: "google", label: "GOOGLE", className: "isGoogle" },
];

export default function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const platformTriggerRef = useRef<HTMLButtonElement>(null);
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [selectedPlatform, setSelectedPlatform] = useState<(typeof searchPlatforms)[number] | null>(null);
  const [keyword, setKeyword] = useState("");
  const [popularKeywords, setPopularKeywords] = useState<string[]>([]);
  const [guestKeyword, setGuestKeyword] = useState<string | null>(null);

  useLayoutEffect(() => {
    const hero = heroRef.current;
    const backdrop = backdropRef.current;
    if (!hero || !backdrop) return;
    const scroller = hero.closest<HTMLElement>(".mainContent");

    // Anchor the backdrop to the hero's unscrolled position.
    const updateBounds = () => {
      const bounds = hero.getBoundingClientRect();
      const top = bounds.top + (scroller?.scrollTop ?? window.scrollY);
      backdrop.style.top = `${top}px`;
      backdrop.style.left = `${bounds.left + (scroller?.scrollLeft ?? window.scrollX)}px`;
      backdrop.style.width = `${bounds.width}px`;
      backdrop.style.height = `${bounds.height}px`;
      backdrop.style.setProperty("--hero-backdrop-clip-top", `${(scroller?.getBoundingClientRect().top ?? 0) - top}px`);
      backdrop.style.visibility = "visible";
    };

    const observer = new ResizeObserver(updateBounds);
    observer.observe(hero);
    if (scroller) observer.observe(scroller);
    updateBounds();
    window.addEventListener("resize", updateBounds);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateBounds);
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.from("hero_search_settings").select("keywords").eq("id", 1).maybeSingle()
      .then(({ data }) => {
        if (active) setPopularKeywords(readHeroKeywords(data?.keywords).slice(0, 7));
      });
    return () => { active = false; };
  }, []);

  const getSearchPath = (searchKeyword: string) => {
    const trimmedKeyword = searchKeyword.trim();
    const platform = selectedPlatform?.value ?? "naver";
    if (platform === "naver") {
      return `/trends/naver?keyword=${encodeURIComponent(trimmedKeyword)}`;
    }

    if (platform === "news") {
      return `/news/search?keyword=${encodeURIComponent(trimmedKeyword)}`;
    }

    if (platform === "youtube") {
      return `/trends/youtube?tab=analysis&keyword=${encodeURIComponent(trimmedKeyword)}`;
    }

    return `/trends/google?trend=${encodeURIComponent(trimmedKeyword)}`;
  };

  const handleHeroSearch = (searchKeyword = keyword) => {
    if (!searchKeyword.trim()) return;
    setLocation(getSearchPath(searchKeyword));
  };

  const handlePopularKeywordClick = (searchKeyword: string) => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setGuestKeyword(searchKeyword);
      return;
    }
    handleHeroSearch(searchKeyword);
  };

  const goToGuestAuth = (mode: "login" | "signup") => {
    const params = new URLSearchParams();
    if (mode === "signup") params.set("mode", "signup");
    if (guestKeyword) params.set("redirect", getSearchPath(guestKeyword));
    setGuestKeyword(null);
    setLocation(`/login?${params.toString()}`);
  };

  return (
    <>
    <div ref={backdropRef} className="heroBackdrop" aria-hidden="true" />
    <section ref={heroRef} className="hero">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="heroCopy">
          <p className="heroKicker">TRACK. ANALYZE. DISCOVER.</p>

          <h2>
            다양한 컨텐츠 트렌드를
            <br />
            <span>실시간으로</span> 확인하세요
          </h2>

          <form
            className="heroSearch"
            role="search"
            aria-label="트렌드 분석"
            onSubmit={event => {
              event.preventDefault();
              handleHeroSearch();
            }}
          >
            <input
              type="text"
              className="heroSearchInput"
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
              placeholder="분석할 플랫폼을 선택 후 키워드를 입력하세요"
              aria-label="분석할 키워드"
            />
            <div className="heroSearchActions">
              <div className="heroSearchPlatformControls">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger
                    ref={platformTriggerRef}
                    className={`heroSearchFilterButton ${selectedPlatform?.className ?? "isUnselected"}`}
                    aria-label={selectedPlatform ? `분석 플랫폼 선택: ${selectedPlatform.label}` : "분석 플랫폼 선택"}
                    title="분석 플랫폼 선택"
                  >
                    <Plus size={18} aria-hidden="true" />
                    {selectedPlatform && <span>{selectedPlatform.label}</span>}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={8} collisionPadding={12} className="heroSearchMenu" aria-label="분석 플랫폼">
                    <DropdownMenuRadioGroup
                      value={selectedPlatform?.value ?? ""}
                      onValueChange={value => {
                        const platform = searchPlatforms.find(item => item.value === value);
                        if (platform) setSelectedPlatform(platform);
                      }}
                    >
                      {searchPlatforms.map(platform => (
                        <DropdownMenuRadioItem
                          key={platform.value}
                          value={platform.value}
                          className={`heroSearchMenuItem ${platform.className}`}
                        >
                          {platform.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                {selectedPlatform && (
                  <button
                    type="button"
                    className="heroSearchClearPlatform"
                    aria-label={`${selectedPlatform.label} 선택 취소`}
                    title="플랫폼 선택 취소"
                    onClick={() => {
                      setSelectedPlatform(null);
                      platformTriggerRef.current?.focus();
                    }}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              <button type="submit" className="heroSearchButton" aria-label="분석" title="분석" disabled={!keyword.trim()}>
                <ArrowUp size={19} aria-hidden="true" />
              </button>
            </div>
          </form>
          {popularKeywords.length > 0 && (
            <div className="heroPopularKeywordSection" aria-labelledby="heroPopularKeywordTitle">
              <p id="heroPopularKeywordTitle" className="heroPopularKeywordTitle">인기 검색어</p>
              <div className="heroPopularKeywordRow">
              <div className="heroPopularKeywords">
                {popularKeywords.map(popularKeyword => (
                  <button
                    key={popularKeyword}
                    type="button"
                    className="heroPopularKeyword"
                    title={`${popularKeyword} 검색`}
                    onClick={() => handlePopularKeywordClick(popularKeyword)}
                  >
                    #{popularKeyword}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="heroPopularKeywordMore"
                onClick={() => setLocation("/trends/google")}
              >
                더보기
                <ChevronRight size={14} aria-hidden="true" />
              </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <GuestAccessPrompt
        open={guestKeyword !== null}
        onBrowse={() => setGuestKeyword(null)}
        onLogin={() => goToGuestAuth("login")}
        onSignup={() => goToGuestAuth("signup")}
      />
    </section>
    </>
  );
}
