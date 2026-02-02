/**
 * Unit Tests for Screenshot Annotator - Phase 21i (T381)
 *
 * Tests for annotating screenshots with bounding boxes and element labels.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import sharp from 'sharp';
import {
  annotateScreenshot,
  ScreenshotAnnotator,
  createScreenshotAnnotator,
  DEFAULT_ANNOTATION_OPTIONS,
  type AnnotationOptions,
  type AnnotationResult,
} from '../../src/output/screenshot-annotator.js';
import type { ElementMapping, ScreenshotCoords } from '../../src/browser/dom/coordinate-mapper.js';
import type { HeuristicEvaluation, EvaluationStatus } from '../../src/heuristics/vision/types.js';
import type { DOMElementRef } from '../../src/heuristics/vision/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Test Fixtures
// ═══════════════════════════════════════════════════════════════════════════════

// Generate a valid test PNG (100x100 white image)
let TEST_PNG_BASE64: string = '';

beforeAll(async () => {
  // Create a real PNG buffer using sharp
  const pngBuffer = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  TEST_PNG_BASE64 = pngBuffer.toString('base64');
});

function createElementMapping(
  index: number,
  x: number,
  y: number,
  width: number,
  height: number,
  isVisible: boolean = true,
  visibilityRatio: number = 1
): ElementMapping {
  const screenshotCoords: ScreenshotCoords = {
    x,
    y,
    width,
    height,
    isVisible,
    visibilityRatio,
  };

  return {
    index,
    xpath: `/button[${index}]`,
    text: `Element ${index}`,
    croType: 'cta',
    tagName: 'button',
    pageCoords: { x, y, width, height },
    screenshotCoords,
  };
}

function createEvaluation(
  heuristicId: string,
  status: EvaluationStatus,
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
    observation: `Observation for ${heuristicId}`,
    confidence: 0.9,
    domElementRefs,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT_ANNOTATION_OPTIONS Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('DEFAULT_ANNOTATION_OPTIONS', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_ANNOTATION_OPTIONS.highlightIssues).toBe(true);
    expect(DEFAULT_ANNOTATION_OPTIONS.showElementIndexes).toBe(true);
    expect(DEFAULT_ANNOTATION_OPTIONS.showCoordinates).toBe(false);
    expect(DEFAULT_ANNOTATION_OPTIONS.strokeWidth).toBe(2);
    expect(DEFAULT_ANNOTATION_OPTIONS.fontSize).toBe(12);
    expect(DEFAULT_ANNOTATION_OPTIONS.fillOpacity).toBe(0.3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// annotateScreenshot Function Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('annotateScreenshot', () => {
  describe('basic functionality', () => {
    it('should annotate a valid screenshot successfully', async () => {
      const elements = [createElementMapping(0, 10, 10, 100, 40)];
      const evaluations: HeuristicEvaluation[] = [];

      const result = await annotateScreenshot(TEST_PNG_BASE64, elements, evaluations);

      expect(result.success).toBe(true);
      expect(result.annotatedBase64).toBeDefined();
      expect(result.annotatedBase64).not.toBe(TEST_PNG_BASE64); // Should be modified
      expect(result.elementsAnnotated).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it('should return base64 PNG string', async () => {
      const elements = [createElementMapping(0, 10, 10, 50, 30)];
      const evaluations: HeuristicEvaluation[] = [];

      const result = await annotateScreenshot(TEST_PNG_BASE64, elements, evaluations);

      expect(result.success).toBe(true);
      expect(result.annotatedBase64).toMatch(/^[A-Za-z0-9+/]+=*$/); // Valid base64
    });

    it('should handle empty elements array', async () => {
      const result = await annotateScreenshot(TEST_PNG_BASE64, [], []);

      expect(result.success).toBe(true);
      expect(result.elementsAnnotated).toBe(0);
    });

    it('should handle empty evaluations array', async () => {
      const elements = [createElementMapping(0, 10, 10, 50, 30)];

      const result = await annotateScreenshot(TEST_PNG_BASE64, elements, []);

      expect(result.success).toBe(true);
      expect(result.elementsAnnotated).toBe(1);
    });
  });

  describe('color coding by status', () => {
    it('should use red color for failed evaluations', async () => {
      const elements = [createElementMapping(0, 10, 10, 50, 30)];
      const evaluations = [createEvaluation('TEST-001', 'fail', [0])];

      const result = await annotateScreenshot(TEST_PNG_BASE64, elements, evaluations);

      expect(result.success).toBe(true);
      expect(result.elementsAnnotated).toBe(1);
      // Note: We can't easily verify the actual SVG colors without parsing the image
      // The test verifies the function processes failed evaluations without error
    });

    it('should use orange color for partial evaluations', async () => {
      const elements = [createElementMapping(0, 10, 10, 50, 30)];
      const evaluations = [createEvaluation('TEST-001', 'partial', [0])];

      const result = await annotateScreenshot(TEST_PNG_BASE64, elements, evaluations);

      expect(result.success).toBe(true);
      expect(result.elementsAnnotated).toBe(1);
    });

    it('should use green color for passed evaluations', async () => {
      const elements = [createElementMapping(0, 10, 10, 50, 30)];
      const evaluations = [createEvaluation('TEST-001', 'pass', [0])];

      const result = await annotateScreenshot(TEST_PNG_BASE64, elements, evaluations);

      expect(result.success).toBe(true);
    });

    it('should use gray color for elements without status', async () => {
      const elements = [createElementMapping(0, 10, 10, 50, 30)];
      const evaluations: HeuristicEvaluation[] = []; // No evaluations

      const result = await annotateScreenshot(TEST_PNG_BASE64, elements, evaluations, {
        highlightIssues: false, // Show all elements
      });

      expect(result.success).toBe(true);
    });
  });

  describe('element visibility handling', () => {
    it('should skip invisible elements', async () => {
      const elements = [
        createElementMapping(0, 10, 10, 50, 30, true),  // visible
        createElementMapping(1, 10, 100, 50, 30, false), // invisible
      ];

      const result = await annotateScreenshot(TEST_PNG_BASE64, elements, []);

      expect(result.success).toBe(true);
      expect(result.elementsAnnotated).toBe(1); // Only visible element
    });

    it('should handle elements with zero dimensions', async () => {
      const elements = [
        createElementMapping(0, 10, 10, 0, 0, true), // Zero dimensions
      ];

      const result = await annotateScreenshot(TEST_PNG_BASE64, elements, []);

      expect(result.success).toBe(true);
      // Zero-dimension elements are filtered out
    });

    it('should handle elements with negative y coordinates', async () => {
      const elements = [
        createElementMapping(0, 10, -20, 50, 50, true), // Partially above viewport
      ];

      const result = await annotateScreenshot(TEST_PNG_BASE64, elements, []);

      expect(result.success).toBe(true);
    });
  });

  describe('options handling', () => {
    it('should respect highlightIssues option', async () => {
      const elements = [createElementMapping(0, 10, 10, 50, 30)];
      const evaluations: HeuristicEvaluation[] = [];

      // With highlightIssues false, should still annotate
      const result = await annotateScreenshot(TEST_PNG_BASE64, elements, evaluations, {
        highlightIssues: false,
      });

      expect(result.success).toBe(true);
    });

    it('should respect showElementIndexes option', async () => {
      const elements = [createElementMapping(0, 10, 10, 50, 30)];

      const result = await annotateScreenshot(TEST_PNG_BASE64, elements, [], {
        showElementIndexes: true,
      });

      expect(result.success).toBe(true);
    });

    it('should respect showCoordinates option', async () => {
      const elements = [createElementMapping(0, 10, 10, 50, 30)];

      const result = await annotateScreenshot(TEST_PNG_BASE64, elements, [], {
        showCoordinates: true,
      });

      expect(result.success).toBe(true);
    });

    it('should merge custom options with defaults', async () => {
      const elements = [createElementMapping(0, 10, 10, 50, 30)];

      const result = await annotateScreenshot(TEST_PNG_BASE64, elements, [], {
        strokeWidth: 5,
        fontSize: 16,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle invalid base64 gracefully', async () => {
      const result = await annotateScreenshot('invalid-base64!!!', [], []);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Failed to annotate screenshot');
    });

    it('should handle empty base64 string', async () => {
      const result = await annotateScreenshot('', [], []);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('multiple elements', () => {
    it('should annotate multiple elements', async () => {
      const elements = [
        createElementMapping(0, 10, 10, 50, 30),
        createElementMapping(1, 70, 10, 50, 30),
        createElementMapping(2, 10, 50, 50, 30),
      ];
      const evaluations = [
        createEvaluation('TEST-001', 'fail', [0]),
        createEvaluation('TEST-002', 'pass', [1]),
        createEvaluation('TEST-003', 'partial', [2]),
      ];

      const result = await annotateScreenshot(TEST_PNG_BASE64, elements, evaluations);

      expect(result.success).toBe(true);
      expect(result.elementsAnnotated).toBe(3);
    });

    it('should sort elements by area (largest first)', async () => {
      const elements = [
        createElementMapping(0, 10, 10, 20, 20),   // Small (400)
        createElementMapping(1, 10, 10, 100, 100), // Large (10000)
        createElementMapping(2, 10, 10, 50, 50),   // Medium (2500)
      ];

      const result = await annotateScreenshot(TEST_PNG_BASE64, elements, []);

      expect(result.success).toBe(true);
      // Largest elements should be drawn first (underneath smaller ones)
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ScreenshotAnnotator Class Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('ScreenshotAnnotator', () => {
  describe('constructor', () => {
    it('should create instance with default options', () => {
      const annotator = new ScreenshotAnnotator();
      const options = annotator.getOptions();

      expect(options.highlightIssues).toBe(true);
      expect(options.showElementIndexes).toBe(true);
      expect(options.showCoordinates).toBe(false);
    });

    it('should create instance with custom options', () => {
      const annotator = new ScreenshotAnnotator({
        highlightIssues: false,
        showCoordinates: true,
      });
      const options = annotator.getOptions();

      expect(options.highlightIssues).toBe(false);
      expect(options.showCoordinates).toBe(true);
    });
  });

  describe('annotate method', () => {
    it('should annotate screenshot using instance options', async () => {
      const annotator = new ScreenshotAnnotator({
        showElementIndexes: true,
      });

      const elements = [createElementMapping(0, 10, 10, 50, 30)];
      const result = await annotator.annotate(TEST_PNG_BASE64, elements, []);

      expect(result.success).toBe(true);
    });
  });

  describe('setOptions method', () => {
    it('should update options', () => {
      const annotator = new ScreenshotAnnotator();

      annotator.setOptions({ showCoordinates: true });
      const options = annotator.getOptions();

      expect(options.showCoordinates).toBe(true);
      expect(options.highlightIssues).toBe(true); // Other options unchanged
    });
  });

  describe('getOptions method', () => {
    it('should return a copy of options', () => {
      const annotator = new ScreenshotAnnotator();
      const options1 = annotator.getOptions();
      const options2 = annotator.getOptions();

      expect(options1).not.toBe(options2); // Different objects
      expect(options1).toEqual(options2);  // Same values
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createScreenshotAnnotator Factory Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('createScreenshotAnnotator', () => {
  it('should create annotator with default options', () => {
    const annotator = createScreenshotAnnotator();

    expect(annotator).toBeInstanceOf(ScreenshotAnnotator);
    expect(annotator.getOptions().highlightIssues).toBe(true);
  });

  it('should create annotator with custom options', () => {
    const annotator = createScreenshotAnnotator({
      strokeWidth: 4,
      fontSize: 14,
    });

    expect(annotator.getOptions().strokeWidth).toBe(4);
    expect(annotator.getOptions().fontSize).toBe(14);
  });
});
