/**
 * Wait For Tool
 *
 * Phase 31 (P1): Browser interaction tool that waits for a specified condition.
 * Supports waiting for selectors, URL changes, network idle, or a fixed timeout.
 * Returns insights: [] (interaction tools don't analyze).
 */

import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';

/**
 * Parameter schema for wait_for tool
 */
export const WaitForParamsSchema = z.object({
  condition: z.enum(['selector', 'url_contains', 'network_idle', 'timeout']),
  value: z.string().optional(),
  timeoutMs: z.coerce.number().positive().max(30000).optional().default(10000),
});

export type WaitForParams = z.infer<typeof WaitForParamsSchema>;

/**
 * Wait for extracted data
 */
interface WaitForExtracted {
  condition: string;
  value: string | undefined;
  waited: boolean;
  actualUrl: string;
}

/**
 * Wait For Tool Implementation
 */
export const waitForTool: Tool = {
  name: 'wait_for',
  description:
    'Wait for a condition: a CSS selector to appear, URL to contain a string, network idle, or a fixed timeout.',
  parameters: WaitForParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as WaitForParams;
    const { condition, value, timeoutMs } = params;

    try {
      context.logger.debug(
        `Waiting for ${condition}${value ? `: ${value}` : ''} (timeout: ${timeoutMs}ms)`
      );

      switch (condition) {
        case 'selector':
          if (!value) {
            return {
              success: false,
              insights: [],
              error: 'value is required for selector condition',
            };
          }
          await context.page.waitForSelector(value, {
            state: 'visible',
            timeout: timeoutMs,
          });
          break;

        case 'url_contains':
          if (!value) {
            return {
              success: false,
              insights: [],
              error: 'value is required for url_contains condition',
            };
          }
          await context.page.waitForURL(
            (url) => url.toString().includes(value),
            { timeout: timeoutMs }
          );
          break;

        case 'network_idle':
          await context.page.waitForLoadState('networkidle', {
            timeout: timeoutMs,
          });
          break;

        case 'timeout':
          await context.page.waitForTimeout(timeoutMs);
          break;
      }

      const actualUrl = context.page.url();

      const extracted: WaitForExtracted = {
        condition,
        value,
        waited: true,
        actualUrl,
      };

      context.logger.debug(`Wait complete for ${condition}`);

      return {
        success: true,
        insights: [],
        extracted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error(`Wait failed: ${message}`);

      return {
        success: false,
        insights: [],
        error: message,
      };
    }
  },
};

export default waitForTool;
