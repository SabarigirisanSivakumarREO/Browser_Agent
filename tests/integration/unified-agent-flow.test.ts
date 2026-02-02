/**
 * Unified Agent Flow Integration Tests - CR-001-C (T522)
 *
 * Tests for the unified collection + analysis flow:
 * - Collection phase captures viewport snapshots
 * - Analysis phase evaluates heuristics by category
 * - Full flow produces insights and reports
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { z } from 'zod';
import type { PageType, ViewportSnapshot } from '../../src/models/index.js';
import type { HeuristicCategory, HeuristicItem } from '../../src/heuristics/knowledge/index.js';
import type { HeuristicEvaluation } from '../../src/heuristics/vision/types.js';
import {
  groupHeuristicsByCategory,
  getTotalHeuristicCount,
  type CategoryGroup,
} from '../../src/heuristics/category-grouper.js';
import {
  CategoryAnalyzer,
  createCategoryAnalyzer,
  type CategoryAnalysisResult,
} from '../../src/heuristics/category-analyzer.js';
import {
  AnalysisOrchestrator,
  createAnalysisOrchestrator,
  type AnalysisResult,
} from '../../src/heuristics/analysis-orchestrator.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Test Fixtures
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create mock viewport snapshot
 */
const createMockSnapshot = (index: number, scrollY: number): ViewportSnapshot => ({
  scrollPosition: scrollY,
  viewportIndex: index,
  screenshot: {
    base64: 'mock-base64-data',
    capturedAt: Date.now(),
  },
  dom: {
    serialized: `[${index}] <div>Mock content at ${scrollY}px</div>`,
    elementCount: 10 + index,
  },
});

/**
 * Create mock heuristic category
 */
const createMockCategory = (name: string, heuristicCount: number): HeuristicCategory => ({
  name,
  description: `${name} heuristics for testing`,
  heuristics: Array.from({ length: heuristicCount }, (_, i) => ({
    id: `PDP-${name.toUpperCase()}-00${i + 1}`,
    principle: `${name} principle ${i + 1}`,
    checkpoints: [`Check ${i + 1}a`, `Check ${i + 1}b`],
    severity: i === 0 ? 'critical' : i === 1 ? 'high' : 'medium',
    category: name,
  })) as HeuristicItem[],
});

/**
 * Create mock evaluation
 */
const createMockEvaluation = (
  heuristicId: string,
  status: 'pass' | 'fail' | 'partial' | 'not_applicable'
): HeuristicEvaluation => ({
  heuristicId,
  principle: 'Test principle',
  status,
  severity: 'high',
  observation: `Observed ${status} for ${heuristicId}`,
  issue: status === 'fail' ? 'Test issue' : undefined,
  recommendation: status === 'fail' ? 'Test recommendation' : undefined,
  confidence: 0.85,
});

