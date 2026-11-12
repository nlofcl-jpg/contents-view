import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NewsClips from "../client/src/pages/NewsClips";
import NewsClipDetail from "../client/src/pages/NewsClipDetail";
import NewsTrendHeader from "../client/src/components/NewsTrendHeader";
import NewsBriefingSidebar from "../client/src/components/NewsBriefingSidebar";
import { getActiveNewsPath } from "../client/src/lib/newsNavigation";

vi.mock("../client/src/lib/supabase", () => ({ supabase: null }));
vi.mock("../client/src/lib/trpc", () => ({
  trpc: { news: { getLatestNews: { useQuery: () => ({
    data: Array.from({ length: 8 }, (_, index) => ({
      title: `기사 ${index + 1}번`,
      link: `https://example.com/news/${index + 1}`,
      pubDate: `2026-11-0${index + 1}T00:00:00Z`,
    })),
  }) } } },
}));

const id = "00000000-0000-0000-0000-000000000001";
const clip = {
  id, title: "뉴스 클립 테스트", summary: "클립 본문",
  thumbnail_url: null, thumbnail_credit: null, created_at: "2026-11-10T00:00:00Z",
};

function renderPage(Page: React.ComponentType, path: string, key: readonly unknown[], data: unknown) {
  const client = new QueryClient();
  client.setQueryData(key, data);
  try {
    return renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(Router, { ssrPath: path }, React.createElement(Page)),
    ));
  } finally {
    client.clear();
  }
}

describe("news clips pages", () => {
  beforeEach(() => vi.stubGlobal("React", React));
  afterEach(() => vi.unstubAllGlobals());

  it("links a published clip from its list row to the detail page", () => {
    const html = renderPage(NewsClips, "/news/clips", ["news-clips", 0], [clip]);
    expect(html).toContain(`href="/news/clips/${id}"`);
    expect(html).toContain("[이슈 브리핑]");
    expect(html).toContain("2026.11.10");
    expect(html).toContain("운영자");
    expect(html).toContain('class="pageDescription"');
    expect(html).not.toContain("제목 예시");
  });

  it("keeps the briefing list at ten and shows seven recent news links", () => {
    const clips = Array.from({ length: 11 }, (_, index) => ({ ...clip, id: `clip-${index}` }));
    const html = renderPage(NewsClips, "/news/clips", ["news-clips", 0], clips);
    expect(html.match(/class="newsClipRow"/g)).toHaveLength(10);
    expect(html).toContain('aria-label="다음 페이지"');
    expect(html.indexOf('aria-label="다음 페이지"')).toBeLessThan(html.indexOf("<aside"));
    expect(html.match(/href="https:\/\/example\.com\/news\//g)).toHaveLength(7);
    expect(html.indexOf("기사 8번")).toBeLessThan(html.indexOf("기사 2번"));
    expect(html).not.toContain("기사 1번");
    expect(html).toContain("최신 이슈 포커스");
  });

  it("shows linked briefing titles without thumbnails in the issue focus sidebar", () => {
    const Sidebar = () => React.createElement(NewsBriefingSidebar, { showBriefings: true });
    const html = renderPage(Sidebar, "/news/issues", ["news-sidebar-entries", "/news/clips"], [
      { ...clip, thumbnail_url: "https://example.com/thumbnail.jpg" },
    ]);
    expect(html).toContain('id="briefing-latest-issues">최신 이슈 브리핑');
    expect(html).toMatch(/<a(?=[^>]*href="\/news\/clips")(?=[^>]*aria-label="이슈 브리핑 더보기")[^>]*>/);
    expect(html).toMatch(/<a(?=[^>]*href="\/news")(?=[^>]*aria-label="최신 뉴스 더보기")[^>]*>/);
    expect(html).toContain(`href="/news/clips/${id}"`);
    expect(html).toContain(`<span>${clip.title}</span>`);
    expect(html).not.toContain("thumbnail.jpg");
  });

  it.each([
    ["/news", "최신 뉴스"],
    ["/news/issues", "이슈 포커스"],
    ["/news/clips", "이슈 브리핑"],
    ["/news/search", "뉴스 검색"],
  ])("renders the section title and active filter tab on %s", (path, title) => {
    const html = renderPage(NewsTrendHeader, path, [], null);
    expect(html).toContain(`<h1 class="pageTitle">${title}</h1>`);
    expect(html).toContain('<nav class="tabMenu newsTrendTabMenu"');
    expect(html).toMatch(new RegExp(`<a(?=[^>]*href="${path}")(?=[^>]*aria-current="page")(?=[^>]*class="tabButton active")[^>]*>`));
  });

  it("renders the detail body and retains the active parent tab", () => {
    const path = `/news/clips/${id}`;
    const html = renderPage(NewsClipDetail, path, ["news-clip", id], clip);
    expect(html).toContain("<h1>뉴스 클립 테스트</h1>");
    expect(html).toContain("클립 본문");
    expect(html).toContain('href="/news/clips"');
    expect(html).toMatch(/class="issueBackButton"[^>]*>.*?<\/svg>이슈 브리핑<\/a>/);
    expect(html).not.toContain("뉴스 트렌드 하위 메뉴");
    expect(getActiveNewsPath(path)).toBe("/news/clips");
  });

  it("shows a not-found state for unpublished or missing clips", () => {
    const html = renderPage(NewsClipDetail, `/news/clips/${id}`, ["news-clip", id], null);
    expect(html).toContain("공개된 뉴스 클립을 찾을 수 없습니다.");
  });
});
