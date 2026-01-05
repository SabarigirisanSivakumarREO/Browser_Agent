**Navigation**: [Index](./index.md) | [Previous](./phase-18.md) | [Next](./phase-20.md)
## Phase 19: 100% Page Coverage System

### Problem Statement

Current agent loop relies on LLM to decide when to scroll, leading to incomplete page coverage:

| Page Type | Estimated Coverage |
|-----------|-------------------|
| Simple landing (1 viewport) | ~90% |
| Medium landing (3 viewports) | ~60% |
| Long e-commerce (10+ viewports) | ~20-30% |
| Infinite scroll page | ~10% |

**Root Causes**:
1. LLM-dependent scrolling - may forget to scroll or call `done` prematurely
2. Token budget truncation - silently drops elements after 8000 tokens
3. Viewport-locked DOM extraction - elements below fold marked invisible
4. No scroll coverage tracking
5. Arbitrary maxSteps limit (10) insufficient for long pages
6. No coverage enforcement - `done` not blocked when coverage incomplete

### Solution Architecture

```
+---------------------------------------------------------------------+
|                      COVERAGE SYSTEM                                 |
+---------------------------------------------------------------------+
|  +---------------+    +---------------+    +---------------------+   |
|  |  Scan Mode    |    |  Coverage     |    |  Coverage           |   |
|  |  Selector     |--->|  Tracker      |--->|  Enforcer           |   |
|  |               |    |               |    |                     |   |
|  | * full_page   |    | * Segments    |    | * Block premature   |   |
|  | * above_fold  |    | * Elements    |    |   'done' calls      |   |
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
+---------------------------------------------------------------------+
```

### New Files

```
src/models/coverage-tracker.ts       # Coverage interfaces and types
src/agent/coverage-tracker.ts        # CoverageTracker class
src/browser/dom/dom-merger.ts        # Multi-segment DOM merging
```

### Modified Files

```
src/types/index.ts                   # Add ScanMode, CoverageConfig
src/agent/cro-agent.ts               # Full-page scan, coverage enforcement
src/agent/state-manager.ts           # Coverage state, termination override
src/agent/prompt-builder.ts          # Coverage section in prompts
src/browser/dom/serializer.ts        # Dynamic token budget
src/browser/dom/build-dom-tree.ts    # Absolute bounding box coordinates
src/prompts/system-cro.md            # Coverage awareness instructions
src/cli.ts                           # Scan mode flags
```

### Key Interfaces

#### Coverage Tracker Model (`src/models/coverage-tracker.ts`)

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
 * Coverage configuration
 */
export interface CoverageConfig {
  minCoveragePercent: number;     // Default: 100
  segmentOverlapPx: number;       // Default: 100
  requireAllSegments: boolean;    // Default: true
  requireElementAnalysis: boolean; // Default: true
}

export const DEFAULT_COVERAGE_CONFIG: CoverageConfig = {
  minCoveragePercent: 100,
  segmentOverlapPx: 100,
  requireAllSegments: true,
  requireElementAnalysis: true,
};
```

#### Scan Mode Type (`src/types/index.ts`)

```typescript
/**
 * Analysis scan modes
 */
export type ScanMode =
  | 'full_page'      // Deterministic: scan every segment (NEW DEFAULT)
  | 'above_fold'     // Quick: only initial viewport
  | 'llm_guided';    // Original: LLM decides scrolling

// Updated AnalyzeOptions
export interface AnalyzeOptions {
  browserConfig?: Partial<typeof DEFAULT_BROWSER_CONFIG>;
  registry?: ToolRegistry;
  verbose?: boolean;
  outputFormat?: OutputFormat;
  skipPostProcessing?: boolean;
  skipHeuristics?: boolean;
  // Phase 19 additions
  scanMode?: ScanMode;
  coverageConfig?: Partial<CoverageConfig>;
}
```

### CoverageTracker Class (`src/agent/coverage-tracker.ts`)

```typescript
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

  markSegmentScanned(scrollY: number, elementsFound: number): void { /* ... */ }
  recordElementDiscovered(xpath: string, croType: string | null, segment: number): void { /* ... */ }
  recordElementAnalyzed(xpath: string, toolName: string): void { /* ... */ }
  getCoveragePercent(): number { return this.state.coveragePercent; }
  isFullyCovered(): boolean { return this.state.coveragePercent >= this.config.minCoveragePercent; }
  getNextUnscannedSegment(): PageSegment | null { /* ... */ }
  getCoverageReport(): string { /* ... */ }
}
```

### DOMMerger Class (`src/browser/dom/dom-merger.ts`)

```typescript
export class DOMMerger {
  /**
   * Merge multiple DOM snapshots into single complete tree
   */
  merge(snapshots: DOMTree[]): DOMTree {
    if (snapshots.length === 0) throw new Error('No snapshots to merge');
    if (snapshots.length === 1) return snapshots[0];

    const base = this.deepClone(snapshots[0]);
    const seenXPaths = new Set<string>();
    this.collectXPaths(base.root, seenXPaths);

    for (let i = 1; i < snapshots.length; i++) {
      this.mergeSnapshot(base, snapshots[i], seenXPaths);
    }

    base.totalNodeCount = this.countNodes(base.root);
    base.croElementCount = this.countCROElements(base.root);
    base.interactiveCount = this.countInteractive(base.root);
    this.reindex(base.root);

    return base;
  }
}
```

### Coverage Enforcement Logic

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

### Dynamic maxSteps Calculation

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

### System Prompt Update (`src/prompts/system-cro.md`)

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

### CLI Updates (`src/cli.ts`)

```typescript
// New flags
const scanModeArg = args.find(a => a.startsWith('--scan-mode='));
const scanMode = scanModeArg
  ? scanModeArg.split('=')[1] as ScanMode
  : 'full_page';  // NEW DEFAULT

const minCoverageArg = args.find(a => a.startsWith('--min-coverage='));
const minCoverage = minCoverageArg
  ? parseInt(minCoverageArg.split('=')[1])
  : 100;

// Usage examples:
// npm run start -- https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy                         # full_page (default)
// npm run start -- --scan-mode=above_fold https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy  # quick scan
// npm run start -- --scan-mode=llm_guided https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy  # original behavior
// npm run start -- --min-coverage=80 https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy       # custom threshold
```

### Phase 19 Test Matrix

| Sub-Phase | Component | Unit Tests | Int Tests | E2E Tests | Total | Status |
|-----------|-----------|------------|-----------|-----------|-------|--------|
| 19a | CoverageTracker | 16 | - | - | 16 | ✅ Complete |
| 19b | DOMMerger | 7 | - | - | 7 | ✅ Complete |
| 19c-e | Agent Integration | 1 | - | - | 1 | ✅ Complete |
| 19f | Coverage Enforcement | - | 11 | 4 | 15 | ✅ Complete |
| **Total** | | **24** | **11** | **4** | **39** | ✅ Complete |

### Success Metrics

| Metric | Before Phase 19 | After Phase 19 |
|--------|-----------------|----------------|
| Coverage on 1-viewport page | ~90% | 100% |
| Coverage on 3-viewport page | ~60% | 100% |
| Coverage on 10-viewport page | ~25% | 100% |
| Backward compatibility | N/A | 100% (llm_guided mode) |

### Rollout Strategy

1. **Phase 1**: Implement behind `--scan-mode=full_page` flag
2. **Phase 2**: Beta testing on real sites
3. **Phase 3**: Make `full_page` the default
4. **Phase 4**: Deprecation notice for `llm_guided` as default

---

