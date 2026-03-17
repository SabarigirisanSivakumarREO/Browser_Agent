/**
 * Model Configuration - Phase 27A (T616)
 *
 * Centralized model defaults for the analysis pipeline.
 * gpt-4o-mini is the default (fits within TPM limits for batched analysis).
 * gpt-4o available via --premium-analysis for higher quality.
 */

/**
 * Supported analysis model identifiers
 */
export type AnalysisModel = 'gpt-4o' | 'gpt-4o-mini';

/**
 * Centralized model defaults for the analysis pipeline
 */
export const MODEL_DEFAULTS = {
  /** Default model for CRO analysis — balances quality and TPM limits */
  analysis: 'gpt-4o-mini' as AnalysisModel,
  /** Premium model for higher quality (--premium-analysis) */
  fast: 'gpt-4o-mini' as AnalysisModel,
} as const;
