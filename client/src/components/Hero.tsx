import { ChevronDown, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { readHeroKeywords } from "@/lib/heroKeywords";

const searchPlatforms = [
  { value: "naver", label: "NAVER", className: "isNaver" },
  { value: "news", label: "뉴스", className: "isNews" },
  { value: "youtube", label: "YOUTUBE", className: "isYoutube" },
  { value: "google", label: "GOOGLE", className: "isGoogle" },
];

export default function Hero() {
  const [, setLocation] = useLocation();
  const [selectedPlatform, setSelectedPlatform] = useState(searchPlatforms[0]);
  const [isPlatformMenuOpen, setIsPlatformMenuOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [popularKeywords, setPopularKeywords] = useState<string[]>([]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.from("hero_search_settings").select("keywords").eq("id", 1).maybeSingle()
      .then(({ data }) => {
        if (active) setPopularKeywords(readHeroKeywords(data?.keywords));
      });
    return () => { active = false; };
  }, []);

  const handleHeroSearch = (searchKeyword = keyword) => {
    const trimmedKeyword = searchKeyword.trim();
    if (!trimmedKeyword) return;

    if (selectedPlatform.value === "naver") {
      setLocation(`/trends/naver?keyword=${encodeURIComponent(trimmedKeyword)}`);
      return;
    }

    if (selectedPlatform.value === "news") {
      setLocation(`/news/search?keyword=${encodeURIComponent(trimmedKeyword)}`);
      return;
    }

    if (selectedPlatform.value === "youtube") {
      setLocation(`/trends/youtube?tab=analysis&keyword=${encodeURIComponent(trimmedKeyword)}`);
      return;
    }

    setLocation(`/trends/google?trend=${encodeURIComponent(trimmedKeyword)}`);
  };

  return (
    <section className={`hero${isPlatformMenuOpen ? " heroMenuOpen" : ""}`}>
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="heroCopy">
          <p className="heroKicker">TRACK. ANALYZE. DISCOVER.</p>

          <h2>
            다양한 컨텐츠 트렌드를
            <br />
            <span>실시간으로</span> 확인하세요
          </h2>

          <div className="heroSearch" role="search" aria-label="트렌드 키워드 검색">
            <div
              className="heroSearchFilter"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setIsPlatformMenuOpen(false);
                }
              }}
            >
              <button
                type="button"
                className={`heroSearchFilterButton ${selectedPlatform.className}`}
                aria-haspopup="listbox"
                aria-expanded={isPlatformMenuOpen}
                onClick={() => setIsPlatformMenuOpen((current) => !current)}
              >
                <span>{selectedPlatform.label}</span>
                <ChevronDown className="heroSearchFilterIcon" aria-hidden="true" />
              </button>
              {isPlatformMenuOpen ? (
                <div className="heroSearchMenu" role="listbox" aria-label="검색 플랫폼 선택">
                  {searchPlatforms.map((platform) => (
                    <button
                      key={platform.value}
                      type="button"
                      className={`heroSearchMenuItem ${platform.className}`}
                      role="option"
                      aria-selected={selectedPlatform.value === platform.value}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setSelectedPlatform(platform);
                        setIsPlatformMenuOpen(false);
                      }}
                    >
                      {platform.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="heroSearchDivider" aria-hidden="true" />
            <input
              type="text"
              className="heroSearchInput"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleHeroSearch();
                }
              }}
              placeholder="분석할 키워드를 입력하세요"
              aria-label="분석할 키워드"
            />
            <button type="button" className="heroSearchButton" aria-label="검색" onClick={() => handleHeroSearch()}>
              <Search className="heroSearchIcon" aria-hidden="true" />
            </button>
          </div>
          {popularKeywords.length > 0 && (
            <div className="heroPopularKeywords" aria-label="인기 검색어">
              {popularKeywords.map(popularKeyword => (
                <button
                  key={popularKeyword}
                  type="button"
                  className="heroPopularKeyword"
                  title={`${popularKeyword} 검색`}
                  onClick={() => handleHeroSearch(popularKeyword)}
                >
                  #{popularKeyword}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
