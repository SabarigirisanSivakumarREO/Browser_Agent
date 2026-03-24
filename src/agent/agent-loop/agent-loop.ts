/**
 * Agent Loop Orchestrator
 *
 * Phase 32 (T728): Main perceive→plan→act→verify loop for
 * goal-directed browser automation.
 */

import type { Page } from 'playwright';
import type { CROActionName } from '../../models/index.js';
import type { PageState } from '../../models/page-state.js';
import type { ExecutionContext } from '../tools/types.js';
import { createLogger } from '../../utils/logger.js';
import { perceivePage } from './perceiver.js';
import { planNextAction, formatFailedCombos } from './planner.js';
import { decomposeGoal, shouldDecompose, checkSubGoalCompletion } from './sub-goal-planner.js';
import { verifyGoal, shouldVerify } from './verifier.js';
import { detectFailure, routeFailure } from './failure-router.js';
import { BudgetController } from './budget-controller.js';
import { ConfidenceDecay } from './confidence-decay.js';
import { preValidateElement } from './element-pre-validator.js';
import { VisitedStateTracker } from './visited-state-tracker.js';
import { critiqueAction, shouldCritique } from './self-critic.js';
import type {
  AgentLoopConfig,
  AgentLoopResult,
  AgentLoopDeps,
  ActionRecord,
  PerceivedState,
  RoutedFailure,
  SubGoal,
  CritiqueResult,
} from './types.js';
import { CRITIQUE_HISTORY_SIZE } from './types.js';

const SETTLE_MS = 500;

/**
 * Build a minimal PageState stub from PerceivedState for the ToolExecutor.
 * The tool executor expects a PageState with domTree, viewport, etc.
 * Agent-loop tools mostly need the page object, not the full state.
 */
function buildMinimalPageState(state: PerceivedState): PageState {
  // Convert interactive elements to DOMNode children so findElementByIndex works
  const children = state.interactiveElements.map((el) => ({
    tagName: el.tag,
    xpath: el.selector || `//body/${el.tag}[${el.index + 1}]`,
    index: el.index,
    text: el.text,
    isInteractive: true,
    isVisible: true,
    croType: null as never,
    attributes: {
      ...(el.role ? { role: el.role } : {}),
      ...(el.type ? { type: el.type } : {}),
    },
    children: [],
  }));

  return {
    url: state.url,
    title: state.title,
    domTree: {
      root: {
        tagName: 'html', xpath: '/html', text: '', isInteractive: false,
        isVisible: true, croType: null as never, children,
      },
      interactiveCount: children.length,
      croElementCount: 0,
      totalNodeCount: children.length + 1,
      extractedAt: Date.now(),
    },
    viewport: { width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false },
    scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 0 },
    timestamp: Date.now(),
  };
}

/**
 * Build an ExecutionContext for the ToolExecutor.
 */
function buildContext(
  page: Page,
  state: PerceivedState,
  verbose: boolean
): ExecutionContext {
  return {
    page,
    state: buildMinimalPageState(state),
    verbose,
  };
}

/**
 * Create a terminal AgentLoopResult.
 */
function terminate(
  status: AgentLoopResult['status'],
  reason: string,
  actionHistory: ActionRecord[],
  budget: BudgetController,
  startTime: number,
  finalState: PerceivedState,
  errors: string[]
): AgentLoopResult {
  return {
    status,
    goalSatisfied: status === 'SUCCESS',
    stepsUsed: budget.stepsUsed,
    totalTimeMs: Date.now() - startTime,
    actionHistory,
    terminationReason: reason,
    errors,
    finalUrl: finalState.url,
    finalTitle: finalState.title,
  };
}

/**
 * Run the goal-directed agent loop.
 *
 * @param config - Loop configuration (goal, budgets, thresholds)
 * @param deps - External dependencies (LLM, page, tool executor)
 * @returns Structured result with status, history, and timing
 */
