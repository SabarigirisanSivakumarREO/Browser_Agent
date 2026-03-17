/**
 * Heuristics Knowledge Base Loader - Phase 21b (T294)
 *
 * Loads heuristics for a given page type from the knowledge base.
 * Supports lazy loading with caching for performance.
 */

import type { PageType } from '../../models/index.js';
import type { PageTypeHeuristics, HeuristicItem } from './types.js';
import { SUPPORTED_KNOWLEDGE_PAGE_TYPES } from './types.js';
import { getPDPHeuristics } from './pdp/index.js';
import { getPLPHeuristics } from './plp/index.js';

// Re-export types
export type { PageTypeHeuristics, HeuristicItem, HeuristicCategory, HeuristicCategoryFile, HeuristicSeverity } from './types.js';
export { SUPPORTED_KNOWLEDGE_PAGE_TYPES } from './types.js';

/**
 * Knowledge base cache
 */
const knowledgeCache = new Map<PageType, PageTypeHeuristics>();

/**
 * Load heuristics for a page type
 *
 * @param pageType - The page type to load heuristics for
 * @returns PageTypeHeuristics containing all heuristics for the page type
 * @throws Error if page type is not supported
 */
export function loadHeuristics(pageType: PageType): PageTypeHeuristics {
  // Check cache first
  const cached = knowledgeCache.get(pageType);
  if (cached) {
    return cached;
  }

  // Load based on page type
  let heuristics: PageTypeHeuristics;

  switch (pageType) {
    case 'pdp':
      heuristics = getPDPHeuristics();
      break;

    case 'plp':
      heuristics = getPLPHeuristics();
      break;

    default:
      throw new Error(
        `Unsupported page type for knowledge base: ${pageType}. ` +
        `Supported types: ${SUPPORTED_KNOWLEDGE_PAGE_TYPES.join(', ')}`
      );
  }

  // Cache and return
  knowledgeCache.set(pageType, heuristics);
  return heuristics;
}

/**
 * Check if a page type has knowledge base support
 */
export function isPageTypeSupported(pageType: PageType): boolean {
  return SUPPORTED_KNOWLEDGE_PAGE_TYPES.includes(pageType);
}

/**
 * Get all heuristic IDs for a page type
 */
export function getHeuristicIds(pageType: PageType): string[] {
  const heuristics = loadHeuristics(pageType);
  return heuristics.categories.flatMap((cat) => cat.heuristics.map((h) => h.id));
}

/**
 * Get a specific heuristic by ID from any page type
 */
export function getHeuristicById(pageType: PageType, heuristicId: string): HeuristicItem | undefined {
  const heuristics = loadHeuristics(pageType);
  for (const category of heuristics.categories) {
    const heuristic = category.heuristics.find((h) => h.id === heuristicId);
    if (heuristic) {
      return heuristic;
    }
  }
  return undefined;
}

/**
 * Get heuristics filtered by severity
 */
export function getHeuristicsBySeverity(
  pageType: PageType,
  severity: 'critical' | 'high' | 'medium' | 'low'
): HeuristicItem[] {
  const heuristics = loadHeuristics(pageType);
  return heuristics.categories.flatMap((cat) =>
    cat.heuristics.filter((h) => h.severity === severity)
  );
}

/**
 * Get heuristics count by severity for a page type
 */
export function getHeuristicsCountBySeverity(pageType: PageType): Record<string, number> {
  const heuristics = loadHeuristics(pageType);
  const counts: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const category of heuristics.categories) {
    for (const heuristic of category.heuristics) {
      const currentCount = counts[heuristic.severity] ?? 0;
      counts[heuristic.severity] = currentCount + 1;
    }
  }

  return counts;
}

/**
 * Clear the knowledge cache (useful for testing)
 */
export function clearKnowledgeCache(): void {
  knowledgeCache.clear();
}
