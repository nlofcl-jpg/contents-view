import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { load } from "cheerio";
import handler from "./issuePreview";

const { query } = vi.hoisted(() => {
  const query = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  return { query };
});

vi.mock("@supabase/supabase-js", () => ({ createClient: () => query }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test");
  query.from.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
});

afterEach(() => vi.unstubAllEnvs());

async function preview() {
  const response = { status: vi.fn(), send: vi.fn(), setHeader: vi.fn() };
  response.status.mockReturnValue(response);
  await handler({ query: { id: "article-id" } }, response);
  return response;
}

describe("News Focus link previews", () => {
  it("serves an absolute image URL for a published article", async () => {
    query.maybeSingle.mockResolvedValue({ data: {
      title: '뉴스 "포커스"',
      summary: "## **기사 본문**",
      thumbnail_url: "/api/news-media?key=r2%2Fimages%2Ftest.webp&v=1",
    }, error: null });
    const response = await preview();
    expect(query.eq).toHaveBeenCalledWith("is_published", true);
    expect(response.status).toHaveBeenCalledWith(200);
    const $ = load(response.send.mock.calls[0][0]);
    const image = "https://contents-view-chi.vercel.app/api/news-media?key=r2%2Fimages%2Ftest.webp&v=1";
    expect($('meta[property="og:image"]').attr("content")).toBe(image);
    expect($('meta[name="twitter:image"]').attr("content")).toBe(image);
    expect($('meta[property="og:title"]').attr("content")).toBe('뉴스 "포커스"');
  });

  it("does not expose a preview for an unpublished article", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await preview();
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.send).toHaveBeenCalledWith("Not found");
  });
});
