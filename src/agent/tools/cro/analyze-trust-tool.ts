/**
 * Analyze Trust Signals Tool
 *
 * Phase 17b (T095): Detects trust signals on the page.
 * Checks for reviews, badges, testimonials, security seals, guarantees.
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult, CROInsight, DOMNode } from '../../../models/index.js';

/**
 * Create a unique insight ID
 */
function createInsightId(): string {
  return randomUUID().slice(0, 8);
}

/**
 * Parameter schema for detect_trust_signals tool
 */
export const AnalyzeTrustParamsSchema = z.object({
  focusArea: z.enum(['above_fold', 'full_page']).optional().default('full_page').describe('Area to analyze'),
});

export type AnalyzeTrustParams = z.infer<typeof AnalyzeTrustParamsSchema>;

/**
 * Insight type constants for trust analysis
 */
const INSIGHT_TYPES = {
  NO_TRUST_ABOVE_FOLD: 'no_trust_above_fold',
  NO_REVIEWS: 'no_reviews',
  NO_SECURITY_BADGE: 'no_security_badge',
  NO_GUARANTEES: 'no_guarantees',
  NO_CERTIFICATIONS: 'no_certifications',
} as const;

/**
 * Detection patterns for trust elements
 */
const TRUST_PATTERNS = {
  reviews: ['review', 'testimonial', 'rating', 'stars', 'feedback', 'customer-say'],
  badges: ['trust-badge', 'security-seal', 'secure', 'ssl', 'verified', 'badge'],
  guarantees: ['guarantee', 'warranty', 'money-back', 'refund', 'risk-free'],
  certifications: ['certification', 'accredited', 'certified', 'approved', 'award'],
};

/**
 * Analyze Trust Signals Tool Implementation
 */
export const analyzeTrustTool: Tool = {
  name: 'detect_trust_signals',
  description: 'Detect trust signals: reviews, badges, testimonials, security seals, guarantees. Returns insights about trust element presence and placement.',
  parameters: AnalyzeTrustParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as AnalyzeTrustParams;
    const insights: CROInsight[] = [];
    const trustElements: DOMNode[] = [];

    // Collect trust elements from DOM tree
    collectTrustElements(context.state.domTree.root, trustElements);
    context.logger.debug(`Found ${trustElements.length} trust elements`);

    const viewportHeight = context.state.viewport.height;

    // Filter by focus area
    let targetElements = trustElements;
    if (params.focusArea === 'above_fold') {
      targetElements = trustElements.filter((el) => {
        const box = el.boundingBox;
        return box && box.y < viewportHeight;
      });
    }

    // Categorize trust elements
    const aboveFoldTrust = trustElements.filter((el) => {
      const box = el.boundingBox;
      return box && box.y < viewportHeight;
    });

    // Check for specific trust signal categories
    const hasReviews = targetElements.some(el => matchesPatterns(el, TRUST_PATTERNS.reviews));
    const hasBadges = targetElements.some(el => matchesPatterns(el, TRUST_PATTERNS.badges));
    const hasGuarantees = targetElements.some(el => matchesPatterns(el, TRUST_PATTERNS.guarantees));
    const hasCertifications = targetElements.some(el => matchesPatterns(el, TRUST_PATTERNS.certifications));

    // TR001: No trust signals above fold
    if (aboveFoldTrust.length === 0) {
      insights.push({
        id: createInsightId(),
        type: INSIGHT_TYPES.NO_TRUST_ABOVE_FOLD,
        severity: 'medium',
        element: '',
        issue: 'No trust signals visible above the fold. First impressions lack credibility indicators',
        recommendation: 'Add trust badges, ratings, or testimonials near primary CTA in hero section',
        category: 'trust',
      });
    }

    // TR002: No reviews/testimonials
    if (!hasReviews) {
      insights.push({
        id: createInsightId(),
        type: INSIGHT_TYPES.NO_REVIEWS,
        severity: 'low',
        element: '',
        issue: 'No review or testimonial elements detected. Social proof missing',
        recommendation: 'Add customer reviews, testimonials, or ratings to build credibility',
        category: 'trust',
      });
    }

    // TR003: No security badges
    if (!hasBadges) {
      insights.push({
        id: createInsightId(),
        type: INSIGHT_TYPES.NO_SECURITY_BADGE,
        severity: 'medium',
        element: '',
        issue: 'No security badges or seals detected. Users may feel unsafe',
        recommendation: 'Add SSL badge, payment security icons, or third-party verification seals near checkout/forms',
        category: 'trust',
      });
    }

    // TR004: No guarantees
    if (!hasGuarantees) {
      insights.push({
        id: createInsightId(),
        type: INSIGHT_TYPES.NO_GUARANTEES,
        severity: 'low',
        element: '',
        issue: 'No guarantee or warranty mentions detected. Risk perception may be high',
        recommendation: 'Add money-back guarantee, satisfaction guarantee, or risk-free trial messaging',
        category: 'trust',
      });
    }

    // TR005: No certifications
    if (!hasCertifications) {
      insights.push({
        id: createInsightId(),
        type: INSIGHT_TYPES.NO_CERTIFICATIONS,
        severity: 'low',
        element: '',
        issue: 'No certification badges detected. Industry credibility not established',
        recommendation: 'Add industry certifications, awards, or accreditation badges if applicable',
        category: 'trust',
      });
    }

    return {
      success: true,
      insights,
      extracted: {
        totalTrustElements: trustElements.length,
        aboveFoldCount: aboveFoldTrust.length,
        hasReviews,
        hasBadges,
        hasGuarantees,
        hasCertifications,
      },
    };
  },
};

/**
 * Recursively collect trust elements from DOM tree
 */
function collectTrustElements(node: DOMNode, result: DOMNode[]): void {
  if (node.croType === 'trust' && node.isVisible) {
    result.push(node);
  }
  for (const child of node.children) {
    collectTrustElements(child, result);
  }
}

/**
 * Check if element matches any pattern in the list
 */
function matchesPatterns(node: DOMNode, patterns: string[]): boolean {
  const text = (node.text || '').toLowerCase();
  const xpath = (node.xpath || '').toLowerCase();

  return patterns.some(pattern => {
    const p = pattern.toLowerCase();
    return text.includes(p) || xpath.includes(p);
  });
}

export default analyzeTrustTool;
