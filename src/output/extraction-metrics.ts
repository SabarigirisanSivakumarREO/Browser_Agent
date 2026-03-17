/**
 * Extraction Completeness Metrics - Phase 25h (T530)
 *
 * Computes metrics about extraction quality and completeness.
 * These metrics are included in the EvidencePackage for analysis and debugging.
 */

import { createLogger } from '../utils/index.js';
import type { CROType } from '../models/dom-tree.js';
import type { ExtractionMetrics } from '../types/evidence-schema.js';
import { createEmptyMetrics } from '../types/evidence-schema.js';
import type { StructuredProductData } from '../browser/dom/structured-data.js';

const logger = createLogger('ExtractionMetrics');

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Element data for metrics computation
 */
export interface ElementForMetrics {
  /** Element index */
  index: number;
  /** CRO classification type */
  croType: Exclude<CROType, null>;
  /** Classification confidence */
  confidence: number;
  /** Bounding box dimensions */
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Viewport indices where this element appears */
  viewportIndices: number[];
}

/**
 * Screenshot data for metrics computation
 */
export interface ScreenshotForMetrics {
  /** Viewport index */
  viewportIndex: number;
  /** Start Y position (page coords) */
  startY: number;
  /** End Y position (page coords) */
  endY: number;
  /** Whether this is above the fold */
  isAboveFold: boolean;
}

/**
 * Input for metrics computation
 */
export interface MetricsInput {
  /** CRO elements detected */
  elements: ElementForMetrics[];
  /** Screenshots captured */
  screenshots: ScreenshotForMetrics[];
  /** Structured product data */
  structuredData: StructuredProductData | null;
  /** Total page height */
  pageHeight: number | null;
  /** Viewport height (above fold line) */
  viewportHeight: number;
  /** Warnings generated during extraction */
  warnings: string[];
  /** Extraction start time for duration calculation */
  extractionStartTime?: number;
}

/**
 * Quality thresholds for metrics evaluation
 */
export interface MetricsThresholds {
  /** Minimum acceptable box coverage (default: 0.8) */
  minBoxCoverage: number;
  /** Minimum acceptable screenshot coverage (default: 0.9) */
  minScreenshotCoverage: number;
  /** Minimum acceptable above-fold coverage (default: 0.5) */
  minAboveFoldCoverage: number;
  /** Minimum confidence for reliable elements (default: 0.7) */
  minConfidence: number;
}

