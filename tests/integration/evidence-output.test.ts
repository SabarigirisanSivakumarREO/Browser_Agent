/**
 * Integration Tests for Evidence Output - Phase 25g (T518)
 *
 * Tests that evidence.json is correctly created with all required fields
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { buildEvidencePackage, writeEvidenceJson } from '../../src/output/evidence-packager.js';
import type { ViewportSnapshot } from '../../src/models/agent-state.js';
import type { ElementBox } from '../../src/browser/dom/coordinate-mapper.js';
import type { EvidencePackage } from '../../src/types/evidence-schema.js';

const TEST_OUTPUT_DIR = './tests/integration/.test-output/evidence';

describe('Evidence JSON Output', () => {
  beforeAll(async () => {
    // Clean up any previous test output
    try {
      await fs.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
  });

  afterAll(async () => {
    // Clean up test output
    try {
      await fs.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
  });

  describe('buildEvidencePackage', () => {
    it('should create minimal evidence package from empty inputs', () => {
      const pkg = buildEvidencePackage({
        url: 'https://example.com',
        mode: 'viewport',
        viewportWidth: 1280,
        viewportHeight: 720,
        pageHeight: 2000,
        structuredData: null,
      });

      expect(pkg.schemaVersion).toBe('1.0.0');
      expect(pkg.url).toBe('https://example.com');
      expect(pkg.mode).toBe('viewport');
      expect(pkg.elements).toHaveLength(0);
      expect(pkg.screenshots).toHaveLength(0);
      expect(pkg.warnings.length).toBeGreaterThan(0); // Should warn about missing elements
    });

    it('should generate runId if not provided', () => {
      const pkg = buildEvidencePackage({
        url: 'https://example.com',
        mode: 'viewport',
        viewportWidth: 1280,
        viewportHeight: 720,
        pageHeight: null,
        structuredData: null,
      });

      expect(pkg.runId).toBeDefined();
      expect(pkg.runId.length).toBeGreaterThan(10);
    });

    it('should use provided runId', () => {
      const pkg = buildEvidencePackage({
        url: 'https://example.com',
        runId: 'custom-run-123',
        mode: 'viewport',
        viewportWidth: 1280,
        viewportHeight: 720,
        pageHeight: null,
        structuredData: null,
      });

      expect(pkg.runId).toBe('custom-run-123');
    });

    it('should process viewport snapshots', () => {
      const snapshots: ViewportSnapshot[] = [
        {
          scrollPosition: 0,
          viewportIndex: 0,
          screenshot: { base64: 'abc123', capturedAt: Date.now() },
          dom: { serialized: '<div>[0] Test</div>', elementCount: 1 },
        },
        {
          scrollPosition: 720,
          viewportIndex: 1,
          screenshot: { base64: 'def456', capturedAt: Date.now() },
          dom: { serialized: '<div>[1] Test 2</div>', elementCount: 1 },
        },
      ];

      const pkg = buildEvidencePackage({
        url: 'https://example.com',
        mode: 'viewport',
        viewportWidth: 1280,
        viewportHeight: 720,
        pageHeight: 1440,
        snapshots,
        structuredData: null,
      });

      expect(pkg.screenshots).toHaveLength(2);
      expect(pkg.screenshots[0]?.type).toBe('viewport');
      expect(pkg.screenshots[0]?.viewportIndex).toBe(0);
      expect(pkg.screenshots[1]?.viewportIndex).toBe(1);
    });

    it('should process element boxes', () => {
      const elementBoxes: ElementBox[] = [
        {
          elementIndex: 0,
          x: 100,
          y: 200,
          w: 80,
          h: 24,
          scrollY: 0,
          viewportIndex: 0,
          confidence: 0.9,
          isVisible: true,
          croType: 'price',
        },
        {
          elementIndex: 1,
          x: 150,
          y: 300,
          w: 120,
          h: 40,
          scrollY: 0,
          viewportIndex: 0,
          confidence: 0.85,
          isVisible: true,
          croType: 'cta',
        },
      ];

      const pkg = buildEvidencePackage({
        url: 'https://example.com',
        mode: 'viewport',
        viewportWidth: 1280,
        viewportHeight: 720,
        pageHeight: 2000,
        structuredData: null,
        elementBoxes,
      });

      expect(pkg.elements).toHaveLength(2);
      // Elements are sorted by index (0, 1), so price (index 0) comes first
      expect(pkg.elements[0]?.croType).toBe('price');
      expect(pkg.elements[0]?.confidence).toBe(0.9);
      expect(pkg.elements[1]?.croType).toBe('cta');
      expect(pkg.elements[1]?.confidence).toBe(0.85);
      expect(pkg.metrics.detectedCounts.price).toBe(1);
      expect(pkg.metrics.detectedCounts.cta).toBe(1);
    });

    it('should generate warnings for missing PDP signals', () => {
      const pkg = buildEvidencePackage({
        url: 'https://example.com',
        mode: 'viewport',
        viewportWidth: 1280,
        viewportHeight: 720,
        pageHeight: 2000,
        structuredData: null,
      });

      expect(pkg.warnings).toContain('Missing expected PDP signal: price');
      expect(pkg.warnings).toContain('Missing expected PDP signal: cta');
      expect(pkg.warnings).toContain('Missing expected PDP signal: gallery');
      expect(pkg.warnings).toContain('Missing expected PDP signal: variant');
    });

    it('should include structured data when present', () => {
      const pkg = buildEvidencePackage({
        url: 'https://example.com',
        mode: 'viewport',
        viewportWidth: 1280,
        viewportHeight: 720,
        pageHeight: 2000,
        structuredData: {
          name: 'Test Product',
          price: 99.99,
          currency: 'GBP',
          availability: 'InStock',
        },
      });

      expect(pkg.structuredData).not.toBeNull();
      expect(pkg.structuredData?.name).toBe('Test Product');
      expect(pkg.structuredData?.price).toBe(99.99);
      expect(pkg.metrics.structuredDataPresence).toBe(1);
    });

    it('should deduplicate elements seen in multiple viewports', () => {
      const elementBoxes: ElementBox[] = [
        {
          elementIndex: 0,
          x: 100,
          y: 650, // Same absolute coords — same physical element
          w: 80,
          h: 24,
          scrollY: 0,
          viewportIndex: 0,
          confidence: 0.9,
          isVisible: true,
          croType: 'price',
        },
        {
          elementIndex: 0, // Same element in second viewport (overlap)
          x: 100,
          y: 650, // Same absolute coords — same physical element
          w: 80,
          h: 24,
          scrollY: 600,
          viewportIndex: 1,
          confidence: 0.9,
          isVisible: true,
          croType: 'price',
        },
      ];

      const pkg = buildEvidencePackage({
        url: 'https://example.com',
        mode: 'viewport',
        viewportWidth: 1280,
        viewportHeight: 720,
        pageHeight: 2000,
        structuredData: null,
        elementBoxes,
      });

      // Should only have one element entry
      expect(pkg.elements).toHaveLength(1);
      // But it should reference both viewports
      expect(pkg.elements[0]?.viewportIndices).toContain(0);
      expect(pkg.elements[0]?.viewportIndices).toContain(1);
    });
  });

  describe('writeEvidenceJson', () => {
    it('should write valid JSON file', async () => {
      const pkg = buildEvidencePackage({
        url: 'https://example.com',
        runId: 'test-write-123',
        mode: 'viewport',
        viewportWidth: 1280,
        viewportHeight: 720,
        pageHeight: 2000,
        structuredData: null,
      });

      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-evidence.json');
      await writeEvidenceJson(pkg, outputPath);

      // File should exist
      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toBeTruthy();

      // Should be valid JSON
      const parsed: EvidencePackage = JSON.parse(content);
      expect(parsed.schemaVersion).toBe('1.0.0');
      expect(parsed.runId).toBe('test-write-123');
    });

    it('should create directory if it doesn\'t exist', async () => {
      const pkg = buildEvidencePackage({
        url: 'https://example.com',
        runId: 'nested-test-123',
        mode: 'viewport',
        viewportWidth: 1280,
        viewportHeight: 720,
        pageHeight: null,
        structuredData: null,
      });

      const nestedPath = path.join(TEST_OUTPUT_DIR, 'nested', 'deep', 'evidence.json');
      await writeEvidenceJson(pkg, nestedPath);

      const content = await fs.readFile(nestedPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.runId).toBe('nested-test-123');
    });
  });

  describe('metrics computation', () => {
    it('should compute element counts by CRO type', () => {
      const elementBoxes: ElementBox[] = [
        { elementIndex: 0, x: 0, y: 0, w: 10, h: 10, scrollY: 0, viewportIndex: 0, confidence: 0.9, isVisible: true, croType: 'price' },
        { elementIndex: 1, x: 10, y: 0, w: 10, h: 10, scrollY: 0, viewportIndex: 0, confidence: 0.9, isVisible: true, croType: 'cta' },
        { elementIndex: 2, x: 20, y: 0, w: 10, h: 10, scrollY: 0, viewportIndex: 0, confidence: 0.9, isVisible: true, croType: 'cta' },
        { elementIndex: 3, x: 30, y: 0, w: 10, h: 10, scrollY: 0, viewportIndex: 0, confidence: 0.9, isVisible: true, croType: 'gallery' },
      ];

      const pkg = buildEvidencePackage({
        url: 'https://example.com',
        mode: 'viewport',
        viewportWidth: 1280,
        viewportHeight: 720,
        pageHeight: 2000,
        structuredData: null,
        elementBoxes,
      });

      expect(pkg.metrics.detectedCounts.price).toBe(1);
      expect(pkg.metrics.detectedCounts.cta).toBe(2);
      expect(pkg.metrics.detectedCounts.gallery).toBe(1);
    });

    it('should compute mapped box coverage', () => {
      const elementBoxes: ElementBox[] = [
        { elementIndex: 0, x: 10, y: 10, w: 100, h: 50, scrollY: 0, viewportIndex: 0, confidence: 0.9, isVisible: true, croType: 'price' },
        { elementIndex: 1, x: 0, y: 0, w: 0, h: 0, scrollY: 0, viewportIndex: 0, confidence: 0.9, isVisible: true, croType: 'cta' }, // Zero-size box
      ];

      const pkg = buildEvidencePackage({
        url: 'https://example.com',
        mode: 'viewport',
        viewportWidth: 1280,
        viewportHeight: 720,
        pageHeight: 2000,
        structuredData: null,
        elementBoxes,
      });

      // 1 of 2 elements has valid bounding box = 0.5 coverage
      expect(pkg.metrics.mappedBoxCoverage).toBe(0.5);
    });
  });
});
