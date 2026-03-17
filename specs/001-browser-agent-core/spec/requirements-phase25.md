# Phase 25 Requirements: Enhanced Extraction & Screenshot Analysis

**Phase**: 25
**Status**: Planned
**Created**: 2026-02-04
**Updated**: 2026-02-04
**Dependencies**: Phase 24 (Hybrid Detection), Phase 21j (Vision Analysis)

---

## Overview

Improve CRO analysis accuracy through enhanced DOM extraction, intelligent screenshot capture, and evidence packaging:

1. **25a: Dynamic Collection Steps** - Calculate max steps based on page height
2. **25b: Enhanced DOM Extraction** - Add PDP-specific element types (price, variant, stock, shipping, gallery)
3. **25c: Structured Data Extraction** - Extract JSON-LD Product schema
4. **25d: Above-Fold Annotation** - Annotate fold line on screenshots
5. **25e: Tiled Screenshot Mode** - Alternative screenshot mode for long pages
6. **25f: Deterministic Collection** - Skip LLM for collection phase
7. **25g: Evidence Mapping** - DOM↔Screenshot coordinate mapping with confidence scores
8. **25h: Quality Features** - Noise suppression, media readiness, metrics
9. **25i: Hybrid Collection** - Cheap validator + conditional LLM QA

**Root Cause**: Current analysis produces false positives (e.g., claiming price is "below fold" when visible) due to:
- Missing DOM elements (price not extracted)
- LLM confusion about "above the fold" meaning
- Hardcoded 10-step collection limit truncates long pages
- No evidence linking DOM elements to screenshot positions

---

## Problem Statement

### Problem 1: Hardcoded Collection Steps

Current code (`cro-agent.ts:1314`):
```typescript
const maxCollectionSteps = 10; // Limit collection phase steps
```

| Page Height | Viewports Needed | Max Steps | Problem |
|-------------|------------------|-----------|---------|
| 1500px | 3 | 10 | Wastes steps |
| 3000px | 5 | 10 | OK |
| 6000px | 10 | 10 | Barely enough |
| 10000px | 17 | 10 | **Truncates page** |

### Problem 2: Missing DOM Elements

Current CRO selectors (`cro-selectors.ts`) only capture 5 types:
- `cta`, `form`, `trust`, `value_prop`, `navigation`

Missing PDP-critical elements:
- `price` - No patterns for price elements
- `variant` - No patterns for size/color selectors
- `stock` - No patterns for availability status
- `shipping` - No patterns for delivery info
- `gallery` - No patterns for product images

**Result**: LLM receives incomplete DOM context, leading to incorrect observations.

### Problem 3: Above-Fold Confusion

LLM observation (Burberry PDP):
> "The price is displayed prominently, but it is not visible above the fold without scrolling."

This is false - price IS visible at scroll position 0px. The LLM doesn't understand:
- Viewport 0 = scroll position 0px = **above the fold**
- Viewport height (720px) = fold line

### Problem 4: No DOM↔Screenshot Evidence Link

Current system lacks:
- Stable node identifiers across extraction/serialization
- Bounding box mapping to screenshot coordinates
- Confidence scores for CRO classifications
- Structured evidence package for debugging/auditing

### Problem 5: Screenshot Quality Issues

Current issues:
- Cookie banners/modals obscure content
- Lazy-loaded images appear blank
- No quality validation before analysis
- Non-deterministic collection order

---

## Functional Requirements

### FR-390: Dynamic Collection Steps Calculation

The system SHALL calculate max collection steps based on page dimensions:

```typescript
function calculateMaxCollectionSteps(
  pageHeight: number,
  viewportHeight: number,
  overlapPx: number = 120
): number {
  const scrollStep = viewportHeight - overlapPx;
  const viewportsNeeded = Math.ceil(pageHeight / scrollStep);
  const stepsNeeded = (viewportsNeeded * 2) + 1;
  const buffer = Math.ceil(stepsNeeded * 0.2);
  return Math.max(5, stepsNeeded + buffer);
}
```

**Acceptance Criteria**:
- AC-390.1: Uses `stateManager.getPageHeight()` for calculation
- AC-390.2: Formula covers full page with buffer
- AC-390.3: Minimum 5 steps enforced
- AC-390.4: Logs dynamic step count

