/**
 * Vision State Manager - Phase 21g (T336) + Phase 21i (T375)
 *
 * Manages the state of the Vision Agent during analysis.
 * Tracks snapshots, evaluations, and termination conditions.
 *
 * Phase 21i adds element mapping storage and evaluation enrichment.
 */

import type { HeuristicEvaluation, DOMElementRef, BoundingBox } from '../../heuristics/vision/types.js';
import type { Severity } from '../../models/cro-insight.js';
import type { DOMTree, DOMNode } from '../../models/dom-tree.js';
import type { ElementMapping } from '../../browser/dom/coordinate-mapper.js';
import type {
  VisionAgentState,
  VisionAgentStateInit,
  ViewportSnapshot,
  TerminationReason,
  VisionAgentOptions,
  VisionAgentSummary,
  BatchEvaluation,
  HeuristicDefinition,
} from './types.js';
import { DEFAULT_VISION_AGENT_OPTIONS } from './types.js';

/**
 * Context for the viewport where evaluations were made (Phase 21h + 21i)
 */
export interface ViewportContext {
  /** Index of the viewport snapshot (0-indexed) */
  viewportIndex: number;
  /** DOM tree from this viewport for element lookup */
  domTree?: DOMTree;
  /** Map of element index to bounding box */
  elementBoundingBoxes?: Map<number, BoundingBox>;
  /** Phase 21i: Element mappings with screenshot coordinates */
  elementMappings?: ElementMapping[];
}

/**
 * Manages Vision Agent state throughout the analysis lifecycle
 */
export class VisionStateManager {
  private state: VisionAgentState;
  private options: VisionAgentOptions;

