/**
 * Analysis Orchestrator - CR-001-C (T517)
 *
 * Orchestrates the post-collection analysis phase by iterating through
 * heuristic categories and running batch evaluations.
 */

import type { PageType, ViewportSnapshot } from '../models/index.js';
import type { CROInsight } from '../models/cro-insight.js';
import type { HeuristicEvaluation, VisionAnalysisSummary } from './vision/types.js';
import { groupHeuristicsByCategory, getTotalHeuristicCount, type CategoryGroup } from './category-grouper.js';
import { CategoryAnalyzer, createCategoryAnalyzer, type CategoryAnalyzerConfig, type CategoryAnalysisResult } from './category-analyzer.js';
import { isPageTypeSupported } from './knowledge/index.js';
import { getInsightCategory } from './vision/types.js';
import { createLogger } from '../utils/index.js';

/**
 * Configuration for analysis orchestrator
 */
export interface AnalysisOrchestratorConfig {
  /** Category analyzer configuration */
  analyzerConfig?: Partial<CategoryAnalyzerConfig>;
  /** Run category analyses in parallel (default: false for cost control) */
  parallelAnalysis: boolean;
  /** Filter to specific categories */
  includeCategories?: string[];
  /** Exclude specific categories */
  excludeCategories?: string[];
  /** Minimum severity to include */
  minSeverity?: 'critical' | 'high' | 'medium' | 'low';
  /** Verbose logging */
  verbose: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: AnalysisOrchestratorConfig = {
  parallelAnalysis: false,
  verbose: false,
};

/**
 * Complete analysis result from orchestrator
 */
export interface AnalysisResult {
  /** Page type analyzed */
  pageType: PageType;
  /** Timestamp of analysis */
  analyzedAt: number;
  /** Total viewport snapshots analyzed */
  snapshotCount: number;
  /** Categories analyzed */
  categoriesAnalyzed: string[];
  /** Per-category results */
  categoryResults: CategoryAnalysisResult[];
  /** All evaluations across categories */
  evaluations: HeuristicEvaluation[];
  /** Converted to CROInsights for compatibility */
  insights: CROInsight[];
  /** Summary statistics */
  summary: VisionAnalysisSummary;
  /** Total analysis time in milliseconds */
  totalTimeMs: number;
}

/**
 * Analysis Orchestrator - Runs post-collection heuristic analysis
 */
export class AnalysisOrchestrator {
  private readonly config: AnalysisOrchestratorConfig;
  private readonly logger;
  private readonly analyzer: CategoryAnalyzer;

  constructor(config?: Partial<AnalysisOrchestratorConfig>) {
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
    this.logger = createLogger('AnalysisOrchestrator', this.config.verbose);
    this.analyzer = createCategoryAnalyzer(this.config.analyzerConfig);
  }

  /**
   * Run analysis on collected viewport snapshots
   *
   * @param snapshots - Collected viewport snapshots with DOM + screenshots
   * @param pageType - Type of page being analyzed
   * @returns Complete analysis result with evaluations and insights
   */
  async runAnalysis(
    snapshots: ViewportSnapshot[],
    pageType: PageType
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    this.logger.info('Starting analysis', {
      pageType,
      snapshotCount: snapshots.length,
    });

    // Check if page type is supported
    if (!isPageTypeSupported(pageType)) {
      this.logger.warn(`Page type not supported: ${pageType}`);
      return this.createEmptyResult(pageType, snapshots.length, startTime);
    }

    // Group heuristics by category
    const categoryGroups = groupHeuristicsByCategory(pageType, {
      includeCategories: this.config.includeCategories,
      excludeCategories: this.config.excludeCategories,
      minSeverity: this.config.minSeverity,
    });

    const totalHeuristics = getTotalHeuristicCount(categoryGroups);
    this.logger.info('Categories loaded', {
      categoryCount: categoryGroups.length,
      totalHeuristics,
    });

    // Run analysis for each category
    const categoryResults: CategoryAnalysisResult[] = [];

    if (this.config.parallelAnalysis) {
      // Parallel analysis (faster but higher API cost)
      const promises = categoryGroups.map((group) =>
        this.analyzeCategory(snapshots, group, pageType)
      );
      const results = await Promise.all(promises);
      categoryResults.push(...results);
    } else {
      // Sequential analysis (default - more cost-controlled)
      for (const group of categoryGroups) {
        const result = await this.analyzeCategory(snapshots, group, pageType);
        categoryResults.push(result);
      }
    }

    // Combine all evaluations
    const allEvaluations = categoryResults.flatMap((r) => r.evaluations);

    // Convert evaluations to CROInsights
    const insights = this.evaluationsToInsights(allEvaluations);

    // Calculate summary
    const summary = this.calculateSummary(allEvaluations);

    const totalTimeMs = Date.now() - startTime;
    this.logger.info('Analysis complete', {
      evaluationCount: allEvaluations.length,
      insightCount: insights.length,
      totalTimeMs,
    });

    return {
      pageType,
      analyzedAt: Date.now(),
      snapshotCount: snapshots.length,
      categoriesAnalyzed: categoryGroups.map((g) => g.name),
      categoryResults,
      evaluations: allEvaluations,
      insights,
      summary,
      totalTimeMs,
    };
  }

