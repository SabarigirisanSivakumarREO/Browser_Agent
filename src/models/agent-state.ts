/**
 * Agent State Models
 *
 * Defines interfaces for CRO agent configuration and runtime state.
 * Phase 19c: Added scanMode for coverage tracking.
 */

import type { CROInsight } from './cro-insight.js';
import { type CROMemory, createInitialMemory } from './cro-memory.js';
import type { ScanMode } from './coverage.js';

/**
 * Agent configuration options
 * Maps to config requirements CR-010 through CR-015
 * Phase 19e: Added scanMode for coverage configuration
 */
export interface CROAgentOptions {
  maxSteps: number;              // CR-010: 10 default
  actionWaitMs: number;          // CR-011: 500ms default
  llmTimeoutMs: number;          // CR-012: 60000ms default
  failureLimit: number;          // CR-014: 3 default
  tokenBudgetWarning: number;    // CR-013: 0.6 default
  textTruncateLength: number;    // CR-015: 100 default
  scanMode: ScanMode;            // Phase 19e: Scan mode for coverage (default: full_page)
}

/**
 * Default agent options per config requirements
 * Phase 19e: Added scanMode: 'full_page' as default
 */
export const DEFAULT_CRO_OPTIONS: CROAgentOptions = {
  maxSteps: 10,
  actionWaitMs: 500,
  llmTimeoutMs: 60000,
  failureLimit: 3,
  tokenBudgetWarning: 0.6,
  textTruncateLength: 100,
  scanMode: 'full_page',
};

/**
 * Agent runtime state
 * Phase 19c: Added scanMode for coverage tracking
 */
export interface AgentState {
  step: number;
  consecutiveFailures: number;
  totalFailures: number;
  insights: CROInsight[];
  memory: CROMemory;
  isDone: boolean;
  doneReason?: string;           // Why agent stopped
  startTime: number;
  lastActionTime?: number;
  scanMode: ScanMode;            // Phase 19: Scan mode for coverage
}

/**
 * Factory function to create initial agent state
 * @param scanMode - Scan mode for coverage tracking (default: 'full_page')
 */
export function createInitialState(scanMode: ScanMode = 'full_page'): AgentState {
  return {
    step: 0,
    consecutiveFailures: 0,
    totalFailures: 0,
    insights: [],
    memory: createInitialMemory(),
    isDone: false,
    startTime: Date.now(),
    scanMode,
  };
}
