/**
 * Batch Response Parser - Phase 26b (T558)
 *
 * Parses multi-category LLM responses where the response is a JSON object
 * keyed by category name, each containing evaluations and summary.
 */

import type { HeuristicEvaluation, EvaluationStatus } from './vision/types.js';
import type { Severity } from '../models/cro-insight.js';
import type { HeuristicCategory } from './knowledge/index.js';
import type { CategoryAnalysisResult } from './category-analyzer.js';

/**
 * Raw evaluation from batched LLM response
 */
interface RawBatchEvaluation {
  heuristicId: string;
  status: string;
  confidence: number;
  observation: string;
  issue?: string;
  recommendation?: string;
  evidence?: string;
  reasoning?: string;
  /** Structured element refs in [v0-5] format — populated by LLM in JSON response */
  elementRefs?: string[];
}

/**
 * Single category response within a batched response
 */
interface BatchedCategoryResponse {
  evaluations: RawBatchEvaluation[];
  summary?: string;
}

/**
 * Full batched response structure keyed by category name
 */
export interface BatchedResponse {
  [categoryName: string]: BatchedCategoryResponse;
}

/**
 * Error thrown when batched response parsing fails.
 * Contains the raw response for debugging and fallback handling.
 */
export class BatchParseError extends Error {
  constructor(
    public readonly rawResponse: string,
    public readonly cause: Error
  ) {
    super(`Failed to parse batched response: ${cause.message}`);
    this.name = 'BatchParseError';
  }
}

/**
 * Extract JSON from an LLM response string.
 * Handles responses wrapped in markdown code blocks, or raw JSON.
 *
 * @param response - Raw LLM response string
 * @returns Extracted JSON string
 */
export function extractJSON(response: string): string {
  // Try to extract from markdown code block first
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  // Try to find JSON object boundaries
  const firstBrace = response.indexOf('{');
  const lastBrace = response.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return response.slice(firstBrace, lastBrace + 1);
  }

  // Return as-is, let JSON.parse handle errors
  return response.trim();
}

/**
 * Normalize a status string from LLM to EvaluationStatus
 */
function normalizeStatus(status: string): EvaluationStatus {
  const normalized = status.toLowerCase().trim();
  switch (normalized) {
    case 'pass':
    case 'passed':
      return 'pass';
    case 'fail':
    case 'failed':
      return 'fail';
    case 'partial':
    case 'partially':
      return 'partial';
    case 'not_applicable':
    case 'n/a':
    case 'na':
      return 'not_applicable';
    default:
      return 'not_applicable';
  }
}

/**
 * Parse a batched LLM response into per-category analysis results.
 *
 * @param response - Raw LLM response string
 * @param categories - The categories that were in this batch (for severity/principle lookup)
 * @returns Array of CategoryAnalysisResult, one per category
 * @throws BatchParseError if JSON parsing fails completely
 */
export function parseBatchedResponse(
  response: string,
  categories: HeuristicCategory[]
): CategoryAnalysisResult[] {
  let parsed: BatchedResponse;

  try {
    const jsonStr = extractJSON(response);
    parsed = JSON.parse(jsonStr) as BatchedResponse;
  } catch (error) {
    throw new BatchParseError(
      response,
      error instanceof Error ? error : new Error(String(error))
    );
  }

  const results: CategoryAnalysisResult[] = [];

  for (const category of categories) {
    const categoryResponse = parsed[category.name];

    if (!categoryResponse || !Array.isArray(categoryResponse.evaluations)) {
      // Category missing from response — return empty result (graceful degradation)
      results.push({
        categoryName: category.name,
        evaluations: [],
        summary: 'Category missing from batched response',
        analysisTimeMs: 0,
      });
      continue;
    }

    // Build severity and principle lookup maps from category heuristics
    const severityMap = new Map<string, Severity>();
    const principleMap = new Map<string, string>();
    for (const h of category.heuristics) {
      severityMap.set(h.id, h.severity as Severity);
      principleMap.set(h.id, h.principle);
    }

    // Transform raw evaluations to typed evaluations
    const evaluations: HeuristicEvaluation[] = categoryResponse.evaluations.map((raw) => {
      const eval_: HeuristicEvaluation = {
        heuristicId: raw.heuristicId,
        principle: principleMap.get(raw.heuristicId) ?? '',
        status: normalizeStatus(raw.status),
        severity: severityMap.get(raw.heuristicId) ?? 'medium',
        observation: raw.observation,
        issue: raw.issue,
        recommendation: raw.recommendation,
        confidence: Math.min(1, Math.max(0, raw.confidence)),
        reasoning: raw.reasoning,
      };

      // Phase 27B: Carry structured elementRefs from LLM JSON response
      if (raw.elementRefs && Array.isArray(raw.elementRefs) && raw.elementRefs.length > 0) {
        (eval_ as HeuristicEvaluation & { _structuredElementRefs: string[] })._structuredElementRefs = raw.elementRefs;
      }

      return eval_;
    });

    results.push({
      categoryName: category.name,
      evaluations,
      summary: categoryResponse.summary,
      analysisTimeMs: 0, // Will be set by caller
    });
  }

  return results;
}
