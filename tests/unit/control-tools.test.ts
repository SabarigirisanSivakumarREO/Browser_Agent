/**
 * Control Tools Unit Tests
 *
 * Phase 17c (T100a): Tests for control tools.
 * - record_insight: 5 tests
 * - done: 4 tests
 * Total: 9 tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  recordInsightTool,
  RecordInsightParamsSchema,
  doneTool,
  DoneParamsSchema,
} from '../../src/agent/tools/cro/index.js';
import type { ToolContext } from '../../src/agent/tools/types.js';
import type { PageState, DOMNode, DOMTree } from '../../src/models/index.js';
import type { Page } from 'playwright';
import { createLogger } from '../../src/utils/logger.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create mock DOMNode with defaults
 */
function createMockDOMNode(overrides: Partial<DOMNode> = {}): DOMNode {
  return {
    tagName: 'div',
    xpath: '//div[1]',
    text: '',
    attributes: {},
    children: [],
    isVisible: true,
    isInteractive: false,
    croType: null,
    boundingBox: { x: 100, y: 100, width: 200, height: 50 },
    ...overrides,
  };
}

/**
 * Create mock DOMTree
 */
function createMockDOMTree(children: DOMNode[] = []): DOMTree {
  const root: DOMNode = {
    tagName: 'body',
    xpath: '//body',
    text: '',
    attributes: {},
    children,
    isVisible: true,
    isInteractive: false,
    croType: null,
  };

  return {
    root,
    interactiveCount: 0,
    croElementCount: 0,
    totalNodeCount: 1,
    extractedAt: Date.now(),
  };
}

/**
 * Create mock PageState
 */
function createMockPageState(overrides: Partial<PageState> = {}): PageState {
  return {
    url: 'https://example.com',
    title: 'Test Page',
    domTree: createMockDOMTree(),
    viewport: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false },
    scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 2000 },
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Create mock Playwright Page
 */
function createMockPage(): Page {
  return {
    url: vi.fn().mockReturnValue('https://example.com'),
    evaluate: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page;
}

/**
 * Create mock ToolContext
 */
function createMockContext(
  params: unknown = {},
  stateOverrides: Partial<PageState> = {}
): ToolContext {
  return {
    params,
    page: createMockPage(),
    state: createMockPageState(stateOverrides),
    logger: createLogger({ verbose: false }),
  };
}

// ============================================================================
// record_insight TOOL TESTS (5 tests)
// ============================================================================

describe('record_insight tool', () => {
  describe('schema validation', () => {
    it('validates required fields', () => {
      const validParams = {
        type: 'custom_issue',
        severity: 'high',
        issue: 'This is a custom issue description',
        recommendation: 'This is a custom recommendation',
      };

      const result = RecordInsightParamsSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('rejects empty type', () => {
      const invalidParams = {
        type: '',
        severity: 'high',
        issue: 'This is an issue',
        recommendation: 'This is a recommendation',
      };

      const result = RecordInsightParamsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it('rejects invalid severity', () => {
      const invalidParams = {
        type: 'custom_issue',
        severity: 'extreme',
        issue: 'This is an issue',
        recommendation: 'This is a recommendation',
      };

      const result = RecordInsightParamsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it('rejects short issue text', () => {
      const invalidParams = {
        type: 'custom_issue',
        severity: 'high',
        issue: 'short',
        recommendation: 'This is a valid recommendation',
      };

      const result = RecordInsightParamsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });
  });

  describe('execution', () => {
    it('records valid insight with auto-generated ID', async () => {
      const params = {
        type: 'visual_hierarchy_issue',
        severity: 'medium' as const,
        element: '//button[1]',
        issue: 'Login button has same color as background, making it hard to see',
        recommendation: 'Increase contrast ratio to meet WCAG AA standards',
        category: 'cta' as const,
      };

      const context = createMockContext(params);
      const result = await recordInsightTool.execute(context);

      expect(result.success).toBe(true);
      expect(result.insights).toHaveLength(1);

      const insight = result.insights[0];
      expect(insight.id).toBeDefined();
      expect(insight.id).toHaveLength(8);
      expect(insight.type).toBe('visual_hierarchy_issue');
      expect(insight.severity).toBe('medium');
      expect(insight.element).toBe('//button[1]');
      expect(insight.issue).toContain('Login button');
      expect(insight.recommendation).toContain('WCAG');
      expect(insight.category).toBe('cta');

      expect(result.extracted).toEqual({
        insightId: insight.id,
        type: 'visual_hierarchy_issue',
        category: 'cta',
      });
    });

    it('defaults category to custom (mapped to friction)', async () => {
      const rawParams = {
        type: 'layout_issue',
        severity: 'low' as const,
        issue: 'Content is too wide for mobile viewport',
        recommendation: 'Add responsive breakpoints for mobile devices',
      };

      // In production, ToolExecutor validates params through schema first
      // This applies the default category value
      const validatedParams = RecordInsightParamsSchema.parse(rawParams);
      const context = createMockContext(validatedParams);
      const result = await recordInsightTool.execute(context);

      expect(result.success).toBe(true);
      const insight = result.insights[0];
      expect(insight.category).toBe('friction');
    });

    it('handles optional element parameter', async () => {
      const params = {
        type: 'pricing_clarity',
        severity: 'high' as const,
        issue: 'Pricing information is unclear for enterprise tier',
        recommendation: 'Add detailed pricing breakdown for enterprise customers',
      };

      const context = createMockContext(params);
      const result = await recordInsightTool.execute(context);

      expect(result.success).toBe(true);
      const insight = result.insights[0];
      expect(insight.element).toBe('');
    });
  });
});

// ============================================================================
// done TOOL TESTS (4 tests)
// ============================================================================

describe('done tool', () => {
  describe('schema validation', () => {
    it('validates required summary field', () => {
      const validParams = {
        summary: 'Analysis complete. Found 5 CRO issues across forms and CTAs.',
      };

      const result = DoneParamsSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('rejects short summary', () => {
      const invalidParams = {
        summary: 'Done',
      };

      const result = DoneParamsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it('validates confidenceScore range', () => {
      const invalidParams = {
        summary: 'Analysis complete with high confidence',
        confidenceScore: 1.5,
      };

      const result = DoneParamsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });
  });

  describe('execution', () => {
    it('returns success with empty insights (control tool)', async () => {
      const params = {
        summary:
          'Completed CRO analysis. Found 3 high-priority issues: missing trust badges, vague CTA text, and form with too many fields.',
        confidenceScore: 0.85,
        areasAnalyzed: ['cta', 'form', 'trust', 'value_prop'],
      };

      const context = createMockContext(params);
      const result = await doneTool.execute(context);

      expect(result.success).toBe(true);
      expect(result.insights).toHaveLength(0);
      expect(result.insights).toEqual([]);

      expect(result.extracted).toEqual({
        summary: params.summary,
        confidenceScore: 0.85,
        areasAnalyzed: ['cta', 'form', 'trust', 'value_prop'],
      });
    });

    it('handles missing optional parameters', async () => {
      const params = {
        summary: 'Basic analysis complete. No major issues found.',
      };

      const context = createMockContext(params);
      const result = await doneTool.execute(context);

      expect(result.success).toBe(true);
      expect(result.extracted).toEqual({
        summary: params.summary,
        confidenceScore: null,
        areasAnalyzed: [],
      });
    });
  });
});
