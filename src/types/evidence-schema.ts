/**
 * Evidence Schema - Phase 25g (T509)
 *
 * Defines stable JSON schema for evidence packaging.
 * Used for LLM context, debugging, and audit trails.
 */

import type { ScreenshotMode } from './index.js';
import type { StructuredProductData } from '../browser/dom/structured-data.js';
import type { CROType } from '../models/dom-tree.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Element Evidence Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Evidence for a single CRO element
 */
export interface EvidenceElement {
  /** Element index in DOM tree [0], [1], etc. */
  index: number;
  /** Viewport-prefixed reference [v0-0], [v1-5] — primary cross-viewport ID */
  viewportRef: string;
  /** CRO classification type */
  croType: Exclude<CROType, null>;
  /** CRO classification confidence 0-1 */
  confidence: number;
  /** HTML tag name */
  tagName: string;
  /** Truncated text content */
  text: string;
  /** Bounding box in page coordinates */
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Which viewports this element appears in */
  viewportIndices: number[];
  /** Which screenshot IDs this element is visible in */
  screenshotRefs: string[];
  /** Patterns that matched for CRO classification */
  matchedPatterns?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Screenshot Evidence Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Evidence for a single screenshot/tile
 */
export interface EvidenceScreenshot {
  /** Unique identifier for this screenshot */
  id: string;
  /** Viewport index (0, 1, 2, ...) */
  viewportIndex: number;
  /** Screenshot mode: viewport or tile */
  type: 'viewport' | 'tile';
  /** Scroll Y position when captured */
  scrollY: number;
  /** Start Y position (absolute page coords) */
  startY: number;
  /** End Y position (absolute page coords) */
  endY: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Whether this is above the fold (no scroll needed) */
  isAboveFold: boolean;
  /** Path to screenshot file (relative) */
  filePath?: string;
  /** Base64 encoded image (optional, for embedding) */
  base64?: string;
  /** Timestamp when captured */
  timestamp: string;
  /** Element indices visible in this screenshot */
  visibleElementIndices: number[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Metrics Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extraction quality metrics
 */
export interface ExtractionMetrics {
  /** Count of detected elements per CRO type */
  detectedCounts: Record<Exclude<CROType, null>, number>;
  /** Percentage of elements with bounding boxes mapped */
  mappedBoxCoverage: number;
  /** Percentage of page covered by screenshots */
  screenshotCoverage: number;
  /** 1 if structured data found, 0 otherwise */
  structuredDataPresence: number;
  /** Percentage of important CRO elements above fold */
  aboveFoldCoverage: number;
  /** Number of warnings generated */
  warningCount: number;
  /** Total extraction time in milliseconds */
  extractionDurationMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Evidence Package Type
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Complete evidence package for a single page analysis
 *
 * This is the stable JSON contract for evidence output.
 * All fields are explicitly typed for LLM consumption and auditing.
 */
export interface EvidencePackage {
  /** Schema version for backward compatibility */
  schemaVersion: '1.0.0';

  // ─────────────────────────────────────────────────────────────────────────────
  // Run Metadata
  // ─────────────────────────────────────────────────────────────────────────────

  /** URL that was analyzed */
  url: string;
  /** Unique run identifier (timestamp + hash) */
  runId: string;
  /** Timestamp when analysis started (ISO 8601) */
  timestamp: string;
  /** Screenshot capture mode used */
  mode: ScreenshotMode;

  // ─────────────────────────────────────────────────────────────────────────────
  // Page Dimensions
  // ─────────────────────────────────────────────────────────────────────────────

  /** Viewport height in pixels */
  viewportHeight: number;
  /** Viewport width in pixels */
  viewportWidth: number;
  /** Total page height in pixels (null if unknown) */
  pageHeight: number | null;

  // ─────────────────────────────────────────────────────────────────────────────
  // Structured Data
  // ─────────────────────────────────────────────────────────────────────────────

  /** JSON-LD Product schema if found */
  structuredData: StructuredProductData | null;

  // ─────────────────────────────────────────────────────────────────────────────
  // Elements & Screenshots
  // ─────────────────────────────────────────────────────────────────────────────

  /** CRO elements detected on the page */
  elements: EvidenceElement[];
  /** Screenshots captured during analysis */
  screenshots: EvidenceScreenshot[];

  // ─────────────────────────────────────────────────────────────────────────────
  // Quality & Diagnostics
  // ─────────────────────────────────────────────────────────────────────────────

  /** Extraction quality metrics */
  metrics: ExtractionMetrics;
  /** Warnings and issues encountered */
  warnings: string[];

}

// ═══════════════════════════════════════════════════════════════════════════════
// Builder Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create an empty metrics object with zero values
 */
export function createEmptyMetrics(): ExtractionMetrics {
  return {
    detectedCounts: {
      cta: 0,
      form: 0,
      trust: 0,
      value_prop: 0,
      navigation: 0,
      price: 0,
      variant: 0,
      stock: 0,
      shipping: 0,
      gallery: 0,
    },
    mappedBoxCoverage: 0,
    screenshotCoverage: 0,
    structuredDataPresence: 0,
    aboveFoldCoverage: 0,
    warningCount: 0,
    extractionDurationMs: 0,
  };
}

/**
 * Generate a unique run ID based on timestamp and optional seed
 */
export function generateRunId(timestamp?: Date, seed?: string): string {
  const ts = timestamp ?? new Date();
  const base = ts.toISOString().replace(/[:.]/g, '-');
  if (seed) {
    // Use simple hash of seed for uniqueness
    const hash = seed.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    const shortHash = Math.abs(hash).toString(36).slice(0, 6);
    return `${base}-${shortHash}`;
  }
  // Use random suffix if no seed
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${randomSuffix}`;
}

/**
 * Generate viewport reference in format [vX-Y]
 * @param viewportIndex - Viewport index (0, 1, 2, ...)
 * @param elementIndex - Element index within viewport
 */
export function generateViewportRef(viewportIndex: number, elementIndex: number): string {
  return `[v${viewportIndex}-${elementIndex}]`;
}

/**
 * Generate screenshot ID from viewport index and type
 */
export function generateScreenshotId(viewportIndex: number, type: 'viewport' | 'tile'): string {
  return `${type}-${viewportIndex}`;
}
