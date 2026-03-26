/**
 * Agent Loop Types
 *
 * Phase 32 (T710): All interfaces for the goal-directed agent loop.
 */

import type { Page } from 'playwright';
import type { ChatOpenAI } from '@langchain/openai';
import type { ToolExecutor } from '../tools/tool-executor.js';

// ---------------------------------------------------------------------------
// Config & Result
// ---------------------------------------------------------------------------

/** Input configuration for the agent loop */
export interface AgentLoopConfig {
  goal: string;
  startUrl?: string;
  maxSteps?: number;
  maxTimeMs?: number;
  decayFactor?: number;
  escalationThreshold?: number;
  verifyEveryNSteps?: number;
  verbose?: boolean;
  /** Enable sub-goal decomposition (default: true) */
  enableSubGoals?: boolean;
  /** Enable critique of each action after execution (default: false) */
  enableCritique?: boolean;
  /** Enable multi-candidate planning (default: false) */
  enableMultiCandidate?: boolean;
  /** Number of candidate actions to generate when multi-candidate is on (default: 3) */
  candidateCount?: number;
}

/** Output from the agent loop */
export interface AgentLoopResult {
  status:
    | 'SUCCESS'
    | 'BUDGET_EXCEEDED'
    | 'CONFIDENCE_LOW'
    | 'UNRECOVERABLE_FAILURE'
    | 'RUNNER_ERROR';
  goalSatisfied: boolean;
  stepsUsed: number;
  totalTimeMs: number;
  actionHistory: ActionRecord[];
  terminationReason: string;
  errors: string[];
  finalUrl: string;
  finalTitle: string;
}

// ---------------------------------------------------------------------------
// Action History
// ---------------------------------------------------------------------------

/** Per-step action record for post-mortem analysis */
export interface ActionRecord {
  step: number;
  toolName: string;
  toolParams: Record<string, unknown>;
  reasoning: string;
  expectedOutcome: string;
  success: boolean;
  error?: string;
  domHashBefore: string;
  domHashAfter: string;
  durationMs: number;
  timestamp: string;
  /** Score of the selected candidate (if multi-candidate was enabled) */
  candidateScore?: number;
  /** Rank of the selected candidate (if multi-candidate was enabled) */
  candidateRank?: number;
  /** Critique result for this action (if critique was enabled) */
  critiqueResult?: CritiqueResult;
}

// ---------------------------------------------------------------------------
// Perception
// ---------------------------------------------------------------------------

/** Lightweight page state for the planner */
export interface PerceivedState {
  url: string;
  title: string;
  domHash: string;
  axTreeText: string | null;
  interactiveElements: InteractiveElement[];
  hasBlocker: boolean;
  blockerType?: string;
  screenshotBase64?: string;
  /** Phase 35F: Visible text from main content area (≤2000 chars) */
  pageText?: string;
  /** Phase 35A: Content region statistics */
  contentRegion?: ContentRegion;
}

/** Visible interactive element summary */
export interface InteractiveElement {
  index: number;
  tag: string;
  text: string;
  role?: string;
  type?: string;
  selector?: string;
  /** Phase 35A: Which page region this element belongs to */
  region?: 'header' | 'main' | 'footer' | 'unknown';
  /** Phase 35A: Relevance score (higher = more relevant to goal) */
  score?: number;
  /** Phase 35C: Full accessible name from aria-label or innerText */
  accessibleName?: string;
  /** Placeholder text for input/textarea elements */
  placeholder?: string;
  /** Group label for related elements (e.g. "search-bar", "login-form") */
  group?: string;
}

/** Phase 35A: Summary of interactive elements by page region */
export interface ContentRegion {
  hasMainLandmark: boolean;
  mainContentLinks: number;
  mainContentButtons: number;
  headerElements: number;
  totalInteractive: number;
}

/** Phase 35A: Configuration for element collection */
export interface ElementCollectionConfig {
  /** Max total elements to collect (default: 50) */
  maxElements?: number;
  /** Max header/nav elements to include (default: 10) */
  maxHeaderElements?: number;
  /** Max chars for element text (default: 80) */
  textMaxLength?: number;
}

// ---------------------------------------------------------------------------
// Planner
// ---------------------------------------------------------------------------

/** Output from the LLM planner */
export interface PlannerOutput {
  reasoning: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  expectedOutcome: string;
}

// ---------------------------------------------------------------------------
// Verifier
// ---------------------------------------------------------------------------

/** Output from the LLM goal verifier */
export interface VerificationResult {
  goalSatisfied: boolean;
  confidence: number;
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Failure Detection & Routing
// ---------------------------------------------------------------------------

/** Types of failures the loop can detect */
export type FailureType =
  | 'ELEMENT_NOT_FOUND'
  | 'ACTION_HAD_NO_EFFECT'
  | 'BUDGET_EXCEEDED'
  | 'WRONG_PAGE'
  | 'FORM_ERROR'
  | 'REDIRECT_LOOP'
  | 'PAGE_CRASHED';

/** A detected failure with retry context */
export interface DetectedFailure {
  type: FailureType;
  details: string;
  retryCount: number;
}

/** Strategy to resolve a failure */
export type ResolutionStrategy =
  | 'REPLAN'
  | 'REPLAN_WITH_DIAGNOSTIC'
  | 'TERMINATE';

/** A failure paired with its resolution strategy */
export interface RoutedFailure {
  failure: DetectedFailure;
  strategy: ResolutionStrategy;
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

/** Current budget status snapshot */
export interface BudgetStatus {
  exceeded: boolean;
  budgetKind?: 'steps' | 'time' | 'tokens';
  stepsUsed: number;
  stepsRemaining: number;
  timeElapsedMs: number;
  timeRemainingMs: number;
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

/** External dependencies injected into the agent loop */
export interface AgentLoopDeps {
  llm: ChatOpenAI;
  page: Page;
  toolExecutor: ToolExecutor;
}

// ---------------------------------------------------------------------------
// Phase 33: Reliability Enhancements
// ---------------------------------------------------------------------------

/** A decomposed sub-goal for incremental progress tracking */
export interface SubGoal {
  description: string;
  successCriteria: string;
  estimatedSteps: number;
}

/** LLM critique of a completed action */
export interface CritiqueResult {
  actionWasUseful: boolean;
  /** Progress score from 0 (no progress) to 1 (full progress) */
  progressScore: number;
  reasoning: string;
  suggestion?: string;
}

/** A candidate action from multi-candidate planning, extending PlannerOutput */
export interface ActionCandidate extends PlannerOutput {
  /** Self-assessed score from 0 (poor) to 1 (ideal) */
  selfScore: number;
  /** Description of the risk associated with this candidate */
  risk: string;
}

// ---------------------------------------------------------------------------
// Phase 33: Constants
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Phase 34: Navigation Detection
// ---------------------------------------------------------------------------

/** Metadata about navigation that occurred during tool execution */
export interface NavigationMeta {
  navigated: boolean;
  previousUrl: string;
  currentUrl: string;
}

/** Number of recent critique results to retain in context */
export const CRITIQUE_HISTORY_SIZE = 3;

/** Tool names that target specific DOM elements by index */
export const ELEMENT_TARGETING_TOOLS = ['click', 'type_text', 'select_option', 'hover', 'drag_and_drop'] as const;
