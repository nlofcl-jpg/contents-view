import { useRef, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, RefreshCw, Rocket } from "lucide-react";
import { CompactSegmentedControl } from "@/components/CompactSegmentedControl";
import { trpc } from "@/lib/trpc";
import { coupangCategories, type CoupangCategoryId } from "@shared/coupangPartners";
import type { AppRouter } from "../../../server/routers";

const won = new Intl.NumberFormat("ko-KR");
const productPageSize = 18;
const productQueryOptions = { staleTime: 10 * 60 * 1000, retry: false, refetchOnWindowFocus: false } as const;
const productFeedOptions = [
  { value: "popular", label: "인기순" },
  { value: "deals", label: "특가" },
] as const;

type ProductData = inferRouterOutputs<AppRouter>["coupang"]["products"];
type ProductResult = {
  isPending: boolean;
  isFetching?: boolean;
  error: { message: string } | null;
  data?: ProductData;
};

function ProductResults({ result, ranked }: { result: ProductResult; ranked: boolean }) {
  const [visibleCount, setVisibleCount] = useState(productPageSize);
  if (result.isPending || (result.isFetching && !result.data)) return (
    <div role="status" className="grid min-h-48 place-content-center justify-items-center gap-3 py-6 text-center text-sm text-slate-200">
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
      {items.length > visibleCount && (
        <div className="mt-4 flex justify-center">
          <button type="button" className="tabButton" onClick={() => setVisibleCount(count => count + productPageSize)}>상품 더보기</button>
        </div>
      )}
    </>
  );
}

export default function CoupangTrendPanel() {
  const [feed, setFeed] = useState<"popular" | "deals">("popular");
  const [category, setCategory] = useState<CoupangCategoryId>(coupangCategories[0].id);
  const categoryRailRef = useRef<HTMLDivElement>(null);
  const feedResult = trpc.coupang.products.useQuery(feed === "deals" ? { feed } : { feed, category }, productQueryOptions);
  const categoryLabel = coupangCategories.find(item => item.id === category)?.label;

  function slideCategories(direction: -1 | 1) {
    const rail = categoryRailRef.current;
    rail?.scrollBy({ left: direction * rail.clientWidth * 0.75, behavior: "smooth" });
  }

  return (
    <section className="w-full min-w-0 space-y-4" aria-labelledby="coupang-products-title">
      <div className="flex justify-center">
        <CompactSegmentedControl label="쿠팡 상품 목록" options={productFeedOptions} value={feed} onChange={setFeed} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <h2 id="coupang-products-title" className="min-w-0 break-words text-lg font-semibold text-white">
          {feed === "deals" ? "골드박스 특가" : categoryLabel}
        </h2>
        {feedResult.isError && <button type="button" className="grid size-8 shrink-0 place-items-center rounded-md border-0 bg-transparent text-inherit opacity-65 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 disabled:opacity-40" title="다시 불러오기" aria-label="다시 불러오기" disabled={feedResult.isFetching} onClick={() => void feedResult.refetch()}>
          <RefreshCw size={16} aria-hidden="true" />
        </button>}
      </div>
      {feed === "popular" && (
        <div className="flex min-w-0 items-center gap-1">
          <button type="button" className="hidden size-7 shrink-0 place-items-center rounded text-slate-400 hover:bg-white/10 hover:text-white md:grid" aria-label="이전 카테고리 보기" title="이전 카테고리 보기" aria-controls="coupang-category-rail" onClick={() => slideCategories(-1)}>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <div ref={categoryRailRef} id="coupang-category-rail" className="youtubeTabMenu flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none]" role="group" aria-label="쿠팡 상품 카테고리">
            {coupangCategories.map(item => (
              <button key={item.id} type="button" className={`tabButton shrink-0 snap-start whitespace-nowrap${item.id === category ? " active" : ""}`} aria-pressed={item.id === category} onClick={() => setCategory(item.id)}>{item.label}</button>
            ))}
          </div>
          <button type="button" className="hidden size-7 shrink-0 place-items-center rounded text-slate-400 hover:bg-white/10 hover:text-white md:grid" aria-label="다음 카테고리 보기" title="다음 카테고리 보기" aria-controls="coupang-category-rail" onClick={() => slideCategories(1)}>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
      <ProductResults key={feed === "deals" ? feed : category} result={feedResult} ranked={feed === "popular"} />
    </section>
  );
}
