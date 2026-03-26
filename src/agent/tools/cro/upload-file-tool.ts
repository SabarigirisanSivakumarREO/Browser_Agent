/**
 * Upload File Tool
 *
 * Browser interaction tool that uploads files to a file input element.
 * Returns insights: [] (interaction tools don't analyze).
 */

import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';
import { findElementByIndex } from './tool-utils.js';
import { locatorFromSelector } from './tool-utils.js';

/**
 * Parameter schema for upload file tool
 */
export const UploadFileParamsSchema = z.object({
  elementIndex: z.coerce.number().int().nonnegative(),
  filePaths: z.array(z.string()).min(1),
});

export type UploadFileParams = z.infer<typeof UploadFileParamsSchema>;

/**
 * Upload file extracted data
 */
interface UploadFileExtracted {
  uploadedFiles: string[];
  elementXpath: string;
}

/**
 * Upload File Tool Implementation
 */
export const uploadFileTool: Tool = {
  name: 'upload_file',
  description:
    'Upload one or more files to a file input element by index. The element must be an <input type="file">.',
  parameters: UploadFileParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as UploadFileParams;
    const { elementIndex, filePaths } = params;

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

      // Verify it's a file input
      const tagName = element.tagName?.toUpperCase();
      const inputType = element.attributes?.type?.toLowerCase();

      if (tagName !== 'INPUT' || inputType !== 'file') {
        return {
          success: false,
          insights: [],
          error: `Element ${elementIndex} is not a file input (found <${element.tagName} type="${element.attributes?.type || 'unknown'}">)`,
        };
      }

      const xpath = element.xpath;
      const locator = locatorFromSelector(context.page, xpath);

      await locator.setInputFiles(filePaths, { timeout: 10000 });

      const extracted: UploadFileExtracted = {
        uploadedFiles: filePaths,
        elementXpath: xpath,
      };

      context.logger.debug(
        `Uploaded ${filePaths.length} file(s) to element ${elementIndex}`
      );

      return {
        success: true,
        insights: [],
        extracted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error(`Upload file failed: ${message}`);

      return {
        success: false,
        insights: [],
        error: message,
      };
    }
  },
};

export default uploadFileTool;
