/**
 * Tool Definition Models
 *
 * Defines interfaces for the CRO agent's tool system.
 * Updated in Phase 15 to use ToolContext for cleaner dependency injection.
 */

import type { ZodSchema } from 'zod';
import type { CROInsight } from './cro-insight.js';

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  insights: CROInsight[];
  extracted?: unknown;       // Raw data for debugging
  error?: string;            // Error message if !success
  executionTimeMs?: number;  // Set by ToolExecutor (CR-017)
}

/**
 * Action names for CRO tools (for type safety)
 *
 * Categories:
 * - Analysis tools: Examine elements, return CROInsight[]
 * - Navigation tools: Change page state, return no insights
 * - Collection tools: CR-001-B unified vision integration
 * - Control tools: Agent state management
 */
export const CROActionNames = [
  // Analysis tools
  'analyze_ctas',
  'analyze_forms',
  'detect_trust_signals',
  'assess_value_prop',
  'check_navigation',
  'find_friction',
  // Navigation tools
  'scroll_page',
  'click', // Added Phase 17
  'go_to_url',
  // Collection tools (CR-001-B)
  'capture_viewport',
  'collection_done',
  // Control tools
  'record_insight', // Added Phase 17
  'done',
  // Phase 31: Browser interaction tools
  'type_text',
  'press_key',
  'select_option',
  'extract_text',
  'hover',
  'go_back',
  'wait_for',
  'dismiss_blocker',
  'switch_tab',
  'upload_file',
  'execute_js',
  'drag_and_drop',
  'get_ax_tree',
] as const;

/**
 * CRO action name type (union of all valid action names)
 */
export type CROActionName = (typeof CROActionNames)[number];

/**
 * LLM-friendly tool definition (no execute function)
 * Used by ToolRegistry.getToolDefinitions() for system prompt (FR-037)
 */
export interface ToolDefinitionForLLM {
  name: CROActionName;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema from Zod
}

/**
 * @deprecated Use Tool interface from src/agent/tools/types.ts instead
 * Kept for backward compatibility during Phase 15 transition
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ZodSchema;
}
