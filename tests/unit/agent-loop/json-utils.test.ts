import { describe, it, expect } from 'vitest';
import { extractJSON } from '../../../src/agent/agent-loop/json-utils.js';

describe('extractJSON', () => {
  it('extracts JSON from clean string', () => {
    const input = '{"toolName": "click", "toolParams": {"index": 3}}';
    const result = extractJSON(input);
    expect(result).toEqual({ toolName: 'click', toolParams: { index: 3 } });
  });

  it('extracts JSON wrapped in markdown fences', () => {
    const input = 'Here is the plan:\n```json\n{"reasoning": "test", "toolName": "scroll_page"}\n```\nDone.';
    const result = extractJSON(input);
    expect(result).toEqual({ reasoning: 'test', toolName: 'scroll_page' });
  });

  it('returns null for invalid input', () => {
    expect(extractJSON('')).toBeNull();
    expect(extractJSON('no json here')).toBeNull();
    expect(extractJSON('{broken json')).toBeNull();
  });
});
