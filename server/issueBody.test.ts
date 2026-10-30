import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import IssueBody from "../client/src/components/IssueBody";
import { formatIssueBodyLines, parseIssueBodyBlocks, parseIssueBodyLine, stripIssueBodyFormatting } from "../shared/issueBody";

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

  it("renders the stored shareholder table with aligned numeric values", () => {
    const value = "보도된 주요 주주 지분율은 다음과 같다.\n\n| 주주 | 보유 지분율 |\n|---|---:|\n| SK스퀘어 | 63.23% |\n| 어쎈타모빌리티투자목적회사 | 9.83% |\n| 테라미터홀딩스 | 9.83% |\n| 국민은행 | 6.39% |\n\n## 다음 내용\n본문";
    const html = renderToStaticMarkup(createElement(IssueBody, { value }));
    expect(html).toContain('<table class="issueBodyTable">');
    expect(html).toContain('<th scope="col" style="text-align:right">보유 지분율</th>');
    expect(html).toContain('<td style="text-align:right">63.23%</td>');
    expect(html.match(/<td /g)).toHaveLength(8);
    expect(html).toContain('<h2 class="issueBodyLarge">다음 내용</h2>');
    expect(html).not.toContain('|---|');
  });

  it("supports tables without outer pipes, escaped pipes, and inline bold", () => {
    const value = "항목 | 값\n:--- | ---:\n**A \\| B** | 10%";
    const blocks = parseIssueBodyBlocks(value);
    expect(blocks).toEqual([{
      type: "table",
      headers: ["항목", "값"],
      align: ["left", "right"],
      rows: [["**A | B**", "10%"]],
    }]);
    expect(renderToStaticMarkup(createElement(IssueBody, { value }))).toContain('<strong>A | B</strong>');
  });

  it("preserves text containing pipes when no table delimiter is present", () => {
    const value = "## 제목\n\n뉴스 | 이슈\n\n다음 문장\n";
    expect(parseIssueBodyBlocks(value)).toEqual([{ type: "text", value }]);
  });

  it("keeps HTML inert in table cells", () => {
    const value = "| 항목 | 값 |\n|---|---|\n| <script>alert(1)</script> | <img src=x onerror=alert(1)> |";
    const html = renderToStaticMarkup(createElement(IssueBody, { value }));
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img ');
    expect(html).toContain('&lt;script&gt;');
  });

  it("strips table syntax from list summaries and share descriptions", () => {
    expect(stripIssueBodyFormatting("## 주주 현황\n\n| 주주 | 지분 |\n|---|---:|\n| **SK스퀘어** | 63.23% |"))
      .toBe("주주 현황 주주 지분 SK스퀘어 63.23%");
  });
});
