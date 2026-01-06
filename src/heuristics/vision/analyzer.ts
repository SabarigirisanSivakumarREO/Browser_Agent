/**
 * CRO Vision Analyzer - Phase 21c (T310)
 *
 * Analyzes page screenshots against heuristics using GPT-4o Vision.
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { v4 as uuid } from 'uuid';

import type { PageType } from '../../models/index.js';
import type { CROInsight } from '../../models/cro-insight.js';
import type { ViewportInfo } from '../../models/page-state.js';
import type { PageTypeHeuristics } from '../knowledge/index.js';
import { loadHeuristics, isPageTypeSupported } from '../knowledge/index.js';

import type {
  CROVisionAnalyzerConfig,
  CROVisionAnalysisResult,
  HeuristicEvaluation,
  VisionAnalysisSummary,
} from './types.js';
import { DEFAULT_VISION_CONFIG, getInsightCategory } from './types.js';
import { buildSystemPrompt, buildVisionPrompt } from './prompt-builder.js';
import { parseVisionResponse } from './response-parser.js';

/**
 * CRO Vision Analyzer
 *
 * Analyzes page screenshots against Baymard heuristics using GPT-4o Vision.
 */
export class CROVisionAnalyzer {
  private config: CROVisionAnalyzerConfig;
  private knowledgeCache: Map<PageType, PageTypeHeuristics>;

  constructor(config?: Partial<CROVisionAnalyzerConfig>) {
    this.config = { ...DEFAULT_VISION_CONFIG, ...config };
    this.knowledgeCache = new Map();
  }

  /**
   * Analyze a page screenshot against heuristics for the given page type
   *
   * @param screenshot - Base64 encoded screenshot (with or without data URL prefix)
   * @param pageType - Type of page being analyzed
   * @param viewport - Viewport information
   * @returns Complete vision analysis result
   */
  async analyze(
    screenshot: string,
    pageType: PageType,
    viewport: ViewportInfo
  ): Promise<CROVisionAnalysisResult> {
    // Validate page type support
    if (!isPageTypeSupported(pageType)) {
      throw new Error(
        `Vision analysis not supported for page type: ${pageType}. ` +
        `Only 'pdp' is currently supported.`
      );
    }

    // Load heuristics
    const heuristics = await this.loadHeuristics(pageType);

    // Build prompts
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildVisionPrompt(heuristics, viewport);

    // Call vision API
    const response = await this.callVisionAPI(screenshot, systemPrompt, userPrompt);

    // Parse response
    const evaluations = parseVisionResponse(response, heuristics);

    // Transform to CROInsights
    const insights = this.transformToInsights(evaluations);

    // Calculate summary
    const summary = this.calculateSummary(evaluations);

    return {
      pageType,
      analyzedAt: Date.now(),
      screenshotUsed: true,
      viewport,
      evaluations,
      insights,
      summary,
    };
  }

  /**
   * Load heuristics with caching
   */
  private async loadHeuristics(pageType: PageType): Promise<PageTypeHeuristics> {
    const cached = this.knowledgeCache.get(pageType);
    if (cached) {
      return cached;
    }

    const heuristics = loadHeuristics(pageType);
    this.knowledgeCache.set(pageType, heuristics);
    return heuristics;
  }

  /**
   * Call GPT-4o Vision API
   */
  private async callVisionAPI(
    screenshot: string,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    // Initialize model
    const model = new ChatOpenAI({
      modelName: this.config.model,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    // Ensure screenshot has proper data URL format
    const imageUrl = this.formatScreenshotUrl(screenshot);

    // Build messages with vision content
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage({
        content: [
          {
            type: 'text',
            text: userPrompt,
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'high', // Use high detail for better analysis
            },
          },
        ],
      }),
    ];

    // Call API
    const response = await model.invoke(messages);

    // Extract content
    const content = response.content;
    if (typeof content !== 'string') {
      throw new Error('Unexpected response format from vision API');
    }

    return content;
  }

  /**
   * Format screenshot as data URL if needed
   */
  private formatScreenshotUrl(screenshot: string): string {
    // Already a data URL
    if (screenshot.startsWith('data:image/')) {
      return screenshot;
    }

    // Already a URL
    if (screenshot.startsWith('http://') || screenshot.startsWith('https://')) {
      return screenshot;
    }

    // Assume base64 PNG
    return `data:image/png;base64,${screenshot}`;
  }

  /**
   * Transform heuristic evaluations to CROInsight[] for compatibility
   */
  private transformToInsights(evaluations: HeuristicEvaluation[]): CROInsight[] {
    return evaluations
      .filter((e) => e.status === 'fail' || e.status === 'partial')
      .map((e) => this.evaluationToInsight(e));
  }

  /**
   * Convert a single evaluation to CROInsight
   */
  private evaluationToInsight(evaluation: HeuristicEvaluation): CROInsight {
    const category = getInsightCategory(evaluation.heuristicId);
    const type = this.heuristicIdToType(evaluation.heuristicId);

    return {
      id: uuid(),
      category,
      type,
      severity: evaluation.severity,
      element: 'viewport', // Vision analysis is viewport-based
      issue: evaluation.issue || evaluation.observation,
      recommendation: evaluation.recommendation || this.generateDefaultRecommendation(evaluation),
      evidence: {
        text: evaluation.observation,
      },
      heuristicId: evaluation.heuristicId,
      confidence: evaluation.confidence,
    };
  }

  /**
   * Convert heuristic ID to insight type
   * PDP-PRICE-001 -> pdp_price_001
   */
  private heuristicIdToType(heuristicId: string): string {
    return heuristicId.toLowerCase().replace(/-/g, '_');
  }

  /**
   * Generate a default recommendation based on the evaluation
   */
  private generateDefaultRecommendation(evaluation: HeuristicEvaluation): string {
    if (evaluation.status === 'partial') {
      return `Review and improve: ${evaluation.principle}`;
    }
    return `Address issue: ${evaluation.principle}`;
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
      bySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    };

    for (const evaluation of evaluations) {
      // Count by status
      switch (evaluation.status) {
        case 'pass':
          summary.passed++;
          break;
        case 'fail':
          summary.failed++;
          // Count failed by severity
          summary.bySeverity[evaluation.severity]++;
          break;
        case 'partial':
          summary.partial++;
          // Count partial failures by severity too
          summary.bySeverity[evaluation.severity]++;
          break;
        case 'not_applicable':
          summary.notApplicable++;
          break;
      }
    }

    return summary;
  }

  /**
   * Get current configuration
   */
  getConfig(): CROVisionAnalyzerConfig {
    return { ...this.config };
  }

  /**
   * Clear the knowledge cache
   */
  clearCache(): void {
    this.knowledgeCache.clear();
  }
}

/**
 * Factory function to create CROVisionAnalyzer
 */
export function createCROVisionAnalyzer(
  config?: Partial<CROVisionAnalyzerConfig>
): CROVisionAnalyzer {
  return new CROVisionAnalyzer(config);
}
