/**
 * VisionStateManager Unit Tests
 *
 * Phase 21g (T337): Tests for VisionStateManager class.
 * Phase 21h (T362): Tests for evidence field attachment.
 * Verifies state initialization, mutations, termination logic, summary generation, and evidence capture.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VisionStateManager, type ViewportContext } from '../../src/agent/vision/vision-state-manager.js';
import type {
  VisionAgentStateInit,
  ViewportSnapshot,
  BatchEvaluation,
  HeuristicDefinition,
} from '../../src/agent/vision/types.js';
import type { ViewportInfo } from '../../src/models/page-state.js';
import type { BoundingBox, HeuristicEvaluation } from '../../src/heuristics/vision/types.js';
import type { DOMTree } from '../../src/models/dom-tree.js';
import type { ElementMapping, ScreenshotCoords } from '../../src/browser/dom/coordinate-mapper.js';

// Helper to create a mock viewport
const createMockViewport = (overrides?: Partial<ViewportInfo>): ViewportInfo => ({
  width: 1920,
  height: 1080,
  deviceScaleFactor: 1,
  isMobile: false,
  ...overrides,
});

// Helper to create initialization params
const createMockInit = (overrides?: Partial<VisionAgentStateInit>): VisionAgentStateInit => ({
  heuristicIds: ['PDP-CTA-001', 'PDP-CTA-002', 'PDP-PRICE-001', 'PDP-IMAGE-001'],
  pageHeight: 3000,
  viewport: createMockViewport(),
  ...overrides,
});

// Helper to create a mock snapshot
const createMockSnapshot = (overrides?: Partial<ViewportSnapshot>): ViewportSnapshot => ({
  scrollPosition: 0,
  viewportIndex: 0,
  screenshot: {
    base64: 'mock-base64-data',
    capturedAt: Date.now(),
  },
  dom: {
    tree: { tagName: 'body', children: [] } as any,
    serialized: '<body>mock dom</body>',
    elementCount: 5,
  },
  heuristicsEvaluated: [],
  ...overrides,
});

// Helper to create batch evaluations
const createMockBatchEvaluation = (overrides?: Partial<BatchEvaluation>): BatchEvaluation => ({
  heuristicId: 'PDP-CTA-001',
  status: 'pass',
  observation: 'CTA button is prominently displayed',
  confidence: 0.95,
  ...overrides,
});

// Helper to create heuristic definitions map
const createMockHeuristicDefinitions = (): Map<string, HeuristicDefinition> => {
  const definitions = new Map<string, HeuristicDefinition>();
  definitions.set('PDP-CTA-001', {
    id: 'PDP-CTA-001',
    principle: 'Add to cart button should be prominent',
    severity: 'critical',
    category: 'CTA',
  });
  definitions.set('PDP-CTA-002', {
    id: 'PDP-CTA-002',
    principle: 'CTA text should be action-oriented',
    severity: 'high',
    category: 'CTA',
  });
  definitions.set('PDP-PRICE-001', {
    id: 'PDP-PRICE-001',
    principle: 'Price should be clearly visible',
    severity: 'critical',
    category: 'Pricing',
  });
  definitions.set('PDP-IMAGE-001', {
    id: 'PDP-IMAGE-001',
    principle: 'Product images should be high quality',
    severity: 'high',
    category: 'Imagery',
  });
  return definitions;
};

describe('VisionStateManager', () => {
  let manager: VisionStateManager;
  let mockInit: VisionAgentStateInit;
  let mockDefinitions: Map<string, HeuristicDefinition>;

  beforeEach(() => {
    mockInit = createMockInit();
    mockDefinitions = createMockHeuristicDefinitions();
    manager = new VisionStateManager(mockInit);
  });

  describe('constructor', () => {
    // Test 1: Initializes with all heuristics pending
    it('should initialize with all heuristics pending', () => {
      expect(manager.getPendingHeuristicIds()).toHaveLength(4);
      expect(manager.getEvaluatedHeuristicIds().size).toBe(0);
    });

    // Test 2: Uses default options when none provided
    it('should use default options when none provided', () => {
      const state = manager.getState();
      expect(state.step).toBe(0);
      expect(state.isDone).toBe(false);
      expect(state.consecutiveFailures).toBe(0);
    });

    // Test 3: Merges custom options with defaults
    it('should merge custom options with defaults', () => {
      const customManager = new VisionStateManager(mockInit, { maxSteps: 5 });
      // The maxSteps is used in shouldTerminate, we can test by incrementing steps
      for (let i = 0; i < 5; i++) {
        customManager.incrementStep();
      }
      expect(customManager.shouldTerminate()).toBe(true);
    });

    // Test 4: Initializes with correct page dimensions
    it('should initialize with correct page dimensions', () => {
      const state = manager.getState();
      expect(state.pageHeight).toBe(3000);
      expect(state.viewportHeight).toBe(1080);
      expect(state.currentScrollY).toBe(0);
    });
  });

  describe('state accessors', () => {
    // Test 5: getState returns immutable copy
    it('should return immutable copy of state', () => {
      const state1 = manager.getState();
      manager.incrementStep();
      const state2 = manager.getState();

      expect(state1.step).toBe(0);
      expect(state2.step).toBe(1);
    });

    // Test 6: getSnapshots returns empty initially
    it('should return empty snapshots initially', () => {
      expect(manager.getSnapshots()).toHaveLength(0);
    });

    // Test 7: getLatestSnapshot returns undefined when no snapshots
    it('should return undefined when no snapshots', () => {
      expect(manager.getLatestSnapshot()).toBeUndefined();
    });

    // Test 8: getCoveragePercent returns 0 initially
    it('should return 0% coverage initially', () => {
      expect(manager.getCoveragePercent()).toBe(0);
    });

    // Test 9: getCoveragePercent returns 100 when empty heuristics
    it('should return 100% coverage when no heuristics to evaluate', () => {
      const emptyManager = new VisionStateManager({
        heuristicIds: [],
        pageHeight: 1000,
        viewport: createMockViewport(),
      });
      expect(emptyManager.getCoveragePercent()).toBe(100);
    });

    // Test 10: getScrollPercent returns 0 initially
    it('should return 0% scroll initially', () => {
      expect(manager.getScrollPercent()).toBe(0);
    });

    // Test 11: getScrollPercent handles single viewport page
    it('should return 100% scroll when page fits in viewport', () => {
      const smallPage = new VisionStateManager({
        heuristicIds: ['H1'],
        pageHeight: 500,
        viewport: createMockViewport({ height: 1080 }),
      });
      expect(smallPage.getScrollPercent()).toBe(100);
    });
  });

  describe('state mutators', () => {
    // Test 12: incrementStep increases step count
    it('should increment step counter', () => {
      expect(manager.getStep()).toBe(0);
      manager.incrementStep();
      expect(manager.getStep()).toBe(1);
      manager.incrementStep();
      expect(manager.getStep()).toBe(2);
    });

    // Test 13: updateScrollPosition updates and clamps
    it('should update scroll position and clamp to bounds', () => {
      manager.updateScrollPosition(500);
      expect(manager.getCurrentScrollY()).toBe(500);

      // Test clamping to page height
      manager.updateScrollPosition(5000);
      expect(manager.getCurrentScrollY()).toBe(3000); // pageHeight

      // Test clamping to 0
      manager.updateScrollPosition(-100);
      expect(manager.getCurrentScrollY()).toBe(0);
    });

    // Test 14: recordSnapshot adds snapshot
    it('should record snapshots', () => {
      const snapshot1 = createMockSnapshot({ viewportIndex: 0 });
      const snapshot2 = createMockSnapshot({ viewportIndex: 1, scrollPosition: 1080 });

      manager.recordSnapshot(snapshot1);
      expect(manager.getSnapshots()).toHaveLength(1);

      manager.recordSnapshot(snapshot2);
      expect(manager.getSnapshots()).toHaveLength(2);
      expect(manager.getLatestSnapshot()?.viewportIndex).toBe(1);
    });

    // Test 15: updatePageHeight updates height
    it('should update page height', () => {
      manager.updatePageHeight(5000);
      expect(manager.getState().pageHeight).toBe(5000);
    });
  });

  describe('addEvaluations', () => {
    // Test 16: adds valid evaluations
    it('should add valid evaluations and update pending list', () => {
      const evaluations: BatchEvaluation[] = [
        createMockBatchEvaluation({ heuristicId: 'PDP-CTA-001', status: 'pass' }),
        createMockBatchEvaluation({ heuristicId: 'PDP-CTA-002', status: 'fail', issue: 'Weak text' }),
      ];

      const result = manager.addEvaluations(evaluations, mockDefinitions);

      expect(result.added).toHaveLength(2);
      expect(result.skipped).toHaveLength(0);
      expect(manager.getEvaluations()).toHaveLength(2);
      expect(manager.getPendingHeuristicIds()).toHaveLength(2);
      expect(manager.getCoveragePercent()).toBe(50);
    });

    // Test 17: skips already evaluated heuristics
    it('should skip already evaluated heuristics', () => {
      const eval1: BatchEvaluation[] = [
        createMockBatchEvaluation({ heuristicId: 'PDP-CTA-001' }),
      ];
      manager.addEvaluations(eval1, mockDefinitions);

      // Try to add the same heuristic again
      const eval2: BatchEvaluation[] = [
        createMockBatchEvaluation({ heuristicId: 'PDP-CTA-001' }),
        createMockBatchEvaluation({ heuristicId: 'PDP-CTA-002' }),
      ];
      const result = manager.addEvaluations(eval2, mockDefinitions);

      expect(result.added).toEqual(['PDP-CTA-002']);
      expect(result.skipped).toEqual(['PDP-CTA-001']);
      expect(manager.getEvaluations()).toHaveLength(2);
    });

    // Test 18: skips unknown heuristics
    it('should skip unknown heuristics', () => {
      const evaluations: BatchEvaluation[] = [
        createMockBatchEvaluation({ heuristicId: 'UNKNOWN-001' }),
      ];

      const result = manager.addEvaluations(evaluations, mockDefinitions);

      expect(result.added).toHaveLength(0);
      expect(result.skipped).toEqual(['UNKNOWN-001']);
    });

    // Test 19: isHeuristicEvaluated returns correct value
    it('should correctly report if heuristic is evaluated', () => {
      expect(manager.isHeuristicEvaluated('PDP-CTA-001')).toBe(false);

      manager.addEvaluations(
        [createMockBatchEvaluation({ heuristicId: 'PDP-CTA-001' })],
        mockDefinitions
      );

      expect(manager.isHeuristicEvaluated('PDP-CTA-001')).toBe(true);
      expect(manager.isHeuristicEvaluated('PDP-CTA-002')).toBe(false);
    });
  });

  describe('failure tracking', () => {
    // Test 20: recordFailure increments counter
    it('should increment consecutive failures', () => {
      expect(manager.getState().consecutiveFailures).toBe(0);
      manager.recordFailure();
      expect(manager.getState().consecutiveFailures).toBe(1);
      manager.recordFailure();
      expect(manager.getState().consecutiveFailures).toBe(2);
    });

    // Test 21: resetFailures clears counter
    it('should reset consecutive failures', () => {
      manager.recordFailure();
      manager.recordFailure();
      expect(manager.getState().consecutiveFailures).toBe(2);

      manager.resetFailures();
      expect(manager.getState().consecutiveFailures).toBe(0);
    });
  });

  describe('termination logic', () => {
    // Test 22: shouldTerminate when all heuristics evaluated (with sufficient scroll)
    it('should terminate when all heuristics evaluated and scroll is sufficient', () => {
      const allEvaluations: BatchEvaluation[] = [
        createMockBatchEvaluation({ heuristicId: 'PDP-CTA-001' }),
        createMockBatchEvaluation({ heuristicId: 'PDP-CTA-002' }),
        createMockBatchEvaluation({ heuristicId: 'PDP-PRICE-001' }),
        createMockBatchEvaluation({ heuristicId: 'PDP-IMAGE-001' }),
      ];

      // Scroll to 50%+ to satisfy minimum scroll requirement
      // maxScroll = 3000 - 1080 = 1920, 50% = 960
      manager.updateScrollPosition(1000);

      manager.addEvaluations(allEvaluations, mockDefinitions);
      expect(manager.shouldTerminate()).toBe(true);
      expect(manager.getTerminationReason()).toBe('all_heuristics_evaluated');
    });

    // Test 22b: shouldTerminate NOT when all heuristics evaluated but scroll insufficient
    it('should NOT terminate when all heuristics evaluated but scroll is insufficient', () => {
      const allEvaluations: BatchEvaluation[] = [
        createMockBatchEvaluation({ heuristicId: 'PDP-CTA-001' }),
        createMockBatchEvaluation({ heuristicId: 'PDP-CTA-002' }),
        createMockBatchEvaluation({ heuristicId: 'PDP-PRICE-001' }),
        createMockBatchEvaluation({ heuristicId: 'PDP-IMAGE-001' }),
      ];

      // No scrolling (scroll at 0%)
      manager.addEvaluations(allEvaluations, mockDefinitions);
      expect(manager.shouldTerminate()).toBe(false); // Should NOT terminate
      expect(manager.getTerminationReason()).toBeUndefined(); // No termination reason yet
    });

    // Test 22c: shouldTerminate on short page without scrolling
    it('should terminate on short page without scrolling requirement', () => {
      // Create manager with short page (less than 1.5x viewport)
      const shortPageInit = createMockInit({ pageHeight: 1500 }); // 1500 < 1080 * 1.5 = 1620
      const shortManager = new VisionStateManager(shortPageInit);

      const allEvaluations: BatchEvaluation[] = [
        createMockBatchEvaluation({ heuristicId: 'PDP-CTA-001' }),
        createMockBatchEvaluation({ heuristicId: 'PDP-CTA-002' }),
        createMockBatchEvaluation({ heuristicId: 'PDP-PRICE-001' }),
        createMockBatchEvaluation({ heuristicId: 'PDP-IMAGE-001' }),
      ];

      shortManager.addEvaluations(allEvaluations, mockDefinitions);
      expect(shortManager.shouldTerminate()).toBe(true);
      expect(shortManager.getTerminationReason()).toBe('all_heuristics_evaluated');
    });

    // Test 23: shouldTerminate when max steps reached
    it('should terminate when max steps reached', () => {
      const mgr = new VisionStateManager(mockInit, { maxSteps: 3 });
      expect(mgr.shouldTerminate()).toBe(false);

      mgr.incrementStep();
      mgr.incrementStep();
      mgr.incrementStep();
      expect(mgr.shouldTerminate()).toBe(true);
      expect(mgr.getTerminationReason()).toBe('max_steps_reached');
    });

    // Test 24: shouldTerminate when consecutive failures exceeded
    it('should terminate when consecutive failures exceeded', () => {
      const mgr = new VisionStateManager(mockInit, { maxConsecutiveFailures: 2 });
      expect(mgr.shouldTerminate()).toBe(false);

      mgr.recordFailure();
      mgr.recordFailure();
      expect(mgr.shouldTerminate()).toBe(true);
      expect(mgr.getTerminationReason()).toBe('consecutive_failures');
    });

    // Test 25: markDone sets done state
    it('should mark as done with reason', () => {
      expect(manager.isDone()).toBe(false);

      manager.markDone('explicit_done');
      expect(manager.isDone()).toBe(true);
      expect(manager.getTerminationReason()).toBe('explicit_done');
    });

    // Test 26: markDone with error message
    it('should mark as done with error message', () => {
      manager.markDone('error', 'API timeout');
      expect(manager.isDone()).toBe(true);
      expect(manager.getState().errorMessage).toBe('API timeout');
    });
  });

  describe('canCallDone', () => {
    // Test 27: allowed when all evaluated
    it('should allow done when all heuristics evaluated', () => {
      const allEvaluations: BatchEvaluation[] = [
        createMockBatchEvaluation({ heuristicId: 'PDP-CTA-001' }),
        createMockBatchEvaluation({ heuristicId: 'PDP-CTA-002' }),
        createMockBatchEvaluation({ heuristicId: 'PDP-PRICE-001' }),
        createMockBatchEvaluation({ heuristicId: 'PDP-IMAGE-001' }),
      ];
      manager.addEvaluations(allEvaluations, mockDefinitions);

      const result = manager.canCallDone();
      expect(result.allowed).toBe(true);
    });

    // Test 28: blocked when pending without explanations
    it('should block done when pending heuristics without explanations', () => {
      const result = manager.canCallDone();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('4 heuristics still pending');
    });

    // Test 29: allowed when all pending explained
    it('should allow done when all pending have explanations', () => {
      const explanations = new Map<string, string>();
      explanations.set('PDP-CTA-001', 'Not visible on this page');
      explanations.set('PDP-CTA-002', 'Not applicable');
      explanations.set('PDP-PRICE-001', 'No price element found');
      explanations.set('PDP-IMAGE-001', 'Page has no images');

      const result = manager.canCallDone(explanations);
      expect(result.allowed).toBe(true);
    });

    // Test 30: blocked when some pending unexplained
    it('should block done when some pending are unexplained', () => {
      const explanations = new Map<string, string>();
      explanations.set('PDP-CTA-001', 'Not visible');
      // Missing explanations for CTA-002, PRICE-001, IMAGE-001

      const result = manager.canCallDone(explanations);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('3 heuristics not evaluated');
    });
  });

  describe('getSummary', () => {
    // Test 31: generates correct summary
    it('should generate correct summary statistics', () => {
      const evaluations: BatchEvaluation[] = [
        createMockBatchEvaluation({ heuristicId: 'PDP-CTA-001', status: 'pass' }),
        createMockBatchEvaluation({ heuristicId: 'PDP-CTA-002', status: 'fail', issue: 'Weak' }),
        createMockBatchEvaluation({ heuristicId: 'PDP-PRICE-001', status: 'partial' }),
      ];
      manager.addEvaluations(evaluations, mockDefinitions);

      const summary = manager.getSummary();

      expect(summary.totalHeuristics).toBe(4);
      expect(summary.evaluated).toBe(3);
      expect(summary.passed).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.partial).toBe(1);
      expect(summary.notApplicable).toBe(0);
      expect(summary.coveragePercent).toBe(75);
    });

    // Test 32: counts severity for failed/partial
    it('should count severity for failed and partial evaluations', () => {
      const evaluations: BatchEvaluation[] = [
        createMockBatchEvaluation({ heuristicId: 'PDP-CTA-001', status: 'fail' }), // critical
        createMockBatchEvaluation({ heuristicId: 'PDP-CTA-002', status: 'fail' }), // high
        createMockBatchEvaluation({ heuristicId: 'PDP-PRICE-001', status: 'partial' }), // critical
      ];
      manager.addEvaluations(evaluations, mockDefinitions);

      const summary = manager.getSummary();
      expect(summary.bySeverity.critical).toBe(2);
      expect(summary.bySeverity.high).toBe(1);
      expect(summary.bySeverity.medium).toBe(0);
      expect(summary.bySeverity.low).toBe(0);
    });
  });

  describe('getStatusString', () => {
    // Test 33: returns formatted status string
    it('should return formatted status string', () => {
      manager.incrementStep();
      manager.updateScrollPosition(500);
      manager.recordSnapshot(createMockSnapshot());
      manager.addEvaluations(
        [createMockBatchEvaluation({ heuristicId: 'PDP-CTA-001' })],
        mockDefinitions
      );

      const status = manager.getStatusString();
      expect(status).toContain('Step 1');
      expect(status).toContain('Scroll:');
      expect(status).toContain('Coverage: 25%');
      expect(status).toContain('Snapshots: 1');
    });
  });

  describe('markSnapshotHeuristics', () => {
    // Test 34: marks heuristics on snapshot
    it('should mark heuristics as evaluated on specific snapshot', () => {
      const snapshot = createMockSnapshot({ viewportIndex: 0 });
      manager.recordSnapshot(snapshot);

      manager.markSnapshotHeuristics(0, ['PDP-CTA-001', 'PDP-CTA-002']);

      const snapshots = manager.getSnapshots();
      expect(snapshots[0].heuristicsEvaluated).toContain('PDP-CTA-001');
      expect(snapshots[0].heuristicsEvaluated).toContain('PDP-CTA-002');
    });

    // Test 35: handles invalid viewport index gracefully
    it('should handle invalid viewport index gracefully', () => {
      // Should not throw
      manager.markSnapshotHeuristics(999, ['PDP-CTA-001']);
      expect(manager.getSnapshots()).toHaveLength(0);
    });
  });

  // Phase 21h (T362): Evidence field attachment tests
  describe('addEvaluations with viewportContext (Phase 21h)', () => {
    // Test 36: attaches viewportIndex and timestamp to evaluations
    it('should attach viewportIndex and timestamp to evaluations', () => {
      const viewportContext: ViewportContext = {
        viewportIndex: 2,
      };

      const evaluations: BatchEvaluation[] = [
        createMockBatchEvaluation({ heuristicId: 'PDP-CTA-001', status: 'pass' }),
      ];

      const beforeTime = Date.now();
      manager.addEvaluations(evaluations, mockDefinitions, viewportContext);
      const afterTime = Date.now();

      const storedEvaluations = manager.getEvaluations();
      expect(storedEvaluations).toHaveLength(1);
      expect(storedEvaluations[0].viewportIndex).toBe(2);
      expect(storedEvaluations[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(storedEvaluations[0].timestamp).toBeLessThanOrEqual(afterTime);
    });

    // Test 37: builds domElementRefs from elementIndices and DOM tree
    it('should build domElementRefs from elementIndices and DOM tree', () => {
      const mockDOMTree: DOMTree = {
        root: {
          tagName: 'body',
          xpath: '/body',
          text: '',
          isInteractive: false,
          isVisible: true,
          croType: null,
          children: [
            {
              tagName: 'button',
              xpath: '/body/button[1]',
              text: 'Add to Cart',
              isInteractive: true,
              isVisible: true,
              croType: 'cta',
              index: 0,
              children: [],
            },
            {
              tagName: 'span',
              xpath: '/body/span[1]',
              text: '$99.00 - Great Price!',
              isInteractive: false,
              isVisible: true,
              croType: 'trust',
              index: 3,
              children: [],
            },
          ],
        },
        interactiveCount: 1,
        croElementCount: 2,
        totalNodeCount: 3,
        extractedAt: Date.now(),
      };

      const viewportContext: ViewportContext = {
        viewportIndex: 0,
        domTree: mockDOMTree,
      };

      const evaluations: BatchEvaluation[] = [
        createMockBatchEvaluation({
          heuristicId: 'PDP-CTA-001',
          status: 'fail',
          elementIndices: [0, 3],
        }),
      ];

      manager.addEvaluations(evaluations, mockDefinitions, viewportContext);

      const storedEvaluations = manager.getEvaluations();
      expect(storedEvaluations).toHaveLength(1);
      expect(storedEvaluations[0].domElementRefs).toBeDefined();
      expect(storedEvaluations[0].domElementRefs).toHaveLength(2);

      // Check first element ref
      expect(storedEvaluations[0].domElementRefs![0].index).toBe(0);
      expect(storedEvaluations[0].domElementRefs![0].xpath).toBe('/body/button[1]');
      expect(storedEvaluations[0].domElementRefs![0].elementType).toBe('cta');
      expect(storedEvaluations[0].domElementRefs![0].textContent).toBe('Add to Cart');

      // Check second element ref (text should be truncated to 100 chars)
      expect(storedEvaluations[0].domElementRefs![1].index).toBe(3);
      expect(storedEvaluations[0].domElementRefs![1].elementType).toBe('trust');
    });

    // Test 38: looks up boundingBox from elementBoundingBoxes map
    it('should look up boundingBox from elementBoundingBoxes map', () => {
      const elementBoundingBoxes = new Map<number, BoundingBox>();
      elementBoundingBoxes.set(0, { x: 100, y: 200, width: 150, height: 50, viewportIndex: 1 });
      elementBoundingBoxes.set(5, { x: 300, y: 400, width: 200, height: 80, viewportIndex: 1 });

      const viewportContext: ViewportContext = {
        viewportIndex: 1,
        elementBoundingBoxes,
      };

      const evaluations: BatchEvaluation[] = [
        createMockBatchEvaluation({
          heuristicId: 'PDP-CTA-001',
          status: 'fail',
          elementIndices: [0, 5],
        }),
      ];

      manager.addEvaluations(evaluations, mockDefinitions, viewportContext);

      const storedEvaluations = manager.getEvaluations();
      expect(storedEvaluations[0].boundingBox).toBeDefined();
      expect(storedEvaluations[0].boundingBox!.x).toBe(100);
      expect(storedEvaluations[0].boundingBox!.y).toBe(200);
      expect(storedEvaluations[0].boundingBox!.width).toBe(150);
      expect(storedEvaluations[0].boundingBox!.height).toBe(50);
      expect(storedEvaluations[0].boundingBox!.viewportIndex).toBe(1);
    });

    // Test 39: handles evaluations without elementIndices gracefully
    it('should handle evaluations without elementIndices gracefully', () => {
      const viewportContext: ViewportContext = {
        viewportIndex: 0,
      };

      const evaluations: BatchEvaluation[] = [
        createMockBatchEvaluation({
          heuristicId: 'PDP-CTA-001',
          status: 'pass',
          // No elementIndices provided
        }),
      ];

      manager.addEvaluations(evaluations, mockDefinitions, viewportContext);

      const storedEvaluations = manager.getEvaluations();
      expect(storedEvaluations[0].domElementRefs).toBeUndefined();
      expect(storedEvaluations[0].boundingBox).toBeUndefined();
    });

    // Test 40: handles unknown element indices gracefully
    it('should handle unknown element indices gracefully', () => {
      const mockDOMTree: DOMTree = {
        root: {
          tagName: 'body',
          xpath: '/body',
          text: '',
          isInteractive: false,
          isVisible: true,
          croType: null,
          children: [],
        },
        interactiveCount: 0,
        croElementCount: 0,
        totalNodeCount: 1,
        extractedAt: Date.now(),
      };

      const viewportContext: ViewportContext = {
        viewportIndex: 0,
        domTree: mockDOMTree,
      };

      const evaluations: BatchEvaluation[] = [
        createMockBatchEvaluation({
          heuristicId: 'PDP-CTA-001',
          status: 'fail',
          elementIndices: [999], // Index that doesn't exist in DOM
        }),
      ];

      manager.addEvaluations(evaluations, mockDefinitions, viewportContext);

      const storedEvaluations = manager.getEvaluations();
      expect(storedEvaluations[0].domElementRefs).toBeDefined();
      expect(storedEvaluations[0].domElementRefs).toHaveLength(1);
      expect(storedEvaluations[0].domElementRefs![0].index).toBe(999);
      expect(storedEvaluations[0].domElementRefs![0].elementType).toBe('unknown');
    });
  });

  // Phase 21i (T375): Element Mapping Support Tests
  describe('Element Mapping Support (Phase 21i)', () => {
    // Helper to create mock element mapping
    const createMockElementMapping = (
      index: number,
      overrides?: Partial<ElementMapping>
    ): ElementMapping => ({
      index,
      xpath: `/body/button[${index}]`,
      text: `Button ${index}`,
      croType: 'cta',
      tagName: 'button',
      pageCoords: { x: 100, y: 200 + index * 50, width: 150, height: 40 },
      screenshotCoords: {
        x: 100,
        y: 200 + index * 50,
        width: 150,
        height: 40,
        isVisible: true,
        visibilityRatio: 1,
      },
      ...overrides,
    });

    // Test 41: getLatestElementMappings returns mappings from latest snapshot
    it('should return element mappings from latest snapshot', () => {
      const mappings: ElementMapping[] = [
        createMockElementMapping(0),
        createMockElementMapping(1),
      ];

      const snapshot = createMockSnapshot({
        viewportIndex: 0,
        elementMappings: mappings,
      });
      manager.recordSnapshot(snapshot);

      const latestMappings = manager.getLatestElementMappings();

      expect(latestMappings).toHaveLength(2);
      expect(latestMappings![0].index).toBe(0);
      expect(latestMappings![1].index).toBe(1);
    });

    // Test 42: getLatestElementMappings returns undefined when no snapshots
    it('should return undefined when no snapshots exist', () => {
      const mappings = manager.getLatestElementMappings();
      expect(mappings).toBeUndefined();
    });

    // Test 43: getElementMappingByIndex finds correct element
    it('should find element mapping by index', () => {
      const mappings: ElementMapping[] = [
        createMockElementMapping(0),
        createMockElementMapping(5, { text: 'Target Element' }),
        createMockElementMapping(10),
      ];

      manager.recordSnapshot(createMockSnapshot({ elementMappings: mappings }));

      const element = manager.getElementMappingByIndex(5);

      expect(element).toBeDefined();
      expect(element!.text).toBe('Target Element');
    });

    // Test 44: getElementMappingByIndex returns undefined for missing index
    it('should return undefined for non-existent index', () => {
      const mappings: ElementMapping[] = [createMockElementMapping(0)];
      manager.recordSnapshot(createMockSnapshot({ elementMappings: mappings }));

      const element = manager.getElementMappingByIndex(999);

      expect(element).toBeUndefined();
    });

    // Test 45: getElementsByIndices returns multiple elements
    it('should return multiple elements by indices', () => {
      const mappings: ElementMapping[] = [
        createMockElementMapping(0),
        createMockElementMapping(3),
        createMockElementMapping(5),
        createMockElementMapping(7),
      ];

      manager.recordSnapshot(createMockSnapshot({ elementMappings: mappings }));

      const elements = manager.getElementsByIndices([0, 5, 7]);

      expect(elements).toHaveLength(3);
      expect(elements.map(e => e.index)).toEqual([0, 5, 7]);
    });

    // Test 46: enrichEvaluationWithMappings adds element details
    it('should enrich evaluation with element mapping details', () => {
      const mappings: ElementMapping[] = [
        createMockElementMapping(0, {
          xpath: '/body/button[1]',
          text: 'Add to Cart',
          croType: 'cta',
          tagName: 'button',
        }),
      ];

      const evaluation: HeuristicEvaluation = {
        heuristicId: 'PDP-CTA-001',
        principle: 'CTA visible',
        status: 'fail',
        severity: 'critical',
        observation: 'Element [0] is too small',
        confidence: 0.9,
        domElementRefs: [{ index: 0, elementType: 'unknown' }],
      };

      const enriched = manager.enrichEvaluationWithMappings(evaluation, mappings);

      expect(enriched.domElementRefs).toHaveLength(1);
      expect(enriched.domElementRefs![0].xpath).toBe('/body/button[1]');
      expect(enriched.domElementRefs![0].elementType).toBe('cta');
      expect(enriched.domElementRefs![0].textContent).toBe('Add to Cart');
    });

    // Test 47: enrichEvaluationWithMappings preserves original for missing mappings
    it('should preserve original refs for elements not in mappings', () => {
      const evaluation: HeuristicEvaluation = {
        heuristicId: 'PDP-CTA-001',
        principle: 'CTA visible',
        status: 'fail',
        severity: 'critical',
        observation: 'Element [999] is missing',
        confidence: 0.9,
        domElementRefs: [{ index: 999, elementType: 'original-type' }],
      };

      const enriched = manager.enrichEvaluationWithMappings(evaluation, []);

      expect(enriched.domElementRefs![0].index).toBe(999);
      expect(enriched.domElementRefs![0].elementType).toBe('original-type');
    });

    // Test 48: buildViewportContextFromLatest includes all context fields
    it('should build viewport context from latest snapshot', () => {
      const mappings: ElementMapping[] = [createMockElementMapping(0)];
      const elementBoundingBoxes = new Map<number, BoundingBox>();
      elementBoundingBoxes.set(0, { x: 100, y: 200, width: 150, height: 40, viewportIndex: 0 });

      const mockDOMTree: DOMTree = {
        root: {
          tagName: 'body',
          xpath: '/body',
          text: '',
          isInteractive: false,
          isVisible: true,
          croType: null,
          children: [],
        },
        interactiveCount: 0,
        croElementCount: 0,
        totalNodeCount: 1,
        extractedAt: Date.now(),
      };

      const snapshot = createMockSnapshot({
        viewportIndex: 2,
        elementMappings: mappings,
        elementBoundingBoxes,
        dom: {
          tree: mockDOMTree,
          serialized: '<body></body>',
          elementCount: 0,
        },
      });
      manager.recordSnapshot(snapshot);

      const context = manager.buildViewportContextFromLatest();

      expect(context).toBeDefined();
      expect(context!.viewportIndex).toBe(2);
      expect(context!.elementMappings).toHaveLength(1);
      expect(context!.elementBoundingBoxes?.size).toBe(1);
      expect(context!.domTree).toBeDefined();
    });

    // Test 49: buildViewportContextFromLatest returns undefined when no snapshots
    it('should return undefined context when no snapshots', () => {
      const context = manager.buildViewportContextFromLatest();
      expect(context).toBeUndefined();
    });
  });
});
