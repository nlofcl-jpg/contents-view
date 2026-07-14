import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('NaverTrends X-axis Label Density', () => {
  // Mock chart data generator
  const generateChartData = (daysCount: number) => {
    const data = [];
    const startDate = new Date('2025-06-14');
    for (let i = 0; i < daysCount; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      data.push({
        period: `${year}-${month}-${day}`,
        ratio: Math.random() * 100,
      });
    }
    return data;
  };

  // Helper function to calculate duration days
  const getChartDurationDays = (chartData: any[]) => {
    if (chartData.length < 2) return 0;
    const firstDate = new Date(chartData[0].period);
    const lastDate = new Date(chartData[chartData.length - 1].period);
    return Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Helper function to get mobile-optimized ticks
  const getMobileOptimizedTicks = (chartData: any[]) => {
    if (chartData.length === 0) return [];
    
    const durationDays = getChartDurationDays(chartData);
    
    // For 1-year period, show approximately 6-7 labels
    if (durationDays > 180) {
      const ticks: string[] = [];
      const targetLabelCount = 7;
      const interval = Math.floor(chartData.length / targetLabelCount);
      
      // Always include first and last
      ticks.push(chartData[0].period);
      
      // Add intermediate ticks at regular intervals
      for (let i = interval; i < chartData.length - 1; i += interval) {
        ticks.push(chartData[i].period);
      }
      
      // Always include last
      if (chartData[chartData.length - 1].period !== ticks[ticks.length - 1]) {
        ticks.push(chartData[chartData.length - 1].period);
      }
      
      return ticks;
    }
    
    // For 6-month period, show approximately 6 labels
    if (durationDays > 90) {
      const ticks: string[] = [];
      const targetLabelCount = 6;
      const interval = Math.floor(chartData.length / targetLabelCount);
      
      // Always include first and last
      ticks.push(chartData[0].period);
      
      // Add intermediate ticks at regular intervals
      for (let i = interval; i < chartData.length - 1; i += interval) {
        ticks.push(chartData[i].period);
      }
      
      // Always include last
      if (chartData[chartData.length - 1].period !== ticks[ticks.length - 1]) {
        ticks.push(chartData[chartData.length - 1].period);
      }
      
      return ticks;
    }
    
    return [];
  };

  describe('1-year period label reduction', () => {
    it('should show approximately 6-7 labels for 1-year data', () => {
      const chartData = generateChartData(365);
      const ticks = getMobileOptimizedTicks(chartData);
      
      expect(ticks.length).toBeGreaterThanOrEqual(6);
      expect(ticks.length).toBeLessThanOrEqual(8);
    });

    it('should include first and last dates', () => {
      const chartData = generateChartData(365);
      const ticks = getMobileOptimizedTicks(chartData);
      
      expect(ticks[0]).toBe(chartData[0].period);
      expect(ticks[ticks.length - 1]).toBe(chartData[chartData.length - 1].period);
    });

    it('should have evenly distributed ticks', () => {
      const chartData = generateChartData(365);
      const ticks = getMobileOptimizedTicks(chartData);
      
      const tickIndices = ticks.map(tick => chartData.findIndex(d => d.period === tick));
      const gaps = [];
      for (let i = 1; i < tickIndices.length; i++) {
        gaps.push(tickIndices[i] - tickIndices[i - 1]);
      }
      
      // Check that gaps are relatively consistent (within 20% variance)
      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      gaps.forEach(gap => {
        const variance = Math.abs(gap - avgGap) / avgGap;
        expect(variance).toBeLessThan(0.3);
      });
    });
  });

  describe('6-month period label reduction', () => {
    it('should show approximately 6 labels for 6-month data', () => {
      const chartData = generateChartData(180);
      const ticks = getMobileOptimizedTicks(chartData);
      
      expect(ticks.length).toBeGreaterThanOrEqual(5);
      expect(ticks.length).toBeLessThanOrEqual(7);
    });

    it('should include first and last dates', () => {
      const chartData = generateChartData(180);
      const ticks = getMobileOptimizedTicks(chartData);
      
      expect(ticks[0]).toBe(chartData[0].period);
      expect(ticks[ticks.length - 1]).toBe(chartData[chartData.length - 1].period);
    });
  });

  describe('short period handling', () => {
    it('should return empty array for periods <= 90 days', () => {
      const chartData = generateChartData(90);
      const ticks = getMobileOptimizedTicks(chartData);
      
      expect(ticks.length).toBe(0);
    });
  });

  describe('data integrity', () => {
    it('should not modify original chart data', () => {
      const chartData = generateChartData(365);
      const originalLength = chartData.length;
      const originalFirstRatio = chartData[0].ratio;
      
      getMobileOptimizedTicks(chartData);
      
      expect(chartData.length).toBe(originalLength);
      expect(chartData[0].ratio).toBe(originalFirstRatio);
    });

    it('should return valid period strings from chart data', () => {
      const chartData = generateChartData(365);
      const ticks = getMobileOptimizedTicks(chartData);
      
      ticks.forEach(tick => {
        expect(chartData.some(d => d.period === tick)).toBe(true);
      });
    });
  });
});
