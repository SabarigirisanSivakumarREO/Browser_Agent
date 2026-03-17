/**
 * Integration Tests for Reconciliation - Phase 25h (T533)
 *
 * Tests that reconciliation correctly identifies mismatches between
 * structured data (JSON-LD) and DOM-extracted values.
 */

import { describe, it, expect } from 'vitest';
import {
  reconcileStructuredVsDOM,
  extractDOMPrices,
  type DOMPrice,
} from '../../src/validation/reconciliation.js';
import type { StructuredProductData } from '../../src/browser/dom/structured-data.js';

describe('Reconciliation', () => {
  describe('reconcileStructuredVsDOM', () => {
    it('should pass when prices match exactly', () => {
      const structured: StructuredProductData = {
        name: 'Test Product',
        price: 99.99,
        currency: 'GBP',
      };
      const domPrices: DOMPrice[] = [
        { viewportRef: '[v0-0]', value: '£99.99', numericValue: 99.99, currency: '£' },
      ];

      const result = reconcileStructuredVsDOM(structured, domPrices);

      expect(result.passed).toBe(true);
      expect(result.priceReconciliation?.matched).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should pass when prices match within tolerance', () => {
      const structured: StructuredProductData = {
        price: 100.00,
      };
      const domPrices: DOMPrice[] = [
        { viewportRef: '[v0-0]', value: '£99.50', numericValue: 99.50 },
      ];

      const result = reconcileStructuredVsDOM(structured, domPrices, undefined, {
        priceTolerancePercent: 5,
      });

      expect(result.passed).toBe(true);
      expect(result.priceReconciliation?.matched).toBe(true);
    });

    it('should detect price mismatch and fail', () => {
      const structured: StructuredProductData = {
        price: 100.00,
      };
      const domPrices: DOMPrice[] = [
        { viewportRef: '[v0-0]', value: '£150.00', numericValue: 150.00 },
      ];

      const result = reconcileStructuredVsDOM(structured, domPrices);

      expect(result.passed).toBe(false);
      expect(result.priceReconciliation?.matched).toBe(false);
      expect(result.warnings).toContain('Price mismatch: JSON-LD (100) vs DOM (150)');
      expect(result.mismatches[0]?.severity).toBe('critical');
    });

    it('should warn when JSON-LD has price but DOM does not', () => {
      const structured: StructuredProductData = {
        price: 99.99,
      };
      const domPrices: DOMPrice[] = [];

      const result = reconcileStructuredVsDOM(structured, domPrices);

      expect(result.warnings).toContain('Price in JSON-LD but not detected in visible DOM elements');
      expect(result.priceReconciliation?.selectedPrice).toBe(99.99);
    });

    it('should warn when DOM has price but JSON-LD does not', () => {
      const domPrices: DOMPrice[] = [
        { viewportRef: '[v0-0]', value: '£99.99', numericValue: 99.99 },
      ];

      const result = reconcileStructuredVsDOM(null, domPrices);

      expect(result.warnings).toContain('Price found in DOM but not in JSON-LD structured data');
      expect(result.priceReconciliation?.selectedPrice).toBe(99.99);
    });

    it('should warn when no price found anywhere', () => {
      const result = reconcileStructuredVsDOM(null, []);

      expect(result.warnings).toContain('No price found in JSON-LD or DOM');
      expect(result.priceReconciliation?.matched).toBe(false);
    });

    it('should detect availability mismatch', () => {
      const structured: StructuredProductData = {
        price: 99, // Add price to avoid "no price" warning being first
        availability: 'InStock',
      };
      const domPrices: DOMPrice[] = [
        { viewportRef: '[v0-0]', value: '£99.00', numericValue: 99.0 },
      ];

      const result = reconcileStructuredVsDOM(structured, domPrices, 'Out of Stock');

      expect(result.availabilityReconciliation?.matched).toBe(false);
      expect(result.warnings.some(w => w.includes('Availability mismatch'))).toBe(true);
    });

    it('should normalize availability strings for comparison', () => {
      const structured: StructuredProductData = {
        availability: 'https://schema.org/InStock',
      };

      const result = reconcileStructuredVsDOM(structured, [], 'In Stock');

      expect(result.availabilityReconciliation?.matched).toBe(true);
    });

    it('should prefer JSON-LD when configured', () => {
      const structured: StructuredProductData = {
        price: 100.00,
      };
      const domPrices: DOMPrice[] = [
        { viewportRef: '[v0-0]', value: '£99.00', numericValue: 99.00 },
      ];

      const result = reconcileStructuredVsDOM(structured, domPrices, undefined, {
        preferJsonLd: true,
        priceTolerancePercent: 0, // Force mismatch
      });

      expect(result.preferredSource).toBe('json-ld');
    });

    it('should prefer DOM when configured', () => {
      const structured: StructuredProductData = {
        price: 100.00,
      };
      const domPrices: DOMPrice[] = [
        { viewportRef: '[v0-0]', value: '£99.00', numericValue: 99.00 },
      ];

      const result = reconcileStructuredVsDOM(structured, domPrices, undefined, {
        preferJsonLd: false,
      });

      expect(result.preferredSource).toBe('dom');
    });
  });

  describe('extractDOMPrices', () => {
    it('should extract price elements', () => {
      const elements = [
        { viewportRef: '[v0-0]', text: '£99.99', croType: 'price' },
        { viewportRef: '[v0-1]', text: 'Add to Cart', croType: 'cta' },
        { viewportRef: '[v0-2]', text: '£149.99', croType: 'price' },
      ];

      const prices = extractDOMPrices(elements);

      expect(prices).toHaveLength(2);
      expect(prices[0]?.viewportRef).toBe('[v0-0]');
      expect(prices[0]?.numericValue).toBe(99.99);
      expect(prices[1]?.numericValue).toBe(149.99);
    });

    it('should parse various price formats', () => {
      const elements = [
        { viewportRef: '[v0-0]', text: '$99.99', croType: 'price' },
        { viewportRef: '[v0-1]', text: '€ 149,00', croType: 'price' },
        { viewportRef: '[v0-2]', text: '£1,299.99', croType: 'price' },
      ];

      const prices = extractDOMPrices(elements);

      expect(prices[0]?.numericValue).toBe(99.99);
      expect(prices[0]?.currency).toBe('$');
      expect(prices[2]?.numericValue).toBe(1299.99);
    });

    it('should skip elements without text', () => {
      const elements = [
        { viewportRef: '[v0-0]', text: '', croType: 'price' },
        { viewportRef: '[v0-1]', text: '£99.99', croType: 'price' },
      ];

      const prices = extractDOMPrices(elements);

      expect(prices).toHaveLength(1);
      expect(prices[0]?.viewportRef).toBe('[v0-1]');
    });
  });
});
