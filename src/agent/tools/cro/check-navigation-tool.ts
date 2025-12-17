/**
 * Check Navigation Tool
 *
 * Phase 17b (T097): Analyzes navigation structure and usability.
 * Checks for main nav, breadcrumbs, search, nav depth, home link.
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
 * Helper to coerce string/boolean to boolean (handles LLM passing "true"/"false")
 */
const coerceBoolean = z.preprocess((val) => {
  if (typeof val === 'string') {
    return val.toLowerCase() === 'true';
  }
  return val;
}, z.boolean());

/**
 * Parameter schema for check_navigation tool
 */
export const CheckNavigationParamsSchema = z.object({
  includeFooter: coerceBoolean.optional().default(true).describe('Include footer navigation in analysis'),
});

export type CheckNavigationParams = z.infer<typeof CheckNavigationParamsSchema>;

/**
 * Insight type constants for navigation analysis
 */
const INSIGHT_TYPES = {
  NO_MAIN_NAV: 'no_main_nav',
  NO_BREADCRUMBS: 'no_breadcrumbs',
  NO_SEARCH: 'no_search',
  DEEP_NAV_NESTING: 'deep_nav_nesting',
  NO_HOME_LINK: 'no_home_link',
} as const;

/**
 * Detection patterns for navigation elements
 */
const NAV_PATTERNS = {
  mainNav: ['nav', 'navigation', 'main-nav', 'primary-nav', 'site-nav', 'navbar'],
  breadcrumbs: ['breadcrumb', 'crumbs', 'bread-crumb'],
  search: ['search', 'site-search', 'searchbox', 'search-form'],
  homeLink: ['home', 'logo', 'brand', 'site-logo'],
};

/**
 * Maximum recommended nav depth
 */
const MAX_NAV_DEPTH = 3;

/**
 * Check Navigation Tool Implementation
 */
export const checkNavigationTool: Tool = {
  name: 'check_navigation',
  description: 'Analyze navigation structure: main nav presence, breadcrumbs, search, menu depth, home link. Returns usability insights.',
  parameters: CheckNavigationParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as CheckNavigationParams;
    const insights: CROInsight[] = [];
    const navElements: DOMNode[] = [];

    // Collect navigation elements from DOM tree
    collectNavElements(context.state.domTree.root, navElements);
    context.logger.debug(`Found ${navElements.length} navigation elements`);

    // Filter out footer nav if not included
    let targetElements = navElements;
    if (!params.includeFooter) {
      targetElements = navElements.filter(el => !isFooterElement(el));
    }

    // Check for main navigation
    const hasMainNav = targetElements.some(el => isMainNavigation(el));
    const hasBreadcrumbs = hasBreadcrumbElement(context.state.domTree.root);
    const hasSearch = hasSearchElement(context.state.domTree.root);
    const hasHomeLink = hasHomeLinkElement(context.state.domTree.root);
    const navDepth = calculateNavDepth(context.state.domTree.root);

    // NAV001: No main navigation
    if (!hasMainNav) {
      insights.push({
        id: createInsightId(),
        type: INSIGHT_TYPES.NO_MAIN_NAV,
        severity: 'high',
        element: '',
        issue: 'No main navigation element (<nav> or role="navigation") detected',
        recommendation: 'Add semantic <nav> element for primary site navigation with clear links',
        category: 'navigation',
      });
    }

    // NAV002: No breadcrumbs (only flag on non-home pages)
    const isHomePage = isHomePageUrl(context.state.url);
    if (!hasBreadcrumbs && !isHomePage) {
      insights.push({
        id: createInsightId(),
        type: INSIGHT_TYPES.NO_BREADCRUMBS,
        severity: 'low',
        element: '',
        issue: 'No breadcrumb navigation detected on non-home page',
        recommendation: 'Add breadcrumbs to help users understand site hierarchy and navigate back',
        category: 'navigation',
      });
    }

    // NAV003: No search
    if (!hasSearch) {
      insights.push({
        id: createInsightId(),
        type: INSIGHT_TYPES.NO_SEARCH,
        severity: 'medium',
        element: '',
        issue: 'No search functionality detected',
        recommendation: 'Add site search to help users find content quickly, especially for e-commerce',
        category: 'navigation',
      });
    }

    // NAV004: Deep navigation nesting
    if (navDepth > MAX_NAV_DEPTH) {
      insights.push({
        id: createInsightId(),
        type: INSIGHT_TYPES.DEEP_NAV_NESTING,
        severity: 'low',
        element: '',
        issue: `Navigation menu has ${navDepth} levels of nesting. Deep menus increase cognitive load`,
        recommendation: `Flatten navigation to ${MAX_NAV_DEPTH} levels or fewer. Use mega menus for complex hierarchies`,
        category: 'navigation',
        evidence: { text: `${navDepth} levels` },
      });
    }

    // NAV005: No home link
    if (!hasHomeLink) {
      insights.push({
        id: createInsightId(),
        type: INSIGHT_TYPES.NO_HOME_LINK,
        severity: 'low',
        element: '',
        issue: 'No clear link to homepage (home link or clickable logo) detected',
        recommendation: 'Add visible home link or make logo clickable to navigate to homepage',
        category: 'navigation',
      });
    }

    return {
      success: true,
      insights,
      extracted: {
        totalNavElements: navElements.length,
        hasMainNav,
        hasBreadcrumbs,
        hasSearch,
        hasHomeLink,
        navDepth,
        isHomePage,
      },
    };
  },
};

