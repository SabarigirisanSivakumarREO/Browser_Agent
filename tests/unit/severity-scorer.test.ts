/**
 * Severity Scorer Tests - Phase 18b (T106c)
 *
 * Tests for SeverityScorer class (4 tests as per spec)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SeverityScorer, createSeverityScorer } from '../../src/heuristics/index.js';
import type { CROInsight, Severity } from '../../src/models/index.js';

// Helper to create a mock CROInsight
function createMockInsight(overrides: Partial<CROInsight> = {}): CROInsight {
  return {
    id: 'test-insight-1',
    category: 'cta',
    type: 'generic_cta',
    severity: 'medium',
    element: '/html/body/button',
    issue: 'Generic CTA text found on the page',
    recommendation: 'Use more specific action-oriented text',
    ...overrides,
  };
}

describe('SeverityScorer', () => {
  let scorer: SeverityScorer;

  beforeEach(() => {
    scorer = createSeverityScorer();
  });

  describe('adjustSeverity', () => {
    it('should boost ecommerce-related issues for ecommerce sites', () => {
      const insights: CROInsight[] = [
        createMockInsight({
          id: '1',
          type: 'cart_visibility',
          severity: 'medium',
          issue: 'Cart icon is not visible above the fold',
        }),
        createMockInsight({
          id: '2',
          type: 'checkout_friction',
          severity: 'low',
          issue: 'Checkout process has unnecessary steps',
        }),
      ];

      const adjusted = scorer.adjustSeverity(insights, 'ecommerce');

      // Cart and checkout are critical for ecommerce, should be boosted
      expect(adjusted[0].severity).toBe('critical'); // medium + 2 boost
      expect(adjusted[1].severity).toBe('high'); // low + 2 boost
    });

    it('should boost saas-related issues for saas sites', () => {
      const insights: CROInsight[] = [
        createMockInsight({
          id: '1',
          type: 'pricing_clarity',
          severity: 'low',
          issue: 'Pricing is not clear on the page',
        }),
        createMockInsight({
          id: '2',
          type: 'trial_visibility',
          severity: 'medium',
          issue: 'Free trial option is hard to find',
        }),
      ];

      const adjusted = scorer.adjustSeverity(insights, 'saas');

      // Pricing and trial are critical for SaaS
      expect(adjusted[0].severity).toBe('high'); // low + 2 boost
      expect(adjusted[1].severity).toBe('critical'); // medium + 2 boost
    });

    it('should not change severity for "other" business type', () => {
      const insights: CROInsight[] = [
        createMockInsight({
          id: '1',
          type: 'cart_visibility',
          severity: 'medium',
          issue: 'Cart icon is not visible',
        }),
        createMockInsight({
          id: '2',
          type: 'generic_issue',
          severity: 'low',
          issue: 'Some generic issue found',
        }),
      ];

      const adjusted = scorer.adjustSeverity(insights, 'other');

      // 'other' has no boosts defined
      expect(adjusted[0].severity).toBe('medium');
      expect(adjusted[1].severity).toBe('low');
    });

    it('should cap severity at critical (no higher)', () => {
      const insights: CROInsight[] = [
        createMockInsight({
          id: '1',
          type: 'payment_security',
          severity: 'high', // Already high, +2 boost should cap at critical
          issue: 'Payment security badge missing',
        }),
      ];

      const adjusted = scorer.adjustSeverity(insights, 'ecommerce');

      // high + 2 = critical (capped, not "super-critical")
      expect(adjusted[0].severity).toBe('critical');
    });
  });

  describe('utility methods', () => {
    it('should compare severities correctly', () => {
      expect(scorer.compareSeverity('critical', 'high')).toBeGreaterThan(0);
      expect(scorer.compareSeverity('low', 'medium')).toBeLessThan(0);
      expect(scorer.compareSeverity('high', 'high')).toBe(0);
    });

    it('should return max severity correctly', () => {
      expect(scorer.maxSeverity('low', 'high')).toBe('high');
      expect(scorer.maxSeverity('critical', 'medium')).toBe('critical');
      expect(scorer.maxSeverity('medium', 'medium')).toBe('medium');
    });

    it('should return severity order correctly', () => {
      expect(scorer.getSeverityOrder('low')).toBe(1);
      expect(scorer.getSeverityOrder('medium')).toBe(2);
      expect(scorer.getSeverityOrder('high')).toBe(3);
      expect(scorer.getSeverityOrder('critical')).toBe(4);
    });
  });
});
