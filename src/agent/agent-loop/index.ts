/**
 * Agent Loop Module — Barrel Exports
 *
 * Phase 32: Goal-directed browser automation loop.
 */

// Orchestrator
export { runAgentLoop } from './agent-loop.js';

// Sub-modules
export { perceivePage, computeDomHash } from './perceiver.js';
export { planNextAction, PLANNER_SYSTEM_PROMPT } from './planner.js';
export { verifyGoal, shouldVerify, VERIFIER_SYSTEM_PROMPT } from './verifier.js';
export { detectFailure, routeFailure, READ_ONLY_TOOLS } from './failure-router.js';
export { BudgetController } from './budget-controller.js';
export { ConfidenceDecay } from './confidence-decay.js';
export { extractJSON } from './json-utils.js';

// Types
export type {
  AgentLoopConfig,
  AgentLoopResult,
  AgentLoopDeps,
  ActionRecord,
  PerceivedState,
  InteractiveElement,
  PlannerOutput,
  VerificationResult,
  FailureType,
  DetectedFailure,
  ResolutionStrategy,
  RoutedFailure,
  BudgetStatus,
} from './types.js';
