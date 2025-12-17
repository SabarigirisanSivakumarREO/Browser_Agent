# Coverage Fix Plan: 100% Page Content Analysis

**Created:** 2025-12-11
**Status:** Pending Approval
**Priority:** High

---

## Executive Summary

**Problem:** Current agent loop relies on LLM to decide when to scroll, leading to incomplete page coverage (estimated 20-60% on long pages).

**Solution:** Implement a deterministic segment-based scanning system with coverage tracking and enforcement.

**Impact:** Guarantees 100% page content is analyzed before completion.

---

## Problem Analysis

### Critical Flaws Identified

| Flaw | Location | Impact |
|------|----------|--------|
| LLM-dependent scrolling | `cro-agent.ts:284-411` | LLM may forget to scroll or call `done` prematurely |
| Token budget truncation | `serializer.ts:89-91` | Silently drops elements after 8000 tokens |
| Viewport-locked DOM extraction | `build-dom-tree.ts:129-131` | Elements below fold marked invisible |
| No scroll coverage tracking | N/A | No tracking of which page regions analyzed |
| Arbitrary maxSteps limit | `agent-state.ts:26` | 10 steps insufficient for long pages |
| No coverage enforcement | N/A | `done` action not blocked when coverage incomplete |

### Current Coverage Estimates

| Page Type | Estimated Coverage |
|-----------|-------------------|
| Simple landing page (1 viewport) | ~90% |
| Medium landing page (3 viewports) | ~60% |
| Long e-commerce page (10+ viewports) | ~20-30% |
| Infinite scroll page | ~10% |

---

## Solution Architecture

### Overview

```
+---------------------------------------------------------------------+
|                      NEW COVERAGE SYSTEM                             |
+---------------------------------------------------------------------+
|                                                                      |
|  +---------------+    +---------------+    +---------------------+   |
|  |  Scan Mode    |    |  Coverage     |    |  Coverage           |   |
|  |  Selector     |--->|  Tracker      |--->|  Enforcer           |   |
|  |               |    |               |    |                     |   |
|  | * full_page   |    | * Segments    |    | * Block premature   |   |
|  | * viewport    |    | * Elements    |    |   'done' calls      |   |
|  | * llm_guided  |    | * XPaths      |    | * Force scroll if   |   |
|  +---------------+    +---------------+    |   coverage < 100%   |   |
|                                            +---------------------+   |
|                                                                      |
|  +---------------------------------------------------------------+   |
|  |              SEGMENT-BASED SCANNING                            |   |
|  |                                                                |   |
|  |  Page Height: 3000px    Viewport: 800px                       |   |
|  |                                                                |   |
|  |  Segment 0: [0-800]     [x] Scanned                           |   |
|  |  Segment 1: [800-1600]  [x] Scanned                           |   |
|  |  Segment 2: [1600-2400] [ ] Pending                           |   |
|  |  Segment 3: [2400-3000] [ ] Pending                           |   |
|  |                                                                |   |
|  |  Coverage: 53%  (2/4 segments)                                |   |
|  +---------------------------------------------------------------+   |
|                                                                      |
+---------------------------------------------------------------------+
```

### Two-Mode System

1. **Deterministic Full-Page Scan** (NEW DEFAULT) - Guarantees 100% coverage
2. **LLM-Guided Mode** (Original behavior) - Optional, for quick scans

---

## Part 1: New Models & Interfaces

### 1.1 Coverage Tracker Model

**New File:** `src/models/coverage-tracker.ts`

```typescript
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

  // Element tracking
  elementsDiscovered: Map<string, ElementCoverage>;
  totalCROElements: number;
  analyzedCROElements: number;

  // Metrics
  segmentsCovered: number;
  segmentsTotal: number;
  coveragePercent: number;

  // Scroll tracking
  scrollPositionsVisited: number[];
  currentScrollY: number;
  maxScrollY: number;
}

/**
 * Coverage configuration
 */
export interface CoverageConfig {
  minCoveragePercent: number;     // Default: 100
  segmentOverlapPx: number;       // Default: 100
  requireAllSegments: boolean;    // Default: true
  requireElementAnalysis: boolean; // Default: true
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
```

