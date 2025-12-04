/**
 * Agent State Models
 *
 * Defines interfaces for CRO agent configuration and runtime state.
 */

import type { CROInsight } from './cro-insight.js';
import { type CROMemory, createInitialMemory } from './cro-memory.js';

/**
 * Agent configuration options
 * Maps to config requirements CR-010 through CR-015
 */
export interface CROAgentOptions {
  maxSteps: number;              // CR-010: 10 default
  actionWaitMs: number;          // CR-011: 500ms default
  llmTimeoutMs: number;          // CR-012: 60000ms default
  failureLimit: number;          // CR-014: 3 default
  tokenBudgetWarning: number;    // CR-013: 0.6 default
  textTruncateLength: number;    // CR-015: 100 default
}

/**
 * Default agent options per config requirements
 */
export const DEFAULT_CRO_OPTIONS: CROAgentOptions = {
  maxSteps: 10,
  actionWaitMs: 500,
  llmTimeoutMs: 60000,
  failureLimit: 3,
  tokenBudgetWarning: 0.6,
  textTruncateLength: 100,
};

/**
 * Agent runtime state
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
}

/**
 * Factory function to create initial agent state
 */
export function createInitialState(): AgentState {
  return {
    step: 0,
    consecutiveFailures: 0,
    totalFailures: 0,
    insights: [],
    memory: createInitialMemory(),
    isDone: false,
    startTime: Date.now(),
  };
}