### FR-391: PDP-Specific DOM Selectors

The system SHALL add new CRO selector categories:

| Category | Patterns | Weight |
|----------|----------|--------|
| `price` | `.price`, `.cost`, `[data-price]`, `[itemprop="price"]`, currency regex | 0.6-0.95 |
| `variant` | `.swatch`, `.variant`, `.size-selector`, `.color-selector`, `[role="radiogroup"]` | 0.7-0.9 |
| `stock` | `.stock`, `.availability`, `.inventory`, "in stock\|out of stock" text | 0.8-0.9 |
| `shipping` | `.shipping`, `.delivery`, `.fulfillment`, "free shipping\|delivery" text | 0.7-0.9 |
| `gallery` | `.gallery`, `.product-image`, `.carousel`, `.thumbnail` | 0.7-0.9 |

**Acceptance Criteria**:
- AC-391.1: All 5 new categories added to `CRO_SELECTORS`
- AC-391.2: Currency symbol detection (₹, $, €, £, ¥)
- AC-391.3: Patterns tested against real e-commerce sites
- AC-391.4: Backward compatible (existing categories unchanged)

### FR-392: Structured Data Extraction

The system SHALL extract JSON-LD structured data alongside DOM:

```typescript
interface StructuredProductData {
  name?: string;
  price?: number;
  currency?: string;
  availability?: string;
  rating?: number;
  reviewCount?: number;
  brand?: string;
  sku?: string;
}

async function extractStructuredData(page: Page): Promise<StructuredProductData | null>;
```

**Acceptance Criteria**:
- AC-392.1: Extracts JSON-LD Product schema
- AC-392.2: Extracts price from `offers.price` or `offers.lowPrice`
- AC-392.3: Handles `@graph` arrays
- AC-392.4: Gracefully returns null for missing/malformed data

### FR-393: Above-Fold Annotation

The system SHALL annotate screenshots with fold line (DEFAULT ON):

```typescript
async function annotateFoldLine(
  screenshot: Buffer,
  viewportHeight: number
): Promise<Buffer>;
```

Output for first viewport:
```
┌─────────────────────────────────┐
│                                 │
│   Page content...               │
│                                 │
├─────────────────────────────────┤ ◄── Red dashed line at 720px
│ ▼ FOLD LINE - Below requires    │
│   scrolling                     │
└─────────────────────────────────┘
```

**Acceptance Criteria**:
- AC-393.1: Red dashed line at viewport height
- AC-393.2: Label text "FOLD LINE - Below requires scrolling"
- AC-393.3: Only on first tile/viewport
- AC-393.4: Uses sharp for SVG overlay

### FR-394: Tiled Full-Page Screenshot Mode

The system SHALL support alternative screenshot modes:

```bash
--screenshot-mode=viewport     # Current default (small viewport captures)
--screenshot-mode=tiled        # Full-width tiles (max 1800px each)
--screenshot-mode=hybrid       # Viewport for first 2, tiled for rest
```

**Tiled Mode Specifications**:
- Max tile height: 1800px (stays under GPT-4o 2048px limit)
- Tile overlap: 100px (catch elements at boundaries)
- Max tiles: 5 (cost control)
- First tile: Annotated with fold line

**Acceptance Criteria**:
- AC-394.1: Tiled mode captures full page in 1800px chunks
- AC-394.2: Overlap prevents missing boundary elements
- AC-394.3: First tile includes fold annotation
- AC-394.4: CLI flag `--screenshot-mode` works

### FR-395: Enhanced LLM Context

The system SHALL include structured data and CRO types in LLM context:

```
<structured_data>
Product: Slim Fit Stretch Cotton Shirt
Price: ₹47,000.00 (INR)
Availability: InStock
Rating: 4.5 (23 reviews)
</structured_data>

<dom_context>
--- Viewport 0 (scroll: 0px) - ABOVE FOLD ---
Elements: 44
  [0] [price:0.92] <span class="price">₹47,000.00</span>
  [1] [cta:0.88] <button>Add to Bag</button>
  ...
</dom_context>
```

