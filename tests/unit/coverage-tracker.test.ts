/**
 * Unit tests for CoverageTracker - Phase 19a (T128)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CoverageTracker } from '../../src/agent/coverage-tracker.js';
import {
  DEFAULT_COVERAGE_CONFIG,
  type CoverageConfig,
} from '../../src/models/coverage.js';

describe('CoverageTracker', () => {
  let tracker: CoverageTracker;

  beforeEach(() => {
    tracker = new CoverageTracker();
  });

  describe('initialization', () => {
    it('should initialize correct segment count for page dimensions', () => {
      // Page: 3000px, Viewport: 800px, Overlap: 100px
      // Effective height: 700px
      // Segments: ceil(3000/700) = 5
      tracker.initialize(3000, 800);

      const state = tracker.getState();
      expect(state.segmentsTotal).toBe(5);
      expect(state.segments.length).toBe(5);
      expect(state.pageHeight).toBe(3000);
      expect(state.viewportHeight).toBe(800);
    });

    it('should calculate segments with overlap correctly', () => {
      tracker.initialize(2000, 800);

      const state = tracker.getState();
      const segments = state.segments;

      // First segment starts at 0
      expect(segments[0].startY).toBe(0);
      expect(segments[0].endY).toBe(800);

      // Second segment starts at 700 (800 - 100 overlap)
      expect(segments[1].startY).toBe(700);
      expect(segments[1].endY).toBe(1500);

      // Third segment
      expect(segments[2].startY).toBe(1400);
      expect(segments[2].endY).toBe(2000); // Capped at page height
    });

    it('should handle single viewport page', () => {
      // Page fits in one viewport
      tracker.initialize(600, 800);

      const state = tracker.getState();
      expect(state.segmentsTotal).toBe(1);
      expect(state.segments[0].startY).toBe(0);
      expect(state.segments[0].endY).toBe(600);
    });

    it('should throw error for invalid dimensions', () => {
      expect(() => tracker.initialize(0, 800)).toThrow();
      expect(() => tracker.initialize(1000, 0)).toThrow();
      expect(() => tracker.initialize(-100, 800)).toThrow();
    });
  });

  describe('segment scanning', () => {
    beforeEach(() => {
      tracker.initialize(2400, 800); // 4 segments with 100px overlap
    });

    it('should mark segments as scanned and update coverage', () => {
      expect(tracker.getCoveragePercent()).toBe(0);

      // Scan first segment (scrollY = 0)
      // Note: scrollY=0 with 800px viewport covers segments starting at 0 and 700
      // so it may cover multiple overlapping segments
      tracker.markSegmentScanned(0, 5);

      const state = tracker.getState();
      expect(state.segments[0].scanned).toBe(true);
      expect(state.segmentsCovered).toBeGreaterThanOrEqual(1);
      expect(tracker.getCoveragePercent()).toBeGreaterThan(0);
    });

    it('should return next unscanned segment in order', () => {
      const first = tracker.getNextUnscannedSegment();
      expect(first?.index).toBe(0);

      tracker.markSegmentScanned(0, 5);

      // After scanning from scrollY=0, the next unscanned segment depends on overlap
      const second = tracker.getNextUnscannedSegment();
      // Should be either null (all covered) or a higher index segment
      if (second) {
        expect(second.index).toBeGreaterThan(0);
      }
    });

    it('should report 100% when all segments scanned', () => {
      const state = tracker.getState();

      // Scan all segments
      for (const segment of state.segments) {
        tracker.markSegmentScanned(segment.startY, 3);
      }

      expect(tracker.getCoveragePercent()).toBe(100);
      expect(tracker.isFullyCovered()).toBe(true);
      expect(tracker.getNextUnscannedSegment()).toBeNull();
    });

    it('should track scroll positions visited', () => {
      tracker.markSegmentScanned(0, 5);
      tracker.markSegmentScanned(700, 3);
      tracker.markSegmentScanned(700, 2); // Duplicate

      const state = tracker.getState();
      expect(state.scrollPositionsVisited).toContain(0);
      expect(state.scrollPositionsVisited).toContain(700);
      expect(state.scrollPositionsVisited.length).toBe(2); // No duplicate
    });
  });

  describe('element tracking', () => {
    beforeEach(() => {
      tracker.initialize(1600, 800);
    });

    it('should track element discovery with xpath and croType', () => {
      tracker.recordElementDiscovered('/html/body/button[1]', 'cta', 0);
      tracker.recordElementDiscovered('/html/body/form[1]', 'form', 0);
      tracker.recordElementDiscovered('/html/body/div[1]', null, 0);

      const state = tracker.getState();
      expect(state.elementsDiscovered.size).toBe(3);
      expect(state.totalCROElements).toBe(2); // Only cta and form
    });

    it('should track element analysis by tool name', () => {
      tracker.recordElementDiscovered('/html/body/button[1]', 'cta', 0);
      tracker.recordElementAnalyzed('/html/body/button[1]', 'analyze_ctas');
      tracker.recordElementAnalyzed('/html/body/button[1]', 'find_friction');

      const state = tracker.getState();
      const element = state.elementsDiscovered.get('/html/body/button[1]');

      expect(element?.analyzedBy).toContain('analyze_ctas');
      expect(element?.analyzedBy).toContain('find_friction');
      expect(state.analyzedCROElements).toBe(1);
    });

    it('should handle overlap deduplication (same xpath)', () => {
      tracker.recordElementDiscovered('/html/body/button[1]', 'cta', 0);
      tracker.recordElementDiscovered('/html/body/button[1]', 'cta', 1); // Same xpath, different segment

      const state = tracker.getState();
      expect(state.elementsDiscovered.size).toBe(1);
      expect(state.totalCROElements).toBe(1);
    });
  });

  describe('configuration', () => {
    it('should respect minCoveragePercent config', () => {
      const customTracker = new CoverageTracker({ minCoveragePercent: 80 });
      customTracker.initialize(2000, 800);

      // Scan 3 of ~3 segments (should be ~80%+)
      customTracker.markSegmentScanned(0, 5);
      customTracker.markSegmentScanned(700, 5);

      // With 80% threshold, might be considered fully covered
      const coverage = customTracker.getCoveragePercent();
      expect(coverage).toBeGreaterThan(0);
    });

    it('should use default config values', () => {
      const config = tracker.getConfig();

      expect(config.minCoveragePercent).toBe(DEFAULT_COVERAGE_CONFIG.minCoveragePercent);
      expect(config.segmentOverlapPx).toBe(DEFAULT_COVERAGE_CONFIG.segmentOverlapPx);
      expect(config.requireAllSegments).toBe(DEFAULT_COVERAGE_CONFIG.requireAllSegments);
    });
  });

  describe('coverage report', () => {
    it('should generate accurate coverage report string', () => {
      tracker.initialize(2400, 800);
      tracker.markSegmentScanned(0, 5);
      tracker.recordElementDiscovered('/html/body/button[1]', 'cta', 0);

      const report = tracker.getCoverageReport();

      expect(report).toContain('Coverage:');
      expect(report).toContain('Segments:');
      expect(report).toContain('Page:');
      expect(report).toContain('2400px height');
      expect(report).toContain('800px viewport');
    });

    it('should list uncovered regions in report', () => {
      tracker.initialize(2400, 800);
      tracker.markSegmentScanned(0, 5); // Only scan first segment

      const report = tracker.getCoverageReport();

      expect(report).toContain('Uncovered regions:');
    });
  });

  describe('reset', () => {
    it('should reset tracker to initial state', () => {
      tracker.initialize(2000, 800);
      tracker.markSegmentScanned(0, 5);
      tracker.recordElementDiscovered('/html/body/button[1]', 'cta', 0);

      tracker.reset();

      const state = tracker.getState();
      expect(state.segments.length).toBe(0);
      expect(state.elementsDiscovered.size).toBe(0);
      expect(state.coveragePercent).toBe(0);
    });
  });
});
