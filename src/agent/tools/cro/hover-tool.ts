/**
 * Hover Tool
 *
 * Phase 31 (P1): Browser interaction tool that hovers over an element by index.
 * Useful for revealing dropdowns, tooltips, and hover-dependent UI.
 * Returns insights: [] (interaction tools don't analyze).
 */

import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';
import { findElementByIndex } from './tool-utils.js';
import { locatorFromSelector } from './tool-utils.js';

/**
 * Parameter schema for hover tool
 */
export const HoverParamsSchema = z.object({
  elementIndex: z.coerce.number().int().nonnegative(),
});

export type HoverParams = z.infer<typeof HoverParamsSchema>;

/**
 * Hover extracted data
 */
interface HoverExtracted {
  hoveredXpath: string;
  elementText: string;
  elementTag: string;
}

/**
 * Hover Tool Implementation
 */
export const hoverTool: Tool = {
  name: 'hover',
  description:
    'Hover over an element by its index to reveal dropdowns, tooltips, or other hover-dependent UI.',
  parameters: HoverParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as HoverParams;
    const { elementIndex } = params;

    try {
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
      const elementTag = element.tagName || '';

      context.logger.debug(
        `Hovering element ${elementIndex}: "${elementText}" (${xpath})`
      );

      const locator = locatorFromSelector(context.page, xpath);

      const count = await locator.count();
      if (count === 0) {
        return {
          success: false,
          insights: [],
          error: `Element no longer in DOM`,
        };
      }

      await locator.hover({ timeout: 10000 });

      const extracted: HoverExtracted = {
        hoveredXpath: xpath,
        elementText,
        elementTag,
      };

      context.logger.debug(`Hovered element ${elementIndex}`);

      return {
        success: true,
        insights: [],
        extracted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error(`Hover failed: ${message}`);

      return {
        success: false,
        insights: [],
        error: message,
      };
    }
  },
};

export default hoverTool;
