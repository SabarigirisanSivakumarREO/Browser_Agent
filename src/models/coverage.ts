/**
 * Coverage Tracking Models - Phase 19a
 *
 * Interfaces for tracking page coverage during CRO analysis.
 * Enables 100% page coverage by tracking segments and elements.
 */

/**
 * Represents a vertical segment of the page
 */
export interface PageSegment {
  index: number;
  startY: number;
  endY: number;
  scanned: boolean;
  scannedAt?: number;
  elementsFound: number;
  elementsAnalyzed: number;
}

/**
 * Tracks which elements have been examined
 */
export interface ElementCoverage {
  xpath: string;
  croType: string | null;
  firstSeenAt: number;
  firstSeenSegment: number;
  analyzedBy: string[];
  insightsGenerated: number;
}

/**
 * Main coverage tracking state
 */
export interface CoverageState {
  pageHeight: number;
  viewportHeight: number;
  segments: PageSegment[];
  elementsDiscovered: Map<string, ElementCoverage>;
  totalCROElements: number;
  analyzedCROElements: number;
  segmentsCovered: number;
  segmentsTotal: number;
  coveragePercent: number;
  scrollPositionsVisited: number[];
  currentScrollY: number;
  maxScrollY: number;
}

/**
 * Coverage configuration options
 */
export interface CoverageConfig {
  /** Minimum coverage percentage required (default: 100) */
  minCoveragePercent: number;
  /** Overlap between segments in pixels (default: 100) */
  segmentOverlapPx: number;
  /** Require all segments to be scanned (default: true) */
  requireAllSegments: boolean;
  /** Require CRO elements to be analyzed (default: true) */
  requireElementAnalysis: boolean;
}

/**
 * Default coverage configuration
 */
export const DEFAULT_COVERAGE_CONFIG: CoverageConfig = {
  minCoveragePercent: 100,
  segmentOverlapPx: 100,
  requireAllSegments: true,
  requireElementAnalysis: true,
};

/**
 * Analysis scan modes
 */
export type ScanMode =
  | 'full_page'    // Deterministic: scan every segment (NEW DEFAULT)
  | 'above_fold'   // Quick: only initial viewport
  | 'llm_guided';  // Original: LLM decides scrolling
