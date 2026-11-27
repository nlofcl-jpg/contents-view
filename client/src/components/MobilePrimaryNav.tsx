import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createLucideIcon, LayoutGrid, Newspaper } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { commerceLinks, getCommerceTab } from "@/lib/commerceNavigation";
import { newsLinks } from "@/lib/newsNavigation";
import { studioLinks, studioProgramsHref } from "@/lib/studioNavigation";
import { cn } from "@/lib/utils";

type MenuItem = { label: string; href: string };
type MenuGroup = { title: string; pages: readonly MenuItem[] };

const studioGroup = { title: "스튜디오", pages: studioLinks };

const contentGroups: MenuGroup[] = [
  { title: "크리에이터", pages: [
    { label: "유튜브 트렌드", href: "/trends/youtube" },
    { label: "네이버 트렌드", href: "/trends/naver" },
    { label: "커뮤니티 트렌드", href: "/community" },
    { label: "검색어", href: "/trends/google" },
  ] },
  { title: "뉴스", pages: newsLinks },
  { title: "커머스", pages: commerceLinks },
  studioGroup,
];

const OpenDoorHome = createLucideIcon("OpenDoorHome", [
  ["path", { d: "M9 21H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2h-4v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1z", key: "outline" }],
]);

const RoundedPlay = createLucideIcon("RoundedPlay", [
  ["path", { d: "M5 5.5a2 2 0 0 1 3-1.73l11 6.5a2 2 0 0 1 0 3.46l-11 6.5A2 2 0 0 1 5 18.5z", key: "outline" }],
]);

const navButtons = [
  { id: "home", label: "홈", Icon: OpenDoorHome },
  { id: "sections", label: "전체 메뉴", Icon: LayoutGrid },
  { id: "news", label: "뉴스", Icon: Newspaper },
  { id: "studio", label: "스튜디오", Icon: RoundedPlay },
] as const;

const itemClass = "grid h-14 w-full min-w-0 place-items-center rounded focus-visible:outline-2 focus-visible:outline-sky-300";
const drawerItemClass = "block w-full rounded py-2 text-left text-[13px] text-slate-300 no-underline hover:text-white focus-visible:outline-2 focus-visible:outline-sky-300 aria-[current=page]:text-sky-300";

export default function MobilePrimaryNav({ onNavigate }: {
  onNavigate: (path: string, direct?: boolean) => void;
}) {
  const [location] = useLocation();
  const search = useSearch();
  const currentHref = location === "/commerce" && getCommerceTab(search) === "coupang" ? "/commerce?tab=coupang" : location;
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  function closeForAction() {
    openerRef.current = null;
    setOpen(false);
  }

  function handleLink(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    closeForAction();
    onNavigate(href);
  }

  useEffect(() => {
    const mobile = window.matchMedia("(width < 768px)");
    let start: { x: number; y: number; id: number } | null = null;

    function onTouchStart(event: TouchEvent) {
      start = null;
      if (!mobile.matches || event.touches.length !== 1 || !navRef.current?.getClientRects().length) return;
      if (document.querySelector("[role='dialog'][data-state='open'], .mobileMenuDrawer.open, .mypageModalContainer")) return;
      if (event.target instanceof Element && event.target.closest(".trend-cards-carousel, .tabMenu, .youtubeTrendFilters, .supportChat, #coupang-category-rail, form, a, button")) return;
      const { clientX: x, clientY: y, identifier: id } = event.touches[0];
      if (x >= 12 && x <= 48) start = { x, y, id };
    }

    function onTouchEnd(event: TouchEvent) {
      if (!start) return;
      const origin = start;
      start = null;
      const touch = Array.from(event.changedTouches).find(item => item.identifier === origin.id);
      if (!touch) return;
      const travel = touch.clientX - origin.x;
      if (travel >= 50 && travel > Math.abs(touch.clientY - origin.y) * 1.5) {
        openerRef.current = null;
        setOpen(true);
      }
    }

    function cancelTouch() {
      start = null;
    }

    function onBreakpointChange() {
      start = null;
      if (!mobile.matches) setOpen(false);
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", cancelTouch, { passive: true });
    mobile.addEventListener("change", onBreakpointChange);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", cancelTouch);
      mobile.removeEventListener("change", onBreakpointChange);
    };
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <nav ref={navRef} data-drawer-open={open} aria-label="모바일 메인 메뉴" className="mobilePrimaryNav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 px-2 pb-[env(safe-area-inset-bottom,0px)] md:hidden">
        {navButtons.map(({ id, label, Icon }) => {
          const drawerButton = id === "sections";
          const current = id === "home" && location === "/"
            || id === "news" && (location === "/news" || location.startsWith("/news/"))
            || id === "studio" && (location === "/ai-studio" || location.startsWith("/ai-studio/"));
          const active = drawerButton && open;
          return (
            <button
              key={id}
              type="button"
              aria-label={label}
              title={label}
              aria-current={current ? "page" : undefined}
              aria-haspopup={drawerButton ? "dialog" : undefined}
              aria-expanded={drawerButton ? active : undefined}
              className={`${itemClass} ${active ? "text-sky-300" : "text-slate-300"}`}
              onClick={event => {
                if (id === "home") {
                  onNavigate("/");
                  return;
                }
                if (id === "studio") {
                  onNavigate(studioProgramsHref, true);
                  return;
                }
                if (id === "news") {
                  onNavigate(newsLinks[0].href, true);
                  return;
                }
                openerRef.current = event.currentTarget;
                setOpen(true);
              }}
            >
              <Icon size={20} aria-hidden="true" />
            </button>
          );
        })}
      </nav>
      <SheetContent
        side="left"
        aria-describedby={undefined}
        className="mobilePrimaryDrawer z-[10030] gap-0 overflow-y-auto overscroll-contain border-0 pb-[env(safe-area-inset-bottom,0px)] text-slate-100 md:hidden"
        overlayClassName="z-[10029] bg-black/30 motion-reduce:animate-none md:hidden"
        onCloseAutoFocus={event => {
          if (!openerRef.current) return;
          event.preventDefault();
          openerRef.current.focus({ preventScroll: true });
        }}
      >
        <SheetTitle className="sr-only">전체 메뉴</SheetTitle>
        <div className="space-y-5 px-5 pt-14 pb-6">
          <Link
            href="/"
            aria-current={location === "/" ? "page" : undefined}
            className={cn(drawerItemClass, "flex min-h-10 items-center gap-2.5 text-sm font-medium")}
            onClick={event => handleLink(event, "/")}
          >
            <OpenDoorHome size={18} aria-hidden="true" />
            홈
          </Link>
          {contentGroups.map(({ title, pages }) => (
            <section key={title}>
              <h3 className="pr-12 text-base font-semibold text-slate-100">{title}</h3>
              <ul className="mt-1 pl-3">
                {pages.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      aria-current={href === currentHref ? "page" : undefined}
                      className={drawerItemClass}
                      onClick={event => handleLink(event, href)}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
