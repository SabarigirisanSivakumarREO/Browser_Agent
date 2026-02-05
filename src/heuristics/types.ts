/**
 * Heuristics Types - Phase 18b (T106) + Phase 21 (T290)
 * CR-002: Rule-based heuristics (H001-H010) removed - vision analysis supersedes
 *
 * Core interfaces for heuristic categories (used by vision analysis).
 */

/**
 * Heuristic rule category
 * Includes original categories + PDP-specific categories (Phase 21)
 * NOTE: Used by vision analysis for insight categorization
 */
export type HeuristicCategory =
  // Original categories
  | 'cta'
  | 'form'
  | 'trust'
  | 'value_prop'
  | 'navigation'
  // PDP-specific categories (Phase 21)
  | 'pdp_layout'
  | 'pdp_imagery'
  | 'pdp_pricing'
  | 'pdp_description'
  | 'pdp_specs'
  | 'pdp_reviews'
  | 'pdp_selection'
  | 'pdp_cta'
  | 'pdp_mobile'
  | 'pdp_utility';

// NOTE: HeuristicRule interface removed in CR-002
// Vision-based analysis (Phase 21) supersedes rule-based heuristics (H001-H010)
// Vision analysis uses HeuristicCategory for categorization
