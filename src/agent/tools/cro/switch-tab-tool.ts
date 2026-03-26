/**
 * Switch Tab Tool
 *
 * Browser interaction tool that switches to a different tab by index.
 * Returns insights: [] (navigation tools don't analyze).
 */

import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';

/**
 * Parameter schema for switch tab tool
 */
export const SwitchTabParamsSchema = z.object({
  tabIndex: z.coerce.number().int().nonnegative(),
});

export type SwitchTabParams = z.infer<typeof SwitchTabParamsSchema>;

/**
 * Switch tab extracted data
 */
interface SwitchTabExtracted {
  previousUrl: string;
  newUrl: string;
  newTitle: string;
  tabIndex: number;
  totalTabs: number;
}

/**
 * Switch Tab Tool Implementation
 */
export const switchTabTool: Tool = {
  name: 'switch_tab',
  description:
    'Switch to a different browser tab by index. Use to handle popups, target="_blank" links, and multi-tab flows.',
  parameters: SwitchTabParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as SwitchTabParams;
    const { tabIndex } = params;

    try {
      const previousUrl = context.page.url();
      const pages = context.page.context().pages();
      const totalTabs = pages.length;

      if (tabIndex >= totalTabs) {
        return {
          success: false,
          insights: [],
          error: `Tab index ${tabIndex} out of bounds. Available tabs: ${totalTabs} (indices 0-${totalTabs - 1})`,
          extracted: { availableTabs: totalTabs },
        };
      }

      const targetPage = pages[tabIndex]!;
      await targetPage.bringToFront();

      const newUrl = targetPage.url();
      const newTitle = await targetPage.title();

      const extracted: SwitchTabExtracted = {
        previousUrl,
        newUrl,
        newTitle,
        tabIndex,
        totalTabs,
      };

      context.logger.debug(
        `Switched to tab ${tabIndex}: "${newTitle}" (${newUrl})`
      );

      return {
        success: true,
        insights: [],
        extracted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error(`Switch tab failed: ${message}`);

      return {
        success: false,
        insights: [],
        error: message,
      };
    }
  },
};

export default switchTabTool;
