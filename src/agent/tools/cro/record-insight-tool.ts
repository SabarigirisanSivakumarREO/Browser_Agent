/**
 * Record Insight Tool
 *
 * Phase 17c (T099): Allows LLM to manually record a CRO observation
 * not covered by automated tools.
 *
 * Use cases:
 * 1. LLM notices visual issue from DOM structure
 * 2. LLM infers business context issue
 * 3. Cross-element patterns
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult, CROInsight } from '../../../models/index.js';

/**
 * Create a unique insight ID
 */
function createInsightId(): string {
  return randomUUID().slice(0, 8);
}

/**
 * Parameter schema for record_insight tool
 */
export const RecordInsightParamsSchema = z.object({
  type: z.string().min(1).max(50).describe('Specific issue type identifier'),
  severity: z.enum(['critical', 'high', 'medium', 'low']).describe('Issue severity level'),
  element: z.string().optional().describe('XPath of the related element'),
  issue: z.string().min(10).max(500).describe('Human-readable issue description'),
  recommendation: z.string().min(10).max(500).describe('Actionable fix recommendation'),
  category: z
    .enum(['cta', 'form', 'trust', 'value_prop', 'navigation', 'custom'])
    .optional()
    .default('custom')
    .describe('CRO category for the insight'),
});

export type RecordInsightParams = z.infer<typeof RecordInsightParamsSchema>;

/**
 * Record Insight Tool Implementation
 *
 * Creates a CROInsight from LLM-provided parameters.
 * Returns the recorded insight in the insights array.
 */
export const recordInsightTool: Tool = {
  name: 'record_insight',
  description:
    'Manually record a CRO observation not covered by other tools. Use when you identify an issue through DOM analysis or cross-element patterns.',
  parameters: RecordInsightParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as RecordInsightParams;
    const insightId = createInsightId();

    context.logger.debug('Recording manual insight', {
      type: params.type,
      severity: params.severity,
      category: params.category,
    });

    const insight: CROInsight = {
      id: insightId,
      type: params.type,
      severity: params.severity,
      element: params.element || '',
      issue: params.issue,
      recommendation: params.recommendation,
      category: params.category === 'custom' ? 'friction' : params.category,
    };

    context.logger.info('Recorded manual insight', { id: insightId, type: params.type });

    return {
      success: true,
      insights: [insight],
      extracted: {
        insightId,
        type: params.type,
        category: params.category,
      },
    };
  },
};

export default recordInsightTool;
