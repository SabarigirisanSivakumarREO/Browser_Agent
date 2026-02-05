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
  /** How the LLM found this - references elements, classes, screenshot observations */
  reasoning?: string;
}

/**
 * Expected LLM response structure
 */
interface CategoryAnalysisResponse {
  evaluations: RawCategoryEvaluation[];
  summary: string;
}

/**
 * Phase 23 (T402): Captured LLM inputs for a single category analysis
 */
export interface CapturedCategoryInputs {
  /** Category name */
  categoryName: string;
  /** System prompt sent to LLM */
  systemPrompt: string;
  /** User prompt text (without images) */
  userPrompt: string;
  /** Screenshots sent to LLM (base64) */
  screenshots: Array<{
    viewportIndex: number;
    scrollPosition: number;
    base64: string;
  }>;
  /** DOM snapshots included in prompt */
  domSnapshots: Array<{
    viewportIndex: number;
    scrollPosition: number;
    serialized: string;
    elementCount: number;
  }>;
  /** Timestamp when captured */
  timestamp: number;
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
  /** Phase 23: Captured LLM inputs for debugging */
  capturedInputs?: CapturedCategoryInputs;
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

    // Phase 23 (T402): Capture LLM inputs for debugging
    const capturedInputs: CapturedCategoryInputs = {
      categoryName: category.name,
      systemPrompt,
      userPrompt: userMessage,
      screenshots: snapshots.map((s) => ({
        viewportIndex: s.viewportIndex,
        scrollPosition: s.scrollPosition,
        base64: s.screenshot.base64,
      })),
      domSnapshots: snapshots.map((s) => ({
        viewportIndex: s.viewportIndex,
        scrollPosition: s.scrollPosition,
        serialized: s.dom.serialized,
        elementCount: s.dom.elementCount,
      })),
      timestamp: Date.now(),
    };

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
        capturedInputs,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Analysis failed';
      this.logger.error(`Category analysis failed: ${category.name}`, { error: errMsg });

