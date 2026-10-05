import * as cheerio from "cheerio";
import type { UnrankedGoogleTrendItem } from "./googleTrendsHistory";

export function parseGoogleTrendsPage(
  html: string,
  countryCode: string,
  observedAt: string,
): UnrankedGoogleTrendItem[] {
  const $ = cheerio.load(html);
  const script = $("script").toArray()
    .map(element => $(element).text())
    .find(content => content.startsWith("AF_initDataCallback({key: 'ds:0'"));
  const payload = script?.match(/\bdata:(\[[\s\S]*\]),\s*sideChannel:/)?.[1];
  if (!payload) return [];

  try {
    const data = JSON.parse(payload) as unknown;
    if (!Array.isArray(data) || !Array.isArray(data[1])) return [];

    const seen = new Set<string>();
    const items: UnrankedGoogleTrendItem[] = [];
    for (const row of data[1]) {
      if (!Array.isArray(row)) continue;
      const keyword = typeof row[0] === "string" ? row[0].trim() : "";
      const trafficCount = Number(row[6]);
      if (!keyword || row[2] !== countryCode || !Number.isFinite(trafficCount) || trafficCount <= 0) continue;
      const key = keyword.normalize("NFKC").toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      // Google's page payload carries an end timestamp when the trend has ended.
      const endedAt = Array.isArray(row[4]) ? Number(row[4][0]) : 0;
      items.push({
        keyword,
        traffic: `${trafficCount}+`,
        trafficCount,
        news: [],
        source: "Google Trends",
        country: countryCode,
        isCurrent: !Number.isFinite(endedAt) || endedAt <= 0,
        lastSeenAt: observedAt,
        sourceRank: items.length,
      });
    }
    return items;
  } catch {
    return [];
  }
}
