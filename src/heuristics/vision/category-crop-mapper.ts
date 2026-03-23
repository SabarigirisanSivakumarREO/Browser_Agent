/**
 * Category Crop Mapper — Phase 30b (T656)
 *
 * Maps heuristic categories to relevant CRO element types and computes
 * union bounding boxes for category-aware screenshot cropping.
 */

import type { ElementMapping } from '../../browser/dom/coordinate-mapper.js';

/** Crop region in screenshot pixel coordinates */
export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Maps heuristic categories to the CRO element types they analyze.
 * Used to filter elements when computing crop regions.
 */
export const CATEGORY_ELEMENT_TYPES: Record<string, string[]> = {
  cta: ['cta'],
  forms: ['form'],
  trust: ['trust'],
  value_prop: ['value_prop'],
  navigation: ['navigation'],
  pricing: ['cta', 'value_prop'],
  reviews: ['trust'],
  layout: ['cta', 'form', 'trust', 'value_prop', 'navigation'],
  imagery: ['value_prop', 'cta'],
  friction: ['form', 'cta', 'navigation'],
  utility: ['cta', 'navigation'],
};

/**
 * Compute the crop region for a category based on relevant visible elements.
 *
 * Returns null if:
 * - No relevant elements exist for this category
 * - The crop region covers >coverageThreshold of the viewport (not worth cropping)
 *
 * @param category - Heuristic category name
 * @param visibleElements - Element mappings with screenshot coordinates
 * @param vpWidth - Viewport width in pixels
 * @param vpHeight - Viewport height in pixels
 * @param padding - Padding around the union box (default: 50px)
 * @param coverageThreshold - Skip crop if region covers more than this ratio (default: 0.8)
 * @param minSize - Minimum crop dimension (default: 100px)
 */
export function computeCropRegion(
  category: string,
  visibleElements: ElementMapping[],
  vpWidth: number,
  vpHeight: number,
  padding: number = 50,
  coverageThreshold: number = 0.8,
  minSize: number = 100
): CropRegion | null {
  // Get relevant element types for this category
  const relevantTypes = CATEGORY_ELEMENT_TYPES[category.toLowerCase()];
  if (!relevantTypes) return null;

  // Filter elements by relevant CRO types
  const relevant = visibleElements.filter(
    (el) => el.croType && relevantTypes.includes(el.croType)
  );

  if (relevant.length === 0) return null;

  // Compute union bounding box in screenshot coordinates
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of relevant) {
    const { x, y, width, height } = el.screenshotCoords;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }

  // Add padding, clamped to viewport bounds
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(vpWidth, maxX + padding);
  maxY = Math.min(vpHeight, maxY + padding);

  let cropWidth = maxX - minX;
  let cropHeight = maxY - minY;

  // Enforce minimum size (expand centered on region)
  if (cropWidth < minSize) {
    const center = minX + cropWidth / 2;
    minX = Math.max(0, center - minSize / 2);
    cropWidth = Math.min(minSize, vpWidth - minX);
  }
  if (cropHeight < minSize) {
    const center = minY + cropHeight / 2;
    minY = Math.max(0, center - minSize / 2);
    cropHeight = Math.min(minSize, vpHeight - minY);
  }

  // Check coverage: skip if region covers >threshold of viewport
  const vpArea = vpWidth * vpHeight;
  const cropArea = cropWidth * cropHeight;
  if (cropArea / vpArea > coverageThreshold) {
    return null;
  }

  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight),
  };
}
