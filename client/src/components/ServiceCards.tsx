import { useMemo, useState } from "react";
import { ArrowRight, MessageCircle, MessageCircleMore, Newspaper, ThumbsUp, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { YouTubeVideoDetailModal } from "@/components/YouTubeVideoDetailModal";
import { GoogleTrendTraffic } from "@/components/GoogleTrendTraffic";
import { trpc } from "@/lib/trpc";

type TrendRow = {
  label: string;
  meta?: string;
  rightValue?: string;
  detailHref?: string;
  externalHref?: string;
  image?: string | null;
  tone?: "hot" | "normal";
  video?: any;
  minimal?: boolean;
  risingScore?: boolean;
  googleTraffic?: { traffic: string; trafficCount?: number };
  durationText?: string | null;
  channelTitle?: string | null;
  communityName?: string;
  communityMetric?: { label: string; value: string };
};

type TrendCard = {
  id: string;
  title: string;
  badge: string;
  href: string;
  icon: React.ReactNode;
  brandIcon?: boolean;
  rows: TrendRow[];
  loading: boolean;
  emptyText: string;
};

function YouTubeLogo() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 32 24" aria-hidden="true">
      <path
        fill="#FF0033"
        d="M31.33 3.75A4.02 4.02 0 0 0 28.5.9C26 .23 16 .23 16 .23S6 .23 3.5.9A4.02 4.02 0 0 0 .67 3.75C0 6.27 0 12 0 12s0 5.73.67 8.25A4.02 4.02 0 0 0 3.5 23.1c2.5.67 12.5.67 12.5.67s10 0 12.5-.67a4.02 4.02 0 0 0 2.83-2.85C32 17.73 32 12 32 12s0-5.73-.67-8.25Z"
      />
      <path fill="#FFFFFF" d="m12.8 17.14 8.32-5.14-8.32-5.14v10.28Z" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.82-.07-1.42-.22-2.04H12v4.05h6.62c-.13 1.01-.86 2.54-2.46 3.56l-.02.14 3.56 2.51.25.02c2.3-1.94 3.54-4.8 3.54-8.24Z"
      />
      <path
        fill="#34A853"
        d="M12 23c3.29 0 6.05-.99 8.06-2.69l-3.84-2.71c-1.03.66-2.4 1.12-4.22 1.12a7.32 7.32 0 0 1-6.93-4.6l-.14.01-3.7 2.61-.05.13C3.23 20.5 7.28 23 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.07 14.12A6.6 6.6 0 0 1 4.68 12c0-.74.14-1.45.37-2.12l-.01-.14L1.3 7.1l-.12.05A10.26 10.26 0 0 0 0 12c0 1.74.46 3.38 1.25 4.83l3.82-2.71Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.28c2.29 0 3.83.9 4.71 1.66l3.44-3.06C18.04 2.1 15.29 1 12 1 7.28 1 3.23 3.5 1.25 7.17l3.81 2.71A7.35 7.35 0 0 1 12 5.28Z"
      />
    </svg>
  );
}

function stripHtml(value?: string | null) {
  return (value || "").replace(/<[^>]*>/g, "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").trim();
}

function formatCommunityDate(value?: string | null) {
  if (!value) return null;
  const normalized = String(value).trim();
  const dateMatch = normalized.match(/(\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2})/);
  if (dateMatch) return dateMatch[1].replace(/^\d{4}[./-]/, "").replaceAll("-", ".");
  if (/^\d+\s*(분|시간)\s*전/.test(normalized) || normalized.includes("방금")) return normalized;
  if (normalized.includes("어제")) return "어제";

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
  }

  return normalized.split(/\s+/)[0] || null;
}

function formatVideoAge(value?: string | null) {
  if (!value) return null;
  const elapsedMinutes = Math.floor((Date.now() - new Date(value).getTime()) / 60_000);
  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes < 0) return null;
  if (elapsedMinutes < 60) return `${Math.max(1, elapsedMinutes)}분 전`;
  if (elapsedMinutes < 1_440) return `${Math.floor(elapsedMinutes / 60)}시간 전`;
  return `${Math.floor(elapsedMinutes / 1_440)}일 전`;
}

