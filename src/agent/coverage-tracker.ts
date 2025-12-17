/**
 * Coverage Tracker - Phase 19a
 *
 * Tracks page coverage during CRO analysis to ensure 100% page scanning.
 * Manages segments, element discovery, and coverage metrics.
 */

import type {
  PageSegment,
  ElementCoverage,
  CoverageState,
  CoverageConfig,
} from '../models/coverage.js';
import { DEFAULT_COVERAGE_CONFIG } from '../models/coverage.js';
import { createLogger } from '../utils/index.js';

const logger = createLogger('CoverageTracker');

/**
 * CoverageTracker - Tracks page segments and element coverage
 */
export class CoverageTracker {
  private state: CoverageState;
  private config: CoverageConfig;

  constructor(config?: Partial<CoverageConfig>) {
    this.config = { ...DEFAULT_COVERAGE_CONFIG, ...config };
    this.state = this.createInitialState();
  }

  /**
   * Create initial empty state
   */
  private createInitialState(): CoverageState {
    return {
      pageHeight: 0,
      viewportHeight: 0,
      segments: [],
      elementsDiscovered: new Map(),
      totalCROElements: 0,
      analyzedCROElements: 0,
      segmentsCovered: 0,
      segmentsTotal: 0,
      coveragePercent: 0,
      scrollPositionsVisited: [],
      currentScrollY: 0,
      maxScrollY: 0,
    };
  }

  /**
   * Initialize segments based on page dimensions
   */
  initialize(pageHeight: number, viewportHeight: number): void {
    if (pageHeight <= 0 || viewportHeight <= 0) {
      throw new Error('Page height and viewport height must be positive');
    }

    this.state.pageHeight = pageHeight;
    this.state.viewportHeight = viewportHeight;
    this.state.maxScrollY = Math.max(0, pageHeight - viewportHeight);

    // Calculate effective segment height (viewport minus overlap)
    const effectiveHeight = Math.max(
      viewportHeight - this.config.segmentOverlapPx,
      viewportHeight / 2 // Minimum 50% of viewport per segment
    );

    // Calculate number of segments needed
    const segmentCount = Math.ceil(pageHeight / effectiveHeight);

    this.state.segments = [];
    for (let i = 0; i < segmentCount; i++) {
      const startY = i * effectiveHeight;
      const endY = Math.min(startY + viewportHeight, pageHeight);

      this.state.segments.push({
        index: i,
        startY,
        endY,
        scanned: false,
        elementsFound: 0,
        elementsAnalyzed: 0,
      });
    }

    this.state.segmentsTotal = segmentCount;
    this.state.segmentsCovered = 0;
    this.state.coveragePercent = 0;

    logger.debug('Coverage initialized', {
      pageHeight,
      viewportHeight,
      segmentCount,
      effectiveHeight,
    });
  }

  /**
   * Mark a segment as scanned based on scroll position
   */
  markSegmentScanned(scrollY: number, elementsFound: number): void {
    // Record scroll position
    if (!this.state.scrollPositionsVisited.includes(scrollY)) {
      this.state.scrollPositionsVisited.push(scrollY);
    }
    this.state.currentScrollY = scrollY;

    // Find which segment(s) this scroll position covers
    const viewportTop = scrollY;
    const viewportBottom = scrollY + this.state.viewportHeight;

    for (const segment of this.state.segments) {
      // Check if segment is visible in current viewport
      const segmentVisible =
        viewportTop < segment.endY && viewportBottom > segment.startY;

      if (segmentVisible && !segment.scanned) {
        segment.scanned = true;
        segment.scannedAt = Date.now();
        segment.elementsFound = elementsFound;
        this.state.segmentsCovered++;

        logger.debug('Segment scanned', {
          segmentIndex: segment.index,
          startY: segment.startY,
          endY: segment.endY,
          elementsFound,
        });
      }
    }

    this.updateCoveragePercent();
  }

