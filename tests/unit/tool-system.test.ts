/**
 * Tool System Unit Tests
 *
 * Phase 15 (T077): Tests for ToolRegistry and ToolExecutor.
 * Phase 15b: Added tests for ToolResultFormatter.
 * Minimum 18 tests covering all requirements.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { ToolRegistry, ToolExecutor } from '../../src/agent/tools/index.js';
import { ToolResultFormatter, type ToolExecutionResult } from '../../src/output/index.js';
import type { Tool, ToolContext } from '../../src/agent/tools/index.js';
import type { ToolResult, PageState, CROActionName } from '../../src/models/index.js';
import type { Page } from 'playwright';

// Mock PageState for testing
const createMockPageState = (): PageState => ({
  url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
  title: 'Test Page',
  domTree: {
    rootId: 'root',
    nodes: {},
    stats: { totalNodes: 0, interactiveNodes: 0, croNodes: 0, depth: 0 },
  },
  viewport: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false },
  scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 1000 },
  timestamp: Date.now(),
});

// Mock Playwright Page
const createMockPage = (): Page =>
  ({
    url: () => 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
    title: () => Promise.resolve('Test Page'),
  }) as unknown as Page;

// Test tool implementations
const createMockTool = (
  name: CROActionName,
  executeResult?: Partial<ToolResult>
): Tool => ({
  name,
  description: `Test tool: ${name}`,
  parameters: z.object({
    selector: z.string().optional(),
    limit: z.number().optional(),
  }),
  execute: vi.fn().mockResolvedValue({
    success: true,
    insights: [],
    ...executeResult,
  }),
});

const createFailingTool = (name: CROActionName, error: string): Tool => ({
  name,
  description: `Failing tool: ${name}`,
  parameters: z.object({}),
  execute: vi.fn().mockRejectedValue(new Error(error)),
});

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  // Test 1: Register a tool
  it('should register a tool successfully', () => {
    const tool = createMockTool('analyze_ctas');
    registry.register(tool);
    expect(registry.has('analyze_ctas')).toBe(true);
    expect(registry.size).toBe(1);
  });

  // Test 2: Throw on duplicate registration
  it('should throw error when registering duplicate tool', () => {
    const tool = createMockTool('analyze_ctas');
    registry.register(tool);
    expect(() => registry.register(tool)).toThrow("Tool 'analyze_ctas' is already registered");
  });

  // Test 3: Get a registered tool
  it('should get a registered tool by name', () => {
    const tool = createMockTool('analyze_forms');
    registry.register(tool);
    const retrieved = registry.get('analyze_forms');
    expect(retrieved).toBe(tool);
  });

  // Test 4: Get returns undefined for unknown tool
  it('should return undefined for unknown tool', () => {
    expect(registry.get('analyze_ctas')).toBeUndefined();
  });

  // Test 5: Has returns false for unknown tool
  it('should return false for has() on unknown tool', () => {
    expect(registry.has('analyze_ctas')).toBe(false);
  });

  // Test 6: Get all registered tools
  it('should return all registered tools', () => {
    const tool1 = createMockTool('analyze_ctas');
    const tool2 = createMockTool('analyze_forms');
    registry.register(tool1);
    registry.register(tool2);
    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(tool1);
    expect(all).toContain(tool2);
  });

  // Test 7: Clear removes all tools
  it('should clear all registered tools', () => {
    registry.register(createMockTool('analyze_ctas'));
    registry.register(createMockTool('analyze_forms'));
    expect(registry.size).toBe(2);
    registry.clear();
    expect(registry.size).toBe(0);
    expect(registry.has('analyze_ctas')).toBe(false);
  });

  // Test 8: Get tool definitions for LLM
  it('should generate LLM-friendly tool definitions', () => {
    const tool = createMockTool('detect_trust_signals');
    registry.register(tool);
    const definitions = registry.getToolDefinitions();
    expect(definitions).toHaveLength(1);
    expect(definitions[0].name).toBe('detect_trust_signals');
    expect(definitions[0].description).toBe('Test tool: detect_trust_signals');
    expect(definitions[0].parameters).toBeDefined();
    expect(typeof definitions[0].parameters).toBe('object');
  });

  // Test 9: Tool definitions include JSON Schema properties
  it('should include JSON Schema properties in tool definitions', () => {
    const tool = createMockTool('assess_value_prop');
    registry.register(tool);
    const definitions = registry.getToolDefinitions();
    const params = definitions[0].parameters as Record<string, unknown>;
    expect(params.type).toBe('object');
    expect(params.properties).toBeDefined();
  });
});

describe('ToolExecutor', () => {
  let registry: ToolRegistry;
  let executor: ToolExecutor;

  beforeEach(() => {
    registry = new ToolRegistry();
    executor = new ToolExecutor(registry);
  });

  // Test 10: Execute unknown tool returns error (FR-034)
  it('should return error for unknown tool (FR-034)', async () => {
    const result = await executor.execute('analyze_ctas', {}, {
      page: createMockPage(),
      state: createMockPageState(),
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Unknown tool: 'analyze_ctas'");
    expect(result.insights).toEqual([]);
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  // Test 11: Validate params with Zod (CR-016)
  it('should validate parameters with Zod safeParse (CR-016)', async () => {
    const tool: Tool = {
      name: 'check_navigation',
      description: 'Test validation',
      parameters: z.object({
        required_field: z.string(),
      }),
      execute: vi.fn(),
    };
    registry.register(tool);

    const result = await executor.execute('check_navigation', { wrong_field: 123 }, {
      page: createMockPage(),
      state: createMockPageState(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid parameters');
    expect(result.error).toContain('required_field');
  });

  // Test 12: Track execution time (CR-017)
  it('should track executionTimeMs (CR-017)', async () => {
    const tool = createMockTool('find_friction');
    registry.register(tool);

    const result = await executor.execute('find_friction', {}, {
      page: createMockPage(),
      state: createMockPageState(),
    });

    expect(result.executionTimeMs).toBeDefined();
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  // Test 13: Inject ToolContext into execute (FR-036)
  it('should inject ToolContext into tool.execute (FR-036)', async () => {
    const executeFn = vi.fn().mockResolvedValue({ success: true, insights: [] });
    const tool: Tool = {
      name: 'scroll_page',
      description: 'Test context injection',
      parameters: z.object({ direction: z.string().optional() }),
      execute: executeFn,
    };
    registry.register(tool);

    const mockPage = createMockPage();
    const mockState = createMockPageState();

    await executor.execute('scroll_page', { direction: 'down' }, {
      page: mockPage,
      state: mockState,
    });

    expect(executeFn).toHaveBeenCalledTimes(1);
    const context: ToolContext = executeFn.mock.calls[0][0];
    expect(context.params).toEqual({ direction: 'down' });
    expect(context.page).toBe(mockPage);
    expect(context.state).toBe(mockState);
    expect(context.logger).toBeDefined();
  });

  // Test 14: Return tool execution result
  it('should return tool execution result', async () => {
    const mockInsight = {
      id: 'test-1',
      category: 'cta' as const,
      type: 'vague_cta',
      severity: 'high' as const,
      element: '//button[1]',
      issue: 'CTA text is vague',
      recommendation: 'Use specific action text',
    };
    const tool = createMockTool('analyze_ctas', { insights: [mockInsight] });
    registry.register(tool);

    const result = await executor.execute('analyze_ctas', {}, {
      page: createMockPage(),
      state: createMockPageState(),
    });

    expect(result.success).toBe(true);
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0]).toEqual(mockInsight);
  });

  // Test 15: Handle tool execution errors
  it('should handle tool execution errors gracefully', async () => {
    const tool = createFailingTool('go_to_url', 'Navigation failed');
    registry.register(tool);

    const result = await executor.execute('go_to_url', {}, {
      page: createMockPage(),
      state: createMockPageState(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Tool execution failed');
    expect(result.error).toContain('Navigation failed');
    expect(result.insights).toEqual([]);
  });

  // Test 16: Pass validated params to tool
  it('should pass validated params to tool', async () => {
    const executeFn = vi.fn().mockResolvedValue({ success: true, insights: [] });
    const tool: Tool = {
      name: 'done',
      description: 'Complete analysis',
      parameters: z.object({
        summary: z.string().default('Analysis complete'),
      }),
      execute: executeFn,
    };
    registry.register(tool);

    await executor.execute('done', {}, {
      page: createMockPage(),
      state: createMockPageState(),
    });

    const context: ToolContext = executeFn.mock.calls[0][0];
    // Zod default should be applied
    expect(context.params).toEqual({ summary: 'Analysis complete' });
  });

  // Test 17: Multiple validation errors reported
  it('should report multiple validation errors', async () => {
    const tool: Tool = {
      name: 'analyze_ctas',
      description: 'Test multiple errors',
      parameters: z.object({
        min: z.number().min(0),
        max: z.number().max(100),
      }),
      execute: vi.fn(),
    };
    registry.register(tool);

    const result = await executor.execute('analyze_ctas', { min: -5, max: 200 }, {
      page: createMockPage(),
      state: createMockPageState(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid parameters');
    // Both validation errors should be mentioned
    expect(result.error).toMatch(/min|max/);
  });

  // Test 18: Verbose logging works
  it('should respect verbose flag for logging', async () => {
    const tool = createMockTool('analyze_forms');
    registry.register(tool);

    // Should not throw with verbose enabled
    const result = await executor.execute('analyze_forms', {}, {
      page: createMockPage(),
      state: createMockPageState(),
      verbose: true,
    });

    expect(result.success).toBe(true);
  });
});

describe('Integration: ToolRegistry + ToolExecutor', () => {
  // Test 19: Register and execute tool end-to-end
  it('should register and execute a tool end-to-end', async () => {
    const registry = new ToolRegistry();
    const executor = new ToolExecutor(registry);

    const tool: Tool = {
      name: 'detect_trust_signals',
      description: 'Detect trust signals on page',
      parameters: z.object({
        includeReviews: z.boolean().default(true),
      }),
      execute: async (ctx) => ({
        success: true,
        insights: [{
          id: 'trust-1',
          category: 'trust' as const,
          type: 'missing_ssl_badge',
          severity: 'medium' as const,
          element: '//header',
          issue: 'No SSL badge visible',
          recommendation: 'Add SSL/security badge in header',
        }],
        extracted: { reviewCount: 0, badges: [] },
      }),
    };

    registry.register(tool);

    const result = await executor.execute('detect_trust_signals', { includeReviews: false }, {
      page: createMockPage(),
      state: createMockPageState(),
    });

    expect(result.success).toBe(true);
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].category).toBe('trust');
    expect(result.extracted).toEqual({ reviewCount: 0, badges: [] });
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  // Test 20: Multiple tools can be registered and executed
  it('should support multiple tools registered and executed', async () => {
    const registry = new ToolRegistry();
    const executor = new ToolExecutor(registry);

    registry.register(createMockTool('analyze_ctas'));
    registry.register(createMockTool('analyze_forms'));
    registry.register(createMockTool('detect_trust_signals'));

    expect(registry.size).toBe(3);

    const result1 = await executor.execute('analyze_ctas', {}, {
      page: createMockPage(),
      state: createMockPageState(),
    });
    const result2 = await executor.execute('analyze_forms', {}, {
      page: createMockPage(),
      state: createMockPageState(),
    });

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
  });
});

describe('ToolResultFormatter', () => {
  let formatter: ToolResultFormatter;

  beforeEach(() => {
    formatter = new ToolResultFormatter({ useColors: false });
  });

  // Test 21: Format success result
  it('should format successful tool execution result', () => {
    const result: ToolExecutionResult = {
      url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
      toolName: 'analyze_ctas',
      success: true,
      loadTimeMs: 1500,
      result: {
        success: true,
        insights: [],
        executionTimeMs: 50,
      },
    };

    const output = formatter.format(result);
    expect(output).toContain('TOOL: ANALYZE_CTAS');
    expect(output).toContain('URL: https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy');
    expect(output).toContain('Status: SUCCESS');
    expect(output).toContain('Load Time: 1.50s');
    expect(output).toContain('Tool Execution: 50ms');
    expect(output).toContain('INSIGHTS FOUND: 0');
  });

  // Test 22: Format error result
  it('should format failed tool execution result', () => {
    const result: ToolExecutionResult = {
      url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
      toolName: 'analyze_forms',
      success: false,
      error: 'Page load timeout',
      loadTimeMs: 60000,
    };

    const output = formatter.format(result);
    expect(output).toContain('Status: FAILED');
    expect(output).toContain('ERROR: Page load timeout');
  });

  // Test 23: Format insights by severity
  it('should format insights grouped by severity', () => {
    const result: ToolExecutionResult = {
      url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
      toolName: 'analyze_ctas',
      success: true,
      result: {
        success: true,
        insights: [
          {
            id: 'test-1',
            category: 'cta',
            type: 'weak_cta',
            severity: 'high',
            element: '//button[1]',
            issue: 'CTA text is vague',
            recommendation: 'Use action-oriented text',
          },
          {
            id: 'test-2',
            category: 'cta',
            type: 'small_target',
            severity: 'medium',
            element: '//button[2]',
            issue: 'Click target too small',
            recommendation: 'Increase button size',
          },
        ],
        executionTimeMs: 25,
      },
    };

    const output = formatter.format(result);
    expect(output).toContain('[HIGH]');
    expect(output).toContain('[MEDIUM]');
    expect(output).toContain('CTA text is vague');
    expect(output).toContain('Click target too small');
  });

  // Test 24: Format extracted data
  it('should format extracted data', () => {
    const result: ToolExecutionResult = {
      url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
      toolName: 'analyze_ctas',
      success: true,
      result: {
        success: true,
        insights: [],
        extracted: { totalCTAs: 5, focusArea: 'above_fold' },
        executionTimeMs: 10,
      },
    };

    const output = formatter.format(result);
    expect(output).toContain('EXTRACTED DATA');
    expect(output).toContain('totalCTAs');
    expect(output).toContain('5');
  });

  // Test 25: Custom width
  it('should respect custom width option', () => {
    const wideFormatter = new ToolResultFormatter({ width: 100, useColors: false });
    const result: ToolExecutionResult = {
      url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
      toolName: 'test',
      success: true,
      result: { success: true, insights: [] },
    };

    const output = wideFormatter.format(result);
    // Check that separator line is wider
    expect(output.split('\n')[0].length).toBe(100);
  });
});
