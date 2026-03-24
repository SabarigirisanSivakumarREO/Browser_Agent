import { describe, it, expect, vi } from 'vitest';
import {
  critiqueAction,
  computeStateDiff,
  shouldCritique,
} from '../../../src/agent/agent-loop/self-critic.js';
import type { PerceivedState, ActionRecord } from '../../../src/agent/agent-loop/types.js';

const basePre: PerceivedState = {
  url: 'https://shop.com/products',
  title: 'Products',
  domHash: 'aaa',
  axTreeText: 'link "Shoes" button "Add"',
  interactiveElements: [
    { index: 0, tag: 'a', text: 'Shoes' },
    { index: 1, tag: 'button', text: 'Add' },
  ],
  hasBlocker: false,
};

const baseAction: ActionRecord = {
  step: 1,
  toolName: 'click',
  toolParams: { elementIndex: 0 },
  reasoning: 'Click shoes link',
  expectedOutcome: 'Navigate to shoes page',
  success: true,
  domHashBefore: 'aaa',
  domHashAfter: 'bbb',
  durationMs: 50,
  timestamp: new Date().toISOString(),
};

describe('shouldCritique', () => {
  it('returns true only when enabled and no router/verifier', () => {
    expect(shouldCritique(true, false, false)).toBe(true);
    expect(shouldCritique(false, false, false)).toBe(false);
    expect(shouldCritique(true, true, false)).toBe(false);
    expect(shouldCritique(true, false, true)).toBe(false);
  });
});

describe('computeStateDiff', () => {
  it('reports URL change and new/removed elements', () => {
    const post: PerceivedState = {
      ...basePre,
      url: 'https://shop.com/shoes',
      title: 'Shoes',
      domHash: 'bbb',
      interactiveElements: [
        { index: 0, tag: 'button', text: 'Add to Cart' },
        { index: 1, tag: 'a', text: 'Back' },
      ],
    };
    const diff = computeStateDiff(basePre, post);
    expect(diff).toContain('https://shop.com/products');
    expect(diff).toContain('https://shop.com/shoes');
    expect(diff).toContain('changed'); // DOM hash
    expect(diff).toContain('Add to Cart'); // new element
  });

  it('reports unchanged when states are identical', () => {
    const diff = computeStateDiff(basePre, basePre);
    expect(diff).toContain('unchanged');
    expect(diff).not.toContain('→');
  });
});

describe('critiqueAction', () => {
  it('parses useful action from LLM response', async () => {
    const mockLLM = {
      invoke: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          actionWasUseful: true,
          progressScore: 0.8,
          reasoning: 'Navigated to correct page',
        }),
      }),
    };
    const post = { ...basePre, url: 'https://shop.com/shoes', domHash: 'bbb' };
    const result = await critiqueAction(
      mockLLM as any, 'Buy shoes', null, baseAction, basePre, post, []
    );
    expect(result.actionWasUseful).toBe(true);
    expect(result.progressScore).toBe(0.8);
  });

  it('returns neutral fallback on LLM error', async () => {
    const mockLLM = {
      invoke: vi.fn().mockRejectedValue(new Error('timeout')),
    };
    const result = await critiqueAction(
      mockLLM as any, 'Buy shoes', null, baseAction, basePre, basePre, []
    );
    expect(result.actionWasUseful).toBe(true);
    expect(result.progressScore).toBe(0.5);
    expect(result.reasoning).toBe('Critique unavailable');
  });
});
