/**
 * Failure Detection & Routing
 *
 * Phase 32 (T712): Deterministic failure detection and routing.
 * Pure logic — no LLM, no browser. Maps failure types to recovery strategies.
 */

import type { ToolResult } from '../../models/index.js';
import type {
  DetectedFailure,
  RoutedFailure,
} from './types.js';

/** Tools that are read-only and exempt from DOM change detection */
export const READ_ONLY_TOOLS = [
  'extract_text',
  'get_ax_tree',
  'capture_viewport',
  'get_screenshot',
] as const;

const MAX_ELEMENT_RETRIES = 3;

/**
 * Detect a failure from a tool execution result and DOM state.
 *
 * @param toolName - Name of the executed tool
 * @param result - Tool execution result
 * @param domHashBefore - DOM hash before action
 * @param domHashAfter - DOM hash after action
 * @returns Detected failure or null if no failure
 */
export function detectFailure(
  toolName: string,
  result: ToolResult,
  domHashBefore: string,
  domHashAfter: string,
  preState?: { url: string; axTreeText: string | null },
  postState?: { url: string; axTreeText: string | null },
  actionHistory?: Array<{ toolName: string; toolParams: Record<string, unknown>; domHashAfter: string }>
): DetectedFailure | null {
  // Element not found
  if (!result.success && result.error && /not found/i.test(result.error)) {
    return {
      type: 'ELEMENT_NOT_FOUND',
      details: result.error,
      retryCount: 0,
    };
  }

  // DOM unchanged on mutating tool
  const isReadOnly = (READ_ONLY_TOOLS as readonly string[]).includes(toolName);
  if (
    result.success &&
    !isReadOnly &&
    domHashBefore === domHashAfter
  ) {
    return {
      type: 'ACTION_HAD_NO_EFFECT',
      details: `DOM unchanged after ${toolName}`,
      retryCount: 0,
    };
  }

  // WRONG_PAGE: navigated to login/error/404 page
  if (preState && postState) {
    const errorPagePattern = /\/(?:login|signin|sign-in|error|404|403|unauthorized|access-denied)/i;
    if (errorPagePattern.test(postState.url) && !errorPagePattern.test(preState.url)) {
      return {
        type: 'WRONG_PAGE',
        details: `Navigated to error/auth page: ${postState.url}`,
        retryCount: 0,
      };
    }
  }

  // FORM_ERROR: error text appeared in AX tree
  if (preState && postState && postState.axTreeText) {
    const errorPattern = /\b(error|invalid|required|failed|please correct)\b/i;
    const hadErrors = preState.axTreeText && errorPattern.test(preState.axTreeText);
    const hasErrors = errorPattern.test(postState.axTreeText);
    if (hasErrors && !hadErrors) {
      return {
        type: 'FORM_ERROR',
        details: 'Form validation error appeared after action',
        retryCount: 0,
      };
    }
  }

  // REDIRECT_LOOP: same DOM hash seen 3+ times in action history
  if (actionHistory && actionHistory.length >= 2) {
    const hashCount = actionHistory.filter((a) => a.domHashAfter === domHashAfter).length;
    if (hashCount >= 3) {
      return {
        type: 'REDIRECT_LOOP',
        details: `Same page state visited ${hashCount} times (domHash: ${domHashAfter.slice(0, 8)})`,
        retryCount: 0,
      };
    }
  }

  // PAGE_CRASHED: unexpected navigation to about:blank
  if (preState && postState) {
    if (postState.url === 'about:blank' && preState.url !== 'about:blank') {
      return {
        type: 'PAGE_CRASHED',
        details: `Page crashed: navigated from ${preState.url} to about:blank`,
        retryCount: 0,
      };
    }
  }

  return null;
}

/**
 * Route a detected failure to a resolution strategy.
 * Pure deterministic logic — no LLM call.
 *
 * @param failure - The detected failure with retry context
 * @returns Routed failure with strategy
 */
export function routeFailure(failure: DetectedFailure): RoutedFailure {
  switch (failure.type) {
    case 'ELEMENT_NOT_FOUND':
      return failure.retryCount < MAX_ELEMENT_RETRIES
        ? { failure, strategy: 'REPLAN' }
        : { failure, strategy: 'TERMINATE' };
    case 'ACTION_HAD_NO_EFFECT':
      return { failure, strategy: 'REPLAN_WITH_DIAGNOSTIC' };
    case 'BUDGET_EXCEEDED':
      return { failure, strategy: 'TERMINATE' };
    case 'WRONG_PAGE':
      return { failure, strategy: 'REPLAN' };
    case 'FORM_ERROR':
      return { failure, strategy: 'REPLAN_WITH_DIAGNOSTIC' };
    case 'REDIRECT_LOOP':
      return { failure, strategy: 'TERMINATE' };
    case 'PAGE_CRASHED':
      return { failure, strategy: 'TERMINATE' };
  }
}
