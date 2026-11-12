import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_BANNER, getBannerLink } from "../shared/siteBanner";

describe("site banner links", () => {
  it("keeps the default announcement unlinked", () => {
    expect(DEFAULT_SITE_BANNER.message).toBe("컨텐츠뷰에 가입 하고 다양한 컨텐츠 트렌드를 한 곳에서 확인하세요.");
    expect(getBannerLink(DEFAULT_SITE_BANNER.link_url)).toBeNull();
  });

  it("supports internal paths and HTTPS links", () => {
    expect(getBannerLink(" /news/search?keyword=clip#result ")).toBe("/news/search?keyword=clip#result");
    expect(getBannerLink("https://example.com/news")).toBe("https://example.com/news");
  });

  it.each(["", "javascript:alert(1)", "data:text/html,test", "http://example.com", "//example.com", "/\\example.com", "/\texample.com", "https://", "https://user:pass@example.com", "/" + "a".repeat(500)])("rejects unsafe, empty, or oversized links: %s", (url) => {
    expect(getBannerLink(url)).toBeNull();
  });
});
