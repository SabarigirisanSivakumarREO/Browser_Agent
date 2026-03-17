/**
 * Heuristics Module - Phase 18b/18c + Phase 21 (T106d, T111c, T289, T294)
 * CR-002: Rule-based heuristics (H001-H010) removed - vision analysis supersedes
 *
 * Exports for business type detection, page type detection,
 * knowledge base, and vision analysis.
 */

// Model Configuration (Phase 27A)
export type { AnalysisModel } from './model-config.js';
export { MODEL_DEFAULTS } from './model-config.js';

// Types
export type {
  HeuristicCategory,
} from './types.js';

// NOTE: HeuristicEngine and rule-based heuristics removed in CR-002
// Vision-based analysis (Phase 21) supersedes rule-based heuristics

// Business Type Detector
export type { BusinessTypeDetectorConfig } from './business-type-detector.js';
export {
  BusinessTypeDetector,
  createBusinessTypeDetector,
} from './business-type-detector.js';

// Page Type Detector (Phase 21)
export type { PageTypeDetectorConfig } from './page-type-detector.js';
export {
  PageTypeDetector,
  createPageTypeDetector,
} from './page-type-detector.js';

// Severity Scorer
export {
  SeverityScorer,
  createSeverityScorer,
} from './severity-scorer.js';

// NOTE: Heuristic Rules (Phase 18c) removed in CR-002
// createHeuristicEngine, allRules, and individual rules no longer exported
// Vision-based analysis provides superior accuracy with visual context

// Knowledge Base (Phase 21b)
export type {
  PageTypeHeuristics,
  HeuristicItem,
  HeuristicCategory as KnowledgeCategory,
  HeuristicCategoryFile,
  HeuristicSeverity,
} from './knowledge/index.js';
export {
  loadHeuristics,
  isPageTypeSupported,
  getHeuristicIds,
  getHeuristicById,
  getHeuristicsBySeverity,
  getHeuristicsCountBySeverity,
  clearKnowledgeCache,
  SUPPORTED_KNOWLEDGE_PAGE_TYPES,
} from './knowledge/index.js';

// Vision Analyzer (Phase 21c)
// NOTE: Use --vision-agent mode for vision analysis (CR-001 architecture simplification)
export type {
  CROVisionAnalyzerConfig,
  CROVisionAnalysisResult,
  HeuristicEvaluation,
  VisionAnalysisSummary,
  EvaluationStatus,
} from './vision/index.js';
export {
  CROVisionAnalyzer,
  createCROVisionAnalyzer,
  DEFAULT_VISION_CONFIG,
  buildVisionPrompt,
  buildSystemPrompt,
  parseVisionResponse,
  getInsightCategory,
} from './vision/index.js';

// NOTE: Multi-Viewport and Full-Page Screenshot modes have been DEPRECATED per CR-001.
// Use --vision-agent mode for all vision analysis needs.

// Category Grouper (CR-001-C)
export type { CategoryGroup, GroupingOptions } from './category-grouper.js';
export {
  groupHeuristicsByCategory,
  getTotalHeuristicCount,
  getAllHeuristicIds,
  findCategoryForHeuristic,
  categoryToGroup,
} from './category-grouper.js';

// Category Analyzer (CR-001-C)
// Phase 23: Added CapturedCategoryInputs for LLM input debugging
// Phase 25-fix: Added element reference parsing utilities
export type { CategoryAnalyzerConfig, CategoryAnalysisResult, CapturedCategoryInputs, ParsedElementRef } from './category-analyzer.js';
export {
  CategoryAnalyzer,
  createCategoryAnalyzer,
  DEFAULT_CATEGORY_ANALYZER_CONFIG,
  parseElementRef,
  extractElementRefs,
  toNumericIndex,
  buildElementPositionsBlock,
  populateElementRefs,
} from './category-analyzer.js';

// Analysis Orchestrator (CR-001-C)
export type { AnalysisOrchestratorConfig, AnalysisResult } from './analysis-orchestrator.js';
export {
  AnalysisOrchestrator,
  createAnalysisOrchestrator,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from './analysis-orchestrator.js';

// Category Batcher (Phase 26b)
export type { BatchStrategy } from './category-batcher.js';
export {
  groupCategoriesIntoBatches,
  CATEGORY_BATCHES,
} from './category-batcher.js';

// Batch Prompt Builder (Phase 26b)
export {
  buildBatchedSystemPrompt,
  buildBatchedUserMessage,
} from './batch-prompt-builder.js';

// Viewport Selector (Phase 26c)
export type { ViewportMode, CategoryViewportConfig } from './viewport-selector.js';
export {
  selectViewportsForCategory,
  filterDOMForViewports,
  VIEWPORT_REQUIREMENTS,
} from './viewport-selector.js';

// Batch Response Parser (Phase 26b)
export type { BatchedResponse } from './batch-response-parser.js';
export {
  parseBatchedResponse,
  BatchParseError,
  extractJSON,
} from './batch-response-parser.js';

// Cross-Validator (Phase 27G)
export type { CrossValidationFlag, CrossValidationResult } from './cross-validator.js';
export { crossValidateEvaluations } from './cross-validator.js';

// Playwright Page Type Detector (Phase 24)
export type {
  PdpSignals,
  PlaywrightDetectionResult,
  PlaywrightDetectionEvidence,
  PlaywrightPageTypeDetectorConfig,
} from './playwright-page-detector.js';
export {
  PlaywrightPageTypeDetector,
  createPlaywrightPageTypeDetector,
  detectPdp,
} from './playwright-page-detector.js';

// Domain Pattern Cache (Phase 24)
export type {
  CachedDetectionResult,
  DomainPatternCacheConfig,
} from './domain-pattern-cache.js';
export {
  DomainPatternCache,
  createDomainPatternCache,
} from './domain-pattern-cache.js';

// LLM Page Type Detector (Phase 24)
export type {
  LLMDetectionConfig,
  LLMDetectionResult,
} from './llm-page-type-detector.js';
export {
  LLMPageTypeDetector,
  createLLMPageTypeDetector,
} from './llm-page-type-detector.js';

// Hybrid Page Type Detector (Phase 24)
export type {
  HybridDetectionConfig,
  HybridDetectionResult,
} from './hybrid-page-type-detector.js';
export {
  HybridPageTypeDetector,
  createHybridPageTypeDetector,
} from './hybrid-page-type-detector.js';
