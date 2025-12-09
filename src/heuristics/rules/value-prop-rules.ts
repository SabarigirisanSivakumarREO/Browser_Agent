/**
 * Value Proposition Heuristic Rules - Phase 18c (T110a, T110b)
 *
 * H007: unclear_value_prop - Missing H1 or H1 is generic
 * H008: headline_too_long - H1 has >10 words
 */

import type { HeuristicRule } from '../types.js';
import type { PageState, CROInsight, DOMNode } from '../../models/index.js';
import { v4 as uuid } from 'uuid';

/**
 * Generic headline patterns that don't communicate value
 */
const GENERIC_HEADLINE_PATTERNS = [
  /^welcome$/i,
  /^welcome to/i,
  /^home$/i,
  /^homepage$/i,
  /^untitled$/i,
  /^page title$/i,
  /^main$/i,
  /^header$/i,
  /^title$/i,
  /^heading$/i,
  /^your company$/i,
  /^company name$/i,
  /^logo$/i,
];

/**
 * Maximum recommended words for headline
 */
const MAX_HEADLINE_WORDS = 10;

/**
 * Check if headline matches generic patterns
 */
function isGenericHeadline(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true; // Empty is generic

  return GENERIC_HEADLINE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Count words in a string
 */
function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Find H1 elements in DOM tree
 */
function findH1Nodes(node: DOMNode): DOMNode[] {
  const h1s: DOMNode[] = [];

  if (node.tagName.toLowerCase() === 'h1' && node.isVisible) {
    h1s.push(node);
  }

  for (const child of node.children) {
    h1s.push(...findH1Nodes(child));
  }

  return h1s;
}

/**
 * Find value prop elements in DOM tree
 */
function findValuePropNodes(node: DOMNode): DOMNode[] {
  const valueProps: DOMNode[] = [];

  if (node.croType === 'value_prop' && node.isVisible) {
    valueProps.push(node);
  }

  for (const child of node.children) {
    valueProps.push(...findValuePropNodes(child));
  }

  return valueProps;
}

/**
 * H007: Unclear Value Proposition
 *
 * The main headline (H1) should clearly communicate the value
 * proposition and what the page/product offers.
 */
export const unclearValuePropRule: HeuristicRule = {
  id: 'H007',
  name: 'unclear_value_prop',
  description: 'Main headline should clearly communicate value proposition',
  category: 'value_prop',
  severity: 'high',
  businessTypes: [], // Applies to all business types

  check: (state: PageState): CROInsight | null => {
    const h1Nodes = findH1Nodes(state.domTree.root);

    // No H1 at all
    if (h1Nodes.length === 0) {
      // Check if there are any value prop elements that could serve as headline
      const valueProps = findValuePropNodes(state.domTree.root);

      if (valueProps.length === 0) {
        return {
          id: uuid(),
          category: 'value_prop',
          type: 'unclear_value_prop',
          severity: 'high',
          element: '/html/body',
          issue: 'Page is missing an H1 headline to communicate value proposition',
          recommendation:
            'Add a clear H1 headline that communicates what visitors will get and why they should care',
          evidence: {
            text: 'No H1 element found on page',
          },
          heuristicId: 'H007',
        };
      }
    }

    // Check first H1 for generic text
    const primaryH1 = h1Nodes[0];
    if (primaryH1 && isGenericHeadline(primaryH1.text)) {
      return {
        id: uuid(),
        category: 'value_prop',
        type: 'unclear_value_prop',
        severity: 'high',
        element: primaryH1.xpath,
        issue: `H1 headline "${primaryH1.text}" is too generic and doesn't communicate value`,
        recommendation:
          'Replace with a specific headline that tells visitors what unique benefit they\'ll receive',
        evidence: {
          text: primaryH1.text,
          selector: primaryH1.xpath,
        },
        heuristicId: 'H007',
      };
    }

    return null;
  },
};

/**
 * H008: Headline Too Long
 *
 * Headlines should be concise and scannable. More than 10 words
 * can reduce comprehension and impact.
 */
export const headlineTooLongRule: HeuristicRule = {
  id: 'H008',
  name: 'headline_too_long',
  description: 'Headlines should be concise (10 words or fewer)',
  category: 'value_prop',
  severity: 'low',
  businessTypes: [], // Applies to all business types

  check: (state: PageState): CROInsight | null => {
    const h1Nodes = findH1Nodes(state.domTree.root);

    if (h1Nodes.length === 0) {
      return null; // H007 will catch missing H1
    }

    const primaryH1 = h1Nodes[0]!;
    const wordCount = countWords(primaryH1.text);

    if (wordCount > MAX_HEADLINE_WORDS) {
      return {
        id: uuid(),
        category: 'value_prop',
        type: 'headline_too_long',
        severity: 'low',
        element: primaryH1.xpath,
        issue: `H1 headline has ${wordCount} words, which exceeds the recommended maximum of ${MAX_HEADLINE_WORDS}`,
        recommendation:
          'Shorten the headline to 10 words or fewer for better scannability. Move details to a subheadline',
        evidence: {
          text: primaryH1.text,
          selector: primaryH1.xpath,
        },
        heuristicId: 'H008',
      };
    }

    return null;
  },
};

/**
 * All value prop rules
 */
export const valuePropRules: HeuristicRule[] = [unclearValuePropRule, headlineTooLongRule];
