import { describe, expect, it } from "vitest";
import { parseGoogleTrendsPage } from "./googleTrendsPage";

const observedAt = "2026-10-05T00:00:00.000Z";
const html = `<script>AF_initDataCallback({key: 'ds:0', hash: '2', data:[null,[
  ["active",null,"KR",[1791117000],null,null,20000],
  ["ended",null,"KR",[1791117000],[1791120000],null,100000],
  ["other country",null,"US",[1791117000],null,null,50000]
]], sideChannel: {}});</script>`;

describe("Google Trends page list", () => {
  it("reads the full list and distinguishes active from ended trends", () => {
    const items = parseGoogleTrendsPage(html, "KR", observedAt);
    expect(items.map(item => ({ keyword: item.keyword, trafficCount: item.trafficCount, isCurrent: item.isCurrent, sourceRank: item.sourceRank }))).toEqual([
      { keyword: "active", trafficCount: 20000, isCurrent: true, sourceRank: 0 },
      { keyword: "ended", trafficCount: 100000, isCurrent: false, sourceRank: 1 },
    ]);
  });

  it("returns no items when Google's page payload changes", () => {
    expect(parseGoogleTrendsPage("<html></html>", "KR", observedAt)).toEqual([]);
  });
});