export async function runAgentLoop(
  config: AgentLoopConfig,
  deps: AgentLoopDeps
): Promise<AgentLoopResult> {
  const logger = createLogger('AgentLoop', config.verbose ?? false);
  const maxSteps = config.maxSteps ?? 20;
  const baseMaxTimeMs = config.maxTimeMs ?? 120000;
  const maxTimeMs = (config.enableCritique) ? Math.round(baseMaxTimeMs * 1.5) : baseMaxTimeMs;
  const verifyEveryN = config.verifyEveryNSteps ?? 3;
  const verbose = config.verbose ?? false;

  const budget = new BudgetController(maxSteps, maxTimeMs);
  const confidence = new ConfidenceDecay(
    config.decayFactor,
    config.escalationThreshold
  );
  const actionHistory: ActionRecord[] = [];
  const errors: string[] = [];
  let failureContext: RoutedFailure | null = null;
  let consecutiveFailures = 0;
  const startTime = Date.now();
  const critiqueHistory: CritiqueResult[] = [];
  const visitedTracker = new VisitedStateTracker();

  // Navigate to start URL if provided
  if (config.startUrl) {
    try {
      const ctx = buildContext(deps.page, {
        url: 'about:blank', title: '', domHash: '', axTreeText: null,
        interactiveElements: [], hasBlocker: false,
      }, verbose);
      await deps.toolExecutor.execute(
        'go_to_url' as CROActionName,
        { url: config.startUrl },
        ctx
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to navigate to start URL: ${msg}`);
    }
  }

  let latestState: PerceivedState = {
    url: deps.page.url(),
    title: '',
    domHash: '',
    axTreeText: null,
    interactiveElements: [],
    hasBlocker: false,
  };

  // Sub-goal decomposition (Phase 33b)
  const enableSubGoals = config.enableSubGoals !== false; // default: true
  let subGoals: SubGoal[] = [];
  let currentSubGoalIndex = 0;
  let stepsOnCurrentSubGoal = 0;

  if (enableSubGoals && shouldDecompose(config.goal)) {
    try {
      subGoals = await decomposeGoal(deps.llm, config.goal, config.startUrl ?? deps.page.url());
      if (verbose) {
        logger.info('Goal decomposed into sub-goals', {
          count: subGoals.length,
          subGoals: subGoals.map((sg, i) => `${i + 1}. ${sg.description}`),
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Sub-goal decomposition failed: ${msg}`);
    }
  }

  try {
    while (true) {
      // 1. BUDGET CHECK
      if (budget.isExceeded()) {
        return terminate(
          'BUDGET_EXCEEDED', 'Step or time budget exceeded',
          actionHistory, budget, startTime, latestState, errors
        );
      }

      // 2. CONFIDENCE CHECK
      if (confidence.shouldEscalate()) {
        return terminate(
          'CONFIDENCE_LOW', `Confidence ${confidence.current.toFixed(2)} below threshold`,
          actionHistory, budget, startTime, latestState, errors
        );
      }

      // 3. PERCEIVE
      const preState = await perceivePage(deps.page);
      latestState = preState;
      visitedTracker.recordVisit(preState.url);

      // 4. HANDLE BLOCKERS
      if (preState.hasBlocker) {
        logger.info('Blocker detected, dismissing', { type: preState.blockerType });
        const ctx = buildContext(deps.page, preState, verbose);
        await deps.toolExecutor.execute(
          'dismiss_blocker' as CROActionName,
          { strategy: 'auto' },
          ctx
        );
        budget.recordStep();
        confidence.decay();
        continue; // re-perceive after dismissal
      }

      // 5. PLAN
      const currentSubGoal = subGoals.length > 0 && currentSubGoalIndex < subGoals.length
        ? subGoals[currentSubGoalIndex]
        : null;
      const subGoalContext = currentSubGoal
        ? `${currentSubGoal.description} (sub-goal ${currentSubGoalIndex + 1} of ${subGoals.length})`
        : undefined;

      const plan = await planNextAction(
        deps.llm,
        config.goal,
        preState,
        actionHistory.slice(-5),
        failureContext,
        budget.getStatus(),
        confidence.current,
        visitedTracker.formatForPrompt(),
        formatFailedCombos(actionHistory),
        subGoalContext,
        critiqueHistory.slice(-CRITIQUE_HISTORY_SIZE)
      );

      logger.info(`Step ${budget.stepsUsed + 1}: ${plan.toolName}`, {
        params: plan.toolParams,
        reasoning: plan.reasoning,
      });
      logger.debug('Page state for action', {
        interactiveElements: preState.interactiveElements.length,
        domTreeChildren: buildMinimalPageState(preState).domTree.root.children.length,
      });

      // 5.5. PRE-VALIDATE ELEMENT
      const validation = await preValidateElement(
        deps.page, plan.toolName, plan.toolParams, preState
      );
      if (!validation.valid) {
        // Skip execution — record as failed action
        const record: ActionRecord = {
          step: budget.stepsUsed + 1,
          toolName: plan.toolName,
          toolParams: plan.toolParams,
          reasoning: plan.reasoning,
          expectedOutcome: plan.expectedOutcome,
          success: false,
          error: validation.error,
          domHashBefore: preState.domHash,
          domHashAfter: preState.domHash,
          durationMs: 0,
          timestamp: new Date().toISOString(),
        };
        actionHistory.push(record);
        consecutiveFailures++;
        const routed = routeFailure({
          type: 'ELEMENT_NOT_FOUND',
          details: validation.error || 'Pre-validation failed',
          retryCount: consecutiveFailures,
        });
        if (routed.strategy === 'TERMINATE') {
          return terminate(
            'UNRECOVERABLE_FAILURE', `${routed.failure.type}: ${routed.failure.details}`,
            actionHistory, budget, startTime, preState, errors
          );
        }
        failureContext = routed;
        budget.recordStep();
        confidence.decay();
        continue; // skip to next iteration
      }

      // 6. ACT
      const ctx = buildContext(deps.page, preState, verbose);
      const actionStart = Date.now();
      const result = await deps.toolExecutor.execute(
        plan.toolName as CROActionName,
        plan.toolParams,
        ctx
      );
      const durationMs = Date.now() - actionStart;

      // 7. RE-PERCEIVE
      const postState = await perceivePage(deps.page);
      latestState = postState;

      // 8. RECORD
      const record: ActionRecord = {
        step: budget.stepsUsed + 1,
        toolName: plan.toolName,
        toolParams: plan.toolParams,
        reasoning: plan.reasoning,
        expectedOutcome: plan.expectedOutcome,
        success: result.success,
        error: result.error,
        domHashBefore: preState.domHash,
        domHashAfter: postState.domHash,
        durationMs,
        timestamp: new Date().toISOString(),
      };
      actionHistory.push(record);

      // Check sub-goal completion (Phase 33b)
      if (currentSubGoal && checkSubGoalCompletion(currentSubGoal, postState)) {
        currentSubGoalIndex++;
        stepsOnCurrentSubGoal = 0;
        if (verbose) {
          logger.info(`Sub-goal ${currentSubGoalIndex} completed: ${currentSubGoal.description}`);
        }
      } else {
        stepsOnCurrentSubGoal++;
        // Skip stuck sub-goal after 5 steps
        if (currentSubGoal && stepsOnCurrentSubGoal >= 5) {
          logger.info(`Skipping stuck sub-goal: ${currentSubGoal.description}`, {
            stepsSpent: stepsOnCurrentSubGoal,
          });
          currentSubGoalIndex++;
          stepsOnCurrentSubGoal = 0;
        }
      }

      // 9. DETECT FAILURES
      const failure = detectFailure(
        plan.toolName,
        result,
        preState.domHash,
        postState.domHash,
        { url: preState.url, axTreeText: preState.axTreeText },
        { url: postState.url, axTreeText: postState.axTreeText },
        actionHistory
      );

      if (failure) {
        consecutiveFailures++;
        const routed = routeFailure({
          ...failure,
          retryCount: consecutiveFailures,
        });
        if (routed.strategy === 'TERMINATE') {
          return terminate(
            'UNRECOVERABLE_FAILURE', `${failure.type}: ${failure.details}`,
            actionHistory, budget, startTime, postState, errors
          );
        }
        failureContext = routed;
      } else {
        consecutiveFailures = 0;
        failureContext = null;
      }

      budget.recordStep();

      // 10. SELF-CRITIQUE (Phase 33c)
      const routerFired = failure !== null;
      const verifierWillRun = shouldVerify(budget.stepsUsed, verifyEveryN, preState, postState);

      if (shouldCritique(config.enableCritique ?? false, routerFired, verifierWillRun)) {
        const currentSubGoalForCritique = subGoals.length > 0 && currentSubGoalIndex < subGoals.length
          ? subGoals[currentSubGoalIndex]!
          : null;
        const critique = await critiqueAction(
          deps.llm,
          config.goal,
          currentSubGoalForCritique,
          record,
          preState,
          postState,
          critiqueHistory.slice(-CRITIQUE_HISTORY_SIZE)
        );
        critiqueHistory.push(critique);
        if (critiqueHistory.length > CRITIQUE_HISTORY_SIZE) {
          critiqueHistory.shift();
        }
        record.critiqueResult = critique;
        confidence.adjustFromCritique(critique.progressScore);

        if (verbose) {
          logger.info(`Critique: score=${critique.progressScore.toFixed(2)}, useful=${critique.actionWasUseful}`, {
            reasoning: critique.reasoning,
          });
        }
      } else {
        confidence.decay();
      }

      // 11. VERIFY GOAL
      if (shouldVerify(budget.stepsUsed, verifyEveryN, preState, postState)) {
        const verification = await verifyGoal(
          deps.llm,
          config.goal,
          postState,
          actionHistory
        );
        logger.info('Goal verification', {
          goalSatisfied: verification.goalSatisfied,
          confidence: verification.confidence,
          reasoning: verification.reasoning,
        });

        if (verification.goalSatisfied && verification.confidence > 0.7) {
          return terminate(
            'SUCCESS', `Goal satisfied (confidence: ${verification.confidence.toFixed(2)})`,
            actionHistory, budget, startTime, postState, errors
          );
        }
      }

      // 12. SETTLE + VERBOSE OUTPUT
      if (verbose) {
        const symbol = result.success ? '✓' : '✗';
        logger.info(
          `[Step ${record.step}] ${plan.toolName}(${JSON.stringify(plan.toolParams)}) → ${symbol} (${durationMs}ms) confidence: ${confidence.current.toFixed(2)}`
        );
      }

      // 13. SETTLE
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    return terminate(
      'RUNNER_ERROR', `Unexpected error: ${msg}`,
      actionHistory, budget, startTime, latestState, errors
    );
  }
}
