/**
 * CTA Heuristic Rules - Phase 18c (T107a, T107b)
 *
 * H001: vague_cta_text - Generic CTA text (Learn More, Click Here, Submit)
 * H002: no_cta_above_fold - No CTA visible in initial viewport
 */

import type { HeuristicRule } from '../types.js';
import type { PageState, CROInsight, DOMNode } from '../../models/index.js';
import { v4 as uuid } from 'uuid';

/**
 * Generic CTA text patterns to flag
 */
const VAGUE_CTA_PATTERNS = [
  /^click\s*here$/i,
  /^learn\s*more$/i,
  /^read\s*more$/i,
  /^submit$/i,
  /^go$/i,
  /^continue$/i,
  /^next$/i,
  /^more$/i,
  /^info$/i,
  /^details$/i,
  /^here$/i,
  /^link$/i,
  /^button$/i,
];

/**
 * Check if text matches vague CTA patterns
 */
function isVagueCTAText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return VAGUE_CTA_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Find all CTA nodes in DOM tree
 */
function findCTANodes(node: DOMNode): DOMNode[] {
  const ctas: DOMNode[] = [];

  if (node.croType === 'cta' && node.isVisible) {
    ctas.push(node);
  }

  for (const child of node.children) {
    ctas.push(...findCTANodes(child));
  }

  return ctas;
}

/**
 * H001: Vague CTA Text
 *
 * CTAs should have specific, action-oriented text that tells users
 * exactly what will happen when they click.
 */
export const vagueCTATextRule: HeuristicRule = {
  id: 'H001',
  name: 'vague_cta_text',
  description: 'CTAs should have specific, action-oriented text',
  category: 'cta',
  severity: 'medium',
  businessTypes: [], // Applies to all business types

  check: (state: PageState): CROInsight | null => {
    const ctaNodes = findCTANodes(state.domTree.root);

    for (const cta of ctaNodes) {
      if (isVagueCTAText(cta.text)) {
        return {
          id: uuid(),
          category: 'cta',
          type: 'vague_cta_text',
          severity: 'medium',
          element: cta.xpath,
          issue: `CTA has vague text "${cta.text}" that doesn't communicate value or action`,
          recommendation: `Replace "${cta.text}" with specific, action-oriented text that tells users what they'll get (e.g., "Get Free Quote", "Start 14-Day Trial", "Download PDF")`,
          evidence: {
            text: cta.text,
            selector: cta.xpath,
          },
          heuristicId: 'H001',
        };
      }
    }

    return null;
  },
};

/**
 * H002: No CTA Above Fold
 *
 * At least one call-to-action should be visible without scrolling
 * to capture users who don't scroll.
 */
export const noCTAAboveFoldRule: HeuristicRule = {
  id: 'H002',
  name: 'no_cta_above_fold',
  description: 'At least one CTA should be visible without scrolling',
  category: 'cta',
  severity: 'high',
  businessTypes: [], // Applies to all business types

  check: (state: PageState): CROInsight | null => {
    const ctaNodes = findCTANodes(state.domTree.root);
    const viewportHeight = state.viewport.height;

    // Check if any CTA is above the fold
    const ctaAboveFold = ctaNodes.some((cta) => {
      if (!cta.boundingBox) return false;
      // CTA is above fold if its top edge is within viewport
      return cta.boundingBox.y < viewportHeight;
    });

    if (!ctaAboveFold && ctaNodes.length > 0) {
      return {
        id: uuid(),
        category: 'cta',
        type: 'no_cta_above_fold',
        severity: 'high',
        element: '/html/body',
        issue: `No call-to-action is visible above the fold. ${ctaNodes.length} CTA(s) found but all require scrolling to see`,
        recommendation:
          'Move a primary CTA into the initial viewport, ideally near the main headline or hero section',
        evidence: {
          text: `${ctaNodes.length} CTAs found, viewport height: ${viewportHeight}px`,
        },
        heuristicId: 'H002',
      };
    }

    // Also flag if no CTAs at all
    if (ctaNodes.length === 0) {
      return {
        id: uuid(),
        category: 'cta',
        type: 'no_cta_above_fold',
        severity: 'high',
        element: '/html/body',
        issue: 'No call-to-action elements found on the page',
        recommendation:
          'Add a clear, visible CTA that guides users toward the desired action',
        evidence: {
          text: 'No CTA elements detected',
        },
        heuristicId: 'H002',
      };
    }

    return null;
  },
};

/**
 * All CTA rules
 */
export const ctaRules: HeuristicRule[] = [vagueCTATextRule, noCTAAboveFoldRule];
