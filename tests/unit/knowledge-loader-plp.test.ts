/**
 * PLP Knowledge Base Loader Tests - Phase 22A
 *
 * Tests for PLP heuristics knowledge base loading and validation.
 * 25 heuristics across 6 categories.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadHeuristics,
  getHeuristicIds,
  getHeuristicById,
  getHeuristicsBySeverity,
  getHeuristicsCountBySeverity,
  clearKnowledgeCache,
} from '../../src/heuristics/knowledge/index.js';
import type { HeuristicItem } from '../../src/heuristics/knowledge/types.js';

describe('PLP Knowledge Base', () => {
  beforeEach(() => {
    clearKnowledgeCache();
  });

  describe('loadHeuristics("plp")', () => {
    it('should load PLP heuristics successfully', () => {
      const heuristics = loadHeuristics('plp');

      expect(heuristics).toBeDefined();
      expect(heuristics.pageType).toBe('plp');
      expect(heuristics.source).toBeDefined();
      expect(heuristics.lastUpdated).toBeDefined();
    });

    it('should have 6 categories', () => {
      const heuristics = loadHeuristics('plp');
      expect(heuristics.categories).toHaveLength(6);
    });

    it('should have 25 heuristics total', () => {
      const heuristics = loadHeuristics('plp');

      const actualCount = heuristics.categories.reduce(
        (sum, cat) => sum + cat.heuristics.length,
        0
      );

      expect(actualCount).toBe(25);
      expect(actualCount).toBe(heuristics.totalCount);
    });
  });

  describe('PLP Category Structure', () => {
    it('should have all 6 expected categories', () => {
      const heuristics = loadHeuristics('plp');
      const categoryNames = heuristics.categories.map((c) => c.name);

      expect(categoryNames).toContain('Layout & Grid');
      expect(categoryNames).toContain('Filtering & Sorting');
      expect(categoryNames).toContain('Product Cards');
      expect(categoryNames).toContain('Pagination & Loading');
      expect(categoryNames).toContain('Navigation & Breadcrumbs');
      expect(categoryNames).toContain('Mobile Usability');
    });

    it('should have correct heuristic counts per category', () => {
      const heuristics = loadHeuristics('plp');
      const countByCategory: Record<string, number> = {};

      for (const cat of heuristics.categories) {
        countByCategory[cat.name] = cat.heuristics.length;
      }

      expect(countByCategory['Layout & Grid']).toBe(5);
      expect(countByCategory['Filtering & Sorting']).toBe(5);
      expect(countByCategory['Product Cards']).toBe(5);
      expect(countByCategory['Pagination & Loading']).toBe(4);
      expect(countByCategory['Navigation & Breadcrumbs']).toBe(3);
      expect(countByCategory['Mobile Usability']).toBe(3);
    });
  });

  describe('Heuristic Item Validation', () => {
    it('should have required fields on each heuristic', () => {
      const heuristics = loadHeuristics('plp');

      for (const category of heuristics.categories) {
        for (const heuristic of category.heuristics) {
          expect(heuristic.id).toBeDefined();
          expect(heuristic.id).toMatch(/^PLP-[A-Z]+-\d{3}$/);
          expect(heuristic.principle).toBeDefined();
          expect(heuristic.principle.length).toBeGreaterThan(10);
          expect(heuristic.checkpoints).toBeDefined();
          expect(heuristic.checkpoints).toHaveLength(4);
          expect(heuristic.severity).toMatch(/^(critical|high|medium|low)$/);
          expect(heuristic.category).toBe(category.name);
        }
      }
    });

    it('should have unique heuristic IDs', () => {
      const heuristics = loadHeuristics('plp');
      const ids = new Set<string>();

      for (const category of heuristics.categories) {
        for (const heuristic of category.heuristics) {
          expect(ids.has(heuristic.id)).toBe(false);
          ids.add(heuristic.id);
        }
      }

      expect(ids.size).toBe(25);
    });
  });

  describe('Severity Distribution', () => {
    it('should have 1 critical severity heuristic (product card essentials)', () => {
      const critical = getHeuristicsBySeverity('plp', 'critical');

      expect(critical).toHaveLength(1);
      expect(critical[0].id).toBe('PLP-CARD-001');
    });

    it('should have correct severity counts', () => {
      const counts = getHeuristicsCountBySeverity('plp');

      expect(counts.critical).toBe(1);
      expect(counts.high).toBeGreaterThan(10);
      expect(counts.medium).toBeGreaterThan(5);
      expect(counts.low).toBeGreaterThan(0);

      const total = counts.critical + counts.high + counts.medium + counts.low;
      expect(total).toBe(25);
    });
  });

  describe('Heuristic Lookup', () => {
    it('should return all 25 PLP heuristic IDs', () => {
      const ids = getHeuristicIds('plp');

      expect(ids).toHaveLength(25);
      expect(ids).toContain('PLP-GRID-001');
      expect(ids).toContain('PLP-FILTER-001');
      expect(ids).toContain('PLP-CARD-001');
      expect(ids).toContain('PLP-MOBILE-003');
    });

    it('should find heuristic by ID', () => {
      const heuristic = getHeuristicById('plp', 'PLP-CARD-001');

      expect(heuristic).toBeDefined();
      expect(heuristic?.id).toBe('PLP-CARD-001');
      expect(heuristic?.severity).toBe('critical');
      expect(heuristic?.category).toBe('Product Cards');
    });

    it('should return undefined for non-existent ID', () => {
      const heuristic = getHeuristicById('plp', 'PLP-NONEXISTENT-999');
      expect(heuristic).toBeUndefined();
    });
  });

  describe('Specific Heuristic Content', () => {
    it('should have PLP-CARD-001 about essential product card info (image, name, price)', () => {
      const heuristic = getHeuristicById('plp', 'PLP-CARD-001');

      expect(heuristic?.principle).toContain('image');
      expect(heuristic?.principle).toContain('name');
      expect(heuristic?.principle).toContain('price');
    });

    it('should have PLP-FILTER-002 about active filter indicators', () => {
      const heuristic = getHeuristicById('plp', 'PLP-FILTER-002');

      expect(heuristic?.principle).toContain('filter');
      expect(heuristic?.checkpoints).toContainEqual(
        expect.stringContaining('clear all')
      );
    });

    it('should have PLP-MOBILE-002 about touch target sizing', () => {
      const heuristic = getHeuristicById('plp', 'PLP-MOBILE-002');

      expect(heuristic?.checkpoints).toContainEqual(
        expect.stringContaining('44x44')
      );
    });
  });
});
