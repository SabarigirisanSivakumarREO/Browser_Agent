/**
 * Agent Module Exports
 *
 * Phase 15+16: CRO Agent core components.
 * Phase 18e: Added score calculator and extended types.
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