**Acceptance Criteria**:
- AC-395.1: Structured data included when available
- AC-395.2: "ABOVE FOLD" label on viewport 0
- AC-395.3: CRO type + confidence shown in DOM (e.g., `[price:0.92]`)
- AC-395.4: Element index included for element tracking (viewportRef `[v0-5]` for cross-viewport identity)

### FR-396: Deterministic Collection (DEFAULT ON)

The system SHALL use deterministic collection by default:

```bash
# Default: deterministic collection
npm run start -- --vision https://example.com

# Opt-out to LLM-guided
npm run start -- --vision --llm-guided-collection https://example.com
```

Deterministic flow:
1. Calculate viewports from page height
2. Scroll to each position
3. Capture viewport (no LLM decision)
4. Repeat until done

**Acceptance Criteria**:
- AC-396.1: Deterministic is DEFAULT mode
- AC-396.2: Same viewports captured consistently
- AC-396.3: 0 LLM calls during collection phase
- AC-396.4: ~10x faster collection than LLM-guided

### FR-397: Element Identity System

The system SHALL use element `index` (per-viewport) for within-viewport lookups and `viewportRef` (`[v{viewportIndex}-{elementIndex}]`) for cross-viewport identity:

```typescript
interface DOMNode {
  // ... existing fields
  index?: number;           // Per-viewport element index (only for visible CRO elements)
  confidence?: number;      // CRO match confidence 0-1
  matchedPatterns?: string[]; // Which patterns matched
}

interface DOMTree {
  // ... existing fields
  elementLookup?: Record<string, NodeIndexEntry>; // Keyed by String(element.index)
}
```

> **Note**: The previous `nodeId` system (`n_001`, `n_002`) was removed because the counter reset per viewport extraction, causing ID collisions across viewports. The `viewportRef` format is globally unique and already used by LLM prompts, response parsing, and screenshot annotator.

**Acceptance Criteria**:
- AC-397.1: Every indexed element has a unique `index` within its viewport
- AC-397.2: `viewportRef` is globally unique across viewports (`[v0-5]`, `[v1-3]`)
- AC-397.3: `elementLookup` keyed by `String(element.index)` for O(1) lookups

### FR-398: Layout Box Mapping

The system SHALL compute bounding boxes for CRO elements:

```typescript
interface ElementBox {
  elementIndex: number;    // Required — matches DOM tree index
  x: number;
  y: number;
  w: number;
  h: number;
  scrollY: number;
  viewportIndex: number;
  confidence: number;
  isVisible: boolean;
  croType?: Exclude<CROType, null>;
}

async function computeLayoutBoxes(
  page: Page,
  elementIndices: number[],
  domTree: DOMTree,
  scrollY: number,
  viewportIndex: number,
  viewportHeight?: number
): Promise<ElementBox[]>;
```

**Acceptance Criteria**:
- AC-398.1: Uses `getBoundingClientRect()` for coordinates
- AC-398.2: Normalizes with scroll offset
- AC-398.3: Returns empty list safely if nodes not found
- AC-398.4: Caps elements per viewport (default: 20)

### FR-399: Confidence Aggregation

The system SHALL compute confidence scores for CRO matches:

```typescript
interface CROMatchResult {
  elementIndex: number;
  croType: CROType;
  confidence: number;        // 0-1, aggregated from patterns
  matchedPatterns: string[]; // Which patterns contributed
}
```

**Acceptance Criteria**:
- AC-399.1: Multiple pattern hits increase confidence
- AC-399.2: Confidence clamped 0-1
- AC-399.3: Conflicting categories resolved deterministically
- AC-399.4: matchedPatterns stored for debugging

### FR-400: Evidence Package Schema

The system SHALL produce a structured evidence package:

```typescript
interface EvidencePackage {
  url: string;
  runId: string;
  mode: 'viewport' | 'tiled' | 'hybrid';
  viewportHeight: number;
  pageHeight?: number;
  structuredData?: StructuredProductData | null;
  elements: Array<{
    index: number;              // Element index in DOM tree
    viewportRef: string;        // Primary cross-viewport ID: [v0-5]
    croType: Exclude<CROType, null>;
    confidence: number;
    tagName: string;
    text: string;
    boundingBox: { x: number; y: number; width: number; height: number };
    viewportIndices: number[];
    screenshotRefs: string[];
  }>;
  screenshots: Array<{
    id: string;
    kind: 'viewport' | 'tile';
    index: number;
    startY: number;
    endY: number;
    annotated: boolean;
    path: string;
  }>;
  metrics: Record<string, number>;
  warnings: string[];
}
```

