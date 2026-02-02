/**
 * Vision Result Merger - Phase 21e (T322)
 *
 * Merges and deduplicates vision analysis results from multiple viewports.
 * Uses heuristic ID matching and confidence-based selection for deduplication.
 */

import type {
  HeuristicEvaluationWithViewport,
  ViewportVisionResult,
  MergedViewportResult,
} from './types.js';

/**
 * Merge vision results from multiple viewports into a single deduplicated result
 *
 * Deduplication rules (FR-269):
 * - Same heuristicId across viewports: keep highest confidence
 * - Track which viewport each finding originated from
 *
 * @param results - Array of viewport vision results to merge
 * @param dedupeThreshold - Similarity threshold (not currently used, reserved for future text similarity)
 * @returns Merged result with deduplicated evaluations
 */
export function mergeViewportResults(
  results: ViewportVisionResult[],
  _dedupeThreshold: number = 0.8  // Reserved for future text similarity deduplication
): MergedViewportResult {
  // Map to track best evaluation per heuristic ID
  const seenHeuristics = new Map<string, HeuristicEvaluationWithViewport>();
  let totalBeforeDedup = 0;
  let deduplicatedCount = 0;

  // Process each viewport result
  for (const result of results) {
    for (const evaluation of result.evaluations) {
      totalBeforeDedup++;

      const existing = seenHeuristics.get(evaluation.heuristicId);

      if (existing) {
        // Same heuristic found - keep highest confidence (FR-269)
        if (evaluation.confidence > existing.confidence) {
          seenHeuristics.set(evaluation.heuristicId, {
            ...evaluation,
            viewportIndex: result.viewportIndex,
            scrollPosition: result.scrollPosition,
          });
        }
        deduplicatedCount++;
      } else {
        // First time seeing this heuristic
        seenHeuristics.set(evaluation.heuristicId, {
          ...evaluation,
          viewportIndex: result.viewportIndex,
          scrollPosition: result.scrollPosition,
        });
      }
    }
  }

  return {
    evaluations: Array.from(seenHeuristics.values()),
    deduplicatedCount,
    totalBeforeDedup,
  };
}

/**
 * Calculate text similarity between two strings using Jaccard similarity
 * Reserved for future use in observation-based deduplication
 *
 * @param text1 - First text string
 * @param text2 - Second text string
 * @returns Similarity score between 0 and 1
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  if (text1 === text2) return 1;

  // Normalize and tokenize
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);

  const tokens1 = new Set(normalize(text1));
  const tokens2 = new Set(normalize(text2));

  // Calculate Jaccard similarity
  const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  if (union.size === 0) return 0;

  return intersection.size / union.size;
}

/**
 * Find the best evaluation for a given heuristic across viewports
 *
 * @param evaluations - Array of evaluations to search
 * @param heuristicId - Heuristic ID to find
 * @returns Best evaluation (highest confidence) or undefined
 */
export function findBestEvaluation(
  evaluations: HeuristicEvaluationWithViewport[],
  heuristicId: string
): HeuristicEvaluationWithViewport | undefined {
  const matching = evaluations.filter((e) => e.heuristicId === heuristicId);
  if (matching.length === 0) return undefined;

  // Return highest confidence
  return matching.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  );
}

/**
 * Get evaluations that have issues (fail or partial status)
 *
 * @param evaluations - Array of evaluations to filter
 * @returns Evaluations with fail or partial status, sorted by severity
 */
export function getIssueEvaluations(
  evaluations: HeuristicEvaluationWithViewport[]
): HeuristicEvaluationWithViewport[] {
  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return evaluations
    .filter((e) => e.status === 'fail' || e.status === 'partial')
    .sort((a, b) => {
      // Sort by severity first
      const severityDiff =
        (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
      if (severityDiff !== 0) return severityDiff;

      // Then by confidence (descending)
      return b.confidence - a.confidence;
    });
}

/**
 * Group evaluations by their source viewport
 *
 * @param evaluations - Array of evaluations to group
 * @returns Map of viewport index to evaluations from that viewport
 */
export function groupByViewport(
  evaluations: HeuristicEvaluationWithViewport[]
): Map<number, HeuristicEvaluationWithViewport[]> {
  const groups = new Map<number, HeuristicEvaluationWithViewport[]>();

  for (const evaluation of evaluations) {
    const viewportIndex = evaluation.viewportIndex ?? 0;
    const existing = groups.get(viewportIndex) || [];
    existing.push(evaluation);
    groups.set(viewportIndex, existing);
  }

  return groups;
}

/**
 * Calculate summary statistics for merged results
 *
 * @param merged - Merged viewport result
 * @returns Summary statistics object
 */
export function calculateMergedSummary(merged: MergedViewportResult): {
  totalHeuristics: number;
  passed: number;
  failed: number;
  partial: number;
  notApplicable: number;
  bySeverity: Record<string, number>;
  deduplicationRate: number;
} {
  const summary = {
    totalHeuristics: merged.evaluations.length,
    passed: 0,
    failed: 0,
    partial: 0,
    notApplicable: 0,
    bySeverity: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    } as Record<string, number>,
    deduplicationRate:
      merged.totalBeforeDedup > 0
        ? merged.deduplicatedCount / merged.totalBeforeDedup
        : 0,
  };

  for (const evaluation of merged.evaluations) {
    const { severity } = evaluation;
    switch (evaluation.status) {
      case 'pass':
        summary.passed++;
        break;
      case 'fail':
        summary.failed++;
        summary.bySeverity[severity] = (summary.bySeverity[severity] ?? 0) + 1;
        break;
      case 'partial':
        summary.partial++;
        summary.bySeverity[severity] = (summary.bySeverity[severity] ?? 0) + 1;
        break;
      case 'not_applicable':
        summary.notApplicable++;
        break;
    }
  }

  return summary;
}
