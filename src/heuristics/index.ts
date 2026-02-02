/**
 * Heuristics Module - Phase 18b/18c + Phase 21 (T106d, T111c, T289, T294)
 *
 * Exports for heuristic rule engine, business type detection, page type detection,
 * knowledge base, and rules.
 */

// Types
export type {
  HeuristicRule,
  HeuristicResult,
  HeuristicEngineOptions,
  HeuristicCategory,
} from './types.js';

// Heuristic Engine
export { HeuristicEngine } from './heuristic-engine.js';

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
export type { CategoryAnalyzerConfig, CategoryAnalysisResult } from './category-analyzer.js';
export {
  CategoryAnalyzer,
  createCategoryAnalyzer,
  DEFAULT_CATEGORY_ANALYZER_CONFIG,
} from './category-analyzer.js';

// Analysis Orchestrator (CR-001-C)
export type { AnalysisOrchestratorConfig, AnalysisResult } from './analysis-orchestrator.js';
export {
  AnalysisOrchestrator,
  createAnalysisOrchestrator,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from './analysis-orchestrator.js';
