/**
 * LLM Input Writer - Phase 23 (T400)
 *
 * Captures and stores all inputs sent to the LLM during vision analysis
 * for debugging, auditing, and cross-referencing.
 *
 * Directory structure:
 * ./llm-inputs/{timestamp}/
 * ├── DOM-snapshots/
 * │   └── viewport-{N}.json
 * ├── Screenshots/
 * │   └── viewport-{N}.png
 * └── Prompts/
 *     ├── system-prompt.txt
 *     └── viewport-{N}-prompt.txt
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Data captured from a single viewport LLM call
 */
export interface LLMInputData {
  /** Index of the viewport in the sequence (0, 1, 2, ...) */
  viewportIndex: number;
  /** Y scroll position when captured */
  scrollPosition: number;
  /** Serialized DOM tree */
  domSnapshot: object;
  /** Raw screenshot base64 (before annotation) */
  screenshotBase64: string;
  /** System prompt text */
  systemPrompt: string;
  /** User prompt text */
  userPrompt: string;
  /** Timestamp when captured (epoch milliseconds) */
  timestamp: number;
}

/**
 * Configuration for LLMInputWriter
 */
export interface LLMInputWriterConfig {
  /** Base output directory (default: ./llm-inputs) */
  outputDir: string;
}

/**
 * Result of saving LLM inputs
 */
export interface LLMInputWriteResult {
  /** Whether all writes succeeded */
  success: boolean;
  /** Final output directory path */
  outputDir: string;
  /** Number of files written */
  filesWritten: number;
  /** Any errors encountered */
  errors: string[];
}

/**
 * Default configuration
 */
export const DEFAULT_LLM_INPUT_CONFIG: LLMInputWriterConfig = {
  outputDir: './llm-inputs',
};

/**
 * LLMInputWriter - Saves LLM inputs to disk for debugging and auditing
 */
export class LLMInputWriter {
  private readonly config: LLMInputWriterConfig;

  constructor(config?: Partial<LLMInputWriterConfig>) {
    this.config = { ...DEFAULT_LLM_INPUT_CONFIG, ...config };
  }

  /**
   * Save all LLM inputs for a session
   *
   * @param inputs - Array of LLM input data for each viewport
   * @param sessionTimestamp - ISO timestamp for the session (e.g., "2026-02-03T10-30-00")
   * @returns Result with success status, output directory, and file count
   */
  async saveAll(
    inputs: LLMInputData[],
    sessionTimestamp: string
  ): Promise<LLMInputWriteResult> {
    const errors: string[] = [];
    let filesWritten = 0;

    // Build output directory path
    const outputDir = path.join(this.config.outputDir, sessionTimestamp);

    try {
      // Create directory structure
      await this.createDirectoryStructure(outputDir);

      // Save system prompt (only once, from first input)
      if (inputs.length > 0 && inputs[0]?.systemPrompt) {
        try {
          await this.saveSystemPrompt(inputs[0].systemPrompt, outputDir);
          filesWritten++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Failed to save system prompt: ${errMsg}`);
        }
      }

      // Save each viewport's data
      for (const input of inputs) {
        // Save DOM snapshot
        try {
          await this.saveDOMSnapshot(input, outputDir);
          filesWritten++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Failed to save DOM snapshot for viewport ${input.viewportIndex}: ${errMsg}`);
        }

        // Save screenshot
        try {
          await this.saveScreenshot(input, outputDir);
          filesWritten++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Failed to save screenshot for viewport ${input.viewportIndex}: ${errMsg}`);
        }

        // Save user prompt
        try {
          await this.saveUserPrompt(input, outputDir);
          filesWritten++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Failed to save prompt for viewport ${input.viewportIndex}: ${errMsg}`);
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Failed to create directory structure: ${errMsg}`);
    }

    return {
      success: errors.length === 0,
      outputDir,
      filesWritten,
      errors,
    };
  }

  /**
   * Create the directory structure for LLM inputs
   */
  private async createDirectoryStructure(outputDir: string): Promise<void> {
    await fs.mkdir(path.join(outputDir, 'DOM-snapshots'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'Screenshots'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'Prompts'), { recursive: true });
  }

  /**
   * Save DOM snapshot as JSON
   */
  private async saveDOMSnapshot(input: LLMInputData, outputDir: string): Promise<void> {
    const filePath = path.join(
      outputDir,
      'DOM-snapshots',
      `viewport-${input.viewportIndex}.json`
    );

    // Format with metadata wrapper
    const snapshotWithMeta = {
      viewportIndex: input.viewportIndex,
      scrollPosition: input.scrollPosition,
      timestamp: input.timestamp,
      dom: input.domSnapshot,
    };

    await fs.writeFile(filePath, JSON.stringify(snapshotWithMeta, null, 2), 'utf-8');
  }

  /**
   * Save screenshot as PNG
   */
  private async saveScreenshot(input: LLMInputData, outputDir: string): Promise<void> {
    const filePath = path.join(
      outputDir,
      'Screenshots',
      `viewport-${input.viewportIndex}.png`
    );

    // Remove data URL prefix if present
    let base64Data = input.screenshotBase64;
    if (base64Data.startsWith('data:image/')) {
      base64Data = base64Data.split(',')[1] || base64Data;
    }

    // Convert base64 to buffer and write
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(filePath, buffer);
  }

  /**
   * Save system prompt (once per session)
   */
  private async saveSystemPrompt(systemPrompt: string, outputDir: string): Promise<void> {
    const filePath = path.join(outputDir, 'Prompts', 'system-prompt.txt');
    await fs.writeFile(filePath, systemPrompt, 'utf-8');
  }

  /**
   * Save user prompt for a viewport
   */
  private async saveUserPrompt(input: LLMInputData, outputDir: string): Promise<void> {
    const filePath = path.join(
      outputDir,
      'Prompts',
      `viewport-${input.viewportIndex}-prompt.txt`
    );

    // Add metadata header
    const promptWithMeta = `# Viewport ${input.viewportIndex} User Prompt
# Scroll Position: ${input.scrollPosition}px
# Timestamp: ${new Date(input.timestamp).toISOString()}

${input.userPrompt}`;

    await fs.writeFile(filePath, promptWithMeta, 'utf-8');
  }

  /**
   * Get the current configuration
   */
  getConfig(): LLMInputWriterConfig {
    return { ...this.config };
  }
}

/**
 * Factory function to create LLMInputWriter
 */
export function createLLMInputWriter(
  config?: Partial<LLMInputWriterConfig>
): LLMInputWriter {
  return new LLMInputWriter(config);
}
