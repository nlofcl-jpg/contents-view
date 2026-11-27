import { getStudioActiveHref, studioLinks } from "@/lib/studioNavigation";
import { Link, useLocation, useSearch } from "wouter";

export default function StudioSubnav() {
  const [location] = useLocation();
  const path = location.replace(/\/$/, "");
  const activeHref = getStudioActiveHref(path, useSearch());
  return (
    <nav className="tabMenu youtubeTabMenu studioSubnav" aria-label="스튜디오 하위 메뉴">
      {studioLinks.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`tabButton${activeHref === href ? " active" : ""}`}
          aria-current={activeHref === href ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
