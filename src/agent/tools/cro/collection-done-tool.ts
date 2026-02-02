/**
 * Collection Done Tool - CR-001-B
 *
 * Signals the end of the collection phase in the unified CRO agent.
 * After this tool is called, the agent transitions to the analysis phase
 * where collected DOM + screenshots are sent to the LLM for heuristic evaluation.
 */

import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';

/**
 * Zod schema for collection_done parameters
 */
export const CollectionDoneParamsSchema = z.object({
  summary: z.string().describe('Brief summary of what was collected'),
  viewportCount: z.number().min(1).describe('Number of viewports captured'),
  scrollCoverage: z.number().min(0).max(100).describe('Estimated scroll coverage percentage (0-100)'),
});

export type CollectionDoneParams = z.infer<typeof CollectionDoneParamsSchema>;

/**
 * Collection done tool definition
 *
 * Signals that the collection phase is complete and the agent should
 * transition to the analysis phase.
 *
 * The agent should only call this after:
 * 1. Capturing at least one viewport snapshot
 * 2. Scrolling through enough of the page to cover key content
 * 3. Ideally reaching the bottom of the page
 */
export const collectionDoneTool: Tool = {
  name: 'collection_done',
  description:
    'Signals that you have finished collecting viewport snapshots and are ready for analysis. ' +
    'Call this ONLY after you have: ' +
    '1) Captured multiple viewports by scrolling down the page ' +
    '2) Covered at least the above-fold content and key page sections ' +
    '3) Preferably scrolled to the bottom of the page. ' +
    'After calling this, the system will analyze all collected data against heuristics.',
  parameters: CollectionDoneParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as CollectionDoneParams;
    const { logger } = context;

    logger.info('Collection phase completed', {
      viewportCount: params.viewportCount,
      scrollCoverage: `${params.scrollCoverage}%`,
      summary: params.summary,
    });

    // The actual phase transition is handled by the CROAgent
    // This tool just validates and logs the completion

    return {
      success: true,
      insights: [],
      extracted: {
        message: `Collection complete. ${params.viewportCount} viewports captured with ${params.scrollCoverage}% scroll coverage. Transitioning to analysis phase.`,
        summary: params.summary,
        viewportCount: params.viewportCount,
        scrollCoverage: params.scrollCoverage,
      },
    };
  },
};
