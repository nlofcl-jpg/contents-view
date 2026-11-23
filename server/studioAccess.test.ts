import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import AIStudio from "../client/src/pages/AIStudio";

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock("../client/src/_core/hooks/useAuth", () => ({ useAuth }));

function renderStudio(path: string, role: "admin" | "user" | null, loading = false) {
  useAuth.mockReturnValue({ user: role ? { role } : null, isAuthenticated: Boolean(role), loading });
  const ssrContext: { redirectTo?: string } = {};
  const html = renderToStaticMarkup(React.createElement(Router, { ssrPath: path, ssrContext }, React.createElement(AIStudio)));
  return { html, redirectTo: ssrContext.redirectTo };
}

describe("studio style page access", () => {
  beforeEach(() => vi.stubGlobal("React", React));
  afterEach(() => vi.unstubAllGlobals());

  it.each(["user", null] as const)("blocks direct links to legacy style pages for %s", role => {
    for (const group of ["shorts", "reels"]) {
      const detail = renderStudio(`/ai-studio/video/${group}`, role);
      expect(detail.html).toBe("");
      expect(detail.redirectTo).toBe("/ai-studio/video");
    }
  });

  it("waits for auth without showing the detail or redirecting", () => {
    expect(renderStudio("/ai-studio/video/shorts", null, true)).toEqual({ html: "", redirectTo: undefined });
  });

  it("lets admins open both style pages", () => {
    for (const group of ["shorts", "reels"]) {
      const detail = renderStudio(`/ai-studio/video/${group}`, "admin");
      expect(detail.html).toContain("aiStudioVideoStyleThumbnail");
      expect(detail.redirectTo).toBeUndefined();
    }
  });

  it.each([
    ["styles", "영상"],
    ["card-news", "카드 뉴스"],
    ["motion-graphics", "모션그래픽"],
  ])("links guests to the empty %s production page", (slug, title) => {
    const path = `/ai-studio/video/${slug}`;
    expect(renderStudio("/ai-studio/video", null).html).toContain(`href="${path}"`);
    const { html, redirectTo } = renderStudio(path, null);
    expect(redirectTo).toBeUndefined();
    expect(html).toContain(`id="studio-format-title" class="pageTitle">${title}</h1>`);
    expect(html).toContain('href="/ai-studio/video"');
    expect(html).not.toMatch(/studioProductionBanner|aiStudioCardNewsThumbnail|aiStudioUpcomingState/);
  });
});
