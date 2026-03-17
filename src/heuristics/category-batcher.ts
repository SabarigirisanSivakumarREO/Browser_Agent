/**
 * Category Batcher - Phase 26b (T556)
 *
 * Groups heuristic categories into batches for multi-category LLM calls.
 * Reduces API calls from 10 to 5 by pairing related categories that share
 * contextual overlap (e.g., both analyze above-fold content).
 */

import type { CategoryGroup } from './category-grouper.js';

/**
 * Predefined batch groupings of related PDP categories.
 * Each sub-array contains category names that share contextual overlap
 * and can be evaluated together in a single LLM call.
 *
 * Grouping rationale:
 * - Batch 1: Both assess page layout and mobile rendering
 * - Batch 2: Both evaluate textual content quality
 * - Batch 3: Both relate to social proof and purchase decisions
 * - Batch 4: Both involve visual media and detailed specs
 * - Batch 5: Both concern conversion actions and secondary features
 */
export const CATEGORY_BATCHES: string[][] = [
  ['Layout & Structure', 'Mobile Usability'],
  ['Pricing & Cost Transparency', 'Description & Value Proposition'],
  ['Reviews & Social Proof', 'Selection & Configuration'],
  ['Product Imagery & Media', 'Specifications & Details'],
  ['CTA & Purchase Confidence', 'Utility & Secondary Actions'],
];

/**
 * Batch strategy for grouping categories
 * - 'related': Use predefined CATEGORY_BATCHES groupings
 * - 'size': Group by roughly equal heuristic counts (not yet implemented, fallback to related)
 * - 'custom': Use caller-provided batch definitions
 */
export type BatchStrategy = 'related' | 'size' | 'custom';

/**
 * Group categories into batches for multi-category LLM calls.
 *
 * @param categories - CategoryGroup[] from category-grouper
 * @param strategy - Batching strategy to use
 * @param customBatches - Custom batch definitions (required when strategy='custom')
 * @returns Array of category batches, where each batch is an array of CategoryGroup
 */
export function groupCategoriesIntoBatches(
  categories: CategoryGroup[],
  strategy: BatchStrategy = 'related',
  customBatches?: string[][]
): CategoryGroup[][] {
  const batchDefs = strategy === 'custom' && customBatches
    ? customBatches
    : CATEGORY_BATCHES;

  // Build a lookup map: category name -> CategoryGroup
  const categoryMap = new Map<string, CategoryGroup>();
  for (const cat of categories) {
    categoryMap.set(cat.name, cat);
  }

  const batches: CategoryGroup[][] = [];
  const assigned = new Set<string>();

  // Assign categories to batches based on definitions
  for (const batchDef of batchDefs) {
    const batch: CategoryGroup[] = [];
    for (const name of batchDef) {
      const group = categoryMap.get(name);
      if (group && !assigned.has(name)) {
        batch.push(group);
        assigned.add(name);
      }
    }
    if (batch.length > 0) {
      batches.push(batch);
    }
  }

  // Any categories not in predefined batches get their own single-category batch
  for (const cat of categories) {
    if (!assigned.has(cat.name)) {
      batches.push([cat]);
      assigned.add(cat.name);
    }
  }

  return batches;
}
