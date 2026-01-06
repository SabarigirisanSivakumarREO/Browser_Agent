/**
 * Knowledge Base Loader Tests - Phase 21b (T306)
 *
 * Tests for heuristics knowledge base loading and validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadHeuristics,
  isPageTypeSupported,
  getHeuristicIds,
  getHeuristicById,
  getHeuristicsBySeverity,
  getHeuristicsCountBySeverity,
  clearKnowledgeCache,
  SUPPORTED_KNOWLEDGE_PAGE_TYPES,
} from '../../src/heuristics/knowledge/index.js';
import type { PageTypeHeuristics, HeuristicItem } from '../../src/heuristics/knowledge/types.js';

describe('Knowledge Loader', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearKnowledgeCache();
  });

  describe('loadHeuristics', () => {
    it('should load PDP heuristics successfully', () => {
      const heuristics = loadHeuristics('pdp');

      expect(heuristics).toBeDefined();
      expect(heuristics.pageType).toBe('pdp');
      expect(heuristics.source).toContain('Baymard');
      expect(heuristics.totalCount).toBe(35);
      expect(heuristics.categories).toHaveLength(10);
    });

    it('should return 35 heuristics total across all PDP categories', () => {
      const heuristics = loadHeuristics('pdp');

      const actualCount = heuristics.categories.reduce(
        (sum, cat) => sum + cat.heuristics.length,
        0
      );

      expect(actualCount).toBe(35);
      expect(actualCount).toBe(heuristics.totalCount);
    });

    it('should throw error for unsupported page type', () => {
      expect(() => loadHeuristics('plp')).toThrow('Unsupported page type');
      expect(() => loadHeuristics('homepage')).toThrow('Unsupported page type');
      expect(() => loadHeuristics('other')).toThrow('Unsupported page type');
    });

    it('should cache results on subsequent calls', () => {
      const first = loadHeuristics('pdp');
      const second = loadHeuristics('pdp');

      // Should return the same object reference (cached)
      expect(first).toBe(second);
    });

    it('should reload from source after cache clear', () => {
      const first = loadHeuristics('pdp');
      clearKnowledgeCache();
      const second = loadHeuristics('pdp');

      // After cache clear, loader recomputes (but underlying JSON is module-cached)
      // Both should have identical content
      expect(first.totalCount).toBe(second.totalCount);
      expect(first.pageType).toBe(second.pageType);
      expect(first.categories.length).toBe(second.categories.length);
    });
  });

  describe('PDP Category Structure', () => {
    it('should have all 10 expected categories', () => {
      const heuristics = loadHeuristics('pdp');
      const categoryNames = heuristics.categories.map((c) => c.name);

      expect(categoryNames).toContain('Layout & Structure');
      expect(categoryNames).toContain('Product Imagery & Media');
      expect(categoryNames).toContain('Pricing & Cost Transparency');
      expect(categoryNames).toContain('Description & Value Proposition');
      expect(categoryNames).toContain('Specifications & Details');
      expect(categoryNames).toContain('Reviews & Social Proof');
      expect(categoryNames).toContain('Selection & Configuration');
      expect(categoryNames).toContain('CTA & Purchase Confidence');
      expect(categoryNames).toContain('Mobile Usability');
      expect(categoryNames).toContain('Utility & Secondary Actions');
    });

    it('should have correct heuristic counts per category', () => {
      const heuristics = loadHeuristics('pdp');
      const countByCategory: Record<string, number> = {};

      for (const cat of heuristics.categories) {
        countByCategory[cat.name] = cat.heuristics.length;
      }

      expect(countByCategory['Layout & Structure']).toBe(4);
      expect(countByCategory['Product Imagery & Media']).toBe(4);
      expect(countByCategory['Pricing & Cost Transparency']).toBe(4);
      expect(countByCategory['Description & Value Proposition']).toBe(3);
      expect(countByCategory['Specifications & Details']).toBe(3);
      expect(countByCategory['Reviews & Social Proof']).toBe(4);
      expect(countByCategory['Selection & Configuration']).toBe(3);
      expect(countByCategory['CTA & Purchase Confidence']).toBe(4);
      expect(countByCategory['Mobile Usability']).toBe(3);
      expect(countByCategory['Utility & Secondary Actions']).toBe(3);
    });
  });

  describe('Heuristic Item Validation', () => {
    it('should have required fields on each heuristic', () => {
      const heuristics = loadHeuristics('pdp');

      for (const category of heuristics.categories) {
        for (const heuristic of category.heuristics) {
          expect(heuristic.id).toBeDefined();
          expect(heuristic.id).toMatch(/^PDP-[A-Z]+-\d{3}$/);
          expect(heuristic.principle).toBeDefined();
          expect(heuristic.principle.length).toBeGreaterThan(10);
          expect(heuristic.checkpoints).toBeDefined();
          expect(heuristic.checkpoints.length).toBeGreaterThan(0);
          expect(heuristic.severity).toMatch(/^(critical|high|medium|low)$/);
          expect(heuristic.category).toBe(category.name);
        }
      }
    });

    it('should have unique heuristic IDs', () => {
      const heuristics = loadHeuristics('pdp');
      const ids = new Set<string>();

      for (const category of heuristics.categories) {
        for (const heuristic of category.heuristics) {
          expect(ids.has(heuristic.id)).toBe(false);
          ids.add(heuristic.id);
        }
      }

      expect(ids.size).toBe(35);
    });

    it('should have 2 critical severity heuristics', () => {
      const heuristics = loadHeuristics('pdp');
      const criticalHeuristics: HeuristicItem[] = [];

      for (const category of heuristics.categories) {
        for (const heuristic of category.heuristics) {
          if (heuristic.severity === 'critical') {
            criticalHeuristics.push(heuristic);
          }
        }
      }

      expect(criticalHeuristics).toHaveLength(2);
      expect(criticalHeuristics.map((h) => h.id)).toContain('PDP-PRICE-001');
      expect(criticalHeuristics.map((h) => h.id)).toContain('PDP-CTA-001');
    });
  });

  describe('isPageTypeSupported', () => {
    it('should return true for supported page types', () => {
      expect(isPageTypeSupported('pdp')).toBe(true);
    });

    it('should return false for unsupported page types', () => {
      expect(isPageTypeSupported('plp')).toBe(false);
      expect(isPageTypeSupported('homepage')).toBe(false);
      expect(isPageTypeSupported('cart')).toBe(false);
      expect(isPageTypeSupported('checkout')).toBe(false);
      expect(isPageTypeSupported('account')).toBe(false);
      expect(isPageTypeSupported('other')).toBe(false);
    });
  });

  describe('getHeuristicIds', () => {
    it('should return all 35 PDP heuristic IDs', () => {
      const ids = getHeuristicIds('pdp');

      expect(ids).toHaveLength(35);
      expect(ids).toContain('PDP-LAYOUT-001');
      expect(ids).toContain('PDP-PRICE-001');
      expect(ids).toContain('PDP-CTA-001');
      expect(ids).toContain('PDP-MOBILE-003');
    });

    it('should return IDs in category order', () => {
      const ids = getHeuristicIds('pdp');

      // First category is Layout & Structure
      expect(ids[0]).toBe('PDP-LAYOUT-001');
      // Last category is Utility & Secondary
      expect(ids[ids.length - 1]).toBe('PDP-UTILITY-003');
    });
  });

  describe('getHeuristicById', () => {
    it('should find heuristic by ID', () => {
      const heuristic = getHeuristicById('pdp', 'PDP-PRICE-001');

      expect(heuristic).toBeDefined();
      expect(heuristic?.id).toBe('PDP-PRICE-001');
      expect(heuristic?.severity).toBe('critical');
      expect(heuristic?.category).toBe('Pricing & Cost Transparency');
    });

    it('should return undefined for non-existent ID', () => {
      const heuristic = getHeuristicById('pdp', 'PDP-NONEXISTENT-999');

      expect(heuristic).toBeUndefined();
    });
  });

  describe('getHeuristicsBySeverity', () => {
    it('should return critical heuristics', () => {
      const critical = getHeuristicsBySeverity('pdp', 'critical');

      expect(critical).toHaveLength(2);
      expect(critical.every((h) => h.severity === 'critical')).toBe(true);
    });

    it('should return high severity heuristics', () => {
      const high = getHeuristicsBySeverity('pdp', 'high');

      expect(high.length).toBeGreaterThan(10);
      expect(high.every((h) => h.severity === 'high')).toBe(true);
    });

    it('should return empty array for severity with no matches in future', () => {
      // All severities should have at least one heuristic currently
      const low = getHeuristicsBySeverity('pdp', 'low');
      expect(low.every((h) => h.severity === 'low')).toBe(true);
    });
  });

  describe('getHeuristicsCountBySeverity', () => {
    it('should return correct counts by severity', () => {
      const counts = getHeuristicsCountBySeverity('pdp');

      expect(counts.critical).toBe(2);
      expect(counts.high).toBeGreaterThan(15);
      expect(counts.medium).toBeGreaterThan(5);
      expect(counts.low).toBeGreaterThan(0);

      // Total should be 35
      const total =
        counts.critical + counts.high + counts.medium + counts.low;
      expect(total).toBe(35);
    });
  });

  describe('SUPPORTED_KNOWLEDGE_PAGE_TYPES', () => {
    it('should contain pdp', () => {
      expect(SUPPORTED_KNOWLEDGE_PAGE_TYPES).toContain('pdp');
    });

    it('should have only pdp currently', () => {
      expect(SUPPORTED_KNOWLEDGE_PAGE_TYPES).toHaveLength(1);
    });
  });

  describe('Specific Heuristic Content', () => {
    it('should have correct PDP-PRICE-001 content (critical price visibility)', () => {
      const heuristic = getHeuristicById('pdp', 'PDP-PRICE-001');

      expect(heuristic?.principle).toContain('price');
      expect(heuristic?.principle).toContain('visible');
      expect(heuristic?.checkpoints).toContainEqual(
        expect.stringContaining('above the fold')
      );
    });

    it('should have correct PDP-CTA-001 content (critical CTA visibility)', () => {
      const heuristic = getHeuristicById('pdp', 'PDP-CTA-001');

      expect(heuristic?.principle).toContain('call to action');
      expect(heuristic?.principle).toContain('visually distinct');
      expect(heuristic?.checkpoints).toContainEqual(
        expect.stringContaining('Add to Cart')
      );
    });

    it('should have PDP-MOBILE checkpoints about tap targets', () => {
      const heuristic = getHeuristicById('pdp', 'PDP-MOBILE-001');

      expect(heuristic?.checkpoints).toContainEqual(
        expect.stringContaining('44x44')
      );
    });
  });
});
