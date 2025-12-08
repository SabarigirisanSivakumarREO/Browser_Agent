/**
 * Go To URL Tool
 *
 * Phase 17a (T093): Navigation tool that navigates to a new URL.
 * Returns insights: [] (navigation tools don't analyze).
 */

import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';

/**
 * Parameter schema for go_to_url tool
 */
export const GoToUrlParamsSchema = z.object({
  url: z.string().url(),
  waitUntil: z
    .enum(['load', 'domcontentloaded', 'networkidle'])
    .optional()
    .default('load'),
});

export type GoToUrlParams = z.infer<typeof GoToUrlParamsSchema>;

/**
 * Go to URL extracted data
 */
interface GoToUrlExtracted {
  previousUrl: string;
  newUrl: string;
  loadTimeMs: number;
}

/**
 * Navigation timeout in milliseconds
 */
const NAVIGATION_TIMEOUT_MS = 60000;

/**
 * Go To URL Tool Implementation
 */
export const goToUrlTool: Tool = {
  name: 'go_to_url',
  description:
    'Navigate to a new URL. Use waitUntil to control when navigation is considered complete.',
  parameters: GoToUrlParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as GoToUrlParams;
    const { url, waitUntil } = params;

    const previousUrl = context.page.url();
    const startTime = Date.now();

    try {
      context.logger.debug(`Navigating to: ${url} (waitUntil: ${waitUntil})`);

      // Navigate to the URL
      const response = await context.page.goto(url, {
        waitUntil,
        timeout: NAVIGATION_TIMEOUT_MS,
      });

      const loadTimeMs = Date.now() - startTime;
      const newUrl = context.page.url();

      // Check for navigation errors
      if (!response) {
        return {
          success: false,
          insights: [],
          error: `Navigation failed: No response received`,
        };
      }

      const status = response.status();
      if (status >= 400) {
        return {
          success: false,
          insights: [],
          error: `Navigation failed: HTTP ${status}`,
          extracted: {
            previousUrl,
            newUrl,
            loadTimeMs,
            httpStatus: status,
          },
        };
      }

      const extracted: GoToUrlExtracted = {
        previousUrl,
        newUrl,
        loadTimeMs,
      };

      context.logger.debug(
        `Navigation complete: ${newUrl} (${loadTimeMs}ms)`
      );

      return {
        success: true,
        insights: [],
        extracted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const loadTimeMs = Date.now() - startTime;

      // Check for timeout specifically
      if (message.includes('Timeout') || message.includes('timeout')) {
        return {
          success: false,
          insights: [],
          error: `Navigation timed out after ${NAVIGATION_TIMEOUT_MS}ms`,
          extracted: {
            previousUrl,
            newUrl: context.page.url(),
            loadTimeMs,
          },
        };
      }

      context.logger.error(`Navigation failed: ${message}`);

      return {
        success: false,
        insights: [],
        error: `Navigation failed: ${message}`,
        extracted: {
          previousUrl,
          newUrl: context.page.url(),
          loadTimeMs,
        },
      };
    }
  },
};

export default goToUrlTool;
