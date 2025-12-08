/**
 * Agent Progress Formatter
 *
 * Phase 16-CLI (T089): Formats CRO agent analysis progress and results for console output.
 */

import type { CROAnalysisResult } from '../agent/cro-agent.js';
import type { CROInsight, Severity } from '../models/index.js';

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '\x1b[31m', // Red
  high: '\x1b[33m',     // Yellow
  medium: '\x1b[36m',   // Cyan
  low: '\x1b[37m',      // White
};

const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  CYAN: '\x1b[36m',
  DIM: '\x1b[2m',
  BOLD: '\x1b[1m',
  RESET: '\x1b[0m',
};

/**
 * Options for AgentProgressFormatter
 */
export interface AgentProgressFormatterOptions {
  /** Display width (default: 80) */
  width?: number;
  /** Use ANSI colors (default: auto-detect TTY) */
  useColors?: boolean;
}

/**
 * Formats CRO agent analysis progress and results for console output.
 */
export class AgentProgressFormatter {
  private readonly width: number;
  private readonly separator: string;
  private readonly useColors: boolean;

  constructor(options: AgentProgressFormatterOptions = {}) {
    this.width = options.width ?? 80;
    this.separator = '='.repeat(this.width);
    this.useColors = options.useColors ?? false;
  }

  /**
   * Format analysis start message
   */
  formatAnalysisStart(url: string, maxSteps: number): string {
    const lines: string[] = [];

    lines.push('');
    lines.push(this.separator);
    lines.push(this.center('CRO AGENT ANALYSIS'));
    lines.push(this.separator);
    lines.push(`URL: ${url}`);
    lines.push(`Max Steps: ${maxSteps}`);
    lines.push(this.separator);
    lines.push('');
    lines.push(this.color('Starting analysis...', COLORS.DIM));
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Format step start (for real-time progress if needed)
   */
  formatStepStart(stepNumber: number, maxSteps: number, focus: string): string {
    const progress = `[${stepNumber}/${maxSteps}]`;
    const focusText = focus ? ` Focus: ${this.truncate(focus, 50)}` : '';
    return `${this.color(progress, COLORS.CYAN)}${focusText}`;
  }

  /**
   * Format step completion
   */
  formatStepComplete(
    stepNumber: number,
    action: string,
    insightsFound: number,
    durationMs: number
  ): string {
    const lines: string[] = [];

    const stepLabel = `Step ${stepNumber}:`;
    const actionText = action.replace(/_/g, ' ');
    const timing = `${durationMs.toFixed(0)}ms`;
    const insights = insightsFound > 0
      ? this.color(`+${insightsFound} insight${insightsFound > 1 ? 's' : ''}`, COLORS.GREEN)
      : '';

    lines.push(`  ${stepLabel} ${actionText} ${this.color(`(${timing})`, COLORS.DIM)} ${insights}`);

    return lines.join('\n');
  }

  /**
   * Format complete analysis result
   */
  formatAnalysisResult(result: CROAnalysisResult): string {
    const lines: string[] = [];

    // Header
    lines.push('');
    lines.push(this.separator);
    lines.push(this.center('CRO ANALYSIS RESULTS'));
    lines.push(this.separator);

    // URL and Status
    lines.push(`URL: ${result.url}`);
    if (result.pageTitle) {
      lines.push(`Title: ${this.truncate(result.pageTitle, this.width - 10)}`);
    }
    lines.push(`Status: ${result.success ? this.color('SUCCESS', COLORS.GREEN) : this.color('FAILED', COLORS.RED)}`);
    lines.push(`Steps Executed: ${result.stepsExecuted}`);
    lines.push(`Total Time: ${(result.totalTimeMs / 1000).toFixed(2)}s`);
    lines.push(`Termination: ${result.terminationReason}`);

    // Errors (if any)
    if (result.errors.length > 0) {
      lines.push('');
      lines.push(this.color('ERRORS:', COLORS.RED));
      for (const error of result.errors.slice(0, 5)) {
        lines.push(`  - ${this.truncate(error, this.width - 6)}`);
      }
      if (result.errors.length > 5) {
        lines.push(`  ... and ${result.errors.length - 5} more errors`);
      }
    }

    // Insights
    lines.push('');
    lines.push(this.separator.replace(/=/g, '-'));
    lines.push(`INSIGHTS FOUND: ${result.insights.length}`);
    lines.push(this.separator.replace(/=/g, '-'));

    if (result.insights.length === 0) {
      lines.push('');
      lines.push('  (no insights generated)');
    } else {
      // Group by severity
      const bySeverity = this.groupBySeverity(result.insights);

      for (const severity of ['critical', 'high', 'medium', 'low'] as Severity[]) {
        const insights = bySeverity[severity];
        if (insights.length === 0) continue;

        lines.push('');
        const label = severity.toUpperCase();
        const colorCode = this.useColors ? SEVERITY_COLORS[severity] : '';
        const resetCode = this.useColors ? COLORS.RESET : '';

        lines.push(`${colorCode}[${label}] (${insights.length})${resetCode}`);

        for (const insight of insights) {
          lines.push(this.formatInsight(insight, colorCode, resetCode));
        }
      }
    }

    // Summary
    lines.push('');
    lines.push(this.separator);
    lines.push(this.formatSummary(result));
    lines.push(this.separator);

    return lines.join('\n');
  }

  /**
   * Format analysis summary
   */
  private formatSummary(result: CROAnalysisResult): string {
    const parts: string[] = [];

    if (result.insights.length > 0) {
      const bySeverity = this.groupBySeverity(result.insights);
      const counts: string[] = [];

      if (bySeverity.critical.length > 0) {
        counts.push(this.color(`${bySeverity.critical.length} critical`, COLORS.RED));
      }
      if (bySeverity.high.length > 0) {
        counts.push(this.color(`${bySeverity.high.length} high`, COLORS.YELLOW));
      }
      if (bySeverity.medium.length > 0) {
        counts.push(`${bySeverity.medium.length} medium`);
      }
      if (bySeverity.low.length > 0) {
        counts.push(`${bySeverity.low.length} low`);
      }

      parts.push(`Found: ${counts.join(', ')}`);
    } else {
      parts.push('No CRO issues found');
    }

    return parts.join(' | ');
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
    if (insight.evidence?.text) {
      lines.push(`  Evidence: "${this.truncate(insight.evidence.text, 50)}"`);
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
   * Apply color if colors enabled
   */
  private color(text: string, colorCode: string): string {
    if (!this.useColors) return text;
    return `${colorCode}${text}${COLORS.RESET}`;
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
