import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import IssueBody from "../client/src/components/IssueBody";
import { formatIssueBodyLines, parseIssueBodyLine, stripIssueBodyFormatting } from "../shared/issueBody";

describe("issue body formatting", () => {
  it("keeps existing plain text as body text", () => {
    expect(parseIssueBodyLine("기존 이슈 본문")).toEqual({ size: "body", text: "기존 이슈 본문" });
  });

  it("changes a selected line between body and heading sizes", () => {
    const heading = formatIssueBodyLines("첫 문장\n소제목\n끝 문장", 6, 6, "subtitle");
    expect(heading.value).toBe("첫 문장\n### 소제목\n끝 문장");
    expect(formatIssueBodyLines(heading.value, heading.selectionStart, heading.selectionEnd, "body").value)
      .toBe("첫 문장\n소제목\n끝 문장");
  });

  it("removes formatting from list and share descriptions", () => {
    expect(stripIssueBodyFormatting("## 큰 소제목\n**굵은 문장**\n일반 문장"))
      .toBe("큰 소제목 굵은 문장 일반 문장");
  });

  it("renders headings and bold text without treating content as HTML", () => {
    const html = renderToStaticMarkup(createElement(IssueBody, { value: "## 큰 소제목\n### 소제목\n**굵은 문장** <script>" }));
    expect(html).toContain('<h2 class="issueBodyLarge">큰 소제목</h2>');
    expect(html).toContain('<h3 class="issueBodySubtitle">소제목</h3>');
    expect(html).toContain("<strong>굵은 문장</strong>");
    expect(html).toContain("&lt;script&gt;");
  });
});
