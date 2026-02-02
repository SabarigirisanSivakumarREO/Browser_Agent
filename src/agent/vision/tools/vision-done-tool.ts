/**
 * Vision Done Tool - Phase 21g (T341)
 *
 * Signals that the vision agent has completed its analysis.
 * Requires confirmation that all heuristics have been evaluated or explained.
 */

import type { VisionToolDefinition, VisionToolContext, DoneInput, DoneOutput } from '../types.js';
import { createLogger } from '../../../utils/index.js';

const logger = createLogger('VisionDoneTool');

/**
 * JSON Schema for done parameters
 */
const DONE_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'Brief summary of the analysis findings (2-3 sentences)',
    },
    coverageConfirmation: {
      type: 'boolean',
      description: 'Set to true to confirm you have evaluated all heuristics or provided explanations for any you could not evaluate',
    },
    unevaluatedHeuristics: {
      type: 'array',
      description: 'If any heuristics could not be evaluated, list them with reasons',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The heuristic ID that could not be evaluated',
          },
          reason: {
            type: 'string',
            description: 'Why this heuristic could not be evaluated',
          },
        },
        required: ['id', 'reason'],
      },
    },
  },
  required: ['summary', 'coverageConfirmation'],
  additionalProperties: false,
};

/**
 * Create the done tool
 */
export function createVisionDoneTool(): VisionToolDefinition {
  return {
    name: 'done',
    description:
      'Signals that you have completed the heuristic analysis. You MUST set coverageConfirmation to true ' +
      'and have evaluated ALL pending heuristics before calling this. If there are heuristics you cannot ' +
      'evaluate (e.g., not visible on page, not applicable), provide them in unevaluatedHeuristics with reasons. ' +
      'This tool will fail if pending heuristics remain without explanation.',
    parameters: DONE_SCHEMA,

    async execute(input: unknown, context: VisionToolContext): Promise<DoneOutput> {
      const params = input as DoneInput;
      const { state } = context;

      try {
        // Check coverage confirmation
        if (!params.coverageConfirmation) {
          return {
            success: false,
            error: 'You must set coverageConfirmation to true to complete analysis. ' +
              'If you have not evaluated all heuristics, continue analyzing or provide explanations for unevaluated ones.',
          };
        }

        // Check minimum scroll coverage - must have scrolled through at least 50% of page
        const maxScroll = Math.max(0, state.pageHeight - state.viewportHeight);
        const scrollPercent = maxScroll > 0 ? (state.currentScrollY / maxScroll) * 100 : 100;
        const minScrollRequired = 50; // Require at least 50% scroll coverage

        if (scrollPercent < minScrollRequired && state.pageHeight > state.viewportHeight * 1.5) {
          return {
            success: false,
            error: `Cannot complete: You have only scrolled ${scrollPercent.toFixed(0)}% of the page. ` +
              `You must scroll through at least ${minScrollRequired}% of the page to ensure thorough visual analysis. ` +
              `Use scroll_page to view more of the page, then capture_viewport to analyze each section.`,
          };
        }

        // Build map of unevaluated explanations
        const unevaluatedExplanations = new Map<string, string>();
        if (params.unevaluatedHeuristics) {
          for (const item of params.unevaluatedHeuristics) {
            unevaluatedExplanations.set(item.id, item.reason);
          }
        }

        // Check if all pending heuristics are accounted for
        const pendingIds = state.pendingHeuristicIds;
        const unexplainedPending = pendingIds.filter(id => !unevaluatedExplanations.has(id));

        if (unexplainedPending.length > 0) {
          const examples = unexplainedPending.slice(0, 5);
          return {
            success: false,
            error: `Cannot complete: ${unexplainedPending.length} heuristics have not been evaluated and have no explanation. ` +
              `Pending heuristics: ${examples.join(', ')}${unexplainedPending.length > 5 ? '...' : ''}. ` +
              'Please either evaluate these heuristics or add them to unevaluatedHeuristics with reasons.',
          };
        }

        // Calculate final coverage
        const evaluatedCount = state.evaluatedHeuristicIds.size;
        const totalCount = state.allHeuristicIds.length;
        const coveragePercent = totalCount > 0 ? (evaluatedCount / totalCount) * 100 : 100;

        logger.debug('Analysis complete', {
          summary: params.summary,
          evaluated: evaluatedCount,
          total: totalCount,
          coveragePercent: coveragePercent.toFixed(1),
          unevaluatedCount: unevaluatedExplanations.size,
        });

        return {
          success: true,
          coveragePercent,
          totalEvaluations: evaluatedCount,
        };

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to complete analysis', { error: message });

        return {
          success: false,
          error: `Failed to complete analysis: ${message}`,
        };
      }
    },
  };
}
