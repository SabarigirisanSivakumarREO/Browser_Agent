# Phase 25: Enhanced Extraction & Screenshot Analysis

**Status**: Planned
**Tasks**: T473-T548 (76 tasks)
**Tests**: 75 (40 unit + 20 integration + 15 E2E)
**Dependencies**: Phase 24 (Hybrid Detection)

> **REVISION (2026-02-18)**: The `nodeId` system (`n_001`, `n_002`, `generateNodeId()`) from Phase 25g was **removed** in a later refactor. The counter reset per viewport extraction, causing ID collisions. The codebase now uses:
> - `element.index` (per-viewport) for within-viewport lookups
> - `viewportRef` (`[v0-5]`) for cross-viewport identity (globally unique)
> - `DOMTree.elementLookup` (keyed by `String(element.index)`) replaces `DOMTree.nodeIndex`
> - `ElementBox.elementIndex` (required) replaces `ElementBox.nodeId`
> - Functions renamed: `getNodeIdsByCROType` → `getElementIndicesByCROType`, `collectAllNodeIds` → `collectAllElementIndices`
> - Evidence dedup uses absolute page coordinates instead of `nodeId`

---

## Overview

Improve CRO analysis accuracy through:
1. **25a**: Dynamic Collection Steps (T473-T476) - 4 tasks
2. **25b**: Enhanced DOM Selectors (T477-T484) - 8 tasks
3. **25c**: Structured Data Extraction (T485-T488) - 4 tasks
4. **25d**: Above-Fold Annotation (T489-T492) - 4 tasks
5. **25e**: Tiled Screenshot Mode (T493-T498) - 6 tasks
6. **25f**: Deterministic Collection (T499-T502) - 4 tasks
7. **25g**: Evidence Mapping + Confidence + Packaging (T503-T520) - 18 tasks
8. **25h**: Determinism + Noise + Lazy-load + Metrics (T521-T534) - 14 tasks
9. **25i**: Hybrid Collection (Cheap Validator + LLM QA) (T535-T548) - 14 tasks

---

## Architecture

### Complete Pipeline Flow

```
Page Load
   ↓
DOM Freeze (once)                          ← 2s timeout, disable animations
   ↓
Noise Suppression (once; reapply if needed) ← cookie/modal/chat removal
   ↓
DOM Extraction + nodeId (once)             ← stable IDs for run
   ↓
CRO Matching + Confidence (once)           ← identify targets upfront
   ↓
Structured Data Extract (once)             ← JSON-LD Product schema

═══════════ PHASE 1: Deterministic Collection ═══════════
│  For each viewport index (0..N):                      │
│    → Scroll to position                               │
│    → Media Readiness (≤3s)                            │
│    → Capture screenshot + DOM snapshot                │
│    → Layout map (top 20 CRO elements)                 │
│    → Store cheap validator signals:                   │
│        • blankImageCount                              │
│        • spinnerDetected                              │
│        • skeletonDetected                             │
│        • overlayStillVisible                          │
│        • textPlaceholderCount                         │
│  Result: ViewportSnapshot[] + ValidatorSignals[]      │
═════════════════════════════════════════════════════════
   ↓
Cheap Validator (deterministic, 0 LLM calls):
   ├─ Check signals across all viewports
   ├─ Flag threshold: blankImages > 2 OR spinners OR overlay
   └─ If NO FLAGS → skip LLM QA entirely ✅
   ↓
═══════════ PHASE 2: LLM QA (conditional, single call) ═══════════
│  Only runs if cheap validator flagged issues                    │
│  Input:                                                         │
│    • Summary metrics (element counts, CRO coverage)             │
│    • Validator flags (what triggered QA)                        │
│    • 3-6 thumbnails (resized to 480px wide)                     │
│  Output:                                                        │
│    • { valid: true } → proceed                                  │
│    • { recheck: [2, 4], hints: ["wait_longer"] }                │
══════════════════════════════════════════════════════════════════
   ↓
If recheck needed:
   For each flagged viewport index:
     → Scroll to position
     → Extended Media Readiness (≤8-12s)
     → Recapture screenshot
     → Remap layout boxes
     → Patch into snapshot array
   ↓
Reconciliation (structured ↔ DOM):
   → Compare JSON-LD price vs DOM price
   → Flag mismatches as warnings
   ↓
Evidence Packaging + Metrics
   ↓
Output:
   • evidence.json (full package)
   • screenshots/ (annotated PNGs)
   • report (insights + hypotheses)
```

