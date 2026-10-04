import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GoogleTrendRankChange, type RankChange } from "../client/src/components/GoogleTrendRankChange";

vi.stubGlobal("React", React);

describe("Google Trends rank indicator", () => {
  it.each([
    ["up", "▲", "순위 상승"],
    ["down", "▼", "순위 하락"],
    ["same", "-", "순위 변화 없음"],
    ["new", "N", "새로 진입"],
  ] as const)("renders %s without a traffic count", (change, symbol, label) => {
    const html = renderToStaticMarkup(React.createElement(GoogleTrendRankChange, { change: change as RankChange }));
    expect(html).toContain(symbol);
    expect(html).toContain(`aria-label="${label}"`);
  });
});
