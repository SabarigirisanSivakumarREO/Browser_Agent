/**
 * CRO Memory Models
 *
 * Defines interfaces for agent memory and step history.
 */

import type { CROInsight } from './cro-insight.js';
import type { ToolResult } from './tool-definition.js';

/**
 * Record of a single agent step
 */
export interface StepRecord {
  step: number;
  action: string;                        // Tool name executed
  params?: Record<string, unknown>;
  result: ToolResult;
  thinking?: string;                     // LLM's reasoning for this step
  timestamp: number;
}

/**
 * Agent memory state
 */
export interface CROMemory {
  stepHistory: StepRecord[];
  findings: CROInsight[];                // All insights collected
  pagesSeen: string[];                   // URLs analyzed (for multi-page)
  currentFocus: string;                  // What aspect agent is analyzing
  errors: string[];                      // Error messages for context
}

/**
 * Factory function to create initial memory state
 */
export function createInitialMemory(): CROMemory {
  return {
    stepHistory: [],
    findings: [],
    pagesSeen: [],
    currentFocus: 'initial_scan',
    errors: [],
  };
}
