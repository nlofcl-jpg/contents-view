import { describe, it, expect } from 'vitest';

/**
 * 로컬 날짜 문자열을 Date 객체로 변환 (UTC 변환 문제 해결)
 */
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

/**
 * 두 날짜 사이의 일수 계산
 */
const getDaysBetween = (start: Date, end: Date): number => {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
};

/**
 * 기간별 모바일 라벨 개수 결정
 */
const getMobileLabelCount = (startDate: string, endDate: string): number => {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const durationDays = getDaysBetween(start, end);

  if (durationDays <= 30) {
    return 6; // 1개월: 6개
  } else if (durationDays <= 90) {
    return 7; // 3개월: 7개
  } else if (durationDays <= 180) {
    return 7; // 6개월: 7개
  } else {
    return 7; // 1년: 7개
  }
};

/**
 * 모바일 기간별 날짜 포맷팅
 */
const formatMobileDateLabel = (
  dateStr: string,
  startDate: string,
  endDate: string
): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const durationDays = getDaysBetween(start, end);

  if (durationDays <= 30) {
    // 1개월: M.D
    return `${month}.${day}`;
  } else if (durationDays <= 90) {
    // 3개월: M.D
    return `${month}.${day}`;
  } else {
    // 6개월, 1년: YY.M
    const shortYear = String(year).slice(2);
    return `${shortYear}.${month}`;
  }
};

/**
 * 라벨 표시 인덱스 계산
 */