### 1.2 Scan Mode Type

**Update File:** `src/types/index.ts`

```typescript
/**
 * Analysis scan modes
 */
export type ScanMode =
  | 'full_page'      // Deterministic: scan every segment (NEW DEFAULT)
  | 'above_fold'     // Quick: only initial viewport
  | 'llm_guided';    // Original: LLM decides scrolling

// Update AnalyzeOptions interface
export interface AnalyzeOptions {
  browserConfig?: Partial<typeof DEFAULT_BROWSER_CONFIG>;
  registry?: ToolRegistry;
  verbose?: boolean;
  outputFormat?: OutputFormat;
  skipPostProcessing?: boolean;
  skipHeuristics?: boolean;
  // NEW FIELDS
  scanMode?: ScanMode;
  coverageConfig?: Partial<CoverageConfig>;
}
```

---

## Part 2: Coverage Tracker Class

### 2.1 Implementation

**New File:** `src/agent/coverage-tracker.ts`

```typescript
import type {
  PageSegment,
  ElementCoverage,
  CoverageState,
  CoverageConfig
} from '../models/coverage-tracker.js';
import { DEFAULT_COVERAGE_CONFIG } from '../models/coverage-tracker.js';

export class CoverageTracker {
  private state: CoverageState;
  private config: CoverageConfig;

  constructor(config?: Partial<CoverageConfig>) {
    this.config = { ...DEFAULT_COVERAGE_CONFIG, ...config };
    this.state = this.createInitialState();
  }

  /**
   * Initialize segments based on page dimensions
   */
  initialize(pageHeight: number, viewportHeight: number): void {
    this.state.pageHeight = pageHeight;
    this.state.viewportHeight = viewportHeight;
    this.state.maxScrollY = Math.max(0, pageHeight - viewportHeight);

    // Calculate segments with overlap
    const effectiveHeight = viewportHeight - this.config.segmentOverlapPx;
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
  }

  /**
   * Mark segment as scanned based on scroll position
   */
  markSegmentScanned(scrollY: number, elementsFound: number): void {
    const segment = this.getSegmentAtPosition(scrollY);
    if (segment && !segment.scanned) {
      segment.scanned = true;
      segment.scannedAt = Date.now();
      segment.elementsFound = elementsFound;
      this.state.segmentsCovered++;
      this.state.scrollPositionsVisited.push(scrollY);
      this.updateCoveragePercent();
    }
  }

  /**
   * Record element discovered during scan
   */
  recordElementDiscovered(xpath: string, croType: string | null, segment: number): void {
    if (!this.state.elementsDiscovered.has(xpath)) {
      this.state.elementsDiscovered.set(xpath, {
        xpath,
        croType,
        firstSeenAt: Date.now(),
        firstSeenSegment: segment,
        analyzedBy: [],
        insightsGenerated: 0,
      });
      if (croType) {
        this.state.totalCROElements++;
      }
    }
  }

  /**
   * Record element analyzed by a tool
   */
  recordElementAnalyzed(xpath: string, toolName: string): void {
    const element = this.state.elementsDiscovered.get(xpath);
    if (element && !element.analyzedBy.includes(toolName)) {
      element.analyzedBy.push(toolName);
      if (element.analyzedBy.length === 1) {
        this.state.analyzedCROElements++;
      }
    }
  }

  /**
   * Get current coverage percentage
   */
  getCoveragePercent(): number {
    return this.state.coveragePercent;
  }

  /**
   * Check if fully covered
   */
  isFullyCovered(): boolean {
    return this.state.coveragePercent >= this.config.minCoveragePercent;
  }

  /**
   * Get next unscanned segment
   */
  getNextUnscannedSegment(): PageSegment | null {
    return this.state.segments.find(s => !s.scanned) || null;
  }

  /**
   * Get all unscanned segments
   */
  getUnscannedSegments(): PageSegment[] {
    return this.state.segments.filter(s => !s.scanned);
  }

  /**
   * Get coverage report for LLM prompt
   */
  getCoverageReport(): string {
    const uncovered = this.getUnscannedSegments();
    const lines = [
      `Segments: ${this.state.segmentsCovered}/${this.state.segmentsTotal} (${this.state.coveragePercent}%)`,
      `Elements discovered: ${this.state.totalCROElements}`,
      `Elements analyzed: ${this.state.analyzedCROElements}`,
    ];

    if (uncovered.length > 0) {
      const regions = uncovered.map(s => `Y=${s.startY}-${s.endY}`).join(', ');
      lines.push(`UNCOVERED REGIONS: ${regions}`);
    } else {
      lines.push('ALL SEGMENTS COVERED');
    }

    return lines.join('\n');
  }

  /**
   * Get full state (for debugging/logging)
   */
  getState(): CoverageState {
    return { ...this.state };
  }

  // Private methods

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

  private getSegmentAtPosition(scrollY: number): PageSegment | undefined {
    return this.state.segments.find(
      s => scrollY >= s.startY && scrollY < s.startY + this.state.viewportHeight
    );
  }

  private updateCoveragePercent(): void {
    if (this.state.segmentsTotal === 0) {
      this.state.coveragePercent = 0;
    } else {
      this.state.coveragePercent = Math.round(
        (this.state.segmentsCovered / this.state.segmentsTotal) * 100
      );
    }
  }
}
```

