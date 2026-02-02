/**
 * Vision Agent Types - Phase 21g (T335)
 *
 * Types for the iterative Vision Agent that uses an observe-reason-act loop
 * with parallel DOM + Vision context for comprehensive CRO analysis.
 */

import type { Page } from 'playwright';
import type { DOMTree } from '../../models/dom-tree.js';
import type { ViewportInfo } from '../../models/page-state.js';
import type { PageType } from '../../models/index.js';
import type { HeuristicEvaluation, EvaluationStatus, BoundingBox } from '../../heuristics/vision/types.js';
import type { CROInsight } from '../../models/cro-insight.js';
import type { ElementMapping } from '../../browser/dom/coordinate-mapper.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration options for the Vision Agent
 */
export interface VisionAgentOptions {
  /** Vision model to use (default: gpt-4o-mini for cost optimization) */
  model: 'gpt-4o' | 'gpt-4o-mini';
  /** Maximum agent loop iterations (default: 20) */
  maxSteps: number;
  /** Number of heuristics to evaluate per batch (default: 5-8) */
  batchSize: number;
  /** Pixels to scroll per step (default: 500) */
  scrollIncrement: number;
  /** Enable verbose logging (default: false) */
  verbose: boolean;
  /** Max tokens for DOM context in prompts (default: 4000) */
  domTokenBudget: number;
  /** Max tokens for LLM response (default: 4096) */
  maxResponseTokens: number;
  /** Temperature for LLM (default: 0.1) */
  temperature: number;
  /** Max consecutive failures before termination (default: 3) */
  maxConsecutiveFailures: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_VISION_AGENT_OPTIONS: VisionAgentOptions = {
  model: 'gpt-4o-mini',
  maxSteps: 20,
  batchSize: 6,
  scrollIncrement: 500,
  verbose: false,
  domTokenBudget: 4000,
  maxResponseTokens: 4096,
  temperature: 0.1,
  maxConsecutiveFailures: 3,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Viewport Snapshot Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Screenshot captured at a specific scroll position
 */
export interface SnapshotScreenshot {
  /** Base64 encoded PNG image */
  base64: string;
  /** Timestamp when captured */
  capturedAt: number;
}

/**
 * DOM data captured at a specific scroll position
 */
export interface SnapshotDOM {
  /** Full DOM tree structure */
  tree: DOMTree;
  /** Pre-serialized text for LLM context */
  serialized: string;
  /** Number of CRO elements found */
  elementCount: number;
}

/**
 * Combined snapshot at a scroll position (DOM + Screenshot)
 */
export interface ViewportSnapshot {
  /** Y scroll position when captured */
  scrollPosition: number;
  /** Index of this viewport in the sequence (0, 1, 2, ...) */
  viewportIndex: number;
  /** Screenshot data */
  screenshot: SnapshotScreenshot;
  /** DOM data */
  dom: SnapshotDOM;
  /** Heuristic IDs evaluated at this viewport */
  heuristicsEvaluated: string[];

  // Phase 21h: Evidence Capture (T354)
  /** Map of element index to bounding box for elements visible in this viewport */
  elementBoundingBoxes?: Map<number, BoundingBox>;

  // Phase 21i: DOM-Screenshot Coordinate Mapping (T369)
  /** All element mappings with page and screenshot coordinates */
  elementMappings?: ElementMapping[];
  /** Only visible elements in current viewport (for LLM context) */
  visibleElements?: ElementMapping[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Agent State Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Termination reason for the agent loop
 */
export type TerminationReason =
  | 'all_heuristics_evaluated'
  | 'max_steps_reached'
  | 'consecutive_failures'
  | 'explicit_done'
  | 'error';

/**
 * Complete state of the Vision Agent
 */
export interface VisionAgentState {
  /** Current step number (0-indexed) */
  step: number;
  /** All viewport snapshots captured */
  snapshots: ViewportSnapshot[];
  /** Current scroll Y position */
  currentScrollY: number;
  /** Total page height in pixels */
  pageHeight: number;
  /** Viewport height in pixels */
  viewportHeight: number;
  /** Viewport info (width, height, scale, isMobile) */
  viewport: ViewportInfo;
  /** All heuristic IDs to evaluate */
  allHeuristicIds: string[];
  /** Set of heuristic IDs already evaluated */
  evaluatedHeuristicIds: Set<string>;
  /** Array of heuristic IDs still pending */
  pendingHeuristicIds: string[];
  /** All heuristic evaluations recorded */
  evaluations: HeuristicEvaluation[];
  /** Whether agent has signaled completion */
  isDone: boolean;
  /** Reason for termination (set when isDone) */
  terminationReason?: TerminationReason;
  /** Count of consecutive failures */
  consecutiveFailures: number;
  /** Error message if terminated due to error */
  errorMessage?: string;
}

/**
 * Initial state factory input
 */
export interface VisionAgentStateInit {
  /** All heuristic IDs to evaluate */
  heuristicIds: string[];
  /** Page height in pixels */
  pageHeight: number;
  /** Viewport dimensions */
  viewport: ViewportInfo;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context passed to vision agent tools
 */
export interface VisionToolContext {
  /** Playwright page instance */
  page: Page;
  /** Current agent state */
  state: VisionAgentState;
  /** Agent options */
  options: VisionAgentOptions;
  /** Page type being analyzed */
  pageType: PageType;
  /** Heuristic definitions (id -> principle text) */
  heuristicDefinitions: Map<string, HeuristicDefinition>;
}

/**
 * Heuristic definition from knowledge base
 */
export interface HeuristicDefinition {
  /** Heuristic ID (e.g., PDP-CTA-001) */
  id: string;
  /** Principle text to evaluate */
  principle: string;
  /** Severity level (from knowledge base) */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Category */
  category: string;
}

/**
 * Base result type for vision tools
 */
export interface VisionToolResult {
  /** Whether tool execution succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Clean summary message for tool result (avoids including large data in context) */
  message?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool Input/Output Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Input for capture_viewport tool
 */
export interface CaptureViewportInput {
  /** Reason for capturing (for logging) */
  reason: string;
}

/**
 * Output from capture_viewport tool
 */
export interface CaptureViewportOutput extends VisionToolResult {
  /** The captured snapshot */
  snapshot?: ViewportSnapshot;
}

/**
 * Input for scroll_page tool
 */
export interface ScrollPageInput {
  /** Direction to scroll */
  direction: 'up' | 'down' | 'top' | 'bottom';
  /** Amount to scroll in pixels (optional, uses default scrollIncrement) */
  amount?: number;
}

/**
 * Output from scroll_page tool
 */
export interface ScrollPageOutput extends VisionToolResult {
  /** New scroll Y position */
  newScrollY?: number;
  /** Previous scroll Y position */
  previousScrollY?: number;
  /** Whether we've reached the end in this direction */
  reachedBoundary?: boolean;
}

/**
 * Single evaluation in a batch
 */
export interface BatchEvaluation {
  /** Heuristic ID being evaluated */
  heuristicId: string;
  /** Evaluation status */
  status: EvaluationStatus;
  /** What the LLM observed */
  observation: string;
  /** Issue description if failed/partial */
  issue?: string;
  /** Recommendation for fixing */
  recommendation?: string;
  /** Confidence score 0-1 */
  confidence: number;

  // Phase 21h: Evidence Capture (T354)
  /** Indices of DOM elements referenced in observation (e.g., [0, 3, 5]) */
  elementIndices?: number[];
}

/**
 * Input for evaluate_batch tool
 */
export interface EvaluateBatchInput {
  /** Array of evaluations (5-8 recommended) */
  evaluations: BatchEvaluation[];
}

/**
 * Output from evaluate_batch tool
 */
export interface EvaluateBatchOutput extends VisionToolResult {
  /** Number of evaluations recorded */
  evaluatedCount?: number;
  /** Number of heuristics still pending */
  pendingCount?: number;
  /** IDs that were already evaluated (skipped) */
  skippedIds?: string[];
}

/**
 * Input for done tool
 */
export interface DoneInput {
  /** Summary of the analysis */
  summary: string;
  /** Confirmation that coverage is complete */
  coverageConfirmation: boolean;
  /** Any heuristics that couldn't be evaluated (with reasons) */
  unevaluatedHeuristics?: Array<{
    id: string;
    reason: string;
  }>;
}

/**
 * Output from done tool
 */
export interface DoneOutput extends VisionToolResult {
  /** Final coverage percentage */
  coveragePercent?: number;
  /** Total evaluations recorded */
  totalEvaluations?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Agent Result Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Summary statistics for vision agent analysis
 */
export interface VisionAgentSummary {
  /** Total heuristics to evaluate */
  totalHeuristics: number;
  /** Number evaluated */
  evaluated: number;
  /** Number passed */
  passed: number;
  /** Number failed */
  failed: number;
  /** Number partial */
  partial: number;
  /** Number not applicable */
  notApplicable: number;
  /** Coverage percentage (0-100) */
  coveragePercent: number;
  /** Failed counts by severity */
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Complete result from Vision Agent analysis
 */
export interface VisionAgentResult {
  /** Page type analyzed */
  pageType: PageType;
  /** URL analyzed */
  url: string;
  /** Timestamp when analysis started */
  startedAt: number;
  /** Timestamp when analysis completed */
  completedAt: number;
  /** Total analysis duration in milliseconds */
  durationMs: number;
  /** Number of agent steps taken */
  stepCount: number;
  /** Number of viewports captured */
  viewportCount: number;
  /** All viewport snapshots */
  snapshots: ViewportSnapshot[];
  /** All heuristic evaluations */
  evaluations: HeuristicEvaluation[];
  /** Transformed CROInsights for compatibility */
  insights: CROInsight[];
  /** Summary statistics */
  summary: VisionAgentSummary;
  /** How the agent terminated */
  terminationReason: TerminationReason;
  /** Model used for analysis */
  model: 'gpt-4o' | 'gpt-4o-mini';
  /** Error message if terminated with error */
  errorMessage?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Message Types (for LLM communication)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Image content for vision API
 */
export interface ImageContent {
  type: 'image_url';
  image_url: {
    url: string;  // data:image/png;base64,... format
    detail?: 'low' | 'high' | 'auto';
  };
}

/**
 * Text content for messages
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Message content can be text or image
 */
export type MessageContent = TextContent | ImageContent;

/**
 * Vision agent message
 */
export interface VisionAgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContent[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tool Definition Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tool definition for the vision agent
 */
export interface VisionToolDefinition {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** JSON Schema for parameters */
  parameters: Record<string, unknown>;
  /** Execute the tool */
  execute: (input: unknown, context: VisionToolContext) => Promise<VisionToolResult>;
}

/**
 * Tool call from LLM
 */
export interface VisionToolCall {
  /** Tool name */
  name: string;
  /** Tool arguments (parsed JSON) */
  arguments: Record<string, unknown>;
}

/**
 * LLM response with tool calls
 */
export interface VisionLLMResponse {
  /** Tool calls requested by LLM */
  toolCalls: VisionToolCall[];
  /** Optional reasoning text */
  reasoning?: string;
}
