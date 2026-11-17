import { describe, expect, it, vi } from "vitest";
import { createLatestNewsLoader } from "./latestNews";

function rss(title: string, link: string, day = 17) {
  return `<item><title>${title} - Test News</title><link>https://example.com/${link}</link><source>Test News</source>
    <pubDate>${new Date(Date.UTC(2026, 10, day)).toUTCString()}</pubDate>
    <description>&lt;p&gt;Summary &amp;amp; details&lt;/p&gt;</description></item>`;
}

function feed(...items: string[]) {
  return new Response(`<rss><channel>${items.join("")}</channel></rss>`);
}

describe("latest news RSS", () => {
  it("selects newest usable articles and shares one request across limits", async () => {
    const fetcher = vi.fn(async () => feed(rss("Earlier", "old", 16), rss("New &amp; latest", "new"), rss("Duplicate", "new")));
    const getNews = createLatestNewsLoader(fetcher);
    const [one, two] = await Promise.all([getNews("all", 1), getNews("all", 2)]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(two.map(item => item.title)).toEqual(["New & latest", "Earlier"]);
    expect(one).toEqual([expect.objectContaining({ description: "Summary & details", source: "Test News" })]);
  });

  it("keeps the last successful feed when a refresh comes back empty", async () => {
    let now = 0;
    const fetcher = vi.fn(async () => now === 0 ? feed(rss("Saved", "saved")) : feed());
    const getNews = createLatestNewsLoader(fetcher, () => now);
    const earlier = await getNews("all", 7);
    now += 3 * 60_000;
    expect(await getNews("all", 7)).toEqual(earlier);
    expect(earlier).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("fills a cold general-feed failure from available topics", async () => {
    const fetcher: typeof fetch = async input => {
      const topic = new URL(String(input)).searchParams.get("q");
      if (topic === "경제") return feed(rss("Economy", "economy", 16));
      if (topic === "IT OR 기술") return feed(rss("Technology", "technology"));
      return new Response(null, { status: 429 });
    };
    const getNews = createLatestNewsLoader(fetcher);
    expect((await getNews("all", 7)).map(item => item.title)).toEqual(["Technology", "Economy"]);
  });
});
