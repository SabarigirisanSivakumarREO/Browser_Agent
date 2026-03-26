/**
 * Click Tool
 *
 * Phase 17a (T092): Navigation tool that clicks an element by index.
 * Returns insights: [] (navigation tools don't analyze).
 */

import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult, DOMNode } from '../../../models/index.js';
import { waitForPossibleNavigation, locatorFromSelector } from './tool-utils.js';

/**
 * Coerce string/boolean/'auto' to the appropriate value for waitForNavigation.
 * Accepts: true, false, 'true', 'false', 'auto' (default).
 */
const coerceNavigation = z.preprocess((val) => {
  if (val === 'auto' || val === undefined || val === null) return 'auto';
  if (typeof val === 'string') {
    if (val.toLowerCase() === 'true') return true;
    if (val.toLowerCase() === 'false') return false;
    return 'auto';
  }
  return val;
}, z.union([z.boolean(), z.literal('auto')]));

/**
 * Parameter schema for click tool
 */
export const ClickParamsSchema = z.object({
  elementIndex: z.coerce.number().int().nonnegative(),
  waitForNavigation: coerceNavigation.optional().default('auto'),
});

export type ClickParams = z.infer<typeof ClickParamsSchema>;

/**
 * Click extracted data
 */
interface ClickExtracted {
  clickedXpath: string;
  elementText: string;
  navigationOccurred: boolean;
  /** True if clicking opened a new tab (target="_blank") */
  newTabOpened: boolean;
}

/**
 * Find element by index in DOM tree (depth-first traversal)
 */
function findElementByIndex(
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
 * Click Tool Implementation
 */
export const clickTool: Tool = {
  name: 'click',
  description:
    'Click an element by its index from the DOM tree. Use waitForNavigation: true if expecting page navigation.',
  parameters: ClickParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as ClickParams;
    const { elementIndex, waitForNavigation } = params;

    try {
      // Find element by index in DOM tree
      const element = findElementByIndex(
        context.state.domTree.root,
        elementIndex
      );

      if (!element) {
        return {
          success: false,
          insights: [],
          error: `Element with index ${elementIndex} not found`,
        };
      }

      if (!element.isVisible) {
        return {
          success: false,
          insights: [],
          error: `Element ${elementIndex} is not visible`,
        };
      }

      const xpath = element.xpath;
      const elementText = element.text?.trim() || '';

      context.logger.debug(
        `Clicking element ${elementIndex}: "${elementText}" (${xpath})`
      );

      // Get current URL to detect navigation
      const previousUrl = context.page.url();

      // Locate element by xpath
      const locator = locatorFromSelector(context.page, xpath);

      // Check if element exists in current DOM
      const count = await locator.count();
      if (count === 0) {
        return {
          success: false,
          insights: [],
          error: `Element no longer in DOM`,
        };
      }

      // Detect new tab opening: listen for 'page' event on browser context
      const browserContext = context.page.context();
      let newTabOpened = false;
      let newTabPage: Awaited<ReturnType<typeof browserContext.newPage>> | null = null;

      const newTabPromise = new Promise<void>((resolve) => {
        browserContext.once('page', (p) => {
          newTabPage = p;
          newTabOpened = true;
          resolve();
        });
        // Timeout — if no new tab after 3s, resolve anyway
        setTimeout(resolve, 3000);
      });

      // Perform click with navigation handling
      if (waitForNavigation === true) {
        await Promise.race([
          Promise.all([
            context.page.waitForNavigation({ timeout: 5000 }).catch(() => null),
            locator.click({ timeout: 5000 }),
          ]),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Click timed out after 5000ms')), 5000)
          ),
        ]);
      } else {
        await locator.click({ timeout: 5000 });
      }

      // Wait briefly for new tab detection
      await newTabPromise;

      // If a new tab opened, switch to it automatically
      if (newTabOpened && newTabPage) {
        try {
          await (newTabPage as { waitForLoadState: (state: string, opts: { timeout: number }) => Promise<void> })
            .waitForLoadState('load', { timeout: 10000 });
          // Bring new tab to front
          await (newTabPage as { bringToFront: () => Promise<void> }).bringToFront();
          context.logger.debug('New tab opened and switched to it');
        } catch {
          context.logger.debug('New tab opened but failed to wait for load');
        }
      }

      // Auto-detect navigation on current page
      let navigationOccurred = false;
      if (waitForNavigation === 'auto') {
        const navResult = await waitForPossibleNavigation(context.page, previousUrl, 5000);
        navigationOccurred = navResult.navigated;
      } else {
        const newUrl = context.page.url();
        navigationOccurred = newUrl !== previousUrl;
      }

      const extracted: ClickExtracted = {
        clickedXpath: xpath,
        elementText,
        navigationOccurred,
        newTabOpened,
      };

      context.logger.debug(
        `Clicked element. Navigation: ${navigationOccurred}`
      );

      return {
        success: true,
        insights: [],
        extracted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error(`Click failed: ${message}`);

      return {
        success: false,
        insights: [],
        error: message,
      };
    }
  },
};

export default clickTool;
