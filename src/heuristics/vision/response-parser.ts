/**
 * Vision Response Parser - Phase 21c (T309)
 *
 * Parses and validates GPT-4o Vision responses into structured evaluations.
 */

import type { PageTypeHeuristics, HeuristicItem } from '../knowledge/index.js';
import type {
  HeuristicEvaluation,
  RawLLMEvaluation,
  LLMVisionResponse,
  EvaluationStatus,
} from './types.js';
import type { Severity } from '../../models/cro-insight.js';

/**
 * Valid evaluation statuses
 */
const VALID_STATUSES: EvaluationStatus[] = ['pass', 'fail', 'partial', 'not_applicable'];

/**
 * Parse error with context
 */
export class VisionParseError extends Error {
  constructor(
    message: string,
    public readonly rawResponse: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'VisionParseError';
  }
}

/**
 * Parse vision API response into structured evaluations
 */
export function parseVisionResponse(
  response: string,
  heuristics: PageTypeHeuristics
): HeuristicEvaluation[] {
  // Extract JSON from response (may be wrapped in markdown code blocks)
  const jsonString = extractJsonFromResponse(response);

  // Parse JSON
  let parsed: LLMVisionResponse;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new VisionParseError(
      'Failed to parse JSON from vision response',
      response,
      err instanceof Error ? err : undefined
    );
  }

  // Validate structure
  if (!parsed.evaluations || !Array.isArray(parsed.evaluations)) {
    throw new VisionParseError(
      'Response missing evaluations array',
      response
    );
  }

  // Build heuristic lookup map
  const heuristicMap = buildHeuristicMap(heuristics);

  // Parse and validate each evaluation
  const evaluations: HeuristicEvaluation[] = [];

  for (const raw of parsed.evaluations) {
    const evaluation = parseRawEvaluation(raw, heuristicMap);
    if (evaluation) {
      evaluations.push(evaluation);
    }
  }

  // Check for missing heuristics and add defaults
  const evaluatedIds = new Set(evaluations.map((e) => e.heuristicId));
  const missingEvaluations = addMissingEvaluations(heuristicMap, evaluatedIds);
  evaluations.push(...missingEvaluations);

  return evaluations;
}

/**
 * Extract JSON from response that may be wrapped in markdown
 */
function extractJsonFromResponse(response: string): string {
  // Try to find JSON in code block
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  // Try to find raw JSON object
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  // Return as-is, let JSON.parse fail with useful error
  return response.trim();
}

/**
 * Build lookup map from heuristic ID to HeuristicItem
 */
function buildHeuristicMap(
  heuristics: PageTypeHeuristics
): Map<string, HeuristicItem> {
  const map = new Map<string, HeuristicItem>();

  for (const category of heuristics.categories) {
    for (const heuristic of category.heuristics) {
      map.set(heuristic.id, heuristic);
    }
  }

  return map;
}

/**
 * Parse a single raw evaluation into structured format
 */
function parseRawEvaluation(
  raw: RawLLMEvaluation,
  heuristicMap: Map<string, HeuristicItem>
): HeuristicEvaluation | null {
  // Validate heuristic ID
  if (!raw.heuristicId || typeof raw.heuristicId !== 'string') {
    console.warn('Skipping evaluation with invalid heuristicId:', raw);
    return null;
  }

  // Look up heuristic
  const heuristic = heuristicMap.get(raw.heuristicId);
  if (!heuristic) {
    console.warn(`Unknown heuristic ID: ${raw.heuristicId}`);
    return null;
  }

  // Validate and normalize status
  const status = normalizeStatus(raw.status);
  if (!status) {
    console.warn(`Invalid status for ${raw.heuristicId}: ${raw.status}`);
    return null;
  }

  // Validate confidence
  const confidence = normalizeConfidence(raw.confidence);

  // Build evaluation
  const evaluation: HeuristicEvaluation = {
    heuristicId: raw.heuristicId,
    principle: heuristic.principle,
    status,
    severity: heuristic.severity as Severity,
    observation: raw.observation || 'No observation provided',
    confidence,
  };

  // Add optional fields for failures
  if (status === 'fail' || status === 'partial') {
    if (raw.issue) {
      evaluation.issue = raw.issue;
    }
    if (raw.recommendation) {
      evaluation.recommendation = raw.recommendation;
    }
  }

  return evaluation;
}

/**
 * Normalize status string to valid EvaluationStatus
 */
function normalizeStatus(status: string): EvaluationStatus | null {
  if (!status || typeof status !== 'string') {
    return null;
  }

  const normalized = status.toLowerCase().trim();

  // Handle common variations
  if (normalized === 'pass' || normalized === 'passed') {
    return 'pass';
  }
  if (normalized === 'fail' || normalized === 'failed') {
    return 'fail';
  }
  if (normalized === 'partial' || normalized === 'partially') {
    return 'partial';
  }
  if (
    normalized === 'not_applicable' ||
    normalized === 'n/a' ||
    normalized === 'na' ||
    normalized === 'not applicable'
  ) {
    return 'not_applicable';
  }

  // Check exact match
  if (VALID_STATUSES.includes(normalized as EvaluationStatus)) {
    return normalized as EvaluationStatus;
  }

  return null;
}

/**
 * Normalize confidence score to 0-1 range
 */
function normalizeConfidence(confidence: unknown): number {
  if (typeof confidence !== 'number') {
    return 0.5; // Default confidence
  }

  // Handle percentage values (0-100)
  if (confidence > 1 && confidence <= 100) {
    return confidence / 100;
  }

  // Clamp to valid range
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Add default evaluations for missing heuristics
 */
function addMissingEvaluations(
  heuristicMap: Map<string, HeuristicItem>,
  evaluatedIds: Set<string>
): HeuristicEvaluation[] {
  const missing: HeuristicEvaluation[] = [];

  for (const [id, heuristic] of heuristicMap) {
    if (!evaluatedIds.has(id)) {
      missing.push({
        heuristicId: id,
        principle: heuristic.principle,
        status: 'not_applicable',
        severity: heuristic.severity as Severity,
        observation: 'Not evaluated - missing from LLM response',
        confidence: 0,
      });
    }
  }

  return missing;
}

/**
 * Validate that all expected heuristics are present
 */
export function validateCompleteness(
  evaluations: HeuristicEvaluation[],
  heuristics: PageTypeHeuristics
): { complete: boolean; missing: string[] } {
  const evaluatedIds = new Set(evaluations.map((e) => e.heuristicId));
  const missing: string[] = [];

  for (const category of heuristics.categories) {
    for (const heuristic of category.heuristics) {
      if (!evaluatedIds.has(heuristic.id)) {
        missing.push(heuristic.id);
      }
    }
  }

  return {
    complete: missing.length === 0,
    missing,
  };
}
