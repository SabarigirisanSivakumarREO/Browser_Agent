/**
 * Unit Tests for Parallel Analysis - Phase 26a (T555)
 *
 * Tests for the parallel category analysis implementation in AnalysisOrchestrator:
 * rate-limited concurrency via p-limit, per-category timeout, error isolation,
 * sequential fallback, and execution metrics.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAnalysisOrchestrator, type AnalysisOrchestratorConfig } from '../../src/heuristics/analysis-orchestrator.js';
import type { ViewportSnapshot, PageType } from '../../src/models/index.js';

// Mock the category-analyzer module
vi.mock('../../src/heuristics/category-analyzer.js', () => {
  const mockAnalyzeCategory = vi.fn();
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

// Mock category-grouper to return controllable category groups
vi.mock('../../src/heuristics/category-grouper.js', () => ({
  groupHeuristicsByCategory: vi.fn().mockReturnValue([]),
  getTotalHeuristicCount: vi.fn().mockReturnValue(0),
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

// Mock Phase 26b batching modules (not used in these tests — batching is disabled)
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

// Mock LangChain (used by batched analysis path)
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({ content: '{}' }),
  })),
}));
vi.mock('@langchain/core/messages', () => ({
  SystemMessage: vi.fn().mockImplementation((content: string) => ({ content })),
  HumanMessage: vi.fn().mockImplementation((opts: any) => opts),
}));

// Access mocked modules
import { createCategoryAnalyzer } from '../../src/heuristics/category-analyzer.js';
import { groupHeuristicsByCategory, getTotalHeuristicCount } from '../../src/heuristics/category-grouper.js';

const mockAnalyzer = createCategoryAnalyzer() as any;
const mockGroupHeuristics = groupHeuristicsByCategory as ReturnType<typeof vi.fn>;
const mockGetTotalCount = getTotalHeuristicCount as ReturnType<typeof vi.fn>;

// Helper to create mock category groups
function createMockGroups(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `Category ${i + 1}`,
    description: `Test category ${i + 1}`,
    heuristics: [{ id: `H${String(i + 1).padStart(3, '0')}`, name: `Heuristic ${i + 1}`, severity: 'medium' as const, description: 'test' }],
    count: 1,
  }));
}

// Helper to create mock snapshots
function createMockSnapshots(count: number): ViewportSnapshot[] {
  return Array.from({ length: count }, (_, i) => ({
    viewportIndex: i,
    scrollPosition: i * 720,
    screenshot: `base64-screenshot-${i}`,
    dom: { serialized: `<div>viewport ${i}</div>`, elementCount: 5 },
    timestamp: Date.now(),
  })) as unknown as ViewportSnapshot[];
}

describe('runParallelAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute categories in parallel using Promise.all', async () => {
    const groups = createMockGroups(3);
    mockGroupHeuristics.mockReturnValue(groups);
    mockGetTotalCount.mockReturnValue(3);

    // Track execution order with timestamps
    const executionLog: { category: string; startMs: number }[] = [];
    const startTime = Date.now();

    mockAnalyzer.analyzeCategory.mockImplementation(async (_snapshots: any, category: any) => {
      executionLog.push({ category: category.name, startMs: Date.now() - startTime });
      // Small delay to simulate work
      await new Promise((r) => setTimeout(r, 50));
      return {
        categoryName: category.name,
        evaluations: [{ heuristicId: 'H001', status: 'pass', confidence: 0.9, observation: 'ok', severity: 'medium' }],
        summary: 'Test summary',
        analysisTimeMs: 50,
      };
    });

    const orchestrator = createAnalysisOrchestrator({
      parallelAnalysis: true,
      maxConcurrentCategories: 5,
    });

    const result = await orchestrator.runAnalysis(createMockSnapshots(2), 'pdp' as PageType);

    // All 3 categories should have been analyzed
    expect(result.evaluations.length).toBe(3);
    expect(result.categoriesAnalyzed).toEqual(['Category 1', 'Category 2', 'Category 3']);

    // All 3 should have started nearly simultaneously (within 30ms of each other)
    // since maxConcurrent=5 and we only have 3
    expect(executionLog.length).toBe(3);
    const maxStartDiff = Math.max(...executionLog.map((e) => e.startMs)) -
      Math.min(...executionLog.map((e) => e.startMs));
    expect(maxStartDiff).toBeLessThan(30);
  });

  it('should respect maxConcurrentCategories rate limit', async () => {
    const groups = createMockGroups(6);
    mockGroupHeuristics.mockReturnValue(groups);
    mockGetTotalCount.mockReturnValue(6);

    // Track concurrent executions
    let currentConcurrent = 0;
    let maxConcurrent = 0;

    mockAnalyzer.analyzeCategory.mockImplementation(async (_snapshots: any, category: any) => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      await new Promise((r) => setTimeout(r, 100));
      currentConcurrent--;
      return {
        categoryName: category.name,
        evaluations: [],
        summary: '',
        analysisTimeMs: 100,
      };
    });

    const orchestrator = createAnalysisOrchestrator({
      parallelAnalysis: true,
      maxConcurrentCategories: 2,
    });

    await orchestrator.runAnalysis(createMockSnapshots(1), 'pdp' as PageType);

    // Max concurrent should not exceed the limit of 2
    expect(maxConcurrent).toBeLessThanOrEqual(2);
    // But should actually use parallelism (at least 2 concurrent)
    expect(maxConcurrent).toBe(2);
  });

  it('should timeout individual categories after parallelTimeoutMs', async () => {
    const groups = createMockGroups(2);
    mockGroupHeuristics.mockReturnValue(groups);
    mockGetTotalCount.mockReturnValue(2);

    mockAnalyzer.analyzeCategory.mockImplementation(async (_snapshots: any, category: any) => {
      if (category.name === 'Category 1') {
        // This one takes too long
        await new Promise((r) => setTimeout(r, 5000));
        return {
          categoryName: category.name,
          evaluations: [{ heuristicId: 'H001', status: 'pass', confidence: 0.9, observation: 'ok', severity: 'medium' }],
          summary: 'Should not appear',
          analysisTimeMs: 5000,
        };
      }
      // Category 2 completes quickly
      return {
        categoryName: category.name,
        evaluations: [{ heuristicId: 'H002', status: 'fail', confidence: 0.8, observation: 'issue found', severity: 'high' }],
        summary: 'Quick result',
        analysisTimeMs: 10,
      };
    });

    const orchestrator = createAnalysisOrchestrator({
      parallelAnalysis: true,
      parallelTimeoutMs: 200, // Short timeout
      maxConcurrentCategories: 5,
    });

    const result = await orchestrator.runAnalysis(createMockSnapshots(1), 'pdp' as PageType);

    // Category 1 should have timed out (empty evaluations)
    const cat1 = result.categoryResults.find((r) => r.categoryName === 'Category 1');
    expect(cat1).toBeDefined();
    expect(cat1!.evaluations).toEqual([]);
    expect(cat1!.error).toContain('Timeout');

    // Category 2 should have succeeded
    const cat2 = result.categoryResults.find((r) => r.categoryName === 'Category 2');
    expect(cat2).toBeDefined();
    expect(cat2!.evaluations.length).toBe(1);
    expect(cat2!.error).toBeUndefined();
  });

  it('should isolate errors (one failure does not fail all)', async () => {
    const groups = createMockGroups(3);
    mockGroupHeuristics.mockReturnValue(groups);
    mockGetTotalCount.mockReturnValue(3);

    mockAnalyzer.analyzeCategory.mockImplementation(async (_snapshots: any, category: any) => {
      if (category.name === 'Category 2') {
        throw new Error('LLM API rate limit exceeded');
      }
      return {
        categoryName: category.name,
        evaluations: [{ heuristicId: `H${category.name.slice(-1)}`, status: 'pass', confidence: 0.9, observation: 'ok', severity: 'medium' }],
        summary: 'Success',
        analysisTimeMs: 50,
      };
    });

    const orchestrator = createAnalysisOrchestrator({
      parallelAnalysis: true,
      maxConcurrentCategories: 5,
    });

    const result = await orchestrator.runAnalysis(createMockSnapshots(1), 'pdp' as PageType);

    // Should not throw — all categories should have results
    expect(result.categoryResults.length).toBe(3);

    // Category 2 should have error and empty evaluations
    const cat2 = result.categoryResults.find((r) => r.categoryName === 'Category 2');
    expect(cat2!.evaluations).toEqual([]);
    expect(cat2!.error).toContain('LLM API rate limit exceeded');

    // Other categories should have succeeded
    const cat1 = result.categoryResults.find((r) => r.categoryName === 'Category 1');
    const cat3 = result.categoryResults.find((r) => r.categoryName === 'Category 3');
    expect(cat1!.evaluations.length).toBe(1);
    expect(cat3!.evaluations.length).toBe(1);

    // Total evaluations should be 2 (cat1 + cat3, not cat2)
    expect(result.evaluations.length).toBe(2);
  });

  it('should fall back to sequential when parallelAnalysis is false', async () => {
    const groups = createMockGroups(3);
    mockGroupHeuristics.mockReturnValue(groups);
    mockGetTotalCount.mockReturnValue(3);

    const executionOrder: string[] = [];

    mockAnalyzer.analyzeCategory.mockImplementation(async (_snapshots: any, category: any) => {
      executionOrder.push(category.name);
      await new Promise((r) => setTimeout(r, 50));
      return {
        categoryName: category.name,
        evaluations: [],
        summary: '',
        analysisTimeMs: 50,
      };
    });

    const orchestrator = createAnalysisOrchestrator({
      parallelAnalysis: false,
    });

    const result = await orchestrator.runAnalysis(createMockSnapshots(1), 'pdp' as PageType);

    // All categories should complete
    expect(result.categoryResults.length).toBe(3);

    // Should have executed in order (sequential)
    expect(executionOrder).toEqual(['Category 1', 'Category 2', 'Category 3']);
  });

  it('should track execution metrics correctly', async () => {
    const groups = createMockGroups(4);
    mockGroupHeuristics.mockReturnValue(groups);
    mockGetTotalCount.mockReturnValue(4);

    mockAnalyzer.analyzeCategory.mockImplementation(async (_snapshots: any, category: any) => {
      await new Promise((r) => setTimeout(r, 50));
      return {
        categoryName: category.name,
        evaluations: [
          { heuristicId: `H${category.name.slice(-1)}`, status: 'pass', confidence: 0.9, observation: 'ok', severity: 'medium' },
        ],
        summary: 'Test',
        analysisTimeMs: 50,
      };
    });

    const orchestrator = createAnalysisOrchestrator({
      parallelAnalysis: true,
      maxConcurrentCategories: 4,
    });

    const result = await orchestrator.runAnalysis(createMockSnapshots(2), 'pdp' as PageType);

    // Verify result structure
    expect(result.pageType).toBe('pdp');
    expect(result.snapshotCount).toBe(2);
    expect(result.categoriesAnalyzed.length).toBe(4);
    expect(result.categoryResults.length).toBe(4);
    expect(result.evaluations.length).toBe(4);
    expect(result.totalTimeMs).toBeGreaterThan(0);
    // Parallel execution of 4 categories at concurrency 4 with 50ms each
    // should complete in ~50ms total (not 200ms sequential)
    expect(result.totalTimeMs).toBeLessThan(300);
    expect(result.analyzedAt).toBeGreaterThan(0);
    expect(result.summary.totalHeuristics).toBe(4);
  });
});
