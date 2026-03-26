/**
 * Shared utilities for CRO tools.
 *
 * Extracted helpers that are reused across multiple tool implementations.
 */

import { z } from 'zod';
import type { Page, Locator } from 'playwright';
import type { DOMNode } from '../../../models/index.js';

/**
 * Find element by index in DOM tree (depth-first traversal).
 *
 * Traverses the tree counting only visible + interactive nodes.
 * Returns the node at `targetIndex` or `null` if not found.
 */
export function findElementByIndex(
  root: DOMNode,
  targetIndex: number
): DOMNode | null {
  // Use a stack for DFS traversal
  const stack: DOMNode[] = [root];
  let currentIndex = 0;

  while (stack.length > 0) {
    const node = stack.pop()!;

    // Only count visible, interactive elements
    if (node.isVisible && node.isInteractive) {
      if (currentIndex === targetIndex) {
        return node;
      }
      currentIndex++;
    }

    // Add children in reverse order (so first child is processed first)
    for (let i = node.children.length - 1; i >= 0; i--) {
      const child = node.children[i];
      if (child) {
        stack.push(child);
      }
    }
  }

  return null;
}

/**
 * Zod preprocess helper that coerces string values to boolean.
 *
 * Handles the common case where an LLM returns `"true"` / `"false"` as a
 * string instead of a native boolean.
 */
export const coerceBoolean = z.preprocess((val) => {
  if (typeof val === 'string') {
    return val.toLowerCase() === 'true';
  }
  return val;
}, z.boolean());

/**
 * Create a Playwright locator from a selector string.
 *
 * Detects whether the selector is XPath (starts with / or //) or CSS
 * and uses the appropriate Playwright prefix.
 */
export function locatorFromSelector(page: Page, selector: string): Locator {
  const prefix = selector.startsWith('/') ? 'xpath=' : '';
  return page.locator(`${prefix}${selector}`);
}

/**
 * Wait for a possible navigation to complete after an action.
 *
 * Compares the current URL against the previous URL. If the URL changed,
 * waits for the page load state to settle. Timeout is non-fatal.
 *
 * @param page - Playwright page instance
 * @param previousUrl - URL captured before the action
 * @param timeoutMs - Max time to wait for load state (default 10s)
 * @returns Whether a navigation was detected
 */
export async function waitForPossibleNavigation(
  page: Page,
  previousUrl: string,
  timeoutMs = 10000
): Promise<{ navigated: boolean }> {
  try {
    const currentUrl = page.url();
    if (currentUrl !== previousUrl) {
      await page.waitForLoadState('load', { timeout: timeoutMs });
      return { navigated: true };
    }
  } catch {
    // Timeout or page error — non-fatal, navigation may still be in progress
    return { navigated: true };
  }
  return { navigated: false };
}
