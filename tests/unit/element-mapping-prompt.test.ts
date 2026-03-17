/**
 * Unit Tests for Element Mapping in LLM Prompts
 *
 * Tests:
 * 1. buildElementPositionsBlock() — formats visible elements into position blocks
 * 2. populateElementRefs() — parses [v0-5] refs from LLM text → domElementRefs
 * 3. Category analyzer prompt includes element positions
 * 4. Batch prompt builder includes element positions
 */

import { describe, it, expect } from 'vitest';
import {
  buildElementPositionsBlock,
  populateElementRefs,
  extractElementRefs,
} from '../../src/heuristics/category-analyzer.js';
import { buildBatchedUserMessage } from '../../src/heuristics/batch-prompt-builder.js';
import type { ViewportSnapshot } from '../../src/models/index.js';
import type { HeuristicEvaluation } from '../../src/heuristics/vision/types.js';
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
      x: 520,
      y: 380,
      width: 200,
      height: 48,
      isVisible: true,
      visibilityRatio: 1.0,
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
    observation: 'The CTA button [v0-5] is below the fold',
    confidence: 0.85,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// buildElementPositionsBlock Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildElementPositionsBlock', () => {
  it('returns null when no visibleElements', () => {
    const snapshot = createMockSnapshot({ visibleElements: undefined });
    expect(buildElementPositionsBlock(snapshot)).toBeNull();
  });

  it('returns null when visibleElements is empty', () => {
    const snapshot = createMockSnapshot({ visibleElements: [] });
    expect(buildElementPositionsBlock(snapshot)).toBeNull();
  });

  it('formats single element with text', () => {
    const element = createMockElementMapping({
      index: 5,
      tagName: 'button',
      text: 'Add to Cart',
      screenshotCoords: { x: 520, y: 380, width: 200, height: 48, isVisible: true, visibilityRatio: 1.0 },
    });
    const snapshot = createMockSnapshot({
      viewportIndex: 0,
      visibleElements: [element],
    });

    const result = buildElementPositionsBlock(snapshot);
    expect(result).toContain('<element_positions>');
    expect(result).toContain('</element_positions>');
    expect(result).toContain('[v0-5] button "Add to Cart" → x:520 y:380 w:200 h:48');
  });

  it('formats element without text', () => {
    const element = createMockElementMapping({
      index: 3,
      tagName: 'img',
      text: '',
      screenshotCoords: { x: 100, y: 50, width: 400, height: 300, isVisible: true, visibilityRatio: 1.0 },
    });
    const snapshot = createMockSnapshot({
      viewportIndex: 1,
      visibleElements: [element],
    });

    const result = buildElementPositionsBlock(snapshot);
    expect(result).toContain('[v1-3] img → x:100 y:50 w:400 h:300');
    // Should NOT have empty quotes
    expect(result).not.toContain('""');
  });

  it('truncates long text to 40 chars', () => {
    const longText = 'A very long button label that exceeds forty characters for sure';
    const element = createMockElementMapping({
      index: 0,
      tagName: 'button',
      text: longText,
    });
    const snapshot = createMockSnapshot({
      viewportIndex: 0,
      visibleElements: [element],
    });

    const result = buildElementPositionsBlock(snapshot)!;
    // Text should be truncated to 40 chars
    expect(result).toContain(`"${longText.slice(0, 40)}"`);
    expect(result).not.toContain(longText);
  });

  it('formats multiple elements across viewport', () => {
    const elements: ElementMapping[] = [
      createMockElementMapping({
        index: 0,
        tagName: 'h1',
        text: 'Product Title',
        screenshotCoords: { x: 50, y: 20, width: 400, height: 40, isVisible: true, visibilityRatio: 1.0 },
      }),
      createMockElementMapping({
        index: 5,
        tagName: 'button',
        text: 'Add to Cart',
        screenshotCoords: { x: 520, y: 380, width: 200, height: 48, isVisible: true, visibilityRatio: 1.0 },
      }),
      createMockElementMapping({
        index: 12,
        tagName: 'span',
        text: '£65.00',
        screenshotCoords: { x: 520, y: 300, width: 100, height: 24, isVisible: true, visibilityRatio: 1.0 },
      }),
    ];
    const snapshot = createMockSnapshot({
      viewportIndex: 2,
      visibleElements: elements,
    });

    const result = buildElementPositionsBlock(snapshot)!;
    expect(result).toContain('[v2-0] h1 "Product Title"');
    expect(result).toContain('[v2-5] button "Add to Cart"');
    expect(result).toContain('[v2-12] span "£65.00"');
  });

  it('rounds fractional coordinates', () => {
    const element = createMockElementMapping({
      index: 0,
      tagName: 'div',
      text: 'test',
      screenshotCoords: { x: 100.7, y: 50.3, width: 200.5, height: 48.9, isVisible: true, visibilityRatio: 1.0 },
    });
    const snapshot = createMockSnapshot({
      viewportIndex: 0,
      visibleElements: [element],
    });

    const result = buildElementPositionsBlock(snapshot)!;
    expect(result).toContain('x:101 y:50 w:201 h:49');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// populateElementRefs Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('populateElementRefs', () => {
  it('populates domElementRefs from observation text', () => {
    const element = createMockElementMapping({
      index: 5,
      tagName: 'button',
      text: 'Add to Cart',
      xpath: '/html/body/div/button',
    });
    const snapshot = createMockSnapshot({
      viewportIndex: 0,
      visibleElements: [element],
    });

    const evaluation = createMockEvaluation({
      observation: 'The CTA button [v0-5] is below the fold',
    });

    populateElementRefs([evaluation], [snapshot]);

    expect(evaluation.domElementRefs).toBeDefined();
    expect(evaluation.domElementRefs).toHaveLength(1);
    expect(evaluation.domElementRefs![0]).toEqual({
      index: 5,
      elementType: 'button',
      textContent: 'Add to Cart',
      xpath: '/html/body/div/button',
      viewportRef: '[v0-5]',
    });
  });

  it('sets viewportIndex from first ref', () => {
    const element = createMockElementMapping({ index: 3, tagName: 'span' });
    const snapshot = createMockSnapshot({
      viewportIndex: 2,
      visibleElements: [element],
    });

    const evaluation = createMockEvaluation({
      observation: 'Found price at [v2-3]',
      viewportIndex: undefined,
    });

    populateElementRefs([evaluation], [snapshot]);

    expect(evaluation.viewportIndex).toBe(2);
  });

  it('does not overwrite existing viewportIndex', () => {
    const element = createMockElementMapping({ index: 3, tagName: 'span' });
    const snapshot = createMockSnapshot({
      viewportIndex: 2,
      visibleElements: [element],
    });

    const evaluation = createMockEvaluation({
      observation: 'Found at [v2-3]',
      viewportIndex: 0, // Already set
    });

    populateElementRefs([evaluation], [snapshot]);

    expect(evaluation.viewportIndex).toBe(0); // Unchanged
  });

  it('extracts refs from multiple text fields', () => {
    const elements = [
      createMockElementMapping({ index: 5, tagName: 'button', text: 'CTA' }),
      createMockElementMapping({ index: 12, tagName: 'span', text: '£65.00' }),
    ];
    const snapshot = createMockSnapshot({
      viewportIndex: 0,
      visibleElements: elements,
    });

    const evaluation = createMockEvaluation({
      observation: 'CTA [v0-5] is small',
      issue: 'Price [v0-12] not visible',
      recommendation: 'Move [v0-5] above the fold',
      reasoning: 'Found button [v0-5] and price [v0-12] in DOM',
    });

    populateElementRefs([evaluation], [snapshot]);

    expect(evaluation.domElementRefs).toBeDefined();
    // Should have unique refs (v0-5 appears 3 times but extractElementRefs returns all occurrences)
    const indices = evaluation.domElementRefs!.map(r => r.index);
    expect(indices).toContain(5);
    expect(indices).toContain(12);
  });

  it('handles refs across multiple viewports', () => {
    const snapshot0 = createMockSnapshot({
      viewportIndex: 0,
      visibleElements: [createMockElementMapping({ index: 3, tagName: 'h1', text: 'Title' })],
    });
    const snapshot1 = createMockSnapshot({
      viewportIndex: 1,
      visibleElements: [createMockElementMapping({ index: 7, tagName: 'button', text: 'Buy' })],
    });

    const evaluation = createMockEvaluation({
      observation: 'Title [v0-3] at top, CTA [v1-7] below fold',
    });

    populateElementRefs([evaluation], [snapshot0, snapshot1]);

    expect(evaluation.domElementRefs).toHaveLength(2);
    expect(evaluation.domElementRefs![0]!.elementType).toBe('h1');
    expect(evaluation.domElementRefs![1]!.elementType).toBe('button');
    expect(evaluation.viewportIndex).toBe(0); // First ref's viewport
  });

  it('skips evaluations with no element refs', () => {
    const evaluation = createMockEvaluation({
      observation: 'Page looks good overall',
    });

    populateElementRefs([evaluation], []);

    expect(evaluation.domElementRefs).toBeUndefined();
  });

  it('uses "unknown" for unresolved element refs', () => {
    const snapshot = createMockSnapshot({
      viewportIndex: 0,
      visibleElements: [], // No elements to look up
    });

    const evaluation = createMockEvaluation({
      observation: 'Found element [v0-99] that is missing',
    });

    populateElementRefs([evaluation], [snapshot]);

    expect(evaluation.domElementRefs).toBeDefined();
    expect(evaluation.domElementRefs![0]!.elementType).toBe('unknown');
    expect(evaluation.domElementRefs![0]!.index).toBe(99);
  });

  it('falls back to elementMappings when visibleElements is undefined', () => {
    const element = createMockElementMapping({ index: 5, tagName: 'div', text: 'Test' });
    const snapshot = createMockSnapshot({
      viewportIndex: 0,
      visibleElements: undefined,
      elementMappings: [element],
    });

    const evaluation = createMockEvaluation({
      observation: 'Found [v0-5] in DOM',
    });

    populateElementRefs([evaluation], [snapshot]);

    expect(evaluation.domElementRefs).toBeDefined();
    expect(evaluation.domElementRefs![0]!.elementType).toBe('div');
  });

  it('processes multiple evaluations independently', () => {
    const element = createMockElementMapping({ index: 5, tagName: 'button', text: 'CTA' });
    const snapshot = createMockSnapshot({
      viewportIndex: 0,
      visibleElements: [element],
    });

    const eval1 = createMockEvaluation({
      observation: 'CTA [v0-5] looks good',
    });
    const eval2 = createMockEvaluation({
      observation: 'No elements referenced',
    });

    populateElementRefs([eval1, eval2], [snapshot]);

    expect(eval1.domElementRefs).toHaveLength(1);
    expect(eval2.domElementRefs).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Category Analyzer Prompt Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('category-analyzer prompt includes element positions', () => {
  it('buildDOMContextSection includes <element_positions> block', () => {
    // We can't directly test the private method, but we can test via the
    // exported buildElementPositionsBlock which is what it calls
    const element = createMockElementMapping({
      index: 12,
      tagName: 'button',
      text: 'Add to Cart',
      screenshotCoords: { x: 520, y: 380, width: 200, height: 48, isVisible: true, visibilityRatio: 1.0 },
    });
    const snapshot = createMockSnapshot({
      viewportIndex: 0,
      visibleElements: [element],
    });

    const block = buildElementPositionsBlock(snapshot)!;
    expect(block).toMatch(/<element_positions>/);
    expect(block).toMatch(/\[v0-12\] button "Add to Cart" → x:520 y:380 w:200 h:48/);
    expect(block).toMatch(/<\/element_positions>/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Batch Prompt Builder Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('batch-prompt-builder includes element positions', () => {
  it('buildBatchedUserMessage includes element positions in DOM context', () => {
    const element = createMockElementMapping({
      index: 7,
      tagName: 'span',
      text: '£65.00',
      screenshotCoords: { x: 450, y: 280, width: 100, height: 24, isVisible: true, visibilityRatio: 1.0 },
    });
    const snapshot = createMockSnapshot({
      viewportIndex: 0,
      visibleElements: [element],
      dom: { serialized: '[7] span "£65.00"', elementCount: 1 },
    });

    const categories = [{
      name: 'Pricing',
      description: 'Price visibility heuristics',
      heuristics: [{
        id: 'PDP-PRICE-001',
        principle: 'Price should be visible',
        severity: 'high' as const,
        checkpoints: ['Price is above fold'],
      }],
    }];

    const result = buildBatchedUserMessage(categories, [snapshot], 'pdp');
    expect(result).toContain('<element_positions>');
    expect(result).toContain('[v0-7] span "£65.00" → x:450 y:280 w:100 h:24');
    expect(result).toContain('</element_positions>');
  });

  it('buildBatchedUserMessage works without visibleElements', () => {
    const snapshot = createMockSnapshot({
      viewportIndex: 0,
      visibleElements: undefined,
    });

    const categories = [{
      name: 'Pricing',
      description: 'Price heuristics',
      heuristics: [],
    }];

    const result = buildBatchedUserMessage(categories, [snapshot], 'pdp');
    // Should still work, just no positions block
    expect(result).not.toContain('<element_positions>');
    expect(result).toContain('<dom_context>');
  });
});
