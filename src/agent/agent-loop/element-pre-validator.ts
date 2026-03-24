/**
 * Element Pre-Validator
 *
 * Phase 33a (T739): Pre-validate that a target element exists before action
 * execution. Prevents 10-second Playwright timeouts on missing elements by
 * performing a ~5ms DOM presence check first.
 */

import type { Page } from 'playwright';
import type { PerceivedState } from './types.js';
import { ELEMENT_TARGETING_TOOLS } from './types.js';

/**
 * Pre-validate that a target element exists before action execution.
 * Prevents 10-second Playwright timeouts on missing elements.
 */
export async function preValidateElement(
  page: Page,
  toolName: string,
  toolParams: Record<string, unknown>,
  state: PerceivedState
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Only validate tools that target specific DOM elements
    if (!(ELEMENT_TARGETING_TOOLS as readonly string[]).includes(toolName)) {
      return { valid: true };
    }

    // Extract elementIndex — tools use either 'elementIndex' or 'index'
    const rawIndex = toolParams['elementIndex'] ?? toolParams['index'];
    if (rawIndex === undefined || rawIndex === null) {
      return { valid: true };
    }

    const elementIndex = Number(rawIndex);

    // Find matching element in perceived state
    const element = state.interactiveElements.find((el) => el.index === elementIndex);
    if (!element) {
      const available = state.interactiveElements.length;
      return {
        valid: false,
        error: `Element with index ${elementIndex} not in perceived state (${available} elements available)`,
      };
    }

    // If element has a selector, verify it exists in the live DOM
    if (element.selector) {
      const count = await page.locator(`xpath=${element.selector}`).count();
      if (count === 0) {
        return {
          valid: false,
          error: `Element xpath not found in DOM: ${element.selector}`,
        };
      }
    }

    return { valid: true };
  } catch {
    // Never block execution on validation failure
    return { valid: true };
  }
}
