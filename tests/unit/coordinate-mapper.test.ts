/**
 * Unit Tests for DOM-Screenshot Coordinate Mapper - Phase 21i (T366, T380)
 *
 * Tests coordinate transformation between page coordinates and screenshot coordinates.
 */

import { describe, it, expect } from 'vitest';
import {
  toScreenshotCoords,
  mapElementsToScreenshot,
  filterVisibleElements,
  getElementByIndex,
  getElementsByIndices,
  type ScreenshotCoords,
  type ElementMapping,
} from '../../src/browser/dom/coordinate-mapper.js';
import type { DOMTree, DOMNode, BoundingBox } from '../../src/models/dom-tree.js';
import type { ViewportInfo } from '../../src/models/page-state.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Test Fixtures
// ═══════════════════════════════════════════════════════════════════════════════

const createBoundingBox = (x: number, y: number, width: number, height: number): BoundingBox => ({
  x,
  y,
  width,
  height,
});

const createViewport = (width: number, height: number): ViewportInfo => ({
  width,
  height,
  deviceScaleFactor: 1,
  isMobile: false,
});

const createDOMNode = (
  index: number | undefined,
  tagName: string,
  text: string,
  boundingBox?: BoundingBox,
  children: DOMNode[] = []
): DOMNode => ({
  tagName,
  xpath: `/html/body/${tagName}[${index ?? 0}]`,
  text,
  isInteractive: true,
  isVisible: true,
  croType: 'cta',
  children,
  index,
  boundingBox,
});

const createDOMTree = (nodes: DOMNode[]): DOMTree => ({
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
});