**Acceptance Criteria**:
- AC-400.1: Stable JSON schema
- AC-400.2: Backward compatible (optional fields)
- AC-400.3: Supports pruning for prompt packaging
- AC-400.4: Written to `evidence.json` by default

### FR-401: UI Noise Suppression (DEFAULT ON)

The system SHALL suppress UI noise before screenshots:

```typescript
interface NoiseSuppression {
  cookieBanners: boolean;   // default: true
  chatWidgets: boolean;     // default: true
  stickyPromoBars: boolean; // default: true
  newsletterModals: boolean;// default: true
  interstitials: boolean;   // default: true
}

async function suppressUIElements(
  page: Page,
  config: NoiseSuppression
): Promise<string[]>; // Returns suppressed element descriptions
```

**Acceptance Criteria**:
- AC-401.1: Runs before first screenshot capture
- AC-401.2: Logs what was suppressed
- AC-401.3: Configurable per element type
- AC-401.4: Reapplies if overlays return after scroll
- AC-401.5: `--no-noise-suppression` flag to disable

### FR-402: Media Readiness Checks (DEFAULT ON)

The system SHALL wait for lazy-loaded images:

```typescript
interface MediaReadinessResult {
  ready: boolean;
  pendingImages: number;
  timedOut: boolean;
  waitedMs: number;
}

async function waitForMediaReadiness(
  page: Page,
  timeoutMs: number = 3000
): Promise<MediaReadinessResult>;
```

**Acceptance Criteria**:
- AC-402.1: Checks `img.complete && img.naturalWidth > 0`
- AC-402.2: Per-viewport readiness check
- AC-402.3: Timeout fallback with warning (default: 3s)
- AC-402.4: Extended timeout for rechecks (8-12s)
- AC-402.5: `--no-media-readiness` flag to disable

### FR-403: DOM Freeze Point

The system SHALL stabilize DOM before extraction:

```typescript
interface DOMFreezeConfig {
  settleMs: number;           // default: 500
  maxWaitMs: number;          // default: 2000
  disableAnimations: boolean; // default: true
}

async function freezeDOM(page: Page, config: DOMFreezeConfig): Promise<void>;
```

**Acceptance Criteria**:
- AC-403.1: Waits for `requestAnimationFrame` + settle time
- AC-403.2: Optionally disables CSS animations/transitions
- AC-403.3: Timeout prevents infinite wait
- AC-403.4: Reduces DOM drift between runs

### FR-404: Extraction Completeness Metrics

The system SHALL compute extraction quality metrics:

```typescript
interface ExtractionMetrics {
  detectedCounts: Record<CROType, number>;
  mappedBoxCoverage: number;      // 0-1
  screenshotCoverage: number;     // 0-1
  structuredDataPresence: number; // 0-1
  aboveFoldCoverage: number;      // 0-1 (priority elements in viewport 0)
  warningCount: number;
  extractionDurationMs: number;
}
```

**Acceptance Criteria**:
- AC-404.1: Produces numeric metrics
- AC-404.2: Included in `EvidencePackage.metrics`
- AC-404.3: Stable across runs
- AC-404.4: Used for quality assessment

### FR-405: Structured Data Reconciliation

The system SHALL compare structured data vs DOM:

```typescript
interface ReconciliationResult {
  matches: string[];
  mismatches: Array<{
    field: string;
    structuredValue: any;
    domValue: any;
    severity: 'warning' | 'error';
  }>;
  primaryPriceSource: 'structured' | 'dom';
}
```

**Acceptance Criteria**:
- AC-405.1: Compares price (with tolerance)
- AC-405.2: Compares availability
- AC-405.3: Adds warnings for mismatches
- AC-405.4: Precedence rules: structured > DOM (for price)

### FR-406: Cheap Validator Signals

The system SHALL collect validation signals during capture:

