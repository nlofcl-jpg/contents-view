import { describe, expect, it } from "vitest";
import { buildIssueKakaoFeed } from "../client/src/lib/kakaoShare";

describe("buildIssueKakaoFeed", () => {
  it("uses the selected issue's displayed content and links to its detail page", () => {
    const feed = buildIssueKakaoFeed({
      id: "issue-123",
      title: "초안 제목",
      article_title: "원문 제목",
      summary: "공개 요약\n두 번째 문장",
      article_summary: "다른 요약",
      thumbnail_url: "https://example.com/issue.jpg",
    });

    expect(feed.objectType).toBe("feed");
    expect(feed.content).toMatchObject({
      title: "원문 제목",
      description: "공개 요약 두 번째 문장",
      imageUrl: "https://example.com/issue.jpg",
      imageWidth: 800,
      imageHeight: 400,
      link: {
        webUrl: "https://contents-view-chi.vercel.app/news/issues/issue-123",
        mobileWebUrl: "https://contents-view-chi.vercel.app/news/issues/issue-123",
      },
    });
    expect(feed.buttons).toEqual([{ title: "전체 보기", link: feed.content.link }]);
    expect(feed.itemContent.profileText).toBe("CONTENTS VIEW");
  });

  it("falls back to the service image when an issue has no usable thumbnail", () => {
    const feed = buildIssueKakaoFeed({
      id: "second-issue",
      title: "두 번째 이슈",
      article_title: null,
      summary: null,
      article_summary: "기사 요약",
      thumbnail_url: "http://example.com/insecure.jpg",
    });

    expect(feed.content.title).toBe("두 번째 이슈");
    expect(feed.content.description).toBe("기사 요약");
    expect(feed.content.imageUrl).toBe("https://contents-view-chi.vercel.app/contents-view-symbol.png");
    expect(feed.content.imageWidth / feed.content.imageHeight).toBe(2);
    expect(feed.content.link.webUrl).toContain("/news/issues/second-issue");
  });
});
