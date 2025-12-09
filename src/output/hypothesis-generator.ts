/**
 * Hypothesis Generator - Phase 18d (T112)
 *
 * Generates A/B test hypotheses from CRO insights.
 * Filters by severity, calculates priority, and maps to metrics.
 */

import type { CROInsight, Severity, Hypothesis, ExpectedImpact } from '../models/index.js';
import { CATEGORY_METRICS, SEVERITY_TO_IMPACT } from '../models/index.js';
import { createLogger } from '../utils/index.js';

/**
 * Severity priority values for filtering and sorting
 */
const SEVERITY_PRIORITY: Record<Severity, number> = {
  critical: 10,
  high: 8,
  medium: 5,
  low: 2,
};


/**
 * Options for HypothesisGenerator
 */
export interface HypothesisGeneratorOptions {
  /** Minimum severity to include (default: 'high') */
  minSeverity?: Severity;
}

/**
 * Generates A/B test hypotheses from CRO insights
 */
export class HypothesisGenerator {
  private readonly logger = createLogger('HypothesisGenerator');
  private readonly minSeverity: Severity;

  constructor(options: HypothesisGeneratorOptions = {}) {
    this.minSeverity = options.minSeverity ?? 'high';
  }

  /**
   * Generate hypotheses from insights
   * @param insights - CRO insights to generate hypotheses from
   * @returns Array of hypotheses sorted by priority
   */
  generate(insights: CROInsight[]): Hypothesis[] {
    if (!insights || insights.length === 0) {
      this.logger.debug('No insights provided, returning empty array');
      return [];
    }

    // Filter to eligible insights based on minimum severity
    const eligibleInsights = insights.filter(
      i => SEVERITY_PRIORITY[i.severity] >= SEVERITY_PRIORITY[this.minSeverity]
    );

    this.logger.info(
      `Generating hypotheses from ${eligibleInsights.length}/${insights.length} eligible insights (minSeverity: ${this.minSeverity})`
    );

    const hypotheses: Hypothesis[] = [];
    let counter = 1;

    for (const insight of eligibleInsights) {
      const hypothesis = this.createHypothesis(insight, counter);
      hypotheses.push(hypothesis);
      counter++;
    }

    // Sort by priority (highest first)
    hypotheses.sort((a, b) => b.priority - a.priority);

    this.logger.info(`Generated ${hypotheses.length} hypotheses`);
    return hypotheses;
  }

  /**
   * Create a single hypothesis from an insight
   */
  private createHypothesis(insight: CROInsight, index: number): Hypothesis {
    const metric = this.getMetric(insight.category);
    const impact = this.getExpectedImpact(insight.severity);
    const priority = this.calculatePriority(insight);

    // Build hypothesis ID in H-001 format
    const id = `H-${String(index).padStart(3, '0')}`;

    // Generate title from type
    const title = this.generateTitle(insight);

    // Build hypothesis statement
    const hypothesis = this.buildHypothesisStatement(insight, metric);

    return {
      id,
      title,
      hypothesis,
      controlDescription: `Current state: ${insight.issue}`,
      treatmentDescription: insight.recommendation,
      primaryMetric: metric,
      expectedImpact: impact,
      priority,
      relatedInsights: [insight.id],
    };
  }

  /**
   * Generate a human-readable title from insight type
   */
  private generateTitle(insight: CROInsight): string {
    // Convert snake_case to Title Case
    const typeWords = insight.type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    return `Fix ${typeWords}`;
  }

  /**
   * Build the full hypothesis statement
   */
  private buildHypothesisStatement(insight: CROInsight, metric: string): string {
    const recommendation = insight.recommendation.toLowerCase();
    const metricLower = metric.toLowerCase();
    const issue = insight.issue.toLowerCase();

    return `If we ${recommendation}, then ${metricLower} will improve because ${issue}`;
  }

  /**
   * Get the primary metric for a category
   */
  private getMetric(category: string): string {
    return CATEGORY_METRICS[category] || CATEGORY_METRICS['custom'] || 'Conversion rate';
  }

  /**
   * Map severity to expected impact
   */
  private getExpectedImpact(severity: Severity): ExpectedImpact {
    return SEVERITY_TO_IMPACT[severity] || 'medium';
  }

  /**
   * Calculate priority score (1-10) from insight severity
   */
  private calculatePriority(insight: CROInsight): number {
    const basePriority = SEVERITY_PRIORITY[insight.severity];
    // Normalize to 1-10 scale
    return Math.min(10, Math.max(1, basePriority));
  }
}
