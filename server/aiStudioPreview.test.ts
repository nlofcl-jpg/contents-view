import { describe, expect, it, vi } from "vitest";
import handler from "../api/ai-studio-preview";

function renderPreview(section?: string) {
  const response = {
    setHeader: vi.fn(),
    status: vi.fn(),
    send: vi.fn(),
  };
  response.status.mockReturnValue(response);

  handler({ query: { section } }, response);
  return { html: response.send.mock.calls[0][0] as string, response };
}

describe("AI studio share preview", () => {
  it("describes AI content creation on the studio URL", () => {
    const { html, response } = renderPreview();

    expect(response.status).toHaveBeenCalledWith(200);
    expect(html).toContain('<meta property="og:title" content="AI 콘텐츠 제작 | CONTENTS VIEW AI 스튜디오" />');
    expect(html).toContain('<meta property="og:description" content="쇼츠, 카드뉴스, 모션그래픽 등 AI 콘텐츠 제작을 위한 스타일과 도구를 CONTENTS VIEW AI 스튜디오에서 확인하세요." />');
    expect(html).toContain('<meta property="og:url" content="https://contents-view-chi.vercel.app/ai-studio" />');
    expect(html).toContain('<meta property="og:image" content="https://contents-view-chi.vercel.app/ai-studio-video-hero.png" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  it("keeps the shared studio subpage URL", () => {
    const { html } = renderPreview("video");
    expect(html).toContain('<meta property="og:url" content="https://contents-view-chi.vercel.app/ai-studio/video" />');
  });

  it("does not reflect unrecognized sections into the preview", () => {
    const { html } = renderPreview("<script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain('<meta property="og:url" content="https://contents-view-chi.vercel.app/ai-studio" />');
  });
});
