import { describe, it, expect, vi } from 'vitest';
import { BudgetController } from '../../../src/agent/agent-loop/budget-controller.js';

describe('BudgetController', () => {
  it('is not exceeded initially', () => {
    const bc = new BudgetController(20, 120000);
    expect(bc.isExceeded()).toBe(false);
    expect(bc.stepsUsed).toBe(0);
  });

  it('is exceeded after maxSteps reached', () => {
    const bc = new BudgetController(3, 120000);
    bc.recordStep();
    bc.recordStep();
    bc.recordStep();
    expect(bc.isExceeded()).toBe(true);
  });

  it('getStatus returns correct remaining counts', () => {
    const bc = new BudgetController(10, 120000);
    bc.recordStep();
    bc.recordStep();
    const status = bc.getStatus();
    expect(status.stepsUsed).toBe(2);
    expect(status.stepsRemaining).toBe(8);
    expect(status.exceeded).toBe(false);
    expect(status.timeElapsedMs).toBeGreaterThanOrEqual(0);
    expect(status.timeRemainingMs).toBeLessThanOrEqual(120000);
  });
});
