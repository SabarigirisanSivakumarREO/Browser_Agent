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
  domHashAfter: string
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
  }
}
