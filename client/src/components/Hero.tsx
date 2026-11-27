import { ArrowUp, Plus, X } from "lucide-react";
import HeroKeywordSlot from "@/components/HeroKeywordSlot";
import HeroAiChat from "@/components/HeroAiChat";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useGoogleLiveRanking } from "@/lib/useLiveSearchRankings";
import { useAuth } from "@/_core/hooks/useAuth";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import { SearchGlowForm } from "@/components/SearchGlowForm";
import VoiceSearchButton from "@/components/VoiceSearchButton";
import { heroAnalysisLabels, type HeroAnalysisPlatform } from "@/lib/heroAnalysis";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const aiPlatform = { value: "ai", label: "AI 모드", className: "isAi" } as const;

const searchPlatforms = [
  { value: "youtube", label: "YOUTUBE", className: "isYoutube" },
  { value: "naver", label: "NAVER", className: "isNaver" },
  { value: "news", label: "뉴스", className: "isNews" },
] as const;

const chatSearchPlatforms = [...searchPlatforms.map(platform => ({ ...platform, label: heroAnalysisLabels[platform.value] })),
  { value: "shopping", label: heroAnalysisLabels.shopping, className: "isNaver" },
] as const;

type HeroPlatform = { value: HeroAnalysisPlatform; label: string; className: string } | typeof aiPlatform;

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
  const aiEntryButtonRef = useRef<HTMLButtonElement>(null);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);
  const submitOpeningAnalysisRef = useRef(false);
  const searchFormRef = useRef<HTMLFormElement>(null);
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [selectedPlatform, setSelectedPlatform] = useState<HeroPlatform | null>(null);
  const [isAiPageOpen, setIsAiPageOpen] = useState(false);
  const [isHomeInputExpanded, setIsHomeInputExpanded] = useState(false);
  const [aiEntryOrigin, setAiEntryOrigin] = useState<DOMRectReadOnly | null>(null);
  const [keyword, setKeyword] = useState("");
  const [guestKeyword, setGuestKeyword] = useState<string | null>(null);
  const isAiMode = selectedPlatform?.value === "ai";
  const displayedPlatform = selectedPlatform?.value === "ai" ? null : selectedPlatform;
  const { ranking: googleRanking } = useGoogleLiveRanking();
  const popularKeywords = useMemo(
    () => googleRanking.slice(0, 7).map(item => item.keyword),
    [googleRanking]
  );

  useLayoutEffect(() => {
    const hero = heroRef.current;
    const backdrop = backdropRef.current;
    if (!hero || !backdrop) return;
    const scroller = hero.closest<HTMLElement>(".mainContent");

    // Anchor the backdrop to the hero's unscrolled position.
    const updateBounds = () => {
      const bounds = hero.getBoundingClientRect();
      const top = bounds.top + (scroller?.scrollTop ?? window.scrollY);
      const slideOffset = scroller ? Number.parseFloat(getComputedStyle(scroller).left) || 0 : 0;
      backdrop.style.top = `${top}px`;
      backdrop.style.left = `${bounds.left + (scroller?.scrollLeft ?? window.scrollX) - slideOffset}px`;
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

  useEffect(() => {
    if (!isAiPageOpen || !submitOpeningAnalysisRef.current) return;
    submitOpeningAnalysisRef.current = false;
    aiInputRef.current?.form?.requestSubmit();
  }, [isAiPageOpen]);

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

  const getSearchPath = (searchKeyword: string) => {
    const trimmedKeyword = searchKeyword.trim();
    const platform = selectedPlatform?.value;

    if (platform === "news") {
      return `/news/search?keyword=${encodeURIComponent(trimmedKeyword)}`;
    }

    if (platform === "youtube") return "/";

    return `/trends/naver?keyword=${encodeURIComponent(trimmedKeyword)}`;
  };

  const handleHeroSearch = (searchKeyword = keyword) => {
    if (!searchKeyword.trim()) return;
    if (selectedPlatform?.value === "youtube") {
      setKeyword(searchKeyword);
      submitOpeningAnalysisRef.current = true;
      setAiEntryOrigin(searchFormRef.current?.getBoundingClientRect() ?? null);
      setIsAiPageOpen(true);
      return;
    }
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

  const goToGuestAuth = () => {
    const params = new URLSearchParams();
    if (guestKeyword) params.set("redirect", getSearchPath(guestKeyword));
    setGuestKeyword(null);
    setLocation(`/login?${params.toString()}`);
  };

  const selectPlatform = (value: string) => {
    const platforms = isAiPageOpen ? chatSearchPlatforms : searchPlatforms;
    const platform = value === aiPlatform.value ? aiPlatform : platforms.find(item => item.value === value);
    if (!platform) return;
    setSelectedPlatform(platform);
    if (platform.value === "ai" && !isAiPageOpen) {
      setAiEntryOrigin(searchFormRef.current?.getBoundingClientRect() ?? null);
      setIsAiPageOpen(true);
    }
  };

  const clearPlatform = () => {
    setSelectedPlatform(isAiPageOpen ? aiPlatform : null);
    requestAnimationFrame(() => platformTriggerRef.current?.focus());
  };

  const closeAiPage = () => {
    setIsAiPageOpen(false);
    setIsHomeInputExpanded(false);
    setSelectedPlatform(null);
    setAiEntryOrigin(null);
    requestAnimationFrame(() => aiEntryButtonRef.current?.focus({ preventScroll: true }));
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
                placeholder={isAiMode ? "질문을 입력하세요." : "분석할 키워드를 입력하세요."}
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
                onFocus={() => setIsHomeInputExpanded(true)}
                onChange={event => setKeyword(event.target.value)}
                placeholder={isHomeInputExpanded ? "분석할 플랫폼을 선택 후 키워드를 입력하세요" : "키워드를 입력하세요."}
                aria-label="분석할 키워드"
              />
            )}
            <div className="heroSearchActions">
              <div className="heroSearchPlatformControls">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger
                    ref={platformTriggerRef}
                    className={`heroSearchFilterButton ${displayedPlatform?.className ?? "isUnselected"}`}
                    aria-label={displayedPlatform ? `분석 플랫폼 선택: ${displayedPlatform.label}` : "분석 플랫폼 선택"}
                    title="분석 플랫폼 선택"
                  >
                    <Plus size={18} aria-hidden="true" />
                    {displayedPlatform && <span>{displayedPlatform.label}</span>}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={8} collisionPadding={12} className={`heroSearchMenu ${isAiPageOpen ? "heroAiPlatformMenu" : "heroHomePlatformMenu"}`} aria-label="분석 플랫폼">
                    <DropdownMenuRadioGroup
                      value={displayedPlatform?.value ?? ""}
                      onValueChange={selectPlatform}
                    >
                      {(isAiPageOpen ? chatSearchPlatforms : searchPlatforms).map(platform => (
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
                {displayedPlatform && (
                  <button
                    type="button"
                    className="heroSearchClearPlatform"
                    aria-label={`${displayedPlatform.label} 선택 취소`}
                    title="플랫폼 선택 취소"
                    onClick={clearPlatform}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="heroSearchRightActions flex items-center gap-1">
                <VoiceSearchButton onTranscript={text => setKeyword(value => [value.trimEnd(), text].filter(Boolean).join(" "))} />
                {!isAiPageOpen && !selectedPlatform ? (
                  <button ref={aiEntryButtonRef} type="button" className="heroSearchButton heroAiEntryButton text-xs font-semibold" onClick={() => selectPlatform("ai")} aria-label="AI 모드 열기" title="AI 모드 열기">
                    AI
                  </button>
                ) : (
                  <button type="submit" className={`heroSearchButton${isAiMode ? " heroAiSendButton" : ""}`} aria-label={isAiMode ? "질문 보내기" : "분석"} title={isAiMode ? "질문 보내기" : "분석"} disabled={sendDisabled}>
                    <ArrowUp size={19} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
            </>
  );

  if (isAiPageOpen) {
    return <HeroAiChat input={keyword} setInput={setKeyword} renderInput={renderInput} analysisPlatform={displayedPlatform?.value} onClose={closeAiPage} entryOrigin={aiEntryOrigin} />;
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
          <SearchGlowForm ref={searchFormRef} className="heroSearch heroHomeSearch" data-expanded={isHomeInputExpanded} role="search" aria-label="트렌드 분석" onSubmit={event => {
            event.preventDefault();
            if (!selectedPlatform) {
              if (keyword.trim()) selectPlatform("ai");
              return;
            }
            handleHeroSearch();
          }}>
            {renderInput(!keyword.trim())}
          </SearchGlowForm>
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
        onLogin={goToGuestAuth}
      />
    </section>
    </>
  );
}
