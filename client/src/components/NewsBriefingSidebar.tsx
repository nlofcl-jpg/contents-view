import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "wouter";
import LatestNewsInfo from "@/components/LatestNewsInfo";
import { issueBriefingLabel, issueFocusLabel } from "@/lib/newsNavigation";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";

const SIDEBAR_LIMIT = 7;
const SIDEBAR_NEWS_CACHE_KEY = "contents-view-sidebar-news-v1";
const SIDEBAR_NEWS_MAX_AGE = 30 * 60_000;
type SidebarNewsItem = { title: string; link: string };

function readSidebarNews(): { items: SidebarNewsItem[]; at: number } | null {
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(SIDEBAR_NEWS_CACHE_KEY) ?? "null");
    if (!cached || !Number.isFinite(cached.at) || Date.now() - cached.at >= SIDEBAR_NEWS_MAX_AGE
      || !Array.isArray(cached.items) || !cached.items.every((item: SidebarNewsItem) =>
        item && typeof item.title === "string" && typeof item.link === "string" && /^https?:\/\//i.test(item.link))) return null;
    return { items: cached.items.slice(0, SIDEBAR_LIMIT), at: cached.at };
  } catch {
    return null;
  }
}

export default function NewsBriefingSidebar({
  showBriefings = false,
  collectionsOnly = false,
}: { showBriefings?: boolean; collectionsOnly?: boolean }) {
  return (
    <aside className="newsBriefingSidebar" aria-label={
      collectionsOnly ? `${issueFocusLabel}와 ${issueBriefingLabel}`
        : `최신 뉴스와 ${showBriefings ? issueBriefingLabel : issueFocusLabel}`
    }>
      {collectionsOnly ? <IssueCollectionPanel showBriefings={false} /> : <LatestNewsPanel />}
      <IssueCollectionPanel showBriefings={collectionsOnly || showBriefings} />
    </aside>
  );
}

function LatestNewsPanel() {
  const [lastNews, setLastNews] = useState(readSidebarNews);
  const news = trpc.news.getLatestNews.useQuery({ limit: 30, category: "all" }, {
    retry: 1,
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
  });
  const latestNews = useMemo(() => (news.data ?? [])
      .filter(item => /^https?:\/\//i.test(item.link))
      .sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0))
      .filter((item, index, all) => all.findIndex(other => other.link === item.link) === index)
      .slice(0, SIDEBAR_LIMIT)
      .map(({ title, link }) => ({ title, link })), [news.data]);
  useEffect(() => {
    if (!latestNews.length) return;
    const snapshot = { items: latestNews, at: news.dataUpdatedAt || Date.now() };
    setLastNews(snapshot);
    try {
      window.sessionStorage.setItem(SIDEBAR_NEWS_CACHE_KEY, JSON.stringify(snapshot));
    } catch {
      // Keep the in-memory snapshot when session storage is unavailable.
    }
  }, [latestNews, news.dataUpdatedAt]);
  const visibleNews = latestNews.length > 0 ? latestNews
    : lastNews && Date.now() - lastNews.at < SIDEBAR_NEWS_MAX_AGE ? lastNews.items : [];

  return (
      <section className="newsBriefingSidePanel" aria-labelledby="briefing-latest-news">
        <header className="newsBriefingSideHeader">
          <div className="flex min-w-0 items-center gap-1">
            <h2 id="briefing-latest-news">최신 뉴스</h2>
            <LatestNewsInfo />
          </div>
          <Link href="/news" className="newsBriefingSideMore" aria-label="최신 뉴스 더보기">
            더보기 <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </header>
        {visibleNews.length > 0 ? (
          <ul>
            {visibleNews.map(item => (
              <li key={item.link}><a href={item.link} target="_blank" rel="noopener noreferrer" title={item.title}>
                <span>{item.title}</span>
              </a></li>
            ))}
          </ul>
        ) : news.isFetching || news.isPending ? (
          <p role="status">뉴스를 불러오는 중입니다.</p>
        ) : (
          <>
            <p role="status">최신 뉴스를 불러오지 못했습니다.</p>
            <button type="button" className="mt-2 text-xs text-blue-300 hover:text-blue-200" onClick={() => void news.refetch()}>
              다시 불러오기
            </button>
          </>
        )}
      </section>
  );
}

function IssueCollectionPanel({ showBriefings }: { showBriefings: boolean }) {
  const collectionPath = showBriefings ? "/news/clips" : "/news/issues";
  const collectionLabel = showBriefings ? issueBriefingLabel : issueFocusLabel;
  const headingId = showBriefings ? "sidebar-latest-briefings" : "sidebar-latest-focus";
  const issues = useQuery({
    queryKey: ["news-sidebar-entries", collectionPath],
    queryFn: async () => {
      if (!supabase) throw new Error("Missing issue storage");
      if (showBriefings) {
        const { data, error } = await supabase.from("news_clips").select("id,title")
          .eq("is_published", true).order("created_at", { ascending: false }).order("id", { ascending: false })
          .limit(SIDEBAR_LIMIT);
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from("issues").select("id,title,article_title,thumbnail_url")
        .eq("is_published", true).order("created_at", { ascending: false }).order("id", { ascending: false })
        .limit(SIDEBAR_LIMIT);
      if (error) throw error;
      return data.map(issue => ({ ...issue, title: issue.article_title || issue.title }));
    },
    retry: false,
  });

  return (
      <section className="newsBriefingSidePanel" aria-labelledby={headingId}>
        <header className="newsBriefingSideHeader">
          <h2 id={headingId}>최신 {collectionLabel}</h2>
          <Link
            href={collectionPath}
            className="newsBriefingSideMore"
            aria-label={`${collectionLabel} 더보기`}
            onClick={event => {
              if (!window.matchMedia("(width < 960px)").matches) return;
              const scroller = event.currentTarget.closest<HTMLElement>(".mainContent");
              (scroller ?? window).scrollTo({ top: 0, behavior: "instant" });
            }}
          >
            더보기 <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </header>
        {issues.data?.length ? (
          <ul>
            {issues.data.map(issue => {
              const title = issue.title;
              return (
                <li key={issue.id}><Link href={`${collectionPath}/${issue.id}`} title={title}>
                  {!showBriefings && (
                    "thumbnail_url" in issue && typeof issue.thumbnail_url === "string" && issue.thumbnail_url
                      ? <img className="newsBriefingSideThumbnail" src={issue.thumbnail_url} loading="lazy" alt="" />
                      : <span className="newsBriefingSideThumbnail issueCardImageFallback" aria-hidden="true" />
                  )}
                  <span>{title}</span>
                </Link></li>
              );
            })}
          </ul>
        ) : <p role="status">{issues.isPending ? `${collectionLabel} 목록을 불러오는 중입니다.` : issues.isError ? `${collectionLabel} 목록을 불러오지 못했습니다.` : `공개된 ${collectionLabel} 글이 없습니다.`}</p>}
      </section>
  );
}
