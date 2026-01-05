/**
 * CRO Tools Integration Tests
 *
 * Phase 17c (T101): Integration tests for the complete CRO tool system.
 * Tests:
 * - Tool execution with mock PageState (5 tests)
 * - Tool chaining: scroll → analyze → record (3 tests)
 * - Error propagation through ToolExecutor (4 tests)
 * - ToolResult schema validation (3 tests)
 * - createCRORegistry() returns all 11 tools (3 tests)
 * Total: 18 tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { ToolRegistry, ToolExecutor } from '../../src/agent/tools/index.js';
import { createCRORegistry } from '../../src/agent/tools/create-cro-registry.js';
import {
  scrollPageTool,
  ScrollPageParamsSchema,
  clickTool,
  ClickParamsSchema,
  goToUrlTool,
  GoToUrlParamsSchema,
  analyzeCTAsTool,
  analyzeFormsTool,
  analyzeTrustTool,
  analyzeValuePropTool,
  checkNavigationTool,
  findFrictionTool,
  recordInsightTool,
  RecordInsightParamsSchema,
  doneTool,
  DoneParamsSchema,
} from '../../src/agent/tools/cro/index.js';
import type { ToolContext, ExecutionContext } from '../../src/agent/tools/types.js';
import type { PageState, DOMNode, DOMTree, CROInsight } from '../../src/models/index.js';
import { CROInsightSchema } from '../../src/models/index.js';
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
 * Create mock DOMTree with CRO elements
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
    interactiveCount: children.filter((c) => c.isInteractive).length,
    croElementCount: children.filter((c) => c.croType !== null).length,
    totalNodeCount: 1 + children.length,
    extractedAt: Date.now(),
  };
}

/**
 * Create mock PageState
 */
function createMockPageState(overrides: Partial<PageState> = {}): PageState {
  return {
    url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
    title: 'Test Page',
    domTree: createMockDOMTree([
      createMockDOMNode({
        tagName: 'BUTTON',
        xpath: '//button[1]',
        text: 'Buy Now',
        croType: 'cta',
        isInteractive: true,
        index: 0,
        boundingBox: { x: 100, y: 100, width: 150, height: 40 },
      }),
      createMockDOMNode({
        tagName: 'FORM',
        xpath: '//form[1]',
        text: '',
        croType: 'form',
        children: [
          createMockDOMNode({
            tagName: 'INPUT',
            xpath: '//form[1]/input[1]',
            text: 'type="email" placeholder="Email"',
            croType: 'form',
          }),
        ],
      }),
    ]),
    viewport: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false },
    scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 2000 },
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Create mock Playwright Page with scroll support
 */
function createMockPage(options: { scrollY?: number; maxScrollY?: number } = {}): Page {
  const { scrollY = 0, maxScrollY = 2000 } = options;
  let currentScrollY = scrollY;

  return {
    url: vi.fn().mockReturnValue('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy'),
    evaluate: vi.fn().mockImplementation((fn: unknown) => {
      if (typeof fn === 'function') {
        // Handle scroll evaluation
        const fnStr = fn.toString();
        if (fnStr.includes('scrollY')) {
          return Promise.resolve(currentScrollY);
        }
        if (fnStr.includes('scrollHeight')) {
          return Promise.resolve(maxScrollY);
        }
        if (fnStr.includes('scrollBy') || fnStr.includes('scrollTo')) {
          // Simulate scroll
          return Promise.resolve(undefined);
        }
      }
      return Promise.resolve(undefined);
    }),
    goto: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    locator: vi.fn().mockReturnValue({
      click: vi.fn().mockResolvedValue(undefined),
    }),
  } as unknown as Page;
}

/**
 * Create mock ToolContext
 */
function createMockContext(
  params: unknown = {},
  stateOverrides: Partial<PageState> = {},
  pageOptions: { scrollY?: number; maxScrollY?: number } = {}
): ToolContext {
  return {
    params,
    page: createMockPage(pageOptions),
    state: createMockPageState(stateOverrides),
    logger: createLogger({ verbose: false }),
  };
}

/**
 * Create mock ExecutionContext for ToolExecutor
 */
function createMockExecutionContext(
  stateOverrides: Partial<PageState> = {},
  pageOptions: { scrollY?: number; maxScrollY?: number } = {}
): ExecutionContext {
  return {
    page: createMockPage(pageOptions),
    state: createMockPageState(stateOverrides),
  };
}

// ============================================================================
// TEST SUITE: createCRORegistry (3 tests)
// ============================================================================

