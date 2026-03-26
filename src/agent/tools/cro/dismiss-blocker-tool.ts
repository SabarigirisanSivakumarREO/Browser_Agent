/**
 * Dismiss Blocker Tool
 *
 * Phase 31 (P1): Browser interaction tool that dismisses cookie consent popups,
 * modals, and overlay blockers using the CookieConsentHandler.
 * Returns insights: [] (interaction tools don't analyze).
 */

import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';
import { CookieConsentHandler } from '../../../browser/cookie-handler.js';

/**
 * Parameter schema for dismiss_blocker tool
 */
export const DismissBlockerParamsSchema = z.object({
  strategy: z
    .enum(['auto', 'cookie', 'modal', 'overlay'])
    .optional()
    .default('auto'),
});

export type DismissBlockerParams = z.infer<typeof DismissBlockerParamsSchema>;

/**
 * Dismiss blocker extracted data
 */
interface DismissBlockerExtracted {
  dismissed: boolean;
  mode: string;
  buttonText?: string;
}

/**
 * Dismiss Blocker Tool Implementation
 */
export const dismissBlockerTool: Tool = {
  name: 'dismiss_blocker',
  description:
    'Dismiss cookie consent popups, modals, or overlay blockers that obstruct the page.',
  parameters: DismissBlockerParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as DismissBlockerParams;
    const { strategy } = params;

    try {
      context.logger.debug(`Dismissing blocker (strategy: ${strategy})`);

      const handler = new CookieConsentHandler();
      const result = await handler.dismiss(context.page);

      const extracted: DismissBlockerExtracted = {
        dismissed: result.dismissed,
        mode: result.mode,
      };

      if (result.buttonText) {
        extracted.buttonText = result.buttonText;
      }

      if (result.dismissed) {
        context.logger.debug(
          `Blocker dismissed via ${result.mode}${result.buttonText ? `: "${result.buttonText}"` : ''}`
        );
      } else {
        context.logger.debug('No blocker found to dismiss');
      }

      return {
        success: true,
        insights: [],
        extracted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error(`Dismiss blocker failed: ${message}`);

      return {
        success: false,
        insights: [],
        error: message,
      };
    }
  },
};

export default dismissBlockerTool;
