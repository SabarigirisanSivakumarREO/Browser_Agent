/**
 * Scroll Page Tool - Phase 21g (T339)
 *
 * Scrolls the page in a specified direction.
 * Used by the vision agent to navigate through different viewport positions.
 */

import type { VisionToolDefinition, VisionToolContext, ScrollPageInput, ScrollPageOutput } from '../types.js';
import { createLogger } from '../../../utils/index.js';

const logger = createLogger('ScrollPageTool');

/**
 * JSON Schema for scroll_page parameters
 */
const SCROLL_PAGE_SCHEMA = {
  type: 'object',
  properties: {
    direction: {
      type: 'string',
      enum: ['up', 'down', 'top', 'bottom'],
      description: 'Direction to scroll: "up" scrolls towards page top, "down" scrolls towards page bottom, "top" jumps to page top, "bottom" jumps to page bottom',
    },
    amount: {
      type: 'number',
      description: 'Optional: pixels to scroll (default: 500). Only used for "up" and "down" directions.',
    },
  },
  required: ['direction'],
  additionalProperties: false,
};

/**
 * Create the scroll_page tool
 */
export function createScrollPageTool(): VisionToolDefinition {
  return {
    name: 'scroll_page',
    description:
      'Scrolls the page to reveal different content. Use "down" to scroll towards the bottom of the page, ' +
      '"up" to scroll towards the top. Use "top" or "bottom" to jump directly to the start or end. ' +
      'After scrolling, you should use capture_viewport to get the new DOM and screenshot.',
    parameters: SCROLL_PAGE_SCHEMA,

    async execute(input: unknown, context: VisionToolContext): Promise<ScrollPageOutput> {
      const params = input as ScrollPageInput;
      const { page, state, options } = context;

      try {
        const previousScrollY = state.currentScrollY;
        const scrollIncrement = params.amount ?? options.scrollIncrement;
        let newScrollY: number;
        let reachedBoundary = false;

        // Get current page dimensions
        const dimensions = await page.evaluate(`
          (() => ({
            scrollY: window.scrollY,
            scrollHeight: document.documentElement.scrollHeight,
            clientHeight: document.documentElement.clientHeight,
          }))()
        `) as { scrollY: number; scrollHeight: number; clientHeight: number };

        const maxScrollY = Math.max(0, dimensions.scrollHeight - dimensions.clientHeight);

        // Calculate new scroll position
        switch (params.direction) {
          case 'top':
            newScrollY = 0;
            break;

          case 'bottom':
            newScrollY = maxScrollY;
            break;

          case 'up':
            newScrollY = Math.max(0, previousScrollY - scrollIncrement);
            if (newScrollY === 0) reachedBoundary = true;
            break;

          case 'down':
            newScrollY = Math.min(maxScrollY, previousScrollY + scrollIncrement);
            if (newScrollY >= maxScrollY) reachedBoundary = true;
            break;

          default:
            return {
              success: false,
              error: `Invalid scroll direction: ${params.direction}`,
            };
        }

        // Perform scroll
        await page.evaluate(`window.scrollTo({ top: ${newScrollY}, behavior: 'instant' })`);

        // Wait for any lazy-loaded content
        await page.waitForTimeout(300);

        // Verify scroll position
        const actualScrollY = await page.evaluate('window.scrollY') as number;

        logger.debug('Page scrolled', {
          direction: params.direction,
          from: previousScrollY,
          to: actualScrollY,
          reachedBoundary,
        });

        return {
          success: true,
          newScrollY: actualScrollY,
          previousScrollY,
          reachedBoundary,
        };

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to scroll page', { error: message });

        return {
          success: false,
          error: `Failed to scroll page: ${message}`,
        };
      }
    },
  };
}
