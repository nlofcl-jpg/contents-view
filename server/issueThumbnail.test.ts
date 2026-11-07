import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import IssueThumbnail from "../client/src/components/IssueThumbnail";

describe("issue thumbnail credit", () => {
  it("shows the credit below the image as plain text", () => {
    const html = renderToStaticMarkup(createElement(IssueThumbnail, { src: "https://example.com/image.jpg", credit: "  공식 홈페이지 <script>  " }));
    expect(html).toContain('class="issueDetailImageCredit">출처: 공식 홈페이지 &lt;script&gt;</figcaption>');
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf("<figcaption"));
  });
  it("does not show a caption when the credit is absent", () => {
    for (const credit of [undefined, null, "", "  "]) {
      expect(renderToStaticMarkup(createElement(IssueThumbnail, { src: "https://example.com/image.jpg", credit }))).not.toContain("figcaption");
    }
  });
  it("does not show an orphan caption without an image", () => {
    expect(renderToStaticMarkup(createElement(IssueThumbnail, { src: null, credit: "공식 홈페이지" }))).toBe("");
  });
});
