import { describe, it, expect } from 'vitest';
import { ConfidenceDecay } from '../../../src/agent/agent-loop/confidence-decay.js';

describe('ConfidenceDecay', () => {
  it('starts at 1.0', () => {
    const cd = new ConfidenceDecay();
    expect(cd.current).toBe(1.0);
  });

  it('decays by factor each step', () => {
    const cd = new ConfidenceDecay(0.1);
    cd.decay();
    expect(cd.current).toBeCloseTo(0.9);
    cd.decay();
    expect(cd.current).toBeCloseTo(0.8);
  });

  it('signals escalation below threshold', () => {
    const cd = new ConfidenceDecay(0.05, 0.3);
    expect(cd.shouldEscalate()).toBe(false);
    // Decay 15 times: 1.0 - 15*0.05 = 0.25 < 0.3
    for (let i = 0; i < 15; i++) cd.decay();
    expect(cd.current).toBeCloseTo(0.25);
    expect(cd.shouldEscalate()).toBe(true);
  });

  it('never drops below 0 and reset restores to 1.0', () => {
    const cd = new ConfidenceDecay(0.5);
    cd.decay(); // 0.5
    cd.decay(); // 0.0
    cd.decay(); // still 0.0
    expect(cd.current).toBe(0);
    cd.reset();
    expect(cd.current).toBe(1.0);
  });
});