```typescript
interface ViewportValidatorSignals {
  viewportIndex: number;
  blankImageCount: number;
  placeholderImageCount: number;
  lazyPendingCount: number;
  spinnerDetected: boolean;
  skeletonDetected: boolean;
  textPlaceholders: string[];
  overlayStillVisible: boolean;
  mediaReadinessTimedOut: boolean;
}
```

**Acceptance Criteria**:
- AC-406.1: Signals collected during capture (0 LLM cost)
- AC-406.2: Detects common loading patterns
- AC-406.3: Used by cheap validator to gate LLM QA

### FR-407: Cheap Validator Gate

The system SHALL use deterministic validation before LLM QA:

```typescript
interface CheapValidationResult {
  passed: boolean;
  flags: string[];
  recheckIndices: number[];
}

function runCheapValidator(
  signals: ViewportValidatorSignals[]
): CheapValidationResult;
```

Flag thresholds:
- `blankImages > 2` → flag
- `spinnerDetected` → flag
- `skeletonDetected` → flag
- `overlayStillVisible` → flag
- `textPlaceholders.length > 0` → flag

**Acceptance Criteria**:
- AC-407.1: 0 LLM calls (pure heuristics)
- AC-407.2: If passed → skip LLM QA entirely
- AC-407.3: If failed → trigger LLM QA
- AC-407.4: ~90% of pages pass (no LLM needed)

### FR-408: Conditional LLM QA

The system SHALL run LLM QA only when cheap validator flags issues:

```typescript
interface LLMQAResult {
  valid: boolean;
  recheck: Array<{
    index: number;
    reason: string;
    hint: 'wait_longer' | 'scroll_adjust' | 'retry_noise' | 'skip';
  }>;
  notes?: string;
}

async function runLLMQA(
  summaries: ViewportSummary[],
  flags: string[],
  thumbnails: Buffer[]  // 480px wide, max 6
): Promise<LLMQAResult>;
```

**Acceptance Criteria**:
- AC-408.1: Single LLM call for all viewports
- AC-408.2: Uses thumbnails (not full screenshots)
- AC-408.3: Returns recheck indices with hints
- AC-408.4: `--skip-collection-qa` flag to disable

### FR-409: Targeted Recheck

The system SHALL recheck flagged viewports with extended waits:

```typescript
async function recheckViewports(
  page: Page,
  indices: number[],
  hints: string[],
  extendedTimeoutMs: number = 10000
): Promise<ViewportSnapshot[]>;
```

**Acceptance Criteria**:
- AC-409.1: Only rechecks flagged indices
- AC-409.2: Uses extended media readiness (8-12s)
- AC-409.3: Patches results into snapshot array
- AC-409.4: Max 2 recheck attempts per viewport

### FR-410: Run ID and Deterministic Ordering

The system SHALL ensure reproducible outputs:

```typescript
interface RunContext {
  runId: string;           // timestamp + hash
  startedAt: number;
  deterministicSeed: number;
}
```

**Acceptance Criteria**:
- AC-410.1: runId included in logs and evidence
- AC-410.2: Element ordering stable across identical inputs
- AC-410.3: No random ordering in outputs
- AC-410.4: Same URL produces same viewport count

### FR-411: Reasoning Display in CLI Output

The system SHALL display reasoning for each heuristic evaluation in CLI output:

```
┌─ FAILED HEURISTICS ──────────────────────────────────────────────────
│
│ 🟡 [PDP-SPEC-002] LOW (60% confidence)
│   Principle: Terminology should be explained...
│   Observation: Technical terms are present but not explained.
│   Issue: There are no tooltips or explanations...
│   Recommendation: Include brief explanations or tooltips...
│   Reasoning: Searched DOM for tooltip elements ([data-tooltip], .tooltip) -
│              none found. Found technical terms in [v0-15] "100% British Wool"
│              without explanation text nearby.
└───────────────────────────────────────────────────────────────────────────
```

**Acceptance Criteria**:
- AC-411.1: `reasoning` field displayed in CLI for failed heuristics
- AC-411.2: `reasoning` field displayed in CLI for partial heuristics
- AC-411.3: Reasoning explains HOW the LLM found the evidence (DOM refs, classes, screenshot observations)
- AC-411.4: Reasoning uses `[v{viewport}-{index}]` format for element references

