/**
 * Discrepancy Classifier - Phase 26e (T570)
 *
 * Classifies quality discrepancies between baseline and optimized
 * analysis results by severity: critical, major, minor.
 */

import type { HeuristicEvaluation } from '../heuristics/vision/types.js';

/**
 * Severity of a quality discrepancy
 */
export type DiscrepancySeverity = 'critical' | 'major' | 'minor';

/**
 * Classified quality discrepancy between baseline and optimized
 */
export interface QualityDiscrepancy {
  /** Heuristic ID that has the discrepancy */
  heuristicId: string;
  /** Baseline evaluation status */
  baselineStatus: string;
  /** Optimized evaluation status */
  optimizedStatus: string;
  /** Baseline confidence score */
  baselineConfidence: number;
  /** Optimized confidence score */
  optimizedConfidence: number;
  /** Severity classification */
  severity: DiscrepancySeverity;
  /** Likely cause of the discrepancy */
  likelyCause: string;
}

/**
 * Classify a discrepancy between baseline and optimized evaluations.
 *
 * Classification rules:
 * - Critical: pass↔fail flip (wrong conclusion)
 * - Major: partial status mismatch (one side is partial, other is not)
 * - Minor: confidence difference > 20%, or other small differences
 */
export function classifyDiscrepancy(
  baseline: HeuristicEvaluation,
  optimized: HeuristicEvaluation
): QualityDiscrepancy {
  let severity: DiscrepancySeverity;
  let likelyCause: string;

  // Critical: pass↔fail flip (wrong conclusion)
  if (
    (baseline.status === 'pass' && optimized.status === 'fail') ||
    (baseline.status === 'fail' && optimized.status === 'pass')
  ) {
    severity = 'critical';
    likelyCause = optimized.status === 'pass'
      ? 'False positive: optimization missed an issue detected by baseline'
      : 'False negative: optimization found non-existent issue';
  }
  // Major: fail↔partial (meaningfully different conclusions)
  else if (
    (baseline.status === 'fail' && optimized.status === 'partial') ||
    (baseline.status === 'partial' && optimized.status === 'fail')
  ) {
    severity = 'major';
    likelyCause = 'Fail↔partial compliance detection differs — likely viewport filtering impact';
  }
  // Minor: pass↔partial (borderline LLM non-determinism)
  else if (
    (baseline.status === 'pass' && optimized.status === 'partial') ||
    (baseline.status === 'partial' && optimized.status === 'pass')
  ) {
    severity = 'minor';
    likelyCause = 'Pass↔partial variance — borderline LLM non-determinism on compliance threshold';
  }
  // Minor: confidence difference > 20%
  else if (Math.abs(baseline.confidence - optimized.confidence) > 0.2) {
    severity = 'minor';
    likelyCause = 'Confidence variance — likely batching impact on scoring';
  }
  // Minor: any other status difference
  else {
    severity = 'minor';
    likelyCause = 'Minor observation difference';
  }

  return {
    heuristicId: baseline.heuristicId,
    baselineStatus: baseline.status,
    optimizedStatus: optimized.status,
    baselineConfidence: baseline.confidence,
    optimizedConfidence: optimized.confidence,
    severity,
    likelyCause,
  };
}
