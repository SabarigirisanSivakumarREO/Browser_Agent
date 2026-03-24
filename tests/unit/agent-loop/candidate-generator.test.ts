import { describe, it, expect, vi } from 'vitest';
import {
  generateCandidates,
  deduplicateCandidates,
  plannerOutputToCandidate,
} from '../../../src/agent/agent-loop/candidate-generator.js';
import type { ActionCandidate } from '../../../src/agent/agent-loop/types.js';

// Mock planner for fallback tests
vi.mock('../../../src/agent/agent-loop/planner.js', () => ({
  planNextAction: vi.fn().mockResolvedValue({
    reasoning: 'fallback plan',
    toolName: 'extract_text',
    toolParams: {},
    expectedOutcome: 'Get text',
  }),
}));

// Mock langchain messages
vi.mock('@langchain/core/messages', () => ({
  SystemMessage: vi.fn().mockImplementation(function (content: string) { return { role: 'system', content }; }),
  HumanMessage: vi.fn().mockImplementation(function (content: string) { return { role: 'human', content }; }),
}));

describe('deduplicateCandidates', () => {
  it('removes duplicates keeping higher selfScore', () => {
    const candidates: ActionCandidate[] = [
      { reasoning: 'a', toolName: 'click', toolParams: { elementIndex: 3 }, expectedOutcome: 'x', selfScore: 0.7, risk: 'low' },
      { reasoning: 'b', toolName: 'click', toolParams: { elementIndex: 3 }, expectedOutcome: 'y', selfScore: 0.9, risk: 'low' },
      { reasoning: 'c', toolName: 'type_text', toolParams: { elementIndex: 5, text: 'hi' }, expectedOutcome: 'z', selfScore: 0.8, risk: 'med' },
    ];
    const result = deduplicateCandidates(candidates);
    expect(result).toHaveLength(2);
    expect(result[0]!.selfScore).toBe(0.9); // click:3 kept with higher score
    expect(result[1]!.toolName).toBe('type_text');
  });
});

describe('plannerOutputToCandidate', () => {
  it('wraps PlannerOutput with default score', () => {
    const plan = { reasoning: 'r', toolName: 'scroll_page', toolParams: { direction: 'down' }, expectedOutcome: 'scrolls' };
    const candidate = plannerOutputToCandidate(plan);
    expect(candidate.selfScore).toBe(0.5);
    expect(candidate.risk).toContain('fallback');
    expect(candidate.toolName).toBe('scroll_page');
  });
});

describe('generateCandidates', () => {
  const mockState = {
    url: 'https://example.com',
    title: 'Test',
    domHash: 'abc',
    axTreeText: 'button "Submit"',
    interactiveElements: [{ index: 0, tag: 'button', text: 'Submit' }],
    hasBlocker: false,
  };

  it('parses multi-candidate LLM response', async () => {
    const mockLLM = {
      invoke: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          candidates: [
            { reasoning: 'Click submit', toolName: 'click', toolParams: { elementIndex: 0 }, expectedOutcome: 'Form submits', selfScore: 0.9, risk: 'form error' },
            { reasoning: 'Scroll down', toolName: 'scroll_page', toolParams: { direction: 'down' }, expectedOutcome: 'See more', selfScore: 0.6, risk: 'nothing new' },
          ],
        }),
      }),
    };
    const result = await generateCandidates(
      mockLLM as any, 'Submit form', null, mockState as any,
      [], null, { exceeded: false, stepsUsed: 1, stepsRemaining: 9, timeElapsedMs: 1000, timeRemainingMs: 119000 },
      0.9, [], 'none'
    );
    expect(result).toHaveLength(2);
    expect(result[0]!.selfScore).toBe(0.9);
    expect(result[0]!.toolName).toBe('click');
  });

  it('falls back to planNextAction on parse failure', async () => {
    const mockLLM = {
      invoke: vi.fn().mockResolvedValue({ content: 'not valid json at all' }),
    };
    const result = await generateCandidates(
      mockLLM as any, 'Do something', null, mockState as any,
      [], null, { exceeded: false, stepsUsed: 0, stepsRemaining: 20, timeElapsedMs: 0, timeRemainingMs: 120000 },
      1.0, [], 'none'
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.selfScore).toBe(0.5); // fallback score
  });
});
