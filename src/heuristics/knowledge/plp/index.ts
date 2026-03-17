/**
 * PLP Heuristics Aggregator - Phase 22A
 *
 * Combines all PLP category JSON files into a single PageTypeHeuristics object.
 * 26 heuristics across 6 categories for Product Listing Page analysis.
 */

import type { PageTypeHeuristics, HeuristicCategoryFile } from '../types.js';

// Import all category JSON files
import layoutGrid from './layout-grid.json' with { type: 'json' };
import filteringSorting from './filtering-sorting.json' with { type: 'json' };
import productCards from './product-cards.json' with { type: 'json' };
import paginationLoading from './pagination-loading.json' with { type: 'json' };
import navigationBreadcrumbs from './navigation-breadcrumbs.json' with { type: 'json' };
import mobileUsability from './mobile-usability.json' with { type: 'json' };

/**
 * All PLP heuristic categories in order
 */
const PLP_CATEGORIES: HeuristicCategoryFile[] = [
  layoutGrid as HeuristicCategoryFile,
  filteringSorting as HeuristicCategoryFile,
  productCards as HeuristicCategoryFile,
  paginationLoading as HeuristicCategoryFile,
  navigationBreadcrumbs as HeuristicCategoryFile,
  mobileUsability as HeuristicCategoryFile,
];

/**
 * Calculate total heuristic count across all categories
 */
function calculateTotalCount(categories: HeuristicCategoryFile[]): number {
  return categories.reduce((sum, cat) => sum + cat.heuristics.length, 0);
}

/**
 * Complete PLP heuristics knowledge base
 */
export const PLP_HEURISTICS: PageTypeHeuristics = {
  pageType: 'plp',
  source: 'CRO/UX best practices for product listing pages',
  lastUpdated: '2026-02-10',
  totalCount: calculateTotalCount(PLP_CATEGORIES),
  categories: PLP_CATEGORIES.map((cat) => ({
    name: cat.name,
    description: cat.description,
    heuristics: cat.heuristics,
  })),
};

/**
 * Get PLP heuristics
 */
export function getPLPHeuristics(): PageTypeHeuristics {
  return PLP_HEURISTICS;
}

/**
 * Get heuristic by ID
 */
export function getPLPHeuristicById(id: string): typeof PLP_CATEGORIES[0]['heuristics'][0] | undefined {
  for (const category of PLP_CATEGORIES) {
    const heuristic = category.heuristics.find((h) => h.id === id);
    if (heuristic) {
      return heuristic;
    }
  }
  return undefined;
}

/**
 * Get all heuristics for a specific category
 */
export function getPLPHeuristicsByCategory(categoryName: string): typeof PLP_CATEGORIES[0]['heuristics'] {
  const category = PLP_CATEGORIES.find(
    (cat) => cat.name.toLowerCase() === categoryName.toLowerCase()
  );
  return category?.heuristics ?? [];
}
