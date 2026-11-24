import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Link, useRoute } from "wouter";
import IssueBody from "@/components/IssueBody";
import IssueDate from "@/components/IssueDate";
import IssueThumbnail from "@/components/IssueThumbnail";
import NewsAttachment from "@/components/NewsAttachment";
import NewsBriefingSidebar from "@/components/NewsBriefingSidebar";
import { supabase } from "@/lib/supabase";
import { loadWithNewsAttachments } from "@/lib/newsAttachments";
import { issueClippingLabel } from "@/lib/newsNavigation";

type NewsClipDetailRecord = {
  title: string;
  summary: string;
  thumbnail_url: string | null;
  thumbnail_credit: string | null;
  attachment_path?: string | null;
  attachment_name?: string | null;
  created_at: string;
};

export default function NewsClipDetail() {
  const [, params] = useRoute("/news/clips/:id");
  const id = params?.id;
  const { data: clip, isPending, isError } = useQuery({
    queryKey: ["news-clip", id],
    queryFn: async () => {
      if (!id || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)) return null;
      const storage = supabase;
      if (!storage) throw new Error("Missing news clip storage");
      const { data, error } = await loadWithNewsAttachments(attachmentColumns => storage.from("news_clips")
        .select("title,summary,thumbnail_url,thumbnail_credit,created_at" + attachmentColumns).eq("id", id).eq("is_published", true)
        .maybeSingle().overrideTypes<NewsClipDetailRecord, { merge: false }>());
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  return (
    <div className="pageContainer issueDetailPage">
      <Link href="/news/clips" className="issueBackButton"><ChevronLeft size={15} aria-hidden="true" />{issueClippingLabel}</Link>
      {isPending ? (
        <p className="issuesStatus" role="status">{issueClippingLabel}을 불러오는 중입니다.</p>
      ) : isError ? (
        <p className="issuesStatus" role="alert">{issueClippingLabel}을 불러오지 못했습니다.</p>
      ) : !clip ? (
        <p className="issuesStatus">공개된 {issueClippingLabel}을 찾을 수 없습니다.</p>
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
          <div className="issueDetailArticle newsBriefingLayout">
            <div className="min-w-0">
              <IssueThumbnail src={clip.thumbnail_url} credit={clip.thumbnail_credit} />
              <div className="issueDetailBody"><IssueBody value={clip.summary} /></div>
              {clip.attachment_path && clip.attachment_name && <NewsAttachment path={clip.attachment_path} name={clip.attachment_name} />}
            </div>
            <NewsBriefingSidebar />
          </div>
        </article>
      )}
    </div>
  );
}
