import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import IssueBody from "../client/src/components/IssueBody";
import { issueEditorDocument, stripIssueBodyFormatting } from "../shared/issueBody";
import { ISSUE_DOCUMENT_PREFIX, issueBodyImages, issueFontSize, readIssueDocument, type IssueNode } from "../shared/issueDocument";

const serialize = (doc: IssueNode) => ISSUE_DOCUMENT_PREFIX + JSON.stringify(doc);

describe("rich issue documents", () => {
  it("imports legacy headings, bold, blank lines and tables without losing text", () => {
    const doc = issueEditorDocument("## 소제목\n\n**본문**\n\n| 주주 | 지분 |\n|---|---:|\n| A | 63.23% |");
    expect(doc.content?.map(node => node.type)).toEqual(["heading", "paragraph", "paragraph", "table"]);
    expect(stripIssueBodyFormatting(serialize(doc))).toBe("소제목 본문 주주 지분 A 63.23%");
    const html = renderToStaticMarkup(createElement(IssueBody, { value: serialize(doc) }));
    expect(html).toContain("<h2>소제목</h2>");
    expect(html).toContain("<strong>본문</strong>");
    expect(html).toContain('style="text-align:right"');
  });

  it("round trips numeric font size and inline images while keeping share text clean", () => {
    const doc: IssueNode = { type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "본문", marks: [{ type: "textStyle", attrs: { fontSize: "28px" } }, { type: "bold" }] }] },
      { type: "image", attrs: { src: "https://example.com/body.webp", alt: "이미지" } },
      { type: "paragraph", content: [{ type: "text", text: "다음 문장" }] },
    ] };
    const value = serialize(doc);
    expect(issueEditorDocument(value)).toEqual(doc);
    expect(stripIssueBodyFormatting(value)).toBe("본문 다음 문장");
    expect(issueBodyImages(value)).toEqual(["https://example.com/body.webp"]);
    const html = renderToStaticMarkup(createElement(IssueBody, { value }));
    expect(html).toContain('font-size:28px');
    expect(html).toContain('src="https://example.com/body.webp"');
    expect(html).toContain('<p>다음 문장</p>');
  });

  it("does not render unsafe URLs, arbitrary HTML, CSS or event handlers", () => {
    const value = serialize({ type: "doc", content: [
      { type: "image", attrs: { src: "javascript:alert(1)", onerror: "alert(1)" } },
      { type: "paragraph", content: [{ type: "text", text: "<script>alert(1)</script>", marks: [{ type: "textStyle", attrs: { fontSize: "200px;color:red" } }, { type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
    ] });
    const html = renderToStaticMarkup(createElement(IssueBody, { value }));
    expect(html).not.toContain("<img");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("style=");
    expect(html).toContain("&lt;script&gt;");
    expect(issueBodyImages(value)).toEqual([]);
  });

  it("rejects malformed rich documents and constrains numeric size", () => {
    expect(readIssueDocument(ISSUE_DOCUMENT_PREFIX + '{"type":"doc","content":[{"type":"paragraph","content":"bad"}]}')).toBeNull();
    expect(readIssueDocument(ISSUE_DOCUMENT_PREFIX + "bad JSON")).toBeNull();
    expect(issueFontSize("12px")).toBe("12px");
    expect(issueFontSize("72px")).toBe("72px");
    expect(issueFontSize("73px")).toBeUndefined();
    expect(issueFontSize("-5px")).toBeUndefined();
    expect(stripIssueBodyFormatting(serialize({ type: "doc", content: [{ type: "paragraph" }] }))).toBe("");
  });
});
