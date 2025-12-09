/**
 * File Writer - Phase 18-CLI (T119a)
 *
 * Writes report content to files with directory creation and error handling.
 */

import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createLogger } from '../utils/index.js';

/**
 * Result of a file write operation
 */
export interface FileWriteResult {
  success: boolean;
  path: string;
  error?: string;
  overwrote?: boolean;
}

/**
 * Options for FileWriter
 */
export interface FileWriterOptions {
  /** Create parent directories if they don't exist (default: true) */
  createDirectories?: boolean;
  /** Show warning when overwriting (default: true) */
  warnOnOverwrite?: boolean;
}

/**
 * Writes content to files with proper error handling
 */
export class FileWriter {
  private readonly logger = createLogger('FileWriter');
  private readonly createDirectories: boolean;
  private readonly warnOnOverwrite: boolean;

  constructor(options: FileWriterOptions = {}) {
    this.createDirectories = options.createDirectories ?? true;
    this.warnOnOverwrite = options.warnOnOverwrite ?? true;
  }

  /**
   * Write content to a file
   * @param content - Content to write
   * @param path - File path to write to
   * @returns Result with success/error status
   */
  async write(content: string, path: string): Promise<FileWriteResult> {
    this.logger.info('Writing file', { path });

    try {
      // Check if file exists
      let overwrote = false;
      try {
        await access(path);
        overwrote = true;
        if (this.warnOnOverwrite) {
          this.logger.warn('Overwriting existing file', { path });
        }
      } catch {
        // File doesn't exist, that's fine
      }

      // Create parent directories if needed
      if (this.createDirectories) {
        const dir = dirname(path);
        if (dir && dir !== '.') {
          await mkdir(dir, { recursive: true });
        }
      }

      // Write the file
      await writeFile(path, content, 'utf-8');

      this.logger.info('File written successfully', { path, overwrote });

      return {
        success: true,
        path,
        overwrote,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error('Failed to write file', { path, error });

      return {
        success: false,
        path,
        error,
      };
    }
  }
}
