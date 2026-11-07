import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import IssueDate from "../client/src/components/IssueDate";

describe("issue registration date", () => {
  it("shows the original registration date with a machine-readable timestamp", () => {
    const html = renderToStaticMarkup(createElement(IssueDate, { value: "2026-11-07T05:30:00Z" }));
    expect(html).toContain('dateTime="2026-11-07T05:30:00Z"');
    expect(html).toContain('aria-label="등록일 2026.11.07"');
    expect(html).toContain(">2026.11.07</time>");
  });
  it("uses the Korean calendar date across UTC midnight boundaries", () => {
    expect(renderToStaticMarkup(createElement(IssueDate, { value: "2026-11-07T16:30:00Z" }))).toContain(">2026.11.08</time>");
  });
  it("hides invalid dates instead of displaying an error", () => {
    expect(renderToStaticMarkup(createElement(IssueDate, { value: "" }))).toBe("");
  });
});