const DEFAULT_THRESHOLDS: MetricsThresholds = {
  minBoxCoverage: 0.8,
  minScreenshotCoverage: 0.9,
  minAboveFoldCoverage: 0.5,
  minConfidence: 0.7,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Computation Function
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute extraction completeness metrics
 *
 * Metrics include:
 * - Element counts by CRO type
 * - Bounding box coverage (% of elements with valid boxes)
 * - Screenshot coverage (% of page covered)
 * - Structured data presence (1 or 0)
 * - Above-fold coverage (% of important elements above fold)
 * - Warning count
 * - Extraction duration
 *
 * @param input - Data for metrics computation
 * @returns Computed metrics object
 */
export function computeExtractionMetrics(input: MetricsInput): ExtractionMetrics {
  const {
    elements,
    screenshots,
    structuredData,
    pageHeight,
    // viewportHeight is available for future above-fold calculations
    warnings,
    extractionStartTime,
  } = input;

  const metrics = createEmptyMetrics();

  // ─────────────────────────────────────────────────────────────────────────────
  // Element counts by CRO type
  // ─────────────────────────────────────────────────────────────────────────────

  for (const element of elements) {
    if (element.croType in metrics.detectedCounts) {
      metrics.detectedCounts[element.croType]++;
    }
  }

  logger.debug('Element counts computed', { counts: metrics.detectedCounts });

  // ─────────────────────────────────────────────────────────────────────────────
  // Bounding box coverage
  // ─────────────────────────────────────────────────────────────────────────────

  if (elements.length > 0) {
    const elementsWithValidBoxes = elements.filter(
      e => e.boundingBox.width > 0 && e.boundingBox.height > 0
    ).length;
    metrics.mappedBoxCoverage = elementsWithValidBoxes / elements.length;
  }

  logger.debug('Box coverage computed', { coverage: metrics.mappedBoxCoverage });

  // ─────────────────────────────────────────────────────────────────────────────
  // Screenshot coverage
  // ─────────────────────────────────────────────────────────────────────────────

  if (pageHeight && pageHeight > 0 && screenshots.length > 0) {
    // Calculate unique coverage (account for overlaps)
    const coverageMap = new Array(Math.ceil(pageHeight)).fill(false);

    for (const screenshot of screenshots) {
      const startIdx = Math.max(0, Math.floor(screenshot.startY));
      const endIdx = Math.min(coverageMap.length, Math.ceil(screenshot.endY));
      for (let i = startIdx; i < endIdx; i++) {
        coverageMap[i] = true;
      }
    }

    const coveredPixels = coverageMap.filter(Boolean).length;
    metrics.screenshotCoverage = coveredPixels / pageHeight;
  }

  logger.debug('Screenshot coverage computed', { coverage: metrics.screenshotCoverage });

  // ─────────────────────────────────────────────────────────────────────────────
  // Structured data presence
  // ─────────────────────────────────────────────────────────────────────────────

  metrics.structuredDataPresence = structuredData ? 1 : 0;

  // ─────────────────────────────────────────────────────────────────────────────
  // Above-fold coverage
  // ─────────────────────────────────────────────────────────────────────────────

  const importantTypes: Array<Exclude<CROType, null>> = ['cta', 'price', 'value_prop'];

  // Find elements above the fold (visible in first viewport)
  const aboveFoldElements = elements.filter(e => e.viewportIndices.includes(0));
  const importantAboveFold = aboveFoldElements.filter(
    e => importantTypes.includes(e.croType)
  ).length;
  const totalImportant = elements.filter(
    e => importantTypes.includes(e.croType)
  ).length;

  if (totalImportant > 0) {
    metrics.aboveFoldCoverage = importantAboveFold / totalImportant;
  }

  logger.debug('Above-fold coverage computed', {
    importantAboveFold,
    totalImportant,
    coverage: metrics.aboveFoldCoverage,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Warning count & duration
  // ─────────────────────────────────────────────────────────────────────────────

  metrics.warningCount = warnings.length;

  if (extractionStartTime) {
    metrics.extractionDurationMs = Date.now() - extractionStartTime;
  }

  logger.info('Extraction metrics computed', {
    elementCount: elements.length,
    screenshotCount: screenshots.length,
    boxCoverage: metrics.mappedBoxCoverage.toFixed(2),
    screenshotCoverage: metrics.screenshotCoverage.toFixed(2),
    warningCount: metrics.warningCount,
  });

  return metrics;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Quality Evaluation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Evaluation result for extraction quality
 */
export interface MetricsEvaluation {
  /** Overall quality score (0-100) */
  qualityScore: number;
  /** Whether extraction meets minimum quality thresholds */
  meetsThresholds: boolean;
  /** Specific issues found */
  issues: string[];
  /** Recommendations for improvement */
  recommendations: string[];
}

/**
 * Evaluate extraction quality based on metrics
 *
 * @param metrics - Computed metrics
 * @param thresholds - Quality thresholds
 * @returns Quality evaluation
 */
export function evaluateMetricsQuality(
  metrics: ExtractionMetrics,
  thresholds: Partial<MetricsThresholds> = {}
): MetricsEvaluation {
  const fullThresholds: MetricsThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const issues: string[] = [];
  const recommendations: string[] = [];
  let meetsThresholds = true;

  // Check box coverage
  if (metrics.mappedBoxCoverage < fullThresholds.minBoxCoverage) {
    issues.push(
      `Low bounding box coverage: ${(metrics.mappedBoxCoverage * 100).toFixed(0)}% ` +
      `(threshold: ${(fullThresholds.minBoxCoverage * 100).toFixed(0)}%)`
    );
    recommendations.push('Check that DOM elements have proper layout/display styles');
    meetsThresholds = false;
  }

  // Check screenshot coverage
  if (metrics.screenshotCoverage < fullThresholds.minScreenshotCoverage) {
    issues.push(
      `Incomplete screenshot coverage: ${(metrics.screenshotCoverage * 100).toFixed(0)}% ` +
      `(threshold: ${(fullThresholds.minScreenshotCoverage * 100).toFixed(0)}%)`
    );
    recommendations.push('Increase scroll depth or add more viewport captures');
    meetsThresholds = false;
  }

  // Check above-fold coverage
  if (metrics.aboveFoldCoverage < fullThresholds.minAboveFoldCoverage) {
    issues.push(
      `Low above-fold coverage: ${(metrics.aboveFoldCoverage * 100).toFixed(0)}% ` +
      `(threshold: ${(fullThresholds.minAboveFoldCoverage * 100).toFixed(0)}%)`
    );
    recommendations.push('Important elements may be hidden or below the fold');
    meetsThresholds = false;
  }

  // Check for missing expected elements
  const expectedTypes: Array<Exclude<CROType, null>> = ['cta', 'price'];
  for (const type of expectedTypes) {
    if (metrics.detectedCounts[type] === 0) {
      issues.push(`No ${type} elements detected`);
      recommendations.push(`Check that ${type} elements have proper selectors/attributes`);
    }
  }

  // Check structured data
  if (metrics.structuredDataPresence === 0) {
    issues.push('No JSON-LD structured data found');
    recommendations.push('Add Product schema markup for better SEO and data extraction');
  }

  // Calculate quality score (0-100)
  let qualityScore = 100;
  qualityScore -= (1 - metrics.mappedBoxCoverage) * 30; // 30 points for box coverage
  qualityScore -= (1 - metrics.screenshotCoverage) * 20; // 20 points for screenshot coverage
  qualityScore -= (1 - metrics.aboveFoldCoverage) * 20; // 20 points for above-fold
  qualityScore -= (1 - metrics.structuredDataPresence) * 10; // 10 points for structured data
  qualityScore -= Math.min(metrics.warningCount * 2, 20); // Up to 20 points for warnings
  qualityScore = Math.max(0, Math.min(100, Math.round(qualityScore)));

  return {
    qualityScore,
    meetsThresholds,
    issues,
    recommendations,
  };
}

/**
 * Generate a human-readable summary of metrics
 */
export function summarizeMetrics(metrics: ExtractionMetrics): string {
  const lines: string[] = [
    `Extraction Metrics Summary:`,
    `  Elements detected:`,
  ];

  for (const [type, count] of Object.entries(metrics.detectedCounts)) {
    if (count > 0) {
      lines.push(`    - ${type}: ${count}`);
    }
  }

  lines.push(
    `  Coverage:`,
    `    - Bounding boxes: ${(metrics.mappedBoxCoverage * 100).toFixed(0)}%`,
    `    - Screenshots: ${(metrics.screenshotCoverage * 100).toFixed(0)}%`,
    `    - Above fold: ${(metrics.aboveFoldCoverage * 100).toFixed(0)}%`,
    `  Structured data: ${metrics.structuredDataPresence ? 'Yes' : 'No'}`,
    `  Warnings: ${metrics.warningCount}`,
    `  Duration: ${metrics.extractionDurationMs}ms`
  );

  return lines.join('\n');
}
