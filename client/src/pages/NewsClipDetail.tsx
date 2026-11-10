import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Link, useRoute } from "wouter";
import IssueBody from "@/components/IssueBody";
import IssueDate from "@/components/IssueDate";
import IssueThumbnail from "@/components/IssueThumbnail";
import { supabase } from "@/lib/supabase";

export default function NewsClipDetail() {
  const [, params] = useRoute("/news/clips/:id");
  const id = params?.id;
  const { data: clip, isPending, isError } = useQuery({
    queryKey: ["news-clip", id],
    queryFn: async () => {
      if (!id || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)) return null;
      if (!supabase) throw new Error("Missing news clip storage");
      const { data, error } = await supabase.from("news_clips")
        .select("title,summary,thumbnail_url,thumbnail_credit,created_at").eq("id", id).eq("is_published", true).maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  return (
    <div className="pageContainer issueDetailPage">
      <Link href="/news/clips" className="issueBackButton"><ChevronLeft size={15} aria-hidden="true" />뉴스 클립</Link>
      {isPending ? (
        <p className="issuesStatus" role="status">뉴스 클립을 불러오는 중입니다.</p>
      ) : isError ? (
        <p className="issuesStatus" role="alert">뉴스 클립을 불러오지 못했습니다.</p>
      ) : !clip ? (
        <p className="issuesStatus">공개된 뉴스 클립을 찾을 수 없습니다.</p>
      ) : (
        <article className="issueDetail">
          <header className="issueDetailHeader">
            <h1>{clip.title}</h1>
            <div className="issueDetailMeta">
              <div className="issueDetailByline">
                <IssueDate value={clip.created_at} />
                <span>운영자</span>
              </div>
            </div>
          </header>
          <div className="issueDetailArticle">
            <IssueThumbnail src={clip.thumbnail_url} credit={clip.thumbnail_credit} />
            <div className="issueDetailBody"><IssueBody value={clip.summary} /></div>
          </div>
        </article>
      )}
    </div>
  );
}
