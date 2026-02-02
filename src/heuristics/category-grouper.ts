/**
 * Category Grouper - CR-001-C (T515)
 *
 * Groups heuristics by category for batch analysis during the post-collection phase.
 * Each category group is analyzed in a single LLM call for efficiency.
 */

import type { PageType } from '../models/index.js';
import { loadHeuristics, type HeuristicCategory, type HeuristicItem } from './knowledge/index.js';

/**
 * A group of heuristics in the same category, ready for batch analysis
 */
export interface CategoryGroup {
  /** Category name (e.g., "Layout & Structure") */
  name: string;
  /** Category description */
  description: string;
  /** Heuristics in this category */
  heuristics: HeuristicItem[];
  /** Count of heuristics in this group */
  count: number;
}

/**
 * Options for grouping heuristics
 */
export interface GroupingOptions {
  /** Filter to specific categories by name */
  includeCategories?: string[];
  /** Exclude specific categories by name */
  excludeCategories?: string[];
  /** Filter by minimum severity (includes this and higher) */
  minSeverity?: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Severity levels in order from highest to lowest
 */
const SEVERITY_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Group heuristics by category for a given page type
 *
 * @param pageType - The page type to load heuristics for
 * @param options - Optional filtering options
 * @returns Array of CategoryGroup objects for batch analysis
 */
export function groupHeuristicsByCategory(
  pageType: PageType,
  options?: GroupingOptions
): CategoryGroup[] {
  // Load heuristics from knowledge base
  const pageHeuristics = loadHeuristics(pageType);

  // Convert categories to CategoryGroup format with filtering
  const groups: CategoryGroup[] = [];

  for (const category of pageHeuristics.categories) {
    // Apply category inclusion filter
    if (options?.includeCategories && options.includeCategories.length > 0) {
      const normalizedName = category.name.toLowerCase();
      const included = options.includeCategories.some(
        (c) => normalizedName.includes(c.toLowerCase())
      );
      if (!included) continue;
    }

    // Apply category exclusion filter
    if (options?.excludeCategories && options.excludeCategories.length > 0) {
      const normalizedName = category.name.toLowerCase();
      const excluded = options.excludeCategories.some(
        (c) => normalizedName.includes(c.toLowerCase())
      );
      if (excluded) continue;
    }

    // Filter heuristics by minimum severity if specified
    let heuristics = category.heuristics;
    if (options?.minSeverity) {
      const minLevel = SEVERITY_ORDER[options.minSeverity] ?? 0;
      heuristics = heuristics.filter((h) => {
        const hLevel = SEVERITY_ORDER[h.severity] ?? 0;
        return hLevel >= minLevel;
      });
    }

    // Only add category if it has heuristics after filtering
    if (heuristics.length > 0) {
      groups.push({
        name: category.name,
        description: category.description,
        heuristics,
        count: heuristics.length,
      });
    }
  }

  return groups;
}

/**
 * Get the total number of heuristics across all categories
 */
export function getTotalHeuristicCount(groups: CategoryGroup[]): number {
  return groups.reduce((sum, group) => sum + group.count, 0);
}

/**
 * Get a flat list of all heuristic IDs from the groups
 */
export function getAllHeuristicIds(groups: CategoryGroup[]): string[] {
  return groups.flatMap((group) => group.heuristics.map((h) => h.id));
}

/**
 * Find which category a heuristic belongs to
 */
export function findCategoryForHeuristic(
  groups: CategoryGroup[],
  heuristicId: string
): CategoryGroup | undefined {
  return groups.find((group) =>
    group.heuristics.some((h) => h.id === heuristicId)
  );
}

/**
 * Convert HeuristicCategory to CategoryGroup
 */
export function categoryToGroup(category: HeuristicCategory): CategoryGroup {
  return {
    name: category.name,
    description: category.description,
    heuristics: category.heuristics,
    count: category.heuristics.length,
  };
}
