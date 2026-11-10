import { Link, useLocation } from "wouter";
import { getActiveNewsPath, newsLinks } from "@/lib/newsNavigation";

export default function SectionSubnav({ placement = "top" }: { placement?: "top" | "pageHeader" }) {
  const [location] = useLocation();
  const path = location.split("?")[0].replace(/\/$/, "") || "/";
  const isNews = path === "/news" || path.startsWith("/news/");
  if (!isNews) return null;
  const isNewsIndex = newsLinks.some(link => link.href === path);
  if (isNewsIndex !== (placement === "pageHeader")) return null;

  const selectedPath = getActiveNewsPath(path);
  return (
    <nav className="studioSubnav sectionSubnav newsSectionSubnav" aria-label="뉴스 트렌드 하위 메뉴">
      {newsLinks.map(link => (
        <Link key={link.href} href={link.href} className={`studioSubnavLink${selectedPath === link.href ? " active" : ""}`} aria-current={selectedPath === link.href ? "page" : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
