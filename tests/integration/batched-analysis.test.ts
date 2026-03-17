/**
 * Integration Tests for Batched Analysis - Phase 26b (T563)
 *
 * Tests the full batched analysis flow through the orchestrator:
 * batcher → prompt builder → LLM call → parser → results.
 * Uses mocked LLM to verify integration between all batching components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ViewportSnapshot, PageType } from '../../src/models/index.js';

// Hoisted mock fns (available in vi.mock factories)
const { llmInvocations, singleCategoryInvocations, mockInvokeImpl } = vi.hoisted(() => {
  // Track all LLM invoke calls
  const llmInvocations: Array<{ messages: any }> = [];
  // Track single-category fallback calls
  const singleCategoryInvocations: Array<{ category: string }> = [];
  // Default invoke implementation (set per test)
  let mockInvokeImpl: (...args: any[]) => Promise<any> = async () => ({ content: '{}' });

  return { llmInvocations, singleCategoryInvocations, mockInvokeImpl };
});

// Mock LangChain — use function keyword for constructor compatibility
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(function (this: any) {
    this.invoke = async function (...args: any[]) {
      llmInvocations.push({ messages: args[0] });
      return mockInvokeImpl(...args);
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

// Mock the single-category analyzer (used for fallback)
vi.mock('../../src/heuristics/category-analyzer.js', () => ({
  CategoryAnalyzer: vi.fn().mockImplementation(function (this: any) {
    this.analyzeCategory = async (_snapshots: any, category: any) => {
      singleCategoryInvocations.push({ category: category.name });
      return {
        categoryName: category.name,
        evaluations: category.heuristics.map((h: any) => ({
          heuristicId: h.id,
          status: 'pass',
          confidence: 0.7,
          observation: 'Single-category analysis',
          severity: h.severity,
          principle: h.principle,
          reasoning: 'Fallback',
        })),
        summary: 'Single-category result',
        analysisTimeMs: 100,
      };
    };
  }),
  createCategoryAnalyzer: vi.fn().mockImplementation(() => {
    return {
      analyzeCategory: async (_snapshots: any, category: any) => {
        singleCategoryInvocations.push({ category: category.name });
        return {
          categoryName: category.name,
          evaluations: category.heuristics.map((h: any) => ({
            heuristicId: h.id,
            status: 'pass',
            confidence: 0.7,
            observation: 'Single-category analysis',
            severity: h.severity,
            principle: h.principle,
            reasoning: 'Fallback',
          })),
          summary: 'Single-category result',
          analysisTimeMs: 100,
        };
      },
    };
  }),
  DEFAULT_CATEGORY_ANALYZER_CONFIG: {
    model: 'gpt-4o',
    maxTokens: 4096,
    temperature: 0.1,
    timeoutMs: 60000,
  },
  // Element mapping utilities (no-op in integration tests)
  populateElementRefs: vi.fn(),
  buildElementPositionsBlock: vi.fn().mockReturnValue(null),
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

// Import after mocks
import { createAnalysisOrchestrator } from '../../src/heuristics/analysis-orchestrator.js';

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

// Build a valid multi-category response JSON for a given set of category names
function buildBatchedResponseJSON(categories: string[]): string {
  const result: Record<string, any> = {};
  for (const name of categories) {
    switch (name) {
      case 'Layout & Structure':
        result[name] = {
          evaluations: [
            { heuristicId: 'PDP-LAY-001', status: 'pass', confidence: 0.9, observation: 'Good', reasoning: 'DOM' },
            { heuristicId: 'PDP-LAY-002', status: 'pass', confidence: 0.85, observation: 'Good spacing', reasoning: 'Visual' },
          ],
          summary: 'Layout passes',
        };
        break;
      case 'Mobile Usability':
        result[name] = {
          evaluations: [
            { heuristicId: 'PDP-MOB-001', status: 'fail', confidence: 0.8, observation: 'Small targets', issue: 'Buttons too small', recommendation: 'Increase to 44px', reasoning: 'Screenshot check' },
          ],
          summary: 'Mobile needs work',
        };
        break;
      case 'Pricing & Cost Transparency':
        result[name] = {
          evaluations: [
            { heuristicId: 'PDP-PRC-001', status: 'pass', confidence: 0.95, observation: 'Price visible', reasoning: 'Found in DOM above fold' },
          ],
          summary: 'Pricing clear',
        };
        break;
      case 'Description & Value Proposition':
        result[name] = {
          evaluations: [
            { heuristicId: 'PDP-DSC-001', status: 'partial', confidence: 0.7, observation: 'USP buried', issue: 'Below fold', recommendation: 'Move above fold', reasoning: 'Scroll position' },
          ],
          summary: 'Description could improve',
        };
        break;
    }
  }
  return JSON.stringify(result);
}

describe('Batched Analysis Integration', () => {
  beforeEach(() => {
    llmInvocations.length = 0;
    singleCategoryInvocations.length = 0;
  });

  it('should reduce API calls with batching (2 batched calls instead of 4 individual)', async () => {
    // LLM returns valid batched responses for all categories
    // The real mockInvokeImpl is set via reassignment
    Object.assign(mockInvokeImpl, {});
    // Override the hoisted mockInvokeImpl through a local approach
    // Since we can't reassign hoisted const, we track via llmInvocations
    // and the function keyword mock will push to it

    // Set up LLM to return comprehensive results for any batch
    vi.mocked(await import('@langchain/openai')).ChatOpenAI.mockImplementation(function (this: any) {
      this.invoke = async function () {
        llmInvocations.push({ messages: [] });
        return {
          content: buildBatchedResponseJSON([
            'Layout & Structure', 'Mobile Usability',
            'Pricing & Cost Transparency', 'Description & Value Proposition',
          ]),
        };
      };
    } as any);

    const orchestrator = createAnalysisOrchestrator({
      categoryBatching: true,
      parallelAnalysis: false,
      batchStrategy: 'related',
    });

    const result = await orchestrator.runAnalysis(createMockSnapshots(2), 'pdp' as PageType);

    // With 4 categories batched into 2 pairs, should have 2 LLM calls (not 4)
    expect(llmInvocations.length).toBe(2);

    // No single-category fallback calls
    expect(singleCategoryInvocations.length).toBe(0);

    // All 5 evaluations present (2 from Layout, 1 from Mobile, 1 from Pricing, 1 from Description)
    expect(result.evaluations.length).toBe(5);

    // Verify categories
    expect(result.categoriesAnalyzed).toContain('Layout & Structure');
    expect(result.categoriesAnalyzed).toContain('Mobile Usability');
    expect(result.categoriesAnalyzed).toContain('Pricing & Cost Transparency');
    expect(result.categoriesAnalyzed).toContain('Description & Value Proposition');

    // Verify evaluation statuses
    const mobEval = result.evaluations.find(e => e.heuristicId === 'PDP-MOB-001');
    expect(mobEval?.status).toBe('fail');
    expect(mobEval?.issue).toBe('Buttons too small');

    const dscEval = result.evaluations.find(e => e.heuristicId === 'PDP-DSC-001');
    expect(dscEval?.status).toBe('partial');

    // Phase 23 fix: Verify capturedInputs are populated for batched analysis
    expect(result.capturedInputs).toBeDefined();
    expect(result.capturedInputs!.length).toBe(4); // All 4 categories should have captured inputs

    // Each captured input should have system prompt, user prompt, screenshots, and DOM snapshots
    for (const captured of result.capturedInputs!) {
      expect(captured.categoryName).toBeTruthy();
      expect(captured.systemPrompt).toBeTruthy();
      expect(captured.userPrompt).toBeTruthy();
      expect(captured.screenshots.length).toBeGreaterThan(0);
      expect(captured.domSnapshots.length).toBeGreaterThan(0);
      expect(captured.timestamp).toBeGreaterThan(0);
    }

    // Verify category names in captured inputs
    const capturedNames = result.capturedInputs!.map(c => c.categoryName);
    expect(capturedNames).toContain('Layout & Structure');
    expect(capturedNames).toContain('Mobile Usability');
    expect(capturedNames).toContain('Pricing & Cost Transparency');
    expect(capturedNames).toContain('Description & Value Proposition');
  });

  it('should fall back to single-category on parse failure', async () => {
    let batchCallCount = 0;

    vi.mocked(await import('@langchain/openai')).ChatOpenAI.mockImplementation(function (this: any) {
      this.invoke = async function () {
        batchCallCount++;
        llmInvocations.push({ messages: [] });
        if (batchCallCount === 1) {
          // First batch: return garbage
          return { content: 'NOT VALID JSON {{{{' };
        }
        // Second batch: return valid
        return {
          content: buildBatchedResponseJSON([
            'Pricing & Cost Transparency', 'Description & Value Proposition',
          ]),
        };
      };
    } as any);

    const orchestrator = createAnalysisOrchestrator({
      categoryBatching: true,
      parallelAnalysis: false,
      batchStrategy: 'related',
    });

    const result = await orchestrator.runAnalysis(createMockSnapshots(1), 'pdp' as PageType);

    // Batch 1 failed → fallback to single-category for Layout + Mobile (2 calls)
    expect(singleCategoryInvocations.length).toBe(2);
    expect(singleCategoryInvocations.map(c => c.category)).toContain('Layout & Structure');
    expect(singleCategoryInvocations.map(c => c.category)).toContain('Mobile Usability');

    // 2 batch LLM calls total (1 failed + 1 succeeded)
    expect(llmInvocations.length).toBe(2);

    // All 4 categories should have results
    expect(result.categoryResults.length).toBe(4);

    // Evaluations from both paths should be present
    expect(result.evaluations.length).toBeGreaterThan(0);

    // Pricing from successful batch
    const prcEval = result.evaluations.find(e => e.heuristicId === 'PDP-PRC-001');
    expect(prcEval).toBeDefined();
    expect(prcEval!.status).toBe('pass');
  });
});
