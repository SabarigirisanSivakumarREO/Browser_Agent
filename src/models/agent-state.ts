/**
 * Agent State Models
 *
 * Defines interfaces for CRO agent configuration and runtime state.
 * Phase 19c: Added scanMode for coverage tracking.
 * CR-001-B: Added agentPhase and viewportSnapshots for unified vision integration.
 */

import type { CROInsight } from './cro-insight.js';
import { type CROMemory, createInitialMemory } from './cro-memory.js';
import type { ScanMode } from './coverage.js';
import type { HeuristicEvaluation } from '../heuristics/vision/types.js';
import type { ElementMapping } from '../browser/dom/coordinate-mapper.js';

/**
 * Agent phase for unified collection→analysis→output flow
 * CR-001-B: New type for phase tracking
 */
export type AgentPhase = 'collection' | 'analysis' | 'output';

/**
 * Screenshot captured at a specific scroll position
 * CR-001-B: Moved from vision agent types
 */
export interface SnapshotScreenshot {
  /** Base64 encoded PNG/JPEG image */
  base64: string;
  /** Timestamp when captured */
  capturedAt: number;
}

/**
 * DOM data captured at a specific scroll position
 * CR-001-B: Moved from vision agent types
 */
export interface SnapshotDOM {
  /** Pre-serialized text for LLM context */
  serialized: string;
  /** Number of CRO elements found */
  elementCount: number;
}

/**
 * Combined snapshot at a scroll position (DOM + Screenshot)
 * CR-001-B: Unified viewport snapshot for collection phase
 * Phase 21i: Added elementMappings and visibleElements for coordinate mapping
 * Phase 25-fix: Added fullResolutionBase64 for evidence screenshots
 */
export interface ViewportSnapshot {
  /** Y scroll position when captured */
  scrollPosition: number;
  /** Index of this viewport in the sequence (0, 1, 2, ...) */
  viewportIndex: number;
  /** Screenshot data (compressed for LLM) */
  screenshot: SnapshotScreenshot;
  /** DOM data */
  dom: SnapshotDOM;

  // Phase 21i: DOM-Screenshot Coordinate Mapping (T369)
  /** All element mappings with page and screenshot coordinates */
  elementMappings?: ElementMapping[];
  /** Only visible elements in current viewport (for LLM context) */
  visibleElements?: ElementMapping[];

  // Phase 25-fix: Full resolution screenshot for evidence
  /** Full resolution PNG screenshot (base64) for evidence files */
  fullResolutionBase64?: string;
}

/**
 * Agent configuration options
 * Maps to config requirements CR-010 through CR-015
 * Phase 19e: Added scanMode for coverage configuration
 */
export interface CROAgentOptions {
  maxSteps: number;              // CR-010: 10 default
  actionWaitMs: number;          // CR-011: 500ms default
  llmTimeoutMs: number;          // CR-012: 60000ms default
  failureLimit: number;          // CR-014: 3 default
  tokenBudgetWarning: number;    // CR-013: 0.6 default
  textTruncateLength: number;    // CR-015: 100 default
  scanMode: ScanMode;            // Phase 19e: Scan mode for coverage (default: full_page)
}

/**
 * Default agent options per config requirements
 * Phase 19e: Added scanMode: 'full_page' as default
 */
export const DEFAULT_CRO_OPTIONS: CROAgentOptions = {
  maxSteps: 10,
  actionWaitMs: 500,
  llmTimeoutMs: 60000,
  failureLimit: 3,
  tokenBudgetWarning: 0.6,
  textTruncateLength: 100,
  scanMode: 'full_page',
};

/**
 * Agent runtime state
 * Phase 19c: Added scanMode for coverage tracking
 * CR-001-B: Added agentPhase, viewportSnapshots, heuristicEvaluations
 */
export interface AgentState {
  step: number;
  consecutiveFailures: number;
  totalFailures: number;
  insights: CROInsight[];
  memory: CROMemory;
  isDone: boolean;
  doneReason?: string;           // Why agent stopped
  startTime: number;
  lastActionTime?: number;
  scanMode: ScanMode;            // Phase 19: Scan mode for coverage
  // CR-001-B: Unified vision integration
  agentPhase: AgentPhase;        // Current phase: collection, analysis, output
  viewportSnapshots: ViewportSnapshot[];  // Collected viewport snapshots
  heuristicEvaluations: HeuristicEvaluation[];  // Heuristic analysis results
  currentScrollY: number;        // Current scroll position
  pageHeight: number;            // Total page height
}

/**
 * Factory function to create initial agent state
 * @param scanMode - Scan mode for coverage tracking (default: 'full_page')
 * @param agentPhase - Initial phase (default: 'collection' for vision, 'analysis' otherwise)
 */
export function createInitialState(
  scanMode: ScanMode = 'full_page',
  agentPhase: AgentPhase = 'collection'
): AgentState {
  return {
    step: 0,
    consecutiveFailures: 0,
    totalFailures: 0,
    insights: [],
    memory: createInitialMemory(),
    isDone: false,
    startTime: Date.now(),
    scanMode,
    // CR-001-B: Vision integration fields
    agentPhase,
    viewportSnapshots: [],
    heuristicEvaluations: [],
    currentScrollY: 0,
    pageHeight: 0,
  };
}
