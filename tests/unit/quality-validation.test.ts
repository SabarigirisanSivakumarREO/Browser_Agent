/**
 * Unit tests for Phase 26e: Quality Validation
 *
 * Tests result-comparator.ts (compareResults) and discrepancy-classifier.ts (classifyDiscrepancy).
 */

import { describe, it, expect } from 'vitest';
import { compareResults } from '../../src/validation/result-comparator.js';
import { classifyDiscrepancy } from '../../src/validation/discrepancy-classifier.js';
import type { AnalysisResult } from '../../src/heuristics/analysis-orchestrator.js';
import type { HeuristicEvaluation } from '../../src/heuristics/vision/types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeEvaluation(overrides: Partial<HeuristicEvaluation> & { heuristicId: string }): HeuristicEvaluation {
  return {
    principle: 'Test principle',
    status: 'pass',
    severity: 'medium',
    observation: 'Test observation',
    confidence: 0.9,
    ...overrides,
  };
}

function makeAnalysisResult(evaluations: HeuristicEvaluation[]): AnalysisResult {
  return {
    pageType: 'pdp',
    analyzedAt: Date.now(),
    snapshotCount: 3,
    categoriesAnalyzed: ['Layout & Structure'],
    categoryResults: [],
    evaluations,
    insights: [],
    summary: {
      totalHeuristics: evaluations.length,
      passed: evaluations.filter(e => e.status === 'pass').length,
      failed: evaluations.filter(e => e.status === 'fail').length,
      partial: evaluations.filter(e => e.status === 'partial').length,
      notApplicable: evaluations.filter(e => e.status === 'not_applicable').length,
      coveragePercent: 100,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    },
    totalTimeMs: 1000,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// compareResults
// ─────────────────────────────────────────────────────────────────────────────

describe('compareResults', () => {
  it('should count matching heuristic statuses', () => {
    const baseline = makeAnalysisResult([
      makeEvaluation({ heuristicId: 'PDP-PRICE-001', status: 'pass' }),
      makeEvaluation({ heuristicId: 'PDP-PRICE-002', status: 'fail' }),
      makeEvaluation({ heuristicId: 'PDP-LAYOUT-001', status: 'partial' }),
    ]);
    const optimized = makeAnalysisResult([
      makeEvaluation({ heuristicId: 'PDP-PRICE-001', status: 'pass' }),
      makeEvaluation({ heuristicId: 'PDP-PRICE-002', status: 'fail' }),
      makeEvaluation({ heuristicId: 'PDP-LAYOUT-001', status: 'partial' }),
    ]);

    const result = compareResults(baseline, optimized);

    expect(result.total).toBe(3);
    expect(result.matching).toBe(3);
    expect(result.discrepancies).toHaveLength(0);
  });

  it('should capture discrepancy pairs for mismatches', () => {
    const baseline = makeAnalysisResult([
      makeEvaluation({ heuristicId: 'PDP-PRICE-001', status: 'pass' }),
      makeEvaluation({ heuristicId: 'PDP-PRICE-002', status: 'fail' }),
    ]);
    const optimized = makeAnalysisResult([
      makeEvaluation({ heuristicId: 'PDP-PRICE-001', status: 'fail' }),  // mismatch
      makeEvaluation({ heuristicId: 'PDP-PRICE-002', status: 'fail' }),  // match
    ]);

    const result = compareResults(baseline, optimized);

    expect(result.total).toBe(2);
    expect(result.matching).toBe(1);
    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0]!.baseline.heuristicId).toBe('PDP-PRICE-001');
    expect(result.discrepancies[0]!.baseline.status).toBe('pass');
    expect(result.discrepancies[0]!.optimized.status).toBe('fail');
  });

  it('should track heuristics missing from optimized', () => {
    const baseline = makeAnalysisResult([
      makeEvaluation({ heuristicId: 'PDP-PRICE-001', status: 'pass' }),
      makeEvaluation({ heuristicId: 'PDP-PRICE-002', status: 'fail' }),
    ]);
    const optimized = makeAnalysisResult([
      makeEvaluation({ heuristicId: 'PDP-PRICE-001', status: 'pass' }),
      // PDP-PRICE-002 missing
    ]);

    const result = compareResults(baseline, optimized);

    expect(result.total).toBe(1);  // only 1 common
    expect(result.matching).toBe(1);
    expect(result.missingInOptimized).toEqual(['PDP-PRICE-002']);
    expect(result.missingInBaseline).toHaveLength(0);
  });

  it('should track heuristics missing from baseline', () => {
    const baseline = makeAnalysisResult([
      makeEvaluation({ heuristicId: 'PDP-PRICE-001', status: 'pass' }),
    ]);
    const optimized = makeAnalysisResult([
      makeEvaluation({ heuristicId: 'PDP-PRICE-001', status: 'pass' }),
      makeEvaluation({ heuristicId: 'PDP-CTA-001', status: 'fail' }),
    ]);

    const result = compareResults(baseline, optimized);

    expect(result.total).toBe(1);
    expect(result.missingInBaseline).toEqual(['PDP-CTA-001']);
  });

  it('should handle empty evaluations', () => {
    const baseline = makeAnalysisResult([]);
    const optimized = makeAnalysisResult([]);

    const result = compareResults(baseline, optimized);

    expect(result.total).toBe(0);
    expect(result.matching).toBe(0);
    expect(result.discrepancies).toHaveLength(0);
    expect(result.missingInOptimized).toHaveLength(0);
    expect(result.missingInBaseline).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// classifyDiscrepancy
// ─────────────────────────────────────────────────────────────────────────────

describe('classifyDiscrepancy', () => {
  it('should classify pass→fail as critical', () => {
    const baseline = makeEvaluation({ heuristicId: 'PDP-PRICE-001', status: 'pass', confidence: 0.9 });
    const optimized = makeEvaluation({ heuristicId: 'PDP-PRICE-001', status: 'fail', confidence: 0.8 });

    const result = classifyDiscrepancy(baseline, optimized);

    expect(result.severity).toBe('critical');
    expect(result.heuristicId).toBe('PDP-PRICE-001');
    expect(result.likelyCause).toContain('False negative');
  });

  it('should classify fail→pass as critical', () => {
    const baseline = makeEvaluation({ heuristicId: 'PDP-PRICE-001', status: 'fail', confidence: 0.85 });
    const optimized = makeEvaluation({ heuristicId: 'PDP-PRICE-001', status: 'pass', confidence: 0.9 });

    const result = classifyDiscrepancy(baseline, optimized);

    expect(result.severity).toBe('critical');
    expect(result.likelyCause).toContain('False positive');
  });

  it('should classify partial→pass as minor (borderline LLM non-determinism)', () => {
    const baseline = makeEvaluation({ heuristicId: 'PDP-LAYOUT-001', status: 'partial', confidence: 0.7 });
    const optimized = makeEvaluation({ heuristicId: 'PDP-LAYOUT-001', status: 'pass', confidence: 0.8 });

    const result = classifyDiscrepancy(baseline, optimized);

    expect(result.severity).toBe('minor');
    expect(result.likelyCause).toContain('Pass↔partial variance');
  });

  it('should classify fail→partial as major (meaningfully different)', () => {
    const baseline = makeEvaluation({ heuristicId: 'PDP-CTA-001', status: 'fail', confidence: 0.8 });
    const optimized = makeEvaluation({ heuristicId: 'PDP-CTA-001', status: 'partial', confidence: 0.7 });

    const result = classifyDiscrepancy(baseline, optimized);

    expect(result.severity).toBe('major');
    expect(result.likelyCause).toContain('Fail↔partial');
  });

  it('should classify pass→partial as minor (reverse direction)', () => {
    const baseline = makeEvaluation({ heuristicId: 'PDP-CTA-002', status: 'pass', confidence: 0.85 });
    const optimized = makeEvaluation({ heuristicId: 'PDP-CTA-002', status: 'partial', confidence: 0.7 });

    const result = classifyDiscrepancy(baseline, optimized);

    expect(result.severity).toBe('minor');
    expect(result.likelyCause).toContain('Pass↔partial variance');
  });

  it('should classify partial→fail as major (reverse direction)', () => {
    const baseline = makeEvaluation({ heuristicId: 'PDP-CTA-003', status: 'partial', confidence: 0.6 });
    const optimized = makeEvaluation({ heuristicId: 'PDP-CTA-003', status: 'fail', confidence: 0.8 });

    const result = classifyDiscrepancy(baseline, optimized);

    expect(result.severity).toBe('major');
    expect(result.likelyCause).toContain('Fail↔partial');
  });

  it('should classify confidence diff > 20% as minor', () => {
    const baseline = makeEvaluation({ heuristicId: 'PDP-DESC-001', status: 'not_applicable', confidence: 0.9 });
    const optimized = makeEvaluation({ heuristicId: 'PDP-DESC-001', status: 'not_applicable', confidence: 0.6 });

    // Status same but confidence diff = 0.3 > 0.2 → minor
    // Note: since status matches, compareResults wouldn't create a discrepancy.
    // This tests the classifier in isolation for edge case where it might be called directly.
    const result = classifyDiscrepancy(baseline, optimized);

    expect(result.severity).toBe('minor');
    expect(result.likelyCause).toContain('Confidence variance');
  });

  it('should classify other differences as minor', () => {
    // Different status but same confidence — not pass↔fail, not partial mismatch
    const baseline = makeEvaluation({ heuristicId: 'PDP-SPEC-001', status: 'not_applicable', confidence: 0.8 });
    const optimized = makeEvaluation({ heuristicId: 'PDP-SPEC-001', status: 'pass', confidence: 0.85 });

    const result = classifyDiscrepancy(baseline, optimized);

    // not_applicable → pass is not pass↔fail, not partial mismatch, confidence diff < 0.2
    expect(result.severity).toBe('minor');
    expect(result.likelyCause).toContain('Minor observation');
  });

  it('should populate all fields correctly', () => {
    const baseline = makeEvaluation({ heuristicId: 'PDP-REVIEW-001', status: 'pass', confidence: 0.95 });
    const optimized = makeEvaluation({ heuristicId: 'PDP-REVIEW-001', status: 'fail', confidence: 0.7 });

    const result = classifyDiscrepancy(baseline, optimized);

    expect(result.heuristicId).toBe('PDP-REVIEW-001');
    expect(result.baselineStatus).toBe('pass');
    expect(result.optimizedStatus).toBe('fail');
    expect(result.baselineConfidence).toBe(0.95);
    expect(result.optimizedConfidence).toBe(0.7);
    expect(result.severity).toBe('critical');
    expect(result.likelyCause).toBeTruthy();
  });
});
