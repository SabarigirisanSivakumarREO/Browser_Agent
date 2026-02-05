/**
 * Browser Agent
 * Main entry point for the CRO browser automation agent.
 */

// Re-export types and utilities for external use
export * from './types/index.js';
export { BrowserManager, PageLoader } from './browser/index.js';
export {
  CROElementFormatter,
  ToolResultFormatter,
  AgentProgressFormatter,
  HypothesisGenerator,
  InsightDeduplicator,
  InsightPrioritizer,
  MarkdownReporter,
  JSONExporter,
  FileWriter,
} from './output/index.js';
export { createLogger, validateUrl, validateEnvironment } from './utils/index.js';

// Phase 18: CRO Agent exports (primary)
export { CROAgent, type CROAnalysisResult, type CROScores } from './agent/index.js';
export {
  createCRORegistry,
  ToolRegistry,
  ToolExecutor,
} from './agent/tools/index.js';
export {
  // NOTE: createHeuristicEngine and HeuristicEngine removed in CR-002
  // Vision-based analysis supersedes rule-based heuristics
  BusinessTypeDetector,
  SeverityScorer,
} from './heuristics/index.js';
export * from './models/index.js';
