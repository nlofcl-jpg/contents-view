import { useEffect, useState } from "react";

const SCROLL_THRESHOLD = 14;

export function useMobileNavScroll(keepVisible = false) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (keepVisible) {
      setHidden(false);
      return;
    }

    const mobile = window.matchMedia("(width < 768px)");
    const main = document.querySelector(".mainContent");
    const root = document.scrollingElement;
    const offsets = new Map<Element, number>();
    let scroller: Element | null = null;
    let travel = 0;
    const getOffset = (element: Element) => Math.max(0, Math.min(element.scrollTop, element.scrollHeight - element.clientHeight));
    const resetOffsets = () => {
      if (root) offsets.set(root, getOffset(root));
      if (main) offsets.set(main, getOffset(main));
    };
    resetOffsets();

    const handleScroll = (event: Event) => {
      if (!mobile.matches) return;
      const target = event.target === document ? root : event.target === main ? main : null;
      if (!target) return;

      const offset = getOffset(target);
      if (scroller !== target) {
        scroller = target;
        travel = 0;
      }
      const delta = offset - (offsets.get(target) ?? offset);
      offsets.set(target, offset);

      if (offset <= SCROLL_THRESHOLD) {
        travel = 0;
        setHidden(false);
      } else if (delta) {
        travel = Math.sign(travel) === Math.sign(delta) ? travel + delta : delta;
        if (Math.abs(travel) >= SCROLL_THRESHOLD) {
          setHidden(travel > 0);
          travel = 0;
        }
      }
    };

    const reset = () => {
      scroller = null;
      resetOffsets();
      setHidden(false);
    };
    document.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    mobile.addEventListener("change", reset);
    return () => {
      document.removeEventListener("scroll", handleScroll, true);
      mobile.removeEventListener("change", reset);
    };
  }, [keepVisible]);

  return hidden && !keepVisible;
}
