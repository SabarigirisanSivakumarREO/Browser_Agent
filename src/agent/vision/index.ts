/**
 * Vision Agent Module - Phase 21g (T347)
 *
 * Exports the VisionAgent and related types for iterative
 * heuristic analysis with parallel DOM + Vision context.
 *
 * @deprecated CR-001-B (T514): This entire module is deprecated.
 * For new code, use CROAgent with `enableUnifiedMode: true` instead.
 * The unified CROAgent approach provides:
 * - Better coordination between DOM extraction and screenshots
 * - Single agent loop for collection + analysis
 * - Category-based heuristic evaluation
 *
 * Example migration:
 * ```typescript
 * // OLD (deprecated):
 * const agent = createVisionAgent({ model: 'gpt-4o-mini' });
 * const result = await agent.analyze(page, 'pdp');
 *
 * // NEW (recommended):
 * const agent = new CROAgent();
 * const result = await agent.analyze(url, {
 *   visionAgentMode: true,
 *   enableUnifiedMode: true,
 *   visionModel: 'gpt-4o-mini',
 * });
 * ```
 *
 * This module is kept for backwards compatibility.
 * Will be removed in a future major version.
 */

// Main agent
/**
 * @deprecated Use CROAgent with `enableUnifiedMode: true` instead
 */
export { VisionAgent, createVisionAgent } from './vision-agent.js';

// State manager
/**
 * @deprecated Use StateManager from CRO Agent instead
 */
export { VisionStateManager } from './vision-state-manager.js';

// Prompt builder
/**
 * @deprecated Use PromptBuilder from CRO Agent with buildAnalysisSystemPrompt/buildAnalysisUserMessage
 */
export { VisionPromptBuilder, formatDOMContextWithCoords } from './vision-prompt-builder.js';

// Message manager
/**
 * @deprecated Use MessageManager from CRO Agent with addUserMessageWithImage
 */
export { VisionMessageManager } from './vision-message-manager.js';

// Tools
/**
 * @deprecated Use CRO Agent tools (capture_viewport, collection_done) instead
 */
export {
  createVisionToolRegistry,
  createCaptureViewportTool,
  createScrollPageTool,
  createEvaluateBatchTool,
  createVisionDoneTool,
  type VisionToolRegistry,
} from './tools/index.js';

// Types
export type {
  VisionAgentOptions,
  VisionAgentState,
  VisionAgentStateInit,
  VisionAgentResult,
  VisionAgentSummary,
  ViewportSnapshot,
  SnapshotScreenshot,
  SnapshotDOM,
  VisionToolContext,
  VisionToolDefinition,
  VisionToolResult,
  HeuristicDefinition,
  BatchEvaluation,
  TerminationReason,
  CaptureViewportInput,
  CaptureViewportOutput,
  ScrollPageInput,
  ScrollPageOutput,
  EvaluateBatchInput,
  EvaluateBatchOutput,
  DoneInput,
  DoneOutput,
  VisionAgentMessage,
  MessageContent,
  ImageContent,
  TextContent,
} from './types.js';

export { DEFAULT_VISION_AGENT_OPTIONS } from './types.js';
