import { useMemo, useState } from "react";
import { ArrowRight, Newspaper, Play, Search, Users } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { YouTubeVideoDetailModal } from "@/components/YouTubeVideoDetailModal";
import { trpc } from "@/lib/trpc";

type TrendRow = {
  label: string;
  meta?: string;
  rightValue?: string;
  image?: string | null;
  tone?: "hot" | "normal";
  video?: any;
};

type TrendCard = {
  id: string;
  title: string;
  badge: string;
  href: string;
  icon: React.ReactNode;
  rows: TrendRow[];
  loading: boolean;
  emptyText: string;
};

function compactCount(value?: number | string | null) {
  const numberValue = typeof value === "string" ? Number(value) : value;
  if (!numberValue || Number.isNaN(numberValue)) return null;
  if (numberValue >= 100000000) return `${Math.round(numberValue / 10000000) / 10}억`;
  if (numberValue >= 10000) return `${Math.round(numberValue / 1000) / 10}만`;
  return numberValue.toLocaleString("ko-KR");
}

function stripHtml(value?: string | null) {
  return (value || "").replace(/<[^>]*>/g, "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").trim();
}

function formatRelativeTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return null;

  const diffMs = Date.now() - time;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;

  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function TrendDashboardCard({ card, onVideoSelect }: { card: TrendCard; onVideoSelect?: (video: any) => void }) {
  const [, setLocation] = useLocation();

  return (
    <article className="group relative rounded-lg border border-blue-500/20 bg-slate-950/50 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.22)] transition-colors hover:border-blue-400/40 hover:bg-slate-950/70">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
            {card.icon}
          </div>
          <h3 className="truncate text-lg font-semibold text-white">{card.title}</h3>
        </div>
        <span className="shrink-0 rounded-full border border-blue-500/30 px-3 py-1 text-xs font-semibold text-blue-300">
          {card.badge}
        </span>
      </div>

      <div className="space-y-2">
        {card.loading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex min-h-[61px] items-center gap-3 rounded-md border border-slate-800/70 bg-slate-900/35 p-2.5">
              <div className="h-6 w-6 rounded-full bg-slate-800/80" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-4/5 rounded bg-slate-800/80" />
                <div className="h-2 w-2/5 rounded bg-slate-800/70" />
              </div>
            </div>
          ))
        ) : card.rows.length > 0 ? (
          card.rows.map((row, index) => (
            <div
              key={`${card.id}-${index}-${row.label}`}
              className={`flex min-h-[61px] items-center gap-3 rounded-md border border-slate-800/70 bg-slate-900/25 p-2.5 ${row.video ? "cursor-pointer transition-colors hover:border-blue-400/40 hover:bg-slate-900/55" : ""}`}
              role={row.video ? "button" : undefined}
              tabIndex={row.video ? 0 : undefined}
              onClick={() => {
                if (row.video) onVideoSelect?.(row.video);
              }}
              onKeyDown={(event) => {
                if (!row.video) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onVideoSelect?.(row.video);
                }
              }}
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-200">
                {index + 1}
              </div>
              {row.image && (
                <img
                  src={row.image}
                  alt=""
                  className="h-10 w-14 shrink-0 rounded object-cover"
                  loading="lazy"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">{row.label}</p>
                {row.meta && <p className="mt-1 truncate text-xs text-slate-400">{row.meta}</p>}
              </div>
              {row.rightValue && <span className="shrink-0 text-xs font-bold text-blue-300">{row.rightValue}</span>}
              {row.tone === "hot" && <span className="shrink-0 text-xs font-bold text-red-400">급상승</span>}
            </div>
          ))
        ) : (
          <div className="rounded-md border border-slate-800/70 bg-slate-900/25 p-4 text-sm text-slate-400">
            {card.emptyText}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setLocation(card.href)}
        className="mx-auto mt-3 flex items-center justify-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-blue-200"
      >
        더보기
        <ArrowRight className="h-3 w-3" />
      </button>
    </article>
  );
}

