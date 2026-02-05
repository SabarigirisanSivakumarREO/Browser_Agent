/**
 * Unit tests for calculateMaxCollectionSteps - Phase 25a (T476)
 *
 * Tests the dynamic calculation of max collection steps based on page dimensions.
 */

import { describe, it, expect } from 'vitest';
import { calculateMaxCollectionSteps } from '../../src/agent/cro-agent.js';

describe('calculateMaxCollectionSteps', () => {
  // Default values used in calculations
  const defaultViewportHeight = 720;
  const defaultOverlapPx = 120;

  describe('short page calculations', () => {
    it('should calculate correct steps for short page (1500px) → ~9 steps', () => {
      const pageHeight = 1500;
      const result = calculateMaxCollectionSteps(pageHeight, defaultViewportHeight, defaultOverlapPx);

      // scrollStep = 720 - 120 = 600
      // viewportsNeeded = ceil(1500 / 600) = 3
      // stepsNeeded = (3 * 2) + 1 = 7
      // buffer = ceil(7 * 0.2) = 2
      // total = max(5, 7 + 2) = 9
      expect(result).toBe(9);
    });
  });

  describe('long page calculations', () => {
    it('should calculate correct steps for long page (10000px) → ~42 steps', () => {
      const pageHeight = 10000;
      const result = calculateMaxCollectionSteps(pageHeight, defaultViewportHeight, defaultOverlapPx);

      // scrollStep = 720 - 120 = 600
      // viewportsNeeded = ceil(10000 / 600) = 17
      // stepsNeeded = (17 * 2) + 1 = 35
      // buffer = ceil(35 * 0.2) = 7
      // total = max(5, 35 + 7) = 42
      expect(result).toBe(42);
    });
  });

  describe('minimum enforcement', () => {
    it('should enforce minimum 5 steps for very short page (500px)', () => {
      const pageHeight = 500;
      const result = calculateMaxCollectionSteps(pageHeight, defaultViewportHeight, defaultOverlapPx);

      // scrollStep = 720 - 120 = 600
      // viewportsNeeded = ceil(500 / 600) = 1
      // stepsNeeded = (1 * 2) + 1 = 3
      // buffer = ceil(3 * 0.2) = 1
      // total = max(5, 3 + 1) = max(5, 4) = 5
      expect(result).toBe(5);
    });

    it('should return minimum 5 steps for zero page height', () => {
      const result = calculateMaxCollectionSteps(0, defaultViewportHeight, defaultOverlapPx);
      expect(result).toBe(5);
    });

    it('should return minimum 5 steps for zero viewport height', () => {
      const result = calculateMaxCollectionSteps(1500, 0, defaultOverlapPx);
      expect(result).toBe(5);
    });

    it('should return minimum 5 steps for negative dimensions', () => {
      const result = calculateMaxCollectionSteps(-1000, -720, defaultOverlapPx);
      expect(result).toBe(5);
    });
  });

  describe('buffer calculation', () => {
    it('should include 20% buffer in calculation', () => {
      const pageHeight = 3000;
      const result = calculateMaxCollectionSteps(pageHeight, defaultViewportHeight, defaultOverlapPx);

      // scrollStep = 720 - 120 = 600
      // viewportsNeeded = ceil(3000 / 600) = 5
      // stepsNeeded = (5 * 2) + 1 = 11
      // buffer = ceil(11 * 0.2) = 3 (rounded up from 2.2)
      // total = max(5, 11 + 3) = 14
      expect(result).toBe(14);

      // Verify buffer is applied (result should be greater than stepsNeeded without buffer)
      const stepsNeeded = 11;
      expect(result).toBeGreaterThan(stepsNeeded);
    });

    it('should round buffer up to nearest integer', () => {
      // Test case where buffer would be fractional
      const pageHeight = 1200;
      const result = calculateMaxCollectionSteps(pageHeight, defaultViewportHeight, defaultOverlapPx);

      // scrollStep = 600
      // viewportsNeeded = ceil(1200 / 600) = 2
      // stepsNeeded = (2 * 2) + 1 = 5
      // buffer = ceil(5 * 0.2) = ceil(1.0) = 1
      // total = max(5, 5 + 1) = 6
      expect(result).toBe(6);
    });
  });

  describe('custom overlap', () => {
    it('should respect custom overlap value', () => {
      const pageHeight = 2400;
      const customOverlap = 200;
      const result = calculateMaxCollectionSteps(pageHeight, defaultViewportHeight, customOverlap);

      // scrollStep = 720 - 200 = 520
      // viewportsNeeded = ceil(2400 / 520) = 5
      // stepsNeeded = (5 * 2) + 1 = 11
      // buffer = ceil(11 * 0.2) = 3
      // total = max(5, 11 + 3) = 14
      expect(result).toBe(14);
    });

    it('should handle overlap larger than half viewport by using viewport/2', () => {
      const pageHeight = 1500;
      const largeOverlap = 500; // More than half of 720
      const result = calculateMaxCollectionSteps(pageHeight, defaultViewportHeight, largeOverlap);

      // When overlap is too large, scrollStep = max(720 - 500, 720/2) = max(220, 360) = 360
      // viewportsNeeded = ceil(1500 / 360) = 5
      // stepsNeeded = (5 * 2) + 1 = 11
      // buffer = ceil(11 * 0.2) = 3
      // total = max(5, 11 + 3) = 14
      expect(result).toBe(14);
    });
  });

  describe('various page sizes', () => {
    it('should scale proportionally with page height', () => {
      const steps2000 = calculateMaxCollectionSteps(2000, defaultViewportHeight);
      const steps4000 = calculateMaxCollectionSteps(4000, defaultViewportHeight);
      const steps8000 = calculateMaxCollectionSteps(8000, defaultViewportHeight);

      // Larger pages should require more steps
      expect(steps4000).toBeGreaterThan(steps2000);
      expect(steps8000).toBeGreaterThan(steps4000);
    });

    it('should handle page height equal to viewport height', () => {
      const result = calculateMaxCollectionSteps(720, defaultViewportHeight, defaultOverlapPx);

      // scrollStep = 600
      // viewportsNeeded = ceil(720 / 600) = 2
      // stepsNeeded = (2 * 2) + 1 = 5
      // buffer = ceil(5 * 0.2) = 1
      // total = max(5, 5 + 1) = 6
      expect(result).toBe(6);
    });

    it('should handle page height slightly larger than viewport', () => {
      const result = calculateMaxCollectionSteps(800, defaultViewportHeight, defaultOverlapPx);

      // scrollStep = 600
      // viewportsNeeded = ceil(800 / 600) = 2
      // stepsNeeded = (2 * 2) + 1 = 5
      // buffer = ceil(5 * 0.2) = 1
      // total = max(5, 5 + 1) = 6
      expect(result).toBe(6);
    });
  });

  describe('default overlap parameter', () => {
    it('should use default 120px overlap when not specified', () => {
      const withDefault = calculateMaxCollectionSteps(3000, defaultViewportHeight);
      const withExplicit = calculateMaxCollectionSteps(3000, defaultViewportHeight, 120);

      expect(withDefault).toBe(withExplicit);
    });
  });
});
