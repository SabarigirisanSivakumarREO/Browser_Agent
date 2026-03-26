/**
 * Go Back Tool
 *
 * Phase 31 (P1): Browser interaction tool that navigates back in history.
 * Returns insights: [] (navigation tools don't analyze).
 */

import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';

/**
 * Parameter schema for go_back tool
 */
export const GoBackParamsSchema = z.object({
  waitUntil: z
    .enum(['load', 'domcontentloaded', 'networkidle'])
    .optional()
    .default('load'),
});

export type GoBackParams = z.infer<typeof GoBackParamsSchema>;

/**
 * Go back extracted data
 */
interface GoBackExtracted {
  previousUrl: string;
  newUrl: string;
  navigationOccurred: boolean;
}

/**
 * Go Back Tool Implementation
 */
export const goBackTool: Tool = {
  name: 'go_back',
  description:
    'Navigate back to the previous page in browser history.',
  parameters: GoBackParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as GoBackParams;
    const { waitUntil } = params;

    const previousUrl = context.page.url();

    try {
      context.logger.debug(`Navigating back (waitUntil: ${waitUntil})`);

      const response = await context.page.goBack({
        waitUntil,
        timeout: 30000,
      });

      const newUrl = context.page.url();
      const navigationOccurred = newUrl !== previousUrl;

      // response is null when there is no history entry to go back to
      if (!response && !navigationOccurred) {
        const extracted: GoBackExtracted = {
          previousUrl,
          newUrl: previousUrl,
          navigationOccurred: false,
        };

        context.logger.debug('No history entry to go back to');

        return {
          success: true,
          insights: [],
          extracted,
        };
      }

      const extracted: GoBackExtracted = {
        previousUrl,
        newUrl,
        navigationOccurred,
      };

      context.logger.debug(
        `Navigated back: ${previousUrl} → ${newUrl}`
      );

      return {
        success: true,
        insights: [],
        extracted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error(`Go back failed: ${message}`);

      return {
        success: false,
        insights: [],
        error: message,
      };
    }
  },
};

export default goBackTool;
