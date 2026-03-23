/**
 * Unit tests for Category Crop Mapper — Phase 30b (T658)
 */

import { describe, it, expect } from 'vitest';
import {
  computeCropRegion,
  CATEGORY_ELEMENT_TYPES,
} from '../../src/heuristics/vision/category-crop-mapper.js';
import type { ElementMapping } from '../../src/browser/dom/coordinate-mapper.js';

function createElementMapping(
  croType: string,
  x: number,
  y: number,
  width: number,
  height: number
): ElementMapping {
  return {
    index: 0,
    tagName: 'button',
    text: 'Test',
    croType,
    pageCoords: { x, y, width, height },
    screenshotCoords: { x, y, width, height },
  } as ElementMapping;
}

describe('CATEGORY_ELEMENT_TYPES', () => {
  it('should map CTA category to cta elements', () => {
    expect(CATEGORY_ELEMENT_TYPES['cta']).toEqual(['cta']);
  });

  it('should map forms category to form elements', () => {
    expect(CATEGORY_ELEMENT_TYPES['forms']).toEqual(['form']);
  });

  it('should map pricing to cta and value_prop', () => {
    expect(CATEGORY_ELEMENT_TYPES['pricing']).toEqual(['cta', 'value_prop']);
  });
});

describe('computeCropRegion', () => {
  it('should compute union bbox from multiple elements', () => {
    const elements = [
      createElementMapping('cta', 100, 200, 150, 40),
      createElementMapping('cta', 300, 250, 200, 50),
    ];
    const region = computeCropRegion('cta', elements, 1280, 800);

    expect(region).not.toBeNull();
    // Union: x=100..500, y=200..300, with 50px padding
    expect(region!.x).toBe(50);  // 100 - 50
    expect(region!.y).toBe(150); // 200 - 50
    expect(region!.width).toBe(500); // (500+50) - 50
    expect(region!.height).toBe(200); // (300+50) - 150
  });

  it('should add padding clamped to viewport bounds', () => {
    const elements = [
      createElementMapping('cta', 10, 10, 100, 40),
    ];
    const region = computeCropRegion('cta', elements, 1280, 800);

    expect(region).not.toBeNull();
    expect(region!.x).toBe(0); // 10 - 50 clamped to 0
    expect(region!.y).toBe(0); // 10 - 50 clamped to 0
  });

  it('should return null when no relevant elements', () => {
    const elements = [
      createElementMapping('form', 100, 200, 150, 40), // form, not cta
    ];
    const region = computeCropRegion('cta', elements, 1280, 800);
    expect(region).toBeNull();
  });

  it('should return null when crop covers >80% of viewport', () => {
    // Element covers most of the viewport
    const elements = [
      createElementMapping('cta', 50, 50, 1180, 700),
    ];
    const region = computeCropRegion('cta', elements, 1280, 800);
    expect(region).toBeNull();
  });

  it('should handle single element', () => {
    const elements = [
      createElementMapping('cta', 500, 300, 200, 50),
    ];
    const region = computeCropRegion('cta', elements, 1280, 800);

    expect(region).not.toBeNull();
    expect(region!.width).toBeGreaterThanOrEqual(200);
    expect(region!.height).toBeGreaterThanOrEqual(50);
  });

  it('should handle elements at viewport edges', () => {
    const elements = [
      createElementMapping('cta', 1200, 750, 80, 40),
    ];
    const region = computeCropRegion('cta', elements, 1280, 800);

    expect(region).not.toBeNull();
    // Right edge: 1200+80+50 = 1330, clamped to 1280
    expect(region!.x + region!.width).toBeLessThanOrEqual(1280);
    expect(region!.y + region!.height).toBeLessThanOrEqual(800);
  });

  it('should enforce minimum crop size of 100x100', () => {
    const elements = [
      createElementMapping('cta', 600, 400, 20, 20), // Very small element
    ];
    const region = computeCropRegion('cta', elements, 1280, 800);

    expect(region).not.toBeNull();
    expect(region!.width).toBeGreaterThanOrEqual(100);
    expect(region!.height).toBeGreaterThanOrEqual(100);
  });

  it('should return null for unknown category', () => {
    const elements = [
      createElementMapping('cta', 100, 200, 150, 40),
    ];
    const region = computeCropRegion('unknown_category', elements, 1280, 800);
    expect(region).toBeNull();
  });
});
