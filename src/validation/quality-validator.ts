/**
 * Quality Validator - Phase 26e (T571)
 *
 * CI-only validation orchestrator that runs baseline (non-optimized)
 * and optimized analyses, compares results, classifies discrepancies,
 * and reports pass/fail based on match rate threshold.
 */

import type { ViewportSnapshot, PageType } from '../models/index.js';
import {
  AnalysisOrchestrator,
  type AnalysisResult,
  type AnalysisOrchestratorConfig,
} from '../heuristics/analysis-orchestrator.js';
import { compareResults, type ComparisonResult } from './result-comparator.js';
import { classifyDiscrepancy, type QualityDiscrepancy } from './discrepancy-classifier.js';
import { createLogger } from '../utils/index.js';

/**
 * Configuration for quality validation
 */
export interface QualityValidationConfig {
  /** Minimum match rate to pass (0.0-1.0, default: 0.80) */
  matchThreshold: number;
  /** Fail on any critical discrepancy (default: true) */
  failOnCritical: boolean;
  /** Verbose logging */
  verbose: boolean;
}

/**
 * Default validation config
 */
export const DEFAULT_QUALITY_VALIDATION_CONFIG: QualityValidationConfig = {
  matchThreshold: 0.80,
  failOnCritical: true,
  verbose: false,
};

/**
 * Result of quality validation
 */
export interface QualityValidationResult {
  /** Whether validation passed */
  passed: boolean;
  /** Total heuristics compared */
  totalHeuristics: number;
  /** Number with matching status */
  matchingResults: number;
  /** Raw match rate — all status mismatches (0.0-1.0) */
  matchRate: number;
  /** Effective match rate — only critical+major count as mismatches (0.0-1.0) */
  effectiveMatchRate: number;
  /** Classified discrepancies */
  discrepancies: QualityDiscrepancy[];
  /** Heuristic IDs missing from optimized run */
  missingInOptimized: string[];
  /** Heuristic IDs missing from baseline run */
  missingInBaseline: string[];
  /** Failure reasons (empty if passed) */
  failureReasons: string[];
  /** Actionable recommendations */
  recommendations: string[];
  /** Baseline analysis result */
  baselineResult: AnalysisResult;
  /** Optimized analysis result */
  optimizedResult: AnalysisResult;
}

/**
 * Quality Validator — CI-only validation orchestrator.
 *
 * Runs two analyses (baseline sequential vs optimized parallel+batched+filtered),
 * compares per-heuristic results, and determines if optimization quality is acceptable.
 */
export class QualityValidator {
  private readonly config: QualityValidationConfig;
  private readonly logger;

  constructor(config?: Partial<QualityValidationConfig>) {
    this.config = { ...DEFAULT_QUALITY_VALIDATION_CONFIG, ...config };
    this.logger = createLogger('QualityValidator', this.config.verbose);
  }