  /**
   * Record discovery of a CRO element
   */
  recordElementDiscovered(
    xpath: string,
    croType: string | null,
    segmentIndex: number
  ): void {
    if (this.state.elementsDiscovered.has(xpath)) {
      // Element already discovered, skip
      return;
    }

    const coverage: ElementCoverage = {
      xpath,
      croType,
      firstSeenAt: Date.now(),
      firstSeenSegment: segmentIndex,
      analyzedBy: [],
      insightsGenerated: 0,
    };

    this.state.elementsDiscovered.set(xpath, coverage);

    if (croType) {
      this.state.totalCROElements++;
    }

    logger.debug('Element discovered', { xpath, croType, segmentIndex });
  }

  /**
   * Record that an element was analyzed by a tool
   */
  recordElementAnalyzed(xpath: string, toolName: string): void {
    const element = this.state.elementsDiscovered.get(xpath);

    if (element) {
      if (!element.analyzedBy.includes(toolName)) {
        element.analyzedBy.push(toolName);

        // Count as analyzed if this is first analysis
        if (element.analyzedBy.length === 1 && element.croType) {
          this.state.analyzedCROElements++;
        }
      }
    }
  }

  /**
   * Record insights generated for an element
   */
  recordInsightsGenerated(xpath: string, count: number): void {
    const element = this.state.elementsDiscovered.get(xpath);
    if (element) {
      element.insightsGenerated += count;
    }
  }

  /**
   * Update coverage percentage based on current state
   */
  private updateCoveragePercent(): void {
    if (this.state.segmentsTotal === 0) {
      this.state.coveragePercent = 0;
      return;
    }

    // Primary metric: segment coverage
    const segmentCoverage =
      (this.state.segmentsCovered / this.state.segmentsTotal) * 100;

    this.state.coveragePercent = Math.round(segmentCoverage);
  }

  /**
   * Get current coverage percentage
   */
  getCoveragePercent(): number {
    return this.state.coveragePercent;
  }

  /**
   * Check if coverage requirements are met
   */
  isFullyCovered(): boolean {
    return this.state.coveragePercent >= this.config.minCoveragePercent;
  }

  /**
   * Get the next unscanned segment (in order)
   */
  getNextUnscannedSegment(): PageSegment | null {
    for (const segment of this.state.segments) {
      if (!segment.scanned) {
        return segment;
      }
    }
    return null;
  }

  /**
   * Get all unscanned segments
   */
  getUnscannedSegments(): PageSegment[] {
    return this.state.segments.filter((s) => !s.scanned);
  }

  /**
   * Get current state (read-only copy)
   */
  getState(): Readonly<CoverageState> {
    return {
      ...this.state,
      elementsDiscovered: new Map(this.state.elementsDiscovered),
      segments: this.state.segments.map((s) => ({ ...s })),
      scrollPositionsVisited: [...this.state.scrollPositionsVisited],
    };
  }

  /**
   * Get coverage report as human-readable string (for LLM context)
   */
  getCoverageReport(): string {
    const lines: string[] = [];

    lines.push(`Coverage: ${this.state.coveragePercent}%`);
    lines.push(
      `Segments: ${this.state.segmentsCovered}/${this.state.segmentsTotal} scanned`
    );
    lines.push(
      `Page: ${this.state.pageHeight}px height, ${this.state.viewportHeight}px viewport`
    );

    if (this.state.totalCROElements > 0) {
      lines.push(
        `Elements: ${this.state.analyzedCROElements}/${this.state.totalCROElements} CRO elements analyzed`
      );
    }

    // List unscanned regions
    const unscanned = this.getUnscannedSegments();
    if (unscanned.length > 0) {
      const regions = unscanned
        .slice(0, 3)
        .map((s) => `${s.startY}-${s.endY}px`)
        .join(', ');
      const more = unscanned.length > 3 ? ` (+${unscanned.length - 3} more)` : '';
      lines.push(`Uncovered regions: ${regions}${more}`);
    }

    return lines.join('\n');
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<CoverageConfig> {
    return { ...this.config };
  }

  /**
   * Reset tracker state
   */
  reset(): void {
    this.state = this.createInitialState();
  }
}
