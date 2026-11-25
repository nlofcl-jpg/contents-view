import { useId, useState, type ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

function SearchBorderGlow() {
  const id = useId();
  const track = `${id}-track`;
  const colors = `${id}-colors`;
  const beam = `${id}-beam`;
  return (
    <svg className="searchBorderGlow" aria-hidden="true" focusable="false">
      <defs>
        <rect id={track} className="searchBorderGlowTrack" pathLength="100" fill="none" />
        <linearGradient id={colors} x1="0%" y1="0%" x2="100%" y2="35%">
          <stop offset="0%" stopColor="#566fd6" />
          <stop offset="26%" stopColor="#a862c1" />
          <stop offset="54%" stopColor="#dc554a" />
          <stop offset="82%" stopColor="#ecaa4b" />
          <stop offset="100%" stopColor="#a3ca68" />
        </linearGradient>
        <mask id={beam} x="-25%" y="-100%" width="150%" height="300%">
          <use href={`#${track}`} className="searchBorderGlowBeam" stroke="white" strokeWidth="46" strokeLinecap="round" />
        </mask>
      </defs>
      <g mask={`url(#${beam})`} stroke={`url(#${colors})`}>
        <use href={`#${track}`} className="searchBorderGlowHalo" strokeWidth="9" />
        <use href={`#${track}`} className="searchBorderGlowEdge" strokeWidth="1.1" />
      </g>
    </svg>
  );
}

export function SearchGlowForm({ children, className, onClick, ...props }: ComponentPropsWithRef<"form">) {
  const [glowRun, setGlowRun] = useState(0);
  return (
    <form {...props} className={cn("searchGlowForm", className)} onClick={event => {
      onClick?.(event);
      const target = event.target;
      if (!event.defaultPrevented && target instanceof HTMLInputElement && ["text", "search", "url"].includes(target.type)) {
        setGlowRun(run => run + 1);
      }
    }}>
      {glowRun > 0 && <SearchBorderGlow key={glowRun} />}
      {children}
    </form>
  );
}
