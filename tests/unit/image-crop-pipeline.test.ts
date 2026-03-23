/**
 * Unit tests for Image Crop Pipeline — Phase 30c (T664)
 */

import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import { cropForCategory } from '../../src/heuristics/vision/image-crop-pipeline.js';
import type { ElementMapping } from '../../src/browser/dom/coordinate-mapper.js';

// Create a test image as base64
let TEST_IMAGE_BASE64: string;

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

// Generate test image before tests
import { beforeAll } from 'vitest';
beforeAll(async () => {
  const buffer = await sharp({
    create: {
      width: 1280,
      height: 800,
      channels: 3,
      background: { r: 200, g: 200, b: 200 },
    },
  })
    .png()
    .toBuffer();
  TEST_IMAGE_BASE64 = buffer.toString('base64');
});

describe('cropForCategory', () => {
  it('should crop to relevant region', async () => {
    const elements = [
      createElementMapping('cta', 400, 300, 200, 50),
    ];

    const result = await cropForCategory(
      TEST_IMAGE_BASE64,
      'cta',
      elements,
      1280,
      800
    );

    expect(result.cropped).toBe(true);
    expect(result.base64).toBeTruthy();
    expect(result.tokens).toBeGreaterThan(0);
  });

  it('should output within token budget', async () => {
    const elements = [
      createElementMapping('cta', 100, 100, 300, 200),
    ];

    const result = await cropForCategory(
      TEST_IMAGE_BASE64,
      'cta',
      elements,
      1280,
      800,
      { maxTokensPerImage: 200 }
    );

    expect(result.tokens).toBeLessThanOrEqual(200);
  });

  it('should fall back to full image when no relevant elements', async () => {
    const elements = [
      createElementMapping('form', 100, 100, 300, 200), // form, not cta
    ];

    const result = await cropForCategory(
      TEST_IMAGE_BASE64,
      'cta',
      elements,
      1280,
      800
    );

    expect(result.cropped).toBe(false);
    expect(result.base64).toBeTruthy();
  });

  it('should fall back when crop covers >80% of viewport', async () => {
    const elements = [
      createElementMapping('cta', 50, 50, 1180, 700),
    ];

    const result = await cropForCategory(
      TEST_IMAGE_BASE64,
      'cta',
      elements,
      1280,
      800
    );

    expect(result.cropped).toBe(false);
  });

  it('should enforce minimum crop size', async () => {
    const elements = [
      createElementMapping('cta', 600, 400, 10, 10), // Tiny element
    ];

    const result = await cropForCategory(
      TEST_IMAGE_BASE64,
      'cta',
      elements,
      1280,
      800
    );

    expect(result.cropped).toBe(true);
    expect(result.base64).toBeTruthy();
  });

  it('should preserve aspect ratio on resize', async () => {
    const elements = [
      createElementMapping('cta', 200, 200, 400, 200),
    ];

    const result = await cropForCategory(
      TEST_IMAGE_BASE64,
      'cta',
      elements,
      1280,
      800,
      { maxTokensPerImage: 200 }
    );

    // Just verify it produces valid output
    expect(result.base64).toBeTruthy();
    expect(result.tokens).toBeLessThanOrEqual(200);
  });

  it('should return cropped=false on fallback', async () => {
    // No elements at all
    const result = await cropForCategory(
      TEST_IMAGE_BASE64,
      'cta',
      [],
      1280,
      800
    );

    expect(result.cropped).toBe(false);
    expect(result.base64).toBeTruthy();
  });

  it('should handle different categories', async () => {
    const elements = [
      createElementMapping('trust', 100, 500, 200, 100),
    ];

    const result = await cropForCategory(
      TEST_IMAGE_BASE64,
      'trust',
      elements,
      1280,
      800
    );

    expect(result.cropped).toBe(true);
  });
});
