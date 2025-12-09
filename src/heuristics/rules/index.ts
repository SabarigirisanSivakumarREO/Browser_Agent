/**
 * Heuristic Rules Index - Phase 18c (T111c)
 *
 * Exports all heuristic rules and factory function.
 */

import { ctaRules, vagueCTATextRule, noCTAAboveFoldRule } from './cta-rules.js';
import { formRules, formFieldOverloadRule, missingFieldLabelRule } from './form-rules.js';
import { trustRules, noTrustAboveFoldRule, noSecurityBadgeRule } from './trust-rules.js';
import {
  valuePropRules,
  unclearValuePropRule,
  headlineTooLongRule,
} from './value-prop-rules.js';
import {
  navigationRules,
  noBreadcrumbsRule,
  noSearchEcommerceRule,
} from './navigation-rules.js';
import { HeuristicEngine } from '../heuristic-engine.js';
import type { HeuristicRule } from '../types.js';

/**
 * All heuristic rules combined
 */
export const allRules: HeuristicRule[] = [
  ...ctaRules,
  ...formRules,
  ...trustRules,
  ...valuePropRules,
  ...navigationRules,
];

/**
 * Create a heuristic engine pre-loaded with all 10 rules
 */
export function createHeuristicEngine(): HeuristicEngine {
  const engine = new HeuristicEngine();
  engine.registerAll(allRules);
  return engine;
}

// Re-export individual rule arrays
export { ctaRules, formRules, trustRules, valuePropRules, navigationRules };

// Re-export individual rules for testing
export {
  // CTA Rules
  vagueCTATextRule,
  noCTAAboveFoldRule,
  // Form Rules
  formFieldOverloadRule,
  missingFieldLabelRule,
  // Trust Rules
  noTrustAboveFoldRule,
  noSecurityBadgeRule,
  // Value Prop Rules
  unclearValuePropRule,
  headlineTooLongRule,
  // Navigation Rules
  noBreadcrumbsRule,
  noSearchEcommerceRule,
};