  /**
   * Analyze a single category
   */
  private async analyzeCategory(
    snapshots: ViewportSnapshot[],
    group: CategoryGroup,
    pageType: PageType
  ): Promise<CategoryAnalysisResult> {
    this.logger.info(`Analyzing category: ${group.name}`, {
      heuristicCount: group.count,
    });

    const result = await this.analyzer.analyzeCategory(
      snapshots,
      {
        name: group.name,
        description: group.description,
        heuristics: group.heuristics,
      },
      pageType
    );

    this.logger.info(`Category complete: ${group.name}`, {
      evaluations: result.evaluations.length,
      timeMs: result.analysisTimeMs,
    });

    return result;
  }

  /**
   * Convert HeuristicEvaluation[] to CROInsight[] for compatibility
   */
  private evaluationsToInsights(evaluations: HeuristicEvaluation[]): CROInsight[] {
    const insights: CROInsight[] = [];

    for (const eval_ of evaluations) {
      // Only create insights for failed or partial evaluations
      if (eval_.status === 'pass' || eval_.status === 'not_applicable') {
        continue;
      }

      const insight: CROInsight = {
        id: `vision-${eval_.heuristicId}-${Date.now()}`,
        category: getInsightCategory(eval_.heuristicId),
        type: eval_.status === 'fail' ? 'heuristic_fail' : 'heuristic_partial',
        severity: eval_.severity,
        issue: eval_.issue || eval_.observation,
        element: 'N/A',
        recommendation: eval_.recommendation || 'Review and address the issue',
        heuristicId: eval_.heuristicId,
        confidence: eval_.confidence,
      };

      insights.push(insight);
    }

    return insights;
  }

  /**
   * Calculate summary statistics from evaluations
   */
  private calculateSummary(evaluations: HeuristicEvaluation[]): VisionAnalysisSummary {
    const summary: VisionAnalysisSummary = {
      totalHeuristics: evaluations.length,
      passed: 0,
      failed: 0,
      partial: 0,
      notApplicable: 0,
      coveragePercent: evaluations.length > 0 ? 100 : 0,  // Phase 21j
      bySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    };

    for (const eval_ of evaluations) {
      // Count by status
      switch (eval_.status) {
        case 'pass':
          summary.passed++;
          break;
        case 'fail':
          summary.failed++;
          summary.bySeverity[eval_.severity]++;
          break;
        case 'partial':
          summary.partial++;
          summary.bySeverity[eval_.severity]++;
          break;
        case 'not_applicable':
          summary.notApplicable++;
          break;
      }
    }

    return summary;
  }

  /**
   * Create empty result for unsupported page types or errors
   */
  private createEmptyResult(
    pageType: PageType,
    snapshotCount: number,
    startTime: number
  ): AnalysisResult {
    return {
      pageType,
      analyzedAt: Date.now(),
      snapshotCount,
      categoriesAnalyzed: [],
      categoryResults: [],
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
      totalTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Factory function to create an analysis orchestrator
 */
export function createAnalysisOrchestrator(
  config?: Partial<AnalysisOrchestratorConfig>
): AnalysisOrchestrator {
  return new AnalysisOrchestrator(config);
}
