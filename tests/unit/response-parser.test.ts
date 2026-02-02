/**
 * Response Parser Unit Tests - Phase 21i (T373)
 *
 * Tests for element reference extraction and ParsedEvaluation creation.
 */

import { describe, it, expect } from 'vitest';
import {
  extractElementReferences,
  parseEvaluationWithElements,
  parseEvaluationsWithElements,
} from '../../src/heuristics/vision/response-parser.js';
import type { HeuristicEvaluation } from '../../src/heuristics/vision/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// extractElementReferences Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('extractElementReferences', () => {
  describe('basic extraction', () => {
    // Test 1
    it('should extract single element reference', () => {
      const text = 'Element [5] shows the price clearly';
      const indices = extractElementReferences(text);
      expect(indices).toEqual([5]);
    });

    // Test 2
    it('should extract multiple element references', () => {
      const text = 'Elements [0], [3], and [7] are CTAs';
      const indices = extractElementReferences(text);
      expect(indices).toEqual([0, 3, 7]);
    });

    // Test 3
    it('should handle references without "Element" prefix', () => {
      const text = '[0] is the main CTA, while [5] is secondary';
      const indices = extractElementReferences(text);
      expect(indices).toEqual([0, 5]);
    });

    // Test 4
    it('should return sorted unique indices', () => {
      const text = '[5] is mentioned, then [0], then [5] again';
      const indices = extractElementReferences(text);
      expect(indices).toEqual([0, 5]);
    });
  });

  describe('edge cases', () => {
    // Test 5
    it('should return empty array for empty string', () => {
      const indices = extractElementReferences('');
      expect(indices).toEqual([]);
    });

    // Test 6
    it('should return empty array when no references found', () => {
      const text = 'This text has no element references';
      const indices = extractElementReferences(text);
      expect(indices).toEqual([]);
    });

    // Test 7
    it('should handle large index numbers', () => {
      const text = 'Element [123] and [456] are far down the page';
      const indices = extractElementReferences(text);
      expect(indices).toEqual([123, 456]);
    });

    // Test 8
    it('should ignore negative numbers in brackets', () => {
      // This tests the regex pattern doesn't match negative numbers
      const text = 'Temperature is [-5] degrees, element [3] is visible';
      const indices = extractElementReferences(text);
      expect(indices).toEqual([3]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// parseEvaluationWithElements Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('parseEvaluationWithElements', () => {
  const createMockEvaluation = (overrides?: Partial<HeuristicEvaluation>): HeuristicEvaluation => ({
    heuristicId: 'PDP-CTA-001',
    principle: 'CTA should be prominent',
    status: 'fail',
    severity: 'critical',
    observation: 'The CTA button is hard to find',
    confidence: 0.9,
    ...overrides,
  });

  // Test 1
  it('should extract element references from observation', () => {
    const evaluation = createMockEvaluation({
      observation: 'Element [5] has poor contrast and [3] is too small',
    });

    const parsed = parseEvaluationWithElements(evaluation);

    expect(parsed.relatedElements).toEqual([3, 5]);
  });

  // Test 2
  it('should extract element references from issue field', () => {
    const evaluation = createMockEvaluation({
      observation: 'The page has issues',
      issue: 'CTA button [0] is not prominent enough',
    });

    const parsed = parseEvaluationWithElements(evaluation);

    expect(parsed.relatedElements).toEqual([0]);
  });

  // Test 3
  it('should extract element references from recommendation field', () => {
    const evaluation = createMockEvaluation({
      observation: 'Issues detected',
      issue: 'Low visibility',
      recommendation: 'Make [2] larger and move [7] above the fold',
    });

    const parsed = parseEvaluationWithElements(evaluation);

    expect(parsed.relatedElements).toEqual([2, 7]);
  });

  // Test 4
  it('should combine references from all text fields', () => {
    const evaluation = createMockEvaluation({
      observation: 'Element [1] is the main CTA',
      issue: 'Button [3] has poor contrast',
      recommendation: 'Fix [1] and [5] for better UX',
    });

    const parsed = parseEvaluationWithElements(evaluation);

    expect(parsed.relatedElements).toEqual([1, 3, 5]);
  });

  // Test 5
  it('should return empty array when no references found', () => {
    const evaluation = createMockEvaluation({
      observation: 'The page has good CTAs overall',
    });

    const parsed = parseEvaluationWithElements(evaluation);

    expect(parsed.relatedElements).toEqual([]);
  });

  // Test 6
  it('should preserve all original evaluation fields', () => {
    const evaluation = createMockEvaluation({
      observation: 'Element [0] is visible',
      viewportIndex: 2,
      timestamp: 1234567890,
    });

    const parsed = parseEvaluationWithElements(evaluation);

    expect(parsed.heuristicId).toBe('PDP-CTA-001');
    expect(parsed.principle).toBe('CTA should be prominent');
    expect(parsed.status).toBe('fail');
    expect(parsed.severity).toBe('critical');
    expect(parsed.viewportIndex).toBe(2);
    expect(parsed.timestamp).toBe(1234567890);
    expect(parsed.relatedElements).toEqual([0]);
  });

  // Test 7
  it('should handle undefined optional fields', () => {
    const evaluation = createMockEvaluation({
      observation: 'All good',
      issue: undefined,
      recommendation: undefined,
    });

    const parsed = parseEvaluationWithElements(evaluation);

    expect(parsed.relatedElements).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// parseEvaluationsWithElements Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('parseEvaluationsWithElements', () => {
  // Test 1
  it('should parse multiple evaluations', () => {
    const evaluations: HeuristicEvaluation[] = [
      {
        heuristicId: 'PDP-CTA-001',
        principle: 'CTA visible',
        status: 'fail',
        severity: 'critical',
        observation: 'Element [0] is too small',
        confidence: 0.9,
      },
      {
        heuristicId: 'PDP-PRICE-001',
        principle: 'Price visible',
        status: 'pass',
        severity: 'high',
        observation: 'Price [3] is clearly displayed',
        confidence: 0.95,
      },
    ];

    const parsed = parseEvaluationsWithElements(evaluations);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].relatedElements).toEqual([0]);
    expect(parsed[1].relatedElements).toEqual([3]);
  });

  // Test 2
  it('should handle empty array', () => {
    const parsed = parseEvaluationsWithElements([]);
    expect(parsed).toEqual([]);
  });
});
