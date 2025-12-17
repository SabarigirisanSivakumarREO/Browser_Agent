/**
 * State Manager
 *
 * Phase 16 (T080): Manages CRO agent state transitions and termination conditions.
 * Phase 19c (T137): Added coverage tracking integration.
 * Handles step counting, failure tracking, insights collection, and memory management.
 */

import type {
  CROAgentOptions,
  AgentState,
  CROInsight,
  StepRecord,
  CROMemory,
  ScanMode,
} from '../models/index.js';
import { DEFAULT_CRO_OPTIONS, createInitialState } from '../models/index.js';
import type { CoverageTracker } from './coverage-tracker.js';

/**
 * StateManager - Manages agent state throughout analysis
 *
 * Responsibilities:
 * - Track step count and manage step increments (FR-043)
 * - Track consecutive and total failures (FR-044, CR-014)
 * - Manage termination conditions (FR-045, CR-010)
 * - Collect and store insights
 * - Maintain memory for context across steps
 * - Phase 19c: Coverage tracking integration
 */
export class StateManager {
  private state: AgentState;
  private readonly options: CROAgentOptions;
  private coverageTracker?: CoverageTracker;

  /**
   * Create a StateManager with optional custom options
   * @param options - Partial options to override defaults
   * @param scanMode - Scan mode for coverage tracking (default: 'full_page')
   */
  constructor(options?: Partial<CROAgentOptions>, scanMode: ScanMode = 'full_page') {
    this.options = { ...DEFAULT_CRO_OPTIONS, ...options };
    this.state = createInitialState(scanMode);
  }

  // ─── State Accessors ───────────────────────────────────────────

  /**
   * Get a copy of current state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Get current step number
   */
  getStep(): number {
    return this.state.step;
  }

  /**
   * Get collected insights
   */
  getInsights(): CROInsight[] {
    return [...this.state.insights];
  }

  /**
   * Check if agent is done
   */
  isDone(): boolean {
    return this.state.isDone;
  }

  /**
   * Get done reason if set
   */
  getDoneReason(): string | undefined {
    return this.state.doneReason;
  }

  /**
   * Get memory state
   */
  getMemory(): CROMemory {
    return {
      ...this.state.memory,
      stepHistory: [...this.state.memory.stepHistory],
      findings: [...this.state.memory.findings],
      pagesSeen: [...this.state.memory.pagesSeen],
      errors: [...this.state.memory.errors],
    };
  }

  /**
   * Get consecutive failure count
   */
  getConsecutiveFailures(): number {
    return this.state.consecutiveFailures;
  }

  /**
   * Get total failure count
   */
  getTotalFailures(): number {
    return this.state.totalFailures;
  }

  /**
   * Get options
   */
  getOptions(): CROAgentOptions {
    return { ...this.options };
  }

  // ─── Step Management ───────────────────────────────────────────

  /**
   * Increment step counter and update last action time
   */
  incrementStep(): void {
    this.state.step++;
    this.state.lastActionTime = Date.now();
  }

  /**
   * Mark agent as done with a reason
   * @param reason - Explanation for completion
   */
  setDone(reason: string): void {
    this.state.isDone = true;
    this.state.doneReason = reason;
  }

  // ─── Failure Tracking (FR-023, CR-014) ─────────────────────────

  /**
   * Record a failure (increments both consecutive and total)
   * @param error - Error message to store in memory
   */
  recordFailure(error: string): void {
    this.state.consecutiveFailures++;
    this.state.totalFailures++;
    this.state.memory.errors.push(error);

    // Keep only last 10 errors in memory
    if (this.state.memory.errors.length > 10) {
      this.state.memory.errors = this.state.memory.errors.slice(-10);
    }
  }

  /**
   * Reset consecutive failure counter (on successful action)
   * Note: totalFailures is NOT reset
   */
  resetFailures(): void {
    this.state.consecutiveFailures = 0;
  }

  // ─── Termination Conditions ────────────────────────────────────

  /**
   * Check if agent should terminate
   * Conditions: maxSteps reached OR too many consecutive failures OR done
   * Phase 19c: In full_page mode, also check if coverage is complete
   */
  shouldTerminate(): boolean {
    // Basic termination conditions
    if (this.state.step >= this.options.maxSteps) {
      return true;
    }
    if (this.state.consecutiveFailures >= this.options.failureLimit) {
      return true;
    }

    // If agent is done, check coverage in full_page mode
    if (this.state.isDone) {
      // In full_page mode, only terminate if coverage is also complete
      if (this.state.scanMode === 'full_page' && this.coverageTracker) {
        return this.coverageTracker.isFullyCovered();
      }
      return true;
    }

    return false;
  }

  /**
   * Get reason for termination
   */
  getTerminationReason(): string {
    if (this.state.isDone) {
      // Check if coverage blocked termination
      if (this.state.scanMode === 'full_page' && this.coverageTracker) {
        if (!this.coverageTracker.isFullyCovered()) {
          return `Coverage incomplete (${this.coverageTracker.getCoveragePercent()}%)`;
        }
      }
      return this.state.doneReason || 'Agent completed analysis';
    }
    if (this.state.step >= this.options.maxSteps) {
      return `Max steps reached (${this.options.maxSteps})`;
    }
    if (this.state.consecutiveFailures >= this.options.failureLimit) {
      return `Too many consecutive failures (${this.options.failureLimit})`;
    }
    return 'Unknown';
  }