---

## Part 3: Agent Loop Modifications

### 3.1 Full Page Scan Mode

**Update File:** `src/agent/cro-agent.ts`

**New Flow:**

```
Phase A: DETERMINISTIC SCAN (NEW)
|-- 1. Get page dimensions
|-- 2. Initialize CoverageTracker with segments
|-- 3. FOR each segment:
|   |-- a. Scroll to segment.startY
|   |-- b. Wait for content to load
|   |-- c. Extract DOM at this position
|   |-- d. Record discovered elements
|   |-- e. Mark segment as scanned
|   +-- f. Store DOM snapshot for segment
|-- 4. Merge all DOM snapshots into complete tree
+-- 5. Calculate total CRO elements

Phase B: LLM ANALYSIS (Modified)
|-- 1. Present COMPLETE page state to LLM
|-- 2. LLM runs analysis tools on full data
|-- 3. Coverage enforcer prevents premature 'done'
+-- 4. Continue until analysis complete

Phase C: POST-PROCESSING (Existing)
|-- Business type detection
|-- Heuristic rules
|-- Deduplication
+-- Report generation
```

### 3.2 Coverage Enforcement Logic

```typescript
// In agent loop, before executing 'done' tool:
if (action.name === 'done') {
  const coverage = coverageTracker.getCoveragePercent();

  if (coverage < config.minCoveragePercent) {
    // BLOCK the done action
    const nextSegment = coverageTracker.getNextUnscannedSegment();

    // Override LLM decision
    action = {
      name: 'scroll_page',
      params: {
        direction: 'down',
        amount: nextSegment.startY - currentScrollY
      }
    };

    logger.warn('Coverage enforcement: blocked done, forcing scroll', {
      currentCoverage: coverage,
      requiredCoverage: config.minCoveragePercent,
      scrollingTo: nextSegment.startY
    });
  }
}
```

### 3.3 Dynamic maxSteps Calculation

```typescript
function calculateRequiredSteps(pageHeight: number, viewportHeight: number): number {
  const segments = Math.ceil(pageHeight / (viewportHeight * 0.8));
  const analysisToolCount = 6;

  const scrollSteps = segments;
  const analysisSteps = analysisToolCount;
  const synthesisSteps = 2;

  return scrollSteps + analysisSteps + synthesisSteps;
}

// In analyze() method:
if (scanMode === 'full_page') {
  const requiredSteps = calculateRequiredSteps(pageHeight, viewportHeight);
  options.maxSteps = Math.max(options.maxSteps, requiredSteps);
}
```

---

## Part 4: DOM Extraction Changes

### 4.1 Absolute Bounding Box Coordinates