  constructor(init: VisionAgentStateInit, options: Partial<VisionAgentOptions> = {}) {
    this.options = { ...DEFAULT_VISION_AGENT_OPTIONS, ...options };

    // Initialize state with all heuristics pending
    this.state = {
      step: 0,
      snapshots: [],
      currentScrollY: 0,
      pageHeight: init.pageHeight,
      viewportHeight: init.viewport.height,
      viewport: init.viewport,
      allHeuristicIds: [...init.heuristicIds],
      evaluatedHeuristicIds: new Set<string>(),
      pendingHeuristicIds: [...init.heuristicIds],
      evaluations: [],
      isDone: false,
      consecutiveFailures: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // State Accessors
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get current state (immutable copy)
   */
  getState(): Readonly<VisionAgentState> {
    return {
      ...this.state,
      evaluatedHeuristicIds: new Set(this.state.evaluatedHeuristicIds),
      pendingHeuristicIds: [...this.state.pendingHeuristicIds],
      evaluations: [...this.state.evaluations],
      snapshots: [...this.state.snapshots],
    };
  }

  /**
   * Get current step number
   */
  getStep(): number {
    return this.state.step;
  }

  /**
   * Get current scroll position
   */
  getCurrentScrollY(): number {
    return this.state.currentScrollY;
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): readonly ViewportSnapshot[] {
    return this.state.snapshots;
  }

  /**
   * Get latest snapshot
   */
  getLatestSnapshot(): ViewportSnapshot | undefined {
    return this.state.snapshots[this.state.snapshots.length - 1];
  }

  /**
   * Get all evaluations
   */
  getEvaluations(): readonly HeuristicEvaluation[] {
    return this.state.evaluations;
  }

  /**
   * Get pending heuristic IDs
   */
  getPendingHeuristicIds(): readonly string[] {
    return this.state.pendingHeuristicIds;
  }

  /**
   * Get evaluated heuristic IDs
   */
  getEvaluatedHeuristicIds(): ReadonlySet<string> {
    return this.state.evaluatedHeuristicIds;
  }

  /**
   * Check if a heuristic has been evaluated
   */
  isHeuristicEvaluated(heuristicId: string): boolean {
    return this.state.evaluatedHeuristicIds.has(heuristicId);
  }

  /**
   * Get coverage percentage (0-100)
   */
  getCoveragePercent(): number {
    if (this.state.allHeuristicIds.length === 0) return 100;
    return (this.state.evaluatedHeuristicIds.size / this.state.allHeuristicIds.length) * 100;
  }

  /**
   * Get page scroll progress percentage (0-100)
   */
  getScrollPercent(): number {
    const maxScroll = this.state.pageHeight - this.state.viewportHeight;
    if (maxScroll <= 0) return 100;
    return Math.min(100, (this.state.currentScrollY / maxScroll) * 100);
  }

  /**
   * Check if agent is done
   */
  isDone(): boolean {
    return this.state.isDone;
  }

  /**
   * Get termination reason
   */
  getTerminationReason(): TerminationReason | undefined {
    return this.state.terminationReason;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // State Mutators
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Increment step counter
   */
  incrementStep(): void {
    this.state.step += 1;
  }

  /**
   * Update scroll position
   */
  updateScrollPosition(scrollY: number): void {
    this.state.currentScrollY = Math.max(0, Math.min(scrollY, this.state.pageHeight));
  }

  /**
   * Update page height (if it changes after scroll)
   */
  updatePageHeight(height: number): void {
    this.state.pageHeight = height;
  }

  /**
   * Record a new viewport snapshot
   */
  recordSnapshot(snapshot: ViewportSnapshot): void {
    this.state.snapshots.push(snapshot);
  }

  /**
   * Add batch evaluations to state
   * Returns list of IDs that were skipped (already evaluated)
   *
   * Phase 21h (T356): Now accepts viewportContext for evidence capture
   */
  addEvaluations(
    batchEvaluations: BatchEvaluation[],
    heuristicDefinitions: Map<string, HeuristicDefinition>,
    viewportContext?: ViewportContext
  ): { added: string[]; skipped: string[] } {
    const added: string[] = [];
    const skipped: string[] = [];
    const timestamp = Date.now();

    for (const batch of batchEvaluations) {
      // Skip if already evaluated
      if (this.state.evaluatedHeuristicIds.has(batch.heuristicId)) {
        skipped.push(batch.heuristicId);
        continue;
      }

      // Get heuristic definition for severity and principle
      const definition = heuristicDefinitions.get(batch.heuristicId);
      if (!definition) {
        // Skip unknown heuristics
        skipped.push(batch.heuristicId);
        continue;
      }

      // Phase 21h: Build evidence fields (T356)
      const domElementRefs = this.buildDOMElementRefs(
        batch.elementIndices,
        viewportContext?.domTree
      );

      // Get primary element bounding box (first element if multiple)
      let boundingBox: BoundingBox | undefined;
      if (batch.elementIndices && batch.elementIndices.length > 0 && viewportContext?.elementBoundingBoxes) {
        const primaryIndex = batch.elementIndices[0];
        if (primaryIndex !== undefined) {
          boundingBox = viewportContext.elementBoundingBoxes.get(primaryIndex);
        }
      }

      // Create HeuristicEvaluation
      // Severity values match directly between knowledge base and HeuristicEvaluation
      const evaluation: HeuristicEvaluation = {
        heuristicId: batch.heuristicId,
        principle: definition.principle,
        status: batch.status,
        severity: definition.severity as Severity,
        observation: batch.observation,
        issue: batch.issue,
        recommendation: batch.recommendation,
        confidence: batch.confidence,
        // Phase 21h: Evidence fields (T356)
        viewportIndex: viewportContext?.viewportIndex,
        timestamp,
        domElementRefs: domElementRefs.length > 0 ? domElementRefs : undefined,
        boundingBox,
      };

      // Add to state
      this.state.evaluations.push(evaluation);
      this.state.evaluatedHeuristicIds.add(batch.heuristicId);
      added.push(batch.heuristicId);
    }

    // Update pending list
    this.state.pendingHeuristicIds = this.state.allHeuristicIds.filter(
      (id) => !this.state.evaluatedHeuristicIds.has(id)
    );

    return { added, skipped };
  }

  /**
   * Build DOMElementRef array from element indices and DOM tree (Phase 21h)
   */
  private buildDOMElementRefs(
    elementIndices?: number[],
    domTree?: DOMTree
  ): DOMElementRef[] {
    if (!elementIndices || elementIndices.length === 0) {
      return [];
    }

    const refs: DOMElementRef[] = [];

    // Build index-to-node map from DOM tree using node.index field
    const indexToNode = new Map<number, DOMNode>();
    if (domTree) {
      const buildIndex = (node: DOMNode) => {
        // Use the node's index if defined (visible CRO elements have index)
        if (node.index !== undefined) {
          indexToNode.set(node.index, node);
        }
        if (node.children) {
          for (const child of node.children) {
            buildIndex(child);
          }
        }
      };
      buildIndex(domTree.root);
    }

    for (const idx of elementIndices) {
      const node = indexToNode.get(idx);
      if (node) {
        refs.push({
          index: idx,
          xpath: node.xpath,
          elementType: node.croType || node.tagName,
          textContent: node.text?.slice(0, 100), // Truncate long text
        });
      } else {
        // Include index even if node not found
        refs.push({
          index: idx,
          elementType: 'unknown',
        });
      }
    }

    return refs;
  }

  /**
   * Mark heuristics as evaluated (for snapshot tracking)
   */
  markSnapshotHeuristics(viewportIndex: number, heuristicIds: string[]): void {
    const snapshot = this.state.snapshots[viewportIndex];
    if (snapshot) {
      snapshot.heuristicsEvaluated.push(...heuristicIds);
    }
  }

  /**
   * Record a consecutive failure
   */
  recordFailure(): void {
    this.state.consecutiveFailures += 1;
  }

  /**
   * Reset consecutive failure counter
   */
  resetFailures(): void {
    this.state.consecutiveFailures = 0;
  }

  /**
   * Mark agent as done with reason
   */
  markDone(reason: TerminationReason, errorMessage?: string): void {
    this.state.isDone = true;
    this.state.terminationReason = reason;
    if (errorMessage) {
      this.state.errorMessage = errorMessage;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Termination Logic
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Check if agent should terminate
   */
  shouldTerminate(): boolean {
    // Already done
    if (this.state.isDone) {
      return true;
    }

    // All heuristics evaluated - but also check scroll coverage
    if (this.state.pendingHeuristicIds.length === 0) {
      // Check if page requires scrolling and if we've scrolled enough
      const minScrollRequired = 50; // 50% minimum scroll coverage
      const maxScroll = Math.max(0, this.state.pageHeight - this.state.viewportHeight);
      const scrollPercent = maxScroll > 0 ? (this.state.currentScrollY / maxScroll) * 100 : 100;
      const pageRequiresScroll = this.state.pageHeight > this.state.viewportHeight * 1.5;

      // If page is tall and we haven't scrolled enough, don't auto-terminate
      // Let the agent continue (it will need to scroll to complete)
      if (pageRequiresScroll && scrollPercent < minScrollRequired) {
        return false;
      }

      this.markDone('all_heuristics_evaluated');
      return true;
    }

    // Max steps reached
    if (this.state.step >= this.options.maxSteps) {
      this.markDone('max_steps_reached');
      return true;
    }

    // Consecutive failures exceeded
    if (this.state.consecutiveFailures >= this.options.maxConsecutiveFailures) {
      this.markDone('consecutive_failures');
      return true;
    }

    return false;
  }

  /**
   * Check if done tool can be called (all heuristics must be evaluated or explained)
   */
  canCallDone(unevaluatedExplanations?: Map<string, string>): {
    allowed: boolean;
    reason?: string;
  } {
    const pending = this.state.pendingHeuristicIds;

    // If all evaluated, allowed
    if (pending.length === 0) {
      return { allowed: true };
    }

    // If explanations provided for all pending, allowed
    if (unevaluatedExplanations) {
      const unexplained = pending.filter((id) => !unevaluatedExplanations.has(id));
      if (unexplained.length === 0) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `Cannot complete: ${unexplained.length} heuristics not evaluated and not explained: ${unexplained.slice(0, 5).join(', ')}${unexplained.length > 5 ? '...' : ''}`,
      };
    }

    // Pending without explanations
    return {
      allowed: false,
      reason: `Cannot complete: ${pending.length} heuristics still pending: ${pending.slice(0, 5).join(', ')}${pending.length > 5 ? '...' : ''}`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Summary Generation
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate summary statistics
   */
  getSummary(): VisionAgentSummary {
    const evaluations = this.state.evaluations;

    // Count by status
    const statusCounts = {
      passed: 0,
      failed: 0,
      partial: 0,
      notApplicable: 0,
    };

    // Count by severity (for failed/partial)
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const evaluation of evaluations) {
      switch (evaluation.status) {
        case 'pass':
          statusCounts.passed += 1;
          break;
        case 'fail':
          statusCounts.failed += 1;
          severityCounts[evaluation.severity] += 1;
          break;
        case 'partial':
          statusCounts.partial += 1;
          severityCounts[evaluation.severity] += 1;
          break;
        case 'not_applicable':
          statusCounts.notApplicable += 1;
          break;
      }
    }

    return {
      totalHeuristics: this.state.allHeuristicIds.length,
      evaluated: this.state.evaluatedHeuristicIds.size,
      passed: statusCounts.passed,
      failed: statusCounts.failed,
      partial: statusCounts.partial,
      notApplicable: statusCounts.notApplicable,
      coveragePercent: this.getCoveragePercent(),
      bySeverity: severityCounts,
    };
  }

  /**
   * Get status string for logging
   */
  getStatusString(): string {
    const scrollPct = this.getScrollPercent().toFixed(0);
    const coveragePct = this.getCoveragePercent().toFixed(0);
    const evaluated = this.state.evaluatedHeuristicIds.size;
    const total = this.state.allHeuristicIds.length;
    const snapshots = this.state.snapshots.length;

    return `Step ${this.state.step} | Scroll: ${scrollPct}% | Coverage: ${coveragePct}% (${evaluated}/${total}) | Snapshots: ${snapshots}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Phase 21i: Element Mapping Support (T375)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Get element mappings from the latest viewport snapshot
   */
  getLatestElementMappings(): ElementMapping[] | undefined {
    const latestSnapshot = this.getLatestSnapshot();
    return latestSnapshot?.elementMappings;
  }

  /**
   * Get element mapping by index from the latest viewport
   */
  getElementMappingByIndex(index: number): ElementMapping | undefined {
    const mappings = this.getLatestElementMappings();
    return mappings?.find((m) => m.index === index);
  }

  /**
   * Get element mappings for multiple indices from the latest viewport
   */
  getElementsByIndices(indices: number[]): ElementMapping[] {
    const mappings = this.getLatestElementMappings();
    if (!mappings) return [];

    const indexSet = new Set(indices);
    return mappings.filter((m) => indexSet.has(m.index));
  }

  /**
   * Enrich evaluation with element details from element mappings (Phase 21i T375)
   *
   * This method takes an evaluation with relatedElements indices and enriches
   * the domElementRefs with additional coordinate and type information from
   * the element mappings.
   *
   * @param evaluation - Evaluation with relatedElements indices
   * @param elementMappings - Element mappings from the viewport
   * @returns Evaluation with enriched domElementRefs
   */
  enrichEvaluationWithMappings(
    evaluation: HeuristicEvaluation,
    elementMappings?: ElementMapping[]
  ): HeuristicEvaluation {
    // If no mappings or no domElementRefs to enrich, return as-is
    if (!elementMappings || elementMappings.length === 0) {
      return evaluation;
    }

    // Get indices to look up (from existing domElementRefs or elementIndices in BatchEvaluation)
    const indices: number[] = [];
    if (evaluation.domElementRefs) {
      for (const ref of evaluation.domElementRefs) {
        indices.push(ref.index);
      }
    }

    // If no indices to enrich, return as-is
    if (indices.length === 0) {
      return evaluation;
    }

    // Create index-to-mapping lookup
    const mappingByIndex = new Map<number, ElementMapping>();
    for (const mapping of elementMappings) {
      mappingByIndex.set(mapping.index, mapping);
    }

    // Enrich domElementRefs with mapping data
    const enrichedRefs: DOMElementRef[] = [];
    for (const idx of indices) {
      const mapping = mappingByIndex.get(idx);
      if (mapping) {
        enrichedRefs.push({
          index: idx,
          xpath: mapping.xpath,
          elementType: mapping.croType || mapping.tagName,
          textContent: mapping.text?.slice(0, 100),
          // Note: selector not available from ElementMapping, keep from original if present
          selector: evaluation.domElementRefs?.find((r) => r.index === idx)?.selector,
        });
      } else {
        // Keep original ref if no mapping found
        const originalRef = evaluation.domElementRefs?.find((r) => r.index === idx);
        if (originalRef) {
          enrichedRefs.push(originalRef);
        } else {
          enrichedRefs.push({
            index: idx,
            elementType: 'unknown',
          });
        }
      }
    }

    return {
      ...evaluation,
      domElementRefs: enrichedRefs.length > 0 ? enrichedRefs : evaluation.domElementRefs,
    };
  }

  /**
   * Build ViewportContext from the latest snapshot (Phase 21i T375)
   *
   * Creates a ViewportContext object for use with addEvaluations(),
   * including element mappings for enrichment.
   */
  buildViewportContextFromLatest(): ViewportContext | undefined {
    const latestSnapshot = this.getLatestSnapshot();
    if (!latestSnapshot) {
      return undefined;
    }

    return {
      viewportIndex: latestSnapshot.viewportIndex,
      domTree: latestSnapshot.dom.tree,
      elementBoundingBoxes: latestSnapshot.elementBoundingBoxes,
      elementMappings: latestSnapshot.elementMappings,
    };
  }
}