### Module Structure

```
src/
├── agent/
│   └── cro-agent.ts              # MODIFY: Dynamic steps, hybrid collection
├── browser/
│   ├── dom/
│   │   ├── cro-selectors.ts      # MODIFY: Add 5 new categories + confidence
│   │   ├── structured-data.ts    # CREATE: JSON-LD extraction
│   │   ├── extractor.ts          # MODIFY: nodeId, freeze point
│   │   └── serializer.ts         # MODIFY: confidence + nodeId format
│   ├── layout/
│   │   └── layout-mapper.ts      # CREATE: Bounding box computation
│   ├── cleanup/
│   │   └── ui-noise.ts           # CREATE: Noise suppression
│   └── media/
│       └── media-readiness.ts    # CREATE: Lazy-load checks
├── heuristics/
│   └── category-analyzer.ts      # MODIFY: Enhanced LLM context
├── output/
│   ├── screenshot-annotator.ts   # MODIFY: Fold line annotation
│   ├── tiled-screenshot.ts       # CREATE: Tiled capture mode
│   ├── evidence-packager.ts      # CREATE: Evidence packaging
│   └── extraction-metrics.ts     # CREATE: Metrics computation
├── validation/
│   ├── cheap-validator.ts        # CREATE: Deterministic validation
│   ├── collection-qa.ts          # CREATE: LLM QA logic
│   └── reconciliation.ts         # CREATE: Structured ↔ DOM comparison
├── types/
│   ├── index.ts                  # MODIFY: New config types
│   └── evidence-schema.ts        # CREATE: Evidence package schema
└── cli.ts                        # MODIFY: New CLI flags
```

---

## Phase 25a: Dynamic Collection Steps (T473-T476)

Calculate max steps based on page height instead of hardcoded 10.

### Formula

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

### Example Calculations

| Page Height | Viewports | Steps Needed | With Buffer | Current |
|-------------|-----------|--------------|-------------|---------|
| 1500px | 3 | 7 | 9 | 10 |
| 3000px | 5 | 11 | 14 | 10 |
| 6000px | 10 | 21 | 26 | 10 ❌ |
| 10000px | 17 | 35 | 42 | 10 ❌ |

---

## Phase 25b: Enhanced DOM Selectors (T477-T484)

Add 5 new CRO element categories for PDP analysis.

### New Categories

```typescript
// src/browser/dom/cro-selectors.ts

export const CRO_SELECTORS: CROSelectorConfig = {
  // ... existing categories ...

  price: [
    { type: 'class', pattern: 'price', weight: 0.9 },
    { type: 'class', pattern: 'cost', weight: 0.8 },
    { type: 'class', pattern: 'product-price', weight: 0.9 },
    { type: 'attr', pattern: 'data-price', weight: 0.95 },
    { type: 'attr', pattern: 'itemprop="price"', weight: 0.95 },
    { type: 'text', pattern: '₹|\\$|€|£|¥|USD|INR|EUR|GBP', weight: 0.6 },
  ],

  variant: [
    { type: 'class', pattern: 'swatch', weight: 0.9 },
    { type: 'class', pattern: 'variant', weight: 0.85 },
    { type: 'class', pattern: 'size-selector', weight: 0.9 },
    { type: 'class', pattern: 'color-selector', weight: 0.9 },
    { type: 'role', pattern: 'radiogroup', weight: 0.7 },
  ],

  stock: [
    { type: 'class', pattern: 'stock', weight: 0.9 },
    { type: 'class', pattern: 'availability', weight: 0.85 },
    { type: 'text', pattern: 'in stock|out of stock|sold out', weight: 0.8 },
  ],

  shipping: [
    { type: 'class', pattern: 'shipping', weight: 0.9 },
    { type: 'class', pattern: 'delivery', weight: 0.85 },
    { type: 'text', pattern: 'free shipping|free delivery|ships', weight: 0.7 },
  ],

  gallery: [
    { type: 'class', pattern: 'gallery', weight: 0.9 },
    { type: 'class', pattern: 'product-image', weight: 0.85 },
    { type: 'class', pattern: 'carousel', weight: 0.7 },
    { type: 'class', pattern: 'thumbnail', weight: 0.8 },
  ],
};
```

