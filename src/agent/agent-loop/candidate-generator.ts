/**
 * Candidate Generator — Phase 33d
 *
 * Generates 2-3 diverse candidate actions per step with self-assessed
 * scores and risk assessment. Replaces single-action planning when enabled.
 */

import type { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { extractJSON } from './json-utils.js';
import { planNextAction } from './planner.js';
import type {
  ActionCandidate,
  PlannerOutput,
  PerceivedState,
  ActionRecord,
  RoutedFailure,
  BudgetStatus,
  CritiqueResult,
  SubGoal,
} from './types.js';

/** Convert a PlannerOutput to an ActionCandidate with neutral score */
export function plannerOutputToCandidate(plan: PlannerOutput): ActionCandidate {
  return { ...plan, selfScore: 0.5, risk: 'fallback — single plan mode' };
}

/** Remove duplicate candidates (same toolName + same elementIndex) */
export function deduplicateCandidates(
  candidates: ActionCandidate[]
): ActionCandidate[] {
  const seen = new Map<string, ActionCandidate>();
  for (const c of candidates) {
    const elementIndex = (c.toolParams as Record<string, unknown>).elementIndex ??
                         (c.toolParams as Record<string, unknown>).index;
    const key = `${c.toolName}:${elementIndex ?? 'none'}`;
    const existing = seen.get(key);
    if (!existing || c.selfScore > existing.selfScore) {
      seen.set(key, c);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.selfScore - a.selfScore);
}

const CANDIDATE_SYSTEM_PROMPT = `You are a browser automation agent. Propose 2-3 DIFFERENT candidate actions to advance toward the goal.

RULES:
- Each candidate MUST use a DIFFERENT approach or target a DIFFERENT element
- Rate your confidence 0.0-1.0 for each candidate
- Identify what could go wrong (risk) for each
- If the page has a blocker (cookie banner, modal), one candidate should dismiss it
- Never propose the exact same action that just failed

Available tools: type_text, press_key, select_option, extract_text, hover, go_back, wait_for, dismiss_blocker, switch_tab, upload_file, execute_js, drag_and_drop, get_ax_tree, click, scroll_page, go_to_url

Respond with JSON ONLY:
{
  "candidates": [
    {
      "reasoning": "why this action",
      "toolName": "tool_name",
      "toolParams": { ... },
      "expectedOutcome": "what should change",
      "selfScore": 0.9,
      "risk": "what could go wrong"
    },
    ...
  ]
}`;

/**
 * Generate 2-3 diverse candidate actions with self-assessed scores.
 * Falls back to planNextAction on failure.
 */
export async function generateCandidates(
  llm: ChatOpenAI,
  goal: string,
  currentSubGoal: SubGoal | null,
  state: PerceivedState,
  recentActions: ActionRecord[],
  failureContext: RoutedFailure | null,
  budgetStatus: BudgetStatus,
  confidence: number,
  critiqueHistory: CritiqueResult[],
  visitedUrls: string
): Promise<ActionCandidate[]> {
  const elementsText = state.interactiveElements
    .map(
      (e) =>
        `[${e.index}] <${e.tag}> "${e.text}"${e.role ? ` role=${e.role}` : ''}${e.type ? ` type=${e.type}` : ''}`
    )
    .join('\n  ');

  const actionsText = recentActions.length > 0
    ? recentActions
        .map(
          (a) =>
            `Step ${a.step}: ${a.toolName}(${JSON.stringify(a.toolParams)}) → ${a.success ? '✓' : '✗'} ${a.error || 'success'}`
        )
        .join('\n  ')
    : 'none';

  const failureText = failureContext
    ? `${failureContext.failure.type}: ${failureContext.failure.details}`
    : 'none';

  const subGoalText = currentSubGoal
    ? `\nCURRENT SUB-GOAL: ${currentSubGoal.description} (criteria: ${currentSubGoal.successCriteria})`
    : '';

  const critiqueText = critiqueHistory.length > 0
    ? critiqueHistory
        .map((c) => `score=${c.progressScore.toFixed(1)}: ${c.reasoning.slice(0, 60)}`)
        .join('\n  ')
    : 'none';

  const userMessage = `GOAL: ${goal}${subGoalText}

CURRENT PAGE:
  URL: ${state.url}
  Title: ${state.title}

ACCESSIBILITY TREE:
${state.axTreeText || '(not available)'}

INTERACTIVE ELEMENTS (top 20):
  ${elementsText || '(none found)'}

RECENT ACTIONS (last 5):
  ${actionsText}

FAILURE CONTEXT: ${failureText}
VISITED PAGES: ${visitedUrls}
RECENT CRITIQUES:
  ${critiqueText}
BUDGET: Step ${budgetStatus.stepsUsed}/${budgetStatus.stepsUsed + budgetStatus.stepsRemaining} | Confidence: ${confidence.toFixed(2)}

Propose 2-3 different candidate actions:`;

  try {
    const response = await llm.invoke([
      new SystemMessage(CANDIDATE_SYSTEM_PROMPT),
      new HumanMessage(userMessage),
    ]);

    const content = typeof response.content === 'string' ? response.content : '';
    const parsed = extractJSON(content);

    if (parsed && Array.isArray(parsed.candidates) && parsed.candidates.length > 0) {
      const candidates: ActionCandidate[] = [];
      for (const c of parsed.candidates) {
        const item = c as Record<string, unknown>;
        if (typeof item.toolName === 'string' && typeof item.toolParams === 'object') {
          candidates.push({
            reasoning: String(item.reasoning || ''),
            toolName: item.toolName,
            toolParams: (item.toolParams || {}) as Record<string, unknown>,
            expectedOutcome: String(item.expectedOutcome || ''),
            selfScore: typeof item.selfScore === 'number'
              ? Math.max(0, Math.min(1, item.selfScore))
              : 0.5,
            risk: String(item.risk || 'unknown'),
          });
        }
      }
      if (candidates.length > 0) {
        return deduplicateCandidates(candidates);
      }
    }
  } catch {
    // LLM error — fall through to fallback
  }

  // Fallback to single-plan mode
  try {
    const plan = await planNextAction(
      llm, goal, state, recentActions, failureContext, budgetStatus, confidence
    );
    return [plannerOutputToCandidate(plan)];
  } catch {
    return [plannerOutputToCandidate({
      reasoning: 'All planning failed, gathering info',
      toolName: 'extract_text',
      toolParams: {},
      expectedOutcome: 'Get page text',
    })];
  }
}
