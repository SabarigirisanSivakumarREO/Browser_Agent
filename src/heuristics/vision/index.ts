/**
 * Vision Module Exports - CR-001 Simplified
 *
 * Public exports for CRO Vision Analyzer.
 * NOTE: Multi-viewport and full-page screenshot modes have been removed.
 *       Use Vision Agent mode (--vision-agent) for vision analysis.
 */

// Types - Phase 21c
export type {
  CROVisionAnalyzerConfig,
  CROVisionAnalysisResult,
  HeuristicEvaluation,
  VisionAnalysisSummary,
  EvaluationStatus,
  RawLLMEvaluation,
  LLMVisionResponse,
  // Phase 21h: Evidence types (T353)
  DOMElementRef,
  BoundingBox,
  // Phase 21i: Parsed evaluation type (T374)
  ParsedEvaluation,
} from './types.js';

export {
  DEFAULT_VISION_CONFIG,
  HEURISTIC_TO_CATEGORY,
  getInsightCategory,
} from './types.js';

// Analyzer - Phase 21c (used internally by Vision Agent)
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
  // Phase 21i: Element reference extraction (T373)
  extractElementReferences,
  parseEvaluationWithElements,
  parseEvaluationsWithElements,
} from './response-parser.js';

// Phase 30a: Image Token Calculator (T653)
export {
  calculateImageTokens,
  findOptimalDimensions,
} from './image-token-calculator.js';

// Phase 30b: Category Crop Mapper (T656)
export {
  computeCropRegion,
  CATEGORY_ELEMENT_TYPES,
  type CropRegion,
} from './category-crop-mapper.js';

// Phase 30c: Auto-Crop Pipeline (T659)
export {
  cropForCategory,
  compressForLLM,
  DEFAULT_CROP_CONFIG,
  type CropPipelineConfig,
  type CropResult,
} from './image-crop-pipeline.js';

// NOTE: The following modules have been DEPRECATED per CR-001:
// - multi-viewport-analyzer.ts (removed --full-page-vision mode)
// - result-merger.ts (used only by multi-viewport analyzer)
// - image-resizer.ts (removed --full-page-screenshot mode)
// Use --vision-agent mode instead for all vision analysis needs.
