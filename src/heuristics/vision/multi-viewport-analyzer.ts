/**
 * Multi-Viewport Vision Analyzer - Phase 21e (T323)
 *
 * Orchestrates full-page vision analysis by:
 * 1. Analyzing multiple viewport screenshots in parallel (or sequentially)
 * 2. Merging and deduplicating results across viewports
 * 3. Producing a unified CRO analysis result
 *
 * Cost target: ~$0.01-0.02/page with gpt-4o-mini
 */

import { v4 as uuid } from 'uuid';

import type { PageType } from '../../models/index.js';
import type { CROInsight, Severity } from '../../models/cro-insight.js';
import type { ViewportInfo } from '../../models/page-state.js';

import { CROVisionAnalyzer } from './analyzer.js';
import { mergeViewportResults, calculateMergedSummary } from './result-merger.js';
import type {
  MultiViewportVisionConfig,
  MultiViewportAnalysisResult,
  ViewportScreenshot,
  ViewportVisionResult,
  HeuristicEvaluationWithViewport,
  VisionAnalysisSummary,
} from './types.js';
import { DEFAULT_MULTI_VIEWPORT_CONFIG, getInsightCategory } from './types.js';

/**
 * Multi-Viewport Vision Analyzer
 *
 * Analyzes full pages by processing multiple viewport screenshots
 * and merging the results into a single unified analysis.
 */
export class MultiViewportVisionAnalyzer {
  private readonly config: MultiViewportVisionConfig;
  private readonly singleAnalyzer: CROVisionAnalyzer;

  /**
   * Create a new MultiViewportVisionAnalyzer
   *
   * @param config - Optional configuration overrides
   */
  constructor(config?: Partial<MultiViewportVisionConfig>) {
    this.config = { ...DEFAULT_MULTI_VIEWPORT_CONFIG, ...config };

    // Create single viewport analyzer with matching config
    this.singleAnalyzer = new CROVisionAnalyzer({
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });
  }

  /**
   * Analyze a full page using multiple viewport screenshots
   *
   * @param screenshots - Array of viewport screenshots to analyze
   * @param pageType - Type of page being analyzed
   * @param viewport - Viewport configuration
   * @returns Complete multi-viewport analysis result
   */
  async analyzeFullPage(
    screenshots: ViewportScreenshot[],
    pageType: PageType,
    viewport: ViewportInfo
  ): Promise<MultiViewportAnalysisResult> {
    const startTime = Date.now();

    // 1. Limit to maxViewports (FR-267)
    const limitedScreenshots = screenshots.slice(0, this.config.maxViewports);

    if (limitedScreenshots.length === 0) {
      return this.createEmptyResult(pageType, viewport);
    }

    // 2. Analyze each viewport (FR-262, FR-266)
    const viewportResults = this.config.parallelAnalysis
      ? await this.analyzeParallel(limitedScreenshots, pageType, viewport)
      : await this.analyzeSequential(limitedScreenshots, pageType, viewport);

    // 3. Merge and deduplicate results (FR-263, FR-264)
    const merged = mergeViewportResults(viewportResults, this.config.dedupeThreshold);

    // 4. Transform to CROInsights for compatibility
    const insights = this.transformToInsights(merged.evaluations);

    // 5. Calculate summary statistics
    const mergedSummary = calculateMergedSummary(merged);
    const summary: VisionAnalysisSummary = {
      totalHeuristics: mergedSummary.totalHeuristics,
      passed: mergedSummary.passed,
      failed: mergedSummary.failed,
      partial: mergedSummary.partial,
      notApplicable: mergedSummary.notApplicable,
      coveragePercent: mergedSummary.totalHeuristics > 0 ? 100 : 0,  // Phase 21j
      bySeverity: mergedSummary.bySeverity as Record<Severity, number>,
    };

    const totalAnalysisTimeMs = Date.now() - startTime;

    return {
      pageType,
      analyzedAt: Date.now(),
      screenshotUsed: true,
      viewport,
      evaluations: merged.evaluations,
      insights,
      summary,
      viewportCount: limitedScreenshots.length,
      viewportResults,
      mergedEvaluations: merged.evaluations,
      deduplicatedCount: merged.deduplicatedCount,
      totalAnalysisTimeMs,
    };
  }