const createLabelIndexes = (
  dataLength: number,
  labelCount = 7
): Set<number> => {
  if (dataLength <= labelCount) {
    return new Set(
      Array.from({ length: dataLength }, (_, index) => index)
    );
  }

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

describe('UnifiedChart Mobile Label Logic', () => {
  describe('getMobileLabelCount', () => {
    it('should return 6 labels for 1-month period', () => {
      const count = getMobileLabelCount('2026-05-15', '2026-06-14');
      expect(count).toBe(6);
    });

    it('should return 7 labels for 3-month period', () => {
      const count = getMobileLabelCount('2026-03-15', '2026-06-14');
      expect(count).toBe(7);
    });

    it('should return 7 labels for 6-month period', () => {
      const count = getMobileLabelCount('2025-12-15', '2026-06-14');
      expect(count).toBe(7);
    });

    it('should return 7 labels for 1-year period', () => {
      const count = getMobileLabelCount('2025-06-14', '2026-06-14');
      expect(count).toBe(7);
    });
  });

  describe('formatMobileDateLabel', () => {
    it('should format 1-month period as M.D', () => {
      const label = formatMobileDateLabel('2026-05-21', '2026-05-15', '2026-06-14');
      expect(label).toBe('5.21');
    });

    it('should format 3-month period as M.D', () => {
      const label = formatMobileDateLabel('2026-04-15', '2026-03-15', '2026-06-14');
      expect(label).toBe('4.15');
    });

    it('should format 6-month period as YY.M', () => {
      const label = formatMobileDateLabel('2026-02-01', '2025-12-15', '2026-06-14');
      expect(label).toBe('26.2');
    });

    it('should format 1-year period as YY.M', () => {
      const label = formatMobileDateLabel('2025-10-01', '2025-06-14', '2026-06-14');
      expect(label).toBe('25.10');
    });

    it('should handle year boundary correctly', () => {
      const label = formatMobileDateLabel('2026-01-15', '2025-12-15', '2026-06-14');
      expect(label).toBe('26.1');
    });
  });

  describe('createLabelIndexes', () => {
    it('should include all indexes if data length <= label count', () => {
      const indexes = createLabelIndexes(5, 7);
      expect(indexes.size).toBe(5);
      expect(Array.from(indexes).sort()).toEqual([0, 1, 2, 3, 4]);
    });

    it('should create 6 indexes for 1-month data', () => {
      const dataLength = 30; // 30 days
      const indexes = createLabelIndexes(dataLength, 6);
      expect(indexes.size).toBe(6);
      expect(indexes.has(0)).toBe(true);
      expect(indexes.has(dataLength - 1)).toBe(true);
    });

    it('should create 7 indexes for 3-month data', () => {
      const dataLength = 90; // 90 days
      const indexes = createLabelIndexes(dataLength, 7);
      expect(indexes.size).toBe(7);
      expect(indexes.has(0)).toBe(true);
      expect(indexes.has(dataLength - 1)).toBe(true);
    });

    it('should create 7 indexes for 6-month data', () => {
      const dataLength = 180; // 180 days
      const indexes = createLabelIndexes(dataLength, 7);
      expect(indexes.size).toBe(7);
      expect(indexes.has(0)).toBe(true);
      expect(indexes.has(dataLength - 1)).toBe(true);
    });

    it('should create 7 indexes for 1-year data', () => {
      const dataLength = 365; // 365 days
      const indexes = createLabelIndexes(dataLength, 7);
      expect(indexes.size).toBe(7);
      expect(indexes.has(0)).toBe(true);
      expect(indexes.has(dataLength - 1)).toBe(true);
    });

    it('should distribute indexes evenly', () => {
      const dataLength = 100;
      const indexes = Array.from(createLabelIndexes(dataLength, 7)).sort((a, b) => a - b);
      
      // Check that indexes are roughly evenly distributed
      const gaps = [];
      for (let i = 1; i < indexes.length; i++) {
        gaps.push(indexes[i] - indexes[i - 1]);
      }
      
      // All gaps should be similar (within a range)
      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      gaps.forEach(gap => {
        expect(Math.abs(gap - avgGap)).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('Label formatting consistency', () => {
    it('should format 1-month labels correctly', () => {
      const dates = [
        '2026-05-15',
        '2026-05-21',
        '2026-05-27',
        '2026-06-02',
        '2026-06-08',
        '2026-06-14',
      ];
      
      const labels = dates.map(date =>
        formatMobileDateLabel(date, '2026-05-15', '2026-06-14')
      );
      
      expect(labels).toEqual([
        '5.15',
        '5.21',
        '5.27',
        '6.2',
        '6.8',
        '6.14',
      ]);
    });

    it('should format 3-month labels correctly', () => {
      const dates = [
        '2026-03-16',
        '2026-03-31',
        '2026-04-15',
        '2026-04-30',
        '2026-05-15',
        '2026-05-30',
        '2026-06-14',
      ];
      
      const labels = dates.map(date =>
        formatMobileDateLabel(date, '2026-03-15', '2026-06-14')
      );
      
      expect(labels).toEqual([
        '3.16',
        '3.31',
        '4.15',
        '4.30',
        '5.15',
        '5.30',
        '6.14',
      ]);
    });

    it('should format 6-month labels correctly', () => {
      const dates = [
        '2025-12-15',
        '2026-01-01',
        '2026-02-01',
        '2026-03-01',
        '2026-04-01',
        '2026-05-01',
        '2026-06-14',
      ];
      
      const labels = dates.map(date =>
        formatMobileDateLabel(date, '2025-12-15', '2026-06-14')
      );
      
      expect(labels).toEqual([
        '25.12',
        '26.1',
        '26.2',
        '26.3',
        '26.4',
        '26.5',
        '26.6',
      ]);
    });

    it('should format 1-year labels correctly', () => {
      const dates = [
        '2025-06-14',
        '2025-08-01',
        '2025-10-01',
        '2025-12-01',
        '2026-02-01',
        '2026-04-01',
        '2026-06-14',
      ];
      
      const labels = dates.map(date =>
        formatMobileDateLabel(date, '2025-06-14', '2026-06-14')
      );
      
      expect(labels).toEqual([
        '25.6',
        '25.8',
        '25.10',
        '25.12',
        '26.2',
        '26.4',
        '26.6',
      ]);
    });
  });
});