---

## Phase 25c: Structured Data Extraction (T485-T488)

Extract JSON-LD Product schema for ground truth data.

### Implementation

```typescript
// src/browser/dom/structured-data.ts

export interface StructuredProductData {
  name?: string;
  price?: number;
  currency?: string;
  availability?: string;
  rating?: number;
  reviewCount?: number;
  brand?: string;
  sku?: string;
  image?: string;
}

export async function extractStructuredData(page: Page): Promise<StructuredProductData | null> {
  return page.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || '');
        const product = findProduct(data);
        if (product) {
          const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
          return {
            name: product.name,
            price: offer?.price ?? offer?.lowPrice,
            currency: offer?.priceCurrency,
            availability: offer?.availability,
            rating: product.aggregateRating?.ratingValue,
            reviewCount: product.aggregateRating?.reviewCount,
            brand: product.brand?.name ?? product.brand,
            sku: product.sku,
            image: Array.isArray(product.image) ? product.image[0] : product.image,
          };
        }
      } catch { /* ignore malformed */ }
    }
    return null;
  });
}
```

---

## Phase 25d: Above-Fold Annotation (T489-T492)

Annotate screenshots with visible fold line.

### Implementation

```typescript
// src/output/screenshot-annotator.ts (extend existing)

export async function annotateFoldLine(
  screenshot: Buffer,
  viewportHeight: number
): Promise<Buffer> {
  const metadata = await sharp(screenshot).metadata();
  const width = metadata.width || 1280;

  const svg = Buffer.from(`
    <svg width="${width}" height="${viewportHeight + 30}">
      <line x1="0" y1="${viewportHeight}" x2="${width}" y2="${viewportHeight}"
            stroke="#FF0000" stroke-width="2" stroke-dasharray="10,5"/>
      <rect x="5" y="${viewportHeight - 20}" width="300" height="18" fill="#FF0000" rx="2"/>
      <text x="10" y="${viewportHeight - 6}" fill="white" font-family="Arial" font-size="12">
        ▼ FOLD LINE (${viewportHeight}px) - Below requires scrolling
      </text>
    </svg>
  `);

  return sharp(screenshot)
    .composite([{ input: svg, top: 0, left: 0 }])
    .toBuffer();
}
```

---

## Phase 25e: Tiled Screenshot Mode (T493-T498)

Alternative full-page screenshot capture in tiles.

### Configuration

```typescript
interface TiledScreenshotConfig {
  maxTileHeight: number;       // default: 1800
  overlapPx: number;           // default: 100
  maxTiles: number;            // default: 5
  annotateFoldLine: boolean;   // default: true
}
```

### Implementation

```typescript
// src/output/tiled-screenshot.ts

export interface ScreenshotTile {
  index: number;
  startY: number;
  endY: number;
  buffer: Buffer;
  isAboveFold: boolean;
}

export async function captureTiledScreenshots(
  page: Page,
  config: TiledScreenshotConfig
): Promise<ScreenshotTile[]> {
  // Implementation captures full page in chunks
}
```

---

## Phase 25f: Deterministic Collection (T499-T502)

