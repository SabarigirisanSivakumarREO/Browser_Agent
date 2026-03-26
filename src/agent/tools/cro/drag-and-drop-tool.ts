/**
 * Drag and Drop Tool
 *
 * P3 browser interaction tool that drags one element to another by index.
 * Returns insights: [] (navigation tools don't analyze).
 */

import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';
import { findElementByIndex } from './tool-utils.js';
import { locatorFromSelector } from './tool-utils.js';

/**
 * Parameter schema for drag_and_drop tool
 */
export const DragAndDropParamsSchema = z.object({
  sourceIndex: z.coerce.number().int().nonnegative(),
  targetIndex: z.coerce.number().int().nonnegative(),
});

export type DragAndDropParams = z.infer<typeof DragAndDropParamsSchema>;

/**
 * Drag and drop extracted data
 */
interface DragAndDropExtracted {
  sourceXpath: string;
  targetXpath: string;
  sourceText: string;
  targetText: string;
}

/**
 * Drag and Drop Tool Implementation
 */
export const dragAndDropTool: Tool = {
  name: 'drag_and_drop',
  description:
    'Drag an element to another element. Useful for reordering, file drop zones, and slider interactions.',
  parameters: DragAndDropParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as DragAndDropParams;
    const { sourceIndex, targetIndex } = params;

    try {
      // No-op if source and target are the same
      if (sourceIndex === targetIndex) {
        return {
          success: true,
          insights: [],
          extracted: {
            sourceXpath: '',
            targetXpath: '',
            sourceText: '',
            targetText: '',
          } as DragAndDropExtracted,
        };
      }

      // Find source element
      const sourceElement = findElementByIndex(
        context.state.domTree.root,
        sourceIndex
      );

      if (!sourceElement) {
        return {
          success: false,
          insights: [],
          error: `Source element with index ${sourceIndex} not found`,
        };
      }

      // Find target element
      const targetElement = findElementByIndex(
        context.state.domTree.root,
        targetIndex
      );

      if (!targetElement) {
        return {
          success: false,
          insights: [],
          error: `Target element with index ${targetIndex} not found`,
        };
      }

      const sourceXpath = sourceElement.xpath;
      const targetXpath = targetElement.xpath;
      const sourceText = sourceElement.text?.trim() || '';
      const targetText = targetElement.text?.trim() || '';

      context.logger.debug(
        `Dragging element ${sourceIndex}: "${sourceText}" to element ${targetIndex}: "${targetText}"`
      );

      // Build locators
      const sourceLocator = locatorFromSelector(context.page, sourceXpath);
      const targetLocator = locatorFromSelector(context.page, targetXpath);

      // Verify both elements exist in DOM
      const sourceCount = await sourceLocator.count();
      if (sourceCount === 0) {
        return {
          success: false,
          insights: [],
          error: `Source element no longer in DOM`,
        };
      }

      const targetCount = await targetLocator.count();
      if (targetCount === 0) {
        return {
          success: false,
          insights: [],
          error: `Target element no longer in DOM`,
        };
      }

      // Perform drag and drop
      await sourceLocator.dragTo(targetLocator, { timeout: 10000 });

      const extracted: DragAndDropExtracted = {
        sourceXpath,
        targetXpath,
        sourceText,
        targetText,
      };

      context.logger.debug(
        `Dragged element ${sourceIndex} to ${targetIndex}`
      );

      return {
        success: true,
        insights: [],
        extracted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error(`Drag and drop failed: ${message}`);

      return {
        success: false,
        insights: [],
        error: message,
      };
    }
  },
};

export default dragAndDropTool;
