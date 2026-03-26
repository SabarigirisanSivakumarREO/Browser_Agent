/**
 * Type Text Tool
 *
 * Navigation tool that types text into an input field by element index.
 * Returns insights: [] (navigation tools don't analyze).
 */

import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';
import { findElementByIndex, coerceBoolean, locatorFromSelector } from './tool-utils.js';

const ELEMENT_ACTION_TIMEOUT = 10000;

/**
 * Parameter schema for type_text tool
 */
export const TypeTextParamsSchema = z.object({
  elementIndex: z.coerce.number().int().nonnegative(),
  text: z.string().min(1),
  clearFirst: coerceBoolean.optional().default(true),
});

export type TypeTextParams = z.infer<typeof TypeTextParamsSchema>;

/**
 * Type text extracted data
 */
interface TypeTextExtracted {
  typedText: string;
  elementXpath: string;
  elementTag: string;
  cleared: boolean;
}

/**
 * Type Text Tool Implementation
 */
export const typeTextTool: Tool = {
  name: 'type_text',
  description:
    'Type text into an input field, textarea, or contenteditable element by its index from the DOM tree. Use clearFirst: true (default) to clear existing text before typing.',
  parameters: TypeTextParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as TypeTextParams;
    const { elementIndex, text, clearFirst } = params;

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

      // Verify element is an input-like element
      const tag = element.tagName.toLowerCase();
      const isContentEditable = element.attributes?.contenteditable === 'true';
      if (!['input', 'textarea'].includes(tag) && !isContentEditable) {
        return {
          success: false,
          insights: [],
          error: `Element is not an input field (found <${tag}>)`,
        };
      }

      const xpath = element.xpath;

      context.logger.debug(
        `Typing into element ${elementIndex}: <${tag}> (${xpath})`
      );

      // Locate element by xpath
      const locator = locatorFromSelector(context.page, xpath);

      if (clearFirst) {
        await locator.clear({ timeout: ELEMENT_ACTION_TIMEOUT });
      }

      await locator.fill(text, { timeout: ELEMENT_ACTION_TIMEOUT });

      const extracted: TypeTextExtracted = {
        typedText: text,
        elementXpath: xpath,
        elementTag: tag,
        cleared: clearFirst,
      };

      context.logger.debug(
        `Typed "${text}" into <${tag}> (cleared: ${clearFirst})`
      );

      return {
        success: true,
        insights: [],
        extracted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error(`type_text failed: ${message}`);

      return {
        success: false,
        insights: [],
        error: message,
      };
    }
  },
};

export default typeTextTool;
