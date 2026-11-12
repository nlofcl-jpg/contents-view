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

  it.each(["user", null] as const)("shows non-navigable cards and blocks direct links for %s", role => {
    const { html } = renderStudio("/ai-studio/video", role);
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(2);
    for (const group of ["shorts", "reels"]) {
      expect(html).not.toContain(`href="/ai-studio/video/${group}"`);
      const detail = renderStudio(`/ai-studio/video/${group}`, role);
      expect(detail.html).toBe("");
      expect(detail.redirectTo).toBe("/ai-studio/video");
    }
  });

  it("waits for auth without showing the detail or redirecting", () => {
    expect(renderStudio("/ai-studio/video/shorts", null, true)).toEqual({ html: "", redirectTo: undefined });
  });

  it("lets admins open both style pages", () => {
    const { html } = renderStudio("/ai-studio/video", "admin");
    for (const group of ["shorts", "reels"]) {
      expect(html).toContain(`href="/ai-studio/video/${group}"`);
      const detail = renderStudio(`/ai-studio/video/${group}`, "admin");
      expect(detail.html).toContain("aiStudioVideoStyleThumbnail");
      expect(detail.redirectTo).toBeUndefined();
    }
  });
});
