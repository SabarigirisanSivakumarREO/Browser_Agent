/**
 * Insight Deduplicator - Phase 18d (T113)
 *
 * Removes duplicate CRO insights based on type + element combination.
 * Merges evidence from duplicates when different.
 */

import type { CROInsight, Evidence } from '../models/index.js';
import { createLogger } from '../utils/index.js';

/**
 * Options for InsightDeduplicator
 */
export interface InsightDeduplicatorOptions {
  /** Whether to merge evidence from duplicates (default: true) */
  mergeEvidence?: boolean;
}

/**
 * Deduplicates CRO insights based on type and element
 */
export class InsightDeduplicator {
  private readonly logger = createLogger('InsightDeduplicator');
  private readonly mergeEvidence: boolean;

  constructor(options: InsightDeduplicatorOptions = {}) {
    this.mergeEvidence = options.mergeEvidence ?? true;
  }

  /**
   * Remove duplicate insights based on type + element combination
   * @param insights - Array of CRO insights to deduplicate
   * @returns Deduplicated array, keeping first occurrence
   */
  deduplicate(insights: CROInsight[]): CROInsight[] {
    if (!insights || insights.length === 0) {
      this.logger.debug('No insights provided, returning empty array');
      return [];
    }

    const seen = new Map<string, CROInsight>();
    const duplicateCount = new Map<string, number>();

    for (const insight of insights) {
      const key = this.createKey(insight);

      if (seen.has(key)) {
        // Track duplicate count
        duplicateCount.set(key, (duplicateCount.get(key) || 1) + 1);

        // Merge evidence if enabled and different
        if (this.mergeEvidence && insight.evidence) {
          const existing = seen.get(key)!;
          existing.evidence = this.mergeEvidences(existing.evidence, insight.evidence);
        }
      } else {
        // Keep first occurrence (clone to avoid mutation)
        seen.set(key, { ...insight });
      }
    }

    const result = Array.from(seen.values());
    const removedCount = insights.length - result.length;

    if (removedCount > 0) {
      this.logger.info(
        `Deduplicated ${insights.length} insights to ${result.length} (removed ${removedCount} duplicates)`
      );
    } else {
      this.logger.debug(`No duplicates found in ${insights.length} insights`);
    }

    return result;
  }

  /**
   * Create a unique key for deduplication
   * Phase 27E (T628): Use heuristicId when available (vision analysis insights).
   * Falls back to type|element for non-vision insights.
   */
  private createKey(insight: CROInsight): string {
    // Vision analysis insights have heuristicId — use it for unique dedup
    if (insight.heuristicId) {
      return insight.heuristicId;
    }
    // Fallback for non-vision insights (legacy heuristic engine)
    const type = insight.type.toLowerCase().trim();
    const element = (insight.element || '').toLowerCase().trim();
    return `${type}|${element}`;
  }

  /**
   * Merge two evidence objects
   * Combines properties, preferring non-empty values
   */
  private mergeEvidences(
    existing: Evidence | undefined,
    incoming: Evidence
  ): Evidence {
    if (!existing) {
      return { ...incoming };
    }

    const merged: Evidence = { ...existing };

    // Merge text - concatenate if both exist and different
    if (incoming.text && incoming.text !== existing.text) {
      merged.text = existing.text
        ? `${existing.text} | ${incoming.text}`
        : incoming.text;
    }

    // Merge selector - prefer incoming if existing is empty
    if (incoming.selector && !existing.selector) {
      merged.selector = incoming.selector;
    }

    // Merge styles - combine style objects
    if (incoming.styles) {
      merged.styles = { ...existing.styles, ...incoming.styles };
    }

    // Screenshot - prefer first one
    if (incoming.screenshot && !existing.screenshot) {
      merged.screenshot = incoming.screenshot;
    }

    return merged;
  }
}