---

## Configuration Requirements

### CR-045: Phase 25 Configuration

```typescript
interface Phase25Config {
  // Collection mode
  collectionMode: 'deterministic' | 'llm_guided' | 'hybrid';  // default: 'hybrid'

  // Screenshot mode
  screenshotMode: 'viewport' | 'tiled' | 'hybrid';  // default: 'viewport'
  maxTileHeight: number;       // default: 1800
  tileOverlapPx: number;       // default: 100

  // Evidence features (ALL DEFAULT ON)
  enableNodeId: boolean;           // default: true
  enableConfidence: boolean;       // default: true
  enableLayoutMapping: boolean;    // default: true
  writeEvidenceJson: boolean;      // default: true
  annotateFoldLine: boolean;       // default: true

  // Quality features (ALL DEFAULT ON)
  enableNoiseSuppression: boolean; // default: true
  enableMediaReadiness: boolean;   // default: true
  enableCollectionValidation: boolean; // default: true
  includeStructuredData: boolean;  // default: true

  // Timeouts
  freezeTimeoutMs: number;         // default: 2000
  mediaReadinessTimeoutMs: number; // default: 3000
  extendedReadinessTimeoutMs: number; // default: 10000
  maxRecheckAttempts: number;      // default: 2

  // Limits
  maxElementsPerViewport: number;  // default: 20
  maxThumbnailsForQA: number;      // default: 6
  thumbnailWidth: number;          // default: 480
}
```

---

## Success Criteria

### SC-162: Burberry Price Detection
Given URL `https://in.burberry.com/slim-fit-stretch-cotton-shirt-p80718001`
When DOM extraction runs
Then price element "₹47,000.00" SHALL be captured with `croType: 'price'`
And price SHALL appear in LLM context with confidence ≥ 0.8

### SC-163: Long Page Coverage
Given a page with height 10000px
When collection phase runs
Then maxCollectionSteps SHALL be ≥ 35
And all page content SHALL be captured

### SC-164: Above-Fold Clarity
Given viewport 0 screenshot
When fold annotation is enabled
Then screenshot SHALL have visible fold line at 720px
And LLM SHALL correctly identify above/below fold elements

### SC-165: Deterministic Speed
Given deterministic collection enabled
When analyzing a 5-viewport page
Then collection phase SHALL complete in < 10 seconds
And 0 LLM calls SHALL be made during collection (unless QA triggered)

### SC-166: Evidence Package Complete
Given a PDP analysis run
When evidence.json is written
Then it SHALL contain viewportRef for all CRO elements
And it SHALL contain bounding boxes for mapped elements
And it SHALL contain confidence scores

### SC-167: Noise Suppression Effective
Given a page with cookie banner
When noise suppression runs
Then banner SHALL be hidden in screenshots
And suppression SHALL be logged in warnings

### SC-168: Cheap Validator Gate
Given a clean page (no loading issues)
When cheap validator runs
Then it SHALL pass (no flags)
And LLM QA SHALL be skipped
And total LLM calls for collection SHALL be 0

### SC-169: Hybrid Collection Quality
Given a page with lazy-loaded images
When hybrid collection runs
Then cheap validator SHALL flag blank images
And LLM QA SHALL run (single call)
And recheck SHALL load images successfully

---

## Test Requirements

### Unit Tests (40 tests)

**Dynamic Steps (4 tests)**
- Calculation formula correctness
- Minimum 5 steps enforced
- Buffer calculation
- Edge cases (short pages)

**DOM Selectors (8 tests)**
- Price detection patterns
- Variant detection patterns
- Stock/shipping/gallery patterns
- Currency regex matching
- Multiple matches scoring
- No false positives

**Structured Data (4 tests)**
- JSON-LD Product extraction
- @graph array handling
- Missing data returns null
- Malformed JSON handling

**Fold Annotation (4 tests)**
- Line drawn at correct position
- Label text correct
- SVG overlay works
- First tile only

**Confidence Aggregation (4 tests)**
- Multiple hits increase confidence
- Conflicts resolve deterministically
- Clamps 0-1
- matchedPatterns tracked

