import { describe, it, expect, vi } from 'vitest';
import {
  shouldDecompose,
  decomposeGoal,
  checkSubGoalCompletion,
} from '../../../src/agent/agent-loop/sub-goal-planner.js';
import type { PerceivedState, SubGoal } from '../../../src/agent/agent-loop/types.js';

describe('shouldDecompose', () => {
  it('returns true for complex goals, false for simple', () => {
    expect(shouldDecompose('Go to wikipedia')).toBe(false);
    expect(shouldDecompose('Search for TypeScript on Wikipedia and then click the first result and extract the summary')).toBe(true);
    expect(shouldDecompose('Navigate to the product page and add item to cart')).toBe(true);
    expect(shouldDecompose('Click the button')).toBe(false);
  });
});

describe('decomposeGoal', () => {
  it('parses valid LLM response into SubGoal array', async () => {
    const mockLLM = {
      invoke: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          subGoals: [
            { description: 'Navigate to site', successCriteria: 'URL contains example.com', estimatedSteps: 2 },
            { description: 'Search for item', successCriteria: 'URL contains /search', estimatedSteps: 3 },
          ],
        }),
      }),
    };

    const result = await decomposeGoal(mockLLM as any, 'Find an item on example.com', 'https://example.com');
    expect(result).toHaveLength(2);
    expect(result[0]!.description).toBe('Navigate to site');
    expect(result[1]!.successCriteria).toBe('URL contains /search');
  });

  it('returns single fallback sub-goal on parse failure', async () => {
    const mockLLM = {
      invoke: vi.fn().mockResolvedValue({ content: 'not valid json' }),
    };

    const result = await decomposeGoal(mockLLM as any, 'Do something complex', 'https://example.com');
    expect(result).toHaveLength(1);
    expect(result[0]!.description).toBe('Do something complex');
  });
});

describe('checkSubGoalCompletion', () => {
  const mockState: PerceivedState = {
    url: 'https://example.com/products/shoes',
    title: 'Running Shoes - Example Store',
    domHash: 'abc',
    axTreeText: 'button "Add to Cart" heading "Running Shoes"',
    interactiveElements: [],
    hasBlocker: false,
  };

  it('matches URL-based criteria', () => {
    const subGoal: SubGoal = {
      description: 'Navigate to products',
      successCriteria: 'URL contains /products/',
      estimatedSteps: 2,
    };
    expect(checkSubGoalCompletion(subGoal, mockState)).toBe(true);
  });

  it('matches title-based criteria', () => {
    const subGoal: SubGoal = {
      description: 'Find shoes page',
      successCriteria: 'title contains Running Shoes',
      estimatedSteps: 3,
    };
    expect(checkSubGoalCompletion(subGoal, mockState)).toBe(true);
  });
});
