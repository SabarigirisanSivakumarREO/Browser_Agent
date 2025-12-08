/**
 * Scroll Page Tool
 *
 * Phase 17a (T091): Navigation tool that scrolls the page.
 * Returns insights: [] (navigation tools don't analyze).
 */

import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';

/**
 * Parameter schema for scroll_page tool
 */
export const ScrollPageParamsSchema = z.object({
  direction: z.enum(['up', 'down', 'top', 'bottom']),
  amount: z.number().positive().optional().default(500),
});

export type ScrollPageParams = z.infer<typeof ScrollPageParamsSchema>;

/**
 * Scroll extracted data
 */
interface ScrollExtracted {
  previousY: number;
  newY: number;
  atTop: boolean;
  atBottom: boolean;
  scrolledBy: number;
}

/**
 * Scroll Page Tool Implementation
 */
export const scrollPageTool: Tool = {
  name: 'scroll_page',
  description:
    'Scroll the page in a direction. Use to reveal content below/above the fold. Returns new scroll position.',
  parameters: ScrollPageParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as ScrollPageParams;
    const { direction, amount } = params;

    try {
      // Get current scroll position before scrolling
      const previousY = context.state.scrollPosition.y;
      const maxY = context.state.scrollPosition.maxY;

      // Calculate target scroll position
      let targetY: number;
      switch (direction) {
        case 'up':
          targetY = Math.max(0, previousY - amount);
          break;
        case 'down':
          targetY = Math.min(maxY, previousY + amount);
          break;
        case 'top':
          targetY = 0;
          break;
        case 'bottom':
          targetY = maxY;
          break;
      }

      // Execute scroll via Playwright (window is available in browser context)
      await context.page.evaluate((y: number) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).scrollTo({ top: y, behavior: 'instant' });
      }, targetY);

      // Wait for scroll to complete
      await context.page.waitForTimeout(100);

      // Get actual new scroll position (scrollY is available in browser context)
      const newY = await context.page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (globalThis as any).scrollY as number;
      });

      const extracted: ScrollExtracted = {
        previousY,
        newY,
        atTop: newY === 0,
        atBottom: newY >= maxY,
        scrolledBy: newY - previousY,
      };

      context.logger.debug(
        `Scrolled ${direction}: ${previousY} -> ${newY} (max: ${maxY})`
      );

      return {
        success: true,
        insights: [],
        extracted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error(`Scroll failed: ${message}`);

      return {
        success: false,
        insights: [],
        error: `Scroll failed: ${message}`,
      };
    }
  },
};

export default scrollPageTool;