// ═══════════════════════════════════════════════════════════════════════════════
// toScreenshotCoords Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('toScreenshotCoords', () => {
  const viewport = createViewport(1024, 768);

  describe('fully visible elements', () => {
    it('should calculate correct Y offset for element at top of viewport', () => {
      const pageCoords = createBoundingBox(100, 500, 200, 50);
      const scrollY = 500;

      const result = toScreenshotCoords(pageCoords, scrollY, viewport.height);

      expect(result.y).toBe(0); // 500 - 500 = 0
      expect(result.x).toBe(100);
      expect(result.width).toBe(200);
      expect(result.height).toBe(50);
      expect(result.isVisible).toBe(true);
      expect(result.visibilityRatio).toBe(1);
    });

    it('should calculate correct Y offset for element in middle of viewport', () => {
      const pageCoords = createBoundingBox(50, 700, 100, 100);
      const scrollY = 500;

      const result = toScreenshotCoords(pageCoords, scrollY, viewport.height);

      expect(result.y).toBe(200); // 700 - 500 = 200
      expect(result.isVisible).toBe(true);
      expect(result.visibilityRatio).toBe(1);
    });

    it('should calculate correct Y offset for element near bottom of viewport', () => {
      const pageCoords = createBoundingBox(0, 1200, 150, 50);
      const scrollY = 500;

      const result = toScreenshotCoords(pageCoords, scrollY, viewport.height);

      expect(result.y).toBe(700); // 1200 - 500 = 700
      expect(result.isVisible).toBe(true);
      expect(result.visibilityRatio).toBe(1);
    });
  });

  describe('elements above viewport', () => {
    it('should mark element completely above viewport as not visible', () => {
      const pageCoords = createBoundingBox(100, 100, 200, 50);
      const scrollY = 500;

      const result = toScreenshotCoords(pageCoords, scrollY, viewport.height);

      expect(result.y).toBe(-400); // 100 - 500 = -400
      expect(result.isVisible).toBe(false);
      expect(result.visibilityRatio).toBe(0);
    });

    it('should handle partially visible element at top (extending above viewport)', () => {
      const pageCoords = createBoundingBox(100, 480, 200, 100);
      const scrollY = 500;

      const result = toScreenshotCoords(pageCoords, scrollY, viewport.height);

      expect(result.y).toBe(-20); // 480 - 500 = -20
      expect(result.isVisible).toBe(true);
      // Element extends from -20 to 80, visible from 0 to 80 = 80px of 100px
      expect(result.visibilityRatio).toBeCloseTo(0.8);
    });
  });

  describe('elements below viewport', () => {
    it('should mark element completely below viewport as not visible', () => {
      const pageCoords = createBoundingBox(100, 1500, 200, 50);
      const scrollY = 500;

      const result = toScreenshotCoords(pageCoords, scrollY, viewport.height);

      expect(result.y).toBe(1000); // 1500 - 500 = 1000
      expect(result.isVisible).toBe(false);
      expect(result.visibilityRatio).toBe(0);
    });

    it('should handle partially visible element at bottom (extending below viewport)', () => {
      const pageCoords = createBoundingBox(100, 1200, 200, 100);
      const scrollY = 500;

      const result = toScreenshotCoords(pageCoords, scrollY, viewport.height);

      expect(result.y).toBe(700); // 1200 - 500 = 700
      expect(result.isVisible).toBe(true);
      // Element extends from 700 to 800, viewport ends at 768
      // Visible height = 768 - 700 = 68px of 100px
      expect(result.visibilityRatio).toBeCloseTo(0.68);
    });
  });

  describe('edge cases', () => {
    it('should handle element at exact viewport boundary (top)', () => {
      const pageCoords = createBoundingBox(0, 500, 100, 100);
      const scrollY = 500;

      const result = toScreenshotCoords(pageCoords, scrollY, viewport.height);

      expect(result.y).toBe(0);
      expect(result.isVisible).toBe(true);
      expect(result.visibilityRatio).toBe(1);
    });

    it('should handle element at exact viewport boundary (bottom)', () => {
      const pageCoords = createBoundingBox(0, 1168, 100, 100);
      const scrollY = 500;

      const result = toScreenshotCoords(pageCoords, scrollY, viewport.height);

      expect(result.y).toBe(668); // 1168 - 500 = 668
      expect(result.isVisible).toBe(true);
      expect(result.visibilityRatio).toBe(1); // 668 + 100 = 768, exactly at boundary
    });

    it('should handle zero-height element', () => {
      const pageCoords = createBoundingBox(0, 600, 100, 0);
      const scrollY = 500;

      const result = toScreenshotCoords(pageCoords, scrollY, viewport.height);

      expect(result.isVisible).toBe(true);
      expect(result.visibilityRatio).toBe(0); // No height = 0 ratio
    });

    it('should handle scroll position of 0', () => {
      const pageCoords = createBoundingBox(100, 300, 200, 50);
      const scrollY = 0;

      const result = toScreenshotCoords(pageCoords, scrollY, viewport.height);

      expect(result.y).toBe(300);
      expect(result.isVisible).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// mapElementsToScreenshot Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('mapElementsToScreenshot', () => {
  const viewport = createViewport(1024, 768);

  it('should map all indexed elements from DOM tree', () => {
    const nodes = [
      createDOMNode(0, 'button', 'Add to Cart', createBoundingBox(100, 200, 150, 40)),
      createDOMNode(1, 'button', 'Buy Now', createBoundingBox(300, 250, 150, 40)),
      createDOMNode(2, 'a', 'Learn More', createBoundingBox(500, 300, 100, 30)),
    ];
    const domTree = createDOMTree(nodes);

    const mappings = mapElementsToScreenshot(domTree, 0, viewport);

    expect(mappings).toHaveLength(3);
    expect(mappings[0].index).toBe(0);
    expect(mappings[1].index).toBe(1);
    expect(mappings[2].index).toBe(2);
  });

  it('should include page and screenshot coordinates for each element', () => {
    const node = createDOMNode(0, 'button', 'CTA', createBoundingBox(100, 600, 150, 40));
    const domTree = createDOMTree([node]);

    const mappings = mapElementsToScreenshot(domTree, 500, viewport);

    expect(mappings).toHaveLength(1);
    const mapping = mappings[0];

    // Page coords should be unchanged
    expect(mapping.pageCoords.x).toBe(100);
    expect(mapping.pageCoords.y).toBe(600);

    // Screenshot coords should be adjusted for scroll
    expect(mapping.screenshotCoords.x).toBe(100);
    expect(mapping.screenshotCoords.y).toBe(100); // 600 - 500 = 100
    expect(mapping.screenshotCoords.isVisible).toBe(true);
  });

  it('should skip elements without bounding box', () => {
    const nodes = [
      createDOMNode(0, 'button', 'Has bbox', createBoundingBox(100, 200, 150, 40)),
      createDOMNode(1, 'button', 'No bbox', undefined),
      createDOMNode(2, 'button', 'Has bbox too', createBoundingBox(300, 250, 150, 40)),
    ];
    const domTree = createDOMTree(nodes);

    const mappings = mapElementsToScreenshot(domTree, 0, viewport);

    expect(mappings).toHaveLength(2);
    expect(mappings[0].index).toBe(0);
    expect(mappings[1].index).toBe(2);
  });

  it('should include element metadata (text, croType, tagName, xpath)', () => {
    const node = createDOMNode(5, 'button', 'Add to Cart', createBoundingBox(100, 200, 150, 40));
    const domTree = createDOMTree([node]);

    const mappings = mapElementsToScreenshot(domTree, 0, viewport);

    expect(mappings[0].text).toBe('Add to Cart');
    expect(mappings[0].croType).toBe('cta');
    expect(mappings[0].tagName).toBe('button');
    expect(mappings[0].xpath).toContain('button');
  });

  it('should handle nested elements (recursive traversal)', () => {
    const nestedChild = createDOMNode(1, 'span', 'Price', createBoundingBox(110, 210, 50, 20));
    const parent = createDOMNode(0, 'div', 'Container', createBoundingBox(100, 200, 200, 100), [nestedChild]);
    const domTree = createDOMTree([parent]);

    const mappings = mapElementsToScreenshot(domTree, 0, viewport);

    expect(mappings).toHaveLength(2);
    expect(mappings[0].index).toBe(0);
    expect(mappings[1].index).toBe(1);
  });

  it('should sort elements by index', () => {
    // Create out-of-order to test sorting
    const nodes = [
      createDOMNode(2, 'button', 'Third', createBoundingBox(300, 300, 100, 40)),
      createDOMNode(0, 'button', 'First', createBoundingBox(100, 100, 100, 40)),
      createDOMNode(1, 'button', 'Second', createBoundingBox(200, 200, 100, 40)),
    ];
    const domTree = createDOMTree(nodes);

    const mappings = mapElementsToScreenshot(domTree, 0, viewport);

    expect(mappings[0].index).toBe(0);
    expect(mappings[1].index).toBe(1);
    expect(mappings[2].index).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// filterVisibleElements Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('filterVisibleElements', () => {
  const createMapping = (index: number, isVisible: boolean, visibilityRatio: number): ElementMapping => ({
    index,
    xpath: `/button[${index}]`,
    text: `Element ${index}`,
    croType: 'cta',
    tagName: 'button',
    pageCoords: createBoundingBox(0, 0, 100, 40),
    screenshotCoords: {
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      isVisible,
      visibilityRatio,
    },
  });

  it('should filter to only visible elements', () => {
    const mappings = [
      createMapping(0, true, 1.0),
      createMapping(1, false, 0),
      createMapping(2, true, 0.8),
      createMapping(3, false, 0),
    ];

    const visible = filterVisibleElements(mappings);

    expect(visible).toHaveLength(2);
    expect(visible[0].index).toBe(0);
    expect(visible[1].index).toBe(2);
  });

  it('should respect minimum visibility ratio threshold', () => {
    const mappings = [
      createMapping(0, true, 1.0),
      createMapping(1, true, 0.5),
      createMapping(2, true, 0.05), // Below default threshold of 0.1
    ];

    const visible = filterVisibleElements(mappings);

    expect(visible).toHaveLength(2);
  });

  it('should allow custom visibility ratio threshold', () => {
    const mappings = [
      createMapping(0, true, 1.0),
      createMapping(1, true, 0.5),
      createMapping(2, true, 0.3),
    ];

    const visible = filterVisibleElements(mappings, 0.6);

    expect(visible).toHaveLength(1);
    expect(visible[0].index).toBe(0);
  });

  it('should return empty array when no elements are visible', () => {
    const mappings = [
      createMapping(0, false, 0),
      createMapping(1, false, 0),
    ];

    const visible = filterVisibleElements(mappings);

    expect(visible).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Function Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('getElementByIndex', () => {
  const mappings: ElementMapping[] = [
    {
      index: 0,
      xpath: '/button[0]',
      text: 'First',
      croType: 'cta',
      tagName: 'button',
      pageCoords: createBoundingBox(0, 0, 100, 40),
      screenshotCoords: { x: 0, y: 0, width: 100, height: 40, isVisible: true, visibilityRatio: 1 },
    },
    {
      index: 5,
      xpath: '/button[5]',
      text: 'Fifth',
      croType: 'cta',
      tagName: 'button',
      pageCoords: createBoundingBox(0, 200, 100, 40),
      screenshotCoords: { x: 0, y: 200, width: 100, height: 40, isVisible: true, visibilityRatio: 1 },
    },
  ];

  it('should find element by index', () => {
    const element = getElementByIndex(mappings, 5);
    expect(element?.text).toBe('Fifth');
  });

  it('should return undefined for non-existent index', () => {
    const element = getElementByIndex(mappings, 999);
    expect(element).toBeUndefined();
  });
});

describe('getElementsByIndices', () => {
  const mappings: ElementMapping[] = [
    {
      index: 0,
      xpath: '/button[0]',
      text: 'First',
      croType: 'cta',
      tagName: 'button',
      pageCoords: createBoundingBox(0, 0, 100, 40),
      screenshotCoords: { x: 0, y: 0, width: 100, height: 40, isVisible: true, visibilityRatio: 1 },
    },
    {
      index: 3,
      xpath: '/button[3]',
      text: 'Third',
      croType: 'cta',
      tagName: 'button',
      pageCoords: createBoundingBox(0, 100, 100, 40),
      screenshotCoords: { x: 0, y: 100, width: 100, height: 40, isVisible: true, visibilityRatio: 1 },
    },
    {
      index: 5,
      xpath: '/button[5]',
      text: 'Fifth',
      croType: 'cta',
      tagName: 'button',
      pageCoords: createBoundingBox(0, 200, 100, 40),
      screenshotCoords: { x: 0, y: 200, width: 100, height: 40, isVisible: true, visibilityRatio: 1 },
    },
  ];

  it('should find multiple elements by indices', () => {
    const elements = getElementsByIndices(mappings, [0, 5]);
    expect(elements).toHaveLength(2);
    expect(elements[0].index).toBe(0);
    expect(elements[1].index).toBe(5);
  });

  it('should skip non-existent indices', () => {
    const elements = getElementsByIndices(mappings, [0, 999, 3]);
    expect(elements).toHaveLength(2);
  });

  it('should return empty array for all non-existent indices', () => {
    const elements = getElementsByIndices(mappings, [100, 200]);
    expect(elements).toHaveLength(0);
  });
});
