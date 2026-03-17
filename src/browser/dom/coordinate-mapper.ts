/**
 * DOM-Screenshot Coordinate Mapper - Phase 21i (T366-T367), Phase 25g (T505)
 *
 * Maps DOM element coordinates to screenshot positions for visual annotations.
 * Handles the transformation from page coordinates (absolute) to screenshot
 * coordinates (viewport-relative).
 *
 * Phase 25g additions:
 * - ElementBox interface with elementIndex and confidence
 * - computeLayoutBoxes() for batch bounding box computation
 * - getElementIndicesByCROType() for CRO-grouped lookups
 */

import type { DOMTree, DOMNode, BoundingBox, CROType } from '../../models/dom-tree.js';
import type { ViewportInfo } from '../../models/page-state.js';
import type { Page } from 'playwright';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Coordinates relative to the screenshot image (viewport-relative)
 */
export interface ScreenshotCoords {
  /** X coordinate within the screenshot (same as page X) */
  x: number;
  /** Y coordinate within the screenshot (adjusted for scroll position) */
  y: number;
  /** Width of the element */
  width: number;
  /** Height of the element */
  height: number;
  /** Whether the element is visible in the current viewport */
  isVisible: boolean;
  /** How much of the element is visible (0-1), for partial visibility */
  visibilityRatio: number;
}

/**
 * Complete element mapping with both page and screenshot coordinates
 * Phase 25-fix: Added viewportId for tracking which viewport the mapping belongs to
 */
export interface ElementMapping {
  /** Index of the element in the DOM tree (for [index] references) */
  index: number;
  /** Viewport identifier in format "V{index}-0" (e.g., "V0-0", "V1-0") */
  viewportId: string;
  /** XPath of the element */
  xpath: string;
  /** Text content of the element (truncated) */
  text: string;
  /** CRO element type (cta, form, trust, etc.) or null */
  croType: CROType;
  /** Tag name of the element */
  tagName: string;
  /** Coordinates on the full page (absolute) */
  pageCoords: BoundingBox;
  /** Coordinates in the screenshot (viewport-relative) */
  screenshotCoords: ScreenshotCoords;
}

/**
 * Element bounding box with elementIndex and confidence (Phase 25g - T505)
 * Used for evidence packaging and LLM context
 */
export interface ElementBox {
  /** Element index (per-viewport, matches DOM tree index) */
  elementIndex: number;
  /** X coordinate (absolute page position) */
  x: number;
  /** Y coordinate (absolute page position) */
  y: number;
  /** Width of the element */
  w: number;
  /** Height of the element */
  h: number;
  /** Scroll position when captured */
  scrollY: number;
  /** Which viewport this element was captured in */
  viewportIndex: number;
  /** CRO classification confidence 0-1 */
  confidence: number;
  /** Whether element is visible in the viewport */
  isVisible: boolean;
  /** CRO type if classified */
  croType?: Exclude<CROType, null>;
}

/**
 * Generate a viewport ID string in format "V{index}-{subIndex}"
 * @param viewportIndex - The viewport index (0, 1, 2, ...)
 * @param subIndex - Sub-index for multiple captures at same position (default: 0)
 * @returns Viewport ID string like "V0-0", "V1-0", etc.
 */
