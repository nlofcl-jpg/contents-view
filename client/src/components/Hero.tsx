import { ArrowUp, Plus, X } from "lucide-react";
import HeroKeywordSlot from "@/components/HeroKeywordSlot";
import HeroAiChat from "@/components/HeroAiChat";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { readHeroKeywords } from "@/lib/heroKeywords";
import { useAuth } from "@/_core/hooks/useAuth";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import VoiceSearchButton from "@/components/VoiceSearchButton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const aiPlatform = { value: "ai", label: "AI 모드", className: "isAi" };

const searchPlatforms = [
  { value: "youtube", label: "YOUTUBE", className: "isYoutube" },
  { value: "naver", label: "NAVER", className: "isNaver" },
  { value: "google", label: "GOOGLE", className: "isGoogle" },
  { value: "news", label: "뉴스", className: "isNews" },
  aiPlatform,
];

function resizeAiInput(input: HTMLTextAreaElement) {
  const scrollTop = input.scrollTop;
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
  input.scrollTop = scrollTop;
}

export default function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const platformTriggerRef = useRef<HTMLButtonElement>(null);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [selectedPlatform, setSelectedPlatform] = useState<(typeof searchPlatforms)[number] | null>(null);
  const [isAiPageOpen, setIsAiPageOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [popularKeywords, setPopularKeywords] = useState<string[]>([]);
  const [guestKeyword, setGuestKeyword] = useState<string | null>(null);
  const isAiMode = selectedPlatform?.value === "ai";

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
  }, [isAiPageOpen]);

  useLayoutEffect(() => {
    const input = aiInputRef.current;
    if (input) resizeAiInput(input);
  }, [isAiPageOpen, keyword]);

  useLayoutEffect(() => {
    const input = aiInputRef.current;
    if (!input) return;
    let width = input.clientWidth;
    const observer = new ResizeObserver(() => {
      if (input.clientWidth === width) return;
      width = input.clientWidth;
      resizeAiInput(input);
    });
    observer.observe(input, { box: "border-box" });
    return () => observer.disconnect();
  }, [isAiPageOpen]);

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
    const platform = isAiMode ? "naver" : selectedPlatform?.value ?? "naver";
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

  const selectPlatform = (value: string) => {
    const platform = searchPlatforms.find(item => item.value === value);
    if (!platform) return;
    setSelectedPlatform(platform);
    if (platform.value === "ai") setIsAiPageOpen(true);
  };

  const clearPlatform = () => {
    if (isAiPageOpen && !isAiMode) {
      setSelectedPlatform(aiPlatform);
    } else {
      setSelectedPlatform(null);
      setIsAiPageOpen(false);
    }
    requestAnimationFrame(() => platformTriggerRef.current?.focus());
  };

  const renderInput = (sendDisabled: boolean) => (
            <>
            {isAiPageOpen ? (
              <textarea
                ref={aiInputRef}
                className="heroSearchInput heroAiInput"
                rows={1}
                maxLength={2000}
                value={keyword}
                onChange={event => setKeyword(event.target.value)}
                placeholder={isAiMode ? "질문을 입력하세요." : selectedPlatform?.value === "youtube" ? "유튜브 키워드 또는 URL을 입력하세요." : "검색할 키워드를 입력하세요."}
                aria-label={isAiMode ? "Gemini에게 보낼 질문" : "분석할 키워드"}
                onKeyDown={event => {
                  if (event.key !== "Enter" || event.nativeEvent.isComposing || event.shiftKey) return;
                  event.preventDefault();
                  if (!sendDisabled && !event.ctrlKey && !event.metaKey && !event.altKey) {
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
            ) : (
              <input
                type="text"
                className="heroSearchInput"
                value={keyword}
                onChange={event => setKeyword(event.target.value)}
                placeholder="분석할 플랫폼을 선택 후 키워드를 입력하세요"
                aria-label="분석할 키워드"
              />
            )}
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
                      onValueChange={selectPlatform}
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
                    onClick={clearPlatform}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <VoiceSearchButton onTranscript={text => setKeyword(value => [value.trimEnd(), text].filter(Boolean).join(" "))} />
                <button type="submit" className="heroSearchButton" aria-label={isAiMode ? "질문 보내기" : "분석"} title={isAiMode ? "질문 보내기" : "분석"} disabled={sendDisabled}>
                  <ArrowUp size={19} aria-hidden="true" />
                </button>
              </div>
            </div>
            </>
  );

  if (isAiPageOpen) {
    return <HeroAiChat input={keyword} setInput={setKeyword} renderInput={renderInput} onAnalyze={isAiMode ? undefined : handleHeroSearch} />;
  }

  return (
    <>
    <div ref={backdropRef} className="heroBackdrop" aria-hidden="true" />
    <section ref={heroRef} className="hero">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="heroCopy">
          <p className="heroKicker">CONTENT · COMMERCE · MARKETING</p>
          <h2>
            다양한 콘텐츠와 트렌드를
            <br />
            한곳에서 확인하고 <span>새로운 기회로</span>
          </h2>
          <form className="heroSearch" role="search" aria-label="트렌드 분석" onSubmit={event => {
            event.preventDefault();
            handleHeroSearch();
          }}>
            {renderInput(!keyword.trim())}
          </form>
          {popularKeywords.length > 0 && (
            <HeroKeywordSlot
              keywords={popularKeywords}
              onSelect={handlePopularKeywordClick}
              onMore={() => setLocation("/trends/google")}
            />
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
