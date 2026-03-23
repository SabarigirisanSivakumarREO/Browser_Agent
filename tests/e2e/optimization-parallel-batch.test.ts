/**
 * E2E Test: Parallel + Batching Combined - Phase 26f (T575)
 *
 * Verifies that parallel execution and category batching work together
 * to produce valid, complete results with all categories analyzed.
 * Tests the full flow: batcher → prompt builder → parallel LLM calls → parser → merged results.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ViewportSnapshot, PageType } from '../../src/models/index.js';

// Hoisted mock tracking
const { llmInvocations } = vi.hoisted(() => {
  const llmInvocations: Array<{ messages: any; timestamp: number }> = [];
  return { llmInvocations };
});

// Build a valid multi-category response JSON
function buildBatchedResponseJSON(categories: string[]): string {
  const result: Record<string, any> = {};
  const evalMap: Record<string, any> = {
    'Layout & Structure': {
      evaluations: [
        { heuristicId: 'PDP-LAY-001', status: 'pass', confidence: 0.9, observation: 'Clean grid', reasoning: 'DOM analysis' },
        { heuristicId: 'PDP-LAY-002', status: 'fail', confidence: 0.8, observation: 'Cramped spacing', issue: 'Margins too narrow', recommendation: 'Increase margins to 16px', reasoning: 'Visual check' },
      ],
      summary: 'Layout mostly good',
    },
    'Mobile Usability': {
      evaluations: [
        { heuristicId: 'PDP-MOB-001', status: 'pass', confidence: 0.85, observation: 'Touch targets OK', reasoning: 'All buttons >= 44px' },
      ],
      summary: 'Mobile OK',
    },
    'Pricing & Cost Transparency': {
      evaluations: [
        { heuristicId: 'PDP-PRC-001', status: 'pass', confidence: 0.95, observation: 'Price visible above fold', reasoning: 'Found in DOM viewport 0' },
      ],
      summary: 'Pricing clear',
    },
    'Description & Value Proposition': {
      evaluations: [
        { heuristicId: 'PDP-DSC-001', status: 'partial', confidence: 0.7, observation: 'USP partially visible', issue: 'Below fold', recommendation: 'Move key USP above fold', reasoning: 'Scroll required' },
      ],
      summary: 'Description needs work',
    },
    'Reviews & Social Proof': {
      evaluations: [
        { heuristicId: 'PDP-REV-001', status: 'pass', confidence: 0.88, observation: 'Reviews section present', reasoning: 'Found rating widget' },
      ],
      summary: 'Social proof OK',
    },
    'Selection & Configuration': {
      evaluations: [
        { heuristicId: 'PDP-SEL-001', status: 'pass', confidence: 0.82, observation: 'Size selector visible', reasoning: 'Dropdown found' },
      ],
      summary: 'Selection OK',
    },
    'Product Imagery & Media': {
      evaluations: [
        { heuristicId: 'PDP-IMG-001', status: 'fail', confidence: 0.9, observation: 'No zoom', issue: 'Missing image zoom', recommendation: 'Add hover zoom', reasoning: 'No zoom handler' },
      ],
      summary: 'Imagery needs improvement',
    },
    'Specifications & Details': {
      evaluations: [
        { heuristicId: 'PDP-SPC-001', status: 'pass', confidence: 0.75, observation: 'Specs in accordion', reasoning: 'Expandable section found' },
      ],
      summary: 'Specs OK',
    },
    'CTA & Purchase Confidence': {
      evaluations: [
        { heuristicId: 'PDP-CTA-001', status: 'pass', confidence: 0.92, observation: 'Add to Cart prominent', reasoning: 'Large green button above fold' },
      ],
      summary: 'CTA strong',
    },
    'Utility & Secondary Actions': {
      evaluations: [
        { heuristicId: 'PDP-UTL-001', status: 'partial', confidence: 0.6, observation: 'Wishlist hidden', issue: 'Hard to find', recommendation: 'Move to product info area', reasoning: 'Below fold in footer' },
      ],
      summary: 'Utility could improve',
    },
  };

  for (const name of categories) {
    if (evalMap[name]) {
      result[name] = evalMap[name];
    }
  }
  return JSON.stringify(result);
}

// Mock LangChain — return batch responses based on message content
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(function (this: any) {
    this.invoke = async function (messages: any[]) {
      llmInvocations.push({ messages, timestamp: Date.now() });
      // Return a response containing all 10 categories (parser picks what's needed)
      return {
        content: buildBatchedResponseJSON([
          'Layout & Structure', 'Mobile Usability',
          'Pricing & Cost Transparency', 'Description & Value Proposition',
          'Reviews & Social Proof', 'Selection & Configuration',
          'Product Imagery & Media', 'Specifications & Details',
          'CTA & Purchase Confidence', 'Utility & Secondary Actions',
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

// Mock category-grouper to return all 10 categories
vi.mock('../../src/heuristics/category-grouper.js', () => ({
  groupHeuristicsByCategory: vi.fn().mockReturnValue([
    { name: 'Layout & Structure', description: 'Layout', heuristics: [{ id: 'PDP-LAY-001', principle: 'Grid', checkpoints: [], severity: 'high', category: 'Layout & Structure' }, { id: 'PDP-LAY-002', principle: 'Spacing', checkpoints: [], severity: 'medium', category: 'Layout & Structure' }], count: 2 },
    { name: 'Mobile Usability', description: 'Mobile', heuristics: [{ id: 'PDP-MOB-001', principle: 'Touch targets', checkpoints: [], severity: 'high', category: 'Mobile Usability' }], count: 1 },
    { name: 'Pricing & Cost Transparency', description: 'Pricing', heuristics: [{ id: 'PDP-PRC-001', principle: 'Price visible', checkpoints: [], severity: 'critical', category: 'Pricing & Cost Transparency' }], count: 1 },
    { name: 'Description & Value Proposition', description: 'Description', heuristics: [{ id: 'PDP-DSC-001', principle: 'Value prop', checkpoints: [], severity: 'medium', category: 'Description & Value Proposition' }], count: 1 },
    { name: 'Reviews & Social Proof', description: 'Reviews', heuristics: [{ id: 'PDP-REV-001', principle: 'Reviews section', checkpoints: [], severity: 'medium', category: 'Reviews & Social Proof' }], count: 1 },
    { name: 'Selection & Configuration', description: 'Selection', heuristics: [{ id: 'PDP-SEL-001', principle: 'Variant selection', checkpoints: [], severity: 'medium', category: 'Selection & Configuration' }], count: 1 },
    { name: 'Product Imagery & Media', description: 'Imagery', heuristics: [{ id: 'PDP-IMG-001', principle: 'Image quality', checkpoints: [], severity: 'high', category: 'Product Imagery & Media' }], count: 1 },
    { name: 'Specifications & Details', description: 'Specs', heuristics: [{ id: 'PDP-SPC-001', principle: 'Spec visibility', checkpoints: [], severity: 'low', category: 'Specifications & Details' }], count: 1 },
    { name: 'CTA & Purchase Confidence', description: 'CTA', heuristics: [{ id: 'PDP-CTA-001', principle: 'CTA prominence', checkpoints: [], severity: 'critical', category: 'CTA & Purchase Confidence' }], count: 1 },
    { name: 'Utility & Secondary Actions', description: 'Utility', heuristics: [{ id: 'PDP-UTL-001', principle: 'Secondary actions', checkpoints: [], severity: 'low', category: 'Utility & Secondary Actions' }], count: 1 },
  ]),
  getTotalHeuristicCount: vi.fn().mockReturnValue(11),
}));

// Mock category-analyzer (fallback path)
vi.mock('../../src/heuristics/category-analyzer.js', () => ({
  CategoryAnalyzer: vi.fn(),
  createCategoryAnalyzer: vi.fn().mockReturnValue({
    analyzeCategory: async (_snapshots: any, category: any) => ({
      categoryName: category.name,
      evaluations: category.heuristics.map((h: any) => ({
        heuristicId: h.id, status: 'pass', confidence: 0.7, observation: 'Fallback', severity: h.severity, principle: h.principle, reasoning: 'Fallback',
      })),
      analysisTimeMs: 50,
    }),
  }),
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

function createMockSnapshots(count: number): ViewportSnapshot[] {
  return Array.from({ length: count }, (_, i) => ({
    viewportIndex: i,
    scrollPosition: i * 720,
    screenshot: { base64: `base64-screenshot-${i}`, width: 1280, height: 720 },
    dom: { serialized: `--- Viewport-${i} (scroll: ${i * 720}px) ---\n<div>Viewport ${i} content</div>`, elementCount: 10 },
    timestamp: Date.now(),
  })) as unknown as ViewportSnapshot[];
}

describe('Parallel + Batching E2E', () => {
  beforeEach(() => {
    llmInvocations.length = 0;
  });

  it('should complete analysis with parallel batches and produce valid results for all categories', async () => {
    const snapshots = createMockSnapshots(5); // 5 viewports like a real PDP page

    const orchestrator = createAnalysisOrchestrator({
      parallelAnalysis: true,         // Phase 26a: parallel execution
      categoryBatching: true,         // Phase 26b: batched categories
      batchStrategy: 'related',       // Default batch pairing
      maxConcurrentCategories: 5,     // Allow all batches to run at once
      enableViewportFiltering: false, // Disable viewport filtering to isolate parallel+batch test
    });

    const result = await orchestrator.runAnalysis(snapshots, 'pdp' as PageType);

    // 1. All 10 categories should be analyzed
    expect(result.categoriesAnalyzed).toHaveLength(10);
    expect(result.categoriesAnalyzed).toContain('Layout & Structure');
    expect(result.categoriesAnalyzed).toContain('Mobile Usability');
    expect(result.categoriesAnalyzed).toContain('Pricing & Cost Transparency');
    expect(result.categoriesAnalyzed).toContain('Description & Value Proposition');
    expect(result.categoriesAnalyzed).toContain('Reviews & Social Proof');
    expect(result.categoriesAnalyzed).toContain('Selection & Configuration');
    expect(result.categoriesAnalyzed).toContain('Product Imagery & Media');
    expect(result.categoriesAnalyzed).toContain('Specifications & Details');
    expect(result.categoriesAnalyzed).toContain('CTA & Purchase Confidence');
    expect(result.categoriesAnalyzed).toContain('Utility & Secondary Actions');

    // 2. All 11 evaluations present (2 from Layout + 1 each from 9 other categories)
    expect(result.evaluations).toHaveLength(11);

    // 3. Batching should reduce LLM calls (5 batched calls, not 10 individual)
    // With related strategy: 5 batches of 2 categories each
    expect(llmInvocations.length).toBe(5);

    // 4. Results should have correct statuses
    const layFail = result.evaluations.find(e => e.heuristicId === 'PDP-LAY-002');
    expect(layFail?.status).toBe('fail');
    expect(layFail?.issue).toBe('Margins too narrow');

    const dscPartial = result.evaluations.find(e => e.heuristicId === 'PDP-DSC-001');
    expect(dscPartial?.status).toBe('partial');

    const ctaPass = result.evaluations.find(e => e.heuristicId === 'PDP-CTA-001');
    expect(ctaPass?.status).toBe('pass');
    expect(ctaPass?.confidence).toBe(0.92);

    // 5. Per-category results should be present
    expect(result.categoryResults).toHaveLength(10);
    for (const catResult of result.categoryResults) {
      expect(catResult.evaluations.length).toBeGreaterThan(0);
    }

    // 6. Summary statistics should be correct
    expect(result.summary.totalHeuristics).toBe(11);
    expect(result.summary.passed).toBeGreaterThan(0);
    expect(result.summary.failed).toBeGreaterThan(0);

    // 7. Insights should be generated for failed/partial evaluations
    expect(result.insights.length).toBeGreaterThan(0);

    // 8. Timing should be recorded
    expect(result.totalTimeMs).toBeGreaterThan(0);
  });
});