      // Return empty result on error (still include captured inputs for debugging)
      return {
        categoryName: category.name,
        evaluations: [],
        summary: `Analysis failed: ${errMsg}`,
        analysisTimeMs: Date.now() - startTime,
        capturedInputs,
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
- reasoning: REQUIRED - Explain HOW you found this from the input:
  - Reference specific DOM elements using [v0-5] format (viewport-element)
  - Mention what you searched for (classes, text, attributes)
  - Cite screenshot observations (position, visibility, coordinates)
  - Note if structured data (JSON-LD) was used
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
      "reasoning": "Found gallery element [v0-3] with class='product-gallery'. Screenshot shows 5 thumbnail images at coordinates (50-300, 400-600). DOM contains img tags with srcset for multiple resolutions."
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
   * Phase 25-fix: Uses V{n}-0 format for viewport identification
   * Phase 25-fix: Element indices displayed as [v{viewport}-{index}] for LLM clarity
   */
  private buildDOMContextSection(snapshots: ViewportSnapshot[]): string {
    if (snapshots.length === 0) {
      return '<dom_context>\nNo DOM snapshots available.\n</dom_context>';
    }

    const parts: string[] = ['<dom_context>'];
    parts.push(`Total viewport snapshots: ${snapshots.length}`);
    parts.push('');

    for (const snapshot of snapshots) {
      const viewportIndex = snapshot.viewportIndex;
      parts.push(`--- Viewport-${viewportIndex} (scroll: ${snapshot.scrollPosition}px) ---`);
      parts.push(`Elements: ${snapshot.dom.elementCount}`);
      // Transform [N] to [v{viewport}-N] for LLM display
      const transformedDom = this.transformElementIndicesForDisplay(
        snapshot.dom.serialized,
        viewportIndex
      );
      parts.push(transformedDom);
      parts.push('');
    }

    parts.push('</dom_context>');
    return parts.join('\n');
  }

  /**
   * Transform element indices from [N] to [v{viewport}-N] format for LLM display
   * This is display-only; internal code still uses numeric indices
   *
   * @param serializedDom - Serialized DOM string with [0], [1], etc.
   * @param viewportIndex - Current viewport index
   * @returns Transformed string with [v0-0], [v0-1], etc.
   */
  private transformElementIndicesForDisplay(serializedDom: string, viewportIndex: number): string {
    // Replace [N] with [v{viewport}-N] where N is a number
    // Matches patterns like [0], [1], [42], etc. at the start of element lines
    return serializedDom.replace(/\[(\d+)\]/g, `[v${viewportIndex}-$1]`);
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
   * Phase 25-fix: Uses Viewport-{n} format matching DOM context section
   */
  private buildScreenshotSection(snapshots: ViewportSnapshot[]): string {
    if (snapshots.length === 0) {
      return '<screenshots>\nNo screenshots available.\n</screenshots>';
    }

    const parts: string[] = ['<screenshots>'];
    parts.push(`${snapshots.length} screenshot(s) attached to this message.`);
    parts.push('');

    for (const snapshot of snapshots) {
      parts.push(`Screenshot Viewport-${snapshot.viewportIndex}: Captured at scroll position ${snapshot.scrollPosition}px`);
    }

    parts.push('');
    parts.push('Use these visual references to verify DOM observations and assess visual quality.');
    parts.push('Reference elements using [v{viewport}-{index}] format (e.g., [v0-5] for element 5 in Viewport-0).');
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
        reasoning: raw.reasoning,
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

// ═══════════════════════════════════════════════════════════════════════════════
// Utility Functions for Element Reference Parsing
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parsed element reference from LLM response
 */
export interface ParsedElementRef {
  /** Viewport index (0, 1, 2, ...) */
  viewportIndex: number;
  /** Element index within DOM (numeric) */
  elementIndex: number;
  /** Original reference string (e.g., "[v0-5]") */
  original: string;
}

/**
 * Parse a viewport-prefixed element reference from LLM response
 * Converts [v0-5] format back to numeric indices for programmatic use
 *
 * @param ref - Reference string like "[v0-5]" or "v0-5"
 * @returns Parsed reference or null if invalid format
 *
 * @example
 * parseElementRef("[v0-5]") // { viewportIndex: 0, elementIndex: 5, original: "[v0-5]" }
 * parseElementRef("v2-10") // { viewportIndex: 2, elementIndex: 10, original: "v2-10" }
 * parseElementRef("[42]") // null (old format, not viewport-prefixed)
 */
export function parseElementRef(ref: string): ParsedElementRef | null {
  // Match patterns: [v0-5], v0-5, [V0-5], V0-5 (case insensitive)
  const match = ref.match(/\[?[vV](\d+)-(\d+)\]?/);
  if (!match || !match[1] || !match[2]) {
    return null;
  }

  return {
    viewportIndex: parseInt(match[1], 10),
    elementIndex: parseInt(match[2], 10),
    original: ref,
  };
}

/**
 * Extract all element references from a text string
 * Finds all [v{viewport}-{index}] patterns in the text
 *
 * @param text - Text containing element references
 * @returns Array of parsed references
 *
 * @example
 * extractElementRefs("The button [v0-5] and link [v1-3] are visible")
 * // Returns: [{ viewportIndex: 0, elementIndex: 5, ... }, { viewportIndex: 1, elementIndex: 3, ... }]
 */
export function extractElementRefs(text: string): ParsedElementRef[] {
  const refs: ParsedElementRef[] = [];
  // Match all [v{n}-{m}] patterns globally
  const matches = text.matchAll(/\[v(\d+)-(\d+)\]/gi);

  for (const match of matches) {
    if (match[1] && match[2]) {
      refs.push({
        viewportIndex: parseInt(match[1], 10),
        elementIndex: parseInt(match[2], 10),
        original: match[0],
      });
    }
  }

  return refs;
}

/**
 * Convert a viewport-prefixed reference to a numeric index
 * For backward compatibility with code expecting numeric indices
 *
 * @param ref - Reference string like "[v0-5]"
 * @returns Numeric element index or null if invalid
 */
export function toNumericIndex(ref: string): number | null {
  const parsed = parseElementRef(ref);
  return parsed ? parsed.elementIndex : null;
}