Skip LLM for collection phase - pure programmatic scrolling.

### Implementation

```typescript
// src/agent/cro-agent.ts

private async runDeterministicCollection(
  page: Page,
  pageHeight: number,
  viewportHeight: number
): Promise<ViewportSnapshot[]> {
  const snapshots: ViewportSnapshot[] = [];
  const scrollStep = viewportHeight - 120;
  const viewportCount = Math.ceil(pageHeight / scrollStep);

  for (let i = 0; i < viewportCount; i++) {
    const scrollY = i * scrollStep;
    await page.evaluate(`window.scrollTo(0, ${scrollY})`);
    await this.sleep(200);
    const snapshot = await this.captureViewportSnapshot(page, i, scrollY);
    snapshots.push(snapshot);
  }

  return snapshots;
}
```

---

## Phase 25g: Evidence Mapping + Confidence + Packaging (T503-T520)

### Stable Node IDs (T503-T504)

```typescript
// Each node gets stable nodeId during extraction
interface DOMNode {
  // ... existing fields
  nodeId: string;              // "n_001", "n_002", etc.
  confidence?: number;         // CRO match confidence 0-1
  matchedPatterns?: string[];  // Which patterns matched
}
```

### Layout Mapper (T505-T506)

```typescript
// src/browser/layout/layout-mapper.ts

export interface ElementBox {
  nodeId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  scrollY: number;
  viewportIndex: number;
  confidence: number;
  isVisible: boolean;
}

export async function computeLayoutBoxes(
  page: Page,
  nodeIds: string[],
  scrollY: number,
  viewportIndex: number
): Promise<ElementBox[]> {
  return page.evaluate(({ nodeIds, scrollY, viewportIndex }) => {
    const boxes: ElementBox[] = [];
    for (const nodeId of nodeIds) {
      const el = document.querySelector(`[data-node-id="${nodeId}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        boxes.push({
          nodeId,
          x: rect.x,
          y: rect.y + scrollY,
          w: rect.width,
          h: rect.height,
          scrollY,
          viewportIndex,
          confidence: parseFloat(el.dataset.confidence || '0'),
          isVisible: rect.width > 0 && rect.height > 0,
        });
      }
    }
    return boxes;
  }, { nodeIds, scrollY, viewportIndex });
}
```

### Confidence Aggregation (T507)

```typescript
// src/browser/dom/cro-selectors.ts

export function aggregateConfidence(
  matches: Array<{ pattern: string; weight: number }>
): { confidence: number; matchedPatterns: string[] } {
  if (matches.length === 0) return { confidence: 0, matchedPatterns: [] };

  // Combine weights: 1 - product of (1 - weight)
  const combined = 1 - matches.reduce((acc, m) => acc * (1 - m.weight), 1);

  return {
    confidence: Math.min(1, combined),
    matchedPatterns: matches.map(m => m.pattern),
  };
}
```

### Evidence Schema (T509)

```typescript
// src/types/evidence-schema.ts