export default function ServiceCards() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [selectedVideo, setSelectedVideo] = useState<any>(null);

  const { data: apiKeyData } = trpc.user.apiKey.getWithStatus.useQuery(
    { provider: "youtube" },
    { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false }
  );

  const canLoadYouTube = Boolean(apiKeyData?.exists && apiKeyData.testStatus === "success");

  const youtubeQuery = trpc.youtube.getTrendingVideos.useQuery(
    { regionCode: "KR", sortBy: "trending", maxResults: 5 },
    { enabled: canLoadYouTube, retry: false, refetchOnWindowFocus: false }
  );

  const googleTrendsQuery = trpc.googleTrends.realtimeTrending.useQuery(
    { country: "KR" },
    { retry: 1, refetchOnWindowFocus: false }
  );

  const communityQuery = trpc.community.getDcinside.useQuery(
    { sort: "popular" },
    { retry: 1, refetchOnWindowFocus: false }
  );

  const newsQuery = trpc.news.getLatestNews.useQuery(
    { category: "all", limit: 5 },
    { retry: 1, refetchOnWindowFocus: false }
  );

  const youtubeRows = useMemo<TrendRow[]>(() => {
    const videos = (youtubeQuery.data as any)?.videos || [];
    return videos.slice(0, 5).map((video: any) => ({
      label: stripHtml(video.title),
      meta: [
        compactCount(video.viewCount) ? `조회수 ${compactCount(video.viewCount)}` : null,
        formatRelativeTime(video.publishedAt),
      ].filter(Boolean).join(" · "),
      image: video.thumbnail,
      video,
    }));
  }, [youtubeQuery.data]);

  const searchRows = useMemo<TrendRow[]>(() => {
    const trends = (googleTrendsQuery.data as any)?.data || [];
    return trends.slice(0, 5).map((item: any) => ({
      label: stripHtml(item.keyword),
      rightValue: item.traffic || "-",
    }));
  }, [googleTrendsQuery.data]);

  const communityRows = useMemo<TrendRow[]>(() => {
    const posts = (communityQuery.data as any)?.data || [];
    return posts.slice(0, 5).map((post: any) => ({
      label: stripHtml(post.title),
      meta: [post.community, post.time, post.commentCount ? `댓글 ${post.commentCount}` : null].filter(Boolean).join(" · "),
    }));
  }, [communityQuery.data]);

  const newsRows = useMemo<TrendRow[]>(() => {
    const news = Array.isArray(newsQuery.data) ? newsQuery.data : [];
    return news.slice(0, 5).map((item: any) => ({
      label: stripHtml(item.title),
      meta: [item.source, item.pubDate ? new Date(item.pubDate).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : null].filter(Boolean).join(" · "),
      image: item.thumbnail,
      tone: "normal" as const,
    }));
  }, [newsQuery.data]);

  const cards: TrendCard[] = [
    {
      id: "youtube",
      title: "YouTube",
      badge: "실시간 인기",
      href: "/trends/youtube",
      icon: <Play className="h-5 w-5" />,
      rows: youtubeRows,
      loading: canLoadYouTube && youtubeQuery.isLoading,
      emptyText: isAuthenticated ? "YouTube API key 연결 후 인기 영상을 표시합니다." : "로그인 후 YouTube API key를 연결하면 인기 영상을 표시합니다.",
    },
    {
      id: "search",
      title: "검색 트렌드",
      badge: "검색량",
      href: "/trends/google",
      icon: <Search className="h-5 w-5" />,
      rows: searchRows,
      loading: googleTrendsQuery.isLoading,
      emptyText: "실시간 검색 트렌드를 불러오지 못했습니다.",
    },
    {
      id: "community",
      title: "커뮤니티 반응",
      badge: "실시간 버즈",
      href: "/community",
      icon: <Users className="h-5 w-5" />,
      rows: communityRows,
      loading: communityQuery.isLoading,
      emptyText: "커뮤니티 인기글을 불러오지 못했습니다.",
    },
    {
      id: "news",
      title: "뉴스 & 이슈",
      badge: "주요 이슈",
      href: "/news",
      icon: <Newspaper className="h-5 w-5" />,
      rows: newsRows,
      loading: newsQuery.isLoading,
      emptyText: "최신 뉴스를 불러오지 못했습니다.",
    },
  ];

  return (
    <section className="px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.9)]" />
              <h2 className="text-3xl font-bold text-white">실시간 트렌드 현황</h2>
            </div>
            <p className="text-sm text-slate-400">
              주요 플랫폼과 커뮤니티의 실시간 흐름을 빠르게 확인하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLocation("/trends/youtube")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-700/70 bg-slate-950/40 px-5 text-sm font-semibold text-slate-300 transition-colors hover:border-blue-400/50 hover:text-blue-200"
          >
            모든 지표 보기
            <ArrowRight className="h-4 w-4" />
          </button>
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
      />
    </section>
  );
}
