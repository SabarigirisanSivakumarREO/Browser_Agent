/**
 * Score Calculator - Phase 18e (T117b)
 *
 * Calculates CRO scores from insights.
 * Provides overall score (0-100) and breakdown by category and severity.
 */

import type { CROInsight, Severity, InsightCategory } from '../models/index.js';
import { createLogger } from '../utils/index.js';

/**
 * CRO Scores interface
 */
export interface CROScores {
  /** Overall CRO score (0-100, higher is better) */
  overall: number;
  /** Score breakdown by category */
  byCategory: Record<string, number>;
  /** Count of critical severity issues */
  criticalCount: number;
  /** Count of high severity issues */
  highCount: number;
  /** Count of medium severity issues */
  mediumCount: number;
  /** Count of low severity issues */
  lowCount: number;
}

/**
 * Severity deduction values for score calculation
 * Higher severity issues reduce the score more
 */
const SEVERITY_DEDUCTIONS: Record<Severity, number> = {
  critical: 25,
  high: 15,
  medium: 5,
  low: 2,
};

/**
 * Category weights for score contribution
 * More impactful categories have higher weights
 */
const CATEGORY_WEIGHTS: Record<InsightCategory | string, number> = {
  cta: 1.2,
  form: 1.1,
  trust: 1.0,
  value_prop: 1.0,
  navigation: 0.9,
  custom: 0.8,
};

/**
 * Options for ScoreCalculator
 */
export interface ScoreCalculatorOptions {
  /** Base score to start from (default: 100) */
  baseScore?: number;
  /** Minimum score floor (default: 0) */
  minScore?: number;
  /** Maximum score ceiling (default: 100) */
  maxScore?: number;
}

/**
 * Calculates CRO scores from insights
 */
export class ScoreCalculator {
  private readonly logger = createLogger('ScoreCalculator');
  private readonly baseScore: number;
  private readonly minScore: number;
  private readonly maxScore: number;

  constructor(options: ScoreCalculatorOptions = {}) {
    this.baseScore = options.baseScore ?? 100;
    this.minScore = options.minScore ?? 0;
    this.maxScore = options.maxScore ?? 100;
  }

  /**
   * Calculate CRO scores from insights
   * @param insights - Array of CRO insights to calculate scores from
   * @returns CROScores object with overall and category breakdown
   */
  calculate(insights: CROInsight[]): CROScores {
    if (!insights || insights.length === 0) {
      this.logger.debug('No insights provided, returning perfect score');
      return {
        overall: this.maxScore,
        byCategory: {},
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      };
    }

    // Count by severity
    const severityCounts = this.countBySeverity(insights);

    // Group by category
    const byCategory = this.calculateCategoryScores(insights);

    // Calculate overall score
    const overall = this.calculateOverallScore(severityCounts, insights);

    const result: CROScores = {
      overall,
      byCategory,
      criticalCount: severityCounts.critical,
      highCount: severityCounts.high,
      mediumCount: severityCounts.medium,
      lowCount: severityCounts.low,
    };

    this.logger.info('Scores calculated', {
      overall: result.overall,
      totalInsights: insights.length,
      criticalCount: result.criticalCount,
      highCount: result.highCount,
    });

    return result;
  }

  /**
   * Count insights by severity
   */
  private countBySeverity(insights: CROInsight[]): Record<Severity, number> {
    const counts: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const insight of insights) {
      if (counts[insight.severity] !== undefined) {
        counts[insight.severity]++;
      }
    }

    return counts;
  }

  /**
   * Calculate score breakdown by category
   * Each category gets a score based on number and severity of issues
   */
  private calculateCategoryScores(insights: CROInsight[]): Record<string, number> {
    // Group insights by category
    const byCategory: Record<string, CROInsight[]> = {};

    for (const insight of insights) {
      const category = insight.category;
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category]!.push(insight);
    }

    // Calculate score for each category
    const scores: Record<string, number> = {};

    for (const [category, categoryInsights] of Object.entries(byCategory)) {
      // Start with 100 for each category
      let categoryScore = 100;

      // Deduct based on severity
      for (const insight of categoryInsights) {
        categoryScore -= SEVERITY_DEDUCTIONS[insight.severity];
      }

      // Clamp to 0-100
      scores[category] = Math.max(0, Math.min(100, categoryScore));
    }

    return scores;
  }

  /**
   * Calculate overall score using severity deductions
   * Formula: baseScore - (critical * 25 + high * 15 + medium * 5 + low * 2)
   * Then clamped to minScore-maxScore range
   */
  private calculateOverallScore(
    counts: Record<Severity, number>,
    insights: CROInsight[]
  ): number {
    // Calculate base deduction from severity counts
    let deduction =
      counts.critical * SEVERITY_DEDUCTIONS.critical +
      counts.high * SEVERITY_DEDUCTIONS.high +
      counts.medium * SEVERITY_DEDUCTIONS.medium +
      counts.low * SEVERITY_DEDUCTIONS.low;

    // Apply category weights for fine-tuning
    // Count weighted deductions per category
    let weightedDeduction = 0;
    for (const insight of insights) {
      const weight = CATEGORY_WEIGHTS[insight.category] ?? CATEGORY_WEIGHTS['custom'];
      weightedDeduction += SEVERITY_DEDUCTIONS[insight.severity] * (weight ?? 1);
    }

    // Use weighted deduction if different, blend 70% weighted + 30% simple
    if (weightedDeduction !== deduction) {
      deduction = Math.round(weightedDeduction * 0.7 + deduction * 0.3);
    }

    // Calculate final score
    const score = this.baseScore - deduction;

    // Clamp to valid range
    return Math.max(this.minScore, Math.min(this.maxScore, score));
  }
}

/**
 * Factory function to create ScoreCalculator with default options
 */
export function createScoreCalculator(
  options?: ScoreCalculatorOptions
): ScoreCalculator {
  return new ScoreCalculator(options);
}
