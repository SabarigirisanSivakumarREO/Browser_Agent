/**
 * Execute JS Tool
 *
 * Browser interaction tool that executes JavaScript in page context.
 * Returns insights: [] (interaction tools don't analyze).
 */

import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';

/**
 * Parameter schema for execute JS tool
 */
export const ExecuteJsParamsSchema = z.object({
  expression: z.string().min(1),
});

export type ExecuteJsParams = z.infer<typeof ExecuteJsParamsSchema>;

/**
 * Execute JS extracted data
 */
interface ExecuteJsExtracted {
  result: string;
  type: string;
}

/** Max characters for serialized result */
const MAX_RESULT_LENGTH = 8000;

/**
 * Execute JS Tool Implementation
 */
export const executeJsTool: Tool = {
  name: 'execute_js',
  description:
    'Execute JavaScript in page context. Use as escape hatch for interactions not covered by other tools.',
  parameters: ExecuteJsParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as ExecuteJsParams;
    const { expression } = params;

    try {
      const rawResult = await context.page.evaluate(expression);

      // Serialize result
      let serializedResult: string;
      const resultType = typeof rawResult;

      if (rawResult === null || rawResult === undefined) {
        serializedResult = String(rawResult);
      } else if (typeof rawResult === 'object') {
        serializedResult = JSON.stringify(rawResult);
        if (serializedResult.length > MAX_RESULT_LENGTH) {
          serializedResult =
            serializedResult.slice(0, MAX_RESULT_LENGTH) + '...(truncated)';
        }
      } else {
        serializedResult = String(rawResult);
      }

      const extracted: ExecuteJsExtracted = {
        result: serializedResult,
        type: resultType,
      };

      context.logger.debug(
        `Executed JS, result type: ${resultType}`
      );

      return {
        success: true,
        insights: [],
        extracted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error(`Execute JS failed: ${message}`);

      return {
        success: false,
        insights: [],
        error: message,
      };
    }
  },
};

export default executeJsTool;
