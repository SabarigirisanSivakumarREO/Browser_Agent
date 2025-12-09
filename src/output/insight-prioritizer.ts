/**
 * Insight Prioritizer - Phase 18d (T114)
 *
 * Sorts CRO insights by severity with business type boosting.
 * Higher severity and business-relevant issues are prioritized.
 */

import type { CROInsight, Severity, BusinessType } from '../models/index.js';
import { createLogger } from '../utils/index.js';

/**
 * Severity priority values for sorting
 */
const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Business-critical insight types by business type
 * These get a boost in priority
 */
const BUSINESS_CRITICAL_TYPES: Record<BusinessType, string[]> = {
  ecommerce: [
    'no_cta_above_fold',
    'no_search_ecommerce',
    'no_security_badge',
    'form_field_overload',
    'no_trust_above_fold',
    'missing_add_to_cart',
    'checkout_friction',
  ],
  saas: [
    'vague_cta_text',
    'unclear_value_prop',
    'no_trust_above_fold',
    'form_field_overload',
    'missing_pricing',
    'no_social_proof',
  ],
  banking: [
    'no_security_badge',
    'no_trust_above_fold',
    'form_field_overload',
    'missing_field_label',
    'compliance_missing',
  ],
  insurance: [
    'no_security_badge',
    'no_trust_above_fold',
    'form_field_overload',
    'unclear_value_prop',
    'no_guarantees',
  ],
  travel: [
    'no_trust_above_fold',
    'form_field_overload',
    'no_search_ecommerce',
    'unclear_value_prop',
    'no_reviews',
  ],
  media: [
    'vague_cta_text',
    'unclear_value_prop',
    'headline_too_long',
    'no_value_prop',
  ],
  other: [],
};

/**
 * Options for InsightPrioritizer
 */
export interface InsightPrioritizerOptions {
  /** Boost factor for business-critical issues (default: 1) */
  businessBoostFactor?: number;
}

/**
 * Prioritizes CRO insights by severity with business context
 */
export class InsightPrioritizer {
  private readonly logger = createLogger('InsightPrioritizer');
  private readonly businessBoostFactor: number;

  constructor(options: InsightPrioritizerOptions = {}) {
    this.businessBoostFactor = options.businessBoostFactor ?? 1;
  }

  /**
   * Prioritize insights by severity with business type boost
   * @param insights - Array of CRO insights to prioritize
   * @param businessType - Detected business type for boosting
   * @returns Sorted array with highest priority first
   */
  prioritize(insights: CROInsight[], businessType?: BusinessType): CROInsight[] {
    if (!insights || insights.length === 0) {
      this.logger.debug('No insights provided, returning empty array');
      return [];
    }

    const businessCriticalTypes = businessType
      ? BUSINESS_CRITICAL_TYPES[businessType] || []
      : [];

    // Create scored insights for sorting
    const scoredInsights = insights.map(insight => ({
      insight,
      score: this.calculateScore(insight, businessCriticalTypes),
    }));

    // Sort by score (highest first), then by original order for stability
    scoredInsights.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      // Stable sort: maintain original order for equal scores
      return insights.indexOf(a.insight) - insights.indexOf(b.insight);
    });

    const result = scoredInsights.map(s => s.insight);

    this.logger.info(
      `Prioritized ${result.length} insights (business type: ${businessType || 'none'})`
    );

    return result;
  }

  /**
   * Calculate priority score for an insight
   */
  private calculateScore(insight: CROInsight, businessCriticalTypes: string[]): number {
    // Base score from severity
    let score = SEVERITY_ORDER[insight.severity] * 100;

    // Boost for business-critical types
    if (businessCriticalTypes.includes(insight.type)) {
      score += 50 * this.businessBoostFactor;
      this.logger.debug(
        `Boosted insight ${insight.id} (${insight.type}) by ${50 * this.businessBoostFactor}`
      );
    }

    // Additional boost based on confidence if present
    if (insight.confidence !== undefined) {
      score += insight.confidence * 10;
    }

    return score;
  }
}
