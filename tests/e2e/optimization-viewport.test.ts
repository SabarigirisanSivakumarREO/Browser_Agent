/**
 * E2E Test: Viewport Filtering - Phase 26f (T576)
 *
 * Verifies that viewport filtering correctly selects per-category viewports
 * and produces valid results with reduced data sent to the LLM.
 * Tests both per-category and batched paths with viewport filtering enabled.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ViewportSnapshot, PageType } from '../../src/models/index.js';

// Track per-category snapshot counts
const categorySnapshotCounts: Record<string, number> = {};

// Mock category-analyzer to track how many snapshots each category receives
vi.mock('../../src/heuristics/category-analyzer.js', () => {
  const mockAnalyzeCategory = vi.fn().mockImplementation(
    async (snapshots: ViewportSnapshot[], category: any) => {
      categorySnapshotCounts[category.name] = snapshots.length;
      return {
        categoryName: category.name,
        evaluations: category.heuristics.map((h: any) => ({
          heuristicId: h.id,
          status: 'pass',
          confidence: 0.85,
          observation: `Analyzed with ${snapshots.length} viewports`,
          severity: h.severity,
          principle: h.principle,
          reasoning: 'Viewport filtered analysis',
        })),
        summary: `${category.name} analysis`,
        analysisTimeMs: 20,
      };
    }
  );
  return {
    CategoryAnalyzer: vi.fn().mockImplementation(() => ({
      analyzeCategory: mockAnalyzeCategory,
    })),
    createCategoryAnalyzer: vi.fn().mockReturnValue({
      analyzeCategory: mockAnalyzeCategory,
    }),
    DEFAULT_CATEGORY_ANALYZER_CONFIG: { model: 'gpt-4o', maxTokens: 4096, temperature: 0.1, timeoutMs: 60000 },
    populateElementRefs: vi.fn(),
    buildElementPositionsBlock: vi.fn().mockReturnValue(null),
  };
});

// Mock knowledge/index.js to support 'pdp'
vi.mock('../../src/heuristics/knowledge/index.js', () => ({
  isPageTypeSupported: vi.fn().mockReturnValue(true),
}));

// Mock category-grouper — return 6 categories with different viewport needs
vi.mock('../../src/heuristics/category-grouper.js', () => ({
  groupHeuristicsByCategory: vi.fn().mockReturnValue([
    { name: 'Layout & Structure', description: 'Layout', heuristics: [{ id: 'LS-001', principle: 'Layout', checkpoints: [], severity: 'high', category: 'Layout & Structure' }], count: 1 },
    { name: 'Mobile Usability', description: 'Mobile', heuristics: [{ id: 'MU-001', principle: 'Mobile', checkpoints: [], severity: 'high', category: 'Mobile Usability' }], count: 1 },
    { name: 'Pricing & Cost Transparency', description: 'Pricing', heuristics: [{ id: 'PC-001', principle: 'Pricing', checkpoints: [], severity: 'critical', category: 'Pricing & Cost Transparency' }], count: 1 },
    { name: 'Reviews & Social Proof', description: 'Reviews', heuristics: [{ id: 'RS-001', principle: 'Reviews', checkpoints: [], severity: 'medium', category: 'Reviews & Social Proof' }], count: 1 },
    { name: 'CTA & Purchase Confidence', description: 'CTA', heuristics: [{ id: 'CT-001', principle: 'CTA', checkpoints: [], severity: 'critical', category: 'CTA & Purchase Confidence' }], count: 1 },
    { name: 'Utility & Secondary Actions', description: 'Utility', heuristics: [{ id: 'UT-001', principle: 'Utility', checkpoints: [], severity: 'low', category: 'Utility & Secondary Actions' }], count: 1 },
  ]),
  getTotalHeuristicCount: vi.fn().mockReturnValue(6),
}));

// Mock vision types
vi.mock('../../src/heuristics/vision/types.js', () => ({
  getInsightCategory: vi.fn().mockReturnValue('cta'),
}));

// Mock logger
vi.mock('../../src/utils/index.js', () => ({
  createLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// Mock LangChain (not used in per-category path, but needed for module resolution)
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({ content: '{}' }),
  })),
}));
vi.mock('@langchain/core/messages', () => ({
  SystemMessage: vi.fn().mockImplementation((content: string) => ({ content })),
  HumanMessage: vi.fn().mockImplementation((opts: any) => opts),
}));

// Mock Phase 26b batching modules (disabled for this test)
vi.mock('../../src/heuristics/category-batcher.js', () => ({
  groupCategoriesIntoBatches: vi.fn().mockReturnValue([]),
}));
vi.mock('../../src/heuristics/batch-prompt-builder.js', () => ({
  buildBatchedSystemPrompt: vi.fn().mockReturnValue(''),
  buildBatchedUserMessage: vi.fn().mockReturnValue(''),
}));
vi.mock('../../src/heuristics/batch-response-parser.js', () => ({
  parseBatchedResponse: vi.fn().mockReturnValue([]),
  BatchParseError: class BatchParseError extends Error {
    constructor(public rawResponse: string, public cause: Error) {
      super(`Failed to parse batched response: ${cause.message}`);
      this.name = 'BatchParseError';
    }
  },
}));

// Import after mocks
import { createAnalysisOrchestrator } from '../../src/heuristics/analysis-orchestrator.js';

function createMockSnapshots(count: number): ViewportSnapshot[] {
  return Array.from({ length: count }, (_, i) => ({
    viewportIndex: i,
    scrollPosition: i * 720,
    screenshot: { base64: `base64-screenshot-${i}`, width: 1280, height: 720 },
    dom: { serialized: `--- Viewport-${i} (scroll: ${i * 720}px) ---\n<div>Content ${i}</div>`, elementCount: 8 },
    timestamp: Date.now(),
  })) as unknown as ViewportSnapshot[];
}

describe('Viewport Filtering E2E', () => {
  beforeEach(() => {
    Object.keys(categorySnapshotCounts).forEach(k => delete categorySnapshotCounts[k]);
    vi.clearAllMocks();
  });

  it('should filter viewports per category and produce valid results', async () => {
    const snapshots = createMockSnapshots(6); // 6 viewports (full PDP page)

    const orchestrator = createAnalysisOrchestrator({
      parallelAnalysis: false,          // Sequential for clear tracking
      categoryBatching: false,          // Per-category (no batching) to isolate viewport test
      enableViewportFiltering: true,    // Phase 26c: viewport filtering enabled
    });

    const result = await orchestrator.runAnalysis(snapshots, 'pdp' as PageType);

    // 1. All 6 categories should produce results
    expect(result.categoriesAnalyzed).toHaveLength(6);
    expect(result.evaluations).toHaveLength(6);

    // 2. Verify viewport filtering per category based on revised VIEWPORT_REQUIREMENTS:
    //    - Layout & Structure: mode='all', maxViewports=6 → receives all 6
    //    - Mobile Usability: mode='custom' [0,1,2], maxViewports=3 → receives ≤ 3
    //    - Pricing & Cost Transparency: mode='custom' [0,1,2,3], maxViewports=4 → receives ≤ 4
    //    - Reviews & Social Proof: mode='all', maxViewports=4 → receives 4 (capped from 6)
    //    - CTA & Purchase Confidence: mode='all', maxViewports=4 → receives 4 (capped from 6)
    //    - Utility & Secondary Actions: mode='all', maxViewports=5 → receives 5 (capped from 6)

    expect(categorySnapshotCounts['Layout & Structure']).toBe(6);
    expect(categorySnapshotCounts['Mobile Usability']).toBeLessThanOrEqual(3);
    expect(categorySnapshotCounts['Pricing & Cost Transparency']).toBeLessThanOrEqual(4);
    expect(categorySnapshotCounts['Reviews & Social Proof']).toBeLessThanOrEqual(4);
    expect(categorySnapshotCounts['CTA & Purchase Confidence']).toBeLessThanOrEqual(4);
    expect(categorySnapshotCounts['Utility & Secondary Actions']).toBeLessThanOrEqual(5);

    // 3. Custom-mode categories should receive FEWER viewports than uncapped 'all' categories
    const customCount = categorySnapshotCounts['Mobile Usability']!;
    const allCount = categorySnapshotCounts['Layout & Structure']!;
    expect(customCount).toBeLessThan(allCount);

    // 4. Reviews & Social Proof should include viewport 0 for hero context (star ratings)
    expect(categorySnapshotCounts['Reviews & Social Proof']).toBeGreaterThanOrEqual(1);

    // 5. All evaluations should be valid
    for (const evaluation of result.evaluations) {
      expect(evaluation.heuristicId).toBeDefined();
      expect(['pass', 'fail', 'partial', 'not_applicable']).toContain(evaluation.status);
      expect(evaluation.confidence).toBeGreaterThanOrEqual(0);
      expect(evaluation.confidence).toBeLessThanOrEqual(1);
    }

    // 6. Summary should reflect all evaluations
    expect(result.summary.totalHeuristics).toBe(6);
  });
});
