/**
 * Cheap Validator - Phase 25i (T537-T538)
 *
 * Zero-LLM-call validation layer that analyzes viewport signals
 * to detect obvious extraction issues. Only escalates to LLM QA
 * when signals indicate problems worth investigating.
 *
 * This validator is "cheap" because it uses only the signals collected
 * during capture - no additional API calls required.
 */

import type { ViewportValidatorSignals } from '../types/index.js';
import { createLogger } from '../utils/index.js';

const logger = createLogger('CheapValidator');

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of cheap validation
 */
export interface CheapValidationResult {
  /** Whether all viewports passed validation */
  passed: boolean;

  /** Flags explaining any issues detected */
  flags: string[];

  /** Viewport indices that should be rechecked */
  recheckIndices: number[];

  /** Per-viewport validation results */
  viewportResults: ViewportValidationResult[];

  /** Overall quality score (0-100) */
  qualityScore: number;
}

/**
 * Validation result for a single viewport
 */
export interface ViewportValidationResult {
  /** Viewport index */
  viewportIndex: number;

  /** Whether this viewport passed */
  passed: boolean;

  /** Issues found in this viewport */
  issues: string[];

  /** Severity: 'ok' | 'warning' | 'fail' */
  severity: 'ok' | 'warning' | 'fail';
}

/**
 * Configuration for cheap validator thresholds
 */
export interface CheapValidatorConfig {
  /** Max blank images before flagging (default: 2) */
  maxBlankImages: number;

  /** Max placeholder images before flagging (default: 3) */
  maxPlaceholderImages: number;

  /** Max lazy-pending elements before flagging (default: 5) */
  maxLazyPending: number;

  /** Flag if spinner is detected (default: true) */
  flagSpinners: boolean;

  /** Flag if skeleton UI is detected (default: true) */
  flagSkeletons: boolean;

  /** Max text placeholders before flagging (default: 2) */
  maxTextPlaceholders: number;

  /** Flag if overlay still visible (default: true) */
  flagOverlays: boolean;

  /** Min image load ratio (loaded/total) before flagging (default: 0.7) */
  minImageLoadRatio: number;

  /** Flag if media readiness timed out (default: true) */
  flagMediaTimeout: boolean;

