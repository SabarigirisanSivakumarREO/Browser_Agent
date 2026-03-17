/**
 * Heuristics Knowledge Base Types - Phase 21b (T293)
 *
 * Interfaces for structured heuristics storage based on Baymard Institute research.
 */

import type { PageType } from '../../models/index.js';

/**
 * Heuristic severity levels
 */
export type HeuristicSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Single heuristic item from Baymard research
 */
export interface HeuristicItem {
  /** Unique identifier: PDP-CATEGORY-NNN */
  id: string;
  /** The UX principle from Baymard research */
  principle: string;
  /** Specific checkpoints to verify visually */
  checkpoints: string[];
  /** Issue severity if heuristic fails */
  severity: HeuristicSeverity;
  /** Parent category name */
  category: string;
}

/**
 * Category grouping related heuristics (JSON file structure)
 */
export interface HeuristicCategoryFile {
  /** Category name */
  name: string;
  /** Category description */
  description: string;
  /** Heuristics in this category */
  heuristics: HeuristicItem[];
}

/**
 * Category with metadata (in-memory representation)
 */
export interface HeuristicCategory {
  /** Category name */
  name: string;
  /** Category description */
  description: string;
  /** Heuristics in this category */
  heuristics: HeuristicItem[];
}

/**
 * All heuristics for a page type
 */
export interface PageTypeHeuristics {
  /** Page type this applies to */
  pageType: PageType;
  /** Source of heuristics */
  source: string;
  /** Last updated date (ISO string) */
  lastUpdated: string;
  /** Total heuristic count */
  totalCount: number;
  /** Heuristic categories */
  categories: HeuristicCategory[];
}

/**
 * Supported page types for knowledge base
 */
export const SUPPORTED_KNOWLEDGE_PAGE_TYPES: PageType[] = ['pdp', 'plp'];
