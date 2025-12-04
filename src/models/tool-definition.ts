/**
 * Tool Definition Models
 *
 * Defines interfaces for the CRO agent's tool system.
 */

import type { Page } from 'playwright';
import type { ZodSchema } from 'zod';
import type { CROInsight } from './cro-insight.js';
import type { PageState } from './page-state.js';

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  insights: CROInsight[];
  extracted?: unknown;       // Raw data for debugging
  error?: string;            // Error message if !success
  executionTimeMs?: number;  // For performance tracking
}

/**
 * Tool definition for registry
 */
export interface ToolDefinition {
  name: string;
  description: string;       // For LLM context (what this tool does)
  parameters: ZodSchema;     // Zod schema for params validation
  execute: (
    params: unknown,
    page: Page,
    state: PageState
  ) => Promise<ToolResult>;
}

/**
 * Action names for CRO tools (for type safety)
 */
export const CROActionNames = [
  'analyze_ctas',
  'analyze_forms',
  'detect_trust_signals',
  'assess_value_prop',
  'check_navigation',
  'find_friction',
  'scroll_page',
  'go_to_url',
  'done',
] as const;

/**
 * CRO action name type (union of all valid action names)
 */
export type CROActionName = (typeof CROActionNames)[number];
