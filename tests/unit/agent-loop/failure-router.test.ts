import { describe, it, expect } from 'vitest';
import {
  routeFailure,
  detectFailure,
} from '../../../src/agent/agent-loop/failure-router.js';
import type { DetectedFailure } from '../../../src/agent/agent-loop/types.js';

describe('routeFailure', () => {
  it('ELEMENT_NOT_FOUND with retries < 3 → REPLAN', () => {
    const failure: DetectedFailure = {
      type: 'ELEMENT_NOT_FOUND',
      details: 'Element not found',
      retryCount: 1,
    };
    expect(routeFailure(failure).strategy).toBe('REPLAN');
  });

  it('ELEMENT_NOT_FOUND with retries >= 3 → TERMINATE', () => {
    const failure: DetectedFailure = {
      type: 'ELEMENT_NOT_FOUND',
      details: 'Element not found',
      retryCount: 3,
    };
    expect(routeFailure(failure).strategy).toBe('TERMINATE');
  });

  it('ACTION_HAD_NO_EFFECT → REPLAN_WITH_DIAGNOSTIC', () => {
    const failure: DetectedFailure = {
      type: 'ACTION_HAD_NO_EFFECT',
      details: 'DOM unchanged',
      retryCount: 0,
    };
    expect(routeFailure(failure).strategy).toBe('REPLAN_WITH_DIAGNOSTIC');
  });

  it('BUDGET_EXCEEDED → TERMINATE', () => {
    const failure: DetectedFailure = {
      type: 'BUDGET_EXCEEDED',
      details: 'Steps exceeded',
      retryCount: 0,
    };
    expect(routeFailure(failure).strategy).toBe('TERMINATE');
  });
});

describe('detectFailure', () => {
  it('detects ACTION_HAD_NO_EFFECT when DOM unchanged on mutating tool', () => {
    const result = { success: true, insights: [] };
    const failure = detectFailure('click', result, 'abc123', 'abc123');
    expect(failure).not.toBeNull();
    expect(failure!.type).toBe('ACTION_HAD_NO_EFFECT');
  });

  it('does not detect failure for read-only tools with unchanged DOM', () => {
    const result = { success: true, insights: [] };
    const failure = detectFailure('extract_text', result, 'abc123', 'abc123');
    expect(failure).toBeNull();
  });

  it('detects ELEMENT_NOT_FOUND from error message', () => {
    const result = { success: false, insights: [], error: 'Element not found at index 5' };
    const failure = detectFailure('click', result, 'abc', 'abc');
    expect(failure).not.toBeNull();
    expect(failure!.type).toBe('ELEMENT_NOT_FOUND');
  });

  it('returns null when action succeeded and DOM changed', () => {
    const result = { success: true, insights: [] };
    const failure = detectFailure('click', result, 'abc', 'def');
    expect(failure).toBeNull();
  });
});
