import React, { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import type { IssueFocusCategoryId } from "@/lib/issueFocusCategories";
import { supabase } from "@/lib/supabase";

const MAX_RELATED_ISSUES = 5;
const VISIBLE_ISSUES = 3;

type RelatedIssue = {
  id: string;
  title: string;
  article_title: string | null;
  thumbnail_url: string | null;
};

function RelatedIssueCarousel({ issues }: { issues: RelatedIssue[] }) {
  const headingId = useId();
  const viewportId = useId();
  const hasOverflow = issues.length > VISIBLE_ISSUES;
  const startIndex = issues.length === MAX_RELATED_ISSUES ? 1 : 0;
  const [viewportRef, carousel] = useEmblaCarousel({ align: "start", startIndex, watchDrag: hasOverflow });
  const [edges, setEdges] = useState({ previous: startIndex > 0, next: hasOverflow });

  useEffect(() => {
    if (!carousel) return;
    const updateEdges = () => setEdges({ previous: carousel.canScrollPrev(), next: carousel.canScrollNext() });
    updateEdges();
    carousel.on("select", updateEdges).on("reInit", updateEdges);
    return () => {
      carousel.off("select", updateEdges).off("reInit", updateEdges);
    };
  }, [carousel]);

  const slide = (direction: "previous" | "next") => {
    const jump = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (direction === "previous") carousel?.scrollPrev(jump);
    else carousel?.scrollNext(jump);
  };

  return (
    <section className="issueRelatedSection" aria-labelledby={headingId}>
      <div className="issueRelatedHeader">
        <h2 id={headingId}>관련 이슈</h2>
        {hasOverflow && (
          <div className="issueRelatedControls">
            <button type="button" aria-label="이전 관련 이슈" aria-controls={viewportId} disabled={!edges.previous} onClick={() => slide("previous")}>
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button type="button" aria-label="다음 관련 이슈" aria-controls={viewportId} disabled={!edges.next} onClick={() => slide("next")}>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <div
        id={viewportId}
        className={`issueRelatedViewport${hasOverflow ? " hasOverflow" : ""}`}
        ref={viewportRef}
        data-previous={edges.previous}
        data-next={edges.next}
      >
        <ul className="issueRelatedTrack">
          {issues.map(issue => {
            const title = issue.article_title || issue.title;
            return (
              <li className="issueRelatedSlide" key={issue.id}>
                <Link href={`/news/issues/${issue.id}`} className="issueRelatedCard" title={title} onClick={event => {
                  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  const scroller = event.currentTarget.closest(".mainContent");
                  (scroller ?? window).scrollTo({ top: 0, behavior: "instant" });
                }}>
                  {issue.thumbnail_url
                    ? <img className="issueRelatedThumbnail" src={issue.thumbnail_url} alt="" loading="lazy" draggable={false} />
                    : <span className="issueRelatedThumbnail issueCardImageFallback" aria-hidden="true" />}
                  <span className="issueRelatedTitle">{title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export default function RelatedFocusIssues({ issueId, category }: { issueId: string; category: IssueFocusCategoryId }) {
  const { data } = useQuery({
    queryKey: ["related-focus-issues", issueId, category],
    queryFn: async ({ signal }) => {
      if (!supabase) return [];
      const { data, error } = await supabase.from("issues")
        .select("id,title,article_title,thumbnail_url")
        .eq("is_published", true)
        .eq("category", category)
        .neq("id", issueId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(MAX_RELATED_ISSUES)
        .abortSignal(signal);
      if (error) throw error;
      return data as RelatedIssue[];
    },
    staleTime: 60_000,
    retry: false,
  });

  return data?.length ? <RelatedIssueCarousel key={issueId} issues={data} /> : null;
}
