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
}

/** Visible interactive element summary */
export interface InteractiveElement {
  index: number;
  tag: string;
  text: string;
  role?: string;
  type?: string;
  selector?: string;
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
  | 'BUDGET_EXCEEDED';

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
