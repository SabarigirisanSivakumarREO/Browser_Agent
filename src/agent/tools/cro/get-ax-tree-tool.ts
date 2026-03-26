/**
 * Get AX Tree Tool
 *
 * P3 browser interaction tool that captures the accessibility tree
 * of the current page for LLM reasoning about page structure.
 * Returns insights: [] (observation tools don't analyze).
 */

import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';
import { captureAccessibilityTree } from '../../../browser/ax-tree-serializer.js';

/**
 * Parameter schema for get_ax_tree tool
 */
export const GetAxTreeParamsSchema = z.object({
  maxTokens: z.coerce.number().positive().optional().default(500),
});

export type GetAxTreeParams = z.infer<typeof GetAxTreeParamsSchema>;

/**
 * Get AX Tree extracted data
 */
interface GetAxTreeExtracted {
  axTree: string | null;
  tokenEstimate?: number;
  reason?: string;
}

/**
 * Get AX Tree Tool Implementation
 */
export const getAxTreeTool: Tool = {
  name: 'get_ax_tree',
  description:
    'Get the accessibility tree of the current page. Returns semantic roles, names, and states for LLM reasoning about page structure.',
  parameters: GetAxTreeParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as GetAxTreeParams;
    const { maxTokens } = params;

    try {
      context.logger.debug(
        `Capturing accessibility tree (maxTokens: ${maxTokens})`
      );

      const result = await captureAccessibilityTree(context.page, {
        maxTokens,
      });

      if (result === null) {
        const extracted: GetAxTreeExtracted = {
          axTree: null,
          reason: 'empty or capture failed',
        };

        return {
          success: true,
          insights: [],
          extracted,
        };
      }

      // Estimate tokens (~4 chars per token)
      const tokenEstimate = Math.ceil(result.length / 4);

      const extracted: GetAxTreeExtracted = {
        axTree: result,
        tokenEstimate,
      };

      context.logger.debug(
        `Captured accessibility tree (~${tokenEstimate} tokens)`
      );

      return {
        success: true,
        insights: [],
        extracted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error(`Get AX tree failed: ${message}`);

      return {
        success: false,
        insights: [],
        error: message,
      };
    }
  },
};

export default getAxTreeTool;
