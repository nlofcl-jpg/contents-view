import { load } from "cheerio";

const RSS_URL = "https://news.google.com/rss";
const RSS_LOCALE = "hl=ko&gl=KR&ceid=KR:ko";
const FRESH_MS = 2 * 60_000;
const STALE_MS = 30 * 60_000;
const TOPICS = {
  all: "",
  nation: "정치 OR 사회",
  business: "경제",
  technology: "IT OR 기술",
  science: "과학",
  entertainment: "연예",
  sports: "스포츠",
  health: "건강",
  world: "국제",
} as const;
type Category = keyof typeof TOPICS;

function parseNews(xml: string) {
  const $ = load(xml, { xmlMode: true });
  const seen = new Set<string>();
  return $("rss > channel > item").toArray().flatMap(element => {
    const item = $(element);
    const rawTitle = item.children("title").first().text().trim();
    const link = item.children("link").first().text().trim();
    if (!rawTitle || !/^https?:\/\//i.test(link) || seen.has(link)) return [];
    seen.add(link);

    const source = item.children("source").first().text().trim();
    const suffix = source ? ` - ${source}` : "";
    const title = suffix && rawTitle.endsWith(suffix) ? rawTitle.slice(0, -suffix.length) : rawTitle;
    const description = load(item.children("description").first().text(), {}, false).text().replace(/\s+/g, " ").trim();
    return [{
      title: title || rawTitle,
      link,
      pubDate: item.children("pubDate").first().text().trim(),
      description: description.length > 150 ? `${description.slice(0, 150)}...` : description,
      source: source || "Google News",
      thumbnail: null,
    }];
  }).sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
}

type NewsItems = ReturnType<typeof parseNews>;

export function createLatestNewsLoader(fetchFeed: typeof fetch = (...args) => fetch(...args), now = Date.now) {
  const snapshots = new Map<Category, { items: NewsItems; at: number }>();
  const inFlight = new Map<Category, Promise<NewsItems>>();

  function read(category: Category): Promise<NewsItems> {
    const last = snapshots.get(category);
    if (last && now() - last.at < FRESH_MS) return Promise.resolve(last.items);
    const pending = inFlight.get(category);
    if (pending) return pending;

    const request = (async () => {
      const topic = TOPICS[category];
      const url = topic ? `${RSS_URL}/search?q=${encodeURIComponent(topic)}&${RSS_LOCALE}` : `${RSS_URL}?${RSS_LOCALE}`;
      try {
        const response = await fetchFeed(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(4_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const items = parseNews(await response.text());
        if (!items.length) throw new Error("empty RSS");
        snapshots.set(category, { items, at: now() });
        return items;
      } catch (error) {
        console.warn("[News] RSS unavailable:", category, error instanceof Error ? error.message : error);
        if (last && now() - last.at < STALE_MS) return last.items;
        if (category !== "all") return [];

        const fallback = (await Promise.all([read("nation"), read("business"), read("technology")])).flat();
        const items = Array.from(new Map(fallback.map(item => [item.link, item])).values())
          .sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
        // Do not turn stale topic results into a fresh general-feed snapshot.
        return items;
      }
    })().finally(() => inFlight.delete(category));
    inFlight.set(category, request);
    return request;
  }

  return async (category: string, limit: number) => {
    const key = Object.hasOwn(TOPICS, category) ? category as Category : "all";
    return (await read(key)).slice(0, Math.max(1, Math.min(100, limit)));
  };
}

export const getLatestRssNews = createLatestNewsLoader();
