/**
 * Markdown Reporter - Phase 18d (T115)
 *
 * Generates comprehensive markdown reports from CRO analysis results.
 * Organizes findings by severity with executive summary and A/B test recommendations.
 */

import type { CROInsight, Hypothesis, BusinessTypeResult, Severity } from '../models/index.js';
import { createLogger } from '../utils/index.js';

/**
 * CRO Scores interface (will be moved to models in Phase 18e)
 */
export interface CROScores {
  overall: number;
  byCategory: Record<string, number>;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

/**
 * Extended CRO Analysis Result for report generation
 * This interface will be merged with CROAnalysisResult in Phase 18e
 */
export interface CROReportInput {
  url: string;
  pageTitle?: string;
  insights: CROInsight[];
  heuristicInsights?: CROInsight[];
  businessType?: BusinessTypeResult;
  hypotheses?: Hypothesis[];
  scores?: CROScores;
  stepsExecuted?: number;
  totalTimeMs?: number;
}

/**
 * Options for MarkdownReporter
 */
export interface MarkdownReporterOptions {
  /** Include section for low priority issues (default: true) */
  includeLowPriority?: boolean;
  /** Include timestamp in footer (default: true) */
  includeTimestamp?: boolean;
}

/**
 * Generates markdown reports from CRO analysis results
 */
export class MarkdownReporter {
  private readonly logger = createLogger('MarkdownReporter');
  private readonly includeLowPriority: boolean;
  private readonly includeTimestamp: boolean;

  constructor(options: MarkdownReporterOptions = {}) {
    this.includeLowPriority = options.includeLowPriority ?? true;
    this.includeTimestamp = options.includeTimestamp ?? true;
  }

  /**
   * Generate full markdown report
   * @param result - CRO analysis result to report on
   * @returns Formatted markdown string
   */
  generate(result: CROReportInput): string {
    this.logger.info('Generating markdown report', { url: result.url });

    const sections: string[] = [];

    sections.push(this.generateHeader(result));
    sections.push(this.generateExecutiveSummary(result));
    sections.push(this.generateCriticalIssues(result));
    sections.push(this.generateHighPriorityIssues(result));
    sections.push(this.generateMediumPriorityIssues(result));

    if (this.includeLowPriority) {
      sections.push(this.generateLowPriorityIssues(result));
    }

    sections.push(this.generateRecommendedTests(result));
    sections.push(this.generateFooter(result));

    const report = sections.join('\n\n');
    this.logger.info('Markdown report generated', { length: report.length });

    return report;
  }

  /**
   * Generate report header with URL and metadata
   */
  private generateHeader(result: CROReportInput): string {
    const businessTypeStr = result.businessType
      ? `${result.businessType.type} (${Math.round((result.businessType.confidence || 0) * 100)}% confidence)`
      : 'Unknown';

    return `# CRO Analysis Report

**URL**: ${result.url}
**Page Title**: ${result.pageTitle || 'N/A'}
**Analysis Date**: ${new Date().toISOString().split('T')[0]}
**Business Type**: ${businessTypeStr}

---`;
  }

  /**
   * Generate executive summary section
   */
  private generateExecutiveSummary(result: CROReportInput): string {
    const allInsights = this.getAllInsights(result);
    const scores = result.scores || this.calculateDefaultScores(allInsights);

    return `## Executive Summary

| Metric | Value |
|--------|-------|
| Overall CRO Score | **${scores.overall}/100** |
| Critical Issues | ${scores.criticalCount} |
| High Priority | ${scores.highCount} |
| Medium Priority | ${scores.mediumCount} |
| Low Priority | ${scores.lowCount} |
| Recommended Tests | ${result.hypotheses?.length || 0} |
| Analysis Steps | ${result.stepsExecuted || 'N/A'} |
| Total Time | ${result.totalTimeMs ? `${(result.totalTimeMs / 1000).toFixed(1)}s` : 'N/A'} |`;
  }

  /**
   * Generate critical issues section
   */
  private generateCriticalIssues(result: CROReportInput): string {
    const critical = this.filterBySeverity(result, 'critical');

    if (critical.length === 0) {
      return `## Critical Issues

✅ No critical issues found.`;
    }

    return `## Critical Issues

${critical.map(i => this.formatInsight(i)).join('\n\n')}`;
  }

