/**
 * Evaluate Batch Tool - Phase 21g (T340) + Phase 21i (T376)
 *
 * Records a batch of heuristic evaluations.
 * The LLM should evaluate 5-8 heuristics per call for efficiency.
 *
 * Phase 21i adds element reference extraction from observation text.
 */

import type { VisionToolDefinition, VisionToolContext, EvaluateBatchInput, EvaluateBatchOutput, BatchEvaluation } from '../types.js';
import type { EvaluationStatus } from '../../../heuristics/vision/types.js';
import { extractElementReferences } from '../../../heuristics/vision/response-parser.js';
import { createLogger } from '../../../utils/index.js';

const logger = createLogger('EvaluateBatchTool');

/**
 * JSON Schema for evaluate_batch parameters
 */
const EVALUATE_BATCH_SCHEMA = {
  type: 'object',
  properties: {
    evaluations: {
      type: 'array',
      description: 'Array of heuristic evaluations (5-8 recommended per batch)',
      items: {
        type: 'object',
        properties: {
          heuristicId: {
            type: 'string',
            description: 'The heuristic ID being evaluated (e.g., "PDP-CTA-001")',
          },
          status: {
            type: 'string',
            enum: ['pass', 'fail', 'partial', 'not_applicable'],
            description: 'Evaluation result: pass=fully met, fail=not met, partial=partially met, not_applicable=does not apply to this page',
          },
          observation: {
            type: 'string',
            description: 'What you observed in the screenshot and DOM. Reference DOM elements by index: "Element [0] shows..."',
          },
          issue: {
            type: 'string',
            description: 'If status is fail or partial, describe the specific issue found',
          },
          recommendation: {
            type: 'string',
            description: 'If status is fail or partial, suggest how to fix the issue',
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Confidence in this evaluation (0.0-1.0)',
          },
          // Phase 21h: Evidence Capture (T355)
          elementIndices: {
            type: 'array',
            description: 'Indices of DOM elements referenced in your observation (e.g., [0, 3, 5] for elements [0], [3], [5])',
            items: {
              type: 'integer',
              minimum: 0,
            },
          },
        },
        required: ['heuristicId', 'status', 'observation', 'confidence'],
        additionalProperties: false,
      },
      minItems: 1,
      maxItems: 10,
    },
  },
  required: ['evaluations'],
  additionalProperties: false,
};

/**
 * Validate evaluation status
 */
function isValidStatus(status: string): status is EvaluationStatus {
  return ['pass', 'fail', 'partial', 'not_applicable'].includes(status);
}

/**
 * Validate a single evaluation
 */
function validateEvaluation(eval_: unknown): { valid: boolean; error?: string; evaluation?: BatchEvaluation } {
  if (typeof eval_ !== 'object' || eval_ === null) {
    return { valid: false, error: 'Evaluation must be an object' };
  }

  const e = eval_ as Record<string, unknown>;

  if (typeof e.heuristicId !== 'string' || e.heuristicId.trim() === '') {
    return { valid: false, error: 'heuristicId must be a non-empty string' };
  }

  if (typeof e.status !== 'string' || !isValidStatus(e.status)) {
    return { valid: false, error: `status must be one of: pass, fail, partial, not_applicable (got: ${e.status})` };
  }

  if (typeof e.observation !== 'string' || e.observation.trim() === '') {
    return { valid: false, error: 'observation must be a non-empty string' };
  }

  if (typeof e.confidence !== 'number' || e.confidence < 0 || e.confidence > 1) {
    return { valid: false, error: 'confidence must be a number between 0 and 1' };
  }

  // Check for issue/recommendation on fail/partial
  if ((e.status === 'fail' || e.status === 'partial') && !e.issue) {
    logger.warn(`Evaluation ${e.heuristicId} has status ${e.status} but no issue provided`);
  }

  // Phase 21h: Validate elementIndices if provided (T355)
  // Phase 21i: Also extract from text if not explicitly provided (T376)
  let elementIndices: number[] | undefined;
  if (Array.isArray(e.elementIndices)) {
    const validIndices = e.elementIndices.filter(
      (idx): idx is number => typeof idx === 'number' && Number.isInteger(idx) && idx >= 0
    );
    if (validIndices.length > 0) {
      elementIndices = validIndices;
    }
    if (validIndices.length !== e.elementIndices.length) {
      logger.warn(`Some elementIndices were invalid for ${e.heuristicId}`, {
        provided: e.elementIndices.length,
        valid: validIndices.length,
      });
    }
  }

  // Phase 21i (T376): If no elementIndices provided, extract from text fields
  if (!elementIndices || elementIndices.length === 0) {
    const textFields = [
      e.observation as string,
      typeof e.issue === 'string' ? e.issue : '',
      typeof e.recommendation === 'string' ? e.recommendation : '',
    ].filter(Boolean);

    const extractedIndices = new Set<number>();
    for (const text of textFields) {
      const indices = extractElementReferences(text);
      for (const idx of indices) {
        extractedIndices.add(idx);
      }
    }

    if (extractedIndices.size > 0) {
      elementIndices = Array.from(extractedIndices).sort((a, b) => a - b);
      logger.debug(`Extracted ${elementIndices.length} element references from text for ${e.heuristicId}`, {
        indices: elementIndices,
      });
    }
  }

  return {
    valid: true,
    evaluation: {
      heuristicId: e.heuristicId,
      status: e.status as EvaluationStatus,
      observation: e.observation,
      issue: typeof e.issue === 'string' ? e.issue : undefined,
      recommendation: typeof e.recommendation === 'string' ? e.recommendation : undefined,
      confidence: e.confidence,
      elementIndices,
    },
  };
}