**Update File:** `src/browser/dom/build-dom-tree.ts`

```typescript
// Change from viewport-relative to page-absolute coordinates
const absoluteBoundingBox = {
  x: rect.x,
  y: rect.y + window.scrollY,  // ADD scroll offset
  width: rect.width,
  height: rect.height
};
```

### 4.2 DOM Merger for Multi-Segment

**New File:** `src/browser/dom/dom-merger.ts`

```typescript
import type { DOMTree, DOMNode } from '../../models/index.js';

export class DOMMerger {
  /**
   * Merge multiple DOM snapshots into single complete tree
   */
  merge(snapshots: DOMTree[]): DOMTree {
    if (snapshots.length === 0) {
      throw new Error('No snapshots to merge');
    }

    if (snapshots.length === 1) {
      return snapshots[0];
    }

    // Use first snapshot as base
    const base = this.deepClone(snapshots[0]);
    const seenXPaths = new Set<string>();

    // Collect all xpaths from base
    this.collectXPaths(base.root, seenXPaths);

    // Merge subsequent snapshots
    for (let i = 1; i < snapshots.length; i++) {
      this.mergeSnapshot(base, snapshots[i], seenXPaths);
    }

    // Recalculate counts
    base.totalNodeCount = this.countNodes(base.root);
    base.croElementCount = this.countCROElements(base.root);
    base.interactiveCount = this.countInteractive(base.root);

    // Reindex elements
    this.reindex(base.root);

    return base;
  }

  private mergeSnapshot(base: DOMTree, snapshot: DOMTree, seenXPaths: Set<string>): void {
    this.traverseAndMerge(base.root, snapshot.root, seenXPaths);
  }

  private traverseAndMerge(baseNode: DOMNode, snapshotNode: DOMNode, seenXPaths: Set<string>): void {
    // Add new elements not in base
    for (const child of snapshotNode.children) {
      if (!seenXPaths.has(child.xpath)) {
        // Find correct parent in base and add
        const parent = this.findNodeByXPath(baseNode, this.getParentXPath(child.xpath));
        if (parent) {
          parent.children.push(this.deepCloneNode(child));
          seenXPaths.add(child.xpath);
        }
      }

      // Recursively process children
      const baseChild = this.findNodeByXPath(baseNode, child.xpath);
      if (baseChild) {
        this.traverseAndMerge(baseChild, child, seenXPaths);
      }
    }
  }

  // Helper methods...
  private deepClone(tree: DOMTree): DOMTree { /* ... */ }
  private deepCloneNode(node: DOMNode): DOMNode { /* ... */ }
  private collectXPaths(node: DOMNode, set: Set<string>): void { /* ... */ }
  private findNodeByXPath(root: DOMNode, xpath: string): DOMNode | null { /* ... */ }
  private getParentXPath(xpath: string): string { /* ... */ }
  private countNodes(node: DOMNode): number { /* ... */ }
  private countCROElements(node: DOMNode): number { /* ... */ }
  private countInteractive(node: DOMNode): number { /* ... */ }
  private reindex(node: DOMNode, counter = { value: 0 }): void { /* ... */ }
}
```

---

## Part 5: Serializer Changes

### 5.1 Dynamic Token Budget

**Update File:** `src/browser/dom/serializer.ts`

```typescript
const DEFAULT_OPTIONS: DOMSerializerOptions = {
  maxTokens: 8000,  // For llm_guided mode
};

const FULL_PAGE_OPTIONS: DOMSerializerOptions = {
  maxTokens: 32000,  // For full_page mode
};

// In serialize method, accept mode parameter:
serialize(tree: DOMTree, mode: ScanMode = 'llm_guided'): SerializationResult {
  const options = mode === 'full_page' ? FULL_PAGE_OPTIONS : DEFAULT_OPTIONS;
  // ... rest of implementation
}
```

### 5.2 Alternative: Chunked Serialization

