import { describe, expect, it } from "vitest";
import { matchesIssueFocusCategory } from "../client/src/lib/issueFocusCategories";

describe("issue focus category filters", () => {
  it("classifies existing articles by their stable IDs", () => {
    const shortFormMonetization = "b6109a20-d4fe-4bf6-990b-d9f9d18e5a46";
    expect(matchesIssueFocusCategory(shortFormMonetization, "digital")).toBe(true);
    expect(matchesIssueFocusCategory(shortFormMonetization, "technology")).toBe(false);
    expect(matchesIssueFocusCategory(shortFormMonetization, "all")).toBe(true);
  });

  it("keeps unclassified articles visible under all", () => {
    const unclassified = "00000000-0000-0000-0000-000000000000";
    expect(matchesIssueFocusCategory(unclassified, "all")).toBe(true);
    expect(matchesIssueFocusCategory(unclassified, "society")).toBe(false);
  });
});
