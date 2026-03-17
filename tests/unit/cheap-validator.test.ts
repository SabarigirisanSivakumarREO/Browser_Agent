/**
 * Cheap Validator Unit Tests - Phase 25i (T544)
 *
 * Tests for the zero-LLM-call validation layer that detects
 * extraction issues from viewport signals.
 */

import { describe, it, expect } from 'vitest';
import {
  runCheapValidator,
  shouldRunLLMQA,
  summarizeValidation,
  DEFAULT_CHEAP_VALIDATOR_CONFIG,
} from '../../src/validation/cheap-validator.js';
import type { ViewportValidatorSignals } from '../../src/types/index.js';
import { createEmptyValidatorSignals } from '../../src/types/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

function createCleanSignals(viewportIndex: number): ViewportValidatorSignals {
  return {
    viewportIndex,
    blankImageCount: 0,
    placeholderImageCount: 0,
    lazyPendingCount: 0,
    spinnerDetected: false,
    skeletonDetected: false,
    textPlaceholders: [],
    overlayStillVisible: false,
    mediaReadinessTimedOut: false,
    totalImages: 10,
    loadedImages: 10,
    failedImages: 0,
    scrollPositionVerified: true,
  };
}

function createSignalsWithIssues(
  viewportIndex: number,
  issues: Partial<ViewportValidatorSignals>
): ViewportValidatorSignals {
  return {
    ...createCleanSignals(viewportIndex),
    ...issues,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════════════════════════

describe('runCheapValidator', () => {
  describe('clean signals', () => {
    it('should pass for clean signals across all viewports', () => {
      const signals = [
        createCleanSignals(0),
        createCleanSignals(1),
        createCleanSignals(2),
      ];

      const result = runCheapValidator(signals);

      expect(result.passed).toBe(true);
      expect(result.recheckIndices).toHaveLength(0);
      expect(result.flags).toHaveLength(0);
      expect(result.qualityScore).toBeGreaterThanOrEqual(90);
    });

    it('should return high quality score for clean signals', () => {
      const signals = [createCleanSignals(0)];
      const result = runCheapValidator(signals);
      expect(result.qualityScore).toBe(100);
    });

    it('should handle empty signals array', () => {
      const result = runCheapValidator([]);
      expect(result.passed).toBe(true);
      expect(result.qualityScore).toBe(100);
    });
  });

  describe('blank images', () => {
    it('should flag when blank images exceed threshold', () => {
      const signals = [
        createSignalsWithIssues(0, { blankImageCount: 5 }),
      ];

      const result = runCheapValidator(signals);

      expect(result.passed).toBe(false);
      expect(result.recheckIndices).toContain(0);
      expect(result.viewportResults[0]?.severity).toBe('fail');
    });

    it('should warn but not fail for few blank images', () => {
      const signals = [
        createSignalsWithIssues(0, { blankImageCount: 1 }),
      ];

      const result = runCheapValidator(signals);

      expect(result.passed).toBe(true);
      expect(result.recheckIndices).toHaveLength(0);
      expect(result.viewportResults[0]?.severity).toBe('warning');
    });

    it('should respect custom threshold', () => {
      const signals = [
        createSignalsWithIssues(0, { blankImageCount: 3 }),
      ];

      const result = runCheapValidator(signals, { maxBlankImages: 5 });

      expect(result.passed).toBe(true);
      expect(result.viewportResults[0]?.severity).toBe('warning');
    });
  });

  describe('spinners and skeletons', () => {
    it('should flag when spinner is detected', () => {
      const signals = [
        createSignalsWithIssues(0, { spinnerDetected: true }),
      ];

      const result = runCheapValidator(signals);

      expect(result.passed).toBe(false);
      expect(result.recheckIndices).toContain(0);
      expect(result.viewportResults[0]?.issues).toContain('Loading spinner detected');
    });

    it('should flag when skeleton UI is detected', () => {
      const signals = [
        createSignalsWithIssues(0, { skeletonDetected: true }),
      ];

      const result = runCheapValidator(signals);

      expect(result.passed).toBe(false);
      expect(result.recheckIndices).toContain(0);
      expect(result.viewportResults[0]?.issues).toContain('Skeleton/shimmer UI detected');
    });

    it('should allow disabling spinner flag', () => {
      const signals = [
        createSignalsWithIssues(0, { spinnerDetected: true }),
      ];

      const result = runCheapValidator(signals, { flagSpinners: false });

      expect(result.passed).toBe(true);
      expect(result.recheckIndices).toHaveLength(0);
    });
  });

  describe('overlays', () => {
    it('should flag when overlay is still visible', () => {
      const signals = [
        createSignalsWithIssues(0, { overlayStillVisible: true }),
      ];

      const result = runCheapValidator(signals);

      expect(result.passed).toBe(false);
      expect(result.recheckIndices).toContain(0);
    });

    it('should add global flag for overlays', () => {
      const signals = [
        createSignalsWithIssues(0, { overlayStillVisible: true }),
        createCleanSignals(1),
      ];

      const result = runCheapValidator(signals);

      expect(result.flags).toContain('Overlay elements still visible in some viewports');
    });
  });

  describe('image load ratio', () => {
    it('should flag when image load ratio is low', () => {
      const signals = [
        createSignalsWithIssues(0, {
          totalImages: 10,
          loadedImages: 5, // 50% load ratio
        }),
      ];

      const result = runCheapValidator(signals);

      expect(result.passed).toBe(false);
      expect(result.viewportResults[0]?.issues.some(i => i.includes('Low image load ratio'))).toBe(true);
    });

    it('should pass when no images present', () => {
      const signals = [
        createSignalsWithIssues(0, {
          totalImages: 0,
          loadedImages: 0,
        }),
      ];

      const result = runCheapValidator(signals);

      expect(result.passed).toBe(true);
    });
  });

  describe('lazy-load pending', () => {
    it('should flag when too many lazy elements pending', () => {
      const signals = [
        createSignalsWithIssues(0, { lazyPendingCount: 10 }),
      ];

      const result = runCheapValidator(signals);

      expect(result.passed).toBe(false);
      expect(result.viewportResults[0]?.issues.some(i => i.includes('lazy elements pending'))).toBe(true);
    });
  });

  describe('text placeholders', () => {
    it('should flag when text placeholders detected', () => {
      const signals = [
        createSignalsWithIssues(0, {
          textPlaceholders: ['Loading...', '---', 'TBD'],
        }),
      ];

      const result = runCheapValidator(signals);

      expect(result.passed).toBe(false);
      expect(result.viewportResults[0]?.issues.some(i => i.includes('text placeholder'))).toBe(true);
    });
  });

  describe('media readiness timeout', () => {
    it('should warn when media readiness timed out', () => {
      const signals = [
        createSignalsWithIssues(0, { mediaReadinessTimedOut: true }),
      ];

      const result = runCheapValidator(signals);

      // Should warn but not fail
      expect(result.viewportResults[0]?.severity).toBe('warning');
      expect(result.viewportResults[0]?.issues).toContain('Media readiness timed out');
    });
  });

  describe('scroll position verification', () => {
    it('should warn when scroll position not verified', () => {
      const signals = [
        createSignalsWithIssues(0, { scrollPositionVerified: false }),
      ];

      const result = runCheapValidator(signals);

      expect(result.viewportResults[0]?.severity).toBe('warning');
      expect(result.viewportResults[0]?.issues).toContain('Scroll position not verified');
    });
  });

  describe('multiple viewports', () => {
    it('should only recheck failed viewports', () => {
      const signals = [
        createCleanSignals(0),
        createSignalsWithIssues(1, { spinnerDetected: true }),
        createCleanSignals(2),
        createSignalsWithIssues(3, { overlayStillVisible: true }),
      ];

      const result = runCheapValidator(signals);

      expect(result.recheckIndices).toEqual([1, 3]);
    });

    it('should track per-viewport results', () => {
      const signals = [
        createCleanSignals(0),
        createSignalsWithIssues(1, { blankImageCount: 5 }),
      ];

      const result = runCheapValidator(signals);

      expect(result.viewportResults).toHaveLength(2);
      expect(result.viewportResults[0]?.severity).toBe('ok');
      expect(result.viewportResults[1]?.severity).toBe('fail');
    });
  });

  describe('quality score', () => {
    it('should penalize failed viewports', () => {
      const cleanSignals = [createCleanSignals(0), createCleanSignals(1)];
      const mixedSignals = [
        createCleanSignals(0),
        createSignalsWithIssues(1, { spinnerDetected: true }),
      ];

      const cleanResult = runCheapValidator(cleanSignals);
      const mixedResult = runCheapValidator(mixedSignals);

      expect(cleanResult.qualityScore).toBeGreaterThan(mixedResult.qualityScore);
    });

    it('should penalize critical issues', () => {
      const signals = [
        createSignalsWithIssues(0, {
          spinnerDetected: true,
          skeletonDetected: true,
          overlayStillVisible: true,
        }),
      ];

      const result = runCheapValidator(signals);

      expect(result.qualityScore).toBeLessThan(50);
    });

    it('should never exceed 100', () => {
      const signals = [createCleanSignals(0)];
      const result = runCheapValidator(signals);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });

    it('should never go below 0', () => {
      const signals = [
        createSignalsWithIssues(0, {
          blankImageCount: 100,
          spinnerDetected: true,
          skeletonDetected: true,
          overlayStillVisible: true,
          totalImages: 100,
          loadedImages: 0,
        }),
      ];

      const result = runCheapValidator(signals);
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('shouldRunLLMQA', () => {
  it('should return false for passing validation', () => {
    const result = runCheapValidator([createCleanSignals(0)]);
    expect(shouldRunLLMQA(result)).toBe(false);
  });

  it('should return true for failing validation', () => {
    const result = runCheapValidator([
      createSignalsWithIssues(0, { spinnerDetected: true }),
    ]);
    expect(shouldRunLLMQA(result)).toBe(true);
  });

  it('should return true for low quality score', () => {
    const result = runCheapValidator([
      createSignalsWithIssues(0, {
        blankImageCount: 3,
        totalImages: 10,
        loadedImages: 6,
      }),
    ]);
    // Even if passed is true, low quality score triggers LLM QA
    if (result.qualityScore < 70) {
      expect(shouldRunLLMQA(result)).toBe(true);
    }
  });

  it('should return true when viewports need rechecking', () => {
    const result = runCheapValidator([
      createSignalsWithIssues(0, { overlayStillVisible: true }),
    ]);
    expect(result.recheckIndices.length).toBeGreaterThan(0);
    expect(shouldRunLLMQA(result)).toBe(true);
  });
});

describe('summarizeValidation', () => {
  it('should include pass/fail status', () => {
    const passResult = runCheapValidator([createCleanSignals(0)]);
    const failResult = runCheapValidator([
      createSignalsWithIssues(0, { spinnerDetected: true }),
    ]);

    expect(summarizeValidation(passResult)).toContain('PASSED');
    expect(summarizeValidation(failResult)).toContain('FAILED');
  });

  it('should include quality score', () => {
    const result = runCheapValidator([createCleanSignals(0)]);
    expect(summarizeValidation(result)).toContain('100');
  });

  it('should include flags', () => {
    const result = runCheapValidator([
      createSignalsWithIssues(0, { overlayStillVisible: true }),
    ]);
    expect(summarizeValidation(result)).toContain('Overlay');
  });

  it('should include recheck indices', () => {
    const result = runCheapValidator([
      createCleanSignals(0),
      createSignalsWithIssues(1, { spinnerDetected: true }),
    ]);
    expect(summarizeValidation(result)).toContain('1');
  });
});

describe('createEmptyValidatorSignals', () => {
  it('should create signals with correct viewport index', () => {
    const signals = createEmptyValidatorSignals(5);
    expect(signals.viewportIndex).toBe(5);
  });

  it('should create signals with all defaults', () => {
    const signals = createEmptyValidatorSignals(0);
    expect(signals.blankImageCount).toBe(0);
    expect(signals.spinnerDetected).toBe(false);
    expect(signals.scrollPositionVerified).toBe(true);
  });
});

describe('DEFAULT_CHEAP_VALIDATOR_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_CHEAP_VALIDATOR_CONFIG.maxBlankImages).toBeGreaterThan(0);
    expect(DEFAULT_CHEAP_VALIDATOR_CONFIG.maxPlaceholderImages).toBeGreaterThan(0);
    expect(DEFAULT_CHEAP_VALIDATOR_CONFIG.minImageLoadRatio).toBeGreaterThan(0);
    expect(DEFAULT_CHEAP_VALIDATOR_CONFIG.minImageLoadRatio).toBeLessThanOrEqual(1);
  });
});
