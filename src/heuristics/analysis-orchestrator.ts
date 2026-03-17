/**
 * Analysis Orchestrator - CR-001-C (T517)
 *
 * Orchestrates the post-collection analysis phase by iterating through
 * heuristic categories and running batch evaluations.
 */

import pLimit from 'p-limit';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { PageType, ViewportSnapshot } from '../models/index.js';
import type { CROInsight } from '../models/cro-insight.js';
import type { HeuristicEvaluation, VisionAnalysisSummary } from './vision/types.js';
import { groupHeuristicsByCategory, getTotalHeuristicCount, type CategoryGroup } from './category-grouper.js';
import { CategoryAnalyzer, createCategoryAnalyzer, populateElementRefs, type CategoryAnalyzerConfig, type CategoryAnalysisResult, type CapturedCategoryInputs } from './category-analyzer.js';
import { isPageTypeSupported } from './knowledge/index.js';
import { getInsightCategory } from './vision/types.js';
import { createLogger } from '../utils/index.js';
import { MODEL_DEFAULTS } from './model-config.js';
import { groupCategoriesIntoBatches, type BatchStrategy } from './category-batcher.js';
import { buildBatchedSystemPrompt, buildBatchedUserMessage } from './batch-prompt-builder.js';
import { parseBatchedResponse, BatchParseError } from './batch-response-parser.js';
import { selectViewportsForCategory } from './viewport-selector.js';
import { crossValidateEvaluations } from './cross-validator.js';

/**
 * Configuration for analysis orchestrator
 */
export interface AnalysisOrchestratorConfig {
  /** Category analyzer configuration */
  analyzerConfig?: Partial<CategoryAnalyzerConfig>;
  /** Run category analyses in parallel (default: true) */
  parallelAnalysis: boolean;
  /** Max concurrent category analyses when parallel (default: 5) */
  maxConcurrentCategories: number;
  /** Per-category timeout in ms for parallel analysis (default: 120000) */
  parallelTimeoutMs: number;
  /** Enable category batching — multiple categories per LLM call (default: false, opt-in via --category-batching) */
  categoryBatching: boolean;
  /** Batch strategy: 'related' uses predefined pairs, 'custom' uses customBatches */
  batchStrategy: BatchStrategy;
  /** Custom batch definitions (only used when batchStrategy='custom') */
  customBatches?: string[][];
  /** Enable viewport filtering — send only relevant viewports per category (default: false, opt-in via --viewport-filtering) */
  enableViewportFiltering: boolean;
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
  parallelAnalysis: true,
  maxConcurrentCategories: 3,
  parallelTimeoutMs: 300000,
  categoryBatching: false,
  batchStrategy: 'related',
  enableViewportFiltering: false,
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
  /** Phase 23: Captured LLM inputs for each category */
  capturedInputs?: CapturedCategoryInputs[];
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

    // Run analysis — batched or per-category, parallel or sequential
    const categoryResults: CategoryAnalysisResult[] = [];

    if (this.config.categoryBatching) {
      // Phase 26b: Batched analysis (multiple categories per LLM call)
      const results = await this.runBatchedAnalysis(categoryGroups, snapshots, pageType);
      categoryResults.push(...results);
    } else if (this.config.parallelAnalysis) {
      // Phase 26a: Parallel analysis with rate limiting, timeout, and error isolation
      const results = await this.runParallelAnalysis(categoryGroups, snapshots, pageType);
      categoryResults.push(...results);
    } else {
      // Sequential analysis (opt-in via --sequential-analysis)
      for (const group of categoryGroups) {
        const result = await this.analyzeCategory(snapshots, group, pageType);
        categoryResults.push(result);
      }
    }

    // Combine all evaluations
    const allEvaluations = categoryResults.flatMap((r) => r.evaluations);

    // Phase 27G: Cross-validate LLM claims against DOM evidence
    const crossValidation = crossValidateEvaluations(allEvaluations, snapshots);
    if (crossValidation.contradictionCount > 0) {
      this.logger.info('Cross-validation found contradictions', {
        contradictions: crossValidation.contradictionCount,
        flags: crossValidation.flags.map(f => f.heuristicId),
      });
    }

    // Convert evaluations to CROInsights
    const insights = this.evaluationsToInsights(allEvaluations);

    // Calculate summary
    const summary = this.calculateSummary(allEvaluations);

    // Phase 23 (T402): Aggregate captured inputs from all categories
    const capturedInputs = categoryResults
      .map((r) => r.capturedInputs)
      .filter((input): input is CapturedCategoryInputs => input !== undefined);

    const totalTimeMs = Date.now() - startTime;
    this.logger.info('Analysis complete', {
      evaluationCount: allEvaluations.length,
      insightCount: insights.length,
      capturedInputsCount: capturedInputs.length,
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
      capturedInputs: capturedInputs.length > 0 ? capturedInputs : undefined,
    };
  }

