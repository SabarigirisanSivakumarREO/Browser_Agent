/**
 * Integration Tests for Extraction Metrics - Phase 25h (T534)
 *
 * Tests that metrics computation produces correct and stable values
 * for various extraction scenarios.
 */

import { describe, it, expect } from 'vitest';
import {
  computeExtractionMetrics,
  evaluateMetricsQuality,
  summarizeMetrics,
  type ElementForMetrics,
  type ScreenshotForMetrics,
  type MetricsInput,
} from '../../src/output/extraction-metrics.js';

describe('Extraction Metrics', () => {
  describe('computeExtractionMetrics', () => {
    it('should count elements by CRO type', () => {
      const elements: ElementForMetrics[] = [
        { index: 0, croType: 'price', confidence: 0.9, boundingBox: { x: 0, y: 0, width: 100, height: 20 }, viewportIndices: [0] },
        { index: 1, croType: 'cta', confidence: 0.85, boundingBox: { x: 0, y: 50, width: 120, height: 40 }, viewportIndices: [0] },
        { index: 2, croType: 'cta', confidence: 0.8, boundingBox: { x: 0, y: 100, width: 100, height: 40 }, viewportIndices: [0] },
        { index: 3, croType: 'trust', confidence: 0.75, boundingBox: { x: 0, y: 150, width: 200, height: 50 }, viewportIndices: [0] },
      ];

      const input: MetricsInput = {
        elements,
        screenshots: [],
        structuredData: null,
        pageHeight: 2000,
        viewportHeight: 720,
        warnings: [],
      };

      const metrics = computeExtractionMetrics(input);

      expect(metrics.detectedCounts.price).toBe(1);
      expect(metrics.detectedCounts.cta).toBe(2);
      expect(metrics.detectedCounts.trust).toBe(1);
      expect(metrics.detectedCounts.form).toBe(0);
    });

    it('should compute bounding box coverage', () => {
      const elements: ElementForMetrics[] = [
        { index: 0, croType: 'price', confidence: 0.9, boundingBox: { x: 10, y: 10, width: 100, height: 20 }, viewportIndices: [0] },
        { index: 1, croType: 'cta', confidence: 0.85, boundingBox: { x: 0, y: 0, width: 0, height: 0 }, viewportIndices: [0] }, // Zero-size
      ];

      const input: MetricsInput = {
        elements,
        screenshots: [],
        structuredData: null,
        pageHeight: 2000,
        viewportHeight: 720,
        warnings: [],
      };

      const metrics = computeExtractionMetrics(input);

      expect(metrics.mappedBoxCoverage).toBe(0.5); // 1 of 2 has valid box
    });

    it('should compute screenshot coverage', () => {
      const screenshots: ScreenshotForMetrics[] = [
        { viewportIndex: 0, startY: 0, endY: 720, isAboveFold: true },
        { viewportIndex: 1, startY: 600, endY: 1320, isAboveFold: false },
      ];

      const input: MetricsInput = {
        elements: [],
        screenshots,
        structuredData: null,
        pageHeight: 1400,
        viewportHeight: 720,
        warnings: [],
      };

      const metrics = computeExtractionMetrics(input);

      // Coverage should account for overlap (0-1320 covered out of 1400)
      expect(metrics.screenshotCoverage).toBeGreaterThan(0.9);
    });

    it('should detect structured data presence', () => {
      const withStructured: MetricsInput = {
        elements: [],
        screenshots: [],
        structuredData: { name: 'Test', price: 99 },
        pageHeight: 1000,
        viewportHeight: 720,
        warnings: [],
      };

      const withoutStructured: MetricsInput = {
        elements: [],
        screenshots: [],
        structuredData: null,
        pageHeight: 1000,
        viewportHeight: 720,
        warnings: [],
      };

      const metricsWithStructured = computeExtractionMetrics(withStructured);
      const metricsWithoutStructured = computeExtractionMetrics(withoutStructured);

      expect(metricsWithStructured.structuredDataPresence).toBe(1);
      expect(metricsWithoutStructured.structuredDataPresence).toBe(0);
    });

    it('should compute above-fold coverage', () => {
      const elements: ElementForMetrics[] = [
        { index: 0, croType: 'cta', confidence: 0.9, boundingBox: { x: 0, y: 0, width: 100, height: 40 }, viewportIndices: [0] }, // Above fold
        { index: 1, croType: 'price', confidence: 0.9, boundingBox: { x: 0, y: 0, width: 80, height: 20 }, viewportIndices: [0] }, // Above fold
        { index: 2, croType: 'cta', confidence: 0.9, boundingBox: { x: 0, y: 1000, width: 100, height: 40 }, viewportIndices: [1] }, // Below fold
      ];

      const input: MetricsInput = {
        elements,
        screenshots: [],
        structuredData: null,
        pageHeight: 2000,
        viewportHeight: 720,
        warnings: [],
      };

      const metrics = computeExtractionMetrics(input);

      // 2 of 3 important elements (cta, price) are above fold
      expect(metrics.aboveFoldCoverage).toBeCloseTo(0.67, 1);
    });

    it('should count warnings', () => {
      const input: MetricsInput = {
        elements: [],
        screenshots: [],
        structuredData: null,
        pageHeight: 1000,
        viewportHeight: 720,
        warnings: ['Warning 1', 'Warning 2', 'Warning 3'],
      };

      const metrics = computeExtractionMetrics(input);

      expect(metrics.warningCount).toBe(3);
    });

    it('should compute extraction duration', () => {
      const startTime = Date.now() - 1500; // 1.5 seconds ago

      const input: MetricsInput = {
        elements: [],
        screenshots: [],
        structuredData: null,
        pageHeight: 1000,
        viewportHeight: 720,
        warnings: [],
        extractionStartTime: startTime,
      };

      const metrics = computeExtractionMetrics(input);

      expect(metrics.extractionDurationMs).toBeGreaterThanOrEqual(1500);
      expect(metrics.extractionDurationMs).toBeLessThan(2000);
    });

    it('should handle empty inputs gracefully', () => {
      const input: MetricsInput = {
        elements: [],
        screenshots: [],
        structuredData: null,
        pageHeight: null,
        viewportHeight: 720,
        warnings: [],
      };

      const metrics = computeExtractionMetrics(input);

      expect(metrics.mappedBoxCoverage).toBe(0);
      expect(metrics.screenshotCoverage).toBe(0);
      expect(metrics.aboveFoldCoverage).toBe(0);
    });
  });

  describe('evaluateMetricsQuality', () => {
    it('should pass when all thresholds met', () => {
      const metrics = computeExtractionMetrics({
        elements: [
          { index: 0, croType: 'price', confidence: 0.9, boundingBox: { x: 10, y: 10, width: 100, height: 20 }, viewportIndices: [0] },
          { index: 1, croType: 'cta', confidence: 0.9, boundingBox: { x: 10, y: 50, width: 120, height: 40 }, viewportIndices: [0] },
        ],
        screenshots: [
          { viewportIndex: 0, startY: 0, endY: 1000, isAboveFold: true },
        ],
        structuredData: { name: 'Test', price: 99 },
        pageHeight: 1000,
        viewportHeight: 720,
        warnings: [],
      });

      const evaluation = evaluateMetricsQuality(metrics);

      expect(evaluation.meetsThresholds).toBe(true);
      expect(evaluation.qualityScore).toBeGreaterThan(80);
    });

    it('should fail and report issues when coverage is low', () => {
      const metrics = computeExtractionMetrics({
        elements: [
          { index: 0, croType: 'form', confidence: 0.9, boundingBox: { x: 0, y: 0, width: 0, height: 0 }, viewportIndices: [0] }, // Zero-size
        ],
        screenshots: [],
        structuredData: null,
        pageHeight: 10000,
        viewportHeight: 720,
        warnings: [],
      });

      const evaluation = evaluateMetricsQuality(metrics);

      expect(evaluation.meetsThresholds).toBe(false);
      expect(evaluation.issues.length).toBeGreaterThan(0);
      expect(evaluation.recommendations.length).toBeGreaterThan(0);
    });

    it('should report missing CTA and price', () => {
      const metrics = computeExtractionMetrics({
        elements: [],
        screenshots: [],
        structuredData: null,
        pageHeight: 1000,
        viewportHeight: 720,
        warnings: [],
      });

      const evaluation = evaluateMetricsQuality(metrics);

      expect(evaluation.issues).toContain('No cta elements detected');
      expect(evaluation.issues).toContain('No price elements detected');
    });

    it('should report missing structured data', () => {
      const metrics = computeExtractionMetrics({
        elements: [],
        screenshots: [],
        structuredData: null,
        pageHeight: 1000,
        viewportHeight: 720,
        warnings: [],
      });

      const evaluation = evaluateMetricsQuality(metrics);

      expect(evaluation.issues).toContain('No JSON-LD structured data found');
    });

    it('should produce quality score between 0-100', () => {
      const badMetrics = computeExtractionMetrics({
        elements: [],
        screenshots: [],
        structuredData: null,
        pageHeight: 1000,
        viewportHeight: 720,
        warnings: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10'],
      });

      const evaluation = evaluateMetricsQuality(badMetrics);

      expect(evaluation.qualityScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.qualityScore).toBeLessThanOrEqual(100);
    });
  });

  describe('summarizeMetrics', () => {
    it('should produce readable summary', () => {
      const metrics = computeExtractionMetrics({
        elements: [
          { index: 0, croType: 'price', confidence: 0.9, boundingBox: { x: 10, y: 10, width: 100, height: 20 }, viewportIndices: [0] },
          { index: 1, croType: 'cta', confidence: 0.9, boundingBox: { x: 10, y: 50, width: 120, height: 40 }, viewportIndices: [0] },
        ],
        screenshots: [
          { viewportIndex: 0, startY: 0, endY: 720, isAboveFold: true },
        ],
        structuredData: { name: 'Test', price: 99 },
        pageHeight: 1000,
        viewportHeight: 720,
        warnings: [],
      });

      const summary = summarizeMetrics(metrics);

      expect(summary).toContain('Extraction Metrics Summary');
      expect(summary).toContain('price: 1');
      expect(summary).toContain('cta: 1');
      expect(summary).toContain('Structured data: Yes');
    });
  });
});
