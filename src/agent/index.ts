/**
 * Agent Module Exports
 *
 * Phase 15+16: CRO Agent core components.
 * Phase 18e: Added score calculator and extended types.
 * CR-001-D: Removed Vision Agent (use CROAgent with vision: true instead).
 */

// Tool system (Phase 15)
export type { Tool, ToolContext, ToolDefinitionForLLM, ExecutionContext } from './tools/index.js';
export { ToolRegistry, ToolExecutor } from './tools/index.js';

// Agent core (Phase 16)
export { PromptBuilder } from './prompt-builder.js';
export { MessageManager } from './message-manager.js';
export { StateManager } from './state-manager.js';
export {
  CROAgent,
  calculateMaxCollectionSteps, // Phase 25a (T473)
  type CROAnalysisResult,
  type AnalyzeOptions,
  type OutputFormat,
} from './cro-agent.js';

// Score calculator (Phase 18e)
export {
  ScoreCalculator,
  createScoreCalculator,
  type CROScores,
  type ScoreCalculatorOptions,
} from './score-calculator.js';

// Coverage tracker (Phase 19a)
export { CoverageTracker } from './coverage-tracker.js';

// NOTE: Vision Agent module removed in CR-001-D
// For vision analysis, use CROAgent with `vision: true` option:
//   const agent = new CROAgent();
//   const result = await agent.analyze(url, { vision: true });
