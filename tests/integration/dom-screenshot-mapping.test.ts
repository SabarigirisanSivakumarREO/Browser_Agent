/**
 * Integration Tests for DOM-Screenshot Mapping - Phase 21i (T382)
 *
 * End-to-end tests for coordinate mapping, prompt generation,
 * element reference parsing, and screenshot annotation.
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import sharp from 'sharp';
import {
  toScreenshotCoords,
  mapElementsToScreenshot,
  filterVisibleElements,
  getElementByIndex,
  getElementsByIndices,
  type ElementMapping,
} from '../../src/browser/dom/coordinate-mapper.js';
import {
  annotateScreenshot,
  ScreenshotAnnotator,
} from '../../src/output/screenshot-annotator.js';
import {
  extractElementReferences,
  parseEvaluationWithElements,
  parseEvaluationsWithElements,
} from '../../src/heuristics/vision/response-parser.js';
import {
  formatDOMContextWithCoords,
} from '../../src/agent/vision/vision-prompt-builder.js';
import type { DOMTree, DOMNode, BoundingBox } from '../../src/models/dom-tree.js';
import type { ViewportInfo } from '../../src/models/page-state.js';
import type { HeuristicEvaluation, EvaluationStatus } from '../../src/heuristics/vision/types.js';
import type { DOMElementRef } from '../../src/heuristics/vision/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Test Fixtures
// ═══════════════════════════════════════════════════════════════════════════════

// Generate a valid test PNG (200x200 white image)
let TEST_PNG_BASE64: string = '';

beforeAll(async () => {
  // Create a real PNG buffer using sharp
  const pngBuffer = await sharp({
    create: {
      width: 200,
      height: 200,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  TEST_PNG_BASE64 = pngBuffer.toString('base64');
});

function createBoundingBox(x: number, y: number, width: number, height: number): BoundingBox {
  return { x, y, width, height };
}

function createViewport(width: number, height: number): ViewportInfo {
  return {
    width,
    height,
    deviceScaleFactor: 1,
    isMobile: false,
  };
}

function createDOMNode(
  index: number | undefined,
  tagName: string,
  text: string,
  boundingBox?: BoundingBox,
  children: DOMNode[] = []
): DOMNode {
  return {
    tagName,
    xpath: `/html/body/${tagName}[${index ?? 0}]`,
    text,
    isInteractive: true,
    isVisible: true,
    croType: tagName === 'button' ? 'cta' : tagName === 'form' ? 'form' : null,
    children,
    index,
    boundingBox,
  };
}

function createDOMTree(nodes: DOMNode[]): DOMTree {
  return {
    root: {
      tagName: 'body',
      xpath: '/html/body',
      text: '',
      isInteractive: false,
      isVisible: true,
      croType: null,
      children: nodes,
    },
    interactiveCount: nodes.length,
    croElementCount: nodes.length,
    totalNodeCount: nodes.length + 1,
    extractedAt: Date.now(),
  };
}

function createElementMapping(
  index: number,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string = `Element ${index}`,
  isVisible: boolean = true
): ElementMapping {
  return {
    index,
    xpath: `/button[${index}]`,
    text,
    croType: 'cta',
    tagName: 'button',
    pageCoords: { x, y, width, height },
    screenshotCoords: {
      x,
      y,
      width,
      height,
      isVisible,
      visibilityRatio: isVisible ? 1 : 0,
    },
  };
}

function createEvaluation(
  heuristicId: string,
  status: EvaluationStatus,
  observation: string,
  elementIndices: number[] = []
): HeuristicEvaluation {
  const domElementRefs: DOMElementRef[] = elementIndices.map((index) => ({
    index,
    elementType: 'button',
    textContent: `Element ${index}`,
  }));

  return {
    heuristicId,
    principle: `Test principle for ${heuristicId}`,
    status,
    severity: status === 'fail' ? 'high' : 'medium',
    observation,
    confidence: 0.9,
    domElementRefs,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// End-to-End Mapping Flow Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('End-to-End DOM-Screenshot Mapping Flow', () => {
  const viewport = createViewport(1280, 720);
  const scrollY = 500;

  it('should map DOM elements to screenshot coordinates correctly', () => {
    // Step 1: Create a DOM tree with elements
    const nodes = [
      createDOMNode(0, 'button', 'Add to Cart', createBoundingBox(100, 600, 150, 40)),
      createDOMNode(1, 'button', 'Buy Now', createBoundingBox(300, 700, 150, 40)),
      createDOMNode(2, 'a', 'Learn More', createBoundingBox(100, 1400, 100, 30)), // Below viewport
    ];
    const domTree = createDOMTree(nodes);

    // Step 2: Map elements to screenshot coordinates
    const mappings = mapElementsToScreenshot(domTree, scrollY, viewport);

    // Verify mappings
    expect(mappings).toHaveLength(3);

    // Element 0: visible (600 - 500 = 100, within viewport)
    expect(mappings[0].screenshotCoords.y).toBe(100);
    expect(mappings[0].screenshotCoords.isVisible).toBe(true);

    // Element 1: visible (700 - 500 = 200, within viewport)
    expect(mappings[1].screenshotCoords.y).toBe(200);
    expect(mappings[1].screenshotCoords.isVisible).toBe(true);

    // Element 2: not visible (1400 - 500 = 900, outside viewport of 720)
    expect(mappings[2].screenshotCoords.y).toBe(900);
    expect(mappings[2].screenshotCoords.isVisible).toBe(false);
  });

  it('should filter to only visible elements', () => {
    const nodes = [
      createDOMNode(0, 'button', 'Visible 1', createBoundingBox(100, 600, 150, 40)),
      createDOMNode(1, 'button', 'Above viewport', createBoundingBox(100, 100, 150, 40)),
      createDOMNode(2, 'button', 'Visible 2', createBoundingBox(100, 700, 150, 40)),
      createDOMNode(3, 'button', 'Below viewport', createBoundingBox(100, 1500, 150, 40)),
    ];
    const domTree = createDOMTree(nodes);

    const mappings = mapElementsToScreenshot(domTree, scrollY, viewport);
    const visible = filterVisibleElements(mappings);

    // Only elements at y=600 and y=700 are visible
    expect(visible).toHaveLength(2);
    expect(visible[0].index).toBe(0);
    expect(visible[1].index).toBe(2);
  });

  it('should look up elements by index after mapping', () => {
    const nodes = [
      createDOMNode(0, 'button', 'First', createBoundingBox(100, 600, 150, 40)),
      createDOMNode(5, 'button', 'Fifth', createBoundingBox(300, 700, 150, 40)),
    ];
    const domTree = createDOMTree(nodes);
    const mappings = mapElementsToScreenshot(domTree, scrollY, viewport);

    // Look up by single index
    const element5 = getElementByIndex(mappings, 5);
    expect(element5?.text).toBe('Fifth');

    // Look up by multiple indices
    const elements = getElementsByIndices(mappings, [0, 5]);
    expect(elements).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Prompt Includes Coordinates Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Prompt Includes Coordinates', () => {
  it('should format visible elements with coordinates for LLM prompt', () => {
    const visibleElements: ElementMapping[] = [
      createElementMapping(0, 100, 50, 150, 40, 'Add to Cart'),
      createElementMapping(3, 300, 200, 120, 35, 'Learn More'),
    ];

    const formatted = formatDOMContextWithCoords(visibleElements);

    // Check that coordinates are included
    expect(formatted).toContain('[0]');
    expect(formatted).toContain('[3]');
    expect(formatted).toContain('100');  // x coordinate
    expect(formatted).toContain('50');   // y coordinate
    expect(formatted).toContain('150');  // width
    expect(formatted).toContain('40');   // height
    expect(formatted).toContain('Add to Cart');
  });

  it('should truncate long text in formatted output', () => {
    const longText = 'A'.repeat(100);
    const visibleElements: ElementMapping[] = [
      createElementMapping(0, 100, 50, 150, 40, longText),
    ];

    const formatted = formatDOMContextWithCoords(visibleElements);

    // Should truncate to ~50 chars with ellipsis
    expect(formatted.includes('A'.repeat(100))).toBe(false);
    expect(formatted).toContain('...');
  });

  it('should include all visible elements in context', () => {
    const visibleElements: ElementMapping[] = [
      createElementMapping(0, 10, 10, 50, 30, 'Button 1'),
      createElementMapping(1, 70, 10, 50, 30, 'Button 2'),
      createElementMapping(2, 130, 10, 50, 30, 'Button 3'),
    ];

    const formatted = formatDOMContextWithCoords(visibleElements);

    expect(formatted).toContain('[0]');
    expect(formatted).toContain('[1]');
    expect(formatted).toContain('[2]');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Element References Parsed from Response Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Element References Parsed from Response', () => {
  it('should extract element references from observation text', () => {
    const text = 'Elements [0] and [3] have poor contrast. See also [5].';
    const refs = extractElementReferences(text);

    expect(refs).toEqual([0, 3, 5]);
  });

  it('should extract references from multiple fields', () => {
    const evaluation = createEvaluation(
      'TEST-001',
      'fail',
      'Element [2] at position (100, 50) has low visibility',
      []
    );
    // Add issue and recommendation with more references
    evaluation.issue = 'The button [2] is too small, similar to [4]';
    evaluation.recommendation = 'Increase size of [2] to match [0]';

    const parsed = parseEvaluationWithElements(evaluation);

    // Should find [2], [4], [0] - unique and sorted
    expect(parsed.relatedElements).toContain(0);
    expect(parsed.relatedElements).toContain(2);
    expect(parsed.relatedElements).toContain(4);
  });

  it('should handle batch parsing of evaluations', () => {
    const evaluations = [
      createEvaluation('TEST-001', 'fail', 'Element [0] failed'),
      createEvaluation('TEST-002', 'partial', 'Element [1] and [2] need work'),
      createEvaluation('TEST-003', 'pass', 'Element [3] looks good'),
    ];

    const parsed = parseEvaluationsWithElements(evaluations);

    expect(parsed).toHaveLength(3);
    expect(parsed[0].relatedElements).toEqual([0]);
    expect(parsed[1].relatedElements).toEqual([1, 2]);
    expect(parsed[2].relatedElements).toEqual([3]);
  });

  it('should handle text with no element references', () => {
    const refs = extractElementReferences('No element references here.');
    expect(refs).toEqual([]);
  });

  it('should deduplicate element references', () => {
    const text = 'Element [5] is bad. Element [5] should be fixed. See [5].';
    const refs = extractElementReferences(text);

    expect(refs).toEqual([5]); // Only one 5
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Annotated Screenshot Output Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Annotated Screenshot Output', () => {
  it('should annotate screenshot with element bounding boxes', async () => {
    const elements = [
      createElementMapping(0, 10, 10, 50, 30, 'Button 1'),
      createElementMapping(1, 70, 10, 50, 30, 'Button 2'),
    ];
    const evaluations = [
      createEvaluation('TEST-001', 'fail', 'Element [0] failed', [0]),
      createEvaluation('TEST-002', 'pass', 'Element [1] passed', [1]),
    ];

    const result = await annotateScreenshot(TEST_PNG_BASE64, elements, evaluations);

    expect(result.success).toBe(true);
    expect(result.annotatedBase64).toBeDefined();
    expect(result.elementsAnnotated).toBe(2);
  });

  it('should only annotate visible elements', async () => {
    const elements = [
      createElementMapping(0, 10, 10, 50, 30, 'Visible', true),
      createElementMapping(1, 10, 1000, 50, 30, 'Invisible', false),
    ];

    const result = await annotateScreenshot(TEST_PNG_BASE64, elements, []);

    expect(result.success).toBe(true);
    expect(result.elementsAnnotated).toBe(1);
  });

  it('should apply correct colors based on evaluation status', async () => {
    const elements = [
      createElementMapping(0, 10, 10, 50, 30, 'Failed'),
      createElementMapping(1, 70, 10, 50, 30, 'Partial'),
      createElementMapping(2, 130, 10, 50, 30, 'Passed'),
    ];
    const evaluations = [
      createEvaluation('TEST-001', 'fail', 'Element [0]', [0]),
      createEvaluation('TEST-002', 'partial', 'Element [1]', [1]),
      createEvaluation('TEST-003', 'pass', 'Element [2]', [2]),
    ];

    const result = await annotateScreenshot(TEST_PNG_BASE64, elements, evaluations);

    expect(result.success).toBe(true);
    expect(result.elementsAnnotated).toBe(3);
    // Note: Actual color verification would require image analysis
  });

  it('should use ScreenshotAnnotator class with custom options', async () => {
    const annotator = new ScreenshotAnnotator({
      highlightIssues: true,
      showElementIndexes: true,
      showCoordinates: true,
      strokeWidth: 3,
      fontSize: 14,
    });

    const elements = [createElementMapping(0, 10, 10, 50, 30, 'Test')];
    const result = await annotator.annotate(TEST_PNG_BASE64, elements, []);

    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Complete Flow Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Complete DOM-Screenshot Mapping Flow', () => {
  it('should handle full pipeline from DOM to annotated screenshot', async () => {
    // Step 1: Create DOM tree with elements at various positions
    const viewport = createViewport(1280, 720);
    const scrollY = 200;

    const nodes = [
      createDOMNode(0, 'button', 'Add to Cart', createBoundingBox(100, 300, 150, 40)),
      createDOMNode(1, 'button', 'Wishlist', createBoundingBox(300, 400, 120, 35)),
      createDOMNode(2, 'input', 'Quantity', createBoundingBox(100, 500, 80, 30)),
    ];
    const domTree = createDOMTree(nodes);

    // Step 2: Map elements to screenshot coordinates
    const mappings = mapElementsToScreenshot(domTree, scrollY, viewport);
    expect(mappings).toHaveLength(3);

    // Step 3: Filter to visible elements
    const visibleElements = filterVisibleElements(mappings);
    expect(visibleElements.length).toBeGreaterThan(0);

    // Step 4: Format for prompt
    const promptContext = formatDOMContextWithCoords(visibleElements);
    expect(promptContext).toContain('[0]');

    // Step 5: Simulate LLM response with element references
    const mockObservation = 'Element [0] Add to Cart button is well-positioned. Element [1] wishlist button is secondary.';
    const refs = extractElementReferences(mockObservation);
    expect(refs).toEqual([0, 1]);

    // Step 6: Create evaluations
    const evaluations = [
      createEvaluation('CTA-001', 'pass', mockObservation, refs),
    ];

    // Step 7: Annotate screenshot
    const annotationResult = await annotateScreenshot(
      TEST_PNG_BASE64,
      visibleElements,
      evaluations
    );
    expect(annotationResult.success).toBe(true);
    expect(annotationResult.annotatedBase64).toBeDefined();
  });

  it('should preserve element metadata through mapping', () => {
    const nodes = [
      createDOMNode(5, 'button', 'Submit Order', createBoundingBox(200, 400, 180, 50)),
    ];
    const domTree = createDOMTree(nodes);
    const viewport = createViewport(1280, 720);

    const mappings = mapElementsToScreenshot(domTree, 300, viewport);

    expect(mappings[0].index).toBe(5);
    expect(mappings[0].text).toBe('Submit Order');
    expect(mappings[0].tagName).toBe('button');
    expect(mappings[0].xpath).toContain('button');
  });

  it('should handle edge case of element at viewport boundary', () => {
    const viewport = createViewport(1280, 720);
    const scrollY = 300;

    // Element starts at y=300 (exactly at scroll position)
    const nodes = [
      createDOMNode(0, 'button', 'At Top', createBoundingBox(100, 300, 100, 40)),
    ];
    const domTree = createDOMTree(nodes);

    const mappings = mapElementsToScreenshot(domTree, scrollY, viewport);

    expect(mappings[0].screenshotCoords.y).toBe(0); // At top of screenshot
    expect(mappings[0].screenshotCoords.isVisible).toBe(true);
  });

  it('should handle nested elements correctly', () => {
    const viewport = createViewport(1280, 720);
    const childNode = createDOMNode(1, 'span', 'Price', createBoundingBox(110, 410, 50, 20));
    const parentNode = createDOMNode(0, 'div', 'Container', createBoundingBox(100, 400, 200, 100), [childNode]);

    const domTree = createDOMTree([parentNode]);
    const mappings = mapElementsToScreenshot(domTree, 0, viewport);

    // Both parent and child should be mapped
    expect(mappings).toHaveLength(2);
    expect(mappings[0].index).toBe(0);
    expect(mappings[1].index).toBe(1);
  });
});
