/**
 * Validation Module - Phase 25h-i
 *
 * Exports for data validation, reconciliation, and cheap validator utilities.
 */

export {
  reconcileStructuredVsDOM,
  extractDOMPrices,
  type DOMPrice,
  type DataSource,
  type ReconciliationResult,
  type ReconciliationMismatch,
  type ReconciliationConfig,
} from './reconciliation.js';

// Phase 25i: Cheap Validator
export {
  runCheapValidator,
  shouldRunLLMQA,
  summarizeValidation,
  type CheapValidationResult,
  type ViewportValidationResult,
  type CheapValidatorConfig,
  DEFAULT_CHEAP_VALIDATOR_CONFIG,
} from './cheap-validator.js';

// Phase 25i: LLM Collection QA
export {
  runLLMQA,
  generateThumbnail,
  generateThumbnails,
  createViewportSummaries,
  shouldSkipLLMQA,
  type LLMQAResult,
  type ViewportSummary,
  type LLMQAConfig,
  DEFAULT_LLM_QA_CONFIG,
} from './collection-qa.js';

// Phase 25i: Signal Collector
export {
  collectViewportSignals,
  hasBlockingIssues,
} from './signal-collector.js';

// Phase 26e: Quality Validation (CI-only)
export {
  compareResults,
  type ComparisonResult,
  type EvaluationDiscrepancy,
} from './result-comparator.js';

export {
  classifyDiscrepancy,
  type QualityDiscrepancy,
  type DiscrepancySeverity,
} from './discrepancy-classifier.js';

export {
  QualityValidator,
  DEFAULT_QUALITY_VALIDATION_CONFIG,
  type QualityValidationConfig,
  type QualityValidationResult,
} from './quality-validator.js';
