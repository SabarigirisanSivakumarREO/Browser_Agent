import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';

const ELEMENT_ACTION_TIMEOUT = 10000;

export const ExtractTextParamsSchema = z.object({
  selector: z.string().optional().describe('CSS selector to extract text from. If omitted, extracts full page body text.'),
  maxLength: z.coerce.number().positive().optional().default(8000).describe('Maximum characters to return (default: 8000)'),
});

export type ExtractTextParams = z.infer<typeof ExtractTextParamsSchema>;

interface ExtractTextExtracted {
  text: string;
  length: number;
  truncated: boolean;
  selector: string;
}

export const extractTextTool: Tool = {
  name: 'extract_text',
  description: 'Extract visible text content from the page. Optionally target a specific CSS selector. Returns truncated text within maxLength budget.',
  parameters: ExtractTextParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as ExtractTextParams;
    const { selector, maxLength } = params;

    try {
      let rawText: string;
      const targetSelector = selector || 'body';

      rawText = await context.page.locator(targetSelector).first().innerText({
        timeout: ELEMENT_ACTION_TIMEOUT,
      });

      const fullLength = rawText.length;
      let truncated = false;

      if (rawText.length > maxLength) {
        rawText = rawText.slice(0, maxLength) + `\n[...truncated, showing first ${maxLength} of ${fullLength} chars]`;
        truncated = true;
      }

      const extracted: ExtractTextExtracted = {
        text: rawText,
        length: fullLength,
        truncated,
        selector: targetSelector,
      };

      return { success: true, insights: [], extracted };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error(`extract_text failed: ${message}`);
      return { success: false, insights: [], error: message };
    }
  },
};

export default extractTextTool;