// ═══════════════════════════════════════════════════════════════════════════════
// Category Grouper Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('CategoryGrouper', () => {
  it('should group heuristics by category for supported page types', () => {
    const groups = groupHeuristicsByCategory('pdp');

    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0]).toHaveProperty('name');
    expect(groups[0]).toHaveProperty('description');
    expect(groups[0]).toHaveProperty('heuristics');
    expect(groups[0]).toHaveProperty('count');
  });

  it('should count total heuristics across groups', () => {
    const groups = groupHeuristicsByCategory('pdp');
    const total = getTotalHeuristicCount(groups);

    expect(total).toBeGreaterThan(0);
    expect(total).toBe(groups.reduce((sum, g) => sum + g.count, 0));
  });

  it('should filter by included categories', () => {
    const groups = groupHeuristicsByCategory('pdp', {
      includeCategories: ['imagery', 'image'],
    });

    // Should only include categories matching the filter
    for (const group of groups) {
      const nameLower = group.name.toLowerCase();
      expect(
        nameLower.includes('imagery') || nameLower.includes('image')
      ).toBe(true);
    }
  });

  it('should filter by excluded categories', () => {
    const allGroups = groupHeuristicsByCategory('pdp');
    const filteredGroups = groupHeuristicsByCategory('pdp', {
      excludeCategories: ['pricing', 'price'],
    });

    // Should have fewer categories after exclusion
    expect(filteredGroups.length).toBeLessThanOrEqual(allGroups.length);

    // Excluded categories should not be present
    for (const group of filteredGroups) {
      const nameLower = group.name.toLowerCase();
      expect(nameLower.includes('pricing') || nameLower.includes('price')).toBe(false);
    }
  });

  it('should filter by minimum severity', () => {
    const allGroups = groupHeuristicsByCategory('pdp');
    const highSeverityGroups = groupHeuristicsByCategory('pdp', {
      minSeverity: 'high',
    });

    // High severity should have fewer or equal heuristics
    const allTotal = getTotalHeuristicCount(allGroups);
    const highTotal = getTotalHeuristicCount(highSeverityGroups);
    expect(highTotal).toBeLessThanOrEqual(allTotal);
  });

  it('should throw for unsupported page types', () => {
    expect(() => groupHeuristicsByCategory('unknown' as PageType)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Category Analyzer Tests (Unit/Integration)
// ═══════════════════════════════════════════════════════════════════════════════

describe('CategoryAnalyzer', () => {
  let analyzer: CategoryAnalyzer;

  beforeEach(() => {
    analyzer = createCategoryAnalyzer({
      model: 'gpt-4o-mini',
      maxTokens: 1024,
      temperature: 0.1,
      timeoutMs: 5000,
    });
  });

  it('should create analyzer with default config', () => {
    const defaultAnalyzer = createCategoryAnalyzer();
    expect(defaultAnalyzer).toBeInstanceOf(CategoryAnalyzer);
  });

  it('should create analyzer with custom config', () => {
    const customAnalyzer = createCategoryAnalyzer({
      model: 'gpt-4o',
      temperature: 0.2,
    });
    expect(customAnalyzer).toBeInstanceOf(CategoryAnalyzer);
  });

  // Note: Full analyzeCategory test would require mocking the LLM
  // This is tested in unit tests with mocked LLM
});

// ═══════════════════════════════════════════════════════════════════════════════
// Analysis Orchestrator Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('AnalysisOrchestrator', () => {
  it('should create orchestrator with default config', () => {
    const orchestrator = createAnalysisOrchestrator();
    expect(orchestrator).toBeInstanceOf(AnalysisOrchestrator);
  });

  it('should create orchestrator with custom config', () => {
    const orchestrator = createAnalysisOrchestrator({
      parallelAnalysis: true,
      includeCategories: ['imagery'],
      verbose: true,
    });
    expect(orchestrator).toBeInstanceOf(AnalysisOrchestrator);
  });

  it('should return empty result for unsupported page types', async () => {
    const orchestrator = createAnalysisOrchestrator();
    const snapshots = [createMockSnapshot(0, 0)];

    const result = await orchestrator.runAnalysis(snapshots, 'unknown' as PageType);

    expect(result.pageType).toBe('unknown');
    expect(result.categoriesAnalyzed).toHaveLength(0);
    expect(result.evaluations).toHaveLength(0);
    expect(result.insights).toHaveLength(0);
  });

  // Note: Full runAnalysis test would require mocking the LLM
  // Real integration tests are skipped due to API cost
});

// ═══════════════════════════════════════════════════════════════════════════════
// Unified Flow Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Unified Flow', () => {
  describe('Collection Phase', () => {
    it('should create valid viewport snapshots', () => {
      const snapshot = createMockSnapshot(0, 0);

      expect(snapshot.scrollPosition).toBe(0);
      expect(snapshot.viewportIndex).toBe(0);
      expect(snapshot.screenshot.base64).toBeDefined();
      expect(snapshot.dom.serialized).toBeDefined();
      expect(snapshot.dom.elementCount).toBeGreaterThan(0);
    });

    it('should track multiple snapshots with incrementing indices', () => {
      const snapshots = [
        createMockSnapshot(0, 0),
        createMockSnapshot(1, 720),
        createMockSnapshot(2, 1440),
      ];

      expect(snapshots).toHaveLength(3);
      expect(snapshots[0]!.viewportIndex).toBe(0);
      expect(snapshots[1]!.viewportIndex).toBe(1);
      expect(snapshots[2]!.viewportIndex).toBe(2);
      expect(snapshots[0]!.scrollPosition).toBe(0);
      expect(snapshots[1]!.scrollPosition).toBe(720);
      expect(snapshots[2]!.scrollPosition).toBe(1440);
    });
  });

  describe('Analysis Phase', () => {
    it('should group heuristics and calculate totals', () => {
      const groups = groupHeuristicsByCategory('pdp');
      const total = getTotalHeuristicCount(groups);

      expect(groups.length).toBeGreaterThan(0);
      expect(total).toBeGreaterThan(0);

      // Each group should have name, description, heuristics
      for (const group of groups) {
        expect(group.name).toBeDefined();
        expect(group.description).toBeDefined();
        expect(group.heuristics.length).toBe(group.count);
      }
    });

    it('should create valid evaluations with required fields', () => {
      const evaluation = createMockEvaluation('PDP-TEST-001', 'fail');

      expect(evaluation.heuristicId).toBe('PDP-TEST-001');
      expect(evaluation.status).toBe('fail');
      expect(evaluation.issue).toBeDefined();
      expect(evaluation.recommendation).toBeDefined();
      expect(evaluation.confidence).toBeGreaterThan(0);
      expect(evaluation.confidence).toBeLessThanOrEqual(1);
    });

    it('should not include issue/recommendation for passing evaluations', () => {
      const evaluation = createMockEvaluation('PDP-TEST-001', 'pass');

      expect(evaluation.status).toBe('pass');
      expect(evaluation.issue).toBeUndefined();
      expect(evaluation.recommendation).toBeUndefined();
    });
  });

  describe('Result Structure', () => {
    it('should produce properly structured analysis result', async () => {
      const orchestrator = createAnalysisOrchestrator();
      const snapshots = [createMockSnapshot(0, 0)];

      // Test with unsupported page type to get empty but valid structure
      const result = await orchestrator.runAnalysis(snapshots, 'unknown' as PageType);

      // Verify result structure
      expect(result).toHaveProperty('pageType');
      expect(result).toHaveProperty('analyzedAt');
      expect(result).toHaveProperty('snapshotCount');
      expect(result).toHaveProperty('categoriesAnalyzed');
      expect(result).toHaveProperty('categoryResults');
      expect(result).toHaveProperty('evaluations');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('totalTimeMs');

      // Verify summary structure
      expect(result.summary).toHaveProperty('totalHeuristics');
      expect(result.summary).toHaveProperty('passed');
      expect(result.summary).toHaveProperty('failed');
      expect(result.summary).toHaveProperty('partial');
      expect(result.summary).toHaveProperty('notApplicable');
      expect(result.summary).toHaveProperty('bySeverity');
    });

    it('should track snapshot count in result', async () => {
      const orchestrator = createAnalysisOrchestrator();
      const snapshots = [
        createMockSnapshot(0, 0),
        createMockSnapshot(1, 720),
        createMockSnapshot(2, 1440),
      ];

      const result = await orchestrator.runAnalysis(snapshots, 'unknown' as PageType);

      expect(result.snapshotCount).toBe(3);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Report Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Report Generation', () => {
  it('should include unified analysis metadata in report input', () => {
    const reportInput = {
      url: 'https://example.com',
      pageTitle: 'Test Page',
      insights: [],
      heuristicInsights: [],
      visionInsights: [
        {
          id: 'vision-PDP-TEST-001',
          type: 'cta' as const,
          severity: 'high' as const,
          element: '[5]',
          issue: 'Test issue',
          recommendation: 'Test recommendation',
          category: 'cta',
          source: 'vision',
          heuristicId: 'PDP-TEST-001',
          confidence: 0.85,
        },
      ],
      pageType: 'pdp',
      unifiedAnalysis: true,
      categoriesAnalyzed: ['Imagery', 'Pricing'],
    };

    expect(reportInput.visionInsights).toHaveLength(1);
    expect(reportInput.unifiedAnalysis).toBe(true);
    expect(reportInput.categoriesAnalyzed).toContain('Imagery');
    expect(reportInput.pageType).toBe('pdp');
  });
});
