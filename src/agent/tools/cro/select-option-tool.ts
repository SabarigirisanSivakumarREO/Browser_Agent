import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';
import { findElementByIndex } from './tool-utils.js';
import { locatorFromSelector } from './tool-utils.js';

const ELEMENT_ACTION_TIMEOUT = 10000;

export const SelectOptionParamsSchema = z.object({
  elementIndex: z.coerce.number().int().nonnegative().describe('Index of the <select> element in the DOM tree'),
  value: z.string().optional().describe('Option value attribute to select'),
  label: z.string().optional().describe('Option visible text to select'),
}).refine(d => d.value || d.label, {
  message: 'Either value or label is required',
});

export type SelectOptionParams = z.infer<typeof SelectOptionParamsSchema>;

interface SelectOptionExtracted {
  selectedValue: string | null;
  selectedLabel: string | null;
  elementXpath: string;
}

export const selectOptionTool: Tool = {
  name: 'select_option',
  description: 'Select a dropdown option by value or label text. The element must be a <select> element.',
  parameters: SelectOptionParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as SelectOptionParams;
    const { elementIndex, value, label } = params;

    try {
      const element = findElementByIndex(context.state.domTree.root, elementIndex);

      if (!element) {
        return {
          success: false,
          insights: [],
          error: `Element with index ${elementIndex} not found`,
        };
      }

      if (element.tagName.toLowerCase() !== 'select') {
        return {
          success: false,
          insights: [],
          error: `Element is not a <select> (found <${element.tagName.toLowerCase()}>)`,
        };
      }

      const locator = locatorFromSelector(context.page, element.xpath);

      let selectedValues: string[];
      if (value) {
        selectedValues = await locator.selectOption({ value }, { timeout: ELEMENT_ACTION_TIMEOUT });
      } else {
        selectedValues = await locator.selectOption({ label: label! }, { timeout: ELEMENT_ACTION_TIMEOUT });
      }

      const extracted: SelectOptionExtracted = {
        selectedValue: selectedValues[0] ?? null,
        selectedLabel: label ?? null,
        elementXpath: element.xpath,
      };

      return { success: true, insights: [], extracted };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error(`select_option failed: ${message}`);
      return { success: false, insights: [], error: message };
    }
  },
};

export default selectOptionTool;
