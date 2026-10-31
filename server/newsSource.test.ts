import { describe, expect, it } from "vitest";
import iconv from "iconv-lite";
import { parseNewsSource } from "./newsSource";

describe("news publisher metadata", () => {
  it("reads UTF-8 and reordered attributes with decoded entities", () => {
    expect(parseNewsSource(Buffer.from('<meta content="뉴스 &amp; 미디어" data-test="1" property="og:site_name">'))).toBe("뉴스 & 미디어");
  });

  it("detects EUC-KR from an HTML charset declaration", () => {
    const html = '<meta charset="euc-kr"><meta property="og:site_name" content="한국일보">';
    expect(parseNewsSource(iconv.encode(html, "euc-kr"))).toBe("한국일보");
  });

  it("uses the HTTP charset for legacy Korean pages", () => {
    const html = '<meta name="application-name" content="서울신문">';
    expect(parseNewsSource(iconv.encode(html, "cp949"), "text/html; charset=EUC-KR")).toBe("서울신문");
  });

  it("rejects broken publisher strings and tries the next metadata field", () => {
    expect(parseNewsSource(Buffer.from('<meta property="og:site_name" content="��깨진이름"><meta name="application-name" content="정상뉴스">'))).toBe("정상뉴스");
  });

  it("rejects article-length metadata rather than displaying it as a publisher", () => {
    expect(parseNewsSource(Buffer.from(`<meta property="og:site_name" content="${"잘못된 기사 설명 ".repeat(10)}">`))).toBeNull();
  });

  it("does not infer a publisher from an article title or URL", () => {
    expect(parseNewsSource(Buffer.from('<title>최불암 관련 뉴스</title><meta property="og:site_name" content="https://example.com">'))).toBeNull();
  });
});
