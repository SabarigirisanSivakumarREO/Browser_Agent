/**
 * Tool Executor
 *
 * Phase 15 (T075): Executes tools with validation, timing, and error handling.
 * Owns all cross-cutting concerns so tools stay focused on their logic.
 */

import type { ToolResult, CROActionName } from '../../models/index.js';
import type { ToolRegistry } from './tool-registry.js';
import type { ExecutionContext, ToolContext } from './types.js';
import { createLogger } from '../../utils/logger.js';

/**
 * ToolExecutor - Executes tools with validation and instrumentation
 *
 * Responsibilities:
 * - Validate params with Zod safeParse() (CR-016)
 * - Track executionTimeMs (CR-017)
 * - Return success=false for unknown tools (FR-034)
 * - Return success=false with Zod error for invalid params (FR-035)
 * - Inject ToolContext into tool.execute() (FR-036)
 * - Log execution with name, params, result (FR-038)
 */
export class ToolExecutor {
  private readonly registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  /**
   * Execute a tool by name with given parameters
   *
   * @param name - Tool name to execute
   * @param params - Raw parameters (will be validated)
   * @param context - Execution context (page, state)
   * @returns ToolResult with success status, insights, and timing
   */
  async execute(
    name: CROActionName,
    params: unknown,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const startTime = performance.now();
    const logger = createLogger(`ToolExecutor:${name}`, context.verbose ?? false);

    logger.debug('Starting tool execution', { name, params });

    // FR-034: Unknown tool check
    const tool = this.registry.get(name);
    if (!tool) {
      const result: ToolResult = {
        success: false,
        insights: [],
        error: `Unknown tool: '${name}'`,
        executionTimeMs: performance.now() - startTime,
      };
      logger.warn('Unknown tool requested', { name, result });
      return result;
    }

    // CR-016: Validate params with safeParse
    const parseResult = tool.parameters.safeParse(params);
    if (!parseResult.success) {
      const errorMessage = parseResult.error.issues
        .map((e) => `${e.path.map(String).join('.')}: ${e.message}`)
        .join('; ');

      const result: ToolResult = {
        success: false,
        insights: [],
        error: `Invalid parameters: ${errorMessage}`,
        executionTimeMs: performance.now() - startTime,
      };
      logger.warn('Parameter validation failed', { name, params, error: errorMessage });
      return result;
    }

    // FR-036: Build ToolContext with validated params
    const toolContext: ToolContext = {
      params: parseResult.data,
      page: context.page,
      state: context.state,
      logger: createLogger(`Tool:${name}`, context.verbose ?? false),
    };

    // Execute tool with error handling
    try {
      const result = await tool.execute(toolContext);

      // CR-017: Add execution time
      result.executionTimeMs = performance.now() - startTime;

      // FR-038: Log execution result
      logger.debug('Tool execution completed', {
        name,
        success: result.success,
        insightCount: result.insights.length,
        executionTimeMs: result.executionTimeMs,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const result: ToolResult = {
        success: false,
        insights: [],
        error: `Tool execution failed: ${errorMessage}`,
        executionTimeMs: performance.now() - startTime,
      };

      logger.error('Tool execution threw an error', {
        name,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return result;
    }
  }
}
