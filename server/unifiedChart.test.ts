import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-chartjs-2", () => ({ Line: () => null }));
vi.stubGlobal("React", React);

import { UnifiedChart } from "../client/src/components/UnifiedChart";

const data = {
  keywords: ["테스트"],
  trend: { "테스트": [{ period: "2026-10-04", ratio: 50 }] },
  shopping: {},
  shoppingStatus: { "테스트": "NO_DATA" as const },
};

describe("UnifiedChart shopping data notice", () => {
  it("does not show a shopping warning on the content chart", () => {
    const html = renderToStaticMarkup(React.createElement(UnifiedChart, {
      data,
      visibleLayers: { trend: true, shopping: false },
      timeUnit: "date",
      startDate: "2026-10-01",
      endDate: "2026-10-04",
    }));

    expect(html).not.toContain("shopping-no-data-alert");
  });

  it("shows a shopping warning on the shopping chart", () => {
    const html = renderToStaticMarkup(React.createElement(UnifiedChart, {
      data,
      visibleLayers: { trend: false, shopping: true },
      timeUnit: "date",
      startDate: "2026-10-01",
      endDate: "2026-10-04",
    }));

    expect(html).toContain("shopping-no-data-alert");
  });
});
