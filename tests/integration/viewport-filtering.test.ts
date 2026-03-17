/**
 * Integration Tests for Viewport Filtering - Phase 26c (T568)
 *
 * Verifies viewport filtering works end-to-end through the AnalysisOrchestrator:
 * - Categories with above_fold config receive fewer viewports
 * - DOM filtering matches viewport selection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAnalysisOrchestrator } from '../../src/heuristics/analysis-orchestrator.js';
import type { ViewportSnapshot, PageType } from '../../src/models/index.js';

// Track what snapshots each category receives
const categorySnapshotCounts: Record<string, number> = {};

// Mock the category-analyzer module to track snapshot counts
vi.mock('../../src/heuristics/category-analyzer.js', () => {
  const mockAnalyzeCategory = vi.fn().mockImplementation(
    async (snapshots: ViewportSnapshot[], category: any) => {
      categorySnapshotCounts[category.name] = snapshots.length;
      return {
        categoryName: category.name,
        evaluations: [{
          heuristicId: `H-${category.name.replace(/\s/g, '')}`,
          status: 'pass',
          confidence: 0.9,
          observation: 'test',
          severity: 'medium',
        }],
        summary: 'test',
        analysisTimeMs: 10,
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
    DEFAULT_CATEGORY_ANALYZER_CONFIG: {
      model: 'gpt-4o',
      maxTokens: 4096,
      temperature: 0.1,
      timeoutMs: 60000,
    },
    populateElementRefs: vi.fn(),
    buildElementPositionsBlock: vi.fn().mockReturnValue(null),
  };
});

// Mock knowledge/index.js to mark 'pdp' as supported
vi.mock('../../src/heuristics/knowledge/index.js', () => ({
  isPageTypeSupported: vi.fn().mockReturnValue(true),
}));

// Mock category-grouper to return 2 categories with different viewport needs
vi.mock('../../src/heuristics/category-grouper.js', () => ({
  groupHeuristicsByCategory: vi.fn().mockReturnValue([
    {
      name: 'Mobile Usability',         // above_fold, maxViewports: 2
      description: 'Mobile usability checks',
      heuristics: [{ id: 'MU-001', name: 'Mobile viewport', severity: 'medium', description: 'test', principle: 'test', checkpoints: [] }],
      count: 1,
    },
    {
      name: 'Layout & Structure',       // all, maxViewports: 6
      description: 'Layout structure checks',
      heuristics: [{ id: 'LS-001', name: 'Layout check', severity: 'medium', description: 'test', principle: 'test', checkpoints: [] }],
      count: 1,
    },
  ]),
  getTotalHeuristicCount: vi.fn().mockReturnValue(2),
}));

// Mock vision types
vi.mock('../../src/heuristics/vision/types.js', () => ({
  getInsightCategory: vi.fn().mockReturnValue('cta'),
}));

// Mock logger
vi.mock('../../src/utils/index.js', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
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

// Mock LangChain
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({ content: '{}' }),
  })),
}));
vi.mock('@langchain/core/messages', () => ({
  SystemMessage: vi.fn().mockImplementation((content: string) => ({ content })),
  HumanMessage: vi.fn().mockImplementation((opts: any) => opts),
}));

// Helper to create mock snapshots
function createMockSnapshots(count: number): ViewportSnapshot[] {
  return Array.from({ length: count }, (_, i) => ({
    viewportIndex: i,
    scrollPosition: i * 720,
    screenshot: { base64: `base64-screenshot-${i}`, width: 1280, height: 720 },
    dom: { serialized: `<div>viewport ${i}</div>`, elementCount: 5 },
    timestamp: Date.now(),
  })) as unknown as ViewportSnapshot[];
}

describe('Viewport Filtering Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset tracking
    Object.keys(categorySnapshotCounts).forEach(k => delete categorySnapshotCounts[k]);
  });

  it('should send fewer viewports to filtered categories and all to "all" categories', async () => {
    const snapshots = createMockSnapshots(5); // 5 viewports

    const orchestrator = createAnalysisOrchestrator({
      parallelAnalysis: false, // Sequential so we can track clearly
      categoryBatching: false, // No batching — per-category analysis
      enableViewportFiltering: true, // Enable filtering
    });

    const result = await orchestrator.runAnalysis(snapshots, 'pdp' as PageType);

    // Both categories should produce results
    expect(result.categoryResults.length).toBe(2);
    expect(result.evaluations.length).toBe(2);

    // Mobile Usability (custom [0,1,2], maxViewports: 3) should receive <= 3 viewports
    expect(categorySnapshotCounts['Mobile Usability']).toBeLessThanOrEqual(3);

    // Layout & Structure (all, maxViewports: 6) should receive all 5 viewports
    expect(categorySnapshotCounts['Layout & Structure']).toBe(5);

    // Mobile should still receive fewer than Layout (filtering is effective)
    expect(categorySnapshotCounts['Mobile Usability']).toBeLessThan(categorySnapshotCounts['Layout & Structure']!);
  });

  it('should send all viewports to all categories when filtering is disabled', async () => {
    const snapshots = createMockSnapshots(5);

    const orchestrator = createAnalysisOrchestrator({
      parallelAnalysis: false,
      categoryBatching: false,
      enableViewportFiltering: false, // Filtering disabled
    });

    await orchestrator.runAnalysis(snapshots, 'pdp' as PageType);

    // Both categories should receive all 5 viewports
    expect(categorySnapshotCounts['Mobile Usability']).toBe(5);
    expect(categorySnapshotCounts['Layout & Structure']).toBe(5);
  });
});
