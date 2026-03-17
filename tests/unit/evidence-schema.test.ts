/**
 * Unit Tests for Evidence Schema - Phase 25g (T517)
 *
 * Tests for the EvidencePackage schema, helper functions, and validation
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyMetrics,
  generateRunId,
  generateViewportRef,
  generateScreenshotId,
  type EvidencePackage,
  type EvidenceElement,
  type EvidenceScreenshot,
  type ExtractionMetrics,
} from '../../src/types/evidence-schema.js';

describe('createEmptyMetrics', () => {
  it('should create metrics with all CRO types at zero', () => {
    const metrics = createEmptyMetrics();

    expect(metrics.detectedCounts.cta).toBe(0);
    expect(metrics.detectedCounts.form).toBe(0);
    expect(metrics.detectedCounts.trust).toBe(0);
    expect(metrics.detectedCounts.value_prop).toBe(0);
    expect(metrics.detectedCounts.navigation).toBe(0);
    expect(metrics.detectedCounts.price).toBe(0);
    expect(metrics.detectedCounts.variant).toBe(0);
    expect(metrics.detectedCounts.stock).toBe(0);
    expect(metrics.detectedCounts.shipping).toBe(0);
    expect(metrics.detectedCounts.gallery).toBe(0);
  });

  it('should create metrics with all coverage values at zero', () => {
    const metrics = createEmptyMetrics();

    expect(metrics.mappedBoxCoverage).toBe(0);
    expect(metrics.screenshotCoverage).toBe(0);
    expect(metrics.structuredDataPresence).toBe(0);
    expect(metrics.aboveFoldCoverage).toBe(0);
    expect(metrics.warningCount).toBe(0);
    expect(metrics.extractionDurationMs).toBe(0);
  });
});

describe('generateRunId', () => {
  it('should generate unique run IDs', () => {
    const id1 = generateRunId();
    const id2 = generateRunId();

    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThan(10);
    expect(id2.length).toBeGreaterThan(10);
  });

  it('should include timestamp in ISO format', () => {
    const timestamp = new Date('2026-02-05T10:30:00Z');
    const id = generateRunId(timestamp);

    // Should contain date parts
    expect(id).toMatch(/2026-02-05/);
  });

  it('should include seed in the hash when provided', () => {
    const timestamp = new Date('2026-02-05T10:30:00Z');
    const id1 = generateRunId(timestamp, 'https://example.com');
    const id2 = generateRunId(timestamp, 'https://different.com');

    expect(id1).not.toBe(id2);
  });

  it('should be deterministic with same timestamp and seed', () => {
    const timestamp = new Date('2026-02-05T10:30:00Z');
    const id1 = generateRunId(timestamp, 'test-seed');
    const id2 = generateRunId(timestamp, 'test-seed');

    expect(id1).toBe(id2);
  });
});

describe('generateViewportRef', () => {
  it('should generate correct format [vX-Y]', () => {
    expect(generateViewportRef(0, 0)).toBe('[v0-0]');
    expect(generateViewportRef(1, 5)).toBe('[v1-5]');
    expect(generateViewportRef(2, 10)).toBe('[v2-10]');
  });

  it('should handle large indices', () => {
    expect(generateViewportRef(99, 999)).toBe('[v99-999]');
  });
});

describe('generateScreenshotId', () => {
  it('should generate correct format for viewport type', () => {
    expect(generateScreenshotId(0, 'viewport')).toBe('viewport-0');
    expect(generateScreenshotId(1, 'viewport')).toBe('viewport-1');
    expect(generateScreenshotId(5, 'viewport')).toBe('viewport-5');
  });

  it('should generate correct format for tile type', () => {
    expect(generateScreenshotId(0, 'tile')).toBe('tile-0');
    expect(generateScreenshotId(3, 'tile')).toBe('tile-3');
  });
});

describe('EvidencePackage structure', () => {
  it('should allow minimal valid package', () => {
    const minimal: EvidencePackage = {
      schemaVersion: '1.0.0',
      url: 'https://example.com',
      runId: 'test-run-123',
      timestamp: '2026-02-05T10:30:00Z',
      mode: 'viewport',
      viewportHeight: 720,
      viewportWidth: 1280,
      pageHeight: 2000,
      structuredData: null,
      elements: [],
      screenshots: [],
      metrics: createEmptyMetrics(),
      warnings: [],
    };

    expect(minimal.schemaVersion).toBe('1.0.0');
    expect(minimal.elements).toHaveLength(0);
    expect(minimal.screenshots).toHaveLength(0);
  });

  it('should support optional fields', () => {
    const withOptional: EvidencePackage = {
      schemaVersion: '1.0.0',
      url: 'https://example.com',
      runId: 'test-run-123',
      timestamp: '2026-02-05T10:30:00Z',
      mode: 'tiled',
      viewportHeight: 720,
      viewportWidth: 1280,
      pageHeight: null, // Optional can be null
      structuredData: {
        name: 'Test Product',
        price: 99.99,
        currency: 'USD',
      },
      elements: [],
      screenshots: [],
      metrics: createEmptyMetrics(),
      warnings: [],
    };

    expect(withOptional.pageHeight).toBeNull();
    expect(withOptional.structuredData?.price).toBe(99.99);
  });
});

describe('EvidenceElement structure', () => {
  it('should allow valid element', () => {
    const element: EvidenceElement = {
      index: 0,
      viewportRef: '[v0-0]',
      croType: 'price',
      confidence: 0.92,
      tagName: 'span',
      text: '£120.00',
      boundingBox: { x: 100, y: 200, width: 80, height: 24 },
      viewportIndices: [0],
      screenshotRefs: ['viewport-0'],
    };

    expect(element.croType).toBe('price');
    expect(element.confidence).toBe(0.92);
  });

  it('should support optional matchedPatterns', () => {
    const element: EvidenceElement = {
      index: 1,
      viewportRef: '[v0-1]',
      croType: 'cta',
      confidence: 0.85,
      tagName: 'button',
      text: 'Add to Cart',
      boundingBox: { x: 150, y: 300, width: 120, height: 40 },
      viewportIndices: [0, 1],
      screenshotRefs: ['viewport-0', 'viewport-1'],
      matchedPatterns: ['tag:button', 'class:btn-primary', 'text:add to cart'],
    };

    expect(element.matchedPatterns).toHaveLength(3);
  });
});

describe('EvidenceScreenshot structure', () => {
  it('should allow valid screenshot', () => {
    const screenshot: EvidenceScreenshot = {
      id: 'viewport-0',
      viewportIndex: 0,
      type: 'viewport',
      scrollY: 0,
      startY: 0,
      endY: 720,
      width: 1280,
      height: 720,
      isAboveFold: true,
      timestamp: '2026-02-05T10:30:00Z',
      visibleElementIndices: [0, 1, 2],
    };

    expect(screenshot.isAboveFold).toBe(true);
    expect(screenshot.visibleElementIndices).toHaveLength(3);
  });

  it('should support optional fields', () => {
    const screenshot: EvidenceScreenshot = {
      id: 'tile-0',
      viewportIndex: 0,
      type: 'tile',
      scrollY: 0,
      startY: 0,
      endY: 1800,
      width: 1280,
      height: 1800,
      isAboveFold: true,
      filePath: './evidence/tile-0.png',
      base64: 'iVBORw0KGgo...', // Truncated
      timestamp: '2026-02-05T10:30:00Z',
      visibleElementIndices: [],
    };

    expect(screenshot.filePath).toBe('./evidence/tile-0.png');
    expect(screenshot.base64).toBeDefined();
  });
});

describe('ExtractionMetrics structure', () => {
  it('should have all CRO type counts', () => {
    const metrics: ExtractionMetrics = {
      detectedCounts: {
        cta: 3,
        form: 1,
        trust: 2,
        value_prop: 1,
        navigation: 4,
        price: 2,
        variant: 1,
        stock: 1,
        shipping: 1,
        gallery: 1,
      },
      mappedBoxCoverage: 0.95,
      screenshotCoverage: 1.0,
      structuredDataPresence: 1,
      aboveFoldCoverage: 0.8,
      warningCount: 2,
      extractionDurationMs: 1500,
    };

    expect(metrics.detectedCounts.cta).toBe(3);
    expect(metrics.mappedBoxCoverage).toBe(0.95);
    expect(metrics.extractionDurationMs).toBe(1500);
  });
});