  /**
   * Analyze viewports in parallel (FR-266)
   */
  private async analyzeParallel(
    screenshots: ViewportScreenshot[],
    pageType: PageType,
    viewport: ViewportInfo
  ): Promise<ViewportVisionResult[]> {
    const promises = screenshots.map((ss) =>
      this.analyzeSingleViewport(ss, pageType, viewport)
    );

    return Promise.all(promises);
  }

  /**
   * Analyze viewports sequentially (fallback for --no-parallel-vision)
   */
  private async analyzeSequential(
    screenshots: ViewportScreenshot[],
    pageType: PageType,
    viewport: ViewportInfo
  ): Promise<ViewportVisionResult[]> {
    const results: ViewportVisionResult[] = [];

    for (const ss of screenshots) {
      const result = await this.analyzeSingleViewport(ss, pageType, viewport);
      results.push(result);
    }

    return results;
  }

  /**
   * Analyze a single viewport screenshot
   */
  private async analyzeSingleViewport(
    screenshot: ViewportScreenshot,
    pageType: PageType,
    viewport: ViewportInfo
  ): Promise<ViewportVisionResult> {
    const startTime = Date.now();

    try {
      const result = await this.singleAnalyzer.analyze(
        screenshot.base64,
        pageType,
        viewport
      );

      return {
        viewportIndex: screenshot.viewportIndex,
        scrollPosition: screenshot.scrollPosition,
        evaluations: result.evaluations,
        analysisTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      // Return empty result on error to avoid breaking the entire analysis
      console.warn(
        `Vision analysis failed for viewport ${screenshot.viewportIndex}:`,
        error instanceof Error ? error.message : error
      );

      return {
        viewportIndex: screenshot.viewportIndex,
        scrollPosition: screenshot.scrollPosition,
        evaluations: [],
        analysisTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Transform evaluations to CROInsight[] for compatibility with existing output
   */
  private transformToInsights(evaluations: HeuristicEvaluationWithViewport[]): CROInsight[] {
    return evaluations
      .filter((e) => e.status === 'fail' || e.status === 'partial')
      .map((e) => this.evaluationToInsight(e));
  }

  /**
   * Convert a single evaluation to CROInsight
   */
  private evaluationToInsight(evaluation: HeuristicEvaluationWithViewport): CROInsight {
    const category = getInsightCategory(evaluation.heuristicId);
    const type = evaluation.heuristicId.toLowerCase().replace(/-/g, '_');

    // Build element description with viewport info if available
    let element = 'viewport';
    if (evaluation.viewportIndex !== undefined) {
      element = `viewport_${evaluation.viewportIndex}`;
      if (evaluation.scrollPosition !== undefined) {
        element += `_scroll_${evaluation.scrollPosition}`;
      }
    }

    return {
      id: uuid(),
      category,
      type,
      severity: evaluation.severity,
      element,
      issue: evaluation.issue || evaluation.observation,
      recommendation: evaluation.recommendation || `Address issue: ${evaluation.principle}`,
      evidence: {
        text: evaluation.observation,
        // Phase 21h: Map evidence capture fields
        viewportIndex: evaluation.viewportIndex,
        timestamp: evaluation.timestamp,
        domElementRefs: evaluation.domElementRefs,
        boundingBox: evaluation.boundingBox,
      },
      heuristicId: evaluation.heuristicId,
      confidence: evaluation.confidence,
    };
  }

  /**
   * Create an empty result when no screenshots provided
   */
  private createEmptyResult(
    pageType: PageType,
    viewport: ViewportInfo
  ): MultiViewportAnalysisResult {
    return {
      pageType,
      analyzedAt: Date.now(),
      screenshotUsed: false,
      viewport,
      evaluations: [],
      insights: [],
      summary: {
        totalHeuristics: 0,
        passed: 0,
        failed: 0,
        partial: 0,
        notApplicable: 0,
        coveragePercent: 0,  // Phase 21j
        bySeverity: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
      },
      viewportCount: 0,
      viewportResults: [],
      mergedEvaluations: [],
      deduplicatedCount: 0,
      totalAnalysisTimeMs: 0,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): MultiViewportVisionConfig {
    return { ...this.config };
  }
}

/**
 * Factory function to create MultiViewportVisionAnalyzer
 *
 * @param config - Optional configuration overrides
 * @returns New MultiViewportVisionAnalyzer instance
 */
export function createMultiViewportVisionAnalyzer(
  config?: Partial<MultiViewportVisionConfig>
): MultiViewportVisionAnalyzer {
  return new MultiViewportVisionAnalyzer(config);
}