/**
 * Create the evaluate_batch tool
 */
export function createEvaluateBatchTool(): VisionToolDefinition {
  return {
    name: 'evaluate_batch',
    description:
      'Records your heuristic evaluations. Submit 5-8 evaluations at a time for efficiency. ' +
      'Each evaluation must include the heuristicId from the pending list, a status (pass/fail/partial/not_applicable), ' +
      'an observation describing what you saw (reference DOM elements by index: "Element [3] shows..."), ' +
      'and your confidence level (0.0-1.0). For fail/partial status, include issue and recommendation. ' +
      'Include elementIndices array with the indices of DOM elements you referenced (e.g., [0, 3, 5]).',
    parameters: EVALUATE_BATCH_SCHEMA,

    async execute(input: unknown, context: VisionToolContext): Promise<EvaluateBatchOutput> {
      const params = input as EvaluateBatchInput;
      const { state, heuristicDefinitions } = context;

      try {
        // Validate input
        if (!Array.isArray(params.evaluations) || params.evaluations.length === 0) {
          return {
            success: false,
            error: 'evaluations must be a non-empty array',
          };
        }

        // Validate each evaluation
        const validatedEvaluations: BatchEvaluation[] = [];
        const errors: string[] = [];

        for (let i = 0; i < params.evaluations.length; i++) {
          const result = validateEvaluation(params.evaluations[i]);
          if (result.valid && result.evaluation) {
            validatedEvaluations.push(result.evaluation);
          } else {
            errors.push(`Evaluation ${i}: ${result.error}`);
          }
        }

        if (errors.length > 0 && validatedEvaluations.length === 0) {
          return {
            success: false,
            error: `All evaluations invalid: ${errors.join('; ')}`,
          };
        }

        // Check for unknown heuristic IDs
        const unknownIds = validatedEvaluations
          .filter(e => !heuristicDefinitions.has(e.heuristicId))
          .map(e => e.heuristicId);

        if (unknownIds.length > 0) {
          logger.warn('Unknown heuristic IDs in batch', { unknownIds });
        }

        // Note: The actual state update happens in the agent loop after tool execution
        // This tool returns the validated evaluations for the agent to process

        const pendingCount = state.pendingHeuristicIds.length - validatedEvaluations.length;

        logger.debug('Batch evaluation validated', {
          submitted: params.evaluations.length,
          validated: validatedEvaluations.length,
          errors: errors.length,
          pendingAfter: pendingCount,
        });

        // Return validated evaluations in the result for the agent to process
        return {
          success: true,
          evaluatedCount: validatedEvaluations.length,
          pendingCount: Math.max(0, pendingCount),
          skippedIds: unknownIds,
          // Store validated evaluations for agent to add to state
          _validatedEvaluations: validatedEvaluations,
        } as EvaluateBatchOutput & { _validatedEvaluations: BatchEvaluation[] };

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to process batch evaluation', { error: message });

        return {
          success: false,
          error: `Failed to process batch evaluation: ${message}`,
        };
      }
    },
  };
}
