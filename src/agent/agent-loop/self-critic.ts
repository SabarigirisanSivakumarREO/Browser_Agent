/**
 * Self-Critic — Phase 33c
 *
 * Post-execution LLM evaluation of action usefulness.
 * DOM-diff-aware: evaluates concrete state changes, not just URL/title.
 */

import type { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { extractJSON } from './json-utils.js';
import type {
  CritiqueResult,
  SubGoal,
  ActionRecord,
  PerceivedState,
} from './types.js';

export const CRITIC_SYSTEM_PROMPT = `You are evaluating whether a browser action was useful toward the goal.

Check OBSERVABLE state changes only. Score progress 0.0-1.0:
- 1.0: Action clearly advanced toward the goal (navigated to right page, filled correct field)
- 0.5: Uncertain — action ran but unclear if it helped
- 0.0: Action was useless or counterproductive (wrong page, no change, repeated failure)

If not useful, suggest what to try instead.

Respond with JSON ONLY:
{
  "actionWasUseful": true/false,
  "progressScore": 0.0-1.0,
  "reasoning": "what you observed",
  "suggestion": "what to try next (only if not useful)"
}`;

/**
 * Compute a human-readable diff between pre and post page states.
 * Helps the critic evaluate form fills and DOM changes that don't affect URL/title.
 */
export function computeStateDiff(
  preState: PerceivedState,
  postState: PerceivedState
): string {
  const lines: string[] = [];

  // URL change
  if (preState.url !== postState.url) {
    lines.push(`URL: ${preState.url} → ${postState.url}`);
  } else {
    lines.push(`URL: ${preState.url} (unchanged)`);
  }

  // Title change
  if (preState.title !== postState.title) {
    lines.push(`Title: ${preState.title} → ${postState.title}`);
  } else {
    lines.push(`Title: ${preState.title} (unchanged)`);
  }

  // DOM hash
  lines.push(`DOM hash: ${preState.domHash === postState.domHash ? 'unchanged' : 'changed'}`);

  // Interactive element count
  const preCt = preState.interactiveElements.length;
  const postCt = postState.interactiveElements.length;
  if (preCt !== postCt) {
    lines.push(`Interactive elements: ${preCt} → ${postCt}`);
  }

  // New elements (by text, limited to 5)
  const preTexts = new Set(preState.interactiveElements.map((e) => `${e.tag}:${e.text}`));
  const newElements = postState.interactiveElements
    .filter((e) => !preTexts.has(`${e.tag}:${e.text}`))
    .slice(0, 5);
  if (newElements.length > 0) {
    lines.push(`New elements: ${newElements.map((e) => `<${e.tag}> "${e.text}"`).join(', ')}`);
  }

  // Removed elements (limited to 5)
  const postTexts = new Set(postState.interactiveElements.map((e) => `${e.tag}:${e.text}`));
  const removedElements = preState.interactiveElements
    .filter((e) => !postTexts.has(`${e.tag}:${e.text}`))
    .slice(0, 5);
  if (removedElements.length > 0) {
    lines.push(`Removed elements: ${removedElements.map((e) => `<${e.tag}> "${e.text}"`).join(', ')}`);
  }

  return lines.join('\n  ');
}

/**
 * Determine whether the self-critic should run this step.
 */
export function shouldCritique(
  enableCritique: boolean,
  routerFired: boolean,
  verifierWillRun: boolean
): boolean {
  return enableCritique && !routerFired && !verifierWillRun;
}

/**
 * Ask the LLM to evaluate whether an action was useful.
 * Evaluates against the current sub-goal if available (more specific = more accurate).
 */
export async function critiqueAction(
  llm: ChatOpenAI,
  goal: string,
  currentSubGoal: SubGoal | null,
  action: ActionRecord,
  preState: PerceivedState,
  postState: PerceivedState,
  recentCritiques: CritiqueResult[]
): Promise<CritiqueResult> {
  const targetGoal = currentSubGoal
    ? `${currentSubGoal.description} (criteria: ${currentSubGoal.successCriteria})`
    : goal;

  const stateDiff = computeStateDiff(preState, postState);

  const recentText = recentCritiques.length > 0
    ? recentCritiques
        .map((c, i) => `  Critique ${i + 1}: score=${c.progressScore.toFixed(1)}, ${c.reasoning.slice(0, 80)}`)
        .join('\n')
    : '  none';

  const userMessage = `GOAL: ${goal}
${currentSubGoal ? `SUB-GOAL: ${currentSubGoal.description}\nSUCCESS CRITERIA: ${currentSubGoal.successCriteria}` : ''}

ACTION TAKEN: ${action.toolName}(${JSON.stringify(action.toolParams)})
EXPECTED: ${action.expectedOutcome}
RESULT: ${action.success ? 'success' : `failed: ${action.error}`}

STATE CHANGES:
  ${stateDiff}

RECENT CRITIQUES:
${recentText}

Was this action useful? Score progress 0.0-1.0.`;

  // Suppress unused variable warning
  void targetGoal;

  try {
    const response = await llm.invoke([
      new SystemMessage(CRITIC_SYSTEM_PROMPT),
      new HumanMessage(userMessage),
    ]);

    const content = typeof response.content === 'string' ? response.content : '';
    const parsed = extractJSON(content);

    if (parsed && typeof parsed.actionWasUseful === 'boolean') {
      return {
        actionWasUseful: parsed.actionWasUseful,
        progressScore: typeof parsed.progressScore === 'number'
          ? Math.max(0, Math.min(1, parsed.progressScore))
          : 0.5,
        reasoning: String(parsed.reasoning || ''),
        suggestion: parsed.suggestion ? String(parsed.suggestion) : undefined,
      };
    }
  } catch {
    // LLM error — fall through to fallback
  }

  // Neutral fallback
  return {
    actionWasUseful: true,
    progressScore: 0.5,
    reasoning: 'Critique unavailable',
  };
}