  /**
   * Check if near step limit (for UI feedback)
   * @param threshold - Percentage (0-1) of max steps to consider "near"
   */
  isNearStepLimit(threshold = 0.8): boolean {
    return this.state.step >= this.options.maxSteps * threshold;
  }

  // ─── Insight Management ────────────────────────────────────────

  /**
   * Add a single insight
   * @param insight - CRO insight to add
   */
  addInsight(insight: CROInsight): void {
    this.state.insights.push(insight);
    this.state.memory.findings.push(insight);
  }

  /**
   * Add multiple insights
   * @param insights - Array of CRO insights to add
   */
  addInsights(insights: CROInsight[]): void {
    for (const insight of insights) {
      this.addInsight(insight);
    }
  }

  /**
   * Get insights by severity
   * @param severity - Severity level to filter by
   */
  getInsightsBySeverity(severity: CROInsight['severity']): CROInsight[] {
    return this.state.insights.filter((i) => i.severity === severity);
  }

  /**
   * Get insight count by severity
   */
  getInsightCountBySeverity(): Record<CROInsight['severity'], number> {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const insight of this.state.insights) {
      counts[insight.severity]++;
    }
    return counts;
  }

  // ─── Memory Management ─────────────────────────────────────────

  /**
   * Record a completed step
   * @param record - Step record to add to history
   */
  recordStep(record: StepRecord): void {
    this.state.memory.stepHistory.push(record);
  }

  /**
   * Update current focus area
   * @param focus - What the agent is currently analyzing
   */
  updateFocus(focus: string): void {
    this.state.memory.currentFocus = focus;
  }

  /**
   * Add a page URL to seen list
   * @param url - URL to mark as seen
   */
  addPageSeen(url: string): void {
    if (!this.state.memory.pagesSeen.includes(url)) {
      this.state.memory.pagesSeen.push(url);
    }
  }

  /**
   * Check if a page URL has been seen
   * @param url - URL to check
   */
  hasSeenPage(url: string): boolean {
    return this.state.memory.pagesSeen.includes(url);
  }

  // ─── Timing ────────────────────────────────────────────────────

  /**
   * Get elapsed time since agent started
   */
  getElapsedTimeMs(): number {
    return Date.now() - this.state.startTime;
  }

  /**
   * Get time since last action
   */
  getTimeSinceLastActionMs(): number | undefined {
    if (!this.state.lastActionTime) {
      return undefined;
    }
    return Date.now() - this.state.lastActionTime;
  }

  // ─── Reset ─────────────────────────────────────────────────────

  /**
   * Reset state to initial values (keeps options)
   */
  reset(): void {
    this.state = createInitialState(this.state.scanMode);
    this.coverageTracker = undefined;
  }

  // ─── Coverage Tracking (Phase 19c) ──────────────────────────────

  /**
   * Set coverage tracker instance
   * @param tracker - CoverageTracker to use for coverage tracking
   */
  setCoverageTracker(tracker: CoverageTracker): void {
    this.coverageTracker = tracker;
  }

  /**
   * Get coverage tracker if set
   */
  getCoverageTracker(): CoverageTracker | undefined {
    return this.coverageTracker;
  }

  /**
   * Check if coverage tracking is enabled
   */
  hasCoverageTracking(): boolean {
    return this.coverageTracker !== undefined;
  }

  /**
   * Get current coverage percentage
   * @returns Coverage percentage (0-100) or 100 if no tracker
   */
  getCoveragePercent(): number {
    return this.coverageTracker?.getCoveragePercent() ?? 100;
  }

  /**
   * Check if coverage requirements are met
   */
  isFullyCovered(): boolean {
    return this.coverageTracker?.isFullyCovered() ?? true;
  }

  /**
   * Get scan mode
   */
  getScanMode(): ScanMode {
    return this.state.scanMode;
  }

  /**
   * Check if running in full_page mode
   */
  isFullPageMode(): boolean {
    return this.state.scanMode === 'full_page';
  }

  /**
   * Get coverage report string for LLM context
   */
  getCoverageReport(): string | undefined {
    return this.coverageTracker?.getCoverageReport();
  }

  // ─── Summary ───────────────────────────────────────────────────

  /**
   * Get a summary of current state (for logging/debugging)
   * Phase 19c: Added scanMode and coveragePercent
   */
  getSummary(): {
    step: number;
    maxSteps: number;
    isDone: boolean;
    consecutiveFailures: number;
    totalFailures: number;
    insightCount: number;
    focus: string;
    elapsedMs: number;
    scanMode: ScanMode;
    coveragePercent: number;
  } {
    return {
      step: this.state.step,
      maxSteps: this.options.maxSteps,
      isDone: this.state.isDone,
      consecutiveFailures: this.state.consecutiveFailures,
      totalFailures: this.state.totalFailures,
      insightCount: this.state.insights.length,
      focus: this.state.memory.currentFocus,
      elapsedMs: this.getElapsedTimeMs(),
      scanMode: this.state.scanMode,
      coveragePercent: this.getCoveragePercent(),
    };
  }
}
