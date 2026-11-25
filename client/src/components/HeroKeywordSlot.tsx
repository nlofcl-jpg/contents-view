import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";

type HeroKeywordSlotProps = {
  keywords: string[];
  onSelect: (keyword: string) => void;
  onMore: () => void;
};

export default function HeroKeywordSlot({ keywords, onSelect, onMore }: HeroKeywordSlotProps) {
  const [index, setIndex] = useState(0);
  const [animated, setAnimated] = useState(true);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const count = keywords.length;
  const currentIndex = count ? index % count : 0;
  const currentKeyword = keywords[currentIndex];

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setIndex(0);
    setAnimated(false);
  }, [keywords]);

  useEffect(() => {
    if (count < 2 || keyboardFocused || reducedMotion) return;
    const timer = window.setInterval(() => {
      setAnimated(true);
      setIndex(value => value + 1);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [count, keyboardFocused, reducedMotion]);

  useEffect(() => {
    if (index < count || count === 0) return;
    const timer = window.setTimeout(() => {
      setAnimated(false);
      setIndex(0);
    }, 460);
    return () => window.clearTimeout(timer);
  }, [count, index]);

  if (!currentKeyword) return null;

  return (
    <section className="heroPopularKeywordSection" aria-label="실시간 검색어">
      <p className="heroPopularKeywordTitle">실시간 검색어</p>
      <button
        type="button"
        className={`heroKeywordSlot ${count === 1 ? "isSingle" : ""}`}
        aria-label={`인기 검색어 ${currentIndex + 1}위 ${currentKeyword} 검색`}
        title={`${currentKeyword} 검색`}
        onClick={() => onSelect(currentKeyword)}
        onFocus={event => setKeyboardFocused(event.currentTarget.matches(":focus-visible"))}
        onBlur={() => setKeyboardFocused(false)}
      >
        <span className="heroKeywordSlotViewport" aria-hidden="true">
          <span className={`heroKeywordSlotTrack ${animated ? "isAnimated" : ""}`} style={{ transform: `translateY(calc(var(--keyword-slot-peek) - ${index + 1} * var(--keyword-slot-height)))` }}>
            {[keywords[count - 1], ...keywords, keywords[0], keywords[1] ?? keywords[0]].map((keyword, row) => (
              <span className="heroKeywordSlotItem" key={row}>
                <span className="heroKeywordSlotRank">{(row - 1 + count) % count + 1}</span>
                <span className="heroKeywordSlotText">{keyword}</span>
              </span>
            ))}
          </span>
        </span>
      </button>
      <div className="heroKeywordSlotActions">
        {count > 1 && reducedMotion && (
            <button type="button" className="heroKeywordSlotControl" aria-label="다음 인기 검색어" title="다음 인기 검색어" onClick={() => { setAnimated(false); setIndex((currentIndex + 1) % count); }}>
              <ChevronRight size={13} aria-hidden="true" />
            </button>
        )}
        <button type="button" className="heroPopularKeywordMore" onClick={onMore}>
          더보기
          <ChevronRight size={13} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