  /**
   * Run parallel analysis with p-limit rate limiting, per-category timeout, and error isolation
   */
  private async runParallelAnalysis(
    categoryGroups: CategoryGroup[],
    snapshots: ViewportSnapshot[],
    pageType: PageType
  ): Promise<CategoryAnalysisResult[]> {
    const limit = pLimit(this.config.maxConcurrentCategories);
    const timeoutMs = this.config.parallelTimeoutMs;

    this.logger.info('Running parallel analysis', {
      categories: categoryGroups.length,
      maxConcurrent: this.config.maxConcurrentCategories,
      timeoutMs,
    });

    const promises = categoryGroups.map((group) =>
      limit(async () => {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms: ${group.name}`)), timeoutMs)
        );
        try {
          return await Promise.race([
            this.analyzeCategory(snapshots, group, pageType),
            timeoutPromise,
          ]);
        } catch (error) {
          this.logger.warn(`Category analysis failed: ${group.name}`, { error });
          return this.createEmptyCategoryResult(group, error);
        }
      })
    );

    return await Promise.all(promises);
  }

  /**
   * Run batched analysis — groups categories into batches, each batch is one LLM call.
   * Batches can run in parallel (controlled by parallelAnalysis + maxConcurrentCategories).
   * Falls back to single-category analysis on BatchParseError.
   */
  private async runBatchedAnalysis(
    categoryGroups: CategoryGroup[],
    snapshots: ViewportSnapshot[],
    pageType: PageType
  ): Promise<CategoryAnalysisResult[]> {
    const batches = groupCategoriesIntoBatches(
      categoryGroups,
      this.config.batchStrategy,
      this.config.customBatches
    );

    this.logger.info('Running batched analysis', {
      totalCategories: categoryGroups.length,
      batchCount: batches.length,
      batchSizes: batches.map(b => b.length),
      parallel: this.config.parallelAnalysis,
    });

    const analyzeBatch = async (batch: CategoryGroup[]): Promise<CategoryAnalysisResult[]> => {
      const startTime = Date.now();

      // Single-category batch: use existing per-category analyzer (no batching overhead)
      if (batch.length === 1) {
        const result = await this.analyzeCategory(snapshots, batch[0]!, pageType);
        return [result];
      }

      // Multi-category batch: build batched prompt and parse batched response
      const categories = batch.map(g => ({
        name: g.name,
        description: g.description,
        heuristics: g.heuristics,
      }));

      // Phase 26c: For batched analysis, use union of viewports needed by all categories in batch
      let batchSnapshots = snapshots;
      if (this.config.enableViewportFiltering) {
        const neededIndices = new Set<number>();
        for (const group of batch) {
          const catSnapshots = selectViewportsForCategory(group.name, snapshots);
          for (const s of catSnapshots) {
            neededIndices.add(s.viewportIndex);
          }
        }
        batchSnapshots = snapshots.filter(s => neededIndices.has(s.viewportIndex));
        this.logger.info('Viewport filtering for batch', {
          categories: batch.map(g => g.name),
          totalViewports: snapshots.length,
          filteredViewports: batchSnapshots.length,
        });
      }

      try {
        const systemPrompt = buildBatchedSystemPrompt(pageType);
        const userMessage = buildBatchedUserMessage(categories, batchSnapshots, pageType);

        // Build LLM messages with images
        const userContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
          { type: 'text', text: userMessage },
        ];
        for (const snapshot of batchSnapshots) {
          userContent.push({
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${snapshot.screenshot.base64}` },
          });
        }

        const messages = [
          new SystemMessage(systemPrompt),
          new HumanMessage({ content: userContent }),
        ];

        // Use a fresh LLM instance with scaled maxTokens based on total heuristics in batch
        const analyzerConfig = this.config.analyzerConfig ?? {};
        const baseTokens = analyzerConfig.maxTokens ?? 4096;
        const totalHeuristicsInBatch = categories.reduce((sum, c) => sum + c.heuristics.length, 0);
        // Scale tokens: base per category, ~300 tokens per heuristic for detailed reasoning
        const scaledTokens = Math.max(baseTokens * batch.length, totalHeuristicsInBatch * 300);
        const llm = new ChatOpenAI({
          model: analyzerConfig.model ?? MODEL_DEFAULTS.analysis,
          maxTokens: scaledTokens,
          temperature: analyzerConfig.temperature ?? 0.1,
          timeout: analyzerConfig.timeoutMs ?? 60000,
        });

        const response = await llm.invoke(messages);
        const content = typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

        const batchTimeMs = Date.now() - startTime;
        const results = parseBatchedResponse(content, categories);

        // Populate domElementRefs by parsing [v0-5] refs from LLM text
        for (const result of results) {
          populateElementRefs(result.evaluations, batchSnapshots);
        }