/**
 * Recursively collect navigation elements from DOM tree
 */
function collectNavElements(node: DOMNode, result: DOMNode[]): void {
  if (node.croType === 'navigation' && node.isVisible) {
    result.push(node);
  }
  for (const child of node.children) {
    collectNavElements(child, result);
  }
}

/**
 * Check if element is in footer area
 */
function isFooterElement(node: DOMNode): boolean {
  const xpath = (node.xpath || '').toLowerCase();
  return xpath.includes('footer');
}

/**
 * Check if element is main navigation
 */
function isMainNavigation(node: DOMNode): boolean {
  const tagName = node.tagName.toUpperCase();
  const text = (node.text || '').toLowerCase();
  const xpath = (node.xpath || '').toLowerCase();

  // Check for nav tag
  if (tagName === 'NAV') {
    return true;
  }

  // Check for role="navigation"
  if (text.includes('role="navigation"')) {
    return true;
  }

  // Check for common nav class patterns
  return NAV_PATTERNS.mainNav.some(pattern => xpath.includes(pattern) || text.includes(pattern));
}

/**
 * Check for breadcrumb element in tree
 */
function hasBreadcrumbElement(node: DOMNode): boolean {
  const text = (node.text || '').toLowerCase();
  const xpath = (node.xpath || '').toLowerCase();

  if (NAV_PATTERNS.breadcrumbs.some(p => text.includes(p) || xpath.includes(p))) {
    return true;
  }

  // Check for aria-label breadcrumb
  if (text.includes('aria-label') && text.includes('breadcrumb')) {
    return true;
  }

  for (const child of node.children) {
    if (hasBreadcrumbElement(child)) {
      return true;
    }
  }
  return false;
}

/**
 * Check for search element in tree
 */
function hasSearchElement(node: DOMNode): boolean {
  const text = (node.text || '').toLowerCase();
  const xpath = (node.xpath || '').toLowerCase();

  // Check for search input
  if (text.includes('type="search"')) {
    return true;
  }

  // Check for role="search"
  if (text.includes('role="search"')) {
    return true;
  }

  // Check for search patterns
  if (NAV_PATTERNS.search.some(p => xpath.includes(p) || text.includes(p))) {
    return true;
  }

  for (const child of node.children) {
    if (hasSearchElement(child)) {
      return true;
    }
  }
  return false;
}

/**
 * Check for home link element in tree
 */
function hasHomeLinkElement(node: DOMNode): boolean {
  const text = (node.text || '').toLowerCase();
  const xpath = (node.xpath || '').toLowerCase();
  const tagName = node.tagName.toUpperCase();

  // Check for link to home
  if (tagName === 'A') {
    if (text.includes('href="/"') || text.includes("href='/'") || text.includes('href="home"')) {
      return true;
    }
    if (text === 'home' || NAV_PATTERNS.homeLink.some(p => text.includes(p))) {
      return true;
    }
  }

  // Check for logo that could be home link
  if (xpath.includes('logo') || xpath.includes('brand')) {
    return true;
  }

  for (const child of node.children) {
    if (hasHomeLinkElement(child)) {
      return true;
    }
  }
  return false;
}

/**
 * Calculate maximum navigation depth
 */
function calculateNavDepth(node: DOMNode): number {
  // Find nav elements and calculate their depth
  let maxDepth = 0;

  function findNavDepth(n: DOMNode, currentDepth: number): void {
    if (n.croType === 'navigation' && n.isVisible) {
      // Count nested lists/menus
      const depth = countNestedLists(n);
      maxDepth = Math.max(maxDepth, depth);
    }
    for (const child of n.children) {
      findNavDepth(child, currentDepth + 1);
    }
  }

  findNavDepth(node, 0);
  return maxDepth;
}

/**
 * Count nested list depth in navigation
 */
function countNestedLists(node: DOMNode): number {
  const tagName = node.tagName.toUpperCase();

  if (tagName === 'UL' || tagName === 'OL') {
    let maxChildDepth = 0;
    for (const child of node.children) {
      const childDepth = countNestedLists(child);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }
    return 1 + maxChildDepth;
  }

  let maxDepth = 0;
  for (const child of node.children) {
    const childDepth = countNestedLists(child);
    maxDepth = Math.max(maxDepth, childDepth);
  }
  return maxDepth;
}

/**
 * Check if URL is likely a home page
 */
function isHomePageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    return path === '/' || path === '' || path === '/index.html' || path === '/home';
  } catch {
    return false;
  }
}

export default checkNavigationTool;
