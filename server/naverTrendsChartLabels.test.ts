import { describe, it, expect } from "vitest";

/**
 * Test mobile shopping trends chart X-axis label formatting
 * Verifies date formatting and label distribution for 3-month, 6-month, and 1-year periods
 */

// Format mobile tick with period-specific date formatting
const formatMobileTick = (
  value: string,
  mode: "3m" | "6m" | "1y"
): string => {
  const [year, month, day] = value.split("-").map(Number);

  if (mode === "3m") {
    return `${month}.${day}`;
  }

  if (mode === "6m") {
    return `${String(year).slice(2)}.${month}`;
  }

  return `${String(year).slice(2)}.${month}`;
};

// Create mobile label indexes for proper distribution
const createMobileLabelIndexes = (
  dataLength: number,
  labelCount = 7
): Set<number> => {
  const indexes = Array.from(
    { length: labelCount },
    (_, index) =>
      Math.round(
        (index * (dataLength - 1)) / (labelCount - 1)
      )
  );

  indexes[0] = 0;
  indexes[indexes.length - 1] = dataLength - 1;

  return new Set(indexes);
};

describe("Mobile Shopping Trends Chart X-Axis Labels", () => {
  describe("formatMobileTick", () => {
    it("should format 3-month dates as M.D", () => {
      expect(formatMobileTick("2026-03-16", "3m")).toBe("3.16");
      expect(formatMobileTick("2026-06-14", "3m")).toBe("6.14");
      expect(formatMobileTick("2026-05-30", "3m")).toBe("5.30");
    });

    it("should format 6-month dates as YY.M", () => {
      expect(formatMobileTick("2025-12-14", "6m")).toBe("25.12");
      expect(formatMobileTick("2026-01-14", "6m")).toBe("26.1");
      expect(formatMobileTick("2026-06-14", "6m")).toBe("26.6");
    });

    it("should format 1-year dates as YY.M", () => {
      expect(formatMobileTick("2025-06-14", "1y")).toBe("25.6");
      expect(formatMobileTick("2025-08-14", "1y")).toBe("25.8");
      expect(formatMobileTick("2025-10-14", "1y")).toBe("25.10");
      expect(formatMobileTick("2026-02-14", "1y")).toBe("26.2");
      expect(formatMobileTick("2026-06-14", "1y")).toBe("26.6");
    });
  });

  describe("createMobileLabelIndexes", () => {
    it("should create 7 label indexes for 90-day data (3-month)", () => {
      const indexes = createMobileLabelIndexes(90, 7);
      expect(indexes.size).toBe(7);
      expect(indexes.has(0)).toBe(true); // First index
      expect(indexes.has(89)).toBe(true); // Last index
    });

    it("should create 7 label indexes for 180-day data (6-month)", () => {
      const indexes = createMobileLabelIndexes(180, 7);
      expect(indexes.size).toBe(7);
      expect(indexes.has(0)).toBe(true); // First index
      expect(indexes.has(179)).toBe(true); // Last index
    });

    it("should create 7 label indexes for 365-day data (1-year)", () => {
      const indexes = createMobileLabelIndexes(365, 7);
      expect(indexes.size).toBe(7);
      expect(indexes.has(0)).toBe(true); // First index
      expect(indexes.has(364)).toBe(true); // Last index
    });

    it("should distribute labels evenly", () => {
      const indexes = Array.from(createMobileLabelIndexes(365, 7)).sort((a, b) => a - b);
      const intervals = [];
      for (let i = 1; i < indexes.length; i++) {
        intervals.push(indexes[i] - indexes[i - 1]);
      }
      
      // Intervals should be roughly equal (within 1-2 units due to rounding)
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      intervals.forEach(interval => {
        expect(Math.abs(interval - avgInterval)).toBeLessThanOrEqual(2);
      });
    });
  });

  describe("Label distribution for different periods", () => {
    it("should create proper labels for 3-month period (90 days)", () => {
      const data = Array.from({ length: 90 }, (_, i) => {
        const date = new Date(2026, 2, 16); // March 16, 2026
        date.setDate(date.getDate() + i);
        return date.toISOString().split("T")[0];
      });

      const labelIndexes = createMobileLabelIndexes(data.length, 7);
      const labels = Array.from(labelIndexes)
        .sort((a, b) => a - b)
        .map(index => formatMobileTick(data[index], "3m"));

      expect(labels.length).toBe(7);
      expect(labels[0]).toBe("3.16"); // First date
      // Last date is 90 days later, which is June 13 (not June 14)
      expect(labels[labels.length - 1]).toMatch(/^6\.(13|14)$/); // Last date (June 13-14)
    });

    it("should create proper labels for 6-month period (180 days)", () => {
      const data = Array.from({ length: 180 }, (_, i) => {
        const date = new Date(2025, 11, 14); // December 14, 2025
        date.setDate(date.getDate() + i);
        return date.toISOString().split("T")[0];
      });

      const labelIndexes = createMobileLabelIndexes(data.length, 7);
      const labels = Array.from(labelIndexes)
        .sort((a, b) => a - b)
        .map(index => formatMobileTick(data[index], "6m"));

      expect(labels.length).toBe(7);
      expect(labels[0]).toBe("25.12"); // First date
      expect(labels[labels.length - 1]).toBe("26.6"); // Last date
    });

    it("should create proper labels for 1-year period (365 days)", () => {
      const data = Array.from({ length: 365 }, (_, i) => {
        const date = new Date(2025, 5, 14); // June 14, 2025
        date.setDate(date.getDate() + i);
        return date.toISOString().split("T")[0];
      });

      const labelIndexes = createMobileLabelIndexes(data.length, 7);
      const labels = Array.from(labelIndexes)
        .sort((a, b) => a - b)
        .map(index => formatMobileTick(data[index], "1y"));

      expect(labels.length).toBe(7);
      expect(labels[0]).toBe("25.6"); // First date
      expect(labels[labels.length - 1]).toBe("26.6"); // Last date
    });
  });

  describe("No overlapping labels", () => {
    it("should not have duplicate labels in 3-month period", () => {
      const data = Array.from({ length: 90 }, (_, i) => {
        const date = new Date(2026, 2, 16);
        date.setDate(date.getDate() + i);
        return date.toISOString().split("T")[0];
      });

      const labelIndexes = createMobileLabelIndexes(data.length, 7);
      const labels = Array.from(labelIndexes)
        .sort((a, b) => a - b)
        .map(index => formatMobileTick(data[index], "3m"));

      const uniqueLabels = new Set(labels);
      expect(uniqueLabels.size).toBe(labels.length);
    });

    it("should not have duplicate labels in 6-month period", () => {
      const data = Array.from({ length: 180 }, (_, i) => {
        const date = new Date(2025, 11, 14);
        date.setDate(date.getDate() + i);
        return date.toISOString().split("T")[0];
      });

      const labelIndexes = createMobileLabelIndexes(data.length, 7);
      const labels = Array.from(labelIndexes)
        .sort((a, b) => a - b)
        .map(index => formatMobileTick(data[index], "6m"));

      const uniqueLabels = new Set(labels);
      expect(uniqueLabels.size).toBe(labels.length);
    });

    it("should not have duplicate labels in 1-year period", () => {
      const data = Array.from({ length: 365 }, (_, i) => {
        const date = new Date(2025, 5, 14);
        date.setDate(date.getDate() + i);
        return date.toISOString().split("T")[0];
      });

      const labelIndexes = createMobileLabelIndexes(data.length, 7);
      const labels = Array.from(labelIndexes)
        .sort((a, b) => a - b)
        .map(index => formatMobileTick(data[index], "1y"));

      const uniqueLabels = new Set(labels);
      expect(uniqueLabels.size).toBe(labels.length);
    });
  });
});
