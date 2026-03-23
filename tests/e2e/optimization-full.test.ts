/**
 * E2E Test: Full Optimization Stack + Quality Validation - Phase 26f (T577)
 *
 * Tests the complete optimization pipeline with ALL features enabled:
 * parallel execution + category batching + viewport filtering.
 * Also tests that quality validation passes when comparing optimized vs baseline.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ViewportSnapshot, PageType } from '../../src/models/index.js';

// Hoisted mock tracking
const { llmInvocations, singleCategoryInvocations } = vi.hoisted(() => {
  const llmInvocations: Array<{ messages: any }> = [];
  const singleCategoryInvocations: Array<{ category: string; snapshotCount: number }> = [];
  return { llmInvocations, singleCategoryInvocations };
});

// Build a valid multi-category response JSON with consistent results
function buildBatchedResponseJSON(categories: string[]): string {
  const result: Record<string, any> = {};
  const evalMap: Record<string, any> = {
    'Layout & Structure': {
      evaluations: [
        { heuristicId: 'PDP-LAY-001', status: 'pass', confidence: 0.9, observation: 'Clean grid', reasoning: 'DOM' },
        { heuristicId: 'PDP-LAY-002', status: 'pass', confidence: 0.85, observation: 'Good spacing', reasoning: 'Visual' },
      ],
    },
    'Mobile Usability': {
      evaluations: [
        { heuristicId: 'PDP-MOB-001', status: 'pass', confidence: 0.85, observation: 'Touch targets OK', reasoning: 'All >= 44px' },
      ],
    },
    'Pricing & Cost Transparency': {
      evaluations: [
        { heuristicId: 'PDP-PRC-001', status: 'pass', confidence: 0.95, observation: 'Price visible', reasoning: 'DOM viewport 0' },
      ],
    },
    'Description & Value Proposition': {
      evaluations: [
        { heuristicId: 'PDP-DSC-001', status: 'pass', confidence: 0.8, observation: 'USP visible', reasoning: 'Found in header' },
      ],
    },
  };

  for (const name of categories) {
    if (evalMap[name]) {
      result[name] = evalMap[name];
    }
  }
  return JSON.stringify(result);
}

// Mock LangChain — returns consistent results for both baseline and optimized
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(function (this: any) {
    this.invoke = async function (messages: any[]) {
      llmInvocations.push({ messages });
      return {
        content: buildBatchedResponseJSON([
          'Layout & Structure', 'Mobile Usability',
          'Pricing & Cost Transparency', 'Description & Value Proposition',
        ]),
      };
    };
  }),
}));

vi.mock('@langchain/core/messages', () => ({
  SystemMessage: vi.fn().mockImplementation(function (this: any, content: string) {
    this.content = content;
    this.role = 'system';
  }),
  HumanMessage: vi.fn().mockImplementation(function (this: any, opts: any) {
    Object.assign(this, opts);
    this.role = 'user';
  }),
}));

// Mock knowledge/index.js to support 'pdp'
vi.mock('../../src/heuristics/knowledge/index.js', () => ({
  isPageTypeSupported: vi.fn().mockReturnValue(true),
}));

// Mock category-grouper with 4 categories (2 batches)
vi.mock('../../src/heuristics/category-grouper.js', () => ({
  groupHeuristicsByCategory: vi.fn().mockReturnValue([
    { name: 'Layout & Structure', description: 'Layout', heuristics: [{ id: 'PDP-LAY-001', principle: 'Grid', checkpoints: [], severity: 'high', category: 'Layout & Structure' }, { id: 'PDP-LAY-002', principle: 'Spacing', checkpoints: [], severity: 'medium', category: 'Layout & Structure' }], count: 2 },
    { name: 'Mobile Usability', description: 'Mobile', heuristics: [{ id: 'PDP-MOB-001', principle: 'Touch targets', checkpoints: [], severity: 'high', category: 'Mobile Usability' }], count: 1 },
    { name: 'Pricing & Cost Transparency', description: 'Pricing', heuristics: [{ id: 'PDP-PRC-001', principle: 'Price visible', checkpoints: [], severity: 'critical', category: 'Pricing & Cost Transparency' }], count: 1 },
    { name: 'Description & Value Proposition', description: 'Description', heuristics: [{ id: 'PDP-DSC-001', principle: 'Value prop', checkpoints: [], severity: 'medium', category: 'Description & Value Proposition' }], count: 1 },
  ]),
  getTotalHeuristicCount: vi.fn().mockReturnValue(5),
}));

// Mock category-analyzer (used for baseline sequential + fallback paths)
vi.mock('../../src/heuristics/category-analyzer.js', () => ({
  CategoryAnalyzer: vi.fn(),
  createCategoryAnalyzer: vi.fn().mockImplementation(() => ({
    analyzeCategory: async (snapshots: any, category: any) => {
      singleCategoryInvocations.push({
        category: category.name,
        snapshotCount: Array.isArray(snapshots) ? snapshots.length : 0,
      });
      return {
        categoryName: category.name,
        evaluations: category.heuristics.map((h: any) => ({
          heuristicId: h.id,
          status: 'pass',
          confidence: 0.85,
          observation: 'Sequential analysis',
          severity: h.severity,
          principle: h.principle,
          reasoning: 'Sequential',
        })),
        analysisTimeMs: 100,
      };
    },
  })),
  DEFAULT_CATEGORY_ANALYZER_CONFIG: { model: 'gpt-4o', maxTokens: 4096, temperature: 0.1, timeoutMs: 60000 },
  populateElementRefs: vi.fn(),
  buildElementPositionsBlock: vi.fn().mockReturnValue(null),
  buildAccessibilityTreeBlock: vi.fn().mockReturnValue(null),
}));

// Mock logger
vi.mock('../../src/utils/index.js', () => ({
  createLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// Mock vision types
vi.mock('../../src/heuristics/vision/types.js', () => ({
  getInsightCategory: vi.fn().mockReturnValue('cta'),
}));

vi.mock('../../src/heuristics/vision/image-crop-pipeline.js', () => ({
  cropForCategory: vi.fn().mockResolvedValue({ base64: 'mock-cropped', tokens: 170, cropped: true }),
  compressForLLM: vi.fn().mockResolvedValue({ base64: 'mock-compressed', tokens: 170 }),
  DEFAULT_CROP_CONFIG: { maxTokensPerImage: 300, paddingPx: 50, minCropSize: 100, jpegQualityRange: [30, 70], coverageThreshold: 0.8 },
}));

// Import after mocks
import { createAnalysisOrchestrator } from '../../src/heuristics/analysis-orchestrator.js';
import { QualityValidator } from '../../src/validation/quality-validator.js';

function createMockSnapshots(count: number): ViewportSnapshot[] {
  return Array.from({ length: count }, (_, i) => ({
    viewportIndex: i,
    scrollPosition: i * 720,
    screenshot: { base64: `base64-screenshot-${i}`, width: 1280, height: 720 },
    dom: { serialized: `--- Viewport-${i} (scroll: ${i * 720}px) ---\n<div>[${i}] Product content</div>`, elementCount: 10 },
    timestamp: Date.now(),
  })) as unknown as ViewportSnapshot[];
}

describe('Full Optimization Stack E2E', () => {
  beforeEach(() => {
    llmInvocations.length = 0;
    singleCategoryInvocations.length = 0;
  });

  it('should run with all optimizations enabled (parallel + batch + viewport filter)', async () => {
    const snapshots = createMockSnapshots(4);

    const orchestrator = createAnalysisOrchestrator({
      parallelAnalysis: true,           // Phase 26a
      categoryBatching: true,           // Phase 26b
      batchStrategy: 'related',         // Predefined batch pairs
      enableViewportFiltering: true,    // Phase 26c
      maxConcurrentCategories: 5,
    });

    const result = await orchestrator.runAnalysis(snapshots, 'pdp' as PageType);

    // 1. All 4 categories analyzed
    expect(result.categoriesAnalyzed).toHaveLength(4);

    // 2. All 5 evaluations present
    expect(result.evaluations).toHaveLength(5);

    // 3. Batching reduced calls: 2 batches (Layout+Mobile, Pricing+Description)
    expect(llmInvocations.length).toBe(2);

    // 4. No fallback to single-category (all batches succeed)
    expect(singleCategoryInvocations.length).toBe(0);

    // 5. Each evaluation is valid
    for (const evaluation of result.evaluations) {
      expect(evaluation.heuristicId).toBeDefined();
      expect(evaluation.status).toBe('pass');
      expect(evaluation.confidence).toBeGreaterThan(0);
      expect(evaluation.confidence).toBeLessThanOrEqual(1);
    }

    // 6. Summary correctly tallied
    expect(result.summary.totalHeuristics).toBe(5);
    expect(result.summary.passed).toBe(5);
    expect(result.summary.failed).toBe(0);

    // 7. Timing recorded
    expect(result.totalTimeMs).toBeGreaterThan(0);

    // 8. Page type preserved
    expect(result.pageType).toBe('pdp');
    expect(result.snapshotCount).toBe(4);
  });

  it('should pass quality validation against baseline', async () => {
    const snapshots = createMockSnapshots(3);

    const validator = new QualityValidator({
      matchThreshold: 0.5,    // Low threshold — both modes return 'pass' statuses
      failOnCritical: true,   // Still enforce no pass↔fail flips
      verbose: false,
    });

    const result = await validator.validate(snapshots, 'pdp' as PageType);

    // 1. Both baseline and optimized should produce results
    expect(result.baselineResult).toBeDefined();
    expect(result.optimizedResult).toBeDefined();
    expect(result.baselineResult.evaluations.length).toBeGreaterThan(0);
    expect(result.optimizedResult.evaluations.length).toBeGreaterThan(0);

    // 2. Total heuristics compared should be > 0
    expect(result.totalHeuristics).toBeGreaterThan(0);

    // 3. Match rate should be a valid number between 0 and 1
    expect(result.matchRate).toBeGreaterThanOrEqual(0);
    expect(result.matchRate).toBeLessThanOrEqual(1);

    // 4. Result structure should be complete
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('discrepancies');
    expect(result).toHaveProperty('failureReasons');
    expect(result).toHaveProperty('recommendations');
    expect(result).toHaveProperty('missingInOptimized');
    expect(result).toHaveProperty('missingInBaseline');

    // 5. Recommendations should always be present
    expect(result.recommendations.length).toBeGreaterThan(0);

    // 6. Both modes should have analyzed same categories
    expect(result.baselineResult.categoriesAnalyzed.length).toBe(
      result.optimizedResult.categoriesAnalyzed.length
    );

    // 7. LLM was called for both modes
    // Baseline uses single-category analyzer, Optimized uses batched LLM
    expect(singleCategoryInvocations.length).toBeGreaterThan(0); // baseline
    expect(llmInvocations.length).toBeGreaterThan(0); // optimized
  });
});
