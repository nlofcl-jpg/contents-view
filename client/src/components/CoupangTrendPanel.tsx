import { useRef, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { ArrowUpRight, ImageOff, LoaderCircle, RefreshCw, Search, X } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { coupangCategories, type CoupangCategoryId } from "@shared/coupangPartners";
import type { AppRouter } from "../../../server/routers";

const won = new Intl.NumberFormat("ko-KR");

type ProductData = inferRouterOutputs<AppRouter>["coupang"]["products"];
type ProductResult = {
  isPending: boolean;
  error: { message: string } | null;
  data?: ProductData;
};

function ProductResults({ result }: { result: ProductResult }) {
  if (result.isPending) return (
    <p role="status" className="flex items-center gap-2 py-4 text-sm text-slate-300"><LoaderCircle className="animate-spin" size={16} aria-hidden="true" />쿠팡 상품을 불러오는 중입니다.</p>
  );
  if (result.error) return <p role="alert" className="text-sm text-slate-300">{result.error.message}</p>;
  if (result.data?.configured === false) return <p className="text-sm text-slate-300">쿠팡 파트너스 API 연결을 준비 중입니다.</p>;
  const items = result.data?.productList ?? [];
  if (!items.length) return <p className="text-sm text-slate-300">표시할 상품이 없습니다.</p>;

  return (
    <>
      <p className="mb-3 text-sm text-slate-300">이 페이지는 쿠팡 파트너스 활동의 일환으로, 상품 구매 시 일정액의 수수료를 제공받습니다.</p>
      <ul className="grid gap-3 lg:grid-cols-2">
        {items.map(item => (
          <li key={item.id} className="min-w-0">
            <a href={item.url} target="_blank" rel="sponsored noopener noreferrer" className="flex h-full items-center gap-3 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-inherit hover:border-slate-500">
              <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded bg-slate-800">
                {item.image ? <img src={item.image} alt="" loading="lazy" className="size-full bg-white object-contain" /> : <ImageOff size={20} className="text-slate-400" aria-hidden="true" />}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 break-words text-sm font-medium leading-5 text-slate-100">{item.name}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm font-semibold text-slate-100">{won.format(item.price)}원
                  {item.isRocket && <span className="text-xs font-normal text-sky-300">로켓배송</span>}
                </p>
              </div>
              <ArrowUpRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
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
  const [guestPrompt, setGuestPrompt] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedResult = trpc.coupang.products.useQuery(feed === "deals" ? { feed } : { feed, category }, {
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const search = trpc.coupang.search.useMutation();
  const configured = feedResult.data?.configured;

  function goToAuth(signup = false) {
    const params = new URLSearchParams({ redirect: "/commerce?tab=coupang" });
    if (signup) params.set("mode", "signup");
    navigate(`/login?${params}`);
  }

  return (
    <>
      <Popover open={resultsOpen} onOpenChange={setResultsOpen}>
        <PopoverAnchor asChild>
          <form ref={formRef} className="heroSearch naverAnalysisComposer commerceAnalysisComposer" role="search" aria-label="쿠팡 상품 검색" onSubmit={event => {
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
          </form>
        </PopoverAnchor>
        <PopoverContent
          aria-labelledby="coupang-search-results-title"
          side="bottom"
          sideOffset={8}
          align="start"
          avoidCollisions={false}
          collisionPadding={12}
          className="flex max-h-[min(60dvh,32rem,max(10rem,var(--radix-popover-content-available-height)))] w-[var(--radix-popover-trigger-width)] flex-col border-slate-700 bg-slate-950 p-0 shadow-xl"
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
          </div>
        </PopoverContent>
      </Popover>
      <section className="space-y-4" aria-labelledby="coupang-products-title">
        <div className="flex flex-wrap gap-2" role="group" aria-label="쿠팡 상품 목록">
          {([{ id: "popular", label: "인기 추천" }, { id: "deals", label: "특가·행사" }] as const).map(item => (
            <button key={item.id} type="button" className={`tabButton${item.id === feed ? " active" : ""}`} aria-pressed={item.id === feed} onClick={() => setFeed(item.id)}>{item.label}</button>
          ))}
        </div>
        {feed === "popular" && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="쿠팡 상품 카테고리">
            {coupangCategories.map(item => (
              <button key={item.id} type="button" className={`tabButton${item.id === category ? " active" : ""}`} aria-pressed={item.id === category} onClick={() => setCategory(item.id)}>{item.label}</button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <h2 id="coupang-products-title" className="min-w-0 break-words text-lg font-semibold text-white">
            {feed === "deals" ? "골드박스 특가" : "카테고리별 인기 추천"}
          </h2>
          {feedResult.isError && <button type="button" className="refreshButton refreshButtonIconOnly" title="다시 불러오기" aria-label="다시 불러오기" disabled={feedResult.isFetching} onClick={() => void feedResult.refetch()}>
            <RefreshCw size={16} aria-hidden="true" />
          </button>}
        </div>
        <ProductResults result={feedResult} />
      </section>
      <GuestAccessPrompt open={guestPrompt} description="쿠팡 상품 검색은 로그인 후 이용할 수 있습니다." onBrowse={() => setGuestPrompt(false)} onLogin={() => goToAuth()} onSignup={() => goToAuth(true)} />
    </>
  );
}
