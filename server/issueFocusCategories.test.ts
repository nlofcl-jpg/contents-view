import { describe, expect, it } from "vitest";
import { issueFocusCategories, matchesIssueFocusCategory } from "../client/src/lib/issueFocusCategories";

describe("issue focus category filters", () => {
  it("uses the new editorial categories without mixing their results", () => {
    expect(issueFocusCategories.map(({ id }) => id)).toEqual([
      "all", "technology", "platform", "marketing", "commerce", "creator",
    ]);
    for (const { id } of issueFocusCategories) {
      if (id === "all") continue;
      expect(matchesIssueFocusCategory(id, "all")).toBe(true);
      for (const { id: filter } of issueFocusCategories) {
        if (filter !== "all") expect(matchesIssueFocusCategory(id, filter)).toBe(id === filter);
      }
    }
  });

  it("keeps unclassified articles visible under all", () => {
    expect(matchesIssueFocusCategory(null, "all")).toBe(true);
    for (const { id } of issueFocusCategories) {
      if (id !== "all") expect(matchesIssueFocusCategory(null, id)).toBe(false);
    }
  });
});