function formatVideoDuration(value?: string | null) {
  const match = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  if (!hours && !minutes && !seconds) return null;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function CommunitySourceMark({ name }: { name?: string }) {
  const sources: Record<string, { image: string; background: string }> = {
    "디시인사이드": { image: "/community-dcinside.png", background: "bg-[#222f60]" },
    "뽐뿌": { image: "/community-ppomppu.png", background: "bg-white" },
    "네이트판": { image: "/community-natepann.png", background: "bg-[#525252]" },
    "루리웹": { image: "/community-ruliweb.png", background: "bg-[#0e2040]" },
    "인벤": { image: "/community-inven.png", background: "bg-white" },
    "보배드림": { image: "/community-bobaedream.png", background: "bg-[#116fa6]" },
    "웃긴대학": { image: "/community-humoruniv.png", background: "bg-white" },
  };
  const source = sources[name || ""];
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md ${source?.background || "bg-slate-700"}`} aria-hidden="true">
      {source ? <img src={source.image} alt="" className="h-full w-full object-contain p-1" loading="lazy" /> : <MessageCircle size={20} className="text-white" />}
    </span>
  );
}

function TrendDashboardCard({ card, onVideoSelect }: { card: TrendCard; onVideoSelect?: (video: any) => void }) {
  const [, setLocation] = useLocation();
  const isYouTubeCard = card.id === "youtube";
  const isSearchCard = card.id === "search";
  const isCommunityCard = card.id === "community";
  const isNewsCard = card.id === "news";
  const isFeaturedCard = isYouTubeCard || isSearchCard || isCommunityCard || isNewsCard;
  const glassRowClass = "trend-glass-row rounded-lg backdrop-blur-sm";

  return (
    <article className={`group relative rounded-lg border p-5 ${isFeaturedCard ? "trend-glass-card backdrop-blur-md" : "border-blue-500/20 bg-slate-950/50 shadow-[0_22px_70px_rgba(0,0,0,0.22)] transition-colors hover:border-blue-400/40 hover:bg-slate-950/70"}`}>
      <div className={`mb-5 flex items-center justify-between gap-3 ${isFeaturedCard ? "min-h-10" : ""}`}>
        <div className={`flex min-w-0 items-center ${isCommunityCard || isNewsCard ? "gap-2" : "gap-3"}`}>
          <div
            className={`flex shrink-0 items-center justify-center ${isCommunityCard || isNewsCard ? "h-8 w-8" : "h-10 w-10"} ${
              card.brandIcon || isCommunityCard || isNewsCard ? "" : "rounded-lg bg-blue-500/15 text-blue-300"
            }`}
          >
            {card.icon}
          </div>
          <h3 className={`truncate font-semibold text-white ${isCommunityCard || isNewsCard ? "text-sm" : "text-lg"}`}>{card.title}</h3>
        </div>
        {isFeaturedCard ? (
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-400 transition-colors hover:text-blue-300"
            onClick={() => setLocation(card.href)}
          >
            더보기 <ArrowRight size={14} aria-hidden="true" />
          </button>
        ) : (
          <span className="shrink-0 rounded-full border border-blue-500/30 px-3 py-1 text-xs font-semibold text-blue-300">
            {card.badge}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {card.loading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className={`flex items-center gap-3 p-2.5 ${isFeaturedCard ? `h-[72px] ${glassRowClass}` : "min-h-[62px] rounded-md border border-slate-800/70 bg-slate-900/35"}`}>
              <div className="h-6 w-6 rounded-full bg-slate-800/80" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-4/5 rounded bg-slate-800/80" />
                <div className="h-2 w-2/5 rounded bg-slate-800/70" />
              </div>
            </div>
          ))
        ) : card.rows.length > 0 ? (
          card.rows.map((row, index) => isSearchCard ? (
            <button
              key={`${card.id}-${index}-${row.label}`}
              type="button"
              className={`grid h-[72px] w-full grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 py-1.5 pl-1.5 pr-3.5 text-left ${glassRowClass}`}
              onClick={() => row.detailHref && setLocation(row.detailHref)}
              aria-label={`${index + 1}위 ${row.label} 자세히`}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-400/20 text-xs font-bold text-blue-100">{index + 1}</span>
              <span className="min-w-0">
                <span className="block min-w-0 truncate text-sm font-semibold leading-5 text-slate-100" title={row.label}>{row.label}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-2">
                {row.googleTraffic && <GoogleTrendTraffic traffic={row.googleTraffic.traffic} trafficCount={row.googleTraffic.trafficCount} className="shrink-0 text-xs" />}
                {row.detailHref && <span className="text-[11px] font-semibold text-slate-500">자세히</span>}
              </span>
            </button>
          ) : isCommunityCard ? (
            <a
              key={`${card.id}-${index}-${row.label}`}
              href={row.externalHref || card.href}
              target={row.externalHref ? "_blank" : undefined}
              rel={row.externalHref ? "noopener noreferrer" : undefined}
              className={`grid h-[72px] w-full grid-cols-[18px_40px_minmax(0,1fr)_auto] items-center gap-2 py-1.5 pl-1.5 pr-3.5 text-left ${glassRowClass}`}
              aria-label={`${index + 1}위 ${row.label} 원문 보기`}
            >
              <span className="text-center text-base font-bold text-blue-300">{index + 1}</span>
              <CommunitySourceMark name={row.communityName} />
              <span className="flex min-w-0 flex-col justify-center gap-1">
                <span className="block min-w-0 truncate text-xs font-semibold leading-4 text-slate-100" title={row.label}>{row.label}</span>
                <span className="block min-w-0 truncate text-[10px] leading-4 text-slate-400">{row.meta}</span>
              </span>
              {row.communityMetric && (
                <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-bold text-rose-400" aria-label={`${row.communityMetric.label} ${row.communityMetric.value}`}>
                  <ThumbsUp size={12} aria-hidden="true" />{row.communityMetric.value}
                </span>
              )}
            </a>
          ) : isYouTubeCard ? (
            <button
              key={`${card.id}-${index}-${row.label}`}
              type="button"
              className={`grid w-full grid-cols-[76px_minmax(0,1fr)] items-center gap-2 p-1.5 text-left ${glassRowClass}`}
              onClick={() => row.video && onVideoSelect?.(row.video)}
              aria-label={`${index + 1}위 ${row.label} 분석 보기`}
            >
              <span className="relative h-[58px] w-[76px] overflow-hidden rounded-md bg-slate-800">
                {row.image && <img src={row.image} alt="" className="h-full w-full object-cover" loading="lazy" />}
                <span className={`absolute left-0 top-0 flex h-6 min-w-6 items-center justify-center px-1 text-xs font-bold text-white ${index === 0 ? "bg-rose-500" : "bg-blue-500"}`}>
                  {index + 1}
                </span>
                {row.durationText && <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-[10px] leading-4 text-white">{row.durationText}</span>}
              </span>
              <span className="flex min-w-0 flex-col justify-center gap-0.5">
                <span className="block min-w-0 truncate text-xs font-semibold leading-4 text-slate-100" title={row.label}>{row.label}</span>
                {row.channelTitle && <span className="block min-w-0 truncate text-[10px] leading-4 text-slate-400">{row.channelTitle}</span>}
                <span className="flex min-w-0 items-center justify-between gap-1 leading-4">
                  {row.meta && <span className="min-w-0 truncate text-[10px] text-slate-400">{row.meta}</span>}
                  {row.rightValue && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-bold text-rose-400" aria-label={`상승 지수 ${row.rightValue}`}>
                      <TrendingUp size={12} aria-hidden="true" />{row.rightValue}
                    </span>
                  )}
                </span>
              </span>
            </button>
          ) : (
            <div
              key={`${card.id}-${index}-${row.label}`}
              className={`flex items-center gap-3 p-2.5 ${isNewsCard ? `h-[72px] ${glassRowClass}` : "min-h-[62px] rounded-md border border-slate-800/70 bg-slate-900/25"} ${(row.video || row.externalHref) ? `cursor-pointer ${isNewsCard ? "" : "transition-colors hover:border-blue-400/40 hover:bg-slate-900/55"}` : ""}`}
              role={(row.video || row.externalHref) ? "button" : undefined}
              tabIndex={(row.video || row.externalHref) ? 0 : undefined}
              aria-label={row.video ? `${row.label} 분석 보기` : undefined}
              onClick={() => {
                if (row.video) onVideoSelect?.(row.video);
                if (row.externalHref) window.open(row.externalHref, "_blank", "noopener,noreferrer");
              }}
              onKeyDown={(event) => {
                if (!row.video && !row.externalHref) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  if (row.video) onVideoSelect?.(row.video);
                  if (row.externalHref) window.open(row.externalHref, "_blank", "noopener,noreferrer");
                }
              }}
            >
              {!row.minimal && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-200">
                  {index + 1}
                </div>
              )}
              {row.image && (
                <img
                  src={row.image}
                  alt=""
                  className={`${row.minimal ? "h-9 w-16" : "h-10 w-14"} shrink-0 rounded object-cover`}
                  loading="lazy"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">{row.label}</p>
                {!row.minimal && row.meta && <p className="mt-1 truncate text-xs text-slate-400">{row.meta}</p>}
              </div>
              {(row.rightValue || row.googleTraffic || row.detailHref) && (
                <div className={`flex shrink-0 items-center gap-2 ${row.minimal ? "ml-auto" : ""}`}>
                  {row.rightValue && (
                    <span className={`inline-flex items-center gap-1 text-xs font-bold ${row.risingScore ? "text-red-400" : "text-blue-300"}`}>
                      {row.risingScore ? <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                      {row.rightValue}
                    </span>
                  )}
                  {row.googleTraffic && (
                    <GoogleTrendTraffic traffic={row.googleTraffic.traffic} trafficCount={row.googleTraffic.trafficCount} className="text-xs" />
                  )}
                  {row.detailHref && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setLocation(row.detailHref!);
                      }}
                      className="text-[11px] font-semibold text-slate-500 transition-colors hover:text-blue-200"
                    >
                      자세히
                    </button>
                  )}
                </div>
              )}
              {row.tone === "hot" && <span className="shrink-0 text-xs font-bold text-red-400">급상승</span>}
            </div>
          ))
        ) : (
          <div className={`p-4 text-sm text-slate-400 ${isFeaturedCard ? glassRowClass : "rounded-md border border-slate-800/70 bg-slate-900/25"}`}>
            {card.emptyText}
          </div>
        )}
      </div>

      {!isFeaturedCard && <button
        type="button"
        onClick={() => setLocation(card.href)}
        className="mx-auto mt-3 flex items-center justify-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-blue-200"
      >
        더보기
        <ArrowRight className="h-3 w-3" />
      </button>}
    </article>
  );
}

export default function ServiceCards() {
  const [selectedVideo, setSelectedVideo] = useState<any>(null);

  const youtubeRisingQuery = trpc.youtube.getCollectedRisingVideos.useQuery(
    {
      regionCode: "KR",
      period: "realtime",
      subscriberRange: "all",
      sortBy: "score",
      maxResults: 5,
    },
    { staleTime: 5 * 60 * 1000, retry: false, refetchOnWindowFocus: false }
  );

  const googleTrendsQuery = trpc.googleTrends.realtimeTrending.useQuery(
    { country: "KR" },
    { retry: 1, refetchOnWindowFocus: false }
  );

  const communityQueryOptions = { retry: 1, staleTime: 10 * 60 * 1000, refetchOnWindowFocus: false } as const;
  const dcinsideQuery = trpc.community.getDcinside.useQuery({ sort: "popular" }, communityQueryOptions);
  const ppomppuQuery = trpc.community.getPpomppu.useQuery(undefined, communityQueryOptions);
  const natepannQuery = trpc.community.getNatePann.useQuery({ sort: "popular" }, communityQueryOptions);
  const ruliwebQuery = trpc.community.getRuliweb.useQuery({ sort: "popular" }, communityQueryOptions);
  const invenQuery = trpc.community.getInven.useQuery({ sort: "popular" }, communityQueryOptions);
  const bobaedreamQuery = trpc.community.getBobaedream.useQuery({ sort: "popular" }, communityQueryOptions);
  const humorunivQuery = trpc.community.getHumorUniv.useQuery({ sort: "popular" }, communityQueryOptions);
  const communityLoading = [dcinsideQuery, ppomppuQuery, natepannQuery, ruliwebQuery, invenQuery, bobaedreamQuery, humorunivQuery]
    .some((query) => query.isPending);

  const newsQuery = trpc.news.getLatestNews.useQuery(
    { category: "all", limit: 5 },
    { retry: 1, refetchOnWindowFocus: false }
  );

  const youtubeRows = useMemo<TrendRow[]>(() => {
    const videos = (youtubeRisingQuery.data as any)?.videos || [];
    return videos.slice(0, 5).map((video: any) => ({
      label: stripHtml(video.title),
      meta: [
        Number.isFinite(Number(video.viewCount)) ? `조회수 ${new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(Number(video.viewCount))}` : null,
        formatVideoAge(video.publishedAt),
      ].filter(Boolean).join(" · "),
      rightValue: video.discoveryScore !== null && video.discoveryScore !== undefined
        ? String(Math.round(Number(video.discoveryScore)))
        : undefined,
      image: video.thumbnail,
      durationText: formatVideoDuration(video.duration),
      channelTitle: stripHtml(video.channelTitle),
      video,
      minimal: true,
      risingScore: true,
    }));
  }, [youtubeRisingQuery.data]);

  const searchRows = useMemo<TrendRow[]>(() => {
    const trends = (googleTrendsQuery.data as any)?.data || [];
    return trends.slice(0, 5).map((item: any) => ({
      label: stripHtml(item.keyword),
      googleTraffic: { traffic: item.traffic || "", trafficCount: item.trafficCount },
      detailHref: `/trends/google?country=KR&trend=${encodeURIComponent(item.keyword)}`,
    }));
  }, [googleTrendsQuery.data]);

  const communityRows = useMemo<TrendRow[]>(() => {
    const responses = [
      dcinsideQuery.data, ppomppuQuery.data, natepannQuery.data, ruliwebQuery.data,
      invenQuery.data, bobaedreamQuery.data, humorunivQuery.data,
    ];
    const posts = responses.flatMap((response) => response?.success ? response.data || [] : []);
    const popularity = (post: any) =>
      Number(post.reactionCount || 0) * 2 + Number(post.commentCount || 0) * 1.5
      + (typeof post.viewCount === "number" ? post.viewCount : 0) * 0.1;
    return posts.sort((a: any, b: any) => popularity(b) - popularity(a)).slice(0, 5).map((post: any) => ({
      label: stripHtml(post.title),
      meta: [post.community, formatCommunityDate(post.time)].filter(Boolean).join(" · "),
      externalHref: post.url && post.url !== "#" ? post.url : undefined,
      communityName: post.community,
      communityMetric: { label: "좋아요", value: (Number(post.reactionCount) || 0).toLocaleString("ko-KR") },
    }));
  }, [dcinsideQuery.data, ppomppuQuery.data, natepannQuery.data, ruliwebQuery.data, invenQuery.data, bobaedreamQuery.data, humorunivQuery.data]);

  const newsRows = useMemo<TrendRow[]>(() => {
    const news = Array.isArray(newsQuery.data) ? newsQuery.data : [];
    return news.slice(0, 5).map((item: any) => ({
      label: stripHtml(item.title),
      meta: [item.source, item.pubDate ? new Date(item.pubDate).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : null].filter(Boolean).join(" · "),
      image: item.thumbnail,
      tone: "normal" as const,
      externalHref: item.link,
    }));
  }, [newsQuery.data]);

  const cards: TrendCard[] = [
    {
      id: "youtube",
      title: "급상승 영상",
      badge: "급상승 영상",
      href: "/trends/youtube?tab=rising",
      icon: <YouTubeLogo />,
      brandIcon: true,
      rows: youtubeRows,
      loading: youtubeRisingQuery.isLoading,
      emptyText: youtubeRisingQuery.data && "error" in youtubeRisingQuery.data
        ? youtubeRisingQuery.data.error
        : "수집된 급상승 영상이 없습니다.",
    },
    {
      id: "search",
      title: "검색 트렌드",
      badge: "검색량",
      href: "/trends/google",
      icon: <GoogleLogo />,
      brandIcon: true,
      rows: searchRows,
      loading: googleTrendsQuery.isLoading,
      emptyText: "실시간 검색 트렌드를 불러오지 못했습니다.",
    },
    {
      id: "community",
      title: "커뮤니티 트렌드",
      badge: "커뮤니티 트렌드",
      href: "/community",
      icon: <MessageCircleMore className="h-7 w-7 text-sky-400" />,
      rows: communityRows,
      loading: communityLoading,
      emptyText: "커뮤니티 인기글을 불러오지 못했습니다.",
    },
    {
      id: "news",
      title: "뉴스 & 이슈",
      badge: "주요 이슈",
      href: "/news",
      icon: <Newspaper className="h-7 w-7 text-sky-400" />,
      rows: newsRows,
      loading: newsQuery.isLoading,
      emptyText: "최신 뉴스를 불러오지 못했습니다.",
    },
  ];

  return (
    <section className="relative z-[6] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.9)]" />
              <h2 className="text-3xl font-bold text-white">실시간 트렌드 현황</h2>
            </div>
            <p className="text-sm text-slate-400">
              주요 플랫폼과 커뮤니티의 실시간 흐름을 빠르게 확인하세요.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <TrendDashboardCard key={card.id} card={card} onVideoSelect={setSelectedVideo} />
          ))}
        </div>
      </div>
      <YouTubeVideoDetailModal
        video={selectedVideo}
        isOpen={Boolean(selectedVideo)}
        onClose={() => setSelectedVideo(null)}
        useStoredSnapshot
      />
    </section>
  );
}
