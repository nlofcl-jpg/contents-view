import { describe, expect, it } from "vitest";
import { formatCommunityDateTime } from "../client/src/lib/communityDateTime";

const referenceDate = new Date(2026, 8, 15, 20, 30);

describe("formatCommunityDateTime", () => {
  it("formats full dates and removes seconds", () => {
    expect(formatCommunityDateTime("2026-09-15 18:42:31", referenceDate)).toBe(
      "2026.09.15 18:42"
    );
  });

  it("adds today's date to time-only values", () => {
    expect(formatCommunityDateTime("19:05", referenceDate)).toBe(
      "2026.09.15 19:05"
    );
  });

  it("converts relative times to date and time", () => {
    expect(formatCommunityDateTime("32분 전", referenceDate)).toBe(
      "2026.09.15 19:58"
    );
  });

  it("formats month and day values without inventing a time", () => {
    expect(formatCommunityDateTime("09.14", referenceDate)).toBe("2026.09.14");
  });

  it("returns a dash for unavailable or unsupported values", () => {
    expect(formatCommunityDateTime("-", referenceDate)).toBe("-");
    expect(formatCommunityDateTime("알 수 없음", referenceDate)).toBe("-");
  });
});
