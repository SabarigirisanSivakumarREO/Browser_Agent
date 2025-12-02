/**
 * Result Formatter
 * Formats extraction results for console output per FR-006.
 */

import type { AgentResult, BatchResult } from '../types/index.js';

/**
 * Box-drawing characters for visual formatting.
 */
const BOX = {
  TOP_LEFT: '┌',
  TOP_RIGHT: '┐',
  BOTTOM_LEFT: '└',
  BOTTOM_RIGHT: '┘',
  HORIZONTAL: '─',
  VERTICAL: '│',
  T_RIGHT: '├',
  T_LEFT: '┤',
} as const;

/**
 * Creates a horizontal line with specified width.
 */
function horizontalLine(width: number, left: string, right: string): string {
  return left + BOX.HORIZONTAL.repeat(width - 2) + right;
}

/**
 * Formats results for console output.
 * Creates visually structured output with box-drawing characters.
 */
export class ResultFormatter {
  private readonly width: number;

  /**
   * Creates a new ResultFormatter instance.
   * @param width - Width of the output box (default: 80)
   */
  constructor(width = 80) {
    this.width = width;
  }

  /**
   * Formats a single URL processing result.
   * @param result - The AgentResult to format
   * @returns Formatted string for console output
   */
  formatResult(result: AgentResult): string {
    const lines: string[] = [];
    const innerWidth = this.width - 2;

    // Header
    lines.push(horizontalLine(this.width, BOX.TOP_LEFT, BOX.TOP_RIGHT));
    lines.push(this.centeredLine('BROWSER AGENT RESULTS', innerWidth));
    lines.push(horizontalLine(this.width, BOX.T_RIGHT, BOX.T_LEFT));

    // URL and Status
    lines.push(this.leftLine(`URL: ${result.url}`, innerWidth));
    lines.push(this.leftLine(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`, innerWidth));

    if (result.pageLoad.loadTimeMs !== undefined) {
      lines.push(this.leftLine(`Load Time: ${(result.pageLoad.loadTimeMs / 1000).toFixed(2)}s`, innerWidth));
    }

    // Error section (if failed)
    if (!result.success && result.error) {
      lines.push(horizontalLine(this.width, BOX.T_RIGHT, BOX.T_LEFT));
      lines.push(this.leftLine(`ERROR (${result.errorStage || 'unknown'}):`, innerWidth));
      lines.push(this.leftLine(`  ${result.error}`, innerWidth));
    }

    // Extraction results (if available)
    if (result.extraction) {
      lines.push(horizontalLine(this.width, BOX.T_RIGHT, BOX.T_LEFT));
      lines.push(this.leftLine(`HEADINGS FOUND: ${result.extraction.totalCount}`, innerWidth));

      // Count by level
      const levels = Object.entries(result.extraction.countByLevel)
        .sort(([a], [b]) => parseInt(a) - parseInt(b));

      for (const [level, count] of levels) {
        lines.push(this.leftLine(`  h${level}: ${count}`, innerWidth));
      }

      // Extracted headings (limited to first 10)
      if (result.extraction.headings.length > 0) {
        lines.push('');
        lines.push(this.leftLine('EXTRACTED HEADINGS:', innerWidth));

        const displayHeadings = result.extraction.headings.slice(0, 10);
        for (const heading of displayHeadings) {
          const truncatedText = this.truncate(heading.text, innerWidth - 10);
          lines.push(this.leftLine(`  [h${heading.level}] ${truncatedText}`, innerWidth));
        }

        if (result.extraction.headings.length > 10) {
          lines.push(this.leftLine(
            `  ... and ${result.extraction.headings.length - 10} more`,
            innerWidth
          ));
        }
      }
    }

    // LangChain insights (if available)
    if (result.processing) {
      lines.push(horizontalLine(this.width, BOX.T_RIGHT, BOX.T_LEFT));
      lines.push(this.leftLine('LANGCHAIN INSIGHTS:', innerWidth));
      lines.push('');

      // Summary
      lines.push(this.leftLine(`Summary: ${result.processing.summary}`, innerWidth));
      lines.push('');

      // Categories
      if (result.processing.categories.length > 0) {
        lines.push(this.leftLine(
          `Categories: [${result.processing.categories.join(', ')}]`,
          innerWidth
        ));
        lines.push('');
      }

      // Insights
      if (result.processing.insights.length > 0) {
        lines.push(this.leftLine('Insights:', innerWidth));
        for (const insight of result.processing.insights) {
          lines.push(this.leftLine(`  - ${insight}`, innerWidth));
        }
      }
    }

    // Footer
    lines.push(horizontalLine(this.width, BOX.BOTTOM_LEFT, BOX.BOTTOM_RIGHT));

    return lines.join('\n');
  }

  /**
   * Formats multiple URL processing results.
   * @param batch - The BatchResult to format
   * @returns Formatted string for console output
   */
  formatBatch(batch: BatchResult): string {
    const lines: string[] = [];

    // Batch header
    lines.push('');
    lines.push('═'.repeat(this.width));
    lines.push(this.centeredLine('BATCH PROCESSING RESULTS', this.width));
    lines.push(`Total URLs: ${batch.results.length} | Success: ${batch.successCount} | Failed: ${batch.failureCount}`);
    lines.push(`Total Time: ${(batch.totalTimeMs / 1000).toFixed(2)}s`);
    lines.push('═'.repeat(this.width));
    lines.push('');

    // Individual results
    for (let i = 0; i < batch.results.length; i++) {
      const result = batch.results[i];
      if (result) {
        lines.push(`[${i + 1}/${batch.results.length}]`);
        lines.push(this.formatResult(result));
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Formats an error message with context.
   * @param error - Error message
   * @param stage - Stage where error occurred
   * @returns Formatted error string
   */
  formatError(error: string, stage: string): string {
    const lines: string[] = [];
    const contentWidth = this.width - 2;

    lines.push(horizontalLine(this.width, BOX.TOP_LEFT, BOX.TOP_RIGHT));
    lines.push(this.centeredLine('ERROR', contentWidth));
    lines.push(horizontalLine(this.width, BOX.T_RIGHT, BOX.T_LEFT));
    lines.push(this.leftLine(`Stage: ${stage}`, contentWidth));
    lines.push(this.leftLine(`Error: ${error}`, contentWidth));
    lines.push(horizontalLine(this.width, BOX.BOTTOM_LEFT, BOX.BOTTOM_RIGHT));

    return lines.join('\n');
  }

  /**
   * Creates a centered line within the box.
   */
  private centeredLine(text: string, width: number): string {
    const padding = Math.max(0, width - text.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return BOX.VERTICAL + ' '.repeat(leftPad) + text + ' '.repeat(rightPad) + BOX.VERTICAL;
  }

  /**
   * Creates a left-aligned line within the box.
   */
  private leftLine(text: string, width: number): string {
    const truncated = this.truncate(text, width);
    const padding = Math.max(0, width - truncated.length);
    return BOX.VERTICAL + truncated + ' '.repeat(padding) + BOX.VERTICAL;
  }

  /**
   * Truncates text to fit within specified width.
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }
}