```typescript
/**
 * Serialize DOM by CRO category for chunked LLM processing
 */
serializeByCategory(tree: DOMTree): Map<string, SerializationResult> {
  const categories = ['cta', 'form', 'trust', 'value_prop', 'navigation'];
  const results = new Map<string, SerializationResult>();

  for (const category of categories) {
    const filtered = this.filterByCategory(tree, category);
    results.set(category, this.serialize(filtered));
  }

  return results;
}
```

---

## Part 6: State Manager Updates

### 6.1 Coverage State Integration

**Update File:** `src/agent/state-manager.ts`

```typescript
import { CoverageTracker } from './coverage-tracker.js';
import type { ScanMode } from '../types/index.js';

interface AgentState {
  // ... existing fields

  // Coverage tracking (NEW)
  coverageTracker?: CoverageTracker;
  scanMode: ScanMode;
}

export class StateManager {
  // ... existing code

  // NEW: Coverage methods
  initializeCoverage(pageHeight: number, viewportHeight: number, config?: CoverageConfig): void {
    this.state.coverageTracker = new CoverageTracker(config);
    this.state.coverageTracker.initialize(pageHeight, viewportHeight);
  }

  getCoveragePercent(): number {
    return this.state.coverageTracker?.getCoveragePercent() ?? 0;
  }

  isFullyCovered(): boolean {
    return this.state.coverageTracker?.isFullyCovered() ?? true;
  }

  getNextUnscannedSegment(): PageSegment | null {
    return this.state.coverageTracker?.getNextUnscannedSegment() ?? null;
  }

  // MODIFIED: Add coverage check to termination
  shouldTerminate(): boolean {
    // Cannot terminate in full_page mode until coverage complete
    if (this.state.scanMode === 'full_page' && !this.isFullyCovered()) {
      return false;
    }

    // Original termination logic
    return (
      this.state.step >= this.options.maxSteps ||
      this.state.consecutiveFailures >= this.options.failureLimit ||
      this.state.isDone
    );
  }
}
```

---

## Part 7: Prompt Updates

### 7.1 System Prompt

**Update File:** `src/prompts/system-cro.md`

Add new section:

```markdown
<coverage_awareness>
You will receive coverage information showing:
- Which page segments have been scanned
- Current coverage percentage
- Elements discovered vs analyzed

IMPORTANT RULES:
1. You CANNOT call 'done' until coverage reaches 100%
2. If coverage < 100%, you MUST scroll to uncovered segments
3. The system will BLOCK premature 'done' calls automatically
4. Focus on analyzing NEW elements after each scroll
5. Check the <coverage> section in each message for status
</coverage_awareness>
```

### 7.2 User Message Format

**Update File:** `src/agent/prompt-builder.ts`

```typescript
buildUserMessage(state: PageState, memory: CROMemory): string {
  // ... existing code

  // Add coverage section
  const coverageSection = state.coverageTracker
    ? `<coverage>\n${state.coverageTracker.getCoverageReport()}\n</coverage>`
    : '';

  return `
<page_url>${state.url}</page_url>
<page_title>${state.title}</page_title>
<viewport>${state.viewport.width}x${state.viewport.height}</viewport>
<scroll_position>x:${state.scrollPosition.x}, y:${state.scrollPosition.y}, maxY:${state.scrollPosition.maxY}</scroll_position>

${coverageSection}

<cro_elements count="${serialized.elementCount}" tokens="${serialized.estimatedTokens}">
${serialized.text}
</cro_elements>

${memorySection}

Analyze the page and decide your next action. Respond with valid JSON only.`;
}
```

---

## Part 8: CLI Updates

### 8.1 New Flags

**Update File:** `src/cli.ts`

```typescript
// Add to argument parsing
const scanModeArg = args.find(a => a.startsWith('--scan-mode='));
const scanMode = scanModeArg
  ? scanModeArg.split('=')[1] as ScanMode
  : 'full_page';  // NEW DEFAULT

const minCoverageArg = args.find(a => a.startsWith('--min-coverage='));
const minCoverage = minCoverageArg
  ? parseInt(minCoverageArg.split('=')[1])
  : 100;

// Pass to analyze options
const result = await agent.analyze(url, {
  scanMode,
  coverageConfig: {
    minCoveragePercent: minCoverage,
  },
  // ... other options
});
```

