import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import IssueBody from "../client/src/components/IssueBody";
import { issueEditorDocument, stripIssueBodyFormatting } from "../shared/issueBody";
import { ISSUE_DOCUMENT_PREFIX, issueBodyImages, issueFontColor, issueFontSize, readIssueDocument, type IssueNode } from "../shared/issueDocument";

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

  it("round trips numeric size, color and inline images while keeping share text clean", () => {
    const doc: IssueNode = { type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "본문", marks: [{ type: "textStyle", attrs: { fontSize: "28px", color: "#38bdf8" } }, { type: "bold" }] }] },
      { type: "image", attrs: { src: "https://example.com/body.webp", alt: "이미지" } },
      { type: "paragraph", content: [{ type: "text", text: "다음 문장" }] },
    ] };
    const value = serialize(doc);
    expect(issueEditorDocument(value)).toEqual(doc);
    expect(stripIssueBodyFormatting(value)).toBe("본문 다음 문장");
    expect(issueBodyImages(value)).toEqual(["https://example.com/body.webp"]);
    const html = renderToStaticMarkup(createElement(IssueBody, { value }));
    expect(html).toContain('<strong><span style="font-size:28px;color:#38bdf8">본문</span></strong>');
    expect(html).toContain('src="https://example.com/body.webp"');
    expect(html).toContain('<p>다음 문장</p>');
  });

  it("does not render unsafe URLs, arbitrary HTML, CSS or event handlers", () => {
    const value = serialize({ type: "doc", content: [
      { type: "image", attrs: { src: "javascript:alert(1)", onerror: "alert(1)" } },
      { type: "paragraph", content: [{ type: "text", text: "<script>alert(1)</script>", marks: [{ type: "textStyle", attrs: { fontSize: "200px;color:red", color: "#fff;display:none" } }, { type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
    ] });
    const html = renderToStaticMarkup(createElement(IssueBody, { value }));
    expect(html).not.toContain("<img");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("style=");
    expect(html).toContain("&lt;script&gt;");
    expect(issueBodyImages(value)).toEqual([]);
  });

  it("normalizes safe pasted colors and discards unsafe or unsupported CSS", () => {
    expect(issueFontColor("#ABC")).toBe("#aabbcc");
    expect(issueFontColor("rgb(0, 128, 255)")).toBe("#0080ff");
    for (const color of ["#fff;display:none", "rgb(256, 0, 0)", "url(https://example.com/a)", "var(--x)"]) {
      expect(issueFontColor(color)).toBeUndefined();
    }
  });

  it("rejects malformed rich documents and constrains numeric size", () => {
    expect(readIssueDocument(ISSUE_DOCUMENT_PREFIX + '{"type":"doc","content":[{"type":"paragraph","content":"bad"}]}')).toBeNull();
    expect(readIssueDocument(ISSUE_DOCUMENT_PREFIX + "bad JSON")).toBeNull();
    expect(issueFontSize("10px")).toBe("10px");
    expect(issueFontSize("12px")).toBe("12px");
    expect(issueFontSize("72px")).toBe("72px");
    expect(issueFontSize("73px")).toBeUndefined();
    expect(issueFontSize("9px")).toBeUndefined();
    expect(issueFontSize("-5px")).toBeUndefined();
    expect(stripIssueBodyFormatting(serialize({ type: "doc", content: [{ type: "paragraph" }] }))).toBe("");
  });

  it("activates plain URLs even when saved before entering a space", () => {
    const value = serialize({ type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "관련 내용: https://example.com/news?id=1", marks: [{ type: "bold" }] },
    ] }] });
    const html = renderToStaticMarkup(createElement(IssueBody, { value }));
    expect(html).toContain('href="https://example.com/news?id=1" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain("<strong>관련 내용:");
  });

  it("keeps existing link marks without nesting links or linking code", () => {
    const value = serialize({ type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "https://example.com", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
      { type: "text", text: "https://example.org", marks: [{ type: "code" }] },
    ] }] });
    const html = renderToStaticMarkup(createElement(IssueBody, { value }));
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain("<code>https://example.org</code>");
  });
});