  /**
   * Run quality validation comparing baseline vs optimized analysis.
   *
   * @param snapshots - Collected viewport snapshots
   * @param pageType - Page type being analyzed
   * @param analyzerConfig - Shared analyzer config (model, tokens, etc.)
   */
  async validate(
    snapshots: ViewportSnapshot[],
    pageType: PageType,
    analyzerConfig?: Partial<AnalysisOrchestratorConfig>
  ): Promise<QualityValidationResult> {
    this.logger.info('Starting quality validation', {
      snapshotCount: snapshots.length,
      pageType,
      matchThreshold: this.config.matchThreshold,
    });

    // 1. Run baseline (non-optimized): sequential, no batching, no filtering
    const baselineOrchestrator = new AnalysisOrchestrator({
      ...analyzerConfig,
      parallelAnalysis: false,
      categoryBatching: false,
      enableViewportFiltering: false,
      verbose: this.config.verbose,
    });

    this.logger.info('Running baseline analysis (sequential, no batching, no filtering)');
    const baselineResult = await baselineOrchestrator.runAnalysis(snapshots, pageType);

    // 2. Run optimized: parallel + batching + viewport filtering
    const optimizedOrchestrator = new AnalysisOrchestrator({
      ...analyzerConfig,
      parallelAnalysis: true,
      categoryBatching: true,
      enableViewportFiltering: true,
      verbose: this.config.verbose,
    });

    this.logger.info('Running optimized analysis (parallel, batched, viewport-filtered)');
    const optimizedResult = await optimizedOrchestrator.runAnalysis(snapshots, pageType);

    // 3. Compare results
    const comparison = compareResults(baselineResult, optimizedResult);

    // 4. Classify discrepancies
    const discrepancies = comparison.discrepancies.map(d =>
      classifyDiscrepancy(d.baseline, d.optimized)
    );

    // 5. Determine pass/fail
    // Raw match rate (all mismatches)
    const matchRate = comparison.total > 0
      ? comparison.matching / comparison.total
      : 1.0;

    // Effective match rate: only critical + major count as mismatches.
    // Minor discrepancies (e.g. pass↔partial LLM non-determinism) are informational.
    const significantMismatches = discrepancies.filter(
      d => d.severity === 'critical' || d.severity === 'major'
    ).length;
    const effectiveMatchRate = comparison.total > 0
      ? (comparison.total - significantMismatches) / comparison.total
      : 1.0;

    const hasCritical = discrepancies.some(d => d.severity === 'critical');
    const failureReasons: string[] = [];

    if (effectiveMatchRate < this.config.matchThreshold) {
      failureReasons.push(
        `Effective match rate ${(effectiveMatchRate * 100).toFixed(1)}% below threshold ${(this.config.matchThreshold * 100).toFixed(1)}% (raw: ${(matchRate * 100).toFixed(1)}%, ${significantMismatches} critical+major out of ${comparison.total})`
      );
    }

    if (this.config.failOnCritical && hasCritical) {
      const criticalCount = discrepancies.filter(d => d.severity === 'critical').length;
      failureReasons.push(
        `${criticalCount} critical discrepancy(ies) found (pass↔fail flip)`
      );
    }

    if (comparison.missingInOptimized.length > 0) {
      failureReasons.push(
        `${comparison.missingInOptimized.length} heuristic(s) missing from optimized run`
      );
    }

    const passed = failureReasons.length === 0;

    // 6. Generate recommendations
    const recommendations = this.generateRecommendations(discrepancies, comparison);

    this.logger.info('Quality validation complete', {
      passed,
      matchRate: `${(matchRate * 100).toFixed(1)}%`,
      effectiveMatchRate: `${(effectiveMatchRate * 100).toFixed(1)}%`,
      significantMismatches,
      total: comparison.total,
      matching: comparison.matching,
      discrepancies: discrepancies.length,
      critical: discrepancies.filter(d => d.severity === 'critical').length,
      major: discrepancies.filter(d => d.severity === 'major').length,
      minor: discrepancies.filter(d => d.severity === 'minor').length,
    });

    return {
      passed,
      totalHeuristics: comparison.total,
      matchingResults: comparison.matching,
      matchRate,
      effectiveMatchRate,
      discrepancies,
      missingInOptimized: comparison.missingInOptimized,
      missingInBaseline: comparison.missingInBaseline,
      failureReasons,
      recommendations,
      baselineResult,
      optimizedResult,
    };
  }

  /**
   * Generate actionable recommendations based on discrepancies
   */
  private generateRecommendations(
    discrepancies: QualityDiscrepancy[],
    comparison: ComparisonResult
  ): string[] {
    const recommendations: string[] = [];

    const criticals = discrepancies.filter(d => d.severity === 'critical');
    const majors = discrepancies.filter(d => d.severity === 'major');

    if (criticals.length > 0) {
      const ids = criticals.map(d => d.heuristicId).join(', ');
      recommendations.push(
        `Review critical discrepancies (${ids}): pass↔fail flips indicate optimization is changing conclusions`
      );
      // Check if viewport filtering might be the cause
      const viewportCaused = criticals.some(d =>
        d.likelyCause.includes('viewport')
      );
      if (viewportCaused) {
        recommendations.push(
          'Consider disabling viewport filtering (--no-viewport-filtering) for affected categories'
        );
      }
    }

    if (majors.length > 0) {
      recommendations.push(
        `Review ${majors.length} major discrepancy(ies): partial compliance detection differs between modes`
      );
    }

    if (comparison.missingInOptimized.length > 0) {
      recommendations.push(
        `${comparison.missingInOptimized.length} heuristic(s) were not evaluated in optimized mode — check batch grouping covers all categories`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Quality validation passed — optimizations are safe to deploy');
    }

    return recommendations;
  }
}
