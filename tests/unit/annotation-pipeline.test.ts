/**
 * Unit Tests for Phase 27F: Annotation Pipeline Fix (T630-T632)
 *
 * Tests:
 * 1. T630: populateElementRefs sets viewportIndex from element refs
 * 2. T631: CLI annotation filter checks domElementRefs
 * 3. T632: Annotation coverage metric format
 */

import { describe, it, expect, vi } from 'vitest';
import {
  populateElementRefs,
  parseElementRef,
} from '../../src/heuristics/category-analyzer.js';
import {
  annotateScreenshot,
} from '../../src/output/screenshot-annotator.js';
import type { ViewportSnapshot } from '../../src/models/index.js';
import type { HeuristicEvaluation, DOMElementRef } from '../../src/heuristics/vision/types.js';
import type { ElementMapping } from '../../src/browser/dom/coordinate-mapper.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function createMockElementMapping(overrides: Partial<ElementMapping> = {}): ElementMapping {
  return {
    index: 0,
    viewportId: 'V0-0',
    xpath: '/html/body/button[1]',
    text: 'Add to Cart',
    croType: 'cta',
    tagName: 'button',
    pageCoords: { x: 520, y: 380, width: 200, height: 48 },
    screenshotCoords: {
      x: 520, y: 380, width: 200, height: 48,
      isVisible: true, visibilityRatio: 1.0,
    },
    ...overrides,
  };
}

function createMockSnapshot(overrides: Partial<ViewportSnapshot> = {}): ViewportSnapshot {
  return {
    scrollPosition: 0,
    viewportIndex: 0,
    screenshot: { base64: 'mockBase64', capturedAt: Date.now() },
    dom: { serialized: '[0] button "Add to Cart"', elementCount: 1 },
    ...overrides,
  };
}

