import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  getIssueFocusCategoryValues,
  isIssueFocusCategoryId,
  issueFocusCategories,
  matchesIssueFocusCategory,
  normalizeIssueFocusCategory,
} from "@/lib/issueFocusCategories";

describe("News Focus categories", () => {
  it("requires a supported editorial category, not a legacy or unclassified value", () => {
    for (const value of ["", null, undefined, "all", "unknown", "society"]) {
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

  it("exposes a single economy and society category", () => {
    expect(issueFocusCategories.filter(({ id }) => ["economy", "society"].includes(id)))
      .toEqual([{ id: "economy", label: "경제·사회" }]);
    expect(normalizeIssueFocusCategory("society")).toBe("economy");
  });

  it("includes both stored values in the merged list and related articles", () => {
    expect(getIssueFocusCategoryValues("economy")).toEqual(["economy", "society"]);
    expect(["economy", "society", "technology", null].filter(value =>
      matchesIssueFocusCategory(value, "economy")
    )).toEqual(["economy", "society"]);
    expect(getIssueFocusCategoryValues("technology")).toEqual(["technology"]);
  });

  it("keeps other categories separate and unclassified articles visible under all", () => {
    for (const { id } of issueFocusCategories) {
      if (id === "all") continue;
      expect(matchesIssueFocusCategory(id, "all")).toBe(true);
      expect(matchesIssueFocusCategory(null, id)).toBe(false);
      for (const { id: filter } of issueFocusCategories) {
        if (filter !== "all") expect(matchesIssueFocusCategory(id, filter)).toBe(id === filter);
      }
    }
    expect(matchesIssueFocusCategory(null, "all")).toBe(true);
  });

  it("accepts all editor values in the database while retaining legacy society records", () => {
    const migration = readFileSync(new URL("../supabase/migrations/20261124052533_add_economy_and_society_issue_categories.sql", import.meta.url), "utf8");
    const storedIds = [...migration.matchAll(/'([a-z]+)'/g)].map(([, id]) => id);
    expect(storedIds).toEqual([...issueFocusCategories.map(({ id }) => id).filter(id => id !== "all"), "society"]);
  });
});
