import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NewsClips from "../client/src/pages/NewsClips";
import NewsClipDetail from "../client/src/pages/NewsClipDetail";
import { getActiveNewsPath } from "../client/src/lib/newsNavigation";

vi.mock("../client/src/lib/supabase", () => ({ supabase: null }));

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
    expect(html).not.toContain("제목 예시");
  });

  it("renders the detail body and retains the active parent tab", () => {
    const path = `/news/clips/${id}`;
    const html = renderPage(NewsClipDetail, path, ["news-clip", id], clip);
    expect(html).toContain("<h1>뉴스 클립 테스트</h1>");
    expect(html).toContain("클립 본문");
    expect(html).toContain('href="/news/clips"');
    expect(getActiveNewsPath(path)).toBe("/news/clips");
  });

  it("shows a not-found state for unpublished or missing clips", () => {
    const html = renderPage(NewsClipDetail, `/news/clips/${id}`, ["news-clip", id], null);
    expect(html).toContain("공개된 뉴스 클립을 찾을 수 없습니다.");
  });
});