        // Set analysis time and captured inputs on all results
        for (const result of results) {
          result.analysisTimeMs = batchTimeMs;

          // Phase 23 fix: Capture LLM inputs for batched analysis
          result.capturedInputs = {
            categoryName: result.categoryName,
            systemPrompt,
            userPrompt: userMessage,
            screenshots: batchSnapshots.map((s) => ({
              viewportIndex: s.viewportIndex,
              scrollPosition: s.scrollPosition,
              base64: s.screenshot.base64,
            })),
            domSnapshots: batchSnapshots.map((s) => ({
              viewportIndex: s.viewportIndex,
              scrollPosition: s.scrollPosition,
              serialized: s.dom.serialized,
              elementCount: s.dom.elementCount,
            })),
            timestamp: Date.now(),
          };
        }

        this.logger.info('Batch analysis complete', {
          categories: categories.map(c => c.name),
          evaluationCount: results.reduce((sum, r) => sum + r.evaluations.length, 0),
          timeMs: batchTimeMs,
        });

        return results;
      } catch (error) {
        if (error instanceof BatchParseError) {
          // Fallback: re-analyze each category individually
          this.logger.warn('Batch parse failed, falling back to single-category analysis', {
            categories: batch.map(g => g.name),
            error: error.message,
          });
          const fallbackResults: CategoryAnalysisResult[] = [];
          for (const group of batch) {
            try {
              const result = await this.analyzeCategory(snapshots, group, pageType);
              fallbackResults.push(result);
            } catch (innerError) {
              fallbackResults.push(this.createEmptyCategoryResult(group, innerError));
            }
          }
          return fallbackResults;
        }
        // Non-parse error: return empty results for all categories in batch
        this.logger.warn('Batch analysis failed', {
          categories: batch.map(g => g.name),
          error: error instanceof Error ? error.message : String(error),
        });
        return batch.map(g => this.createEmptyCategoryResult(g, error));
      }
    };

    // Execute batches (parallel or sequential)
    // When batching, limit concurrency to 1 to avoid 429 rate limits
    // (each batch already combines multiple categories, so parallelism adds little value)
    if (this.config.parallelAnalysis) {
      const batchConcurrency = 1;
      const limit = pLimit(batchConcurrency);
      const timeoutMs = this.config.parallelTimeoutMs;

      const promises = batches.map((batch) =>
        limit(async () => {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Batch timeout after ${timeoutMs}ms`)), timeoutMs)
          );
          try {
            return await Promise.race([analyzeBatch(batch), timeoutPromise]);
          } catch (error) {
            this.logger.warn('Batch timed out or failed', {
              categories: batch.map(g => g.name),
              error: error instanceof Error ? error.message : String(error),
            });
            return batch.map(g => this.createEmptyCategoryResult(g, error));
          }
        })
      );

      const batchResults = await Promise.all(promises);
      return batchResults.flat();
    } else {
      const allResults: CategoryAnalysisResult[] = [];
      for (const batch of batches) {
        const results = await analyzeBatch(batch);
        allResults.push(...results);
      }
      return allResults;
    }
  }

  /**
   * Create an empty category result for failed/timed-out analyses
   */
  private createEmptyCategoryResult(
    group: CategoryGroup,
    error: unknown
  ): CategoryAnalysisResult {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      categoryName: group.name,
      evaluations: [],
      analysisTimeMs: 0,
      error: errorMsg,
    };
  }

  /**
   * Analyze a single category
   * Phase 26c: Applies viewport filtering when enabled
   */
  private async analyzeCategory(
    snapshots: ViewportSnapshot[],
    group: CategoryGroup,
    pageType: PageType
  ): Promise<CategoryAnalysisResult> {
    // Phase 26c: Filter viewports for this category if enabled
    const filteredSnapshots = this.config.enableViewportFiltering
      ? selectViewportsForCategory(group.name, snapshots)
      : snapshots;

    this.logger.info(`Analyzing category: ${group.name}`, {
      heuristicCount: group.count,
      viewports: filteredSnapshots.length,
      filtered: filteredSnapshots.length < snapshots.length,
    });

    const result = await this.analyzer.analyzeCategory(
      filteredSnapshots,
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

      // Phase 27E (T629): Build element description from domElementRefs if available
      let element = 'N/A';
      if (eval_.domElementRefs && eval_.domElementRefs.length > 0) {
        const ref = eval_.domElementRefs[0]!;
        const text = ref.textContent ? ` "${ref.textContent.slice(0, 30)}"` : '';
        element = `${ref.elementType}[${ref.index}]${text}`;
      }

      const insight: CROInsight = {
        id: `vision-${eval_.heuristicId}-${Date.now()}`,
        category: getInsightCategory(eval_.heuristicId),
        type: eval_.status === 'fail' ? 'heuristic_fail' : 'heuristic_partial',
        severity: eval_.severity,
        issue: eval_.issue || eval_.observation,
        element,
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

