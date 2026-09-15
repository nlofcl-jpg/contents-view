import { describe, expect, it } from "vitest";
import { formatCommunityDateTime } from "../client/src/lib/communityDateTime";

const referenceDate = new Date(2026, 8, 15, 20, 30);

describe("formatCommunityDateTime", () => {
  it("shows only the time for today's full date", () => {
    expect(formatCommunityDateTime("2026-09-15 18:42:31", referenceDate)).toBe(
      "18:42"
    );
  });

  it("shows time-only values as time", () => {
    expect(formatCommunityDateTime("19:05", referenceDate)).toBe("19:05");
  });

  it("shows today's relative times as time", () => {
    expect(formatCommunityDateTime("32분 전", referenceDate)).toBe("19:58");
  });

  it("shows only the date for earlier posts", () => {
    expect(formatCommunityDateTime("2026-09-14 18:42", referenceDate)).toBe(
      "09.14"
    );
    expect(formatCommunityDateTime("1일 전", referenceDate)).toBe("09.14");
    expect(formatCommunityDateTime("09.14", referenceDate)).toBe("09.14");
  });

  it("returns a dash for unavailable or unsupported values", () => {
    expect(formatCommunityDateTime("-", referenceDate)).toBe("-");
    expect(formatCommunityDateTime("알 수 없음", referenceDate)).toBe("-");
  });
});
