/**
 * Unit Tests for CRO Confidence Aggregation - Phase 25g (T514)
 *
 * Tests for the aggregateConfidence, matchElementPatterns, and getBestCROMatch functions
 * in cro-selectors.ts
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateConfidence,
  matchElementPatterns,
  getBestCROMatch,
  type AggregatedConfidence,
} from '../../src/browser/dom/cro-selectors.js';

describe('aggregateConfidence', () => {
  describe('basic functionality', () => {
    it('should return 0 confidence for empty matches', () => {
      const result = aggregateConfidence([]);
      expect(result.confidence).toBe(0);
      expect(result.matchedPatterns).toEqual([]);
    });

    it('should return single match weight directly', () => {
      const result = aggregateConfidence([
        { pattern: 'class:price', weight: 0.9 },
      ]);
      expect(result.confidence).toBe(0.9);
      expect(result.matchedPatterns).toEqual(['class:price']);
    });

    it('should combine multiple matches using probability union', () => {
      // P(A ∪ B) = P(A) + P(B) - P(A) * P(B)
      // 0.8 + 0.6 - (0.8 * 0.6) = 0.8 + 0.6 - 0.48 = 0.92
      const result = aggregateConfidence([
        { pattern: 'class:price', weight: 0.8 },
        { pattern: 'attr:data-price', weight: 0.6 },
      ]);
      expect(result.confidence).toBeCloseTo(0.92, 2);
      expect(result.matchedPatterns).toContain('class:price');
      expect(result.matchedPatterns).toContain('attr:data-price');
    });

    it('should never exceed 1.0 confidence', () => {
      const result = aggregateConfidence([
        { pattern: 'class:price', weight: 0.99 },
        { pattern: 'attr:data-price', weight: 0.99 },
        { pattern: 'attr:itemprop', weight: 0.99 },
        { pattern: 'text:currency', weight: 0.99 },
      ]);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should clamp individual weights to 0-1 range', () => {
      const result = aggregateConfidence([
        { pattern: 'negative', weight: -0.5 },
      ]);
      expect(result.confidence).toBe(0);

      const result2 = aggregateConfidence([
        { pattern: 'overweight', weight: 1.5 },
      ]);
      expect(result2.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('edge cases', () => {
    it('should handle zero weight matches', () => {
      const result = aggregateConfidence([
        { pattern: 'class:unknown', weight: 0 },
      ]);
      expect(result.confidence).toBe(0);
    });

    it('should handle max weight (1.0)', () => {
      const result = aggregateConfidence([
        { pattern: 'perfect-match', weight: 1.0 },
      ]);
      expect(result.confidence).toBe(1.0);
    });

    it('should be deterministic for same inputs', () => {
      const matches = [
        { pattern: 'a', weight: 0.5 },
        { pattern: 'b', weight: 0.7 },
      ];
      const result1 = aggregateConfidence(matches);
      const result2 = aggregateConfidence(matches);
      expect(result1.confidence).toBe(result2.confidence);
      expect(result1.matchedPatterns).toEqual(result2.matchedPatterns);
    });
  });
});

describe('matchElementPatterns', () => {
  it('should match tag patterns', () => {
    const results = matchElementPatterns({
      tagName: 'button',
      classes: '',
      id: '',
      role: '',
      text: '',
      attributes: {},
    });
    expect(results.cta.confidence).toBeGreaterThan(0);
  });

  it('should match class patterns for price elements', () => {
    const results = matchElementPatterns({
      tagName: 'span',
      classes: 'product-price sale-price',
      id: '',
      role: '',
      text: '£120.00',
      attributes: {},
    });
    expect(results.price.confidence).toBeGreaterThan(0.7);
    expect(results.price.matchedPatterns.length).toBeGreaterThan(1);
  });

  it('should match attribute patterns', () => {
    const results = matchElementPatterns({
      tagName: 'span',
      classes: '',
      id: '',
      role: '',
      text: '100',
      attributes: { itemprop: 'price' },
    });
    expect(results.price.confidence).toBeGreaterThan(0);
  });

  it('should match role patterns for variants', () => {
    const results = matchElementPatterns({
      tagName: 'div',
      classes: '',
      id: '',
      role: 'radiogroup',
      text: '',
      attributes: {},
    });
    expect(results.variant.confidence).toBeGreaterThan(0);
  });

  it('should match text patterns for trust signals', () => {
    const results = matchElementPatterns({
      tagName: 'div',
      classes: '',
      id: '',
      role: '',
      text: 'Trusted by over 10,000 customers',
      attributes: {},
    });
    expect(results.trust.confidence).toBeGreaterThan(0);
  });

  it('should match text patterns for stock availability', () => {
    const results = matchElementPatterns({
      tagName: 'span',
      classes: '',
      id: '',
      role: '',
      text: 'In Stock',
      attributes: {},
    });
    expect(results.stock.confidence).toBeGreaterThan(0);
  });

  it('should return zero confidence for non-matching elements', () => {
    const results = matchElementPatterns({
      tagName: 'div',
      classes: 'random-class',
      id: '',
      role: '',
      text: 'hello world',
      attributes: {},
    });
    // Most categories should have very low confidence
    expect(results.price.confidence).toBe(0);
  });
});

describe('getBestCROMatch', () => {
  it('should return null when no matches meet threshold', () => {
    const results = {
      cta: { confidence: 0.3, matchedPatterns: ['tag:a'] },
      form: { confidence: 0.2, matchedPatterns: [] },
      trust: { confidence: 0.1, matchedPatterns: [] },
      value_prop: { confidence: 0, matchedPatterns: [] },
      navigation: { confidence: 0, matchedPatterns: [] },
      price: { confidence: 0, matchedPatterns: [] },
      variant: { confidence: 0, matchedPatterns: [] },
      stock: { confidence: 0, matchedPatterns: [] },
      shipping: { confidence: 0, matchedPatterns: [] },
      gallery: { confidence: 0, matchedPatterns: [] },
    };
    const best = getBestCROMatch(results, 0.5);
    expect(best).toBeNull();
  });

  it('should return highest confidence match above threshold', () => {
    const results = {
      cta: { confidence: 0.3, matchedPatterns: ['tag:button'] },
      form: { confidence: 0.2, matchedPatterns: [] },
      trust: { confidence: 0.1, matchedPatterns: [] },
      value_prop: { confidence: 0, matchedPatterns: [] },
      navigation: { confidence: 0, matchedPatterns: [] },
      price: { confidence: 0.85, matchedPatterns: ['class:price', 'attr:itemprop'] },
      variant: { confidence: 0.6, matchedPatterns: ['class:swatch'] },
      stock: { confidence: 0, matchedPatterns: [] },
      shipping: { confidence: 0, matchedPatterns: [] },
      gallery: { confidence: 0, matchedPatterns: [] },
    };
    const best = getBestCROMatch(results, 0.5);
    expect(best).not.toBeNull();
    expect(best!.type).toBe('price');
    expect(best!.confidence).toBe(0.85);
    expect(best!.matchedPatterns).toContain('class:price');
  });

  it('should use default threshold of 0.5', () => {
    const results = {
      cta: { confidence: 0.6, matchedPatterns: ['tag:button'] },
      form: { confidence: 0.4, matchedPatterns: [] },
      trust: { confidence: 0, matchedPatterns: [] },
      value_prop: { confidence: 0, matchedPatterns: [] },
      navigation: { confidence: 0, matchedPatterns: [] },
      price: { confidence: 0, matchedPatterns: [] },
      variant: { confidence: 0, matchedPatterns: [] },
      stock: { confidence: 0, matchedPatterns: [] },
      shipping: { confidence: 0, matchedPatterns: [] },
      gallery: { confidence: 0, matchedPatterns: [] },
    };
    const best = getBestCROMatch(results);
    expect(best).not.toBeNull();
    expect(best!.type).toBe('cta');
  });
});
