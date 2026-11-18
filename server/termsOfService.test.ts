import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import TermsOfService from "../client/src/pages/TermsOfService";

const render = () => renderToStaticMarkup(
  React.createElement(Router, { ssrPath: "/terms" }, React.createElement(TermsOfService)),
);

describe("terms of service", () => {
  beforeAll(() => vi.stubGlobal("React", React));
  afterAll(() => vi.unstubAllGlobals());

  it("identifies the actual operator and shows the approved announcement and effective dates", () => {
    const html = render();
    expect(html).toContain("에덴 컴퍼니");
    expect(html).toContain("edenofcls@gmail.com");
    expect(html).not.toContain("검토용 초안");
    expect(html).not.toContain("시행일: 미정");
    expect(html).toContain("공고일: 2026.11.18");
    expect(html).toContain("시행일: 2026.11.18");
    expect(html.indexOf("공고일:")).toBeGreaterThan(html.indexOf("제16조"));
    expect(html.match(/<h2>/g)).toHaveLength(16);
  });

  it("links the privacy policy and required external YouTube terms", () => {
    const html = render();
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="https://www.youtube.com/t/terms"');
    expect(html).toContain('href="https://policies.google.com/privacy"');
    expect(html).toContain("YouTube API Services");
    expect(html).toContain("목업");
    expect(html).toContain("저장된 급상승 영상");
    expect(html).toContain("이용계약 해지");
  });

  it("connects the footer and renders a standalone legal route", () => {
    const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
    const footer = readFileSync(new URL("../client/src/components/Footer.tsx", import.meta.url), "utf8");
    expect(footer).toContain('<Link href="/terms">이용약관</Link>');
    expect(app).toContain('location === "/terms/"');
    expect(app).toContain("isPrivacyPage || isTermsPage");
    expect(app).toContain("{isTermsPage ? <TermsOfService /> : <PrivacyPolicy />}");
  });
});
