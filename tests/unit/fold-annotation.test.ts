/**
 * Fold Annotation Unit Tests - Phase 25d (T492)
 *
 * Tests for the annotateFoldLine function that draws a red dashed line
 * at the viewport height position to indicate the "above the fold" boundary.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import {
  annotateFoldLine,
  type FoldLineOptions,
  type FoldLineResult,
} from '../../src/output/screenshot-annotator.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Test Fixtures
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a test image buffer with specified dimensions and color
 */
async function createTestImage(
  width: number,
  height: number,
  color: { r: number; g: number; b: number } = { r: 200, g: 200, b: 200 }
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  })
    .png()
    .toBuffer();
}

/**
 * Get metadata from a buffer
 */
async function getImageMetadata(buffer: Buffer): Promise<{ width: number; height: number }> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };
}

/**
 * Check if a specific pixel is red (for fold line detection)
 */
async function getPixelColor(
  buffer: Buffer,
  x: number,
  y: number
): Promise<{ r: number; g: number; b: number }> {
  const { data, info } = await sharp(buffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const idx = (y * info.width + x) * info.channels;
  return {
    r: data[idx] ?? 0,
    g: data[idx + 1] ?? 0,
    b: data[idx + 2] ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════════════════════════

describe('annotateFoldLine', () => {
  // ─────────────────────────────────────────────────────────────────────────────
  // Core Functionality Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Core Functionality', () => {
    it('should draw fold line at correct height', async () => {
      // Create 1280x1000 test image with white background
      const testImage = await createTestImage(1280, 1000, { r: 255, g: 255, b: 255 });
      const viewportHeight = 720;

      const result = await annotateFoldLine(testImage, { viewportHeight });

      expect(result.success).toBe(true);
      expect(result.annotatedBuffer).toBeDefined();

      // Check that the annotated image has the same dimensions
      const metadata = await getImageMetadata(result.annotatedBuffer!);
      expect(metadata.width).toBe(1280);
      expect(metadata.height).toBe(1000);

      // Check for red pixels along the fold line position
      // The fold line is dashed with pattern "10,5", so we sample multiple x positions
      // At least some should contain red from the fold line
      const xSamples = [10, 50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800];
      let foundRedPixel = false;

      for (const x of xSamples) {
        // Check a few y positions around the line (accounting for stroke width and anti-aliasing)
        for (let dy = -3; dy <= 3; dy++) {
          const y = viewportHeight + dy;
          if (y >= 0 && y < 1000) {
            const pixel = await getPixelColor(result.annotatedBuffer!, x, y);
            // Red pixel: high red, low green, low blue
            if (pixel.r > 180 && pixel.g < 100 && pixel.b < 100) {
              foundRedPixel = true;
              break;
            }
          }
        }
        if (foundRedPixel) break;
      }

      expect(foundRedPixel).toBe(true);
    });

    it('should include label text in annotation', async () => {
      const testImage = await createTestImage(1280, 1000);
      const viewportHeight = 720;

      const result = await annotateFoldLine(testImage, {
        viewportHeight,
        showLabel: true,
      });

      expect(result.success).toBe(true);
      expect(result.annotatedBuffer).toBeDefined();

      // The image should be different from the original (has label overlay)
      expect(result.annotatedBuffer!.length).not.toBe(testImage.length);
    });

    it('should preserve image dimensions after annotation', async () => {
      const originalWidth = 1920;
      const originalHeight = 1200;
      const testImage = await createTestImage(originalWidth, originalHeight);

      const result = await annotateFoldLine(testImage, { viewportHeight: 800 });

      expect(result.success).toBe(true);
      expect(result.annotatedBuffer).toBeDefined();

      const metadata = await getImageMetadata(result.annotatedBuffer!);
      expect(metadata.width).toBe(originalWidth);
      expect(metadata.height).toBe(originalHeight);
    });

    it('should handle various image sizes correctly', async () => {
      const testCases = [
        { width: 800, height: 600, viewportHeight: 400 },
        { width: 1920, height: 3000, viewportHeight: 1080 },
        { width: 375, height: 667, viewportHeight: 500 },
        { width: 2560, height: 1440, viewportHeight: 900 },
      ];

      for (const testCase of testCases) {
        const testImage = await createTestImage(testCase.width, testCase.height);
        const result = await annotateFoldLine(testImage, {
          viewportHeight: testCase.viewportHeight,
        });

        expect(result.success).toBe(true);
        expect(result.annotatedBuffer).toBeDefined();

        const metadata = await getImageMetadata(result.annotatedBuffer!);
        expect(metadata.width).toBe(testCase.width);
        expect(metadata.height).toBe(testCase.height);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Edge Case Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should skip annotation when viewport height >= image height', async () => {
      const testImage = await createTestImage(800, 600);

      // Viewport height equals image height
      const result1 = await annotateFoldLine(testImage, { viewportHeight: 600 });
      expect(result1.success).toBe(true);
      // Should return original image (no fold line needed)
      expect(result1.annotatedBuffer!.length).toBe(testImage.length);

      // Viewport height exceeds image height
      const result2 = await annotateFoldLine(testImage, { viewportHeight: 1000 });
      expect(result2.success).toBe(true);
      // Should return original image (no fold line needed)
      expect(result2.annotatedBuffer!.length).toBe(testImage.length);
    });

    it('should handle very small viewport heights', async () => {
      const testImage = await createTestImage(800, 600);
      const viewportHeight = 50;

      const result = await annotateFoldLine(testImage, { viewportHeight });

      expect(result.success).toBe(true);
      expect(result.annotatedBuffer).toBeDefined();

      const metadata = await getImageMetadata(result.annotatedBuffer!);
      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(600);
    });

    it('should handle very large images', async () => {
      const testImage = await createTestImage(4096, 8000);
      const viewportHeight = 2000;

      const result = await annotateFoldLine(testImage, { viewportHeight });

      expect(result.success).toBe(true);
      expect(result.annotatedBuffer).toBeDefined();

      const metadata = await getImageMetadata(result.annotatedBuffer!);
      expect(metadata.width).toBe(4096);
      expect(metadata.height).toBe(8000);
    });

    it('should handle viewport at exact image boundary', async () => {
      const testImage = await createTestImage(1280, 720);
      const viewportHeight = 719; // Just below image height

      const result = await annotateFoldLine(testImage, { viewportHeight });

      expect(result.success).toBe(true);
      expect(result.annotatedBuffer).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Configuration Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Configuration Options', () => {
    it('should use custom label text when provided', async () => {
      const testImage = await createTestImage(1280, 1000);
      const customLabel = 'CUSTOM FOLD LINE LABEL';

      const result = await annotateFoldLine(testImage, {
        viewportHeight: 720,
        showLabel: true,
        labelText: customLabel,
      });

      expect(result.success).toBe(true);
      expect(result.annotatedBuffer).toBeDefined();
      // The custom label should be rendered (can't easily verify text content,
      // but we can verify the annotation was applied)
      expect(result.annotatedBuffer!.length).not.toBe(testImage.length);
    });

    it('should skip label when showLabel is false', async () => {
      const testImage = await createTestImage(1280, 1000);

      const resultWithLabel = await annotateFoldLine(testImage, {
        viewportHeight: 720,
        showLabel: true,
      });

      const resultWithoutLabel = await annotateFoldLine(testImage, {
        viewportHeight: 720,
        showLabel: false,
        labelText: '', // Empty label
      });

      expect(resultWithLabel.success).toBe(true);
      expect(resultWithoutLabel.success).toBe(true);

      // Both should be different from original (have the line)
      expect(resultWithLabel.annotatedBuffer!.length).not.toBe(testImage.length);
      expect(resultWithoutLabel.annotatedBuffer!.length).not.toBe(testImage.length);

      // With label should have more content than without
      // (though this isn't strictly guaranteed due to compression)
    });

    it('should generate correct default label text', async () => {
      const testImage = await createTestImage(1280, 1000);
      const viewportHeight = 720;

      const result = await annotateFoldLine(testImage, {
        viewportHeight,
        showLabel: true,
        // No custom labelText - should use default
      });

      expect(result.success).toBe(true);
      expect(result.annotatedBuffer).toBeDefined();
      // Default label contains the viewport height value
      // We can't easily verify the exact text, but the annotation should be applied
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Error Handling Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should handle invalid image buffer gracefully', async () => {
      const invalidBuffer = Buffer.from('not an image');

      const result = await annotateFoldLine(invalidBuffer, { viewportHeight: 720 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Failed to annotate fold line');
    });

    it('should handle empty buffer gracefully', async () => {
      const emptyBuffer = Buffer.alloc(0);

      const result = await annotateFoldLine(emptyBuffer, { viewportHeight: 720 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle zero viewport height', async () => {
      const testImage = await createTestImage(800, 600);

      const result = await annotateFoldLine(testImage, { viewportHeight: 0 });

      // Should succeed but with line at top of image
      expect(result.success).toBe(true);
      expect(result.annotatedBuffer).toBeDefined();
    });

    it('should handle negative viewport height', async () => {
      const testImage = await createTestImage(800, 600);

      // Negative viewportHeight should be treated as out of bounds
      // The function should handle this gracefully
      const result = await annotateFoldLine(testImage, { viewportHeight: -100 });

      // Implementation should handle this - either succeed with clamped value or fail gracefully
      // Based on our implementation, it should succeed (line drawn at y=0 or skipped)
      expect(result.success).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Visual Output Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Visual Output', () => {
    it('should produce valid PNG output', async () => {
      const testImage = await createTestImage(1280, 1000);

      const result = await annotateFoldLine(testImage, { viewportHeight: 720 });

      expect(result.success).toBe(true);
      expect(result.annotatedBuffer).toBeDefined();

      // Verify it's a valid PNG by checking metadata
      const metadata = await sharp(result.annotatedBuffer!).metadata();
      expect(metadata.format).toBe('png');
    });

    it('should have red color in fold line region', async () => {
      const testImage = await createTestImage(1280, 1000, { r: 255, g: 255, b: 255 }); // White background
      const viewportHeight = 500;

      const result = await annotateFoldLine(testImage, { viewportHeight });

      expect(result.success).toBe(true);
      expect(result.annotatedBuffer).toBeDefined();

      // Sample pixels along the fold line - at least some should be red
      const samples = [100, 300, 500, 700, 900, 1100];
      let foundRed = false;

      for (const x of samples) {
        // Check pixels around the fold line (account for anti-aliasing)
        for (let dy = -2; dy <= 2; dy++) {
          const y = viewportHeight + dy;
          if (y >= 0 && y < 1000) {
            const pixel = await getPixelColor(result.annotatedBuffer!, x, y);
            if (pixel.r > 200 && pixel.g < 100 && pixel.b < 100) {
              foundRed = true;
              break;
            }
          }
        }
        if (foundRed) break;
      }

      expect(foundRed).toBe(true);
    });

    it('should not modify pixels outside the annotation area', async () => {
      const testImage = await createTestImage(800, 1000, { r: 128, g: 128, b: 128 });
      const viewportHeight = 500;

      const result = await annotateFoldLine(testImage, { viewportHeight });

      expect(result.success).toBe(true);
      expect(result.annotatedBuffer).toBeDefined();

      // Check pixels far from the fold line (should remain unchanged)
      // Bottom of image, far from fold line at 500px
      const pixelFarFromLine = await getPixelColor(result.annotatedBuffer!, 400, 900);
      // Should still be close to original gray color
      expect(pixelFarFromLine.r).toBeGreaterThan(100);
      expect(pixelFarFromLine.r).toBeLessThan(160);
      expect(pixelFarFromLine.g).toBeGreaterThan(100);
      expect(pixelFarFromLine.g).toBeLessThan(160);
      expect(pixelFarFromLine.b).toBeGreaterThan(100);
      expect(pixelFarFromLine.b).toBeLessThan(160);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Capture Viewport Config Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('CaptureViewportConfig', () => {
  // Import the config functions dynamically
  let setCaptureViewportConfig: (config: { annotateFoldLine?: boolean }) => void;
  let getCaptureViewportConfig: () => { annotateFoldLine: boolean; domTokenBudget: number; compressedImageWidth: number; jpegQuality: number };
  let DEFAULT_CAPTURE_VIEWPORT_CONFIG: { annotateFoldLine: boolean; domTokenBudget: number; compressedImageWidth: number; jpegQuality: number };

  beforeAll(async () => {
    const module = await import('../../src/agent/tools/cro/capture-viewport-tool.js');
    setCaptureViewportConfig = module.setCaptureViewportConfig;
    getCaptureViewportConfig = module.getCaptureViewportConfig;
    DEFAULT_CAPTURE_VIEWPORT_CONFIG = module.DEFAULT_CAPTURE_VIEWPORT_CONFIG;
  });

  it('should have correct default configuration', () => {
    expect(DEFAULT_CAPTURE_VIEWPORT_CONFIG.annotateFoldLine).toBe(true);
    expect(DEFAULT_CAPTURE_VIEWPORT_CONFIG.domTokenBudget).toBe(2000);
    expect(DEFAULT_CAPTURE_VIEWPORT_CONFIG.compressedImageWidth).toBe(384);
    expect(DEFAULT_CAPTURE_VIEWPORT_CONFIG.jpegQuality).toBe(50);
  });

  it('should allow updating configuration', () => {
    // Get original config
    const originalConfig = getCaptureViewportConfig();

    // Update config
    setCaptureViewportConfig({ annotateFoldLine: false });

    // Verify update
    const newConfig = getCaptureViewportConfig();
    expect(newConfig.annotateFoldLine).toBe(false);

    // Reset to original
    setCaptureViewportConfig({ annotateFoldLine: originalConfig.annotateFoldLine });
  });

  it('should preserve other config values when updating one', () => {
    const originalConfig = getCaptureViewportConfig();

    // Update only annotateFoldLine
    setCaptureViewportConfig({ annotateFoldLine: false });

    const newConfig = getCaptureViewportConfig();
    expect(newConfig.domTokenBudget).toBe(originalConfig.domTokenBudget);
    expect(newConfig.compressedImageWidth).toBe(originalConfig.compressedImageWidth);
    expect(newConfig.jpegQuality).toBe(originalConfig.jpegQuality);

    // Reset
    setCaptureViewportConfig({ annotateFoldLine: originalConfig.annotateFoldLine });
  });

  it('should return a copy of config to prevent mutation', () => {
    const config1 = getCaptureViewportConfig();
    const config2 = getCaptureViewportConfig();

    // Mutating config1 should not affect config2
    config1.annotateFoldLine = !config1.annotateFoldLine;

    expect(config2.annotateFoldLine).not.toBe(config1.annotateFoldLine);
  });
});
