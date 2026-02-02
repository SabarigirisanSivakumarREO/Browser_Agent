/**
 * Screenshot Writer - Phase 21h (T358)
 *
 * Saves viewport screenshots to disk for evidence capture.
 * Used when --save-evidence CLI flag is provided.
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { createLogger } from '../utils/index.js';

const logger = createLogger('ScreenshotWriter');

/**
 * Options for saving screenshots
 */
export interface ScreenshotWriteOptions {
  /** Output directory for screenshots (default: ./evidence) */
  outputDir: string;
  /** Filename prefix (default: viewport) */
  prefix: string;
  /** Image format (default: png) */
  format: 'png' | 'jpeg';
  /** Include timestamp in filename (default: true) */
  includeTimestamp: boolean;
}

/**
 * Default options for screenshot writing
 */
export const DEFAULT_SCREENSHOT_WRITE_OPTIONS: ScreenshotWriteOptions = {
  outputDir: './evidence',
  prefix: 'viewport',
  format: 'png',
  includeTimestamp: true,
};

/**
 * Result from saving a screenshot
 */
export interface ScreenshotWriteResult {
  /** Whether the write was successful */
  success: boolean;
  /** Full path to the saved file */
  path?: string;
  /** Filename only (without directory) */
  filename?: string;
  /** Error message if write failed */
  error?: string;
}

/**
 * Result from saving all viewport screenshots
 */
export interface AllViewportsWriteResult {
  /** Total number of screenshots attempted */
  total: number;
  /** Number of successful writes */
  successful: number;
  /** Number of failed writes */
  failed: number;
  /** Results for each screenshot */
  results: ScreenshotWriteResult[];
  /** Directory where screenshots were saved */
  outputDir: string;
}

/**
 * Screenshot data from a viewport snapshot
 */
export interface ViewportScreenshotData {
  /** Base64 encoded image data */
  base64: string;
  /** Viewport index (0-indexed) */
  viewportIndex: number;
  /** Optional scroll position */
  scrollPosition?: number;
}

/**
 * Writes screenshots to disk for evidence capture
 */
export class ScreenshotWriter {
  private options: ScreenshotWriteOptions;

  constructor(options: Partial<ScreenshotWriteOptions> = {}) {
    this.options = { ...DEFAULT_SCREENSHOT_WRITE_OPTIONS, ...options };
  }

  /**
   * Save a single screenshot to disk
   *
   * @param base64Data - Base64 encoded image data
   * @param filename - Optional custom filename (otherwise auto-generated)
   * @returns Write result with path or error
   */
  async saveScreenshot(
    base64Data: string,
    filename?: string
  ): Promise<ScreenshotWriteResult> {
    try {
      // Ensure output directory exists
      await this.ensureDirectory(this.options.outputDir);

      // Generate filename if not provided
      const actualFilename = filename ?? this.generateFilename();

      // Build full path
      const fullPath = join(this.options.outputDir, actualFilename);

      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');

      // Write file
      await writeFile(fullPath, buffer);

      logger.debug('Screenshot saved', { path: fullPath, size: buffer.length });

      return {
        success: true,
        path: fullPath,
        filename: actualFilename,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to save screenshot', { error: message });

      return {
        success: false,
        error: `Failed to save screenshot: ${message}`,
      };
    }
  }

  /**
   * Save all viewport screenshots from an analysis
   *
   * @param screenshots - Array of viewport screenshot data
   * @param sessionId - Optional session ID for filename uniqueness
   * @returns Results for all screenshots
   */
  async saveAllViewportScreenshots(
    screenshots: ViewportScreenshotData[],
    sessionId?: string
  ): Promise<AllViewportsWriteResult> {
    const results: ScreenshotWriteResult[] = [];
    let successful = 0;
    let failed = 0;

    // Ensure output directory exists
    await this.ensureDirectory(this.options.outputDir);

    for (const screenshot of screenshots) {
      const filename = this.generateViewportFilename(
        screenshot.viewportIndex,
        sessionId,
        screenshot.scrollPosition
      );

      const result = await this.saveScreenshot(screenshot.base64, filename);
      results.push(result);

      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    logger.info('All viewport screenshots saved', {
      total: screenshots.length,
      successful,
      failed,
      outputDir: this.options.outputDir,
    });

    return {
      total: screenshots.length,
      successful,
      failed,
      results,
      outputDir: this.options.outputDir,
    };
  }

  /**
   * Get the output directory
   */
  getOutputDir(): string {
    return this.options.outputDir;
  }

  /**
   * Generate a filename for a screenshot
   */
  private generateFilename(): string {
    const parts = [this.options.prefix];

    if (this.options.includeTimestamp) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      parts.push(timestamp);
    }

    return `${parts.join('_')}.${this.options.format}`;
  }

  /**
   * Generate a filename for a viewport screenshot
   */
  private generateViewportFilename(
    viewportIndex: number,
    sessionId?: string,
    scrollPosition?: number
  ): string {
    const parts = [this.options.prefix];

    if (sessionId) {
      parts.push(sessionId);
    }

    parts.push(`v${viewportIndex.toString().padStart(2, '0')}`);

    if (scrollPosition !== undefined) {
      parts.push(`y${scrollPosition}`);
    }

    if (this.options.includeTimestamp) {
      const timestamp = Date.now().toString();
      parts.push(timestamp);
    }

    return `${parts.join('_')}.${this.options.format}`;
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  private async ensureDirectory(dir: string): Promise<void> {
    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      // Ignore EEXIST errors (directory already exists)
      if (error instanceof Error && 'code' in error && error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
}

/**
 * Factory function to create a ScreenshotWriter
 */
export function createScreenshotWriter(
  options?: Partial<ScreenshotWriteOptions>
): ScreenshotWriter {
  return new ScreenshotWriter(options);
}
