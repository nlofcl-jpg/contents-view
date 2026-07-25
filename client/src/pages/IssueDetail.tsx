import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { supabase } from "@/lib/supabase";

type IssueDetailRecord = {
  id: string;
  title: string;
  summary: string;
  article_url: string | null;
  thumbnail_url: string | null;
  source_name: string | null;
  article_title: string | null;
  article_summary: string | null;
  created_at: string;
};

export default function IssueDetail() {
  const [, params] = useRoute("/news/issues/:id");
  const [, setLocation] = useLocation();
  const [issue, setIssue] = useState<IssueDetailRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !params?.id) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    supabase
      .from("issues")
      .select("id,title,summary,article_url,thumbnail_url,source_name,article_title,article_summary,created_at")
      .eq("id", params.id)
      .eq("is_published", true)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setIssue(data as IssueDetailRecord | null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params?.id]);

  return (
    <div className="pageContainer issueDetailPage">
      <button type="button" className="issueBackButton" onClick={() => setLocation("/news")}>
        <ArrowLeft size={15} aria-hidden="true" />
        뉴스 & 이슈
      </button>

      {isLoading ? (
        <p className="issuesStatus">이슈를 불러오는 중입니다.</p>
      ) : !issue ? (
        <p className="issuesStatus">이슈를 찾을 수 없습니다.</p>
      ) : (
        <article className="issueDetail">
          {issue.thumbnail_url && (
            <img className="issueDetailImage" src={issue.thumbnail_url} alt="" />
          )}
          <div className="issueDetailContent">
            <span className="issueCardSource">{issue.source_name || "이슈"}</span>
            <h1>{issue.title}</h1>
            {issue.summary && <p className="issueDetailSummary">{issue.summary}</p>}
            {(issue.article_title || issue.article_summary) && (
              <section className="issueArticleReference">
                <span>관련 원문 기사</span>
                {issue.article_title && <h2>{issue.article_title}</h2>}
                {issue.article_summary && <p>{issue.article_summary}</p>}
              </section>
            )}
            {issue.article_url && (
              <a
                className="issueOriginalLink"
                href={issue.article_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                원문 보기
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            )}
          </div>
        </article>
      )}
    </div>
  );
}
