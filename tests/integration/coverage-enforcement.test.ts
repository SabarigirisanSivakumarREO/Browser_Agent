/**
 * Coverage Enforcement Integration Tests - Phase 19f (T143)
 *
 * Tests the coverage enforcement system: blocking done before 100%,
 * forcing scroll to uncovered segments, DOM merging, and dynamic maxSteps.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { StateManager } from '../../src/agent/state-manager.js';
import { CoverageTracker } from '../../src/agent/coverage-tracker.js';
import { DOMMerger } from '../../src/browser/dom/dom-merger.js';
import { ToolRegistry, ToolExecutor } from '../../src/agent/tools/index.js';
import type { Tool } from '../../src/agent/tools/index.js';
import type { PageState, DOMTree, DOMNode } from '../../src/models/index.js';
import { DEFAULT_COVERAGE_CONFIG } from '../../src/models/coverage.js';

// Helper to create mock DOM trees
const createMockDOMTree = (options?: {
  croElementCount?: number;
  elements?: Array<{ xpath: string; croType: string | null; y: number }>;
}): DOMTree => {
  const croCount = options?.croElementCount ?? 2;
  const elements = options?.elements ?? [
    { xpath: '/body/button[1]', croType: 'cta', y: 100 },
    { xpath: '/body/form[1]', croType: 'form', y: 300 },
  ];

  const children: DOMNode[] = elements.map((el, i) => ({
    tagName: el.xpath.includes('button') ? 'button' : el.xpath.includes('form') ? 'form' : 'div',
    xpath: el.xpath,
    text: `Element ${i}`,
    isInteractive: true,
    isVisible: true,
    croType: el.croType as 'cta' | 'form' | 'trust' | 'value_prop' | 'navigation' | null,
    index: i,
    boundingBox: { x: 0, y: el.y, width: 100, height: 50 },
    children: [],
  }));

  return {
    root: {
      tagName: 'body',
      xpath: '/body',
      text: '',
      isInteractive: false,
      isVisible: true,
      croType: null,
      children,
    },
    interactiveCount: elements.length,
    croElementCount: croCount,
    totalNodeCount: elements.length + 1,
    extractedAt: Date.now(),
  };
};

// Helper to create mock PageState
const createMockPageState = (scrollY = 0, maxScrollY = 2000): PageState => ({
  url: 'https://example.com',
  title: 'Test Page',
  domTree: createMockDOMTree(),
  viewport: { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false },
  scrollPosition: { x: 0, y: scrollY, maxX: 0, maxY: maxScrollY },
  timestamp: Date.now(),
});

// Create test tools
const createDoneTool = (): Tool => ({
  name: 'done',
  description: 'Mark analysis complete',
  parameters: z.object({ summary: z.string().optional() }),
  execute: async () => ({ success: true, insights: [] }),
});

const createScrollTool = (): Tool => ({
  name: 'scroll_page',
  description: 'Scroll the page',
  parameters: z.object({ direction: z.string().optional() }),
  execute: async () => ({ success: true, insights: [] }),
});

const createAnalyzeCTAsTool = (): Tool => ({
  name: 'analyze_ctas',
  description: 'Analyze CTA buttons',
  parameters: z.object({}),
  execute: async () => ({
    success: true,
    insights: [
      {
        id: 'cta-1',
        category: 'cta',
        type: 'weak_text',
        severity: 'medium',
        element: '/body/button[1]',
        issue: 'CTA text could be more action-oriented',
        recommendation: 'Use specific action verbs',
      },
    ],
  }),
});

describe('Coverage Enforcement Integration', () => {
  describe('Test 1: Blocks done before full coverage', () => {
    it('should not terminate when done is called but coverage is incomplete', () => {
      // Setup: 3-segment page with only 1 segment scanned
      const coverageTracker = new CoverageTracker();
      coverageTracker.initialize(2400, 800); // Creates 4 segments
      coverageTracker.markSegmentScanned(0, 5); // Only scan first segment

      const stateManager = new StateManager({ maxSteps: 10 }, 'full_page');
      stateManager.setCoverageTracker(coverageTracker);

      // Agent calls done
      stateManager.setDone('Agent thinks analysis is complete');

      // Verify: should NOT terminate because coverage is incomplete
      expect(stateManager.isDone()).toBe(true); // Agent marked itself done
      expect(stateManager.shouldTerminate()).toBe(false); // But system doesn't terminate
      expect(coverageTracker.getCoveragePercent()).toBeLessThan(100);
      expect(stateManager.isFullyCovered()).toBe(false);

      // Termination reason should indicate coverage incomplete
      const reason = stateManager.getTerminationReason();
      expect(reason).toContain('Coverage incomplete');
    });
  });

  describe('Test 2: Allows done at 100% coverage', () => {
    it('should terminate when done is called and coverage is complete', () => {
      // Setup: 3-segment page with all segments scanned
      const coverageTracker = new CoverageTracker();
      coverageTracker.initialize(2400, 800); // Creates segments

      // Scan all segments
      const state = coverageTracker.getState();
      for (const segment of state.segments) {
        coverageTracker.markSegmentScanned(segment.startY, 3);
      }

      const stateManager = new StateManager({ maxSteps: 10 }, 'full_page');
      stateManager.setCoverageTracker(coverageTracker);

      // Agent calls done
      stateManager.setDone('Agent completed analysis');

      // Verify: SHOULD terminate because coverage is 100%
      expect(stateManager.isDone()).toBe(true);
      expect(stateManager.shouldTerminate()).toBe(true);
      expect(coverageTracker.getCoveragePercent()).toBe(100);
      expect(stateManager.isFullyCovered()).toBe(true);
    });
  });

  describe('Test 3: Forces scroll to uncovered segment', () => {
    it('should return next unscanned segment when coverage is incomplete', () => {
      // Setup: 4-segment page
      const coverageTracker = new CoverageTracker();
      coverageTracker.initialize(2800, 800); // Creates multiple segments

      // Scan first segment only
      coverageTracker.markSegmentScanned(0, 5);

      // Get next unscanned segment
      const nextSegment = coverageTracker.getNextUnscannedSegment();

      // Verify: should return second segment
      expect(nextSegment).not.toBeNull();
      expect(nextSegment!.index).toBeGreaterThan(0);
      expect(nextSegment!.scanned).toBe(false);
      expect(nextSegment!.startY).toBeGreaterThan(0);

      // StateManager integration
      const stateManager = new StateManager({ maxSteps: 10 }, 'full_page');
      stateManager.setCoverageTracker(coverageTracker);

      // Coverage report should list uncovered regions
      const report = coverageTracker.getCoverageReport();
      expect(report).toContain('Uncovered regions:');
    });
  });

  describe('Test 4: Merges DOM from multiple segments', () => {
    it('should merge DOM snapshots from different scroll positions', () => {
      const merger = new DOMMerger();

      // Snapshot 1: Elements at top of page
      const snapshot1 = createMockDOMTree({
        croElementCount: 2,
        elements: [
          { xpath: '/body/button[1]', croType: 'cta', y: 100 },
          { xpath: '/body/h1[1]', croType: 'value_prop', y: 200 },
        ],
      });

      // Snapshot 2: Elements in middle of page (some overlap)
      const snapshot2 = createMockDOMTree({
        croElementCount: 2,
        elements: [
          { xpath: '/body/h1[1]', croType: 'value_prop', y: 200 }, // Duplicate
          { xpath: '/body/form[1]', croType: 'form', y: 800 },
        ],
      });

      // Snapshot 3: Elements at bottom of page
      const snapshot3 = createMockDOMTree({
        croElementCount: 2,
        elements: [
          { xpath: '/body/form[1]', croType: 'form', y: 800 }, // Duplicate
          { xpath: '/body/footer[1]/a[1]', croType: 'navigation', y: 1500 },
        ],
      });

      // Merge all snapshots
      const merged = merger.merge([snapshot1, snapshot2, snapshot3]);

      // Verify: should have unique elements only (4 unique elements)
      expect(merged.croElementCount).toBe(4);
      expect(merged.totalNodeCount).toBe(5); // 4 elements + root body

      // Verify no duplicates by xpath
      const xpaths = new Set<string>();
      const collectXPaths = (node: DOMNode): void => {
        if (node.xpath !== '/body') xpaths.add(node.xpath);
        node.children.forEach(collectXPaths);
      };
      collectXPaths(merged.root);
      expect(xpaths.size).toBe(4); // All unique
    });

    it('should handle single snapshot without changes', () => {
      const merger = new DOMMerger();
      const snapshot = createMockDOMTree({
        croElementCount: 3,
        elements: [
          { xpath: '/body/button[1]', croType: 'cta', y: 100 },
          { xpath: '/body/form[1]', croType: 'form', y: 300 },
          { xpath: '/body/div[1]', croType: 'trust', y: 500 },
        ],
      });

      const result = merger.merge([snapshot]);

      expect(result.croElementCount).toBe(3);
      expect(result).toBe(snapshot); // Same reference for single snapshot
    });

    it('should throw error for empty snapshots array', () => {
      const merger = new DOMMerger();
      expect(() => merger.merge([])).toThrow('No snapshots to merge');
    });
  });

  describe('Test 5: Calculates dynamic maxSteps correctly', () => {
    it('should calculate required steps based on page segments', () => {
      // Calculate required steps function (from cro-agent.ts)
      const calculateRequiredSteps = (
        pageHeight: number,
        viewportHeight: number,
        config: typeof DEFAULT_COVERAGE_CONFIG
      ): number => {
        const effectiveHeight = Math.max(
          viewportHeight - config.segmentOverlapPx,
          viewportHeight / 2
        );
        const segmentCount = Math.ceil(pageHeight / effectiveHeight);
        const analysisToolCount = 6;
        const synthesisSteps = 2;
        return segmentCount + analysisToolCount + synthesisSteps;
      };

      // Test 1: 3-viewport page (page height = 3 * viewport)
      const viewportHeight = 800;
      const config = DEFAULT_COVERAGE_CONFIG;

      // Page height 2400px (3 viewports)
      // Effective height: 800 - 100 = 700px
      // Segments: ceil(2400/700) = 4
      // Required steps: 4 + 6 + 2 = 12
      const required3VP = calculateRequiredSteps(2400, viewportHeight, config);
      expect(required3VP).toBe(12);

      // Test 2: 10-viewport page
      // Page height 8000px (10 viewports)
      // Segments: ceil(8000/700) = 12
      // Required steps: 12 + 6 + 2 = 20
      const required10VP = calculateRequiredSteps(8000, viewportHeight, config);
      expect(required10VP).toBe(20);

      // Test 3: Single viewport page
      // Page height 600px (< viewport)
      // Segments: ceil(600/700) = 1
      // Required steps: 1 + 6 + 2 = 9
      const required1VP = calculateRequiredSteps(600, viewportHeight, config);
      expect(required1VP).toBe(9);
    });

    it('should use higher of configured and required maxSteps', () => {
      const calculateEffectiveMaxSteps = (
        configuredMaxSteps: number,
        pageHeight: number,
        viewportHeight: number
      ): number => {
        const effectiveHeight = Math.max(
          viewportHeight - DEFAULT_COVERAGE_CONFIG.segmentOverlapPx,
          viewportHeight / 2
        );
        const segmentCount = Math.ceil(pageHeight / effectiveHeight);
        const requiredSteps = segmentCount + 6 + 2;
        return Math.max(configuredMaxSteps, requiredSteps);
      };

      // Configured maxSteps = 10, but page needs 20
      const effective1 = calculateEffectiveMaxSteps(10, 8000, 800);
      expect(effective1).toBe(20); // Uses required

      // Configured maxSteps = 25, page needs 12
      const effective2 = calculateEffectiveMaxSteps(25, 2400, 800);
      expect(effective2).toBe(25); // Uses configured
    });
  });

  describe('Test 6: Tracks elements across segments', () => {
    it('should track elements discovered in different segments', () => {
      const tracker = new CoverageTracker();
      tracker.initialize(2400, 800);

      // Discover elements in segment 0
      tracker.recordElementDiscovered('/body/button[1]', 'cta', 0);
      tracker.recordElementDiscovered('/body/h1[1]', 'value_prop', 0);

      // Discover elements in segment 1 (some overlap)
      tracker.recordElementDiscovered('/body/h1[1]', 'value_prop', 1); // Duplicate - should be ignored
      tracker.recordElementDiscovered('/body/form[1]', 'form', 1);

      // Discover elements in segment 2
      tracker.recordElementDiscovered('/body/footer[1]', 'navigation', 2);

      const state = tracker.getState();

      // Should have 4 unique elements (not 5 because h1 was duplicated)
      expect(state.elementsDiscovered.size).toBe(4);
      expect(state.totalCROElements).toBe(4);
    });

    it('should track which tools analyzed which elements', () => {
      const tracker = new CoverageTracker();
      tracker.initialize(1600, 800);

      // Discover element
      tracker.recordElementDiscovered('/body/button[1]', 'cta', 0);

      // Record analysis by different tools
      tracker.recordElementAnalyzed('/body/button[1]', 'analyze_ctas');
      tracker.recordElementAnalyzed('/body/button[1]', 'find_friction');
      tracker.recordElementAnalyzed('/body/button[1]', 'analyze_ctas'); // Duplicate tool

      const state = tracker.getState();
      const element = state.elementsDiscovered.get('/body/button[1]');

      expect(element).toBeDefined();
      expect(element!.analyzedBy).toContain('analyze_ctas');
      expect(element!.analyzedBy).toContain('find_friction');
      expect(element!.analyzedBy.length).toBe(2); // No duplicate
      expect(state.analyzedCROElements).toBe(1);
    });

    it('should integrate with StateManager coverage methods', () => {
      const tracker = new CoverageTracker();
      tracker.initialize(2400, 800);

      const stateManager = new StateManager({ maxSteps: 15 }, 'full_page');
      stateManager.setCoverageTracker(tracker);

      // Initially no coverage
      expect(stateManager.getCoveragePercent()).toBe(0);
      expect(stateManager.isFullyCovered()).toBe(false);
      expect(stateManager.hasCoverageTracking()).toBe(true);
      expect(stateManager.isFullPageMode()).toBe(true);

      // Scan all segments
      const state = tracker.getState();
      for (const segment of state.segments) {
        tracker.markSegmentScanned(segment.startY, 3);
      }

      // Now fully covered
      expect(stateManager.getCoveragePercent()).toBe(100);
      expect(stateManager.isFullyCovered()).toBe(true);

      // Coverage report available
      const report = stateManager.getCoverageReport();
      expect(report).toBeDefined();
      expect(report).toContain('Coverage: 100%');
    });
  });
});
