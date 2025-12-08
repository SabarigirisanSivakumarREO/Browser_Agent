/**
 * Analyze Value Proposition Tool
 *
 * Phase 17b (T096): Analyzes headlines and value proposition clarity.
 * Checks H1/H2 for specificity, length, and benefit communication.
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
 * Parameter schema for assess_value_prop tool
 */
export const AnalyzeValuePropParamsSchema = z.object({
  checkH1Only: z.boolean().optional().default(false).describe('Only analyze H1 elements, ignore H2-H6'),
});

export type AnalyzeValuePropParams = z.infer<typeof AnalyzeValuePropParamsSchema>;

/**
 * Insight type constants for value prop analysis
 */
const INSIGHT_TYPES = {
  MISSING_H1: 'missing_h1',
  MULTIPLE_H1: 'multiple_h1',
  GENERIC_HEADLINE: 'generic_headline',
  NO_SUBHEADLINE: 'no_subheadline',
  HEADLINE_TOO_LONG: 'headline_too_long',
} as const;

/**
 * Patterns for generic/weak headlines
 */
const GENERIC_PATTERNS = [
  /^welcome$/i,
  /^home$/i,
  /^homepage$/i,
  /^untitled$/i,
  /^page\s*\d*$/i,
  /^about$/i,
  /^about us$/i,
  /^our company$/i,
  /^hello$/i,
  /^hi$/i,
];

/**
 * Maximum recommended word count for H1
 */
const MAX_H1_WORDS = 10;

/**
 * Analyze Value Proposition Tool Implementation
 */
export const analyzeValuePropTool: Tool = {
  name: 'assess_value_prop',
  description: 'Analyze headlines and value proposition clarity. Checks H1/H2 for specificity, length, and benefit communication.',
  parameters: AnalyzeValuePropParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as AnalyzeValuePropParams;
    const insights: CROInsight[] = [];
    const valueProps: DOMNode[] = [];

    // Collect value_prop elements from DOM tree
    collectValueProps(context.state.domTree.root, valueProps);
    context.logger.debug(`Found ${valueProps.length} value prop elements`);

    // Separate H1 and H2 elements
    const h1Elements = valueProps.filter(el => el.tagName.toUpperCase() === 'H1');
    const h2Elements = valueProps.filter(el => el.tagName.toUpperCase() === 'H2');

    context.logger.debug(`H1: ${h1Elements.length}, H2: ${h2Elements.length}`);

    // VP001: Missing H1
    if (h1Elements.length === 0) {
      insights.push({
        id: createInsightId(),
        type: INSIGHT_TYPES.MISSING_H1,
        severity: 'high',
        element: '',
        issue: 'Page has no H1 heading. Primary value proposition unclear to visitors',
        recommendation: 'Add clear H1 that communicates the core benefit or unique offering',
        category: 'value_prop',
      });
    }

    // VP002: Multiple H1 elements
    if (h1Elements.length > 1) {
      insights.push({
        id: createInsightId(),
        type: INSIGHT_TYPES.MULTIPLE_H1,
        severity: 'medium',
        element: h1Elements[1]?.xpath || '',
        issue: `Page has ${h1Elements.length} H1 elements. Dilutes focus and SEO value`,
        recommendation: 'Use single H1 for main value prop, use H2-H6 for section headings',
        category: 'value_prop',
        evidence: { text: `Found ${h1Elements.length} H1 elements` },
      });
    }

    // Analyze each H1
    for (const h1 of h1Elements) {
      const text = (h1.text || '').trim();

      // VP003: Generic headline
      if (isGenericHeadline(text)) {
        insights.push({
          id: createInsightId(),
          type: INSIGHT_TYPES.GENERIC_HEADLINE,
          severity: 'medium',
          element: h1.xpath,
          issue: `Generic H1: "${text}". Fails to communicate unique value`,
          recommendation: 'Rewrite to highlight specific benefit, outcome, or unique selling point',
          category: 'value_prop',
          evidence: { text },
        });
      }

      // VP005: Headline too long
      const wordCount = countWords(text);
      if (wordCount > MAX_H1_WORDS) {
        insights.push({
          id: createInsightId(),
          type: INSIGHT_TYPES.HEADLINE_TOO_LONG,
          severity: 'low',
          element: h1.xpath,
          issue: `H1 has ${wordCount} words. Long headlines may lose reader attention`,
          recommendation: `Condense to ${MAX_H1_WORDS} words or fewer, move details to subheadline`,
          category: 'value_prop',
          evidence: { text },
        });
      }
    }

    // VP004: No subheadline (only check if not H1-only mode)
    if (!params.checkH1Only && h1Elements.length > 0 && h2Elements.length === 0) {
      insights.push({
        id: createInsightId(),
        type: INSIGHT_TYPES.NO_SUBHEADLINE,
        severity: 'low',
        element: '',
        issue: 'H1 present but no H2 subheadline to support value proposition',
        recommendation: 'Add H2 subheadline to elaborate on the primary benefit or provide context',
        category: 'value_prop',
      });
    }

    return {
      success: true,
      insights,
      extracted: {
        h1Count: h1Elements.length,
        h2Count: h2Elements.length,
        h1Text: h1Elements[0]?.text?.trim() || null,
        h1WordCount: h1Elements[0] ? countWords(h1Elements[0].text || '') : 0,
      },
    };
  },
};

/**
 * Recursively collect value_prop elements from DOM tree
 */
function collectValueProps(node: DOMNode, result: DOMNode[]): void {
  if (node.croType === 'value_prop' && node.isVisible) {
    result.push(node);
  }
  for (const child of node.children) {
    collectValueProps(child, result);
  }
}

/**
 * Check if headline text matches generic patterns
 */
function isGenericHeadline(text: string): boolean {
  const trimmed = text.trim();
  return GENERIC_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  const trimmed = (text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export default analyzeValuePropTool;