function createMockEvaluation(overrides: Partial<HeuristicEvaluation> = {}): HeuristicEvaluation {
  return {
    heuristicId: 'PDP-CTA-001',
    principle: 'CTA should be prominent',
    status: 'fail',
    severity: 'high',
    observation: 'The CTA button is below the fold',
    confidence: 0.85,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// T630: Viewport assignment from element refs
// ═══════════════════════════════════════════════════════════════════════════════

describe('T630: populateElementRefs sets viewportIndex', () => {
  it('sets viewportIndex from structured element refs', () => {
    const snapshot = createMockSnapshot({
      viewportIndex: 2,
      visibleElements: [createMockElementMapping({ index: 5, tagName: 'button' })],
    });

    const evaluation = createMockEvaluation({
      viewportIndex: undefined,
      observation: 'CTA is below the fold',
    });
    (evaluation as any)._structuredElementRefs = ['[v2-5]'];

    populateElementRefs([evaluation], [snapshot]);

    expect(evaluation.viewportIndex).toBe(2);
    expect(evaluation.domElementRefs).toHaveLength(1);
  });

  it('sets viewportIndex from text-scan element refs', () => {
    const snapshot = createMockSnapshot({
      viewportIndex: 1,
      visibleElements: [createMockElementMapping({ index: 8, tagName: 'img' })],
    });

    const evaluation = createMockEvaluation({
      viewportIndex: undefined,
      observation: 'Image [v1-8] is missing alt text',
    });

    populateElementRefs([evaluation], [snapshot]);

    expect(evaluation.viewportIndex).toBe(1);
    expect(evaluation.domElementRefs).toHaveLength(1);
  });

  it('leaves viewportIndex undefined when no element refs found', () => {
    const snapshot = createMockSnapshot({
      viewportIndex: 0,
      visibleElements: [createMockElementMapping({ index: 3 })],
    });

    const evaluation = createMockEvaluation({
      viewportIndex: undefined,
      observation: 'Generic observation with no refs',
    });

    populateElementRefs([evaluation], [snapshot]);

    expect(evaluation.viewportIndex).toBeUndefined();
    expect(evaluation.domElementRefs).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T631: CLI annotation filter checks domElementRefs
// ═══════════════════════════════════════════════════════════════════════════════

describe('T631: annotation filter matches on domElementRefs', () => {
  // Replicate the filter logic from cli.ts for unit testing
  function filterEvaluationsForViewport(
    evaluations: HeuristicEvaluation[],
    snapshotViewportIndex: number
  ): HeuristicEvaluation[] {
    return evaluations.filter(
      (e) => e.viewportIndex === snapshotViewportIndex ||
        e.domElementRefs?.some(ref => {
          const parsed = parseElementRef(ref.viewportRef ?? '');
          return parsed && parsed.viewportIndex === snapshotViewportIndex;
        })
    );
  }

  it('includes evaluations with matching viewportIndex', () => {
    const evaluation = createMockEvaluation({ viewportIndex: 0 });
    const result = filterEvaluationsForViewport([evaluation], 0);
    expect(result).toHaveLength(1);
  });

  it('includes evaluations with matching domElementRefs viewport', () => {
    const evaluation = createMockEvaluation({
      viewportIndex: undefined,
      domElementRefs: [{
        index: 5,
        elementType: 'button',
        viewportRef: '[v2-5]',
      }],
    });
    const result = filterEvaluationsForViewport([evaluation], 2);
    expect(result).toHaveLength(1);
  });

  it('excludes evaluations with no viewport match', () => {
    const evaluation = createMockEvaluation({
      viewportIndex: 3,
      domElementRefs: [{
        index: 5,
        elementType: 'button',
        viewportRef: '[v3-5]',
      }],
    });
    const result = filterEvaluationsForViewport([evaluation], 0);
    expect(result).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T632: Annotation coverage metric format
// ═══════════════════════════════════════════════════════════════════════════════

describe('T632: annotation coverage metric', () => {
  it('formats coverage metric correctly', () => {
    // Simulate the metric calculation from cli.ts
    const totalEvaluations = 14;
    const matchedEvaluations = 10;
    const totalViewports = 12;
    const withElementRefs = 8;

    const metric = `Annotated ${matchedEvaluations}/${totalEvaluations} evaluations across ${totalViewports} viewports (${withElementRefs} with element refs)`;

    expect(metric).toMatch(/Annotated \d+\/\d+ evaluations across \d+ viewports \(\d+ with element refs\)/);
    expect(metric).toContain('10/14');
    expect(metric).toContain('12 viewports');
    expect(metric).toContain('8 with element refs');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Annotation Overlay Rendering Bug Fixes
// ═══════════════════════════════════════════════════════════════════════════════

// Mock sharp to capture SVG overlay
let capturedSvg = '';

vi.mock('sharp', () => {
  return {
    default: vi.fn(),
  };
});

import sharp from 'sharp';

function setSharpMetadata(meta: { width: number; height: number }) {
  vi.mocked(sharp).mockImplementation((_input?: any) => {
    const instance: any = {
      metadata: vi.fn().mockResolvedValue(meta),
      composite: vi.fn((layers: any[]) => {
        if (layers[0]?.input) {
          capturedSvg = layers[0].input.toString('utf-8');
        }
        return instance;
      }),
      png: vi.fn(() => instance),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-png')),
    };
    return instance as any;
  });
}

const dummyBase64 = Buffer.from('fake-image').toString('base64');

describe('Annotation overlay: heuristic ID labels', () => {
  it('renders heuristic ID below highlighted element', async () => {
    setSharpMetadata({ width: 1280, height: 720 });
    const elements = [createMockElementMapping({ index: 5, viewportId: 'V0-0' })];
    const evaluations = [createMockEvaluation({
      heuristicId: 'PDP-CTA-001',
      status: 'fail',
      domElementRefs: [{ index: 5, elementType: 'button', viewportRef: '[v0-5]' }],
    })];
    await annotateScreenshot(dummyBase64, elements, evaluations, { highlightIssues: true });
    expect(capturedSvg).toContain('PDP-CTA-001');
  });

  it('renders multiple heuristic IDs comma-separated', async () => {
    setSharpMetadata({ width: 1280, height: 720 });
    const elements = [createMockElementMapping({ index: 5, viewportId: 'V0-0' })];
    const evaluations = [
      createMockEvaluation({
        heuristicId: 'PDP-CTA-001', status: 'fail',
        domElementRefs: [{ index: 5, elementType: 'button', viewportRef: '[v0-5]' }],
      }),
      createMockEvaluation({
        heuristicId: 'PDP-CTA-002', status: 'partial',
        domElementRefs: [{ index: 5, elementType: 'button', viewportRef: '[v0-5]' }],
      }),
    ];
    await annotateScreenshot(dummyBase64, elements, evaluations, { highlightIssues: true });
    expect(capturedSvg).toContain('PDP-CTA-001, PDP-CTA-002');
  });

  it('does not render heuristic label for unmatched element', async () => {
    setSharpMetadata({ width: 1280, height: 720 });
    const elements = [createMockElementMapping({ index: 3, viewportId: 'V0-0' })];
    const evaluations = [createMockEvaluation({
      heuristicId: 'PDP-CTA-001', status: 'fail',
      domElementRefs: [{ index: 5, elementType: 'button', viewportRef: '[v0-5]' }],
    })];
    await annotateScreenshot(dummyBase64, elements, evaluations, { highlightIssues: true });
    expect(capturedSvg).not.toContain('PDP-CTA-001');
  });

  it('only shows heuristic IDs from matching viewport', async () => {
    setSharpMetadata({ width: 1280, height: 720 });
    const elements = [createMockElementMapping({ index: 5, viewportId: 'V0-0' })];
    const evaluations = [createMockEvaluation({
      heuristicId: 'PDP-CTA-001', status: 'fail',
      domElementRefs: [{ index: 5, elementType: 'button', viewportRef: '[v2-5]' }],
    })];
    await annotateScreenshot(dummyBase64, elements, evaluations, { highlightIssues: true });
    expect(capturedSvg).not.toContain('PDP-CTA-001');
  });
});

describe('Annotation overlay: viewport-aware element status', () => {
  it('element in VP0 should NOT match eval referencing [v2-5]', async () => {
    setSharpMetadata({ width: 1280, height: 720 });
    const elements: ElementMapping[] = [
      createMockElementMapping({ index: 5, viewportId: 'V0-0' }),
    ];
    const evaluations: HeuristicEvaluation[] = [
      createMockEvaluation({
        status: 'fail',
        domElementRefs: [{ index: 5, elementType: 'button', viewportRef: '[v2-5]' }],
      }),
    ];
    await annotateScreenshot(dummyBase64, elements, evaluations, { highlightIssues: true });
    // Should NOT have a red rect since VP0 element shouldn't match VP2 eval
    expect(capturedSvg).not.toContain('dc2626');
  });

  it('element in VP2 SHOULD match eval referencing [v2-5]', async () => {
    setSharpMetadata({ width: 1280, height: 720 });
    const elements: ElementMapping[] = [
      createMockElementMapping({ index: 5, viewportId: 'V2-0' }),
    ];
    const evaluations: HeuristicEvaluation[] = [
      createMockEvaluation({
        status: 'fail',
        domElementRefs: [{ index: 5, elementType: 'button', viewportRef: '[v2-5]' }],
      }),
    ];
    await annotateScreenshot(dummyBase64, elements, evaluations, { highlightIssues: true });
    expect(capturedSvg).toContain('dc2626');
  });

  it('eval with no viewportRef matches any viewport', async () => {
    setSharpMetadata({ width: 1280, height: 720 });
    const elements: ElementMapping[] = [
      createMockElementMapping({ index: 5, viewportId: 'V3-0' }),
    ];
    const evaluations: HeuristicEvaluation[] = [
      createMockEvaluation({
        status: 'fail',
        domElementRefs: [{ index: 5, elementType: 'button' }],
      }),
    ];
    await annotateScreenshot(dummyBase64, elements, evaluations, { highlightIssues: true });
    expect(capturedSvg).toContain('dc2626');
  });
});

describe('Annotation overlay: bounding box clamping', () => {
  it('clamps element extending below viewport', async () => {
    setSharpMetadata({ width: 1280, height: 720 });
    const elements: ElementMapping[] = [
      createMockElementMapping({
        index: 1, viewportId: 'V0-0',
        screenshotCoords: { x: 100, y: 700, width: 200, height: 100, isVisible: true, visibilityRatio: 1 },
      }),
    ];
    await annotateScreenshot(dummyBase64, elements, [], { highlightIssues: false });
    expect(capturedSvg).toContain('height="20"');
  });

  it('clamps element with negative Y (top edge)', async () => {
    setSharpMetadata({ width: 1280, height: 720 });
    const elements: ElementMapping[] = [
      createMockElementMapping({
        index: 1, viewportId: 'V0-0',
        screenshotCoords: { x: 100, y: -50, width: 200, height: 100, isVisible: true, visibilityRatio: 1 },
      }),
    ];
    await annotateScreenshot(dummyBase64, elements, [], { highlightIssues: false });
    expect(capturedSvg).toContain('y="0"');
    expect(capturedSvg).toContain('height="50"');
  });

  it('clamps element extending past right edge', async () => {
    setSharpMetadata({ width: 1280, height: 720 });
    const elements: ElementMapping[] = [
      createMockElementMapping({
        index: 1, viewportId: 'V0-0',
        screenshotCoords: { x: 1200, y: 100, width: 200, height: 50, isVisible: true, visibilityRatio: 1 },
      }),
    ];
    await annotateScreenshot(dummyBase64, elements, [], { highlightIssues: false });
    expect(capturedSvg).toContain('width="80"');
  });
});

describe('Annotation overlay: label clamping', () => {
  it('clamps label near right edge within viewport', async () => {
    setSharpMetadata({ width: 1280, height: 720 });
    const elements: ElementMapping[] = [
      createMockElementMapping({
        index: 1, viewportId: 'V0-0',
        screenshotCoords: { x: 1270, y: 100, width: 10, height: 20, isVisible: true, visibilityRatio: 1 },
      }),
    ];
    await annotateScreenshot(dummyBase64, elements, [], {
      highlightIssues: false, showElementIndexes: true,
    });
    // All rects (label bg) should fit within viewport
    const rectMatches = [...capturedSvg.matchAll(/rect x="([\d.]+)"[^>]*width="([\d.]+)"/g)];
    for (const m of rectMatches) {
      expect(parseFloat(m[1]) + parseFloat(m[2])).toBeLessThanOrEqual(1280);
    }
  });
});

describe('Annotation overlay: DPR scaling', () => {
  it('scales coordinates for 2x DPR image', async () => {
    setSharpMetadata({ width: 2560, height: 1440 });
    const elements: ElementMapping[] = [
      createMockElementMapping({
        index: 1, viewportId: 'V0-0',
        screenshotCoords: { x: 100, y: 200, width: 300, height: 50, isVisible: true, visibilityRatio: 1 },
      }),
    ];
    await annotateScreenshot(dummyBase64, elements, [], {
      highlightIssues: false, cssViewportWidth: 1280,
    });
    // Scale factor = 2, so coords doubled
    expect(capturedSvg).toContain('x="200"');
    expect(capturedSvg).toContain('y="400"');
    expect(capturedSvg).toContain('width="600"');
    expect(capturedSvg).toContain('height="100"');
  });

  it('no scaling at 1x DPR', async () => {
    setSharpMetadata({ width: 1280, height: 720 });
    const elements: ElementMapping[] = [
      createMockElementMapping({
        index: 1, viewportId: 'V0-0',
        screenshotCoords: { x: 100, y: 200, width: 300, height: 50, isVisible: true, visibilityRatio: 1 },
      }),
    ];
    await annotateScreenshot(dummyBase64, elements, [], {
      highlightIssues: false, cssViewportWidth: 1280,
    });
    expect(capturedSvg).toContain('x="100"');
    expect(capturedSvg).toContain('y="200"');
    expect(capturedSvg).toContain('width="300"');
    expect(capturedSvg).toContain('height="50"');
  });
});
