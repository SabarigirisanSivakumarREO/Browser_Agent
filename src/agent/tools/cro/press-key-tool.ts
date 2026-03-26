/**
 * Press Key Tool
 *
 * Navigation tool that presses a keyboard key or key combination.
 * Returns insights: [] (navigation tools don't analyze).
 */

import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';
import { waitForPossibleNavigation } from './tool-utils.js';

/**
 * Parameter schema for press_key tool
 */
export const PressKeyParamsSchema = z.object({
  key: z.string().min(1).describe('Key to press. Examples: "Enter", "Escape", "Tab", "ArrowDown", "Control+a", "Shift+Enter", "Meta+c"'),
});

export type PressKeyParams = z.infer<typeof PressKeyParamsSchema>;

/**
 * Press key extracted data
 */
interface PressKeyExtracted {
  keyPressed: string;
  navigated: boolean;
}

/** Keys that commonly trigger form submission or navigation */
const NAVIGATION_KEYS = new Set(['Enter']);

/**
 * Press Key Tool Implementation
 */
export const pressKeyTool: Tool = {
  name: 'press_key',
  description:
    'Press a keyboard key or key combination. Supports single keys (Enter, Escape, Tab, ArrowDown) and modifier combos (Control+a, Shift+Enter, Meta+c).',
  parameters: PressKeyParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as PressKeyParams;
    const { key } = params;

    try {
      const previousUrl = context.page.url();
      await context.page.keyboard.press(key);

      // Wait for navigation if a navigation-triggering key was pressed
      let navigated = false;
      const baseKey = key.split('+').pop() ?? key;
      if (NAVIGATION_KEYS.has(baseKey)) {
        const navResult = await waitForPossibleNavigation(context.page, previousUrl, 5000);
        navigated = navResult.navigated;
      }

      const extracted: PressKeyExtracted = { keyPressed: key, navigated };

      context.logger.debug(`Pressed key: "${key}", navigated: ${navigated}`);

      return {
        success: true,
        insights: [],
        extracted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error(`press_key failed: ${message}`);

      return {
        success: false,
        insights: [],
        error: message,
      };
    }
  },
};

export default pressKeyTool;
