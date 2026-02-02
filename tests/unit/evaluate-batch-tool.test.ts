/**
 * Evaluate Batch Tool Unit Tests - Phase 21i (T376)
 *
 * Tests for element reference extraction in batch evaluations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEvaluateBatchTool } from '../../src/agent/vision/tools/evaluate-batch-tool.js';
import type { VisionToolContext, VisionAgentState, HeuristicDefinition, BatchEvaluation } from '../../src/agent/vision/types.js';
import type { Page } from 'playwright';

// Mock logger
vi.mock('../../src/utils/index.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Create mock context
const createMockContext = (): VisionToolContext => {
  const definitions = new Map<string, HeuristicDefinition>();
  definitions.set('PDP-CTA-001', {
    id: 'PDP-CTA-001',
    principle: 'CTA should be prominent',
    severity: 'critical',
    category: 'CTA',
  });
  definitions.set('PDP-PRICE-001', {
    id: 'PDP-PRICE-001',
    principle: 'Price should be visible',
    severity: 'high',
    category: 'Pricing',
  });

  return {
    page: {} as Page,
    state: {
      step: 0,
      snapshots: [],
      currentScrollY: 0,
      pageHeight: 3000,
      viewportHeight: 768,
      viewport: { width: 1024, height: 768, deviceScaleFactor: 1, isMobile: false },
      allHeuristicIds: ['PDP-CTA-001', 'PDP-PRICE-001'],
      evaluatedHeuristicIds: new Set<string>(),
      pendingHeuristicIds: ['PDP-CTA-001', 'PDP-PRICE-001'],
      evaluations: [],
      isDone: false,
      consecutiveFailures: 0,
    } as VisionAgentState,
    options: {
      model: 'gpt-4o-mini' as const,
      maxSteps: 20,
      batchSize: 6,
      scrollIncrement: 500,
      verbose: false,
      domTokenBudget: 4000,
      maxResponseTokens: 4096,
      temperature: 0.1,
      maxConsecutiveFailures: 3,
    },
    pageType: 'product',
    heuristicDefinitions: definitions,
  };
};

describe('createEvaluateBatchTool', () => {
  let tool: ReturnType<typeof createEvaluateBatchTool>;

  beforeEach(() => {
    tool = createEvaluateBatchTool();
  });

  describe('element reference extraction (Phase 21i T376)', () => {
    // Test 1: Extracts elementIndices from observation text when not explicitly provided
    it('should extract element indices from observation text when not provided', async () => {
      const context = createMockContext();
      const input = {
        evaluations: [
          {
            heuristicId: 'PDP-CTA-001',
            status: 'fail',
            observation: 'Element [0] has poor contrast and [3] is too small',
            confidence: 0.9,
            // No elementIndices provided
          },
        ],
      };

      const result = await tool.execute(input, context) as any;

      expect(result.success).toBe(true);
      expect(result._validatedEvaluations).toHaveLength(1);
      expect(result._validatedEvaluations[0].elementIndices).toEqual([0, 3]);
    });

    // Test 2: Extracts from issue field
    it('should extract element indices from issue field', async () => {
      const context = createMockContext();
      const input = {
        evaluations: [
          {
            heuristicId: 'PDP-CTA-001',
            status: 'fail',
            observation: 'CTA needs improvement',
            issue: 'Button [5] is not prominent enough',
            confidence: 0.8,
          },
        ],
      };

      const result = await tool.execute(input, context) as any;

      expect(result._validatedEvaluations[0].elementIndices).toEqual([5]);
    });

    // Test 3: Extracts from recommendation field
    it('should extract element indices from recommendation field', async () => {
      const context = createMockContext();
      const input = {
        evaluations: [
          {
            heuristicId: 'PDP-CTA-001',
            status: 'fail',
            observation: 'Issues found',
            recommendation: 'Make [2] larger and move [7] above the fold',
            confidence: 0.85,
          },
        ],
      };

      const result = await tool.execute(input, context) as any;

      expect(result._validatedEvaluations[0].elementIndices).toContain(2);
      expect(result._validatedEvaluations[0].elementIndices).toContain(7);
    });

    // Test 4: Combines indices from all text fields
    it('should combine indices from all text fields', async () => {
      const context = createMockContext();
      const input = {
        evaluations: [
          {
            heuristicId: 'PDP-CTA-001',
            status: 'fail',
            observation: 'Element [1] is the main CTA',
            issue: 'Button [3] has poor contrast',
            recommendation: 'Fix [1] and [5] for better UX',
            confidence: 0.9,
          },
        ],
      };

      const result = await tool.execute(input, context) as any;

      expect(result._validatedEvaluations[0].elementIndices).toEqual([1, 3, 5]);
    });

    // Test 5: Prefers explicitly provided elementIndices over extracted
    it('should use explicitly provided elementIndices', async () => {
      const context = createMockContext();
      const input = {
        evaluations: [
          {
            heuristicId: 'PDP-CTA-001',
            status: 'fail',
            observation: 'Element [0] and [5] have issues',
            elementIndices: [10, 20], // Explicitly provided
            confidence: 0.9,
          },
        ],
      };

      const result = await tool.execute(input, context) as any;

      expect(result._validatedEvaluations[0].elementIndices).toEqual([10, 20]);
    });

    // Test 6: Handles no element references in text
    it('should handle text without element references', async () => {
      const context = createMockContext();
      const input = {
        evaluations: [
          {
            heuristicId: 'PDP-CTA-001',
            status: 'pass',
            observation: 'The CTA is clearly visible and prominent',
            confidence: 0.95,
          },
        ],
      };

      const result = await tool.execute(input, context) as any;

      expect(result._validatedEvaluations[0].elementIndices).toBeUndefined();
    });

    // Test 7: Returns sorted unique indices
    it('should return sorted unique indices', async () => {
      const context = createMockContext();
      const input = {
        evaluations: [
          {
            heuristicId: 'PDP-CTA-001',
            status: 'fail',
            observation: '[5] is mentioned, then [0], then [5] again, and [2]',
            confidence: 0.9,
          },
        ],
      };

      const result = await tool.execute(input, context) as any;

      expect(result._validatedEvaluations[0].elementIndices).toEqual([0, 2, 5]);
    });
  });

  describe('validation', () => {
    // Test 8: Validates basic evaluation structure
    it('should validate basic evaluation structure', async () => {
      const context = createMockContext();
      const input = {
        evaluations: [
          {
            heuristicId: 'PDP-CTA-001',
            status: 'pass',
            observation: 'CTA looks good',
            confidence: 0.9,
          },
        ],
      };

      const result = await tool.execute(input, context);

      expect(result.success).toBe(true);
    });

    // Test 9: Rejects invalid status
    it('should reject invalid status', async () => {
      const context = createMockContext();
      const input = {
        evaluations: [
          {
            heuristicId: 'PDP-CTA-001',
            status: 'invalid_status',
            observation: 'Test',
            confidence: 0.9,
          },
        ],
      };

      const result = await tool.execute(input, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid');
    });

    // Test 10: Rejects missing required fields
    it('should reject missing required fields', async () => {
      const context = createMockContext();
      const input = {
        evaluations: [
          {
            heuristicId: 'PDP-CTA-001',
            status: 'pass',
            // Missing observation
            confidence: 0.9,
          },
        ],
      };

      const result = await tool.execute(input, context);

      expect(result.success).toBe(false);
    });
  });
});
