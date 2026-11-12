import { describe, expect, it } from "vitest";
import { matchesIssueFocusCategory } from "../client/src/lib/issueFocusCategories";

describe("issue focus category filters", () => {
  it("uses the saved editorial category", () => {
    expect(matchesIssueFocusCategory("digital", "digital")).toBe(true);
    expect(matchesIssueFocusCategory("digital", "technology")).toBe(false);
    expect(matchesIssueFocusCategory("technology", "technology")).toBe(true);
    expect(matchesIssueFocusCategory("digital", "all")).toBe(true);
  });

  it("keeps unclassified articles visible under all", () => {
    expect(matchesIssueFocusCategory(null, "all")).toBe(true);
    expect(matchesIssueFocusCategory(null, "society")).toBe(false);
  });
});
