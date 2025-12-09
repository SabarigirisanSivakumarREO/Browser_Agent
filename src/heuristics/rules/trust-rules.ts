/**
 * Trust Heuristic Rules - Phase 18c (T109a, T109b)
 *
 * H005: no_trust_above_fold - No trust signals in initial viewport
 * H006: no_security_badge - Checkout/payment without security badge (ecommerce/banking/insurance)
 */

import type { HeuristicRule } from '../types.js';
import type { PageState, CROInsight, DOMNode, BusinessType } from '../../models/index.js';
import { v4 as uuid } from 'uuid';

/**
 * Find all trust signal nodes in DOM tree
 */
function findTrustNodes(node: DOMNode): DOMNode[] {
  const trustNodes: DOMNode[] = [];

  if (node.croType === 'trust' && node.isVisible) {
    trustNodes.push(node);
  }

  for (const child of node.children) {
    trustNodes.push(...findTrustNodes(child));
  }

  return trustNodes;
}

/**
 * Check if any node contains security-related content
 */
function isSecurityBadge(node: DOMNode): boolean {
  const text = node.text.toLowerCase();
  const className = (node.attributes?.class || '').toLowerCase();
  const alt = (node.attributes?.alt || '').toLowerCase();

  const securityKeywords = [
    'ssl',
    'secure',
    'security',
    'encrypted',
    'lock',
    'safe',
    'verified',
    'trusted',
    'norton',
    'mcafee',
    'verisign',
    'comodo',
    'digicert',
    'symantec',
    'truste',
    'bbb',
    'pci',
    '256-bit',
    '128-bit',
  ];

  return securityKeywords.some(
    (keyword) =>
      text.includes(keyword) || className.includes(keyword) || alt.includes(keyword)
  );
}

/**
 * Check if page appears to be a checkout/payment page
 */
function isCheckoutPage(state: PageState): boolean {
  const url = state.url.toLowerCase();
  const title = state.title.toLowerCase();

  const checkoutPatterns = [
    'checkout',
    'payment',
    'pay',
    'billing',
    'cart',
    'order',
    'purchase',
    'buy',
  ];

  return checkoutPatterns.some(
    (pattern) => url.includes(pattern) || title.includes(pattern)
  );
}

/**
 * Find all nodes in DOM tree recursively
 */
function findAllNodes(node: DOMNode): DOMNode[] {
  const nodes: DOMNode[] = [node];

  for (const child of node.children) {
    nodes.push(...findAllNodes(child));
  }

  return nodes;
}

/**
 * H005: No Trust Signals Above Fold
 *
 * Trust signals (badges, reviews, testimonials) should be visible
 * in the initial viewport to build credibility early.
 */
export const noTrustAboveFoldRule: HeuristicRule = {
  id: 'H005',
  name: 'no_trust_above_fold',
  description: 'Trust signals should be visible above the fold',
  category: 'trust',
  severity: 'medium',
  businessTypes: [], // Applies to all business types

  check: (state: PageState): CROInsight | null => {
    const trustNodes = findTrustNodes(state.domTree.root);
    const viewportHeight = state.viewport.height;

    // Check if any trust signal is above the fold
    const trustAboveFold = trustNodes.some((trust) => {
      if (!trust.boundingBox) return false;
      return trust.boundingBox.y < viewportHeight;
    });

    if (!trustAboveFold && trustNodes.length > 0) {
      return {
        id: uuid(),
        category: 'trust',
        type: 'no_trust_above_fold',
        severity: 'medium',
        element: '/html/body',
        issue: `No trust signals visible above the fold. ${trustNodes.length} trust element(s) found but all require scrolling`,
        recommendation:
          'Move key trust signals (security badges, customer reviews, certifications) into the initial viewport',
        evidence: {
          text: `${trustNodes.length} trust elements found below fold, viewport height: ${viewportHeight}px`,
        },
        heuristicId: 'H005',
      };
    }

    // Also flag if no trust signals at all
    if (trustNodes.length === 0) {
      return {
        id: uuid(),
        category: 'trust',
        type: 'no_trust_above_fold',
        severity: 'medium',
        element: '/html/body',
        issue: 'No trust signals found on the page (badges, reviews, testimonials)',
        recommendation:
          'Add trust signals such as security badges, customer testimonials, ratings, or certifications',
        evidence: {
          text: 'No trust elements detected',
        },
        heuristicId: 'H005',
      };
    }

    return null;
  },
};

/**
 * H006: No Security Badge on Checkout
 *
 * Checkout and payment pages should prominently display security
 * badges to reassure users about data safety.
 */
export const noSecurityBadgeRule: HeuristicRule = {
  id: 'H006',
  name: 'no_security_badge',
  description: 'Checkout pages should display security badges',
  category: 'trust',
  severity: 'high',
  businessTypes: ['ecommerce', 'banking', 'insurance'], // Only these business types

  check: (state: PageState, businessType: BusinessType): CROInsight | null => {
    // Only check on checkout/payment pages
    if (!isCheckoutPage(state)) {
      return null;
    }

    // Look for security badges
    const allNodes = findAllNodes(state.domTree.root);
    const hasSecurityBadge = allNodes.some(
      (node) => node.isVisible && isSecurityBadge(node)
    );

    if (!hasSecurityBadge) {
      return {
        id: uuid(),
        category: 'trust',
        type: 'no_security_badge',
        severity: 'high',
        element: '/html/body',
        issue: `Checkout/payment page lacks visible security badges for ${businessType} site`,
        recommendation:
          'Add prominent security badges (SSL, secure checkout, payment processor logos) near payment forms and CTAs',
        evidence: {
          text: `Business type: ${businessType}, Page URL contains checkout indicators`,
        },
        heuristicId: 'H006',
      };
    }

    return null;
  },
};

/**
 * All trust rules
 */
export const trustRules: HeuristicRule[] = [noTrustAboveFoldRule, noSecurityBadgeRule];
