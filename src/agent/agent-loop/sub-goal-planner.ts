/**
 * Sub-Goal Planner — Phase 33b
 *
 * Decomposes complex goals into sequential sub-goals with ONE upfront
 * LLM call. Each sub-goal has observable success criteria that can be
 * checked without LLM calls during the loop.
 */

import type { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { extractJSON } from './json-utils.js';
import type { SubGoal, PerceivedState } from './types.js';

export const DECOMPOSE_SYSTEM_PROMPT = `You are a task planner for a browser automation agent. Break the user's goal into 3-7 sequential sub-goals.

RULES:
- Each sub-goal should be achievable in 2-5 browser actions
- Include OBSERVABLE success criteria for each (things the agent can check without an LLM call)
- Success criteria must be one of: URL contains a string, page title contains a string, or specific text is visible on page
- Order sub-goals logically — each builds on the previous
- Estimate the number of browser actions needed for each

Respond with JSON ONLY:
{
  "subGoals": [
    {
      "description": "Navigate to the product page",
      "successCriteria": "URL contains /product/",
      "estimatedSteps": 2
    },
    ...
  ]
}`;

/**
 * Determine if a goal is complex enough to warrant decomposition.
 * Simple goals (short, single verb) skip decomposition.
 */
export function shouldDecompose(goal: string): boolean {
  if (goal.length > 50) return true;
  // Multiple action verbs suggest multi-step task
  const multiVerbPattern = /\b(and|then|after|next|finally|also|before)\b/i;
  return multiVerbPattern.test(goal);
}

/**
 * Decompose a complex goal into sequential sub-goals.
 * Makes ONE LLM call. On failure, returns a single sub-goal wrapping the whole goal.
 */
export async function decomposeGoal(
  llm: ChatOpenAI,
  goal: string,
  startUrl: string
): Promise<SubGoal[]> {
  const userMessage = `GOAL: ${goal}\nSTART URL: ${startUrl}`;

  try {
    const response = await llm.invoke([
      new SystemMessage(DECOMPOSE_SYSTEM_PROMPT),
      new HumanMessage(userMessage),
    ]);

    const content = typeof response.content === 'string' ? response.content : '';
    const parsed = extractJSON(content);

    if (parsed && Array.isArray(parsed.subGoals) && parsed.subGoals.length > 0) {
      const subGoals: SubGoal[] = [];
      for (const sg of parsed.subGoals) {
        if (
          typeof sg === 'object' && sg !== null &&
          typeof (sg as Record<string, unknown>).description === 'string' &&
          typeof (sg as Record<string, unknown>).successCriteria === 'string'
        ) {
          subGoals.push({
            description: String((sg as Record<string, unknown>).description),
            successCriteria: String((sg as Record<string, unknown>).successCriteria),
            estimatedSteps: Number((sg as Record<string, unknown>).estimatedSteps) || 3,
          });
        }
      }
      if (subGoals.length > 0) return subGoals;
    }
  } catch {
    // LLM error — fall through to fallback
  }

  // Fallback: single sub-goal wrapping the entire goal
  return [{
    description: goal,
    successCriteria: 'Goal completed as described',
    estimatedSteps: 10,
  }];
}

/**
 * Check if a sub-goal's success criteria are met by the current page state.
 * Uses simple string matching — no LLM call.
 *
 * Supports criteria patterns:
 * - "URL contains X" — checks state.url
 * - "title contains X" — checks state.title
 * - "text X is visible" or other — checks state.axTreeText
 */
export function checkSubGoalCompletion(
  subGoal: SubGoal,
  state: PerceivedState
): boolean {
  const criteria = subGoal.successCriteria.toLowerCase();

  // "URL contains X"
  const urlMatch = criteria.match(/url\s+contains?\s+["']?([^"']+)["']?/i);
  if (urlMatch && urlMatch[1]) {
    return state.url.toLowerCase().includes(urlMatch[1].trim().toLowerCase());
  }

  // "title contains X"
  const titleMatch = criteria.match(/title\s+contains?\s+["']?([^"']+)["']?/i);
  if (titleMatch && titleMatch[1]) {
    return state.title.toLowerCase().includes(titleMatch[1].trim().toLowerCase());
  }

  // Fallback: check if any key phrase from criteria appears in AX tree
  if (state.axTreeText) {
    // Extract quoted strings or key phrases
    const phrases = criteria.match(/"([^"]+)"/g) || criteria.match(/'([^']+)'/g);
    if (phrases) {
      return phrases.some((phrase) => {
        const clean = phrase.replace(/['"]/g, '').trim();
        return state.axTreeText!.toLowerCase().includes(clean.toLowerCase());
      });
    }
  }

  return false;
}
