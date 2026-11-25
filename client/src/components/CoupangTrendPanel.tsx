import { useCallback, useRef, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, LayoutGrid, RefreshCw, Rocket, Search, ShoppingBag, Ticket, X } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import { SearchGlowForm } from "@/components/SearchGlowForm";
import { useMobileNavScroll } from "@/hooks/useMobileNavScroll";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { coupangCategories, type CoupangCategoryId } from "@shared/coupangPartners";
import type { AppRouter } from "../../../server/routers";

const won = new Intl.NumberFormat("ko-KR");
const productPageSize = 18;
const productQueryOptions = { staleTime: 10 * 60 * 1000, retry: false, refetchOnWindowFocus: false } as const;
const productFeeds = [
  { id: "popular", label: "인기순", Icon: ShoppingBag },
  { id: "deals", label: "특가·행사", Icon: Ticket },
] as const;

type ProductData = inferRouterOutputs<AppRouter>["coupang"]["products"];
type ProductResult = {
  isPending: boolean;
  isFetching?: boolean;
  error: { message: string } | null;
  data?: ProductData;
};

function ProductResults({ result, layout = "search", ranked = false }: { result: ProductResult; layout?: "search" | "feed"; ranked?: boolean }) {
  const [visibleCount, setVisibleCount] = useState(productPageSize);
  if (result.isPending || (result.isFetching && !result.data)) return (
    <div role="status" className={`grid place-content-center justify-items-center gap-3 py-6 text-center text-sm text-slate-200 ${layout === "search" ? "min-h-28" : "min-h-48"}`}>
      <span className="naverAnalysisProgressTrack" aria-hidden="true" />
      <p>쿠팡 상품을 불러오는 중입니다.</p>
    </div>
  );
  if (result.error) return <p role="alert" className="text-sm text-slate-300">{result.error.message}</p>;
  if (result.data?.configured === false) return <p className="text-sm text-slate-300">쿠팡 파트너스 API 연결을 준비 중입니다.</p>;
  const items = result.data?.productList ?? [];
  if (!items.length) return <p className="text-sm text-slate-300">표시할 상품이 없습니다.</p>;
  const List = ranked ? "ol" : "ul";

  return (
    <>
      <List className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {items.slice(0, visibleCount).map((item, index) => (
          <li key={item.id} className="min-w-0">
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="group block h-full rounded-md text-inherit focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">
              <div className="relative isolate grid aspect-square w-full place-items-center overflow-hidden rounded-md bg-slate-800">
                {item.image ? <img src={item.image} alt="" loading="lazy" className="absolute inset-0 size-full bg-white object-contain" /> : <ImageOff size={20} className="text-slate-400" aria-hidden="true" />}
                {ranked && (
                  <span className={`absolute left-2 top-2 grid size-7 place-items-center rounded-md text-xs font-bold tabular-nums text-white ${index < 3 ? "bg-red-700" : "bg-black/45 backdrop-blur-md"}`}>
                    {index + 1}<span className="sr-only">위</span>
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5 text-xs font-bold text-neutral-400/75 group-hover:text-neutral-200 group-hover:underline group-focus-visible:text-neutral-200 group-focus-visible:underline sm:text-sm">
                  <ExternalLink size={16} strokeWidth={2.5} aria-hidden="true" /> 제품 보기
                </span>
              </div>
              <div className="min-w-0 pt-2">
                <p className="line-clamp-2 h-10 min-w-0 break-words text-sm font-medium leading-5 text-slate-100 group-hover:text-white">{item.name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm font-semibold tabular-nums text-slate-100">
                  {item.discountRate !== undefined && <span className="text-rose-400">{item.discountRate}%</span>}
                  <span>{won.format(item.price)}원</span>
                  {item.isRocket && <span className="inline-flex text-sky-300" title="로켓배송"><Rocket size={15} aria-hidden="true" /><span className="sr-only">로켓배송</span></span>}
                </p>
              </div>
            </a>
          </li>
        ))}
      </List>
      {layout === "feed" && items.length > visibleCount && (
        <div className="mt-4 flex justify-center">
          <button type="button" className="tabButton" onClick={() => setVisibleCount(count => count + productPageSize)}>상품 더보기</button>
        </div>
      )}
    </>
  );
}

export default function CoupangTrendPanel() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [feed, setFeed] = useState<"popular" | "deals">("popular");
  const [category, setCategory] = useState<CoupangCategoryId>(coupangCategories[0].id);
  const [keyword, setKeyword] = useState("");
  const [searchedKeyword, setSearchedKeyword] = useState("");
  const [resultsOpen, setResultsOpen] = useState(false);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const mobileNavHidden = useMobileNavScroll(mobileCategoriesOpen);
  const [mobileCategoryBoundary, setMobileCategoryBoundary] = useState<HTMLElement | null>(null);
  const [guestPrompt, setGuestPrompt] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const categoryRailRef = useRef<HTMLDivElement>(null);
  const productsRef = useRef<HTMLElement>(null);
  const feedResult = trpc.coupang.products.useQuery(feed === "deals" ? { feed } : { feed, category }, productQueryOptions);
  const categoryLabel = coupangCategories.find(item => item.id === category)?.label;
  const search = trpc.coupang.search.useMutation();
  const configured = feedResult.data?.configured;
  const setMobileNavRef = useCallback((nav: HTMLElement | null) => {
    setMobileCategoryBoundary(nav?.closest("main") ?? null);
  }, []);

  function goToAuth(signup = false) {
    const params = new URLSearchParams({ redirect: "/commerce?tab=coupang" });
    if (signup) params.set("mode", "signup");
    navigate(`/login?${params}`);
  }

  function slideCategories(direction: -1 | 1) {
    const rail = categoryRailRef.current;
    rail?.scrollBy({ left: direction * rail.clientWidth * 0.75, behavior: "smooth" });
  }

  function selectMobileFeed(nextFeed: typeof feed, nextCategory?: CoupangCategoryId) {
    setFeed(nextFeed);
    if (nextCategory) setCategory(nextCategory);
    setMobileCategoriesOpen(false);
    const products = productsRef.current;
    if (products && products.getBoundingClientRect().top < 80) {
      products.scrollIntoView({ block: "start" });
    }
  }

  return (
    <>
      <Popover open={resultsOpen} onOpenChange={setResultsOpen}>
        <PopoverAnchor className="mb-[var(--commerce-section-spacing)] w-full">
          <SearchGlowForm ref={formRef} className="heroSearch naverAnalysisComposer commerceAnalysisComposer" role="search" aria-label="쿠팡 상품 검색" onSubmit={event => {
            event.preventDefault();
            const term = keyword.trim();
            if (authLoading || !term || configured === false || search.isPending) return;
            if (!isAuthenticated) {
              setGuestPrompt(true);
              return;
            }
            setSearchedKeyword(term);
            setResultsOpen(true);
            search.mutate({ keyword: term });
          }}>
            <input ref={inputRef} type="search" className="heroSearchInput" placeholder="쿠팡 상품 검색" aria-label="상품명 또는 키워드" autoComplete="off" maxLength={80} value={keyword} onChange={event => setKeyword(event.target.value)} />
            <button className="heroSearchButton" type="submit" aria-label="검색" title="검색" aria-haspopup="dialog" aria-expanded={resultsOpen} disabled={authLoading || !keyword.trim() || configured === false || search.isPending}>
              <Search size={18} aria-hidden="true" />
            </button>
          </SearchGlowForm>
        </PopoverAnchor>
        <PopoverContent
          aria-labelledby="coupang-search-results-title"
          side="bottom"
          sideOffset={8}
          align="center"
          avoidCollisions={false}
          collisionPadding={12}
          className="coupangSearchResultsPopover flex max-h-[min(70dvh,40rem,max(10rem,var(--radix-popover-content-available-height)))] w-[var(--radix-popover-trigger-width)] flex-col border-slate-700 p-0 shadow-xl"
          onCloseAutoFocus={event => event.preventDefault()}
          onEscapeKeyDown={() => {
            if (!formRef.current?.contains(document.activeElement)) inputRef.current?.focus();
          }}
          onInteractOutside={event => {
            if (event.target instanceof Node && formRef.current?.contains(event.target)) event.preventDefault();
          }}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3">
            <h2 id="coupang-search-results-title" className="min-w-0 break-words text-sm font-semibold text-white">상품 검색: {searchedKeyword}</h2>
            <button type="button" aria-label="검색 결과 닫기" title="검색 결과 닫기" className="grid size-8 shrink-0 place-items-center rounded text-slate-400 hover:bg-white/10 hover:text-white" onClick={() => {
              setResultsOpen(false);
              inputRef.current?.focus();
            }}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 pt-2">
            <ProductResults result={search} />
            <div className="mt-4 flex justify-center border-t border-white/10 pt-3">
              <a
                href={`https://www.coupang.com/np/search?${new URLSearchParams({ q: searchedKeyword })}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-sky-300 hover:text-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300"
              >
                쿠팡에서 전체 검색 결과 보기 <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <section ref={productsRef} className="scroll-mt-4 space-y-4" aria-labelledby="coupang-products-title">
        <div className="hidden flex-wrap justify-center gap-2 md:flex" role="group" aria-label="쿠팡 상품 목록">
          {productFeeds.map(item => (
            <button key={item.id} type="button" className={`tabButton${item.id === feed ? " active" : ""}`} aria-pressed={item.id === feed} onClick={() => setFeed(item.id)}>{item.label}</button>
          ))}
        </div>
        {feed === "popular" && (
          <div className="hidden min-w-0 items-center gap-1 md:flex">
            <button type="button" className="hidden size-7 shrink-0 place-items-center rounded text-slate-400 hover:bg-white/10 hover:text-white sm:grid" aria-label="이전 카테고리 보기" title="이전 카테고리 보기" aria-controls="coupang-category-rail" onClick={() => slideCategories(-1)}>
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <div ref={categoryRailRef} id="coupang-category-rail" className="flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none]" role="group" aria-label="쿠팡 상품 카테고리">
              {coupangCategories.map(item => (
                <button key={item.id} type="button" className={`tabButton shrink-0 snap-start whitespace-nowrap${item.id === category ? " active" : ""}`} aria-pressed={item.id === category} onClick={() => setCategory(item.id)}>{item.label}</button>
              ))}
            </div>
            <button type="button" className="hidden size-7 shrink-0 place-items-center rounded text-slate-400 hover:bg-white/10 hover:text-white sm:grid" aria-label="다음 카테고리 보기" title="다음 카테고리 보기" aria-controls="coupang-category-rail" onClick={() => slideCategories(1)}>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <h2 id="coupang-products-title" className="min-w-0 break-words text-lg font-semibold text-white">
            {feed === "deals" ? "골드박스 특가" : categoryLabel}
          </h2>
          {feedResult.isError && <button type="button" className="refreshButton refreshButtonIconOnly" title="다시 불러오기" aria-label="다시 불러오기" disabled={feedResult.isFetching} onClick={() => void feedResult.refetch()}>
            <RefreshCw size={16} aria-hidden="true" />
          </button>}
        </div>
        <ProductResults key={feed === "deals" ? feed : category} result={feedResult} layout="feed" ranked={feed === "popular"} />
      </section>
      <Popover open={mobileCategoriesOpen} onOpenChange={setMobileCategoriesOpen}>
        <PopoverAnchor asChild>
          <nav ref={setMobileNavRef} aria-label="쿠팡 트렌드 하단 메뉴" data-scroll-hidden={mobileNavHidden} className="coupangMobileNav fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-white/10 px-2 pb-[env(safe-area-inset-bottom,0px)] md:hidden">
            <PopoverTrigger asChild>
              <button type="button" className="flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded text-xs font-medium text-slate-300 outline-sky-300 focus-visible:outline-2 aria-expanded:text-sky-300">
                <LayoutGrid size={18} aria-hidden="true" />
                카테고리
              </button>
            </PopoverTrigger>
            {productFeeds.map(({ id, label, Icon }) => (
              <button key={id} type="button" aria-pressed={feed === id} className="flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded text-xs font-medium text-slate-300 outline-sky-300 focus-visible:outline-2 aria-pressed:text-sky-300" onClick={() => selectMobileFeed(id)}>
                <Icon size={18} aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>
        </PopoverAnchor>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={0}
          avoidCollisions={false}
          collisionBoundary={mobileCategoryBoundary ?? undefined}
          aria-label="쿠팡 상품 카테고리"
          className="coupangMobileCategoryPanel h-[var(--radix-popover-content-available-height)] w-44 min-w-0 max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-none border-y-0 border-l-0 border-slate-700 p-1.5 md:hidden"
        >
          <ul>
            {coupangCategories.map(item => (
              <li key={item.id}>
                <button type="button" aria-pressed={category === item.id && feed === "popular"} className="block min-h-10 w-full rounded px-2.5 py-1.5 text-left text-sm text-slate-200 outline-sky-300 hover:bg-white/5 focus-visible:outline-2 aria-pressed:bg-sky-400/10 aria-pressed:text-sky-300" onClick={() => selectMobileFeed("popular", item.id)}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      <GuestAccessPrompt open={guestPrompt} description="쿠팡 상품 검색은 로그인 후 이용할 수 있습니다." onBrowse={() => setGuestPrompt(false)} onLogin={() => goToAuth()} onSignup={() => goToAuth(true)} />
    </>
  );
}
