import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUp, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";
import { supabase } from "@/lib/supabase";
import { loadKakaoSdk, shareIssueOnKakao } from "@/lib/kakaoShare";
import IssueBody from "@/components/IssueBody";

type IssueDetailRecord = {
  id: string;
  title: string;
  summary: string;
  thumbnail_url: string | null;
  article_title: string | null;
  article_summary: string | null;
  created_at: string;
};

export default function IssueDetail() {
  const [, params] = useRoute("/news/issues/:id");
  const [, setLocation] = useLocation();
  const [issue, setIssue] = useState<IssueDetailRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [kakaoSdkStatus, setKakaoSdkStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!supabase || !params?.id) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    supabase
      .from("issues")
      .select("id,title,summary,thumbnail_url,article_title,article_summary,created_at")
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

  useEffect(() => {
    if (!issue || !import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY) return;
    let cancelled = false;
    setKakaoSdkStatus("loading");
    loadKakaoSdk()
      .then(() => { if (!cancelled) setKakaoSdkStatus("ready"); })
      .catch(() => { if (!cancelled) setKakaoSdkStatus("error"); });
    return () => { cancelled = true; };
  }, [issue]);

  const handleKakaoShare = () => {
    if (!issue) return;
    if (kakaoSdkStatus === "error") {
      toast.error("카카오톡 공유를 불러오지 못했습니다. 페이지를 새로고침해 주세요.");
      return;
    }
    try {
      shareIssueOnKakao(issue);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "카카오톡 공유를 시작하지 못했습니다.");
    }
  };

  return (
    <div className="pageContainer issueDetailPage">
      <button type="button" className="issueBackButton" onClick={() => setLocation("/news/issues")}>
        <ArrowLeft size={15} aria-hidden="true" />
        뉴스 & 이슈
      </button>

      {isLoading ? (
        <p className="issuesStatus">이슈를 불러오는 중입니다.</p>
      ) : !issue ? (
        <p className="issuesStatus">이슈를 찾을 수 없습니다.</p>
      ) : (
        <article className="issueDetail">
          <header className="issueDetailHeader">
            <h1>{issue.article_title || issue.title}</h1>
            <div className="issueDetailMeta">
              <time dateTime={issue.created_at}>
                {new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(issue.created_at))}
              </time>
              <button
                type="button"
                className="issueKakaoShareButton"
                onClick={handleKakaoShare}
                disabled={kakaoSdkStatus === "loading"}
                title="카카오톡으로 공유"
                aria-label="카카오톡으로 이슈 공유"
              >
                {kakaoSdkStatus === "loading" ? (
                  <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M12 3.5c-5.1 0-9.2 3.18-9.2 7.1 0 2.5 1.67 4.7 4.19 5.96l-.7 2.78c-.06.23.2.42.39.28l3.32-2.22c.65.1 1.32.15 2 .15 5.1 0 9.2-3.18 9.2-7.1s-4.1-6.95-9.2-6.95Z" />
                  </svg>
                )}
              </button>
            </div>
          </header>
          <div className="issueDetailArticle">
            {issue.thumbnail_url && (
              <img className="issueDetailImage" src={issue.thumbnail_url} alt="" />
            )}
            {(issue.summary || issue.article_summary) && (
              <IssueBody value={issue.summary || issue.article_summary || ""} />
            )}
            <button
              type="button"
              className="issueScrollTopButton"
              onClick={(event) => event.currentTarget.closest(".mainContent")?.scrollTo({ top: 0, behavior: "smooth" })}
              title="맨 위로"
              aria-label="맨 위로"
            >
              <ArrowUp size={14} aria-hidden="true" />
            </button>
          </div>
        </article>
      )}
    </div>
  );
}
