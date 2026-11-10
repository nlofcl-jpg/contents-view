import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import IssueDate from "@/components/IssueDate";
import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 20;

export default function NewsClips() {
  const [page, setPage] = useState(0);
  const { data, isPending, isError } = useQuery({
    queryKey: ["news-clips", page],
    queryFn: async () => {
      if (!supabase) throw new Error("Missing news clip storage");
      const { data, error } = await supabase.from("news_clips").select("id,title,created_at")
        .eq("is_published", true).order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  return (
    <div className="pageContainer newsPageContainer newsClipsPage">
      <header className="pageHeader">
        <h1 className="pageTitle">뉴스 트렌드</h1>
      </header>
      {isPending ? (
        <p className="issuesStatus" role="status">뉴스 클립을 불러오는 중입니다.</p>
      ) : isError ? (
        <p className="issuesStatus" role="alert">뉴스 클립을 불러오지 못했습니다.</p>
      ) : !data?.length ? (
        <p className="issuesStatus">공개된 뉴스 클립이 없습니다.</p>
      ) : (
        <ul className="newsClipsList" aria-label="뉴스 클립 목록">
          {data.slice(0, PAGE_SIZE).map(clip => (
            <li key={clip.id}>
              <Link href={`/news/clips/${clip.id}`} className="newsClipRow">
                <span className="newsClipLabel">[뉴스 클립]</span>
                <span className="newsClipTitle" title={clip.title}>{clip.title}</span>
                <div className="newsClipMeta">
                  <IssueDate value={clip.created_at} />
                  <span>운영자</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {(page > 0 || (data?.length ?? 0) > PAGE_SIZE) && (
        <nav className="issuePagination" aria-label="뉴스 클립 페이지 이동">
          <button type="button" aria-label="이전 페이지" disabled={page === 0} onClick={() => setPage(current => current - 1)}><ChevronLeft size={16} /></button>
          <span>{page + 1}</span>
          <button type="button" aria-label="다음 페이지" disabled={(data?.length ?? 0) <= PAGE_SIZE} onClick={() => setPage(current => current + 1)}><ChevronRight size={16} /></button>
        </nav>
      )}
    </div>
  );
}
