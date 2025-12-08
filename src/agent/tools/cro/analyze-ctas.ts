/**
 * Analyze CTAs Tool
 *
 * Phase 15b: Sample CRO tool for testing CLI tool execution.
 * Analyzes CTA buttons for clarity, prominence, and placement.
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
 * Parameter schema for analyze_ctas tool
 */
export const AnalyzeCTAsParamsSchema = z.object({
  focusArea: z.enum(['above_fold', 'full_page']).optional().default('full_page'),
  minConfidence: z.number().min(0).max(1).optional().default(0.5),
});

export type AnalyzeCTAsParams = z.infer<typeof AnalyzeCTAsParamsSchema>;

/**
 * CTA analysis patterns
 */
const WEAK_CTA_PATTERNS = [
  /^click\s*here$/i,
  /^submit$/i,
  /^learn\s*more$/i,
  /^read\s*more$/i,
  /^more$/i,
  /^continue$/i,
  /^next$/i,
];

/**
 * Analyze CTAs Tool Implementation
 */
export const analyzeCTAsTool: Tool = {
  name: 'analyze_ctas',
  description: 'Analyze CTA buttons and links for clarity, prominence, and placement. Returns insights about CTA effectiveness.',
  parameters: AnalyzeCTAsParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as AnalyzeCTAsParams;
    const insights: CROInsight[] = [];
    const ctaElements: DOMNode[] = [];

    // Collect CTA elements from DOM tree
    collectCTAs(context.state.domTree.root, ctaElements);

    context.logger.debug(`Found ${ctaElements.length} CTA elements`);

    // Filter by focus area if specified
    let targetCTAs = ctaElements;
    if (params.focusArea === 'above_fold') {
      const viewportHeight = context.state.viewport.height;
      targetCTAs = ctaElements.filter((cta) => {
        const box = cta.boundingBox;
        return box && box.y < viewportHeight;
      });
      context.logger.debug(`${targetCTAs.length} CTAs above fold`);
    }

    // Analyze each CTA
    for (const cta of targetCTAs) {
      const ctaInsights = analyzeCTA(cta);
      insights.push(...ctaInsights);
    }

    // Check for missing primary CTA above fold
    if (params.focusArea === 'full_page' || params.focusArea === 'above_fold') {
      const aboveFoldCTAs = ctaElements.filter((cta) => {
        const box = cta.boundingBox;
        return box && box.y < context.state.viewport.height;
      });

      if (aboveFoldCTAs.length === 0) {
        insights.push({
          id: createInsightId(),
          type: 'missing_cta',
          severity: 'high',
          element: '',
          issue: 'No CTA visible above the fold',
          recommendation: 'Add a prominent call-to-action in the hero section to capture immediate user attention',
          category: 'cta',
        });
      }
    }

    // Check for too many CTAs (competing attention)
    if (targetCTAs.length > 5) {
      insights.push({
        id: createInsightId(),
        type: 'cta_overload',
        severity: 'medium',
        element: '',
        issue: `Too many CTAs on page (${targetCTAs.length}). Users may experience decision paralysis`,
        recommendation: 'Reduce the number of CTAs to 2-3 primary actions. Use visual hierarchy to prioritize',
        category: 'cta',
      });
    }

    return {
      success: true,
      insights,
      extracted: {
        totalCTAs: ctaElements.length,
        analyzedCTAs: targetCTAs.length,
        focusArea: params.focusArea,
      },
    };
  },
};

/**
 * Recursively collect CTA elements from DOM tree
 */
function collectCTAs(node: DOMNode, result: DOMNode[]): void {
  if (node.croType === 'cta' && node.isVisible) {
    result.push(node);
  }
  for (const child of node.children) {
    collectCTAs(child, result);
  }
}

/**
 * Analyze a single CTA element
 */
function analyzeCTA(cta: DOMNode): CROInsight[] {
  const insights: CROInsight[] = [];
  const text = cta.text?.trim() || '';

  // Check for weak CTA text
  for (const pattern of WEAK_CTA_PATTERNS) {
    if (pattern.test(text)) {
      insights.push({
        id: createInsightId(),
        type: 'weak_cta_text',
        severity: 'medium',
        element: cta.xpath,
        issue: `Weak CTA text: "${text}". Generic CTAs reduce click-through rates`,
        recommendation: 'Use action-oriented, benefit-focused text (e.g., "Get Your Free Quote" instead of "Click Here")',
        category: 'cta',
        evidence: { text },
      });
      break;
    }
  }

  // Check for very short CTA text
  if (text.length < 3 && text.length > 0) {
    insights.push({
      id: createInsightId(),
      type: 'short_cta_text',
      severity: 'low',
      element: cta.xpath,
      issue: `CTA text too short: "${text}". May not communicate value clearly`,
      recommendation: 'Expand CTA text to clearly communicate the action and benefit',
      category: 'cta',
      evidence: { text },
    });
  }

  // Check for missing text (icon-only buttons)
  if (!text) {
    insights.push({
      id: createInsightId(),
      type: 'no_cta_text',
      severity: 'medium',
      element: cta.xpath,
      issue: 'CTA button has no visible text. Icon-only buttons may confuse users',
      recommendation: 'Add descriptive text or aria-label for accessibility and clarity',
      category: 'cta',
    });
  }

  // Check for small click target
  if (cta.boundingBox) {
    const { width, height } = cta.boundingBox;
    const area = width * height;

    if (area < 1600) { // Less than 40x40
      insights.push({
        id: createInsightId(),
        type: 'small_click_target',
        severity: 'medium',
        element: cta.xpath,
        issue: `CTA click target too small (${Math.round(width)}x${Math.round(height)}px). Difficult for mobile users`,
        recommendation: 'Increase button size to at least 44x44px for touch accessibility',
        category: 'cta',
        evidence: { text: `${Math.round(width)}x${Math.round(height)}px` },
      });
    }
  }

  return insights;
}

export default analyzeCTAsTool;
