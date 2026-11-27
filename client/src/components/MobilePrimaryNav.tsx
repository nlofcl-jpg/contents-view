import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ChevronRight, createLucideIcon, LayoutGrid } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { commerceLinks, getCommerceTab } from "@/lib/commerceNavigation";
import { newsLinks } from "@/lib/newsNavigation";
import { studioLinks } from "@/lib/studioNavigation";
import { cn } from "@/lib/utils";

type MenuItem = { label: string; href: string };
type MenuGroup = { title: string; pages: readonly MenuItem[] };

const creatorLinks = [
  { label: "유튜브 트렌드", href: "/trends/youtube" },
  { label: "네이버 트렌드", href: "/trends/naver" },
  { label: "커뮤니티 트렌드", href: "/community" },
  { label: "검색어", href: "/trends/google" },
] as const;

const bottomMenus = {
  creator: { title: "크리에이터 트렌드", pages: creatorLinks },
  news: { title: "뉴스 트렌드", pages: newsLinks },
  studio: { title: "스튜디오", pages: studioLinks },
} satisfies Record<string, MenuGroup>;

type MenuView = "sections" | keyof typeof bottomMenus;

const contentGroups: MenuGroup[] = [
  { title: "크리에이터", pages: creatorLinks },
  { title: "뉴스", pages: newsLinks },
  { title: "커머스", pages: commerceLinks },
  bottomMenus.studio,
];

const OpenDoorHome = createLucideIcon("OpenDoorHome", [
  ["path", { d: "M9 21H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2h-4v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1z", key: "outline" }],
]);

const RoundedPlay = createLucideIcon("RoundedPlay", [
  ["path", { d: "M5 5.5a2 2 0 0 1 3-1.73l11 6.5a2 2 0 0 1 0 3.46l-11 6.5A2 2 0 0 1 5 18.5z", key: "outline" }],
]);

const NewsPageIcon = createLucideIcon("NewsPage", [
  ["path", { d: "M7 6H5a2 2 0 0 0-2 2v10a3 3 0 0 0 3 3h13a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v13", strokeWidth: "1.6", key: "outline" }],
  ["rect", { x: "9.5", y: "5.8", width: "4.5", height: "4.5", rx: "0.4", strokeWidth: "1.2", key: "image" }],
  ["path", { d: "M16 6h2.5M16 8h2.5M16 10h2.5M9.5 13h9m-9 2.5H13m2 0h3.5m-9 2.5H13m2 0h3.5", strokeWidth: "1.2", key: "article" }],
]);

const NetworkGraphIcon = createLucideIcon("NetworkGraph", [
  ["path", { d: "M8 4.7a8.6 8.6 0 0 0-4.6 7.9M16 4.7a8.6 8.6 0 0 1 4.6 7.9M7.4 19.6a8.6 8.6 0 0 0 9.2 0", strokeWidth: "1.35", key: "outer-ring" }],
  ["path", { d: "M8.35 15.1a4.7 4.7 0 1 1 7.3 0", strokeWidth: "1.35", key: "inner-ring" }],
  ["circle", { cx: "12", cy: "2.7", r: "1.5", strokeWidth: "1.35", key: "top-node" }],
  ["circle", { cx: "3.65", cy: "17.1", r: "1.5", strokeWidth: "1.35", key: "left-node" }],
  ["circle", { cx: "20.35", cy: "17.1", r: "1.5", strokeWidth: "1.35", key: "right-node" }],
]);

const navButtons = [
  { id: "home", label: "홈", Icon: OpenDoorHome },
  { id: "creator", label: "크리에이터 트렌드", Icon: NetworkGraphIcon },
  { id: "sections", label: "전체 메뉴", Icon: LayoutGrid },
  { id: "news", label: "뉴스", Icon: NewsPageIcon },
  { id: "studio", label: "스튜디오", Icon: RoundedPlay },
] as const;

const itemClass = "grid h-14 w-full min-w-0 place-items-center rounded focus-visible:outline-2 focus-visible:outline-sky-300";
const drawerItemClass = "block w-full rounded py-2 text-left text-[13px] text-slate-300 no-underline hover:text-white focus-visible:outline-2 focus-visible:outline-sky-300 aria-[current=page]:text-sky-300";

export default function MobilePrimaryNav({ onNavigate }: {
  onNavigate: (path: string) => void;
}) {
  const [location] = useLocation();
  const search = useSearch();
  const currentHref = location === "/commerce" && getCommerceTab(search) === "coupang" ? "/commerce?tab=coupang" : location;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<MenuView>("sections");
  const bottomMenu = view === "sections" ? null : bottomMenus[view];
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
        setView("sections");
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
      <nav ref={navRef} data-drawer-open={open && view === "sections"} aria-label="모바일 메인 메뉴" className="mobilePrimaryNav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 px-2 pb-[env(safe-area-inset-bottom,0px)] md:hidden">
        {navButtons.map(({ id, label, Icon }) => {
          const drawerButton = id !== "home";
          const current = id === "home" && location === "/"
            || id === "news" && (location === "/news" || location.startsWith("/news/"))
            || id === "studio" && (location === "/ai-studio" || location.startsWith("/ai-studio/"));
          const active = drawerButton && open && view === id;
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
                openerRef.current = event.currentTarget;
                setView(id);
                setOpen(true);
              }}
            >
              <Icon size={20} aria-hidden="true" />
            </button>
          );
        })}
      </nav>
      <SheetContent
        side={bottomMenu ? "bottom" : "left"}
        aria-describedby={undefined}
        className={cn(
          "z-[10030] gap-0 overflow-y-auto overscroll-contain text-slate-100 motion-reduce:animate-none md:hidden",
          bottomMenu
            ? "mobileSectionSheet max-h-[75dvh] rounded-t-lg border-white/15 px-5 pt-5 pb-[calc(16px+env(safe-area-inset-bottom,0px))]"
            : "mobilePrimaryDrawer border-0 pb-[env(safe-area-inset-bottom,0px)]"
        )}
        overlayClassName="z-[10029] bg-black/30 motion-reduce:animate-none md:hidden"
        onCloseAutoFocus={event => {
          if (!openerRef.current) return;
          event.preventDefault();
          openerRef.current.focus({ preventScroll: true });
        }}
      >
        {bottomMenu ? (
          <>
            <SheetTitle className="mb-3 pr-10 text-base text-slate-100">{bottomMenu.title}</SheetTitle>
            <ul className="divide-y divide-white/10 overflow-hidden rounded-lg bg-slate-950/40 px-3">
              {bottomMenu.pages.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={href === currentHref ? "page" : undefined}
                    className={cn(drawerItemClass, "flex min-h-11 items-center justify-between gap-3 rounded-none text-sm hover:bg-white/5 focus-visible:-outline-offset-2")}
                    onClick={event => handleLink(event, href)}
                  >
                    {label}
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
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
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
