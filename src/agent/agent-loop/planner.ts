/**
 * Planner — LLM Single-Action Planning
 *
 * Phase 32 (T725): Asks the LLM to choose the SINGLE next action
 * toward the user's goal based on current page state.
 */

import type { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { extractJSON } from './json-utils.js';
import type {
  PlannerOutput,
  PerceivedState,
  ActionRecord,
  RoutedFailure,
  BudgetStatus,
} from './types.js';

/** Tools available to the planner (interaction + perception, NOT CRO analysis) */
const AVAILABLE_TOOLS = [
  'type_text',
  'press_key',
  'select_option',
  'extract_text',
  'hover',
  'go_back',
  'wait_for',
  'dismiss_blocker',
  'switch_tab',
  'upload_file',
  'execute_js',
  'drag_and_drop',
  'get_ax_tree',
  'click',
  'scroll_page',
  'go_to_url',
] as const;

export const PLANNER_SYSTEM_PROMPT = `You are a browser automation agent. You observe the current page state and decide the SINGLE next action to take toward the user's goal.

RULES:
- Take ONE action at a time. Never plan multiple steps.
- Always specify the expected observable outcome.
- If the page has a blocker (cookie banner, modal), dismiss it first using dismiss_blocker.
- If an element wasn't found, try a different reference or scroll.
- If your last action had no effect, try a completely different approach.
- If the target element is not visible, try scrolling down first.
- Never repeat the exact same failing action.

Available tools: ${AVAILABLE_TOOLS.join(', ')}

Tool parameter examples:
- click: { "elementIndex": 3 }
- type_text: { "elementIndex": 5, "text": "search query" }
- press_key: { "key": "Enter" }
- scroll_page: { "direction": "down" }
- go_to_url: { "url": "https://example.com" }
- dismiss_blocker: { "strategy": "auto" }
- extract_text: {}
- get_ax_tree: {}

Respond with JSON ONLY (no markdown, no explanation outside JSON):
{
  "reasoning": "why this action moves toward the goal",
  "toolName": "tool_name",
  "toolParams": { ... },
  "expectedOutcome": "what should change after this action"
}`;

/**
 * Ask the LLM to plan the next single action.
 *
 * @returns Planned action, or a safe fallback on parse failure
 */
export async function planNextAction(
  llm: ChatOpenAI,
  goal: string,
  state: PerceivedState,
  recentActions: ActionRecord[],
  failureContext: RoutedFailure | null,
  budgetStatus: BudgetStatus,
  confidence: number
): Promise<PlannerOutput> {
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
    ? `${failureContext.failure.type}: ${failureContext.failure.details} (strategy: ${failureContext.strategy})`
    : 'none';

  const userMessage = `GOAL: ${goal}

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
BUDGET: Step ${budgetStatus.stepsUsed}/${budgetStatus.stepsUsed + budgetStatus.stepsRemaining} | Confidence: ${confidence.toFixed(2)}

What is the single next action?`;

  try {
    const response = await llm.invoke([
      new SystemMessage(PLANNER_SYSTEM_PROMPT),
      new HumanMessage(userMessage),
    ]);

    const content =
      typeof response.content === 'string' ? response.content : '';
    const parsed = extractJSON(content);

    if (
      parsed &&
      typeof parsed.toolName === 'string' &&
      typeof parsed.toolParams === 'object'
    ) {
      return {
        reasoning: String(parsed.reasoning || ''),
        toolName: parsed.toolName,
        toolParams: (parsed.toolParams || {}) as Record<string, unknown>,
        expectedOutcome: String(parsed.expectedOutcome || ''),
      };
    }
  } catch {
    // LLM timeout or network error — fall through to fallback
  }

  // Safe fallback: gather diagnostic info
  return {
    reasoning: 'Parse failed or LLM error, gathering page info',
    toolName: 'extract_text',
    toolParams: {},
    expectedOutcome: 'Get page text for next plan',
  };
}
