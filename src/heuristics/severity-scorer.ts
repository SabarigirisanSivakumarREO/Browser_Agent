/**
 * Severity Scorer - Phase 18b (T106c)
 *
 * Adjusts insight severity based on business type context.
 * Some issues are more critical for certain business types.
 */

import type { CROInsight, BusinessType, Severity } from '../models/index.js';
import { createLogger } from '../utils/index.js';

const logger = createLogger('SeverityScorer');

/**
 * Severity level order (for comparisons)
 */
const SEVERITY_ORDER: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Map severity number back to severity level
 */
const SEVERITY_LEVELS: Severity[] = ['low', 'medium', 'high', 'critical'];

/**
 * Business type severity boosts
 * Maps business type -> insight type patterns -> severity boost
 */
const SEVERITY_BOOSTS: Record<BusinessType, Record<string, number>> = {
  ecommerce: {
    // Cart and checkout issues are critical for ecommerce
    cart: 2,
    checkout: 2,
    add_to_cart: 2,
    product: 1,
    price: 1,
    payment: 2,
    shipping: 1,
    // Trust is very important for ecommerce
    trust: 1,
    security: 2,
    badge: 1,
    // Form issues affect checkout
    form: 1,
  },
  saas: {
    // Trial and pricing are critical for SaaS
    trial: 2,
    pricing: 2,
    signup: 2,
    demo: 1,
    // Value proposition is key
    value_prop: 1,
    headline: 1,
    cta: 1,
    // Form issues affect signup
    form: 1,
  },
  banking: {
    // Security is paramount
    security: 2,
    trust: 2,
    authentication: 2,
    // Account-related
    account: 1,
    transfer: 2,
    payment: 2,
    // Forms for applications
    form: 1,
  },
  insurance: {
    // Quote process is critical
    quote: 2,
    form: 1,
    // Trust and credibility
    trust: 1,
    security: 1,
    // Coverage clarity
    value_prop: 1,
  },
  travel: {
    // Booking flow is critical
    booking: 2,
    reservation: 2,
    checkout: 2,
    // Date pickers and forms
    form: 1,
    // Pricing clarity
    price: 1,
  },
  media: {
    // Subscription is key
    subscribe: 2,
    newsletter: 1,
    // Content visibility
    navigation: 1,
    // Engagement
    cta: 1,
  },
  other: {
    // No specific boosts
  },
};

/**
 * Severity scorer class
 */
export class SeverityScorer {
  /**
   * Adjust severity for a list of insights based on business type
   * @param insights - List of insights to adjust
   * @param businessType - Detected business type
   * @returns New list with adjusted severities (does not mutate original)
   */
  adjustSeverity(insights: CROInsight[], businessType: BusinessType): CROInsight[] {
    const boosts = SEVERITY_BOOSTS[businessType] || {};

    return insights.map((insight) => {
      const boost = this.calculateBoost(insight, boosts);

      if (boost > 0) {
        const currentLevel = SEVERITY_ORDER[insight.severity];
        const newLevel = Math.min(currentLevel + boost, 4); // Cap at 'critical'
        const newSeverity = SEVERITY_LEVELS[newLevel - 1] as Severity;

        if (newSeverity !== insight.severity) {
          logger.debug(
            `Boosted ${insight.type} severity: ${insight.severity} -> ${newSeverity} (${businessType})`
          );

          return {
            ...insight,
            severity: newSeverity,
          };
        }
      }

      return insight;
    });
  }

  /**
   * Calculate boost for an insight based on type pattern matching
   */
  private calculateBoost(insight: CROInsight, boosts: Record<string, number>): number {
    const typeLower = insight.type.toLowerCase();
    const categoryLower = insight.category?.toLowerCase() || '';
    const issueLower = insight.issue.toLowerCase();

    let maxBoost = 0;

    for (const [pattern, boost] of Object.entries(boosts)) {
      // Check if pattern matches type, category, or issue
      if (
        typeLower.includes(pattern) ||
        categoryLower.includes(pattern) ||
        issueLower.includes(pattern)
      ) {
        maxBoost = Math.max(maxBoost, boost);
      }
    }

    return maxBoost;
  }

  /**
   * Get severity order for comparison
   */
  getSeverityOrder(severity: Severity): number {
    return SEVERITY_ORDER[severity];
  }

  /**
   * Compare two severities
   * @returns negative if a < b, 0 if equal, positive if a > b
   */
  compareSeverity(a: Severity, b: Severity): number {
    return SEVERITY_ORDER[a] - SEVERITY_ORDER[b];
  }

  /**
   * Get higher of two severities
   */
  maxSeverity(a: Severity, b: Severity): Severity {
    return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
  }
}

/**
 * Create a new severity scorer instance
 */
export function createSeverityScorer(): SeverityScorer {
  return new SeverityScorer();
}