export function generateViewportId(viewportIndex: number, subIndex: number = 0): string {
  return `V${viewportIndex}-${subIndex}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Coordinate Transformation Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Transform page coordinates to screenshot coordinates
 *
 * Screenshot coordinates are relative to the current viewport:
 * - screenshotY = pageY - scrollY
 * - Element is visible if screenshotY is within [0, viewportHeight]
 *
 * @param pageCoords - Bounding box in page coordinates
 * @param scrollY - Current vertical scroll position
 * @param viewportHeight - Height of the viewport in pixels
 * @returns Screenshot coordinates with visibility info
 */
export function toScreenshotCoords(
  pageCoords: BoundingBox,
  scrollY: number,
  viewportHeight: number
): ScreenshotCoords {
  // Calculate Y position relative to screenshot (viewport)
  const screenshotY = pageCoords.y - scrollY;

  // Calculate element boundaries in viewport coordinates
  const elementTop = screenshotY;
  const elementBottom = screenshotY + pageCoords.height;

  // Determine visibility
  // Element is visible if any part of it is within [0, viewportHeight]
  const isAboveViewport = elementBottom < 0;
  const isBelowViewport = elementTop > viewportHeight;
  const isVisible = !isAboveViewport && !isBelowViewport;

  // Calculate visibility ratio (how much of the element is visible)
  let visibilityRatio = 0;
  if (isVisible && pageCoords.height > 0) {
    const visibleTop = Math.max(0, elementTop);
    const visibleBottom = Math.min(viewportHeight, elementBottom);
    const visibleHeight = visibleBottom - visibleTop;
    visibilityRatio = Math.min(1, Math.max(0, visibleHeight / pageCoords.height));
  }

  return {
    x: pageCoords.x,
    y: screenshotY,
    width: pageCoords.width,
    height: pageCoords.height,
    isVisible,
    visibilityRatio,
  };
}

/**
 * Recursively collect all indexed elements from a DOM tree
 *
 * @param node - Current DOM node
 * @param elements - Array to collect elements into
 */
function collectIndexedElements(
  node: DOMNode,
  elements: Array<{ node: DOMNode; index: number }>
): void {
  // Only collect nodes that have an index (CRO-relevant elements)
  if (node.index !== undefined) {
    elements.push({ node, index: node.index });
  }

  // Recursively process children
  for (const child of node.children) {
    collectIndexedElements(child, elements);
  }
}

/**
 * Map all elements in a DOM tree to screenshot coordinates
 *
 * This function:
 * 1. Traverses the DOM tree to find all indexed elements
 * 2. Calculates screenshot coordinates for each element
 * 3. Returns both page and screenshot coordinates for cross-referencing
 *
 * Phase 25-fix: Added viewportIndex parameter for viewportId generation
 *
 * @param domTree - The extracted DOM tree
 * @param scrollY - Current vertical scroll position
 * @param viewport - Viewport dimensions
 * @param viewportIndex - Index of the current viewport (0, 1, 2, ...) for viewportId
 * @returns Array of element mappings with coordinates
 */
export function mapElementsToScreenshot(
  domTree: DOMTree,
  scrollY: number,
  viewport: ViewportInfo,
  viewportIndex: number = 0
): ElementMapping[] {
  // Generate viewport ID for this mapping set
  const viewportId = generateViewportId(viewportIndex);

  // Collect all indexed elements from the tree
  const indexedElements: Array<{ node: DOMNode; index: number }> = [];
  collectIndexedElements(domTree.root, indexedElements);

  // Sort by index to ensure consistent ordering
  indexedElements.sort((a, b) => a.index - b.index);

  // Map each element to screenshot coordinates
  const mappings: ElementMapping[] = [];

  for (const { node, index } of indexedElements) {
    // Skip elements without bounding box
    if (!node.boundingBox) {
      continue;
    }

    // Calculate screenshot coordinates
    const screenshotCoords = toScreenshotCoords(
      node.boundingBox,
      scrollY,
      viewport.height
    );

    mappings.push({
      index,
      viewportId,
      xpath: node.xpath,
      text: node.text,
      croType: node.croType,
      tagName: node.tagName,
      pageCoords: node.boundingBox,
      screenshotCoords,
    });
  }

  return mappings;
}

/**
 * Filter element mappings to only visible elements
 *
 * @param mappings - All element mappings
 * @param minVisibilityRatio - Minimum visibility ratio to consider visible (default: 0.1)
 * @returns Only visible element mappings
 */
export function filterVisibleElements(
  mappings: ElementMapping[],
  minVisibilityRatio: number = 0.1
): ElementMapping[] {
  return mappings.filter(
    (m) => m.screenshotCoords.isVisible && m.screenshotCoords.visibilityRatio >= minVisibilityRatio
  );
}

/**
 * Get element mapping by index
 *
 * @param mappings - All element mappings
 * @param index - Element index to find
 * @returns Element mapping or undefined if not found
 */
export function getElementByIndex(
  mappings: ElementMapping[],
  index: number
): ElementMapping | undefined {
  return mappings.find((m) => m.index === index);
}

/**
 * Get multiple element mappings by indices
 *
 * @param mappings - All element mappings
 * @param indices - Array of element indices to find
 * @returns Array of element mappings (only found elements)
 */
export function getElementsByIndices(
  mappings: ElementMapping[],
  indices: number[]
): ElementMapping[] {
  const indexSet = new Set(indices);
  return mappings.filter((m) => indexSet.has(m.index));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 25g: Layout Box Functions (T505, T506)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute bounding boxes for elements by element index
 *
 * Note: Uses pre-extracted bounding boxes from DOM tree, not live page queries.
 * The page parameter is reserved for future live coordinate queries if needed.
 *
 * @param _page - Playwright page instance (reserved for future use)
 * @param elementIndices - Array of element indices to compute boxes for
 * @param domTree - DOM tree with elementLookup for lookups
 * @param scrollY - Current scroll position
 * @param viewportIndex - Current viewport index
 * @param viewportHeight - Viewport height for visibility check
 * @returns Array of ElementBox with computed coordinates
 */
export async function computeLayoutBoxes(
  _page: Page,
  elementIndices: number[],
  domTree: DOMTree,
  scrollY: number,
  viewportIndex: number,
  viewportHeight: number = 720
): Promise<ElementBox[]> {
  if (!domTree.elementLookup || elementIndices.length === 0) {
    return [];
  }

  const boxes: ElementBox[] = [];

  for (const idx of elementIndices) {
    const entry = domTree.elementLookup[String(idx)];
    if (!entry) continue;

    // Find the actual node in the tree to get boundingBox
    const node = findNodeByIndex(domTree.root, idx);
    if (!node || !node.boundingBox) continue;

    const { x, y, width, height } = node.boundingBox;

    // Calculate visibility in current viewport
    const screenshotY = y - scrollY;
    const isVisible = screenshotY + height > 0 && screenshotY < viewportHeight;

    boxes.push({
      elementIndex: idx,
      x,
      y,
      w: width,
      h: height,
      scrollY,
      viewportIndex,
      confidence: entry.confidence ?? 0,
      isVisible,
      croType: entry.croType,
    });
  }

  return boxes;
}

/**
 * Find a node by element index in the DOM tree (recursive search)
 */
function findNodeByIndex(node: DOMNode, targetIndex: number): DOMNode | null {
  if (node.index === targetIndex) {
    return node;
  }
  for (const child of node.children) {
    const found = findNodeByIndex(child, targetIndex);
    if (found) return found;
  }
  return null;
}

/**
 * Get element indices grouped by CRO type
 *
 * @param domTree - DOM tree with elementLookup
 * @param croTypes - CRO types to filter for (if empty, returns all)
 * @param topN - Maximum elements per type (default: 20)
 * @returns Record of CRO type -> array of element indices
 */
export function getElementIndicesByCROType(
  domTree: DOMTree,
  croTypes: Array<Exclude<CROType, null>> = [],
  topN: number = 20
): Record<string, number[]> {
  const result: Record<string, number[]> = {};

  if (!domTree.elementLookup) {
    return result;
  }

  const targetTypes = croTypes.length > 0 ? croTypes : null;

  for (const [, entry] of Object.entries(domTree.elementLookup)) {
    const croType = entry.croType;
    if (!croType) continue;

    if (targetTypes && !targetTypes.includes(croType)) {
      continue;
    }

    if (entry.index === undefined) continue;

    if (!result[croType]) {
      result[croType] = [];
    }

    if (result[croType]!.length < topN) {
      result[croType]!.push(entry.index);
    }
  }

  return result;
}

/**
 * Collect all element indices from a DOM tree
 */
export function collectAllElementIndices(domTree: DOMTree): number[] {
  if (!domTree.elementLookup) {
    return [];
  }
  return Object.values(domTree.elementLookup)
    .filter(entry => entry.index !== undefined)
    .map(entry => entry.index!);
}