**Layout Mapping (4 tests)**
- Boxes normalized with scrollY
- Viewport indices correct
- Handles missing nodes
- isVisible computed

**Evidence Schema (4 tests)**
- EvidencePackage minimal valid
- Optional fields behave
- Ordering deterministic
- Serialization stable

**Cheap Validator (4 tests)**
- Detects blank images
- Detects spinners/skeletons
- Detects overlays
- Passes clean pages

**Noise Suppression (4 tests)**
- Suppresses cookie banners
- Suppresses chat widgets
- Doesn't suppress main content
- Logs actions

### Integration Tests (20 tests)

- Dynamic steps with real page heights
- Price extraction on Burberry
- Variant extraction on PDP
- Tiled screenshot capture
- Fold annotation on tiled mode
- Deterministic collection flow
- Structured data in LLM context
- Full pipeline with new selectors
- CLI flags work correctly
- Evidence.json output created
- DOM↔Screenshot mapping produces boxes
- Tiled mapping attaches correct refs
- Hybrid mode + readiness
- Noise suppression on real site
- Cheap validator passes → no LLM
- Cheap validator fails → LLM QA runs
- Recheck with extended waits
- Reconciliation warnings
- Metrics computation
- Performance benchmarks

### E2E Tests (15 tests)

- Burberry PDP price visible in DOM
- Long page (10000px) fully captured
- Tiled mode produces correct output
- Deterministic mode speed improvement
- Above-fold accuracy improved
- Evidence mapping on real PDP
- Cookie banner suppressed
- Reproducibility check (same run twice)
- Hybrid collection catches lazy images
- Full quality pipeline end-to-end
- Opt-out flags work correctly
- LLM-guided collection still works
- Metrics in evidence.json accurate
- Warnings for reconciliation mismatches
- Run ID consistent in outputs

**Total**: 75 tests

---

## Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| sharp | ^0.33.x | Fold line annotation, thumbnails (already installed) |
| playwright | ^1.x | DOM extraction (already installed) |

---

## Migration Notes

- **DEFAULT ON**: All new features enabled by default
- **Opt-out Available**: Each feature has opt-out flag
- **Backward Compatible**: Existing API preserved
- **No Breaking Changes**: All additions are optional fields
- **Performance**: Hybrid collection faster than pure LLM-guided

---

## Element Mapping Quality Fix

**Status**: ✅ COMPLETE (2026-02-12)
**Dependencies**: Phase 25g (evidence mapping), Phase 21i (coordinate mapper)

### FR-430: Element Position Context in LLM Prompts
- **SHALL** include `<element_positions>` block after serialized DOM in each viewport section
- **SHALL** format as `[v{viewport}-{index}] {tagName} "{text}" → x:{x} y:{y} w:{width} h:{height}`
- **SHALL** only include elements from `ViewportSnapshot.visibleElements`
- **SHALL** truncate element text to 40 characters
- **SHALL** round coordinates to integers

### FR-431: Element Position Context in Batched Prompts
- **SHALL** include same `<element_positions>` block in `batch-prompt-builder.ts` shared DOM context
- **SHALL** use `buildElementPositionsBlock()` exported from `category-analyzer.ts`

### FR-432: Auto-populate domElementRefs from LLM Text
- **SHALL** parse `[v{viewport}-{index}]` patterns from evaluation text fields (observation, issue, recommendation, reasoning)
- **SHALL** populate `domElementRefs` array on each `HeuristicEvaluation` with matched refs
- **SHALL** look up element details (tagName, text, xpath) from viewport snapshot element mappings
- **SHALL** set `viewportIndex` on evaluation from first referenced element (if not already set)
- **SHALL** use `'unknown'` as elementType when element not found in snapshot lookup

### FR-433: Integration with Evidence Annotation
- **SHALL** call `populateElementRefs()` in `CategoryAnalyzer.analyzeCategory()` after LLM response parsing
- **SHALL** call `populateElementRefs()` in `AnalysisOrchestrator.runBatchedAnalysis()` after batch response parsing
- **SHALL** enable `ScreenshotAnnotator.getElementStatus()` to match elements via populated `domElementRefs`