### 8.2 Usage Examples

```bash
# Full page scan (new default) - guarantees 100% coverage
npm run start -- https://example.com

# Quick above-fold only
npm run start -- --scan-mode=above_fold https://example.com

# Original LLM-guided behavior
npm run start -- --scan-mode=llm_guided https://example.com

# Custom coverage threshold (80%)
npm run start -- --min-coverage=80 https://example.com

# Combine options
npm run start -- --scan-mode=full_page --min-coverage=95 --verbose https://example.com
```

---

## Part 9: File Changes Summary

| File | Type | Description |
|------|------|-------------|
| `src/models/coverage-tracker.ts` | NEW | Coverage interfaces and types |
| `src/agent/coverage-tracker.ts` | NEW | CoverageTracker class |
| `src/browser/dom/dom-merger.ts` | NEW | Multi-segment DOM merging |
| `src/agent/cro-agent.ts` | MODIFY | Add full-page scan, coverage enforcement |
| `src/agent/state-manager.ts` | MODIFY | Add coverage state, termination override |
| `src/agent/prompt-builder.ts` | MODIFY | Add coverage section to prompts |
| `src/browser/dom/serializer.ts` | MODIFY | Dynamic token budget |
| `src/browser/dom/build-dom-tree.ts` | MODIFY | Absolute bounding box coordinates |
| `src/prompts/system-cro.md` | MODIFY | Add coverage awareness instructions |
| `src/types/index.ts` | MODIFY | Add ScanMode, CoverageConfig types |
| `src/cli.ts` | MODIFY | Add scan mode flags |
| `src/models/index.ts` | MODIFY | Export new types |

---

## Part 10: Test Plan

### 10.1 Unit Tests

**New File:** `tests/unit/coverage-tracker.test.ts`

| Test | Description |
|------|-------------|
| initializes segments correctly | Verify segment calculation with overlap |
| marks segments as scanned | Test segment state updates |
| calculates coverage percent | Test percentage calculation |
| returns next unscanned segment | Test segment ordering |
| tracks element discovery | Test element registration |
| tracks element analysis | Test tool attribution |
| handles overlap correctly | Test deduplication |
| reports full coverage | Test 100% detection |
| respects minCoveragePercent config | Test custom thresholds |
| generates accurate coverage report | Test report formatting |

### 10.2 Unit Tests - DOM Merger

**New File:** `tests/unit/dom-merger.test.ts`

| Test | Description |
|------|-------------|
| merges two snapshots | Basic merge functionality |
| deduplicates by xpath | No duplicate elements |
| preserves element order | Document order maintained |
| handles empty snapshots | Edge case handling |
| recalculates indices | Correct sequential indexing |
| updates counts | Correct totals after merge |

### 10.3 Integration Tests

**New File:** `tests/integration/coverage-enforcement.test.ts`

| Test | Description |
|------|-------------|
| blocks done before full coverage | Verify enforcement works |
| allows done at 100% coverage | Verify completion allowed |
| forces scroll to uncovered segment | Verify auto-scroll override |
| merges DOM from multiple segments | Test full pipeline |
| calculates dynamic maxSteps | Test step budget adjustment |
| tracks elements across segments | Cross-segment element tracking |

### 10.4 E2E Tests

**Update File:** `tests/e2e/cro-full-workflow.test.ts`

| Test | Description |
|------|-------------|
| full_page mode covers entire page | Real browser, 3+ viewport page |
| above_fold mode only scans viewport | Quick mode verification |
| llm_guided mode preserves original behavior | Backward compatibility |
| coverage reported in final result | Result includes coverage metrics |

---

## Part 11: Implementation Phases

### Phase 19a: Foundation (Models & Tracker)
- [ ] T126 Create `src/models/coverage-tracker.ts` with interfaces
- [ ] T127 Create `src/agent/coverage-tracker.ts` class
- [ ] T128 Write unit tests for CoverageTracker (10 tests)
- [ ] T129 Export from `src/models/index.ts`

