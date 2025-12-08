/**
 * Tool Result Formatter
 *
 * Phase 15b (T077b): Formats tool execution results for console output.
 */

import type { ToolResult, CROInsight, Severity } from '../models/index.js';

/**
 * Result of tool execution for display
 */
export interface ToolExecutionResult {
  url: string;
  toolName: string;
  success: boolean;
  error?: string;
  result?: ToolResult;
  loadTimeMs?: number;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '\x1b[31m', // Red
  high: '\x1b[33m',     // Yellow
  medium: '\x1b[36m',   // Cyan
  low: '\x1b[37m',      // White
};

const RESET = '\x1b[0m';

/**
 * Formats tool execution results for console output.
 */
export class ToolResultFormatter {
  private readonly width: number;
  private readonly separator: string;
  private readonly useColors: boolean;

  constructor(options: { width?: number; useColors?: boolean } = {}) {
    this.width = options.width ?? 80;
    this.separator = '='.repeat(this.width);
    this.useColors = options.useColors ?? process.stdout.isTTY ?? false;
  }

  /**
   * Format tool execution result for display
   */
  format(result: ToolExecutionResult): string {
    const lines: string[] = [];

    // Header
    lines.push(this.separator);
    lines.push(this.center(`TOOL: ${result.toolName.toUpperCase()}`));
    lines.push(this.separator);

    // URL and Status
    lines.push(`URL: ${result.url}`);
    lines.push(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);

    if (result.loadTimeMs !== undefined) {
      lines.push(`Load Time: ${(result.loadTimeMs / 1000).toFixed(2)}s`);
    }

    if (result.result?.executionTimeMs !== undefined) {
      lines.push(`Tool Execution: ${result.result.executionTimeMs.toFixed(0)}ms`);
    }

    // Error case
    if (!result.success) {
      lines.push('');
      const error = result.error || result.result?.error || 'Unknown error';
      lines.push(`ERROR: ${error}`);
      lines.push(this.separator);
      return lines.join('\n');
    }

    // Tool result data
    if (result.result) {
      lines.push('');
      lines.push(this.formatToolResult(result.result));
    }

    lines.push(this.separator);
    return lines.join('\n');
  }

  /**
   * Format the ToolResult content
   */
  private formatToolResult(result: ToolResult): string {
    const lines: string[] = [];

    // Insights
    lines.push(`INSIGHTS FOUND: ${result.insights.length}`);
    lines.push('');

    if (result.insights.length === 0) {
      lines.push('  (no insights generated)');
    } else {
      // Group by severity
      const bySeverity = this.groupBySeverity(result.insights);

      for (const severity of ['critical', 'high', 'medium', 'low'] as Severity[]) {
        const insights = bySeverity[severity];
        if (insights.length === 0) continue;

        const label = severity.toUpperCase();
        const colorStart = this.useColors ? SEVERITY_COLORS[severity] : '';
        const colorEnd = this.useColors ? RESET : '';

        lines.push(`${colorStart}[${label}] (${insights.length})${colorEnd}`);

        for (const insight of insights) {
          lines.push(this.formatInsight(insight, colorStart, colorEnd));
        }
        lines.push('');
      }
    }

    // Extracted data (if present)
    if (result.extracted !== undefined) {
      lines.push('EXTRACTED DATA:');
      const extracted = typeof result.extracted === 'string'
        ? result.extracted
        : JSON.stringify(result.extracted, null, 2);

      // Truncate if too long
      const maxLength = 500;
      if (extracted.length > maxLength) {
        lines.push(`  ${extracted.slice(0, maxLength)}...`);
        lines.push(`  (${extracted.length - maxLength} more characters)`);
      } else {
        for (const line of extracted.split('\n')) {
          lines.push(`  ${line}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Format a single insight for display
   */
  private formatInsight(insight: CROInsight, colorStart: string, colorEnd: string): string {
    const lines: string[] = [];

    // Issue
    lines.push(`  ${colorStart}Issue:${colorEnd} ${insight.issue}`);

    // Element (if present)
    if (insight.element) {
      lines.push(`  Element: ${this.truncate(insight.element, this.width - 12)}`);
    }

    // Recommendation
    lines.push(`  ${colorStart}Fix:${colorEnd} ${insight.recommendation}`);

    // Evidence (if present)
    if (insight.evidence) {
      if (insight.evidence.text) {
        lines.push(`  Evidence: "${this.truncate(insight.evidence.text, 50)}"`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Group insights by severity
   */
  private groupBySeverity(insights: CROInsight[]): Record<Severity, CROInsight[]> {
    const groups: Record<Severity, CROInsight[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };

    for (const insight of insights) {
      groups[insight.severity].push(insight);
    }

    return groups;
  }

  /**
   * Center text within width
   */
  private center(text: string): string {
    const padding = Math.max(0, this.width - text.length);
    const left = Math.floor(padding / 2);
    return ' '.repeat(left) + text;
  }

  /**
   * Truncate text to max length
   */
  private truncate(text: string, maxLen: number): string {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= maxLen) return cleaned;
    return cleaned.slice(0, maxLen - 3) + '...';
  }
}
