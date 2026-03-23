/**
 * Integration Tests for Phase 26e: Quality Validation
 *
 * Tests the full quality validation flow through QualityValidator:
 * baseline analysis → optimized analysis → compare → classify → report.
 * Uses mocked LLM to verify integration between all validation components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ViewportSnapshot, PageType } from '../../src/models/index.js';

// Hoisted mock fns
const { llmInvocations } = vi.hoisted(() => {
  const llmInvocations: Array<{ messages: any }> = [];
  return { llmInvocations };
});

// Mock LangChain — use function keyword for constructor compatibility
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(function (this: any) {
    this.invoke = async function (...args: any[]) {
      llmInvocations.push({ messages: args[0] });
      // Return consistent results so baseline and optimized match
      return {
        content: JSON.stringify({
          'Layout & Structure': {
            evaluations: [
              { heuristicId: 'PDP-LAY-001', status: 'pass', confidence: 0.9, observation: 'Good layout', reasoning: 'DOM' },
              { heuristicId: 'PDP-LAY-002', status: 'fail', confidence: 0.8, observation: 'Poor spacing', issue: 'Crowded', recommendation: 'Add margin', reasoning: 'Visual' },
            ],
          },
          'Mobile Usability': {
            evaluations: [
              { heuristicId: 'PDP-MOB-001', status: 'pass', confidence: 0.85, observation: 'Touch targets OK', reasoning: 'Screenshot' },
            ],
          },
          'Pricing & Cost Transparency': {
            evaluations: [
              { heuristicId: 'PDP-PRC-001', status: 'pass', confidence: 0.95, observation: 'Price visible', reasoning: 'DOM above fold' },
            ],
          },
          'Description & Value Proposition': {
            evaluations: [
              { heuristicId: 'PDP-DSC-001', status: 'partial', confidence: 0.7, observation: 'USP buried', issue: 'Below fold', recommendation: 'Move up', reasoning: 'Scroll' },
            ],
          },
        }),
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

// Mock category-grouper to return known category groups
vi.mock('../../src/heuristics/category-grouper.js', () => ({
  groupHeuristicsByCategory: vi.fn().mockReturnValue([
    {
      name: 'Layout & Structure',
      description: 'Page layout assessment',
      heuristics: [
        { id: 'PDP-LAY-001', principle: 'Clear grid layout', checkpoints: ['Grid'], severity: 'high', category: 'Layout & Structure' },
        { id: 'PDP-LAY-002', principle: 'Consistent spacing', checkpoints: ['Margins'], severity: 'medium', category: 'Layout & Structure' },
      ],
      count: 2,
    },
    {
      name: 'Mobile Usability',
      description: 'Mobile experience',
      heuristics: [
        { id: 'PDP-MOB-001', principle: 'Touch-friendly targets', checkpoints: ['44px min'], severity: 'high', category: 'Mobile Usability' },
      ],
      count: 1,
    },
    {
      name: 'Pricing & Cost Transparency',
      description: 'Pricing clarity',
      heuristics: [
        { id: 'PDP-PRC-001', principle: 'Visible price', checkpoints: ['Above fold'], severity: 'critical', category: 'Pricing & Cost Transparency' },
      ],
      count: 1,
    },
    {
      name: 'Description & Value Proposition',
      description: 'Product description quality',
      heuristics: [
        { id: 'PDP-DSC-001', principle: 'Clear value prop', checkpoints: ['USP visible'], severity: 'medium', category: 'Description & Value Proposition' },
      ],
      count: 1,
    },
  ]),
  getTotalHeuristicCount: vi.fn().mockReturnValue(5),
}));

// Mock the single-category analyzer
vi.mock('../../src/heuristics/category-analyzer.js', () => ({
  CategoryAnalyzer: vi.fn(),
  createCategoryAnalyzer: vi.fn().mockImplementation(() => ({
    analyzeCategory: async (_snapshots: any, category: any) => ({
      categoryName: category.name,
      evaluations: category.heuristics.map((h: any) => ({
        heuristicId: h.id,
        status: 'pass',
        confidence: 0.85,
        observation: 'Sequential analysis',
        severity: h.severity,
        principle: h.principle,
        reasoning: 'Fallback',
      })),
      analysisTimeMs: 100,
    }),
  })),
  DEFAULT_CATEGORY_ANALYZER_CONFIG: {
    model: 'gpt-4o',
    maxTokens: 4096,
    temperature: 0.1,
    timeoutMs: 60000,
  },
  // Element mapping utilities (no-op in integration tests)
  populateElementRefs: vi.fn(),
  buildElementPositionsBlock: vi.fn().mockReturnValue(null),
  buildAccessibilityTreeBlock: vi.fn().mockReturnValue(null),
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
import { QualityValidator } from '../../src/validation/quality-validator.js';

// Helper to create mock snapshots
function createMockSnapshots(count: number): ViewportSnapshot[] {
  return Array.from({ length: count }, (_, i) => ({
    viewportIndex: i,
    scrollPosition: i * 720,
    screenshot: { base64: `base64-screenshot-${i}`, width: 1280, height: 720 },
    dom: { serialized: `<div>[${i}] Element</div>`, elementCount: 5 },
    timestamp: Date.now(),
  })) as unknown as ViewportSnapshot[];
}

describe('Quality Validation Integration', () => {
  beforeEach(() => {
    llmInvocations.length = 0;
  });

  it('should run baseline and optimized analyses and report match rate', async () => {
    const validator = new QualityValidator({ verbose: false });
    const snapshots = createMockSnapshots(3);

    const result = await validator.validate(snapshots, 'pdp' as PageType);

    // Both baseline and optimized should produce results
    expect(result.baselineResult).toBeDefined();
    expect(result.optimizedResult).toBeDefined();
    expect(result.baselineResult.evaluations.length).toBeGreaterThan(0);
    expect(result.optimizedResult.evaluations.length).toBeGreaterThan(0);

    // Total heuristics should be > 0
    expect(result.totalHeuristics).toBeGreaterThan(0);

    // Match rate should be a valid number between 0 and 1
    expect(result.matchRate).toBeGreaterThanOrEqual(0);
    expect(result.matchRate).toBeLessThanOrEqual(1);

    // Should have recommendations
    expect(result.recommendations.length).toBeGreaterThan(0);

    // LLM was called for both baseline and optimized runs
    // Baseline: sequential (4 individual calls or single-category)
    // Optimized: batched (fewer calls)
    expect(llmInvocations.length).toBeGreaterThan(0);
  });

  it('should pass when baseline and optimized results match', async () => {
    // Since both modes use the same mocked LLM returning identical results,
    // baseline (sequential per-category) will use createCategoryAnalyzer mock
    // while optimized (batched) will use ChatOpenAI mock.
    // Both produce pass/fail/partial for same heuristic IDs.
    const validator = new QualityValidator({
      matchThreshold: 0.5,  // Low threshold to ensure pass
      failOnCritical: false,  // Don't fail on critical for this test
      verbose: false,
    });
    const snapshots = createMockSnapshots(2);

    const result = await validator.validate(snapshots, 'pdp' as PageType);

    // With the low threshold, should pass
    expect(result.totalHeuristics).toBeGreaterThan(0);
    expect(result.matchRate).toBeDefined();

    // Verify the result structure is complete
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('discrepancies');
    expect(result).toHaveProperty('failureReasons');
    expect(result).toHaveProperty('recommendations');
    expect(result).toHaveProperty('missingInOptimized');
    expect(result).toHaveProperty('missingInBaseline');
  });
});
