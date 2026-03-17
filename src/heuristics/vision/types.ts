/**
 * CRO Vision Analyzer Types - Phase 21c (T307) + Phase 21h (T353)
 *
 * Types for GPT-4o Vision-based CRO heuristic analysis.
 * Phase 21h adds evidence capture types for audit trails.
 */

import type { PageType } from '../../models/index.js';
import type { CROInsight, Severity, InsightCategory } from '../../models/cro-insight.js';
import type { ViewportInfo } from '../../models/page-state.js';
import { MODEL_DEFAULTS } from '../model-config.js';

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 21h: Evidence Capture Types (T353)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reference to a DOM element with identifying information
 */
export interface DOMElementRef {
  /** Index of the element in the DOM tree (as shown in serialized format [0], [1], etc.) */
  index: number;
  /** CSS selector for the element (if available) */
  selector?: string;
  /** XPath for the element (if available) */
  xpath?: string;
  /** Element type (tag name or CRO type like 'cta', 'form', etc.) */
  elementType: string;
  /** Text content of the element (truncated if long) */
  textContent?: string;
  /** Viewport reference string (e.g., "[v0-5]") for cross-viewport matching */
  viewportRef?: string;
}

/**
 * Bounding box coordinates for an element in the screenshot
 */
export interface BoundingBox {
  /** X coordinate (left edge) in pixels */
  x: number;
  /** Y coordinate (top edge) in pixels */
  y: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Which viewport snapshot this bounding box is relative to */
  viewportIndex: number;
}

/**
 * Evaluation status for a heuristic
 */
export type EvaluationStatus = 'pass' | 'fail' | 'partial' | 'not_applicable';

/**
 * Configuration for CRO Vision Analyzer
 */
export interface CROVisionAnalyzerConfig {
  /** Vision model to use */
  model: 'gpt-4o' | 'gpt-4o-mini';
  /** Max tokens for response */
  maxTokens: number;
  /** Temperature for response (0.0-1.0) */
  temperature: number;
  /** Whether to include detailed observations */
  includeObservations: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_VISION_CONFIG: CROVisionAnalyzerConfig = {
  model: MODEL_DEFAULTS.analysis,
  maxTokens: 4096,
  temperature: 0.1,
  includeObservations: true,
};

/**
 * Evaluation result for a single heuristic
 */
export interface HeuristicEvaluation {
  /** Heuristic ID: PDP-PRICE-001 */
  heuristicId: string;
  /** Original principle text */
  principle: string;
  /** Evaluation status */
  status: EvaluationStatus;
  /** Issue severity from heuristic definition */
  severity: Severity;
  /** What the LLM observed in the screenshot */
  observation: string;
  /** If failed/partial, what's wrong */
  issue?: string;
  /** How to fix the issue */
  recommendation?: string;
  /** Confidence score 0-1 */
  confidence: number;
  /**
   * How the LLM arrived at this conclusion based on the input data.
   * References specific elements [v0-5], DOM content, or screenshot observations
   * that led to this evaluation.
   * Example: "Found price element [v0-12] showing '£65.00' in the DOM.
   *          Confirmed visible in screenshot at coordinates (450, 280)."
   */
  reasoning?: string;

  // ═══════════════════════════════════════════════════════════════════════════════
  // Phase 21h: Evidence Capture Fields (T353)
  // ═══════════════════════════════════════════════════════════════════════════════