  /** Flag if scroll position wasn't verified (default: true) */
  flagScrollMismatch: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Default Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_CHEAP_VALIDATOR_CONFIG: CheapValidatorConfig = {
  maxBlankImages: 2,
  maxPlaceholderImages: 3,
  maxLazyPending: 5,
  flagSpinners: true,
  flagSkeletons: true,
  maxTextPlaceholders: 2,
  flagOverlays: true,
  minImageLoadRatio: 0.7,
  flagMediaTimeout: true,
  flagScrollMismatch: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Validation Function
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run cheap validation on collected viewport signals.
 *
 * This function analyzes signals from each viewport and determines:
 * - Whether the collection passed (no major issues)
 * - Which viewports need rechecking
 * - Overall quality score
 *
 * Zero LLM calls - pure signal analysis.
 *
 * @param signals - Array of signals from each viewport
 * @param config - Validation thresholds
 * @returns Validation result with recheck indices
 */
export function runCheapValidator(
  signals: ViewportValidatorSignals[],
  config: Partial<CheapValidatorConfig> = {}
): CheapValidationResult {
  const fullConfig: CheapValidatorConfig = { ...DEFAULT_CHEAP_VALIDATOR_CONFIG, ...config };

  logger.debug('Running cheap validation', {
    viewportCount: signals.length,
    config: fullConfig,
  });

  const viewportResults: ViewportValidationResult[] = [];
  const globalFlags: string[] = [];
  const recheckIndices: number[] = [];

  // Validate each viewport
  for (const signal of signals) {
    const result = validateViewport(signal, fullConfig);
    viewportResults.push(result);

    // Collect viewports that need rechecking (warnings or failures)
    if (result.severity === 'fail') {
      recheckIndices.push(signal.viewportIndex);
    }
  }

  // Calculate overall quality score
  const qualityScore = calculateQualityScore(viewportResults, signals);

  // Determine global flags
  const totalFailed = viewportResults.filter((r) => r.severity === 'fail').length;
  const totalWarnings = viewportResults.filter((r) => r.severity === 'warning').length;

  if (totalFailed > 0) {
    globalFlags.push(`${totalFailed} viewport(s) failed validation`);
  }
  if (totalWarnings > 0) {
    globalFlags.push(`${totalWarnings} viewport(s) have warnings`);
  }

  // Check for systemic issues across viewports
  const totalBlankImages = signals.reduce((sum, s) => sum + s.blankImageCount, 0);
  const totalPlaceholders = signals.reduce((sum, s) => sum + s.placeholderImageCount, 0);
  const anyOverlays = signals.some((s) => s.overlayStillVisible);
  const anyScrollMismatch = signals.some((s) => !s.scrollPositionVerified);

  if (totalBlankImages > fullConfig.maxBlankImages * 2) {
    globalFlags.push(`High blank image count across viewports: ${totalBlankImages}`);
  }
  if (totalPlaceholders > fullConfig.maxPlaceholderImages * 2) {
    globalFlags.push(`High placeholder count across viewports: ${totalPlaceholders}`);
  }
  if (anyOverlays) {
    globalFlags.push('Overlay elements still visible in some viewports');
  }
  if (anyScrollMismatch) {
    globalFlags.push('Scroll position mismatch in some viewports');
  }

  // Overall pass/fail
  const passed = totalFailed === 0 && globalFlags.length <= 1;

  const result: CheapValidationResult = {
    passed,
    flags: globalFlags,
    recheckIndices,
    viewportResults,
    qualityScore,
  };

  logger.debug('Cheap validation complete', {
    passed,
    qualityScore,
    recheckCount: recheckIndices.length,
    flagCount: globalFlags.length,
  });

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Per-Viewport Validation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate a single viewport's signals
 */
function validateViewport(
  signal: ViewportValidatorSignals,
  config: CheapValidatorConfig
): ViewportValidationResult {
  const issues: string[] = [];
  let failCount = 0;
  let warnCount = 0;

  // Check blank images
  if (signal.blankImageCount > config.maxBlankImages) {
    issues.push(`${signal.blankImageCount} blank images (max: ${config.maxBlankImages})`);
    failCount++;
  } else if (signal.blankImageCount > 0) {
    issues.push(`${signal.blankImageCount} blank image(s)`);
    warnCount++;
  }

  // Check placeholder images
  if (signal.placeholderImageCount > config.maxPlaceholderImages) {
    issues.push(`${signal.placeholderImageCount} placeholder images (max: ${config.maxPlaceholderImages})`);
    failCount++;
  } else if (signal.placeholderImageCount > 0) {
    issues.push(`${signal.placeholderImageCount} placeholder image(s)`);
    warnCount++;
  }

  // Check lazy-pending elements
  if (signal.lazyPendingCount > config.maxLazyPending) {
    issues.push(`${signal.lazyPendingCount} lazy elements pending (max: ${config.maxLazyPending})`);
    failCount++;
  } else if (signal.lazyPendingCount > 0) {
    issues.push(`${signal.lazyPendingCount} lazy element(s) pending`);
    warnCount++;
  }

  // Check spinner
  if (config.flagSpinners && signal.spinnerDetected) {
    issues.push('Loading spinner detected');
    failCount++;
  }

  // Check skeleton UI
  if (config.flagSkeletons && signal.skeletonDetected) {
    issues.push('Skeleton/shimmer UI detected');
    failCount++;
  }

  // Check text placeholders
  if (signal.textPlaceholders.length > config.maxTextPlaceholders) {
    issues.push(`${signal.textPlaceholders.length} text placeholders: ${signal.textPlaceholders.slice(0, 2).join(', ')}...`);
    failCount++;
  } else if (signal.textPlaceholders.length > 0) {
    issues.push(`Text placeholder(s): ${signal.textPlaceholders.join(', ')}`);
    warnCount++;
  }

  // Check overlay
  if (config.flagOverlays && signal.overlayStillVisible) {
    issues.push('Overlay element still visible');
    failCount++;
  }

  // Check image load ratio
  if (signal.totalImages > 0) {
    const loadRatio = signal.loadedImages / signal.totalImages;
    if (loadRatio < config.minImageLoadRatio) {
      issues.push(`Low image load ratio: ${(loadRatio * 100).toFixed(0)}% (min: ${(config.minImageLoadRatio * 100).toFixed(0)}%)`);
      failCount++;
    }
  }

  // Check media timeout
  if (config.flagMediaTimeout && signal.mediaReadinessTimedOut) {
    issues.push('Media readiness timed out');
    warnCount++;
  }

  // Check scroll position
  if (config.flagScrollMismatch && !signal.scrollPositionVerified) {
    issues.push('Scroll position not verified');
    warnCount++;
  }

  // Determine severity
  let severity: 'ok' | 'warning' | 'fail';
  if (failCount > 0) {
    severity = 'fail';
  } else if (warnCount > 0) {
    severity = 'warning';
  } else {
    severity = 'ok';
  }

  return {
    viewportIndex: signal.viewportIndex,
    passed: severity !== 'fail',
    issues,
    severity,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Quality Score Calculation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate overall quality score (0-100)
 *
 * Score breakdown:
 * - 40 points: Viewport pass rate
 * - 30 points: Image load success rate
 * - 20 points: No critical issues (spinners, skeletons, overlays)
 * - 10 points: No warnings
 */
function calculateQualityScore(
  results: ViewportValidationResult[],
  signals: ViewportValidatorSignals[]
): number {
  if (results.length === 0) return 100;

  // Viewport pass rate (40 points)
  const passedCount = results.filter((r) => r.severity !== 'fail').length;
  const viewportScore = (passedCount / results.length) * 40;

  // Image load rate (30 points)
  const totalImages = signals.reduce((sum, s) => sum + s.totalImages, 0);
  const loadedImages = signals.reduce((sum, s) => sum + s.loadedImages, 0);
  const imageScore = totalImages > 0 ? (loadedImages / totalImages) * 30 : 30;

  // No critical issues (20 points)
  const hasSpinner = signals.some((s) => s.spinnerDetected);
  const hasSkeleton = signals.some((s) => s.skeletonDetected);
  const hasOverlay = signals.some((s) => s.overlayStillVisible);
  const criticalPenalty = (hasSpinner ? 7 : 0) + (hasSkeleton ? 7 : 0) + (hasOverlay ? 6 : 0);
  const criticalScore = Math.max(0, 20 - criticalPenalty);

  // No warnings (10 points)
  const warningCount = results.filter((r) => r.severity === 'warning').length;
  const warningPenalty = Math.min(10, warningCount * 2);
  const warningScore = 10 - warningPenalty;

  const total = Math.round(viewportScore + imageScore + criticalScore + warningScore);
  return Math.max(0, Math.min(100, total));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if validation result suggests LLM QA is needed
 */
export function shouldRunLLMQA(result: CheapValidationResult): boolean {
  // Run LLM QA if:
  // 1. Overall validation failed
  // 2. Quality score is below threshold
  // 3. There are viewports that need rechecking
  return !result.passed || result.qualityScore < 70 || result.recheckIndices.length > 0;
}

/**
 * Get human-readable summary of validation result
 */
export function summarizeValidation(result: CheapValidationResult): string {
  const status = result.passed ? 'PASSED' : 'FAILED';
  const lines = [
    `Cheap Validation: ${status} (score: ${result.qualityScore}/100)`,
  ];

  if (result.flags.length > 0) {
    lines.push(`Flags: ${result.flags.join('; ')}`);
  }

  if (result.recheckIndices.length > 0) {
    lines.push(`Recheck viewports: ${result.recheckIndices.join(', ')}`);
  }

  const failedViewports = result.viewportResults.filter((r) => r.severity === 'fail');
  if (failedViewports.length > 0) {
    for (const vp of failedViewports.slice(0, 3)) {
      lines.push(`  Viewport ${vp.viewportIndex}: ${vp.issues.slice(0, 2).join(', ')}`);
    }
    if (failedViewports.length > 3) {
      lines.push(`  ... and ${failedViewports.length - 3} more`);
    }
  }

  return lines.join('\n');
}