### Phase 19b: DOM Changes
- [ ] T130 Modify `build-dom-tree.ts` for absolute coordinates
- [ ] T131 Create `src/browser/dom/dom-merger.ts`
- [ ] T132 Write unit tests for DOMMerger (6 tests)
- [ ] T133 Update serializer with dynamic token budget

### Phase 19c: Agent Integration
- [ ] T134 Add ScanMode type to `src/types/index.ts`
- [ ] T135 Modify `cro-agent.ts` with full-page scan loop
- [ ] T136 Implement coverage enforcement logic
- [ ] T137 Update `state-manager.ts` with coverage state
- [ ] T138 Add dynamic maxSteps calculation

### Phase 19d: Prompt Updates
- [ ] T139 Update `system-cro.md` with coverage awareness
- [ ] T140 Modify `prompt-builder.ts` to include coverage section

### Phase 19e: CLI & Config
- [ ] T141 Update `cli.ts` with scan mode flags
- [ ] T142 Update default options to use full_page mode

### Phase 19f: Testing & Polish
- [ ] T143 Write integration tests (6 tests)
- [ ] T144 Write E2E tests (4 tests)
- [ ] T145 Update documentation (quickstart.md)
- [ ] T146 Performance testing and optimization

---

## Part 12: Estimated Effort

| Phase | Tasks | New Lines | Modified Lines | Complexity |
|-------|-------|-----------|----------------|------------|
| 19a: Foundation | 4 | ~350 | ~20 | Medium |
| 19b: DOM Changes | 4 | ~250 | ~50 | High |
| 19c: Agent Integration | 5 | ~300 | ~150 | High |
| 19d: Prompt Updates | 2 | ~30 | ~40 | Low |
| 19e: CLI & Config | 2 | ~40 | ~30 | Low |
| 19f: Testing | 4 | ~500 | ~50 | Medium |

**Total:** ~1470 new lines, ~340 modified lines

---

## Part 13: Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Token overflow on huge pages | LLM truncation | Medium | Chunked serialization by category |
| Performance degradation | Slow analysis | Medium | Parallel DOM extraction, caching |
| Infinite scroll pages | Never completes | Low | maxPageHeight limit, scroll detection |
| Breaking backward compatibility | User complaints | Low | Keep llm_guided as option |
| DOM merger creates incorrect tree | Wrong analysis | Medium | Extensive testing with real sites |
| Memory issues with large DOM | Crash | Low | Streaming/chunked processing |

---

## Part 14: Success Criteria

| Metric | Current | Target | Validation |
|--------|---------|--------|------------|
| Coverage on 1-viewport page | ~90% | 100% | E2E test |
| Coverage on 3-viewport page | ~60% | 100% | E2E test |
| Coverage on 10-viewport page | ~25% | 100% | E2E test |
| Infinite scroll handling | None | Graceful limit | E2E test |
| Backward compatibility | N/A | 100% | Integration test |
| Performance overhead | N/A | <2x current | Benchmark |

---

## Part 15: Rollout Strategy

1. **Phase 1:** Implement behind feature flag (`--scan-mode=full_page`)
2. **Phase 2:** Beta testing on real sites
3. **Phase 3:** Make `full_page` the default
4. **Phase 4:** Deprecation warning for `llm_guided` as default

---

## Approval Checklist

Before implementation, confirm:

- [ ] Approach approved: Segment-based deterministic scan
- [ ] Coverage enforcement approved: Block `done` until threshold met
- [ ] Token strategy approved: Dynamic budget (32k for full_page)
- [ ] CLI changes approved: New `--scan-mode` flag
- [ ] Breaking change accepted: `full_page` becomes default
- [ ] Test coverage approved: Unit + Integration + E2E

---

## How to Use This Plan

In a new Claude Code session:

```
Read specs/001-browser-agent-core/coverage-fix-plan.md and implement Phase 19a
```

Or implement all phases:

```
Read specs/001-browser-agent-core/coverage-fix-plan.md and implement the full coverage fix
```
