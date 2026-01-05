/**
 * Heuristic Engine Tests - Phase 18b (T106a)
 *
 * Tests for HeuristicEngine class (10 tests as per spec)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  HeuristicEngine,
  type HeuristicRule,
} from '../../src/heuristics/index.js';
import type { PageState, CROInsight, BusinessType } from '../../src/models/index.js';

// Helper to create a mock PageState
function createMockPageState(overrides: Partial<PageState> = {}): PageState {
  return {
    url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
    title: 'Test Page',
    domTree: {
      root: {
        tagName: 'body',
        xpath: '/html/body',
        text: '',
        isInteractive: false,
        isVisible: true,
        croType: null,
        children: [],
      },
      interactiveCount: 0,
      croElementCount: 0,
      totalNodeCount: 1,
      extractedAt: Date.now(),
    },
    viewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      isMobile: false,
    },
    scrollPosition: {
      x: 0,
      y: 0,
      maxX: 0,
      maxY: 1000,
    },
    timestamp: Date.now(),
    ...overrides,
  };
}

// Helper to create a mock HeuristicRule
function createMockRule(
  id: string,
  options: {
    businessTypes?: BusinessType[];
    category?: HeuristicRule['category'];
    shouldFail?: boolean;
    throwError?: boolean;
  } = {}
): HeuristicRule {
  const { businessTypes = [], category = 'cta', shouldFail = false, throwError = false } = options;

  return {
    id,
    name: `Test Rule ${id}`,
    description: `Test rule description for ${id}`,
    category,
    severity: 'medium',
    businessTypes,
    check: (_state: PageState, _bizType: BusinessType): CROInsight | null => {
      if (throwError) {
        throw new Error(`Rule ${id} error`);
      }
      if (shouldFail) {
        return {
          id: `insight-${id}`,
          category,
          type: `test_issue_${id}`,
          severity: 'medium',
          element: '/html/body/div',
          issue: `Test issue from rule ${id}`,
          recommendation: `Fix the issue found by rule ${id}`,
        };
      }
      return null;
    },
  };
}

describe('HeuristicEngine', () => {
  let engine: HeuristicEngine;

  beforeEach(() => {
    // Use new HeuristicEngine() directly to get empty engine for testing
    engine = new HeuristicEngine();
  });

  describe('register', () => {
    it('should register a rule successfully', () => {
      const rule = createMockRule('H001');

      engine.register(rule);

      expect(engine.getRule('H001')).toBe(rule);
      expect(engine.getRuleCount()).toBe(1);
    });

    it('should throw error for duplicate rule ID', () => {
      const rule1 = createMockRule('H001');
      const rule2 = createMockRule('H001');

      engine.register(rule1);

      expect(() => engine.register(rule2)).toThrow('Rule already registered: H001');
    });
  });

  describe('registerAll', () => {
    it('should register multiple rules at once', () => {
      const rules = [createMockRule('H001'), createMockRule('H002'), createMockRule('H003')];

      engine.registerAll(rules);

      expect(engine.getRuleCount()).toBe(3);
      expect(engine.getRule('H001')).toBeDefined();
      expect(engine.getRule('H002')).toBeDefined();
      expect(engine.getRule('H003')).toBeDefined();
    });
  });

  describe('run', () => {
    it('should run all rules and collect insights', () => {
      const rules = [
        createMockRule('H001', { shouldFail: true }),
        createMockRule('H002', { shouldFail: false }),
        createMockRule('H003', { shouldFail: true }),
      ];
      engine.registerAll(rules);

      const state = createMockPageState();
      const result = engine.run(state, 'ecommerce');

      expect(result.rulesExecuted).toBe(3);
      expect(result.rulesPassed).toBe(1);
      expect(result.rulesFailed).toBe(2);
      expect(result.insights).toHaveLength(2);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should filter rules by business type', () => {
      const rules = [
        createMockRule('H001', { businessTypes: ['ecommerce'], shouldFail: true }),
        createMockRule('H002', { businessTypes: ['saas'], shouldFail: true }),
        createMockRule('H003', { businessTypes: [], shouldFail: true }), // applies to all
      ];
      engine.registerAll(rules);

      const state = createMockPageState();
      const result = engine.run(state, 'ecommerce');

      // H001 and H003 should run (ecommerce + all), H002 skipped (saas only)
      expect(result.rulesExecuted).toBe(2);
      expect(result.insights).toHaveLength(2);
    });

    it('should return empty result when no rules registered', () => {
      const state = createMockPageState();
      const result = engine.run(state, 'other');

      expect(result.rulesExecuted).toBe(0);
      expect(result.rulesPassed).toBe(0);
      expect(result.rulesFailed).toBe(0);
      expect(result.insights).toHaveLength(0);
    });

    it('should handle rule execution errors gracefully', () => {
      const rules = [
        createMockRule('H001', { shouldFail: true }),
        createMockRule('H002', { throwError: true }),
        createMockRule('H003', { shouldFail: false }),
      ];
      engine.registerAll(rules);

      const state = createMockPageState();
      const result = engine.run(state, 'other');

      // H002 throws but shouldn't crash, counted as failed
      expect(result.rulesExecuted).toBe(3);
      expect(result.rulesPassed).toBe(1);
      expect(result.rulesFailed).toBe(2);
      expect(result.insights).toHaveLength(1); // Only H001's insight
    });

    it('should filter by categories when option provided', () => {
      const rules = [
        createMockRule('H001', { category: 'cta', shouldFail: true }),
        createMockRule('H002', { category: 'form', shouldFail: true }),
        createMockRule('H003', { category: 'trust', shouldFail: true }),
      ];
      engine.registerAll(rules);

      const state = createMockPageState();
      const result = engine.run(state, 'other', { categories: ['cta', 'form'] });

      expect(result.rulesExecuted).toBe(2);
      expect(result.insights).toHaveLength(2);
    });

    it('should filter by rule IDs when option provided', () => {
      const rules = [
        createMockRule('H001', { shouldFail: true }),
        createMockRule('H002', { shouldFail: true }),
        createMockRule('H003', { shouldFail: true }),
      ];
      engine.registerAll(rules);

      const state = createMockPageState();
      const result = engine.run(state, 'other', { ruleIds: ['H001', 'H003'] });

      expect(result.rulesExecuted).toBe(2);
      expect(result.insights).toHaveLength(2);
    });
  });

  describe('getAllRules', () => {
    it('should return all registered rules', () => {
      const rules = [createMockRule('H001'), createMockRule('H002')];
      engine.registerAll(rules);

      const allRules = engine.getAllRules();

      expect(allRules).toHaveLength(2);
      expect(allRules.map((r) => r.id)).toEqual(['H001', 'H002']);
    });
  });

  describe('clear', () => {
    it('should clear all registered rules', () => {
      const rules = [createMockRule('H001'), createMockRule('H002')];
      engine.registerAll(rules);

      expect(engine.getRuleCount()).toBe(2);

      engine.clear();

      expect(engine.getRuleCount()).toBe(0);
      expect(engine.getRule('H001')).toBeUndefined();
    });
  });
});
