/**
 * Vision Module Exports - Phase 21c (T311)
 *
 * Public exports for CRO Vision Analyzer.
 */

// Types
export type {
  CROVisionAnalyzerConfig,
  CROVisionAnalysisResult,
  HeuristicEvaluation,
  VisionAnalysisSummary,
  EvaluationStatus,
  RawLLMEvaluation,
  LLMVisionResponse,
} from './types.js';

export {
  DEFAULT_VISION_CONFIG,
  HEURISTIC_TO_CATEGORY,
  getInsightCategory,
} from './types.js';

// Analyzer
export { CROVisionAnalyzer, createCROVisionAnalyzer } from './analyzer.js';

// Prompt Builder (for testing/customization)
export {
  buildSystemPrompt,
  buildVisionPrompt,
  buildMinimalPrompt,
  estimateTokenCount,
} from './prompt-builder.js';

// Response Parser (for testing)
export {
  parseVisionResponse,
  validateCompleteness,
  VisionParseError,
} from './response-parser.js';
