/**
 * JSON Exporter - Phase 18d (T116)
 *
 * Exports CRO analysis results as formatted JSON.
 * Provides structured machine-readable output for downstream tools.
 */

import type { CROInsight, Hypothesis, BusinessTypeResult } from '../models/index.js';
import type { CROScores, CROReportInput } from './markdown-reporter.js';
import { createLogger } from '../utils/index.js';

/**
 * JSON export structure
 * CR-001-C: Added unified analysis metadata
 */
export interface CROExportData {
  meta: {
    url: string;
    pageTitle: string | null;
    analysisDate: string;
    businessType: BusinessTypeResult | null;
    /** CR-001-C: Detected page type */
    pageType: string | null;
    stepsExecuted: number;
    totalTimeMs: number;
    version: string;
    /** CR-001-C: Whether unified analysis was used */
    unifiedAnalysis: boolean;
    /** CR-001-C: Categories analyzed in unified mode */
    categoriesAnalyzed: string[];
  };
  scores: CROScores;
  insights: {
    total: number;
    bySeverity: {
      critical: CROInsight[];
      high: CROInsight[];
      medium: CROInsight[];
      low: CROInsight[];
    };
    byCategory: Record<string, CROInsight[]>;
    /** CR-001-C: Source breakdown */
    bySource: {
      tool: CROInsight[];
      heuristic: CROInsight[];
      vision: CROInsight[];
    };
  };
  hypotheses: Hypothesis[];
}

/**
 * Options for JSONExporter
 */
export interface JSONExporterOptions {
  /** Pretty print with indentation (default: true) */
  pretty?: boolean;
  /** Indentation spaces for pretty printing (default: 2) */
  indent?: number;
  /** Include empty arrays/objects (default: true) */
  includeEmpty?: boolean;
}

/**
 * Exports CRO analysis results as formatted JSON
 */
export class JSONExporter {
  private readonly logger = createLogger('JSONExporter');
  private readonly pretty: boolean;
  private readonly indent: number;
  private readonly includeEmpty: boolean;

  constructor(options: JSONExporterOptions = {}) {
    this.pretty = options.pretty ?? true;
    this.indent = options.indent ?? 2;
    // Reserved for future use - filter empty arrays/objects
    this.includeEmpty = options.includeEmpty ?? true;
    void this.includeEmpty; // Suppress unused warning
  }

  /**
   * Export CRO analysis result as JSON string
   * @param result - CRO analysis result to export
   * @returns Formatted JSON string
   */
  export(result: CROReportInput): string {
    this.logger.info('Exporting result to JSON', { url: result.url });

    const exportData = this.buildExportData(result);
    const json = this.pretty
      ? JSON.stringify(exportData, null, this.indent)
      : JSON.stringify(exportData);

    this.logger.info('JSON export complete', { length: json.length });
    return json;
  }

  /**
   * Export to structured object (for programmatic use)
   * @param result - CRO analysis result to export
   * @returns Structured export data object
   */
  exportAsObject(result: CROReportInput): CROExportData {
    return this.buildExportData(result);
  }

  /**
   * Build the export data structure
   * CR-001-C: Updated to include vision insights and unified analysis metadata
   */
  private buildExportData(result: CROReportInput): CROExportData {
    const toolInsights = result.insights || [];
    const heuristicInsights = result.heuristicInsights || [];
    const visionInsights = result.visionInsights || [];
    const allInsights = [...toolInsights, ...heuristicInsights, ...visionInsights];
    const scores = result.scores || this.calculateDefaultScores(allInsights);

    return {
      meta: {
        url: result.url,
        pageTitle: result.pageTitle || null,
        analysisDate: new Date().toISOString(),
        businessType: result.businessType || null,
        pageType: result.pageType || null,
        stepsExecuted: result.stepsExecuted || 0,
        totalTimeMs: result.totalTimeMs || 0,
        version: '1.0.0',
        unifiedAnalysis: result.unifiedAnalysis || false,
        categoriesAnalyzed: result.categoriesAnalyzed || [],
      },
      scores,
      insights: {
        total: allInsights.length,
        bySeverity: {
          critical: this.filterBySeverity(allInsights, 'critical'),
          high: this.filterBySeverity(allInsights, 'high'),
          medium: this.filterBySeverity(allInsights, 'medium'),
          low: this.filterBySeverity(allInsights, 'low'),
        },
        byCategory: this.groupByCategory(allInsights),
        bySource: {
          tool: toolInsights,
          heuristic: heuristicInsights,
          vision: visionInsights,
        },
      },
      hypotheses: result.hypotheses || [],
    };
  }

  /**
   * Filter insights by severity
   */
  private filterBySeverity(insights: CROInsight[], severity: string): CROInsight[] {
    return insights.filter(i => i.severity === severity);
  }

  /**
   * Group insights by category
   */
  private groupByCategory(insights: CROInsight[]): Record<string, CROInsight[]> {
    const grouped: Record<string, CROInsight[]> = {};

    for (const insight of insights) {
      const category = insight.category;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category]!.push(insight);
    }

    return grouped;
  }

  /**
   * Calculate default scores when not provided
   */
  private calculateDefaultScores(insights: CROInsight[]): CROScores {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    const byCategory: Record<string, number> = {};

    for (const insight of insights) {
      counts[insight.severity as keyof typeof counts]++;
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
