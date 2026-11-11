import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { issueFocusLabel } from "@/lib/newsNavigation";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";

const SIDEBAR_LIMIT = 7;

export default function NewsBriefingSidebar() {
  const news = trpc.news.getLatestNews.useQuery({ limit: 30, category: "all" }, {
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const issues = useQuery({
    queryKey: ["news-briefing-latest-issues"],
    queryFn: async () => {
      if (!supabase) throw new Error("Missing issue storage");
      const { data, error } = await supabase.from("issues").select("id,title,article_title,thumbnail_url")
        .eq("is_published", true).order("created_at", { ascending: false }).order("id", { ascending: false })
        .limit(SIDEBAR_LIMIT);
      if (error) throw error;
      return data;
    },
    retry: false,
  });
  const latestNews = [...(news.data ?? [])]
    .sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0))
    .filter((item, index, all) => /^https?:\/\//i.test(item.link) && all.findIndex(other => other.link === item.link) === index)
    .slice(0, SIDEBAR_LIMIT);

  return (
    <aside className="newsBriefingSidebar" aria-label="최신 뉴스와 이슈 포커스">
      <section className="newsBriefingSidePanel" aria-labelledby="briefing-latest-news">
        <h2 id="briefing-latest-news"><Link href="/news">최신 뉴스</Link></h2>
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
        <h2 id="briefing-latest-issues"><Link href="/news/issues">최신 {issueFocusLabel}</Link></h2>
        {issues.data?.length ? (
          <ul>
            {issues.data.map(issue => {
              const title = issue.article_title || issue.title;
              return (
                <li key={issue.id}><Link href={`/news/issues/${issue.id}`} title={title}>
                  {issue.thumbnail_url
                    ? <img className="newsBriefingSideThumbnail" src={issue.thumbnail_url} loading="lazy" alt="" />
                    : <span className="newsBriefingSideThumbnail issueCardImageFallback" aria-hidden="true" />}
                  <span>{title}</span>
                </Link></li>
              );
            })}
          </ul>
        ) : <p role="status">{issues.isPending ? "이슈를 불러오는 중입니다." : issues.isError ? "이슈를 불러오지 못했습니다." : "공개된 이슈가 없습니다."}</p>}
      </section>
    </aside>
  );
}