describe('createCRORegistry', () => {
  it('returns registry with all 11 tools', () => {
    const registry = createCRORegistry();
    expect(registry.size).toBe(11);
  });

  it('includes all analysis tools', () => {
    const registry = createCRORegistry();
    expect(registry.has('analyze_ctas')).toBe(true);
    expect(registry.has('analyze_forms')).toBe(true);
    expect(registry.has('detect_trust_signals')).toBe(true);
    expect(registry.has('assess_value_prop')).toBe(true);
    expect(registry.has('check_navigation')).toBe(true);
    expect(registry.has('find_friction')).toBe(true);
  });

  it('includes all navigation and control tools', () => {
    const registry = createCRORegistry();
    // Navigation tools
    expect(registry.has('scroll_page')).toBe(true);
    expect(registry.has('click')).toBe(true);
    expect(registry.has('go_to_url')).toBe(true);
    // Control tools
    expect(registry.has('record_insight')).toBe(true);
    expect(registry.has('done')).toBe(true);
  });
});

// ============================================================================
// TEST SUITE: Tool Execution with Mock PageState (5 tests)
// ============================================================================

describe('Tool Execution with Mock PageState', () => {
  let registry: ToolRegistry;
  let executor: ToolExecutor;

  beforeEach(() => {
    registry = createCRORegistry();
    executor = new ToolExecutor(registry);
  });

  it('executes scroll_page tool with mock page', async () => {
    const context = createMockExecutionContext();
    const result = await executor.execute(
      'scroll_page',
      { direction: 'down', amount: 500 },
      context
    );

    expect(result.success).toBe(true);
    expect(result.insights).toEqual([]);
    expect(result.extracted).toBeDefined();
  });

  it('executes analyze_ctas tool with mock DOM', async () => {
    const context = createMockExecutionContext();
    const result = await executor.execute('analyze_ctas', { focusArea: 'full_page' }, context);

    expect(result.success).toBe(true);
    expect(Array.isArray(result.insights)).toBe(true);
  });

  it('executes record_insight tool with valid params', async () => {
    const params = RecordInsightParamsSchema.parse({
      type: 'test_issue',
      severity: 'medium',
      issue: 'This is a test issue for integration testing',
      recommendation: 'This is a test recommendation for the issue',
      category: 'cta',
    });

    const context = createMockExecutionContext();
    const result = await executor.execute('record_insight', params, context);

    expect(result.success).toBe(true);
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].type).toBe('test_issue');
    expect(result.insights[0].severity).toBe('medium');
  });

  it('executes done tool with summary', async () => {
    const params = DoneParamsSchema.parse({
      summary: 'Analysis complete. Found 3 CRO issues.',
      confidenceScore: 0.9,
      areasAnalyzed: ['cta', 'form', 'trust'],
    });

    const context = createMockExecutionContext();
    const result = await executor.execute('done', params, context);

    expect(result.success).toBe(true);
    expect(result.insights).toEqual([]);
    expect(result.extracted).toMatchObject({
      summary: 'Analysis complete. Found 3 CRO issues.',
      confidenceScore: 0.9,
      areasAnalyzed: ['cta', 'form', 'trust'],
    });
  });

  it('executes find_friction tool across categories', async () => {
    const context = createMockExecutionContext();
    const result = await executor.execute(
      'find_friction',
      { categories: ['cta', 'form'] },
      context
    );

    expect(result.success).toBe(true);
    expect(Array.isArray(result.insights)).toBe(true);
  });
});

// ============================================================================
// TEST SUITE: Tool Chaining (3 tests)
// ============================================================================

