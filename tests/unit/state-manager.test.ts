/**
 * StateManager Unit Tests
 *
 * Phase 16 (T085): Tests for StateManager class.
 * Verifies state transitions, failure tracking, and termination conditions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../../src/agent/state-manager.js';
import type { CROInsight, StepRecord, CROAgentOptions } from '../../src/models/index.js';

// Mock insight for testing
const createMockInsight = (overrides?: Partial<CROInsight>): CROInsight => ({
  id: `insight-${Date.now()}`,
  category: 'cta',
  type: 'weak_cta',
  severity: 'high',
  element: '//button[1]',
  issue: 'CTA text is vague',
  recommendation: 'Use action-oriented text',
  ...overrides,
});

// Mock step record for testing
const createMockStepRecord = (step: number, action: string, success = true): StepRecord => ({
  step,
  action,
  result: { success, insights: [] },
  timestamp: Date.now(),
});

describe('StateManager', () => {
  let manager: StateManager;

  beforeEach(() => {
    manager = new StateManager();
  });

  describe('constructor', () => {
    // Test 1: Creates with default options
    it('should create with default options', () => {
      const options = manager.getOptions();
      expect(options.maxSteps).toBe(10);
      expect(options.failureLimit).toBe(3);
      expect(options.actionWaitMs).toBe(500);
    });

    // Test 2: Accepts custom options
    it('should merge custom options with defaults', () => {
      const custom: Partial<CROAgentOptions> = { maxSteps: 5, failureLimit: 2 };
      const customManager = new StateManager(custom);

      const options = customManager.getOptions();
      expect(options.maxSteps).toBe(5);
      expect(options.failureLimit).toBe(2);
      expect(options.actionWaitMs).toBe(500); // default
    });

    // Test 3: Initializes with correct initial state
    it('should initialize with correct initial state', () => {
      expect(manager.getStep()).toBe(0);
      expect(manager.isDone()).toBe(false);
      expect(manager.getConsecutiveFailures()).toBe(0);
      expect(manager.getTotalFailures()).toBe(0);
      expect(manager.getInsights()).toEqual([]);
    });
  });

  describe('step management', () => {
    // Test 4: Increment step
    it('should increment step counter', () => {
      expect(manager.getStep()).toBe(0);
      manager.incrementStep();
      expect(manager.getStep()).toBe(1);
      manager.incrementStep();
      expect(manager.getStep()).toBe(2);
    });

    // Test 5: Set done with reason
    it('should set done state with reason', () => {
      manager.setDone('Analysis complete');
      expect(manager.isDone()).toBe(true);
      expect(manager.getDoneReason()).toBe('Analysis complete');
    });
  });

  describe('failure tracking (FR-023, CR-014)', () => {
    // Test 6: Record failure increments counters
    it('should increment both failure counters on recordFailure', () => {
      manager.recordFailure('LLM timeout');
      expect(manager.getConsecutiveFailures()).toBe(1);
      expect(manager.getTotalFailures()).toBe(1);

      manager.recordFailure('Parse error');
      expect(manager.getConsecutiveFailures()).toBe(2);
      expect(manager.getTotalFailures()).toBe(2);
    });

    // Test 7: Record failure adds to memory errors
    it('should add error message to memory', () => {
      manager.recordFailure('Test error');
      const memory = manager.getMemory();
      expect(memory.errors).toContain('Test error');
    });

    // Test 8: Reset failures clears consecutive only
    it('should reset consecutive failures but not total', () => {
      manager.recordFailure('Error 1');
      manager.recordFailure('Error 2');
      expect(manager.getConsecutiveFailures()).toBe(2);
      expect(manager.getTotalFailures()).toBe(2);

      manager.resetFailures();
      expect(manager.getConsecutiveFailures()).toBe(0);
      expect(manager.getTotalFailures()).toBe(2);
    });

    // Test 9: Memory errors limited to 10
    it('should limit memory errors to last 10', () => {
      for (let i = 0; i < 15; i++) {
        manager.recordFailure(`Error ${i}`);
      }
      const memory = manager.getMemory();
      expect(memory.errors.length).toBe(10);
      expect(memory.errors[0]).toBe('Error 5');
      expect(memory.errors[9]).toBe('Error 14');
    });
  });

  describe('termination conditions', () => {
    // Test 10: shouldTerminate on max steps (CR-010)
    it('should terminate when max steps reached', () => {
      const mgr = new StateManager({ maxSteps: 3 });
      expect(mgr.shouldTerminate()).toBe(false);

      mgr.incrementStep(); // 1
      mgr.incrementStep(); // 2
      mgr.incrementStep(); // 3
      expect(mgr.shouldTerminate()).toBe(true);
      expect(mgr.getTerminationReason()).toContain('Max steps');
    });

    // Test 11: shouldTerminate on consecutive failures (CR-014)
    it('should terminate when failure limit reached', () => {
      const mgr = new StateManager({ failureLimit: 2 });
      expect(mgr.shouldTerminate()).toBe(false);

      mgr.recordFailure('Error 1');
      mgr.recordFailure('Error 2');
      expect(mgr.shouldTerminate()).toBe(true);
      expect(mgr.getTerminationReason()).toContain('failures');
    });

    // Test 12: shouldTerminate when done
    it('should terminate when agent sets done', () => {
      expect(manager.shouldTerminate()).toBe(false);
      manager.setDone('Complete');
      expect(manager.shouldTerminate()).toBe(true);
      expect(manager.getTerminationReason()).toBe('Complete');
    });

    // Test 13: isNearStepLimit check
    it('should detect when near step limit', () => {
      const mgr = new StateManager({ maxSteps: 10 });
      expect(mgr.isNearStepLimit()).toBe(false);

      for (let i = 0; i < 8; i++) mgr.incrementStep();
      expect(mgr.isNearStepLimit()).toBe(true); // 8/10 = 80%
    });
  });

  describe('insight management', () => {
    // Test 14: Add single insight
    it('should add insight to both state and memory', () => {
      const insight = createMockInsight();
      manager.addInsight(insight);

      expect(manager.getInsights()).toHaveLength(1);
      expect(manager.getMemory().findings).toHaveLength(1);
    });

    // Test 15: Add multiple insights
    it('should add multiple insights', () => {
      const insights = [
        createMockInsight({ severity: 'high' }),
        createMockInsight({ severity: 'medium' }),
        createMockInsight({ severity: 'low' }),
      ];
      manager.addInsights(insights);

      expect(manager.getInsights()).toHaveLength(3);
    });

    // Test 16: Get insights by severity
    it('should filter insights by severity', () => {
      manager.addInsight(createMockInsight({ severity: 'critical' }));
      manager.addInsight(createMockInsight({ severity: 'high' }));
      manager.addInsight(createMockInsight({ severity: 'high' }));
      manager.addInsight(createMockInsight({ severity: 'low' }));

      expect(manager.getInsightsBySeverity('high')).toHaveLength(2);
      expect(manager.getInsightsBySeverity('critical')).toHaveLength(1);
      expect(manager.getInsightsBySeverity('medium')).toHaveLength(0);
    });

    // Test 17: Get insight count by severity
    it('should return counts by severity', () => {
      manager.addInsight(createMockInsight({ severity: 'critical' }));
      manager.addInsight(createMockInsight({ severity: 'high' }));
      manager.addInsight(createMockInsight({ severity: 'high' }));

      const counts = manager.getInsightCountBySeverity();
      expect(counts.critical).toBe(1);
      expect(counts.high).toBe(2);
      expect(counts.medium).toBe(0);
      expect(counts.low).toBe(0);
    });
  });

  describe('memory management', () => {
    // Test 18: Record step in history
    it('should record step in memory history', () => {
      const record = createMockStepRecord(0, 'analyze_ctas');
      manager.recordStep(record);

      const memory = manager.getMemory();
      expect(memory.stepHistory).toHaveLength(1);
      expect(memory.stepHistory[0].action).toBe('analyze_ctas');
    });

    // Test 19: Update focus
    it('should update current focus', () => {
      manager.updateFocus('form_analysis');
      expect(manager.getMemory().currentFocus).toBe('form_analysis');
    });

    // Test 20: Add page seen
    it('should track pages seen', () => {
      manager.addPageSeen('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711');
      manager.addPageSeen('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711/products');

      const memory = manager.getMemory();
      expect(memory.pagesSeen).toHaveLength(2);
    });

    // Test 21: Don't duplicate pages
    it('should not add duplicate page URLs', () => {
      manager.addPageSeen('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711');
      manager.addPageSeen('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711');

      expect(manager.getMemory().pagesSeen).toHaveLength(1);
    });

    // Test 22: Check has seen page
    it('should check if page has been seen', () => {
      manager.addPageSeen('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711');

      expect(manager.hasSeenPage('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711')).toBe(true);
      expect(manager.hasSeenPage('https://other.com')).toBe(false);
    });
  });

  describe('timing', () => {
    // Test 23: Get elapsed time
    it('should track elapsed time since start', async () => {
      await new Promise((r) => setTimeout(r, 50));
      const elapsed = manager.getElapsedTimeMs();
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });

    // Test 24: Get time since last action
    it('should track time since last action', async () => {
      expect(manager.getTimeSinceLastActionMs()).toBeUndefined();

      manager.incrementStep(); // Sets lastActionTime
      await new Promise((r) => setTimeout(r, 50));

      const timeSince = manager.getTimeSinceLastActionMs();
      expect(timeSince).toBeGreaterThanOrEqual(40);
    });
  });

  describe('reset', () => {
    // Test 25: Reset clears state
    it('should reset to initial state', () => {
      manager.incrementStep();
      manager.recordFailure('Error');
      manager.addInsight(createMockInsight());
      manager.setDone('Test');

      manager.reset();

      expect(manager.getStep()).toBe(0);
      expect(manager.isDone()).toBe(false);
      expect(manager.getConsecutiveFailures()).toBe(0);
      expect(manager.getInsights()).toHaveLength(0);
    });
  });

  describe('getSummary', () => {
    // Test 26: Get state summary
    it('should return comprehensive summary', () => {
      manager.incrementStep();
      manager.recordFailure('Error');
      manager.addInsight(createMockInsight());
      manager.updateFocus('cta_check');

      const summary = manager.getSummary();
      expect(summary.step).toBe(1);
      expect(summary.maxSteps).toBe(10);
      expect(summary.isDone).toBe(false);
      expect(summary.consecutiveFailures).toBe(1);
      expect(summary.totalFailures).toBe(1);
      expect(summary.insightCount).toBe(1);
      expect(summary.focus).toBe('cta_check');
      expect(summary.elapsedMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getState', () => {
    // Test 27: Get state returns copy
    it('should return a copy of state', () => {
      const state1 = manager.getState();
      manager.incrementStep();
      const state2 = manager.getState();

      expect(state1.step).toBe(0);
      expect(state2.step).toBe(1);
    });
  });

  describe('getMemory', () => {
    // Test 28: Get memory returns deep copy
    it('should return a deep copy of memory', () => {
      manager.addInsight(createMockInsight());
      const memory1 = manager.getMemory();
      memory1.findings.pop(); // Modify copy

      const memory2 = manager.getMemory();
      expect(memory2.findings).toHaveLength(1); // Original unchanged
    });
  });
});
