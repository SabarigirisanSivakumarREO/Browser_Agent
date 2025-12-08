/**
 * Done Tool
 *
 * Phase 17c (T100): Signals analysis completion.
 * CROAgent checks `action.name === 'done'` to exit the agent loop.
 */

import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';

/**
 * Parameter schema for done tool
 */
export const DoneParamsSchema = z.object({
  summary: z.string().min(10).max(1000).describe('Brief summary of analysis findings'),
  confidenceScore: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Confidence in analysis completeness (0-1)'),
  areasAnalyzed: z
    .array(z.string())
    .optional()
    .describe('List of CRO areas that were analyzed'),
});

export type DoneParams = z.infer<typeof DoneParamsSchema>;

/**
 * Done Tool Implementation
 *
 * Signals that the agent has completed its analysis.
 * The CROAgent checks for action.name === 'done' to set isDone state.
 * This tool always returns success with no insights (control tool).
 */
export const doneTool: Tool = {
  name: 'done',
  description:
    'Signal analysis completion. Call when all CRO aspects have been examined or no more actionable elements are found.',
  parameters: DoneParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as DoneParams;

    context.logger.info('Analysis complete', {
      summary: params.summary.slice(0, 100) + (params.summary.length > 100 ? '...' : ''),
      confidenceScore: params.confidenceScore,
      areasAnalyzed: params.areasAnalyzed,
    });

    // Control tool - no insights, just captures completion info
    return {
      success: true,
      insights: [], // Control tool returns empty insights
      extracted: {
        summary: params.summary,
        confidenceScore: params.confidenceScore ?? null,
        areasAnalyzed: params.areasAnalyzed ?? [],
      },
    };
  },
};

export default doneTool;
