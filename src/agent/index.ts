/**
 * Agent Module Exports
 *
 * Phase 15+16: CRO Agent core components.
 */

// Tool system (Phase 15)
export type { Tool, ToolContext, ToolDefinitionForLLM, ExecutionContext } from './tools/index.js';
export { ToolRegistry, ToolExecutor } from './tools/index.js';

// Agent core (Phase 16)
export { PromptBuilder } from './prompt-builder.js';
export { MessageManager } from './message-manager.js';
export { StateManager } from './state-manager.js';
export { CROAgent, type CROAnalysisResult, type AnalyzeOptions } from './cro-agent.js';
