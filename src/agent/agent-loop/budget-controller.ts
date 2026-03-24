/**
 * Budget Controller
 *
 * Phase 32 (T713): Tracks step and time budgets for the agent loop.
 * Terminates the loop cleanly when any budget is exceeded.
 */

import type { BudgetStatus } from './types.js';

/**
 * Tracks step count and elapsed time against configured budgets.
 */
export class BudgetController {
  private readonly maxSteps: number;
  private readonly maxTimeMs: number;
  private readonly startTime: number;
  private steps: number;

  constructor(maxSteps: number, maxTimeMs: number) {
    this.maxSteps = maxSteps;
    this.maxTimeMs = maxTimeMs;
    this.startTime = Date.now();
    this.steps = 0;
  }

  /** Record one completed step */
  recordStep(): void {
    this.steps++;
  }

  /** Number of steps used so far */
  get stepsUsed(): number {
    return this.steps;
  }

  /** Check if any budget is exceeded */
  isExceeded(): boolean {
    return (
      this.steps >= this.maxSteps ||
      Date.now() - this.startTime >= this.maxTimeMs
    );
  }

  /** Get a full budget status snapshot */
  getStatus(): BudgetStatus {
    const elapsed = Date.now() - this.startTime;
    const stepsExceeded = this.steps >= this.maxSteps;
    const timeExceeded = elapsed >= this.maxTimeMs;

    return {
      exceeded: stepsExceeded || timeExceeded,
      budgetKind: stepsExceeded
        ? 'steps'
        : timeExceeded
          ? 'time'
          : undefined,
      stepsUsed: this.steps,
      stepsRemaining: Math.max(0, this.maxSteps - this.steps),
      timeElapsedMs: elapsed,
      timeRemainingMs: Math.max(0, this.maxTimeMs - elapsed),
    };
  }
}