describe('Tool Chaining: scroll → analyze → record', () => {
  let registry: ToolRegistry;
  let executor: ToolExecutor;

  beforeEach(() => {
    registry = createCRORegistry();
    executor = new ToolExecutor(registry);
  });

  it('chains scroll then analyze_ctas', async () => {
    const context = createMockExecutionContext();

    // Step 1: Scroll down
    const scrollResult = await executor.execute(
      'scroll_page',
      { direction: 'down', amount: 500 },
      context
    );
    expect(scrollResult.success).toBe(true);

    // Step 2: Analyze CTAs
    const analyzeResult = await executor.execute(
      'analyze_ctas',
      { focusArea: 'full_page' },
      context
    );
    expect(analyzeResult.success).toBe(true);
  });

  it('chains analyze then record_insight', async () => {
    const context = createMockExecutionContext();

    // Step 1: Analyze value proposition
    const analyzeResult = await executor.execute('assess_value_prop', {}, context);
    expect(analyzeResult.success).toBe(true);

    // Step 2: Record additional insight based on analysis
    const recordParams = RecordInsightParamsSchema.parse({
      type: 'manual_observation',
      severity: 'low',
      issue: 'Observed additional pattern during value prop analysis',
      recommendation: 'Consider enhancing the headline with specific benefits',
      category: 'value_prop',
    });

    const recordResult = await executor.execute('record_insight', recordParams, context);
    expect(recordResult.success).toBe(true);
    expect(recordResult.insights).toHaveLength(1);
  });

  it('chains multiple tools ending with done', async () => {
    const context = createMockExecutionContext();
    const allInsights: CROInsight[] = [];

    // Step 1: Analyze forms
    const formResult = await executor.execute('analyze_forms', {}, context);
    expect(formResult.success).toBe(true);
    allInsights.push(...formResult.insights);

    // Step 2: Analyze trust
    const trustResult = await executor.execute('detect_trust_signals', {}, context);
    expect(trustResult.success).toBe(true);
    allInsights.push(...trustResult.insights);

    // Step 3: Done
    const doneParams = DoneParamsSchema.parse({
      summary: `Analysis complete. Found ${allInsights.length} issues.`,
      areasAnalyzed: ['form', 'trust'],
    });

    const doneResult = await executor.execute('done', doneParams, context);
    expect(doneResult.success).toBe(true);
    expect(doneResult.insights).toEqual([]);
  });
});

// ============================================================================
// TEST SUITE: Error Propagation (4 tests)
// ============================================================================

describe('Error Propagation through ToolExecutor', () => {
  let registry: ToolRegistry;
  let executor: ToolExecutor;

  beforeEach(() => {
    registry = createCRORegistry();
    executor = new ToolExecutor(registry);
  });

  it('returns error for unknown tool name', async () => {
    const context = createMockExecutionContext();
    // @ts-expect-error - intentionally passing invalid tool name
    const result = await executor.execute('unknown_tool', {}, context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown tool');
    expect(result.insights).toEqual([]);
  });

  it('returns error for invalid params', async () => {
    const context = createMockExecutionContext();
    const result = await executor.execute(
      'scroll_page',
      { direction: 'invalid_direction' },
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Invalid');
  });

  it('returns error for record_insight with short issue text', async () => {
    const context = createMockExecutionContext();
    const result = await executor.execute(
      'record_insight',
      {
        type: 'test',
        severity: 'low',
        issue: 'short', // Less than 10 chars
        recommendation: 'This is a valid recommendation text',
      },
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error for done with short summary', async () => {
    const context = createMockExecutionContext();
    const result = await executor.execute(
      'done',
      { summary: 'short' }, // Less than 10 chars
      context
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// TEST SUITE: ToolResult Schema Validation (3 tests)
// ============================================================================

describe('ToolResult Schema Validation', () => {
  let registry: ToolRegistry;
  let executor: ToolExecutor;

  beforeEach(() => {
    registry = createCRORegistry();
    executor = new ToolExecutor(registry);
  });

  it('record_insight returns valid CROInsight schema', async () => {
    const params = RecordInsightParamsSchema.parse({
      type: 'test_type',
      severity: 'high',
      element: '//button[1]',
      issue: 'This is a test issue description',
      recommendation: 'This is a test recommendation',
      category: 'cta',
    });

    const context = createMockExecutionContext();
    const result = await executor.execute('record_insight', params, context);

    expect(result.success).toBe(true);
    expect(result.insights).toHaveLength(1);

    const insight = result.insights[0];
    const validation = CROInsightSchema.safeParse(insight);
    expect(validation.success).toBe(true);
  });

  it('analysis tool returns valid CROInsight array', async () => {
    const context = createMockExecutionContext();
    const result = await executor.execute('analyze_ctas', {}, context);

    expect(result.success).toBe(true);
    expect(Array.isArray(result.insights)).toBe(true);

    // Validate each insight if any
    for (const insight of result.insights) {
      const validation = CROInsightSchema.safeParse(insight);
      expect(validation.success).toBe(true);
    }
  });

  it('control tools return empty insights array', async () => {
    const params = DoneParamsSchema.parse({
      summary: 'Analysis complete with valid summary text.',
    });

    const context = createMockExecutionContext();
    const result = await executor.execute('done', params, context);

    expect(result.success).toBe(true);
    expect(result.insights).toEqual([]);
    expect(Array.isArray(result.insights)).toBe(true);
  });
});
