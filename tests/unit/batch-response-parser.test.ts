/**
 * Unit Tests for Batch Response Parser - Phase 26b (T563)
 *
 * Tests for parseBatchedResponse(), extractJSON(), and BatchParseError.
 */

import { describe, it, expect } from 'vitest';
import {
  parseBatchedResponse,
  BatchParseError,
  extractJSON,
} from '../../src/heuristics/batch-response-parser.js';
import type { HeuristicCategory } from '../../src/heuristics/knowledge/index.js';

// Helper: create a HeuristicCategory for testing
function makeCategory(name: string, heuristicIds: string[]): HeuristicCategory {
  return {
    name,
    description: `${name} description`,
    heuristics: heuristicIds.map(id => ({
      id,
      principle: `Principle for ${id}`,
      checkpoints: [`Check for ${id}`],
      severity: 'medium' as const,
      category: name,
    })),
  };
}

describe('extractJSON', () => {
  it('should extract JSON from markdown code blocks', () => {
    const response = '```json\n{"key": "value"}\n```';
    expect(extractJSON(response)).toBe('{"key": "value"}');
  });

  it('should extract JSON from raw response with surrounding text', () => {
    const response = 'Here is the result:\n{"key": "value"}\nDone.';
    expect(extractJSON(response)).toBe('{"key": "value"}');
  });

  it('should handle plain JSON without wrapping', () => {
    const response = '{"key": "value"}';
    expect(extractJSON(response)).toBe('{"key": "value"}');
  });
});

describe('parseBatchedResponse', () => {
  it('should parse valid category-keyed JSON', () => {
    const categories = [
      makeCategory('Layout & Structure', ['PDP-LAY-001', 'PDP-LAY-002']),
      makeCategory('Mobile Usability', ['PDP-MOB-001']),
    ];

    const response = JSON.stringify({
      'Layout & Structure': {
        evaluations: [
          {
            heuristicId: 'PDP-LAY-001',
            status: 'pass',
            confidence: 0.9,
            observation: 'Clean grid layout',
            reasoning: 'Grid structure found in DOM',
          },
          {
            heuristicId: 'PDP-LAY-002',
            status: 'fail',
            confidence: 0.85,
            observation: 'Inconsistent spacing',
            issue: 'Spacing varies between sections',
            recommendation: 'Use consistent 16px gaps',
            reasoning: 'Measured via screenshot',
          },
        ],
        summary: 'Layout mostly good but spacing inconsistent',
      },
      'Mobile Usability': {
        evaluations: [
          {
            heuristicId: 'PDP-MOB-001',
            status: 'partial',
            confidence: 0.75,
            observation: 'Touch targets borderline',
            issue: 'Some buttons below 44px',
            recommendation: 'Increase button sizes',
            reasoning: 'Checked bounding boxes',
          },
        ],
        summary: 'Mobile needs work',
      },
    });

    const results = parseBatchedResponse(response, categories);

    expect(results.length).toBe(2);

    // Layout & Structure
    const layout = results.find(r => r.categoryName === 'Layout & Structure');
    expect(layout).toBeDefined();
    expect(layout!.evaluations.length).toBe(2);
    expect(layout!.evaluations[0]!.heuristicId).toBe('PDP-LAY-001');
    expect(layout!.evaluations[0]!.status).toBe('pass');
    expect(layout!.evaluations[0]!.confidence).toBe(0.9);
    expect(layout!.evaluations[0]!.principle).toBe('Principle for PDP-LAY-001');
    expect(layout!.evaluations[1]!.status).toBe('fail');
    expect(layout!.evaluations[1]!.issue).toBe('Spacing varies between sections');
    expect(layout!.evaluations[1]!.recommendation).toBe('Use consistent 16px gaps');

    // Mobile Usability
    const mobile = results.find(r => r.categoryName === 'Mobile Usability');
    expect(mobile).toBeDefined();
    expect(mobile!.evaluations.length).toBe(1);
    expect(mobile!.evaluations[0]!.status).toBe('partial');
  });

  it('should handle missing categories gracefully (empty evaluations)', () => {
    const categories = [
      makeCategory('Layout & Structure', ['PDP-LAY-001']),
      makeCategory('Mobile Usability', ['PDP-MOB-001']),
    ];

    // Response only contains Layout, missing Mobile
    const response = JSON.stringify({
      'Layout & Structure': {
        evaluations: [
          {
            heuristicId: 'PDP-LAY-001',
            status: 'pass',
            confidence: 0.9,
            observation: 'Good layout',
            reasoning: 'DOM check',
          },
        ],
        summary: 'Layout is fine',
      },
    });

    const results = parseBatchedResponse(response, categories);

    expect(results.length).toBe(2);

    // Layout should be populated
    const layout = results.find(r => r.categoryName === 'Layout & Structure');
    expect(layout!.evaluations.length).toBe(1);

    // Mobile should have empty evaluations (graceful degradation)
    const mobile = results.find(r => r.categoryName === 'Mobile Usability');
    expect(mobile).toBeDefined();
    expect(mobile!.evaluations).toEqual([]);
    expect(mobile!.summary).toContain('missing');
  });

  it('should throw BatchParseError on invalid JSON', () => {
    const categories = [makeCategory('Test', ['PDP-TST-001'])];
    const invalidResponse = 'This is not valid JSON at all {{{{';

    expect(() => parseBatchedResponse(invalidResponse, categories)).toThrow(BatchParseError);

    try {
      parseBatchedResponse(invalidResponse, categories);
    } catch (error) {
      expect(error).toBeInstanceOf(BatchParseError);
      const bpe = error as BatchParseError;
      expect(bpe.rawResponse).toBe(invalidResponse);
      expect(bpe.cause).toBeInstanceOf(Error);
      expect(bpe.name).toBe('BatchParseError');
    }
  });

  it('should normalize non-standard status values', () => {
    const categories = [
      makeCategory('Test', ['PDP-TST-001', 'PDP-TST-002', 'PDP-TST-003']),
    ];

    const response = JSON.stringify({
      'Test': {
        evaluations: [
          { heuristicId: 'PDP-TST-001', status: 'passed', confidence: 0.9, observation: 'ok', reasoning: 'dom' },
          { heuristicId: 'PDP-TST-002', status: 'failed', confidence: 0.8, observation: 'bad', reasoning: 'visual' },
          { heuristicId: 'PDP-TST-003', status: 'n/a', confidence: 1.0, observation: 'na', reasoning: 'not relevant' },
        ],
        summary: 'Mixed results',
      },
    });

    const results = parseBatchedResponse(response, categories);
    const evals = results[0]!.evaluations;

    expect(evals[0]!.status).toBe('pass');     // 'passed' → 'pass'
    expect(evals[1]!.status).toBe('fail');      // 'failed' → 'fail'
    expect(evals[2]!.status).toBe('not_applicable'); // 'n/a' → 'not_applicable'
  });

  it('should clamp confidence values to 0-1 range', () => {
    const categories = [makeCategory('Test', ['PDP-TST-001'])];

    const response = JSON.stringify({
      'Test': {
        evaluations: [
          { heuristicId: 'PDP-TST-001', status: 'pass', confidence: 1.5, observation: 'ok', reasoning: 'dom' },
        ],
      },
    });

    const results = parseBatchedResponse(response, categories);
    expect(results[0]!.evaluations[0]!.confidence).toBe(1);
  });
});
