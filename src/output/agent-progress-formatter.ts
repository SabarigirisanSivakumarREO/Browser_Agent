/**
 * Agent Progress Formatter
 *
 * Phase 16-CLI (T089): Formats CRO agent analysis progress and results for console output.
 * Phase 21d (T318): Added vision insights formatting.
 */

import type { CROAnalysisResult } from '../agent/cro-agent.js';
import type { CROInsight, Severity } from '../models/index.js';
import type { VisionAnalysisSummary, HeuristicEvaluation, CROVisionAnalysisResult } from '../heuristics/vision/types.js';

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
        lines.push(this.color(`  - ${this.truncate(error, this.width - 6)}`, COLORS.RED));
      }
      if (result.errors.length > 5) {
        lines.push(this.color(`  ... and ${result.errors.length - 5} more errors`, COLORS.RED));
      }
    }

    // Phase 21d: Vision Analysis Summary (if available)
    if (result.visionAnalysis) {
      lines.push('');
      lines.push(this.separator.replace(/=/g, '-'));
      lines.push(`VISION ANALYSIS (${result.pageType?.toUpperCase() || 'unknown'})`);
      lines.push(this.separator.replace(/=/g, '-'));
      lines.push(this.formatVisionSummary(result.visionAnalysis.summary));
      lines.push('');
      lines.push(this.formatVisionDetails(result.visionAnalysis));
    }

    // Tool Insights (including vision insights)
    const visionInsights = result.visionInsights || [];
    const allInsights = [...result.insights, ...result.heuristicInsights, ...visionInsights];
    if (allInsights.length > 0) {
      const bySeverity = this.groupBySeverity(allInsights);

      lines.push('');
      lines.push(this.separator.replace(/=/g, '-'));
      const visionCount = visionInsights.length;
      lines.push(
        `INSIGHTS: ${result.insights.length} tool + ${result.heuristicInsights.length} heuristic + ${visionCount} vision = ${allInsights.length} total`
      );
      lines.push(this.separator.replace(/=/g, '-'));

      // Critical issues
      if (bySeverity.critical.length > 0) {
        lines.push('');
        lines.push(this.color(`▸ CRITICAL (${bySeverity.critical.length})`, COLORS.RED));
        for (const insight of bySeverity.critical) {
          lines.push(this.formatInsightLine(insight, COLORS.RED));
        }
      }

      // High issues
      if (bySeverity.high.length > 0) {
        lines.push('');
        lines.push(this.color(`▸ HIGH (${bySeverity.high.length})`, COLORS.YELLOW));
        for (const insight of bySeverity.high) {
          lines.push(this.formatInsightLine(insight, COLORS.YELLOW));
        }
      }

      // Medium issues
      if (bySeverity.medium.length > 0) {
        lines.push('');
        lines.push(this.color(`▸ MEDIUM (${bySeverity.medium.length})`, COLORS.CYAN));
        for (const insight of bySeverity.medium) {
          lines.push(this.formatInsightLine(insight, COLORS.CYAN));
        }
      }

      // Low issues
      if (bySeverity.low.length > 0) {
        lines.push('');
        lines.push(`▸ LOW (${bySeverity.low.length})`);
        for (const insight of bySeverity.low) {
          lines.push(this.formatInsightLine(insight, COLORS.DIM));
        }
      }
    } else {
      lines.push('');
      lines.push(this.separator.replace(/=/g, '-'));
      lines.push('INSIGHTS FOUND: 0');
      lines.push(this.separator.replace(/=/g, '-'));
    }

    // Hypotheses (if any)
    if (result.hypotheses && result.hypotheses.length > 0) {
      lines.push('');
      lines.push(this.separator.replace(/=/g, '-'));
      lines.push(`A/B TEST HYPOTHESES (${result.hypotheses.length})`);
      lines.push(this.separator.replace(/=/g, '-'));
      for (const hypothesis of result.hypotheses.slice(0, 5)) {
        lines.push(`  • ${hypothesis.title}`);
        lines.push(this.color(`    ${this.truncate(hypothesis.hypothesis, this.width - 6)}`, COLORS.DIM));
      }
      if (result.hypotheses.length > 5) {
        lines.push(`  ... and ${result.hypotheses.length - 5} more`);
      }
    }

    // Scores
    if (result.scores) {
      lines.push('');
      lines.push(this.separator.replace(/=/g, '-'));
      lines.push(`CRO SCORE: ${this.formatScore(result.scores.overall)}/100`);
      lines.push(this.separator.replace(/=/g, '-'));
    }

    // Summary
    lines.push('');
    lines.push(this.separator);
    lines.push(this.formatSummary(result));
    lines.push(this.separator);

    return lines.join('\n');
  }

  /**
   * Format a single insight line
   */
  private formatInsightLine(insight: CROInsight, colorCode: string): string {
    const category = insight.category ? `[${insight.category}]` : '';
    // Include heuristicId if available (for vision insights)
    const heuristicTag = insight.heuristicId ? `[${insight.heuristicId}]` : '';
    const issue = this.truncate(insight.issue, this.width - 20);
    return this.color(`  • ${heuristicTag || category} ${issue}`, colorCode);
  }

  /**
   * Format vision analysis summary (Phase 21d)
   */
  private formatVisionSummary(summary: VisionAnalysisSummary): string {
    const lines: string[] = [];

    // Heuristics evaluation stats
    const passColor = summary.passed > 0 ? COLORS.GREEN : COLORS.DIM;
    const failColor = summary.failed > 0 ? COLORS.RED : COLORS.DIM;
    const partialColor = summary.partial > 0 ? COLORS.YELLOW : COLORS.DIM;

    lines.push(`  Heuristics: ${summary.totalHeuristics} evaluated`);
    lines.push(`  ${this.color(`✓ Passed: ${summary.passed}`, passColor)} | ${this.color(`✗ Failed: ${summary.failed}`, failColor)} | ${this.color(`~ Partial: ${summary.partial}`, partialColor)} | N/A: ${summary.notApplicable}`);

    // Severity breakdown for failed items
    const severityParts: string[] = [];
    if (summary.bySeverity.critical > 0) {
      severityParts.push(this.color(`${summary.bySeverity.critical} critical`, COLORS.RED));
    }
    if (summary.bySeverity.high > 0) {
      severityParts.push(this.color(`${summary.bySeverity.high} high`, COLORS.YELLOW));
    }
    if (summary.bySeverity.medium > 0) {
      severityParts.push(`${summary.bySeverity.medium} medium`);
    }
    if (summary.bySeverity.low > 0) {
      severityParts.push(`${summary.bySeverity.low} low`);
    }

    if (severityParts.length > 0) {
      lines.push(`  Issues by severity: ${severityParts.join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Format detailed vision analysis evaluations (Phase 21d enhanced)
   */
  private formatVisionDetails(visionAnalysis: CROVisionAnalysisResult): string {
    const lines: string[] = [];
    const evaluations = visionAnalysis.evaluations;

    // Group evaluations by status
    const failed = evaluations.filter(e => e.status === 'fail');
    const partial = evaluations.filter(e => e.status === 'partial');
    const passed = evaluations.filter(e => e.status === 'pass');
    const notApplicable = evaluations.filter(e => e.status === 'not_applicable');

    // Display failed evaluations with full details
    if (failed.length > 0) {
      lines.push(this.color('  ┌─ FAILED HEURISTICS ─────────────────────────────────────────', COLORS.RED));
      for (const evaluation of failed) {
        lines.push(this.formatEvaluationDetail(evaluation, COLORS.RED));
      }
      lines.push('');
    }

    // Display partial evaluations with full details
    if (partial.length > 0) {
      lines.push(this.color('  ┌─ PARTIAL COMPLIANCE ────────────────────────────────────────', COLORS.YELLOW));
      for (const evaluation of partial) {
        lines.push(this.formatEvaluationDetail(evaluation, COLORS.YELLOW));
      }
      lines.push('');
    }

    // Display passed evaluations (condensed)
    if (passed.length > 0) {
      lines.push(this.color('  ┌─ PASSED HEURISTICS ─────────────────────────────────────────', COLORS.GREEN));
      for (const evaluation of passed) {
        lines.push(this.formatEvaluationCondensed(evaluation, COLORS.GREEN));
      }
      lines.push('');
    }

    // Display N/A evaluations (condensed, dimmed)
    if (notApplicable.length > 0) {
      lines.push(this.color('  ┌─ NOT APPLICABLE ─────────────────────────────────────────────', COLORS.DIM));
      for (const evaluation of notApplicable) {
        lines.push(this.formatEvaluationCondensed(evaluation, COLORS.DIM));
      }
    }

    return lines.join('\n');
  }

  /**
   * Format a single evaluation with full details
   * Phase 21h (T360): Added evidence field display
   */
  private formatEvaluationDetail(evaluation: HeuristicEvaluation, colorCode: string): string {
    const lines: string[] = [];
    const severityIcon = this.getSeverityIcon(evaluation.severity);
    const confidenceStr = `${(evaluation.confidence * 100).toFixed(0)}%`;

    // Header line with ID and severity
    lines.push(this.color(`  │ ${severityIcon} [${evaluation.heuristicId}] ${evaluation.severity.toUpperCase()} (confidence: ${confidenceStr})`, colorCode));

    // Phase 21h: Evidence metadata line (viewportIndex, timestamp)
    const evidenceParts: string[] = [];
    if (evaluation.viewportIndex !== undefined) {
      evidenceParts.push(`viewport: ${evaluation.viewportIndex}`);
    }
    if (evaluation.timestamp) {
      evidenceParts.push(`at: ${new Date(evaluation.timestamp).toISOString()}`);
    }
    if (evaluation.screenshotRef) {
      evidenceParts.push(`screenshot: ${evaluation.screenshotRef}`);
    }
    if (evidenceParts.length > 0) {
      lines.push(this.color(`  │   Evidence: ${evidenceParts.join(' | ')}`, COLORS.DIM));
    }

    // Principle (what should be done)
    lines.push(this.color(`  │   Principle: ${this.wrapText(evaluation.principle, this.width - 16)}`, COLORS.DIM));

    // Observation (what GPT-4o saw)
    lines.push(`  │   ${this.color('Observation:', COLORS.CYAN)} ${this.wrapText(evaluation.observation, this.width - 18)}`);

    // Phase 21h: DOM Element References
    if (evaluation.domElementRefs && evaluation.domElementRefs.length > 0) {
      const refStrings = evaluation.domElementRefs.map(ref => {
        const parts = [`[${ref.index}]`, ref.elementType];
        if (ref.textContent) {
          parts.push(`"${this.truncate(ref.textContent, 30)}"`);
        }
        return parts.join(' ');
      });
      lines.push(`  │   ${this.color('Elements:', COLORS.DIM)} ${refStrings.join(', ')}`);
    }

    // Phase 21h: Bounding Box
    if (evaluation.boundingBox) {
      const bb = evaluation.boundingBox;
      lines.push(`  │   ${this.color('BoundingBox:', COLORS.DIM)} x:${bb.x.toFixed(0)} y:${bb.y.toFixed(0)} ${bb.width.toFixed(0)}×${bb.height.toFixed(0)} (viewport ${bb.viewportIndex})`);
    }

    // Issue (what's wrong) - only for fail/partial
    if (evaluation.issue) {
      lines.push(`  │   ${this.color('Issue:', colorCode)} ${this.wrapText(evaluation.issue, this.width - 12)}`);
    }

    // Recommendation (how to fix)
    if (evaluation.recommendation) {
      lines.push(`  │   ${this.color('Recommendation:', COLORS.GREEN)} ${this.wrapText(evaluation.recommendation, this.width - 20)}`);
    }

    lines.push('  │');

    return lines.join('\n');
  }

  /**
   * Format a single evaluation in condensed form (for passed/N/A)
   */
  private formatEvaluationCondensed(evaluation: HeuristicEvaluation, colorCode: string): string {
    const statusIcon = evaluation.status === 'pass' ? '✓' : '○';
    const principle = this.truncate(evaluation.principle, this.width - 30);
    return this.color(`  │ ${statusIcon} [${evaluation.heuristicId}] ${principle}`, colorCode);
  }

  /**
   * Get severity icon
   */
  private getSeverityIcon(severity: Severity): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '⚪';
      default: return '○';
    }
  }

  /**
   * Wrap text to fit within width, adding indentation for continuation lines
   */
  private wrapText(text: string, maxWidth: number): string {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= maxWidth) return cleaned;

    const words = cleaned.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= maxWidth) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Join with proper indentation for continuation
    return lines.join('\n  │              ');
  }

  /**
   * Format score with color based on value
   */
  private formatScore(score: number): string {
    if (score >= 80) {
      return this.color(String(score), COLORS.GREEN);
    } else if (score >= 60) {
      return this.color(String(score), COLORS.YELLOW);
    } else {
      return this.color(String(score), COLORS.RED);
    }
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
