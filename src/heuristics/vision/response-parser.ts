/**
 * Vision Response Parser - Phase 21c (T309) + Phase 21i (T373)
 *
 * Parses and validates GPT-4o Vision responses into structured evaluations.
 * Phase 21i adds element reference extraction from observation text.
 */

import type { PageTypeHeuristics, HeuristicItem } from '../knowledge/index.js';
import type {
  HeuristicEvaluation,
  RawLLMEvaluation,
  LLMVisionResponse,
  EvaluationStatus,
  ParsedEvaluation,
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

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 21i: Element Reference Extraction (T373)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Regular expression to match element index references like [0], [1], [23], etc.
 * Matches patterns like:
 * - "Element [5] shows..."
 * - "[0] has text..."
 * - "Elements [3] and [7] are..."
 */
const ELEMENT_INDEX_PATTERN = /\[(\d+)\]/g;

/**
 * Extract element indices from text containing [index] references
 *
 * @param text - Text containing element references like [0], [5], [23]
 * @returns Array of unique element indices, sorted numerically
 */
export function extractElementReferences(text: string): number[] {
  if (!text) return [];

  const matches = text.matchAll(ELEMENT_INDEX_PATTERN);
  const indices = new Set<number>();

  for (const match of matches) {
    const captured = match[1];
    if (captured) {
      const index = parseInt(captured, 10);
      if (!isNaN(index) && index >= 0) {
        indices.add(index);
      }
    }
  }

  // Return sorted unique indices
  return Array.from(indices).sort((a, b) => a - b);
}

/**
 * Parse a HeuristicEvaluation and extract element references from its text fields (Phase 21i T373)
 *
 * Extracts element indices from:
 * - observation text
 * - issue text
 * - recommendation text
 *
 * @param evaluation - The heuristic evaluation to enhance
 * @returns ParsedEvaluation with relatedElements array
 */
export function parseEvaluationWithElements(evaluation: HeuristicEvaluation): ParsedEvaluation {
  // Collect all text fields that may contain element references
  const textsToSearch = [
    evaluation.observation,
    evaluation.issue,
    evaluation.recommendation,
  ].filter((text): text is string => typeof text === 'string' && text.length > 0);

  // Extract unique element indices from all text fields
  const allIndices = new Set<number>();
  for (const text of textsToSearch) {
    const indices = extractElementReferences(text);
    for (const idx of indices) {
      allIndices.add(idx);
    }
  }

  // Return ParsedEvaluation with relatedElements
  return {
    ...evaluation,
    relatedElements: Array.from(allIndices).sort((a, b) => a - b),
  };
}

/**
 * Parse multiple evaluations and extract element references from each (Phase 21i T373)
 *
 * @param evaluations - Array of heuristic evaluations
 * @returns Array of ParsedEvaluations with relatedElements populated
 */
export function parseEvaluationsWithElements(evaluations: HeuristicEvaluation[]): ParsedEvaluation[] {
  return evaluations.map(parseEvaluationWithElements);
}