  /** Which viewport snapshot the evaluation came from (0-indexed) */
  viewportIndex?: number;
  /** Path to saved screenshot file (populated when --save-evidence is used) */
  screenshotRef?: string;
  /** References to DOM elements mentioned in the evaluation */
  domElementRefs?: DOMElementRef[];
  /** Bounding box of the primary element related to this evaluation */
  boundingBox?: BoundingBox;
  /** Timestamp when evaluation was made (epoch milliseconds) */
  timestamp?: number;
}

/**
 * Summary statistics for vision analysis
 */
export interface VisionAnalysisSummary {
  /** Total heuristics evaluated */
  totalHeuristics: number;
  /** Count of passed heuristics */
  passed: number;
  /** Count of failed heuristics */
  failed: number;
  /** Count of partially met heuristics */
  partial: number;
  /** Count of not applicable heuristics */
  notApplicable: number;
  /** Coverage percentage (0-100) - Phase 21j */
  coveragePercent: number;
  /** Failed counts by severity */
  bySeverity: Record<Severity, number>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 23: Captured LLM Inputs (T401)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Captured inputs sent to the LLM for a single analysis call
 * Used for debugging, auditing, and reproducibility
 */
export interface CapturedLLMInputs {
  /** System prompt text sent to LLM */
  systemPrompt: string;
  /** User prompt text sent to LLM */
  userPrompt: string;
  /** Raw screenshot base64 sent to LLM (before annotation) */
  screenshotBase64: string;
}

/**
 * Complete vision analysis result
 */
export interface CROVisionAnalysisResult {
  /** Page type analyzed */
  pageType: PageType;
  /** Timestamp of analysis */
  analyzedAt: number;
  /** Whether screenshot was used */
  screenshotUsed: boolean;
  /** Viewport info used for analysis */
  viewport: ViewportInfo;
  /** Per-heuristic evaluations */
  evaluations: HeuristicEvaluation[];
  /** Transformed CROInsights for compatibility */
  insights: CROInsight[];
  /** Summary statistics */
  summary: VisionAnalysisSummary;
  /** Phase 23: Captured LLM inputs for debugging */
  capturedInputs?: CapturedLLMInputs;
}

/**
 * Raw evaluation from LLM response (before transformation)
 */
export interface RawLLMEvaluation {
  heuristicId: string;
  status: string;
  observation: string;
  issue?: string;
  recommendation?: string;
  confidence: number;
}

/**
 * Expected LLM response structure
 */
export interface LLMVisionResponse {
  evaluations: RawLLMEvaluation[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 21i: Parsed Evaluation with Element References (T374)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Evaluation result with extracted element references (Phase 21i)
 *
 * Extends HeuristicEvaluation with relatedElements array containing
 * indices of DOM elements mentioned in the observation text.
 * These are extracted by parsing [index] patterns from the LLM response.
 */
export interface ParsedEvaluation extends HeuristicEvaluation {
  /**
   * Indices of DOM elements referenced in the observation text.
   * Extracted by parsing [0], [1], [5] etc. patterns from observation/issue/recommendation.
   * Used for mapping evaluations back to specific screenshot regions.
   */
  relatedElements: number[];
}

/**
 * Map heuristic ID prefix to InsightCategory
 */
export const HEURISTIC_TO_CATEGORY: Record<string, InsightCategory> = {
  'PDP-LAYOUT': 'friction',
  'PDP-IMAGE': 'value_prop',
  'PDP-PRICE': 'trust',
  'PDP-DESC': 'value_prop',
  'PDP-SPEC': 'value_prop',
  'PDP-REVIEW': 'trust',
  'PDP-SELECT': 'form',
  'PDP-CTA': 'cta',
  'PDP-MOBILE': 'friction',
  'PDP-UTILITY': 'navigation',
};

/**
 * Get InsightCategory from heuristic ID
 */
export function getInsightCategory(heuristicId: string): InsightCategory {
  // Extract prefix: PDP-LAYOUT-001 -> PDP-LAYOUT
  const prefix = heuristicId.split('-').slice(0, 2).join('-');
  return HEURISTIC_TO_CATEGORY[prefix] ?? 'heuristic';
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 21e: Multi-Viewport Full-Page Vision Types (T321)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Screenshot captured at a specific scroll position
 */
export interface ViewportScreenshot {
  /** Base64 encoded PNG image */
  base64: string;
  /** Y scroll position when captured */
  scrollPosition: number;
  /** Index of this viewport in the sequence (0, 1, 2, ...) */
  viewportIndex: number;
  /** Pixel range covered by this viewport */
  coverage: {
    start: number;
    end: number;
  };
}

/**
 * Configuration for multi-viewport vision analysis
 */
export interface MultiViewportVisionConfig {
  /** Vision model to use (default: gpt-4o-mini for cost optimization) */
  model: 'gpt-4o' | 'gpt-4o-mini';
  /** Whether to analyze viewports in parallel (default: true) */
  parallelAnalysis: boolean;
  /** Similarity threshold for deduplication (0-1, default: 0.8) */
  dedupeThreshold: number;
  /** Maximum number of viewports to analyze (default: 10) */
  maxViewports: number;
  /** Max tokens for each viewport analysis */
  maxTokens: number;
  /** Temperature for LLM responses */
  temperature: number;
}

/**
 * Default configuration for multi-viewport vision
 */
export const DEFAULT_MULTI_VIEWPORT_CONFIG: MultiViewportVisionConfig = {
  model: MODEL_DEFAULTS.analysis,
  parallelAnalysis: true,
  dedupeThreshold: 0.8,
  maxViewports: 10,
  maxTokens: 4096,
  temperature: 0.1,
};

/**
 * Result from analyzing a single viewport
 */
export interface ViewportVisionResult {
  /** Index of the viewport analyzed */
  viewportIndex: number;
  /** Scroll position of this viewport */
  scrollPosition: number;
  /** Evaluations from this viewport */
  evaluations: HeuristicEvaluation[];
  /** Time taken to analyze this viewport in milliseconds */
  analysisTimeMs: number;
}

/**
 * Extended heuristic evaluation with viewport tracking
 */
export interface HeuristicEvaluationWithViewport extends HeuristicEvaluation {
  /** Which viewport this evaluation came from */
  viewportIndex?: number;
  /** Scroll position where this was detected */
  scrollPosition?: number;
}

/**
 * Result of merging multiple viewport results
 */
export interface MergedViewportResult {
  /** Deduplicated evaluations */
  evaluations: HeuristicEvaluationWithViewport[];
  /** Number of evaluations that were deduplicated */
  deduplicatedCount: number;
  /** Total evaluations before deduplication */
  totalBeforeDedup: number;
}

/**
 * Phase 23 (T402): LLM inputs captured for a single viewport
 * Used for debugging and auditing what was sent to the LLM
 */
export interface ViewportLLMInputs {
  /** Index of the viewport in the sequence */
  viewportIndex: number;
  /** Y scroll position when captured */
  scrollPosition: number;
  /** Serialized DOM snapshot sent to LLM */
  domSnapshot: object;
  /** Raw screenshot base64 sent to LLM */
  screenshotBase64: string;
  /** System prompt text */
  systemPrompt: string;
  /** User prompt text */
  userPrompt: string;
  /** Timestamp when captured */
  timestamp: number;
}

/**
 * Complete result from multi-viewport vision analysis
 */
export interface MultiViewportAnalysisResult extends CROVisionAnalysisResult {
  /** Number of viewports analyzed */
  viewportCount: number;
  /** Results from each individual viewport */
  viewportResults: ViewportVisionResult[];
  /** Merged and deduplicated evaluations */
  mergedEvaluations: HeuristicEvaluationWithViewport[];
  /** Count of deduplicated findings */
  deduplicatedCount: number;
  /** Total analysis time across all viewports */
  totalAnalysisTimeMs: number;
  /** Phase 23: Captured LLM inputs for each viewport */
  llmInputs?: ViewportLLMInputs[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 21f: Full-Page Screenshot Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for full-page screenshot analysis
 */
export interface FullPageScreenshotConfig {
  /** Vision model to use */
  model: 'gpt-4o' | 'gpt-4o-mini';
  /** Maximum image height in pixels (GPT-4o limit ~16000px) */
  maxImageHeight: number;
  /** JPEG/PNG quality for resized images (1-100) */
  resizeQuality: number;
  /** Max tokens for response */
  maxTokens: number;
  /** Temperature for response (0.0-1.0) */
  temperature: number;
}

/**
 * Default configuration for full-page screenshot
 */
export const DEFAULT_FULL_PAGE_SCREENSHOT_CONFIG: FullPageScreenshotConfig = {
  model: MODEL_DEFAULTS.analysis,
  maxImageHeight: 16000,
  resizeQuality: 85,
  maxTokens: 4096,
  temperature: 0.1,
};

/**
 * Result from processing a full-page screenshot
 */
export interface FullPageScreenshotResult {
  /** Base64 encoded PNG image */
  base64: string;
  /** Original image dimensions before any resizing */
  originalDimensions: { width: number; height: number };
  /** Final image dimensions after resizing (if any) */
  finalDimensions: { width: number; height: number };
  /** Whether the image was resized */
  wasResized: boolean;
  /** Size of the final image in bytes */
  sizeBytes: number;
}
