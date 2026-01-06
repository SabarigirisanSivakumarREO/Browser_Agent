/**
 * PDP Heuristics Aggregator - Phase 21b (T305)
 *
 * Combines all PDP category JSON files into a single PageTypeHeuristics object.
 * 35 heuristics across 10 categories based on Baymard Institute research.
 */

import type { PageTypeHeuristics, HeuristicCategoryFile } from '../types.js';

// Import all category JSON files
import layoutStructure from './layout-structure.json' with { type: 'json' };
import imageryMedia from './imagery-media.json' with { type: 'json' };
import pricingTransparency from './pricing-transparency.json' with { type: 'json' };
import descriptionValueProp from './description-value-prop.json' with { type: 'json' };
import specifications from './specifications.json' with { type: 'json' };
import reviewsSocialProof from './reviews-social-proof.json' with { type: 'json' };
import selectionConfiguration from './selection-configuration.json' with { type: 'json' };
import ctaPurchaseConfidence from './cta-purchase-confidence.json' with { type: 'json' };
import mobileUsability from './mobile-usability.json' with { type: 'json' };
import utilitySecondary from './utility-secondary.json' with { type: 'json' };

/**
 * All PDP heuristic categories in order
 */
const PDP_CATEGORIES: HeuristicCategoryFile[] = [
  layoutStructure as HeuristicCategoryFile,
  imageryMedia as HeuristicCategoryFile,
  pricingTransparency as HeuristicCategoryFile,
  descriptionValueProp as HeuristicCategoryFile,
  specifications as HeuristicCategoryFile,
  reviewsSocialProof as HeuristicCategoryFile,
  selectionConfiguration as HeuristicCategoryFile,
  ctaPurchaseConfidence as HeuristicCategoryFile,
  mobileUsability as HeuristicCategoryFile,
  utilitySecondary as HeuristicCategoryFile,
];

/**
 * Calculate total heuristic count across all categories
 */
function calculateTotalCount(categories: HeuristicCategoryFile[]): number {
  return categories.reduce((sum, cat) => sum + cat.heuristics.length, 0);
}

/**
 * Complete PDP heuristics knowledge base
 */
export const PDP_HEURISTICS: PageTypeHeuristics = {
  pageType: 'pdp',
  source: 'Baymard Institute PDP UX Research',
  lastUpdated: '2026-01-05',
  totalCount: calculateTotalCount(PDP_CATEGORIES),
  categories: PDP_CATEGORIES.map((cat) => ({
    name: cat.name,
    description: cat.description,
    heuristics: cat.heuristics,
  })),
};

/**
 * Get PDP heuristics
 */
export function getPDPHeuristics(): PageTypeHeuristics {
  return PDP_HEURISTICS;
}

/**
 * Get heuristic by ID
 */
export function getPDPHeuristicById(id: string): typeof PDP_CATEGORIES[0]['heuristics'][0] | undefined {
  for (const category of PDP_CATEGORIES) {
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
export function getPDPHeuristicsByCategory(categoryName: string): typeof PDP_CATEGORIES[0]['heuristics'] {
  const category = PDP_CATEGORIES.find(
    (cat) => cat.name.toLowerCase() === categoryName.toLowerCase()
  );
  return category?.heuristics ?? [];
}
