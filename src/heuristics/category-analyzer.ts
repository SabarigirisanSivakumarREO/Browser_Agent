/**
 * Category Analyzer - CR-001-C (T516)
 *
 * Analyzes a single heuristic category against collected viewport snapshots.
 * Makes one LLM call per category for efficient batch evaluation.
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { PageType, ViewportSnapshot } from '../models/index.js';
import type { HeuristicCategory } from './knowledge/index.js';
import type { HeuristicEvaluation, EvaluationStatus } from './vision/types.js';
import type { Severity } from '../models/cro-insight.js';
import { createLogger } from '../utils/index.js';

/**
 * Configuration for category analyzer
 */
export interface CategoryAnalyzerConfig {
  /** Vision model to use */
  model: 'gpt-4o' | 'gpt-4o-mini';
  /** Max tokens for response */
  maxTokens: number;
  /** Temperature for response (0.0-1.0) */
  temperature: number;
  /** Timeout for LLM call in milliseconds */
  timeoutMs: number;
}

/**
 * Default configuration
 */
export const DEFAULT_CATEGORY_ANALYZER_CONFIG: CategoryAnalyzerConfig = {
  model: 'gpt-4o-mini',
  maxTokens: 4096,
  temperature: 0.1,
  timeoutMs: 60000,
};

/**
 * Raw evaluation from LLM response
 */
interface RawCategoryEvaluation {
  heuristicId: string;
  status: string;
  confidence: number;
  observation: string;
  issue?: string;
  recommendation?: string;
  evidence?: string;
}

/**
 * Expected LLM response structure
 */
interface CategoryAnalysisResponse {
  evaluations: RawCategoryEvaluation[];
  summary: string;
}

/**
 * Result from analyzing a category
 */
export interface CategoryAnalysisResult {
  /** Category that was analyzed */
  categoryName: string;
  /** Per-heuristic evaluations */
  evaluations: HeuristicEvaluation[];
  /** Summary from LLM */
  summary: string;
  /** Time taken for analysis in milliseconds */
  analysisTimeMs: number;
}

/**
 * Category Analyzer - Evaluates heuristics against collected snapshots
 */
export class CategoryAnalyzer {
  private readonly config: CategoryAnalyzerConfig;
  private readonly logger;
  private readonly llm: ChatOpenAI;

  constructor(config?: Partial<CategoryAnalyzerConfig>) {
    this.config = { ...DEFAULT_CATEGORY_ANALYZER_CONFIG, ...config };
    this.logger = createLogger('CategoryAnalyzer', false);
    this.llm = new ChatOpenAI({
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      timeout: this.config.timeoutMs,
    });
  }

