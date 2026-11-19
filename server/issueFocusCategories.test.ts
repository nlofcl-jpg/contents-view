import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { issueFocusCategories, isIssueFocusCategoryId, matchesIssueFocusCategory } from "../client/src/lib/issueFocusCategories";

describe("issue focus category filters", () => {
  it("requires a supported editorial category, not all or unclassified", () => {
    for (const value of ["", null, undefined, "all", "unknown"]) {
      expect(isIssueFocusCategoryId(value)).toBe(false);
    }
    for (const { id } of issueFocusCategories) {
      if (id !== "all") expect(isIssueFocusCategoryId(id)).toBe(true);
    }
  });

  it("validates categories before uploads or writes without requiring them for briefings", () => {
    const admin = readFileSync(new URL("../client/src/pages/Admin.tsx", import.meta.url), "utf8");
    const saveHandler = admin.slice(admin.indexOf("const handleSave = async () =>"), admin.indexOf("const values = {"));
    expect(saveHandler).toContain("if (!isClip && !isIssueFocusCategoryId(category))");
    expect(saveHandler.indexOf("!isIssueFocusCategoryId(category)")).toBeLessThan(saveHandler.indexOf("uploadIssueImage"));
    expect(admin).toContain('<option value="" disabled>카테고리 선택</option>');
  });
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
