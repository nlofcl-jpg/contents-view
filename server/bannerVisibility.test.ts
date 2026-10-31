import { describe, expect, it } from "vitest";
import { nextKoreanMidnight, readBannerHiddenUntil } from "../client/src/lib/bannerVisibility";

describe("daily banner dismissal", () => {
  it("expires at Korean midnight rather than 24 hours after closing", () => {
    expect(nextKoreanMidnight(Date.parse("2026-10-31T11:00:00Z"))).toBe(Date.parse("2026-10-31T15:00:00Z"));
  });
  it("handles the moment before midnight", () => {
    expect(nextKoreanMidnight(Date.parse("2026-10-31T14:59:59Z"))).toBe(Date.parse("2026-10-31T15:00:00Z"));
  });
  it("starts a new day exactly at midnight and across month boundaries", () => {
    expect(nextKoreanMidnight(Date.parse("2026-10-31T15:00:00Z"))).toBe(Date.parse("2026-11-01T15:00:00Z"));
  });
  it("keeps a saved dismissal until midnight, including reloads", () => {
    const expiry = Date.parse("2026-10-31T15:00:00Z");
    expect(readBannerHiddenUntil(String(expiry), expiry - 1)).toBe(expiry);
    expect(readBannerHiddenUntil(String(expiry), expiry)).toBe(0);
    expect(readBannerHiddenUntil(String(expiry), expiry + 1)).toBe(0);
  });
  it("ignores missing or malformed storage", () => {
    for (const value of [null, "", "bad", "Infinity", "-1"]) {
      expect(readBannerHiddenUntil(value, Date.now())).toBe(0);
    }
  });
});
