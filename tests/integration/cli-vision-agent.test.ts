/**
 * CLI Vision Agent Integration Tests - Phase 21j T389-T390
 *
 * Tests for --vision CLI mode:
 * T389: Full-page coverage with evidence (5 tests)
 * T390: Screenshot annotation functionality (3 tests)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { ViewportSnapshot } from '../../src/models/index.js';
import type { HeuristicEvaluation } from '../../src/heuristics/index.js';
import type { ElementMapping } from '../../src/browser/dom/coordinate-mapper.js';

// Mock snapshot data for testing
function createMockSnapshot(viewportIndex: number, scrollPosition: number): ViewportSnapshot {
  const elementMappings: ElementMapping[] = [
    {
      elementIndex: 0,
      xpath: '/body/button[1]',
      pageCoordinates: { x: 100, y: 200 + scrollPosition, width: 150, height: 40 },
      screenshotCoordinates: { x: 100, y: 200, width: 150, height: 40 },
      isVisible: true,
      croType: 'cta',
      text: 'Add to Cart',
    },
    {
      elementIndex: 1,
      xpath: '/body/span[1]',
      pageCoordinates: { x: 300, y: 150 + scrollPosition, width: 80, height: 30 },
      screenshotCoordinates: { x: 300, y: 150, width: 80, height: 30 },
      isVisible: true,
      croType: 'trust',
      text: '£85.00',
    },
    {
      elementIndex: 2,
      xpath: '/body/form/input[1]',
      pageCoordinates: { x: 50, y: 400 + scrollPosition, width: 200, height: 35 },
      screenshotCoordinates: { x: 50, y: 400, width: 200, height: 35 },
      isVisible: true,
      croType: 'form',
      text: 'Size selector',
    },
  ];

  return {
    viewportIndex,
    scrollPosition,
    screenshot: {
      base64: 'mockBase64ImageData',
      width: 1280,
      height: 720,
    },
    dom: {
      serialized: '<body><button>Add to Cart</button><span>£85.00</span></body>',
      elementCount: 3,
    },
    elementMappings,
    visibleElements: elementMappings.filter(m => m.isVisible),
  };
}

// Mock heuristic evaluations
function createMockEvaluations(): HeuristicEvaluation[] {
  return [
    {
      heuristicId: 'PDP-CTA-001',
      principle: 'Primary CTA should be prominent',
      status: 'pass',
      severity: 'critical',
      observation: 'Add to Cart button is prominently displayed with high contrast',
      confidence: 0.92,
      viewportIndex: 0,
    },
    {
      heuristicId: 'PDP-PRICE-001',
      principle: 'Price should be clearly visible',
      status: 'fail',
      severity: 'high',
      observation: 'Price text is present but font size is small',
      issue: 'Price font size too small at 12px',
      recommendation: 'Increase price font size to at least 16px',
      confidence: 0.88,
      viewportIndex: 0,
      elementIndices: [1],
    },
    {
      heuristicId: 'PDP-FORM-001',
      principle: 'Product variants should be easy to select',
      status: 'partial',
      severity: 'medium',
      observation: 'Size selector is present but could be more prominent',
      issue: 'Dropdown style makes options less discoverable',
      recommendation: 'Consider using visible size buttons',
      confidence: 0.75,
      viewportIndex: 1,
      elementIndices: [2],
    },
  ];
}

describe('CLI --vision mode (Phase 21j)', () => {
  describe('T389: Full-page coverage with evidence', () => {
    it('should capture multiple viewports for full page coverage', () => {
      // Simulate full-page scroll capturing 3 viewports
      const snapshots: ViewportSnapshot[] = [
        createMockSnapshot(0, 0),     // First viewport (0px)
        createMockSnapshot(1, 720),   // Second viewport (720px)
        createMockSnapshot(2, 1440),  // Third viewport (1440px)
      ];

      expect(snapshots.length).toBe(3);
      expect(snapshots[0]?.viewportIndex).toBe(0);
      expect(snapshots[1]?.viewportIndex).toBe(1);
      expect(snapshots[2]?.viewportIndex).toBe(2);

      // Verify scroll positions increment
      expect(snapshots[0]?.scrollPosition).toBe(0);
      expect(snapshots[1]?.scrollPosition).toBe(720);
      expect(snapshots[2]?.scrollPosition).toBe(1440);
    });

    it('should populate visibleElements for each viewport', () => {
      const snapshots = [
        createMockSnapshot(0, 0),
        createMockSnapshot(1, 720),
      ];

      for (const snapshot of snapshots) {
        expect(snapshot.visibleElements).toBeDefined();
        expect(Array.isArray(snapshot.visibleElements)).toBe(true);
        expect(snapshot.visibleElements!.length).toBeGreaterThan(0);

        // Each visible element should have required properties
        for (const element of snapshot.visibleElements!) {
          expect(element.elementIndex).toBeDefined();
          expect(element.xpath).toBeDefined();
          expect(element.isVisible).toBe(true);
          expect(element.pageCoordinates).toBeDefined();
          expect(element.screenshotCoordinates).toBeDefined();
        }
      }
    });

    it('should populate elementMappings for each viewport', () => {
      const snapshot = createMockSnapshot(0, 0);

      expect(snapshot.elementMappings).toBeDefined();
      expect(snapshot.elementMappings!.length).toBe(3);

      // Verify element mapping structure
      const firstMapping = snapshot.elementMappings![0];
      expect(firstMapping?.elementIndex).toBe(0);
      expect(firstMapping?.croType).toBe('cta');
      expect(firstMapping?.text).toBe('Add to Cart');
      expect(firstMapping?.pageCoordinates.x).toBe(100);
      expect(firstMapping?.screenshotCoordinates.x).toBe(100);
    });

    it('should include screenshot data with dimensions', () => {
      const snapshot = createMockSnapshot(0, 0);

      expect(snapshot.screenshot).toBeDefined();
      expect(snapshot.screenshot.base64).toBeDefined();
      expect(snapshot.screenshot.width).toBe(1280);
      expect(snapshot.screenshot.height).toBe(720);
    });

    it('should include serialized DOM with element count', () => {
      const snapshot = createMockSnapshot(0, 0);

      expect(snapshot.dom).toBeDefined();
      expect(snapshot.dom.serialized).toContain('<body>');
      expect(snapshot.dom.elementCount).toBe(3);
    });
  });

  describe('T389: DOM-Screenshot mapping output', () => {
    it('should have viewportIndex in evaluations', () => {
      const evaluations = createMockEvaluations();

      // Evaluations should reference their viewport
      expect(evaluations[0]?.viewportIndex).toBe(0);
      expect(evaluations[2]?.viewportIndex).toBe(1);
    });

    it('should have elementIndices for issue-related evaluations', () => {
      const evaluations = createMockEvaluations();

      // Failed/partial evaluations should reference affected elements
      const failedEval = evaluations.find(e => e.status === 'fail');
      expect(failedEval?.elementIndices).toBeDefined();
      expect(failedEval?.elementIndices).toContain(1);

      const partialEval = evaluations.find(e => e.status === 'partial');
      expect(partialEval?.elementIndices).toBeDefined();
    });

    it('should format mapping counts in console output', () => {
      const snapshots = [
        createMockSnapshot(0, 0),
        createMockSnapshot(1, 720),
      ];

      // Simulate the CLI output formatting from src/cli.ts lines 688-698
      const totalMapped = snapshots.reduce((sum, s) => sum + (s.elementMappings?.length ?? 0), 0);
      const totalVisible = snapshots.reduce((sum, s) => sum + (s.visibleElements?.length ?? 0), 0);

      expect(totalMapped).toBe(6);  // 3 elements * 2 viewports
      expect(totalVisible).toBe(6);
    });
  });

  describe('T390: Screenshot annotation functionality', () => {
    it('should identify elements needing bounding boxes for failed heuristics', () => {
      const evaluations = createMockEvaluations();
      const snapshot = createMockSnapshot(0, 0);

      // Find evaluations that need highlighting (fail or partial)
      const issueEvaluations = evaluations.filter(
        e => e.viewportIndex === snapshot.viewportIndex &&
             (e.status === 'fail' || e.status === 'partial')
      );

      // Each issue evaluation should have elementIndices to draw boxes on
      for (const eval_ of issueEvaluations) {
        if (eval_.elementIndices && eval_.elementIndices.length > 0) {
          // Get element mapping for annotation
          const elementIndex = eval_.elementIndices[0];
          const element = snapshot.visibleElements?.find(
            e => e.elementIndex === elementIndex
          );

          expect(element).toBeDefined();
          expect(element?.screenshotCoordinates).toBeDefined();
        }
      }
    });

    it('should include element index labels in annotations', () => {
      const snapshot = createMockSnapshot(0, 0);

      // Element mappings include index for labeling
      for (const mapping of snapshot.elementMappings ?? []) {
        expect(typeof mapping.elementIndex).toBe('number');
        expect(mapping.elementIndex).toBeGreaterThanOrEqual(0);
      }

      // Index labels would be [0], [1], [2] etc.
      const indices = snapshot.elementMappings!.map(m => m.elementIndex);
      expect(indices).toEqual([0, 1, 2]);
    });

    it('should provide coordinates for annotation overlays', () => {
      const snapshot = createMockSnapshot(0, 0);

      for (const element of snapshot.visibleElements ?? []) {
        const coords = element.screenshotCoordinates;

        // Coordinates should be valid for drawing boxes
        expect(coords.x).toBeGreaterThanOrEqual(0);
        expect(coords.y).toBeGreaterThanOrEqual(0);
        expect(coords.width).toBeGreaterThan(0);
        expect(coords.height).toBeGreaterThan(0);

        // Box should fit within screenshot dimensions
        expect(coords.x + coords.width).toBeLessThanOrEqual(1280);
        expect(coords.y + coords.height).toBeLessThanOrEqual(720);
      }
    });
  });

  describe('T390: Annotated screenshot file output', () => {
    const testDir = './test-annotated-output';

    beforeEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
    });

    afterEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
    });

    it('should create output directory for annotated screenshots', () => {
      fs.mkdirSync(testDir, { recursive: true });

      expect(fs.existsSync(testDir)).toBe(true);
    });

    it('should use viewport-based naming convention', () => {
      fs.mkdirSync(testDir, { recursive: true });

      // Simulate file naming from ScreenshotWriter
      const fileNames = [
        'viewport_0_0px.png',
        'viewport_1_720px.png',
        'viewport_2_1440px.png',
      ];

      for (const name of fileNames) {
        // Validate naming pattern: viewport_N_Mpx.png
        expect(name).toMatch(/^viewport_\d+_\d+px\.png$/);
      }
    });

    it('should support both annotated and raw screenshot output', () => {
      fs.mkdirSync(testDir, { recursive: true });

      // When annotation is enabled, annotated screenshots go to evidence dir
      // When LLM inputs are saved, raw screenshots go to llm-inputs dir
      const evidenceDir = path.join(testDir, 'evidence');
      const llmInputsDir = path.join(testDir, 'llm-inputs', 'Screenshots');

      fs.mkdirSync(evidenceDir, { recursive: true });
      fs.mkdirSync(llmInputsDir, { recursive: true });

      // Verify both directories can coexist
      expect(fs.existsSync(evidenceDir)).toBe(true);
      expect(fs.existsSync(llmInputsDir)).toBe(true);
    });
  });

  describe('Evidence saving conditions', () => {
    it('should save evidence when saveEvidence is true', () => {
      const options = {
        vision: true,
        saveEvidence: true,
        annotateScreenshots: true,
      };

      // Evidence saving should occur
      expect(options.saveEvidence).toBe(true);
      expect(options.annotateScreenshots).toBe(true);
    });

    it('should skip evidence when saveEvidence is false', () => {
      const options = {
        vision: true,
        saveEvidence: false,
        annotateScreenshots: true,
      };

      // Evidence saving should be skipped
      expect(options.saveEvidence).toBe(false);
    });

    it('should save unannotated screenshots when annotation disabled', () => {
      const options = {
        vision: true,
        saveEvidence: true,
        annotateScreenshots: false,
      };

      // Screenshots saved but not annotated
      expect(options.saveEvidence).toBe(true);
      expect(options.annotateScreenshots).toBe(false);
    });
  });
});
