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
  CritiqueResult,
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

export const PLANNER_SYSTEM_PROMPT = `You are a browser automation agent. You observe the current page state — including a screenshot, accessibility tree, page text, and interactive elements — and decide the SINGLE next action to take toward the user's goal.

RULES:
- Take ONE action at a time. Never plan multiple steps.
- Always specify the expected observable outcome.
- You can see a screenshot of the current page. Use it to identify visual elements, product listings, prices, and ratings.
- Prefer elements in the MAIN CONTENT area (region: "main") for goal-relevant actions like clicking products, links, or search results.
- Match element text with what you see in the screenshot and PAGE TEXT to confirm the right target before clicking.
- For type_text, ONLY target <input> or <textarea> elements — NEVER <select> (use select_option for dropdowns). Search boxes are <input> with type=text. Look for the element with tag=input and a search-related aria-label or placeholder.
- Some links open in new tabs. The system auto-switches to new tabs after clicking. If the page doesn't change after a click, the link may have opened in a new tab — the next perception will show the new tab's content.
- If no suitable element is in the list, use scroll_page to reveal more content or get_ax_tree for full page structure.
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
  confidence: number,
  visitedUrls?: string,
  failedCombos?: string,
  currentSubGoal?: string,    // Phase 33b
  critiqueHistory?: CritiqueResult[],  // Phase 33c
  screenshotBase64?: string   // Phase 35E
): Promise<PlannerOutput> {
  const elementsText = state.interactiveElements
    .map((e) => {
      let line = `[${e.index}] <${e.tag}> "${e.text}"`;
      if (e.role) line += ` role=${e.role}`;
      if (e.type) line += ` type=${e.type}`;
      if (e.placeholder) line += ` placeholder="${e.placeholder}"`;
      if (e.group) line += ` [group: ${e.group}]`;
      if (e.region) line += ` (region: ${e.region}${e.score !== undefined ? `, score: ${e.score}` : ''})`;
      if (e.accessibleName && e.accessibleName !== e.text) line += ` — AX: "${e.accessibleName}"`;
      return line;
    })
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

  const critiqueText = critiqueHistory && critiqueHistory.length > 0
    ? critiqueHistory
        .map((c) => `score=${c.progressScore.toFixed(1)}: ${c.reasoning.slice(0, 60)}${c.suggestion ? ` → try: ${c.suggestion}` : ''}`)
        .join('\n  ')
    : 'none';

  const contentRegionText = state.contentRegion
    ? `\nCONTENT REGION: ${state.contentRegion.mainContentLinks} links, ${state.contentRegion.mainContentButtons} buttons in main content | ${state.contentRegion.headerElements} header elements | ${state.contentRegion.totalInteractive} total${state.contentRegion.hasMainLandmark ? ' | <main> landmark found' : ''}`
    : '';

  const pageTextSection = state.pageText
    ? `\nPAGE TEXT (main content):\n${state.pageText}`
    : '';

  const userMessage = `GOAL: ${goal}
${currentSubGoal ? `\nCURRENT SUB-GOAL: ${currentSubGoal}` : ''}
CURRENT PAGE:
  URL: ${state.url}
  Title: ${state.title}
${contentRegionText}

ACCESSIBILITY TREE:
${state.axTreeText || '(not available)'}
${pageTextSection}

INTERACTIVE ELEMENTS (top ${state.interactiveElements.length}):
  ${elementsText || '(none found)'}

RECENT ACTIONS (last 5):
  ${actionsText}

FAILURE CONTEXT: ${failureText}
VISITED PAGES: ${visitedUrls || 'none'}
FAILED COMBINATIONS: ${failedCombos || 'none'}
RECENT CRITIQUES: ${critiqueText}
BUDGET: Step ${budgetStatus.stepsUsed}/${budgetStatus.stepsUsed + budgetStatus.stepsRemaining} | Confidence: ${confidence.toFixed(2)}

What is the single next action?`;

  try {
    // Build multimodal message when screenshot is available (Phase 35E)
    const humanContent = screenshotBase64
      ? [
          { type: 'text' as const, text: userMessage },
          { type: 'image_url' as const, image_url: { url: `data:image/jpeg;base64,${screenshotBase64}` } },
        ]
      : userMessage;
    const response = await llm.invoke([
      new SystemMessage(PLANNER_SYSTEM_PROMPT),
      new HumanMessage({ content: humanContent }),
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

/**
 * Extract failed tool+element combinations from action history.
 * Format: "click(elementIndex:3) failed 2x, type_text(elementIndex:5) failed 1x"
 */
export function formatFailedCombos(history: ActionRecord[]): string {
  const failedMap = new Map<string, number>();
  for (const action of history) {
    if (!action.success) {
      const elementIndex = (action.toolParams as Record<string, unknown>).elementIndex ??
                          (action.toolParams as Record<string, unknown>).index;
      const key = elementIndex !== undefined
        ? `${action.toolName}(elementIndex:${elementIndex})`
        : action.toolName;
      failedMap.set(key, (failedMap.get(key) ?? 0) + 1);
    }
  }
  if (failedMap.size === 0) return 'none';
  return Array.from(failedMap.entries())
    .map(([combo, count]) => `${combo} failed ${count}x`)
    .join(', ');
}
