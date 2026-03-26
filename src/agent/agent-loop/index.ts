/**
 * Agent Loop Module — Barrel Exports
 *
 * Phase 32: Goal-directed browser automation loop.
 */

// Orchestrator
export { runAgentLoop } from './agent-loop.js';

// Sub-modules
export { perceivePage, computeDomHash, NAVIGATION_PENDING_HASH } from './perceiver.js';
export { collectInteractiveElements } from './element-collector.js';
export { planNextAction, PLANNER_SYSTEM_PROMPT, formatFailedCombos } from './planner.js';
export { verifyGoal, shouldVerify, VERIFIER_SYSTEM_PROMPT } from './verifier.js';
export { detectFailure, routeFailure, READ_ONLY_TOOLS } from './failure-router.js';
export { BudgetController } from './budget-controller.js';
export { ConfidenceDecay } from './confidence-decay.js';
export { extractJSON } from './json-utils.js';

// Phase 33a: Zero-cost reliability
export { preValidateElement } from './element-pre-validator.js';
export { VisitedStateTracker, normalizeUrl } from './visited-state-tracker.js';

// Phase 33b: Sub-goal decomposition
export { decomposeGoal, shouldDecompose, checkSubGoalCompletion, DECOMPOSE_SYSTEM_PROMPT } from './sub-goal-planner.js';

// Phase 33c: Self-critique
export { critiqueAction, shouldCritique, computeStateDiff, CRITIC_SYSTEM_PROMPT } from './self-critic.js';

// Phase 33d: Multi-candidate generation
export { generateCandidates, deduplicateCandidates, plannerOutputToCandidate } from './candidate-generator.js';

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
  SubGoal,
  CritiqueResult,
  ActionCandidate,
  NavigationMeta,
  ContentRegion,
  ElementCollectionConfig,
} from './types.js';

// Constants
export { CRITIQUE_HISTORY_SIZE, ELEMENT_TARGETING_TOOLS } from './types.js';
