/**
 * Heuristics Module - Phase 18b/18c (T106d, T111c)
 *
 * Exports for heuristic rule engine, business type detection, and rules.
 */

// Types
export type {
  HeuristicRule,
  HeuristicResult,
  HeuristicEngineOptions,
} from './types.js';

// Heuristic Engine
export { HeuristicEngine } from './heuristic-engine.js';

// Business Type Detector
export type { BusinessTypeDetectorConfig } from './business-type-detector.js';
export {
  BusinessTypeDetector,
  createBusinessTypeDetector,
} from './business-type-detector.js';

// Severity Scorer
export {
  SeverityScorer,
  createSeverityScorer,
} from './severity-scorer.js';

// Heuristic Rules (Phase 18c)
export {
  // Factory function (preferred way to get engine with all rules)
  createHeuristicEngine,
  // All rules combined
  allRules,
  // Rule arrays by category
  ctaRules,
  formRules,
  trustRules,
  valuePropRules,
  navigationRules,
  // Individual rules
  vagueCTATextRule,
  noCTAAboveFoldRule,
  formFieldOverloadRule,
  missingFieldLabelRule,
  noTrustAboveFoldRule,
  noSecurityBadgeRule,
  unclearValuePropRule,
  headlineTooLongRule,
  noBreadcrumbsRule,
  noSearchEcommerceRule,
} from './rules/index.js';
