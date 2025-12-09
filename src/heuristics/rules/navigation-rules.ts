/**
 * Navigation Heuristic Rules - Phase 18c (T111a, T111b)
 *
 * H009: no_breadcrumbs - Category/product page without breadcrumb navigation
 * H010: no_search_ecommerce - Ecommerce site without visible search
 */

import type { HeuristicRule } from '../types.js';
import type { PageState, CROInsight, DOMNode, BusinessType } from '../../models/index.js';
import { v4 as uuid } from 'uuid';

/**
 * URL patterns indicating a product/category page
 */
const PRODUCT_CATEGORY_PATTERNS = [
  /\/product\//i,
  /\/products\//i,
  /\/item\//i,
  /\/items\//i,
  /\/category\//i,
  /\/categories\//i,
  /\/catalog\//i,
  /\/shop\//i,
  /\/collection\//i,
  /\/collections\//i,
  /\/p\//i,
  /\/c\//i,
  /\/pd\//i,
  /\/-p-/i,
  /\/-c-/i,
];


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
 * Check if a node appears to be a breadcrumb element
 */
function isBreadcrumb(node: DOMNode): boolean {
  const tagName = node.tagName.toLowerCase();
  const className = (node.attributes?.class || '').toLowerCase();
  const role = (node.attributes?.role || '').toLowerCase();
  const ariaLabel = (node.attributes?.['aria-label'] || '').toLowerCase();
  const itemType = (node.attributes?.itemtype || '').toLowerCase();

  // Check for breadcrumb-specific indicators
  const breadcrumbIndicators = [
    className.includes('breadcrumb'),
    role === 'navigation' && ariaLabel.includes('breadcrumb'),
    itemType.includes('breadcrumblist'),
    node.attributes?.['aria-label']?.toLowerCase().includes('breadcrumb'),
    tagName === 'nav' && className.includes('breadcrumb'),
    tagName === 'ol' && className.includes('breadcrumb'),
  ];

  return breadcrumbIndicators.some((indicator) => indicator);
}

/**
 * Check if a node is a search element
 */
function isSearchElement(node: DOMNode): boolean {
  const tagName = node.tagName.toLowerCase();
  const className = (node.attributes?.class || '').toLowerCase();
  const type = (node.attributes?.type || '').toLowerCase();
  const role = (node.attributes?.role || '').toLowerCase();
  const placeholder = (node.attributes?.placeholder || '').toLowerCase();
  const ariaLabel = (node.attributes?.['aria-label'] || '').toLowerCase();
  const name = (node.attributes?.name || '').toLowerCase();
  const id = (node.attributes?.id || '').toLowerCase();

  // Check for search input
  if (tagName === 'input') {
    if (type === 'search') return true;
    if (placeholder.includes('search')) return true;
    if (ariaLabel.includes('search')) return true;
    if (name.includes('search') || name === 'q' || name === 'query') return true;
    if (id.includes('search')) return true;
  }

  // Check for search form/button
  if (role === 'search') return true;
  if (className.includes('search')) return true;
  if (ariaLabel.includes('search')) return true;

  // Check for search button
  if (tagName === 'button') {
    const text = node.text.toLowerCase();
    if (text.includes('search') || className.includes('search')) return true;
  }

  return false;
}

/**
 * Check if URL matches product/category page patterns
 */
function isProductCategoryPage(url: string): boolean {
  return PRODUCT_CATEGORY_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * H009: No Breadcrumbs
 *
 * Category and product pages should have breadcrumb navigation
 * to help users understand site hierarchy and navigate easily.
 */
export const noBreadcrumbsRule: HeuristicRule = {
  id: 'H009',
  name: 'no_breadcrumbs',
  description: 'Category/product pages should have breadcrumb navigation',
  category: 'navigation',
  severity: 'low',
  businessTypes: [], // Applies to all business types

  check: (state: PageState): CROInsight | null => {
    // Only check product/category pages
    if (!isProductCategoryPage(state.url)) {
      return null;
    }

    // Look for breadcrumb elements
    const allNodes = findAllNodes(state.domTree.root);
    const hasBreadcrumb = allNodes.some((node) => node.isVisible && isBreadcrumb(node));

    if (!hasBreadcrumb) {
      return {
        id: uuid(),
        category: 'navigation',
        type: 'no_breadcrumbs',
        severity: 'low',
        element: '/html/body',
        issue: 'Product/category page lacks breadcrumb navigation',
        recommendation:
          'Add breadcrumb navigation to show users where they are in the site hierarchy and enable easy navigation back to parent categories',
        evidence: {
          text: `URL pattern suggests product/category page: ${state.url}`,
        },
        heuristicId: 'H009',
      };
    }

    return null;
  },
};

/**
 * H010: No Search on Ecommerce
 *
 * Ecommerce sites should have a visible search function
 * to help users find products quickly.
 */
export const noSearchEcommerceRule: HeuristicRule = {
  id: 'H010',
  name: 'no_search_ecommerce',
  description: 'Ecommerce sites should have visible search functionality',
  category: 'navigation',
  severity: 'medium',
  businessTypes: ['ecommerce'], // Only ecommerce sites

  check: (state: PageState, businessType: BusinessType): CROInsight | null => {
    // Only check ecommerce sites (enforced by businessTypes filter, but double-check)
    if (businessType !== 'ecommerce') {
      return null;
    }

    // Look for search elements
    const allNodes = findAllNodes(state.domTree.root);
    const hasSearch = allNodes.some((node) => node.isVisible && isSearchElement(node));

    if (!hasSearch) {
      return {
        id: uuid(),
        category: 'navigation',
        type: 'no_search_ecommerce',
        severity: 'medium',
        element: '/html/body',
        issue: 'Ecommerce site lacks visible search functionality',
        recommendation:
          'Add a prominent search bar in the header to help users find products quickly. Consider adding autocomplete suggestions',
        evidence: {
          text: `Business type: ${businessType}, no search input or button found`,
        },
        heuristicId: 'H010',
      };
    }

    return null;
  },
};

/**
 * All navigation rules
 */
export const navigationRules: HeuristicRule[] = [noBreadcrumbsRule, noSearchEcommerceRule];
