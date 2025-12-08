/**
 * Hypothesis Model - Phase 18a (T105)
 *
 * Defines A/B test hypothesis generation structures.
 * Maps CRO insights to testable hypotheses.
 */

import { z } from 'zod';

/**
 * Expected impact level for a hypothesis
 */
export type ExpectedImpact = 'low' | 'medium' | 'high';

/**
 * A/B test hypothesis generated from CRO insights
 */
export interface Hypothesis {
  /** Unique identifier (H-001 format) */
  id: string;
  /** Short descriptive title */
  title: string;
  /** Full hypothesis statement: "If X, then Y because Z" */
  hypothesis: string;
  /** Description of control (current state) */
  controlDescription: string;
  /** Description of treatment (proposed change) */
  treatmentDescription: string;
  /** Primary metric to measure */
  primaryMetric: string;
  /** Expected impact on metric */
  expectedImpact: ExpectedImpact;
  /** Priority score 1-10 (higher = more urgent) */
  priority: number;
  /** IDs of insights that led to this hypothesis */
  relatedInsights: string[];
}

/**
 * Zod schema for hypothesis validation
 */
export const HypothesisSchema = z.object({
  id: z.string().regex(/^H-\d{3}$/, 'ID must be in H-001 format'),
  title: z.string().min(5).max(100),
  hypothesis: z.string().min(20).max(500),
  controlDescription: z.string().min(10).max(300),
  treatmentDescription: z.string().min(10).max(300),
  primaryMetric: z.string().min(3).max(50),
  expectedImpact: z.enum(['low', 'medium', 'high']),
  priority: z.number().int().min(1).max(10),
  relatedInsights: z.array(z.string()),
});

/**
 * Validated hypothesis type
 */
export type HypothesisValidated = z.infer<typeof HypothesisSchema>;

/**
 * Primary metrics by insight category
 */
export const CATEGORY_METRICS: Record<string, string> = {
  cta: 'Click-through rate (CTR)',
  form: 'Form completion rate',
  trust: 'Conversion rate',
  value_prop: 'Bounce rate',
  navigation: 'Pages per session',
  custom: 'Conversion rate',
};

/**
 * Expected impact weights for priority calculation
 */
export const IMPACT_WEIGHTS: Record<ExpectedImpact, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Severity to expected impact mapping
 */
export const SEVERITY_TO_IMPACT: Record<string, ExpectedImpact> = {
  critical: 'high',
  high: 'high',
  medium: 'medium',
  low: 'low',
};
