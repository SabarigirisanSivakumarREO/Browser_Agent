/**
 * Viewport Selector - Phase 26c (T564)
 *
 * Intelligently selects which viewports to send per heuristic category.
 * Categories that only care about above-fold content (e.g., CTA placement)
 * don't need below-fold viewports, saving 15-30% of tokens.
 */

import type { ViewportSnapshot } from '../models/index.js';

/**
 * Viewport selection mode per category
 * - 'all': Send all viewports (no filtering)
 * - 'above_fold': Send only viewport 0 (and optionally viewport 1)
 * - 'below_fold': Send viewports after the first (index >= 1)
 * - 'custom': Send specific viewport indices
 */
export type ViewportMode = 'all' | 'above_fold' | 'below_fold' | 'custom';

/**
 * Configuration for viewport requirements per category
 */
export interface CategoryViewportConfig {
  /** Viewport selection mode */
  mode: ViewportMode;
  /** Maximum number of viewports to send (caps the selection) */
  maxViewports: number;
  /** Specific viewport indices (only used when mode='custom') */
  indices?: number[];
}

/**
 * Viewport requirements for each of the 10 PDP heuristic categories.
 *
 * Rationale (revised for quality — original was too aggressive):
 * - Layout & Structure: Need all viewports to assess full-page layout
 * - Mobile Usability: Above-fold primary, but include viewport 2 for scroll behavior
 * - Pricing & Cost Transparency: Price above fold, but shipping/comparison tables below
 * - Description & Value Proposition: Spread across page (hero, mid, details)
 * - Reviews & Social Proof: Star ratings in hero (v0) + full reviews below fold
 * - Selection & Configuration: Variant selectors above fold + size charts below
 * - Product Imagery & Media: Hero gallery + thumbnails/zoom may extend to v2
 * - Specifications & Details: Primarily below-fold, but needs v0 for context
 * - CTA & Purchase Confidence: Primary CTA above fold + sticky/secondary CTAs throughout
 * - Utility & Secondary Actions: Distributed across page, need all
 */
export const VIEWPORT_REQUIREMENTS: Record<string, CategoryViewportConfig> = {
  'Layout & Structure': { mode: 'all', maxViewports: 6 },
  'Mobile Usability': { mode: 'custom', maxViewports: 3, indices: [0, 1, 2] },
  'Pricing & Cost Transparency': { mode: 'custom', maxViewports: 4, indices: [0, 1, 2, 3] },
  'Description & Value Proposition': { mode: 'all', maxViewports: 4 },
  'Reviews & Social Proof': { mode: 'all', maxViewports: 4 },
  'Selection & Configuration': { mode: 'custom', maxViewports: 3, indices: [0, 1, 2] },
  'Product Imagery & Media': { mode: 'custom', maxViewports: 3, indices: [0, 1, 2] },
  'Specifications & Details': { mode: 'all', maxViewports: 4 },
  'CTA & Purchase Confidence': { mode: 'all', maxViewports: 4 },
  'Utility & Secondary Actions': { mode: 'all', maxViewports: 5 },
};

/**
 * Select which viewports to send for a given category.
 *
 * @param categoryName - Name of the heuristic category
 * @param allSnapshots - All collected viewport snapshots (sorted by viewportIndex)
 * @returns Filtered array of snapshots relevant to this category
 */
export function selectViewportsForCategory(
  categoryName: string,
  allSnapshots: ViewportSnapshot[]
): ViewportSnapshot[] {
  if (allSnapshots.length === 0) {
    return [];
  }

  const config = VIEWPORT_REQUIREMENTS[categoryName];

  // Fallback to all viewports when category not found
  if (!config) {
    return allSnapshots;
  }

  let selected: ViewportSnapshot[];

  switch (config.mode) {
    case 'above_fold':
      // Viewports 0 and 1 (first two captures)
      selected = allSnapshots.filter(s => s.viewportIndex <= 1);
      break;

    case 'below_fold':
      // Below-fold viewports + viewport 0 for above-fold context
      if (allSnapshots.length <= 1) {
        selected = [...allSnapshots];
      } else {
        // Always include viewport 0 for context, then all below-fold viewports
        const belowFold = allSnapshots.filter(s => s.viewportIndex >= 1);
        const viewport0 = allSnapshots.find(s => s.viewportIndex === 0);
        selected = viewport0 ? [viewport0, ...belowFold] : belowFold;
      }
      break;

    case 'custom':
      if (config.indices && config.indices.length > 0) {
        const indexSet = new Set(config.indices);
        selected = allSnapshots.filter(s => indexSet.has(s.viewportIndex));
      } else {
        selected = [...allSnapshots];
      }
      break;

    case 'all':
    default:
      selected = [...allSnapshots];
      break;
  }

  // Cap at maxViewports
  if (selected.length > config.maxViewports) {
    selected = selected.slice(0, config.maxViewports);
  }

  // Never return empty — always include at least viewport 0 for context
  if (selected.length === 0 && allSnapshots.length > 0) {
    selected = [allSnapshots[0]!];
  }

  return selected;
}

/**
 * Filter serialized DOM content to only include sections from selected viewports.
 *
 * The DOM context sent to the LLM uses viewport section markers like:
 * `--- Viewport-0 (scroll: 0px) ---`
 *
 * This function extracts only the sections matching the selected viewport indices.
 *
 * @param fullDOM - Full serialized DOM string with viewport sections
 * @param selectedSnapshots - Snapshots that were selected for this category
 * @returns Filtered DOM string containing only selected viewport sections
 */
export function filterDOMForViewports(
  fullDOM: string,
  selectedSnapshots: ViewportSnapshot[]
): string {
  if (!fullDOM || selectedSnapshots.length === 0) {
    return fullDOM || '';
  }

  const selectedIndices = new Set(selectedSnapshots.map(s => s.viewportIndex));

  // Split DOM by viewport section markers
  // Marker format: "--- Viewport-{N} (scroll: {X}px) ---"
  const sectionPattern = /^--- Viewport-(\d+) \(scroll: \d+px\) ---$/gm;
  const sections: { index: number; start: number; end: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = sectionPattern.exec(fullDOM)) !== null) {
    const viewportIdx = parseInt(match[1]!, 10);
    sections.push({
      index: viewportIdx,
      start: match.index,
      end: fullDOM.length, // Will be updated for all but last section
    });
  }

  // If no viewport sections found, return full DOM as-is
  if (sections.length === 0) {
    return fullDOM;
  }

  // Set end positions (each section ends where the next begins)
  for (let i = 0; i < sections.length - 1; i++) {
    sections[i]!.end = sections[i + 1]!.start;
  }

  // Extract selected sections
  const filteredParts: string[] = [];
  for (const section of sections) {
    if (selectedIndices.has(section.index)) {
      filteredParts.push(fullDOM.slice(section.start, section.end).trimEnd());
    }
  }

  return filteredParts.join('\n\n');
}
