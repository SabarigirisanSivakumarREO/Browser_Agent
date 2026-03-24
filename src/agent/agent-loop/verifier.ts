/**
 * Verifier — LLM Goal Verification
 *
 * Phase 32 (T726): Periodically checks if the user's goal has been
 * achieved by examining observable page state.
 */

import type { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { extractJSON } from './json-utils.js';
import type {
  VerificationResult,
  PerceivedState,
  ActionRecord,
} from './types.js';

export const VERIFIER_SYSTEM_PROMPT = `You are a verification agent. Given the user's goal and current page state, determine if the goal has been achieved.

Check OBSERVABLE conditions only: URL, visible text, element presence.
Do NOT assume success because actions executed without errors.

Respond with JSON ONLY:
{
  "goalSatisfied": true or false,
  "confidence": 0.0 to 1.0,
  "reasoning": "what you observed that supports your conclusion"
}`;

/**
 * Ask the LLM whether the goal has been achieved.
 *
 * @returns Verification result, or a safe false-negative on parse failure
 */
export async function verifyGoal(
  llm: ChatOpenAI,
  goal: string,
  state: PerceivedState,
  actionHistory: ActionRecord[]
): Promise<VerificationResult> {
  const actionSummary = actionHistory
    .slice(-5)
    .map(
      (a) =>
        `Step ${a.step}: ${a.toolName} → ${a.success ? '✓' : '✗'}`
    )
    .join('\n  ');

  const userMessage = `GOAL: ${goal}

CURRENT PAGE:
  URL: ${state.url}
  Title: ${state.title}

ACCESSIBILITY TREE:
${state.axTreeText || '(not available)'}

RECENT ACTIONS:
  ${actionSummary || 'none'}

Has the goal been achieved?`;

  try {
    const response = await llm.invoke([
      new SystemMessage(VERIFIER_SYSTEM_PROMPT),
      new HumanMessage(userMessage),
    ]);

    const content =
      typeof response.content === 'string' ? response.content : '';
    const parsed = extractJSON(content);

    if (parsed && typeof parsed.goalSatisfied === 'boolean') {
      return {
        goalSatisfied: parsed.goalSatisfied,
        confidence: typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0,
        reasoning: String(parsed.reasoning || ''),
      };
    }
  } catch {
    // LLM timeout or error — assume not satisfied
  }

  return {
    goalSatisfied: false,
    confidence: 0,
    reasoning: 'Verification parse failed',
  };
}

/**
 * Determine whether goal verification should run this step.
 * Runs every N steps or after a URL change.
 */
export function shouldVerify(
  step: number,
  everyN: number,
  preState: PerceivedState,
  postState: PerceivedState
): boolean {
  if (step > 0 && step % everyN === 0) return true;
  if (preState.url !== postState.url) return true;
  return false;
}
