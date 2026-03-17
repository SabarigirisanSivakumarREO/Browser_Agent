/**
 * Result Comparator - Phase 26e (T569)
 *
 * Compares baseline vs optimized analysis results by matching
 * heuristic evaluations on heuristicId and checking status/confidence.
 */

import type { AnalysisResult } from '../heuristics/analysis-orchestrator.js';
import type { HeuristicEvaluation } from '../heuristics/vision/types.js';

/**
 * A single discrepancy between baseline and optimized evaluations
 */
export interface EvaluationDiscrepancy {
  /** The baseline evaluation */
  baseline: HeuristicEvaluation;
  /** The optimized evaluation */
  optimized: HeuristicEvaluation;
}

/**
 * Result of comparing baseline vs optimized analysis
 */
export interface ComparisonResult {
  /** Total heuristics compared */
  total: number;
  /** Number with matching status */
  matching: number;
  /** Discrepancy pairs where status differs */
  discrepancies: EvaluationDiscrepancy[];
  /** Heuristic IDs present in baseline but missing from optimized */
  missingInOptimized: string[];
  /** Heuristic IDs present in optimized but missing from baseline */
  missingInBaseline: string[];
}

/**
 * Compare baseline vs optimized analysis results.
 *
 * Matches evaluations by heuristicId, counts status matches,
 * and captures discrepancy pairs for further classification.
 */
export function compareResults(
  baseline: AnalysisResult,
  optimized: AnalysisResult
): ComparisonResult {
  // Index evaluations by heuristicId
  const baselineMap = new Map<string, HeuristicEvaluation>();
  for (const eval_ of baseline.evaluations) {
    baselineMap.set(eval_.heuristicId, eval_);
  }

  const optimizedMap = new Map<string, HeuristicEvaluation>();
  for (const eval_ of optimized.evaluations) {
    optimizedMap.set(eval_.heuristicId, eval_);
  }

  // Find common heuristic IDs
  const allIds = new Set([...baselineMap.keys(), ...optimizedMap.keys()]);
  const missingInOptimized: string[] = [];
  const missingInBaseline: string[] = [];
  const discrepancies: EvaluationDiscrepancy[] = [];
  let matching = 0;
  let total = 0;

  for (const id of allIds) {
    const baseEval = baselineMap.get(id);
    const optEval = optimizedMap.get(id);

    if (!baseEval) {
      missingInBaseline.push(id);
      continue;
    }
    if (!optEval) {
      missingInOptimized.push(id);
      continue;
    }

    total++;

    if (baseEval.status === optEval.status) {
      matching++;
    } else {
      discrepancies.push({ baseline: baseEval, optimized: optEval });
    }
  }

  return {
    total,
    matching,
    discrepancies,
    missingInOptimized,
    missingInBaseline,
  };
}