export interface EvidencePackage {
  url: string;
  runId: string;
  mode: 'viewport' | 'tiled' | 'hybrid';
  viewportHeight: number;
  pageHeight?: number;
  structuredData?: StructuredProductData | null;
  elements: Array<{
    nodeId: string;
    croTypes: Array<{ type: string; confidence: number }>;
    textSnippet?: string;
    boxes?: ElementBox[];
    screenshotRefs?: string[];
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

### Evidence Packager (T510)

```typescript
// src/output/evidence-packager.ts

export function buildEvidencePackage(
  url: string,
  runId: string,
  snapshots: ViewportSnapshot[],
  structuredData: StructuredProductData | null,
  boxes: ElementBox[],
  metrics: ExtractionMetrics,
  warnings: string[]
): EvidencePackage {
  // Build and return evidence package
}
```

---

## Phase 25h: Determinism + Noise + Lazy-load + Metrics (T521-T534)

### Run ID (T521)

```typescript
interface RunContext {
  runId: string;  // `${Date.now()}_${hash(url).slice(0, 8)}`
  startedAt: number;
  deterministicSeed: number;
}
```

### DOM Freeze (T522)

```typescript
// src/browser/dom/extractor.ts

async function freezeDOM(page: Page, config: DOMFreezeConfig): Promise<void> {
  // Wait for RAF + settle
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => setTimeout(r, 500))));

  // Optionally disable animations
  if (config.disableAnimations) {
    await page.addStyleTag({
      content: '*, *::before, *::after { animation: none !important; transition: none !important; }'
    });
  }
}
```

### UI Noise Suppression (T523-T524)

```typescript
// src/browser/cleanup/ui-noise.ts

const NOISE_SELECTORS = [
  // Cookie banners
  '[class*="cookie"]', '[id*="cookie"]', '[class*="consent"]',
  // Chat widgets
  '[class*="chat-widget"]', '[id*="intercom"]', '[class*="drift"]',
  // Modals
  '[class*="modal"][class*="newsletter"]', '[class*="popup"]',
  // Sticky bars
  '[class*="sticky-bar"]', '[class*="promo-bar"]',
];

export async function suppressUIElements(
  page: Page,
  config: NoiseSuppression
): Promise<string[]> {
  const suppressed: string[] = [];

  for (const selector of NOISE_SELECTORS) {
    const elements = await page.$$(selector);
    for (const el of elements) {
      await el.evaluate(e => e.style.display = 'none');
      suppressed.push(selector);
    }
  }

  return suppressed;
}
```

### Media Readiness (T525-T527)

```typescript
// src/browser/media/media-readiness.ts

export async function waitForMediaReadiness(
  page: Page,
  timeoutMs: number = 3000
): Promise<MediaReadinessResult> {
  const startTime = Date.now();

  const result = await page.evaluate((timeout) => {
    return new Promise<{ ready: boolean; pending: number }>((resolve) => {
      const checkImages = () => {
        const images = document.querySelectorAll('img');
        const pending = Array.from(images).filter(
          img => !img.complete || img.naturalWidth === 0
        ).length;

        if (pending === 0 || Date.now() - startTime > timeout) {
          resolve({ ready: pending === 0, pending });
        } else {
          setTimeout(checkImages, 100);
        }
      };
      checkImages();
    });
  }, timeoutMs);

  return {
    ready: result.ready,
    pendingImages: result.pending,
    timedOut: !result.ready,
    waitedMs: Date.now() - startTime,
  };
}
```

### Reconciliation (T529)

```typescript
// src/validation/reconciliation.ts

export function reconcileStructuredVsDOM(
  structured: StructuredProductData | null,
  domPrices: Array<{ nodeId: string; value: string }>
): ReconciliationResult {
  const mismatches: Mismatch[] = [];

  if (structured?.price && domPrices.length > 0) {
    const domPrice = parsePrice(domPrices[0].value);
    if (Math.abs(structured.price - domPrice) > 0.01) {
      mismatches.push({
        field: 'price',
        structuredValue: structured.price,
        domValue: domPrice,
        severity: 'warning',
      });
    }
  }

  return {
    matches: [],
    mismatches,
    primaryPriceSource: structured?.price ? 'structured' : 'dom',
  };
}
```

### Extraction Metrics (T530)

```typescript
// src/output/extraction-metrics.ts

export function computeExtractionMetrics(
  elements: CROElement[],
  boxes: ElementBox[],
  screenshots: Screenshot[],
  structuredData: StructuredProductData | null,
  warnings: string[],
  durationMs: number
): ExtractionMetrics {
  const counts: Record<CROType, number> = {};
  for (const el of elements) {
    counts[el.croType] = (counts[el.croType] || 0) + 1;
  }

  const aboveFoldElements = boxes.filter(b => b.viewportIndex === 0);
  const priorityTypes = ['price', 'cta', 'variant'];
  const priorityAboveFold = aboveFoldElements.filter(
    b => priorityTypes.includes(elements.find(e => e.nodeId === b.nodeId)?.croType || '')
  );

  return {
    detectedCounts: counts,
    mappedBoxCoverage: boxes.length / Math.max(elements.length, 1),
    screenshotCoverage: screenshots.length > 0 ? 1 : 0,
    structuredDataPresence: structuredData ? 1 : 0,
    aboveFoldCoverage: priorityAboveFold.length / Math.max(priorityTypes.length, 1),
    warningCount: warnings.length,
    extractionDurationMs: durationMs,
  };
}
```

---

## Phase 25i: Hybrid Collection (T535-T548)

### Validator Signals (T535-T536)

```typescript
// Collected during capture (0 LLM cost)
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

### Cheap Validator (T537-T538)

```typescript
// src/validation/cheap-validator.ts

export function runCheapValidator(
  signals: ViewportValidatorSignals[]
): CheapValidationResult {
  const flags: string[] = [];
  const recheckIndices: number[] = [];

  for (const s of signals) {
    const issues: string[] = [];

    if (s.blankImageCount > 2) issues.push('blank_images');
    if (s.lazyPendingCount > 3) issues.push('lazy_pending');
    if (s.spinnerDetected) issues.push('spinner');
    if (s.skeletonDetected) issues.push('skeleton');
    if (s.textPlaceholders.length > 0) issues.push('text_placeholder');
    if (s.overlayStillVisible) issues.push('overlay');

    if (issues.length > 0) {
      flags.push(`viewport_${s.viewportIndex}: ${issues.join(', ')}`);
      recheckIndices.push(s.viewportIndex);
    }
  }

  return { passed: flags.length === 0, flags, recheckIndices };
}
```

### LLM QA (T539-T541)

```typescript
// src/validation/collection-qa.ts

export async function runLLMQA(
  summaries: ViewportSummary[],
  flags: string[],
  thumbnails: Buffer[]
): Promise<LLMQAResult> {
  const prompt = buildQAPrompt(summaries, flags);

  // Single LLM call with thumbnails
  const response = await llm.invoke({
    messages: [{ role: 'user', content: prompt }],
    images: thumbnails.slice(0, 6).map(t => t.toString('base64')),
  });

  return parseQAResponse(response);
}
```

### Recheck Logic (T541-T542)

```typescript
// src/agent/cro-agent.ts

async function recheckViewports(
  page: Page,
  indices: number[],
  hints: string[],
  extendedTimeoutMs: number = 10000
): Promise<ViewportSnapshot[]> {
  const rechecked: ViewportSnapshot[] = [];

  for (let i = 0; i < indices.length; i++) {
    const index = indices[i];
    const hint = hints[i];

    // Scroll to position
    const scrollY = index * (720 - 120);
    await page.evaluate(`window.scrollTo(0, ${scrollY})`);

    // Extended wait based on hint
    if (hint === 'wait_longer') {
      await waitForMediaReadiness(page, extendedTimeoutMs);
    } else if (hint === 'retry_noise') {
      await suppressUIElements(page, DEFAULT_NOISE_CONFIG);
    }

    // Recapture
    const snapshot = await captureViewportSnapshot(page, index, scrollY);
    rechecked.push(snapshot);
  }

  return rechecked;
}
```

---

## File Changes Summary

| File | Change | Phase |
|------|--------|-------|
| `src/agent/cro-agent.ts` | Dynamic steps, hybrid collection | 25a, 25f, 25i |
| `src/browser/dom/cro-selectors.ts` | 5 new categories + confidence | 25b, 25g |
| `src/browser/dom/structured-data.ts` | CREATE: JSON-LD extraction | 25c |
| `src/browser/dom/extractor.ts` | nodeId, freeze point | 25g, 25h |
| `src/browser/dom/serializer.ts` | confidence + nodeId format | 25g |
| `src/browser/layout/layout-mapper.ts` | CREATE: Bounding boxes | 25g |
| `src/browser/cleanup/ui-noise.ts` | CREATE: Noise suppression | 25h |
| `src/browser/media/media-readiness.ts` | CREATE: Lazy-load checks | 25h |
| `src/heuristics/category-analyzer.ts` | Enhanced LLM context | 25b |
| `src/output/screenshot-annotator.ts` | Fold line annotation | 25d |
| `src/output/tiled-screenshot.ts` | CREATE: Tiled capture | 25e |
| `src/output/evidence-packager.ts` | CREATE: Evidence packaging | 25g |
| `src/output/extraction-metrics.ts` | CREATE: Metrics | 25h |
| `src/validation/cheap-validator.ts` | CREATE: Deterministic validation | 25i |
| `src/validation/collection-qa.ts` | CREATE: LLM QA logic | 25i |
| `src/validation/reconciliation.ts` | CREATE: Structured ↔ DOM | 25h |
| `src/types/evidence-schema.ts` | CREATE: Evidence schema | 25g |
| `src/types/index.ts` | New config types | 25e, 25g |
| `src/cli.ts` | New CLI flags | 25e, 25f, 25h, 25i |

---

## Test Plan

### Unit Tests (40)

| File | Tests | Coverage |
|------|-------|----------|
| `dynamic-collection-steps.test.ts` | 4 | Formula, minimum, buffer, edge cases |
| `cro-selectors.test.ts` | 8 | All 5 new categories + confidence |
| `structured-data.test.ts` | 4 | JSON-LD parsing, @graph, errors |
| `fold-annotation.test.ts` | 4 | Line position, label, SVG, first-only |
| `cro-confidence.test.ts` | 4 | Aggregation, conflicts, clamping |
| `layout-mapper.test.ts` | 4 | Boxes, scrollY, missing nodes |
| `serializer-format.test.ts` | 4 | nodeId, confidence, multi-type |
| `evidence-schema.test.ts` | 4 | Validation, optional fields, ordering |
| `cheap-validator.test.ts` | 4 | Flags, thresholds, pass/fail |
| `ui-noise.test.ts` | 4 | Cookie, chat, modals, main content |

### Integration Tests (20)

| Test | Coverage |
|------|----------|
| Dynamic steps with real page | Formula validation |
| Price extraction on Burberry | Real site test |
| Variant extraction on PDP | Real site test |
| Tiled screenshot capture | Mode validation |
| Fold annotation on tiled | Visual check |
| Deterministic collection | No LLM calls |
| Structured data in context | LLM sees data |
| Full pipeline with selectors | End-to-end |
| CLI flags work | All new flags |
| Evidence.json output | File created |
| DOM↔Screenshot mapping | Boxes produced |
| Tiled mapping refs | Correct refs |
| Hybrid mode + readiness | Mode works |
| Noise suppression | Real site |
| Cheap validator passes | No LLM |
| Cheap validator fails | LLM runs |
| Recheck extended waits | Images load |
| Reconciliation warnings | Mismatch flagged |
| Metrics computation | Values correct |
| Performance benchmark | Speed metrics |

### E2E Tests (15)

| Test | Success Criteria |
|------|------------------|
| Burberry price in DOM | Price extracted, LLM sees it |
| Long page coverage | 10000px fully captured |
| Tiled mode output | Correct tiles |
| Deterministic speed | < 10s for 5 viewports |
| Above-fold accuracy | LLM correct on fold |
| Evidence mapping | Boxes + refs correct |
| Cookie banner suppressed | Clean screenshot |
| Reproducibility | Same run twice matches |
| Hybrid catches lazy | Images load after recheck |
| Full quality pipeline | All features work |
| Opt-out flags | Each flag works |
| LLM-guided still works | Backward compatible |
| Metrics accurate | evidence.json correct |
| Reconciliation warns | Mismatch detected |
| Run ID consistent | Appears in all outputs |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| New selectors false positives | Medium | Low | Weight tuning, testing |
| Fold annotation breaks images | Low | Medium | SVG overlay (non-destructive) |
| Tiled mode higher cost | Expected | Low | Optional, cost documented |
| Noise suppression hides content | Low | Medium | Whitelist main containers |
| Readiness timeout on slow CDN | Medium | Medium | Hard cap 3s + warn |
| Cheap validator too strict | Medium | Low | Tunable thresholds |
| Hybrid mode complexity | Medium | Medium | Clear state machine |

---

## Session Allocation

| Session | Tasks | Focus | Tests |
|---------|-------|-------|-------|
| 1 | T473-T480 | Dynamic steps + selectors (price, variant, stock) | 6 unit |
| 2 | T481-T488 | Selectors (shipping, gallery) + structured data | 6 unit |
| 3 | T489-T496 | Fold annotation + tiled screenshots | 4 unit + 6 int |
| 4 | T497-T502 | Deterministic collection + CLI | 4 int |
| 5 | T503-T510 | nodeId + layout mapping + evidence schema | 4 unit |
| 6 | T511-T520 | integrate mapping + evidence output | 4 unit + 4 int |
| 7 | T521-T528 | determinism + noise + readiness + hybrid | 4 unit + 4 int |
| 8 | T529-T534 | reconciliation + metrics | 2 int |
| 9 | T535-T542 | cheap validator + LLM QA + recheck | 4 unit + 2 int |
| 10 | T543-T548 | integration + E2E | 4 int + 15 E2E |

**Recommended**: 10 sessions

---

## CLI Flags Summary

### New Default ON (opt-out available)

```bash
--no-layout-mapping          # Disable DOM↔screenshot coordinate mapping
--no-noise-suppression       # Disable UI noise removal
--no-media-readiness         # Disable waiting for lazy-loaded images
--no-evidence-json           # Disable evidence.json output
--skip-collection-qa         # Skip LLM QA even if cheap validator flags
--llm-guided-collection      # Use LLM for collection (old behavior)
```

### New Options

```bash
--screenshot-mode <mode>     # viewport|tiled|hybrid (default: viewport)
--freeze-timeout <ms>        # DOM freeze timeout (default: 2000)
--readiness-timeout <ms>     # Media readiness timeout (default: 3000)
--extended-timeout <ms>      # Recheck timeout (default: 10000)
```

---

## QF-1: Element Mapping in LLM Prompts (2026-02-12)

**Status**: ✅ COMPLETE | **Requirements**: FR-430 to FR-433

### Problem
LLM receives screenshots + DOM text separately with no coordinate link. Element refs like `[v0-5]` in observations are often inaccurate. `domElementRefs` on evaluations was never populated, so `ScreenshotAnnotator` drew no bounding boxes despite working infrastructure.

### Architecture

```
ViewportSnapshot.visibleElements (already computed during collection)
     ↓
buildElementPositionsBlock() → <element_positions> block in LLM prompt
     ↓
LLM response with [v0-5] refs in observation/reasoning text
     ↓
populateElementRefs() → parses refs → populates domElementRefs
     ↓
ScreenshotAnnotator.getElementStatus() → matches element → draws bounding box
```

### Key Functions
| Function | File | Purpose |
|----------|------|---------|
| `buildElementPositionsBlock()` | `category-analyzer.ts` | Format visible elements as position block |
| `populateElementRefs()` | `category-analyzer.ts` | Parse [v0-5] refs → populate domElementRefs |

### Call Sites
1. `CategoryAnalyzer.analyzeCategory()` — positions in prompt + ref parsing after response
2. `batch-prompt-builder.ts` `buildDOMContextSection()` — positions in batched prompt
3. `AnalysisOrchestrator.runBatchedAnalysis()` — ref parsing after batch response

### Tests
- 19 unit tests in `tests/unit/element-mapping-prompt.test.ts`
