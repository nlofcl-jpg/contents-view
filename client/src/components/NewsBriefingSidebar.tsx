import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { issueBriefingLabel, issueFocusLabel } from "@/lib/newsNavigation";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";

const SIDEBAR_LIMIT = 7;

export default function NewsBriefingSidebar({ showBriefings = false }: { showBriefings?: boolean }) {
  const collectionPath = showBriefings ? "/news/clips" : "/news/issues";
  const collectionLabel = showBriefings ? issueBriefingLabel : issueFocusLabel;
  const news = trpc.news.getLatestNews.useQuery({ limit: 30, category: "all" }, {
    retry: 1,
    refetchOnWindowFocus: false,
  });
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
  const latestNews = [...(news.data ?? [])]
    .sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0))
    .filter((item, index, all) => /^https?:\/\//i.test(item.link) && all.findIndex(other => other.link === item.link) === index)
    .slice(0, SIDEBAR_LIMIT);

  return (
    <aside className="newsBriefingSidebar" aria-label={`최신 뉴스와 ${collectionLabel}`}>
      <section className="newsBriefingSidePanel" aria-labelledby="briefing-latest-news">
        <header className="newsBriefingSideHeader">
          <h2 id="briefing-latest-news">최신 뉴스</h2>
          <Link href="/news" className="newsBriefingSideMore" aria-label="최신 뉴스 더보기">
            더보기 <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </header>
        {latestNews.length > 0 ? (
          <ul>
            {latestNews.map(item => (
              <li key={item.link}><a href={item.link} target="_blank" rel="noopener noreferrer" title={item.title}>
                <span>{item.title}</span>
              </a></li>
            ))}
          </ul>
        ) : <p role="status">{news.isPending ? "뉴스를 불러오는 중입니다." : "표시할 최신 뉴스가 없습니다."}</p>}
      </section>
      <section className="newsBriefingSidePanel" aria-labelledby="briefing-latest-issues">
        <header className="newsBriefingSideHeader">
          <h2 id="briefing-latest-issues">최신 {collectionLabel}</h2>
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
    </aside>
  );
}
