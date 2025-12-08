/**
 * Models Module - Phase 13a + 13b + 18a Exports
 *
 * Core data models for CRO Agent.
 */

// DOM models
export type {
  BoundingBox,
  CROType,
  CROClassification,
  DOMNode,
  DOMTree,
} from './dom-tree.js';

// Insight model
export type {
  Severity,
  Evidence,
  InsightCategory,
  CROInsight,
  CROInsightValidated,
} from './cro-insight.js';
export { EvidenceSchema, CROInsightSchema } from './cro-insight.js';

// Page state
export type {
  ViewportInfo,
  ScrollPosition,
  PageState,
} from './page-state.js';

// Tool interfaces
export type {
  ToolResult,
  ToolDefinition,
  ToolDefinitionForLLM,
  CROActionName,
} from './tool-definition.js';
export { CROActionNames } from './tool-definition.js';

// Memory model
export type { StepRecord, CROMemory } from './cro-memory.js';
export { createInitialMemory } from './cro-memory.js';

// Agent state
export type { CROAgentOptions, AgentState } from './agent-state.js';
export { DEFAULT_CRO_OPTIONS, createInitialState } from './agent-state.js';

// Agent output
export type { CROAgentOutput, ParseResult } from './agent-output.js';
export { CROAgentOutputSchema, parseAgentOutput } from './agent-output.js';

// Business type (Phase 18a)
export type {
  BusinessType,
  BusinessTypeResult,
  BusinessTypeSignals,
} from './business-type.js';
export { BUSINESS_TYPE_SIGNALS, BUSINESS_TYPES } from './business-type.js';

// Hypothesis (Phase 18a)
export type {
  ExpectedImpact,
  Hypothesis,
  HypothesisValidated,
} from './hypothesis.js';
export {
  HypothesisSchema,
  CATEGORY_METRICS,
  IMPACT_WEIGHTS,
  SEVERITY_TO_IMPACT,
} from './hypothesis.js';
