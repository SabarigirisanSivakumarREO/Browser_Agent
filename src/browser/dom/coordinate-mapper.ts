/**
 * DOM-Screenshot Coordinate Mapper - Phase 21i (T366-T367)
 *
 * Maps DOM element coordinates to screenshot positions for visual annotations.
 * Handles the transformation from page coordinates (absolute) to screenshot
 * coordinates (viewport-relative).
 */

import type { DOMTree, DOMNode, BoundingBox, CROType } from '../../models/dom-tree.js';
import type { ViewportInfo } from '../../models/page-state.js';

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
 */
export interface ElementMapping {
  /** Index of the element in the DOM tree (for [index] references) */
  index: number;
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
 * @param domTree - The extracted DOM tree
 * @param scrollY - Current vertical scroll position
 * @param viewport - Viewport dimensions
 * @returns Array of element mappings with coordinates
 */
export function mapElementsToScreenshot(
  domTree: DOMTree,
  scrollY: number,
  viewport: ViewportInfo
): ElementMapping[] {
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
