/**
 * Unit Tests for Phase 27G — DOM Cross-Validator (T633-T634)
 *
 * Tests that LLM claims contradicted by DOM evidence are flagged
 * and confidence is downgraded.
 */

import { describe, it, expect } from 'vitest';
import { crossValidateEvaluations } from '../../src/heuristics/cross-validator.js';
import type { HeuristicEvaluation } from '../../src/heuristics/vision/types.js';
import type { ViewportSnapshot } from '../../src/models/index.js';

// Helper to create a minimal evaluation
function makeEval(overrides: Partial<HeuristicEvaluation> & { heuristicId: string }): HeuristicEvaluation {
  return {
    principle: 'Test principle',
    status: 'fail',
    severity: 'high',
    observation: '',
    confidence: 0.9,
    ...overrides,
  };
}

// Helper to create a snapshot with layoutBoxes
function makeSnapshot(viewportIndex: number, croTypes: string[]): ViewportSnapshot {
  return {
    scrollPosition: viewportIndex * 800,
    viewportIndex,
    screenshot: { base64: 'fake', timestamp: Date.now() },
    dom: { serialized: '', elementCount: 0 },
    layoutBoxes: croTypes.map((croType, i) => ({
      elementIndex: i,
      x: 100,
      y: 200,
      w: 300,
      h: 50,
      scrollY: 0,
      viewportIndex,
      confidence: 0.9,
      isVisible: true,
      croType,
    })),
  } as ViewportSnapshot;
}

describe('Phase 27G: DOM Cross-Validator', () => {

  describe('T633: crossValidateEvaluations', () => {
    it('should flag contradiction when LLM claims absence but DOM has element', () => {
      const evaluations = [
        makeEval({
          heuristicId: 'PDP-PRICE-001',
          status: 'fail',
          observation: 'No visible price found on the page',
          confidence: 0.85,
        }),
      ];
      const snapshots = [makeSnapshot(0, ['price', 'cta'])];

      const result = crossValidateEvaluations(evaluations, snapshots);

      expect(result.contradictionCount).toBe(1);
      expect(result.flags[0]!.heuristicId).toBe('PDP-PRICE-001');
      expect(result.flags[0]!.originalConfidence).toBe(0.85);
      expect(result.flags[0]!.newConfidence).toBeLessThan(0.85);
      // Confidence on evaluation should be downgraded
      expect(evaluations[0]!.confidence).toBe(result.flags[0]!.newConfidence);
    });

    it('should not flag when LLM claim matches DOM (element truly absent)', () => {
      const evaluations = [
        makeEval({
          heuristicId: 'PDP-REVIEW-001',
          status: 'fail',
          observation: 'No review or rating section found',
          confidence: 0.9,
        }),
      ];
      // DOM has price and cta but NOT review
      const snapshots = [makeSnapshot(0, ['price', 'cta'])];

      const result = crossValidateEvaluations(evaluations, snapshots);

      expect(result.contradictionCount).toBe(0);
      expect(evaluations[0]!.confidence).toBe(0.9); // Unchanged
    });

    it('should not flag pass/partial evaluations', () => {
      const evaluations = [
        makeEval({
          heuristicId: 'PDP-PRICE-001',
          status: 'pass',
          observation: 'Price is clearly visible',
          confidence: 0.95,
        }),
        makeEval({
          heuristicId: 'PDP-CTA-001',
          status: 'partial',
          observation: 'CTA present but not prominent',
          confidence: 0.8,
        }),
      ];
      const snapshots = [makeSnapshot(0, ['price', 'cta'])];

      const result = crossValidateEvaluations(evaluations, snapshots);

      expect(result.contradictionCount).toBe(0);
    });

    it('should handle multiple contradictions across categories', () => {
      const evaluations = [
        makeEval({
          heuristicId: 'PDP-PRICE-001',
          status: 'fail',
          observation: 'Cannot find any price element',
          confidence: 0.8,
        }),
        makeEval({
          heuristicId: 'PDP-CTA-002',
          status: 'not_applicable',
          observation: 'No CTA button found on page, not applicable',
          confidence: 0.7,
        }),
      ];
      const snapshots = [makeSnapshot(0, ['price', 'cta', 'image'])];

      const result = crossValidateEvaluations(evaluations, snapshots);

      expect(result.contradictionCount).toBe(2);
      expect(result.flags.map(f => f.heuristicId)).toEqual(['PDP-PRICE-001', 'PDP-CTA-002']);
    });

    it('should handle empty snapshots gracefully', () => {
      const evaluations = [
        makeEval({
          heuristicId: 'PDP-PRICE-001',
          status: 'fail',
          observation: 'Missing price',
          confidence: 0.9,
        }),
      ];

      const result = crossValidateEvaluations(evaluations, []);

      expect(result.contradictionCount).toBe(0);
      expect(result.totalChecked).toBe(1);
    });
  });
});