  /**
   * Analyze a category against collected viewport snapshots
   *
   * @param snapshots - Collected viewport snapshots with DOM + screenshots
   * @param category - Heuristic category to evaluate
   * @param pageType - Type of page being analyzed
   * @returns Category analysis result with evaluations
   */
  async analyzeCategory(
    snapshots: ViewportSnapshot[],
    category: HeuristicCategory,
    pageType: PageType
  ): Promise<CategoryAnalysisResult> {
    const startTime = Date.now();
    this.logger.info(`Analyzing category: ${category.name}`, {
      heuristicCount: category.heuristics.length,
      snapshotCount: snapshots.length,
    });

    // Build system prompt for analysis
    const systemPrompt = this.buildSystemPrompt(pageType);

    // Build user message with DOM context, screenshots, and heuristics
    const userMessage = this.buildUserMessage(snapshots, category, pageType);

    // Build messages array with images
    const messages = this.buildMessagesWithImages(systemPrompt, userMessage, snapshots);

    try {
      // Call LLM
      const response = await this.llm.invoke(messages);
      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      // Parse response
      const parsed = this.parseResponse(content, category);

      const analysisTimeMs = Date.now() - startTime;
      this.logger.info(`Category analysis complete: ${category.name}`, {
        evaluationCount: parsed.evaluations.length,
        timeMs: analysisTimeMs,
      });

      return {
        categoryName: category.name,
        evaluations: parsed.evaluations,
        summary: parsed.summary,
        analysisTimeMs,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Analysis failed';
      this.logger.error(`Category analysis failed: ${category.name}`, { error: errMsg });

      // Return empty result on error
      return {
        categoryName: category.name,
        evaluations: [],
        summary: `Analysis failed: ${errMsg}`,
        analysisTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Build system prompt for analysis phase
   */
  private buildSystemPrompt(pageType: PageType): string {
    return `<identity>
You are a CRO (Conversion Rate Optimization) expert analyst performing visual heuristic analysis.
You have been given DOM snapshots and screenshots from different scroll positions on a ${pageType.toUpperCase()} page.
</identity>

<task>
Evaluate the page against the provided heuristics based on both DOM structure and visual appearance.
For each heuristic, determine if it passes, fails, is partially met, or is not applicable.
</task>

<evaluation_format>
For each heuristic, provide:
- heuristicId: The exact ID from the heuristics list
- status: "pass" | "fail" | "partial" | "not_applicable"
- confidence: number 0-1 (how confident you are in this evaluation)
- observation: Brief description of what you observed
- issue: (if fail/partial) Specific problem identified
- recommendation: (if fail/partial) Actionable fix suggestion
- evidence: Element index or visual region supporting your evaluation
</evaluation_format>

<output_format>
Respond with valid JSON only:
{
  "evaluations": [
    {
      "heuristicId": "PDP-IMAGERY-001",
      "status": "pass" | "fail" | "partial" | "not_applicable",
      "confidence": 0.85,
      "observation": "What you observed",
      "issue": "Problem identified (if any)",
      "recommendation": "Suggested fix (if any)",
      "evidence": "Element [5] or visual region"
    }
  ],
  "summary": "Brief overall assessment of this category"
}
</output_format>`;
  }

  /**
   * Build user message for category-specific analysis
   */
  private buildUserMessage(
    snapshots: ViewportSnapshot[],
    category: HeuristicCategory,
    pageType: PageType
  ): string {
    // Build DOM context section
    const domContext = this.buildDOMContextSection(snapshots);

    // Build heuristics section
    const heuristicsSection = this.buildHeuristicsSection(category);

    // Build screenshot reference section
    const screenshotSection = this.buildScreenshotSection(snapshots);

    return `<page_type>${pageType.toUpperCase()}</page_type>
<analysis_category>${category.name}</analysis_category>
<category_description>${category.description}</category_description>

${domContext}

${screenshotSection}

${heuristicsSection}

Evaluate each heuristic in the "${category.name}" category using the DOM structure and screenshots provided.
Reference specific element indices [N] or screenshot regions in your evidence.
Respond with valid JSON only.`;
  }

  /**
   * Build DOM context section from snapshots
   */
  private buildDOMContextSection(snapshots: ViewportSnapshot[]): string {
    if (snapshots.length === 0) {
      return '<dom_context>\nNo DOM snapshots available.\n</dom_context>';
    }

    const parts: string[] = ['<dom_context>'];
    parts.push(`Total viewport snapshots: ${snapshots.length}`);
    parts.push('');

    for (const snapshot of snapshots) {
      parts.push(`--- Viewport ${snapshot.viewportIndex} (scroll: ${snapshot.scrollPosition}px) ---`);
      parts.push(`Elements: ${snapshot.dom.elementCount}`);
      parts.push(snapshot.dom.serialized);
      parts.push('');
    }

    parts.push('</dom_context>');
    return parts.join('\n');
  }

  /**
   * Build heuristics section for a category
   */
  private buildHeuristicsSection(category: HeuristicCategory): string {
    const parts: string[] = ['<heuristics>'];
    parts.push(`Category: ${category.name}`);
    parts.push(`Heuristics to evaluate: ${category.heuristics.length}`);
    parts.push('');

    for (const heuristic of category.heuristics) {
      parts.push(`[${heuristic.id}] (${heuristic.severity})`);
      parts.push(`Principle: ${heuristic.principle}`);
      if (heuristic.checkpoints.length > 0) {
        parts.push('Checkpoints:');
        for (const checkpoint of heuristic.checkpoints) {
          parts.push(`  - ${checkpoint}`);
        }
      }
      parts.push('');
    }

    parts.push('</heuristics>');
    return parts.join('\n');
  }

  /**
   * Build screenshot reference section
   */
  private buildScreenshotSection(snapshots: ViewportSnapshot[]): string {
    if (snapshots.length === 0) {
      return '<screenshots>\nNo screenshots available.\n</screenshots>';
    }

    const parts: string[] = ['<screenshots>'];
    parts.push(`${snapshots.length} screenshot(s) attached to this message.`);
    parts.push('');

    for (const snapshot of snapshots) {
      parts.push(`Screenshot ${snapshot.viewportIndex}: Captured at scroll position ${snapshot.scrollPosition}px`);
    }

    parts.push('');
    parts.push('Use these visual references to verify DOM observations and assess visual quality.');
    parts.push('</screenshots>');
    return parts.join('\n');
  }

  /**
   * Build messages array with images for LLM call
   * Uses LangChain message types for proper typing
   */
  private buildMessagesWithImages(
    systemPrompt: string,
    userMessage: string,
    snapshots: ViewportSnapshot[]
  ): Array<SystemMessage | HumanMessage> {
    const messages: Array<SystemMessage | HumanMessage> = [
      new SystemMessage(systemPrompt),
    ];

    // Build user message with images
    const userContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
      { type: 'text', text: userMessage },
    ];

    // Add screenshots as images
    for (const snapshot of snapshots) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${snapshot.screenshot.base64}`,
        },
      });
    }

    messages.push(new HumanMessage({ content: userContent }));

    return messages;
  }

  /**
   * Parse LLM response into evaluations
   */
  private parseResponse(
    content: string,
    category: HeuristicCategory
  ): { evaluations: HeuristicEvaluation[]; summary: string } {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1]!.trim() : content.trim();

      const parsed: CategoryAnalysisResponse = JSON.parse(jsonStr);

      // Map severity from heuristic definitions
      const severityMap = new Map<string, Severity>();
      for (const h of category.heuristics) {
        severityMap.set(h.id, h.severity as Severity);
      }

      // Map principle from heuristic definitions
      const principleMap = new Map<string, string>();
      for (const h of category.heuristics) {
        principleMap.set(h.id, h.principle);
      }

      // Transform raw evaluations to typed evaluations
      const evaluations: HeuristicEvaluation[] = parsed.evaluations.map((raw) => ({
        heuristicId: raw.heuristicId,
        principle: principleMap.get(raw.heuristicId) ?? '',
        status: this.normalizeStatus(raw.status),
        severity: severityMap.get(raw.heuristicId) ?? 'medium',
        observation: raw.observation,
        issue: raw.issue,
        recommendation: raw.recommendation,
        confidence: Math.min(1, Math.max(0, raw.confidence)),
      }));

      return {
        evaluations,
        summary: parsed.summary || '',
      };
    } catch (error) {
      this.logger.warn('Failed to parse LLM response', {
        error: error instanceof Error ? error.message : 'Parse error',
        contentLength: content.length,
      });
      return { evaluations: [], summary: 'Failed to parse response' };
    }
  }

  /**
   * Normalize status string to EvaluationStatus
   */
  private normalizeStatus(status: string): EvaluationStatus {
    const normalized = status.toLowerCase().trim();
    switch (normalized) {
      case 'pass':
      case 'passed':
        return 'pass';
      case 'fail':
      case 'failed':
        return 'fail';
      case 'partial':
      case 'partially':
        return 'partial';
      case 'not_applicable':
      case 'n/a':
      case 'na':
        return 'not_applicable';
      default:
        return 'not_applicable';
    }
  }
}

/**
 * Factory function to create a category analyzer
 */
export function createCategoryAnalyzer(
  config?: Partial<CategoryAnalyzerConfig>
): CategoryAnalyzer {
  return new CategoryAnalyzer(config);
}