  /**
   * Generate high priority issues section
   */
  private generateHighPriorityIssues(result: CROReportInput): string {
    const high = this.filterBySeverity(result, 'high');

    if (high.length === 0) {
      return `## High Priority Issues

✅ No high priority issues found.`;
    }

    return `## High Priority Issues

${high.map(i => this.formatInsight(i)).join('\n\n')}`;
  }

  /**
   * Generate medium priority issues section
   */
  private generateMediumPriorityIssues(result: CROReportInput): string {
    const medium = this.filterBySeverity(result, 'medium');

    if (medium.length === 0) {
      return `## Medium Priority Issues

✅ No medium priority issues found.`;
    }

    return `## Medium Priority Issues

${medium.map(i => this.formatInsight(i)).join('\n\n')}`;
  }

  /**
   * Generate low priority issues section
   */
  private generateLowPriorityIssues(result: CROReportInput): string {
    const low = this.filterBySeverity(result, 'low');

    if (low.length === 0) {
      return `## Low Priority Issues

✅ No low priority issues found.`;
    }

    return `## Low Priority Issues

${low.map(i => this.formatInsight(i)).join('\n\n')}`;
  }

  /**
   * Generate recommended A/B tests section
   */
  private generateRecommendedTests(result: CROReportInput): string {
    if (!result.hypotheses || result.hypotheses.length === 0) {
      return `## Recommended A/B Tests

No tests recommended based on current analysis.`;
    }

    return `## Recommended A/B Tests

${result.hypotheses.map((h, i) => this.formatHypothesis(h, i + 1)).join('\n\n')}`;
  }

  /**
   * Generate report footer
   */
  private generateFooter(_result: CROReportInput): string {
    const timestamp = this.includeTimestamp ? ` | ${new Date().toISOString()}` : '';
    return `---

*Generated by CRO Browser Agent${timestamp}*`;
  }

  /**
   * Get all insights combined
   */
  private getAllInsights(result: CROReportInput): CROInsight[] {
    return [...result.insights, ...(result.heuristicInsights || [])];
  }

  /**
   * Filter insights by severity
   */
  private filterBySeverity(result: CROReportInput, severity: Severity): CROInsight[] {
    return this.getAllInsights(result).filter(i => i.severity === severity);
  }

  /**
   * Format a single insight as markdown
   */
  private formatInsight(insight: CROInsight): string {
    const typeTitle = insight.type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    const heuristicLine = insight.heuristicId
      ? `\n- **Heuristic**: ${insight.heuristicId}`
      : '';

    return `### ${typeTitle}

- **Category**: ${insight.category}
- **Element**: \`${insight.element || 'N/A'}\`
- **Issue**: ${insight.issue}
- **Recommendation**: ${insight.recommendation}${heuristicLine}`;
  }

  /**
   * Format a hypothesis as markdown
   */
  private formatHypothesis(h: Hypothesis, num: number): string {
    return `### Test ${num}: ${h.title}

**Hypothesis**: ${h.hypothesis}

| Aspect | Description |
|--------|-------------|
| Control | ${h.controlDescription} |
| Treatment | ${h.treatmentDescription} |
| Primary Metric | ${h.primaryMetric} |
| Expected Impact | ${h.expectedImpact} |
| Priority | ${h.priority}/10 |`;
  }

  /**
   * Calculate default scores when not provided
   */
  private calculateDefaultScores(insights: CROInsight[]): CROScores {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    const byCategory: Record<string, number> = {};

    for (const insight of insights) {
      counts[insight.severity]++;
      byCategory[insight.category] = (byCategory[insight.category] || 0) + 1;
    }

    // Calculate overall score: 100 - deductions
    const deductions =
      counts.critical * 25 +
      counts.high * 15 +
      counts.medium * 5 +
      counts.low * 2;
    const overall = Math.max(0, 100 - deductions);

    return {
      overall,
      byCategory,
      criticalCount: counts.critical,
      highCount: counts.high,
      mediumCount: counts.medium,
      lowCount: counts.low,
    };
  }
}
