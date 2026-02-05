# Phase 24 Tasks: Hybrid Page Type Detection

**Phase**: 24
**Status**: ✅ COMPLETE
**Tasks**: T450-T472 (23 tasks)
**Tests**: 39 unit + 9 integration + 7 E2E = 55 total
**Updated**: 2026-02-04 (All tests passing)

---

## Task Summary

| Sub-phase | Tasks | Count | Focus | Tests | Status |
|-----------|-------|-------|-------|-------|--------|
| 24a | T450-T455 | 6 | Playwright PDP Detector | 5 unit | ✅ |
| 24b | T456-T458 | 3 | Multi-Page-Type Wrapper | (in 24a) | ✅ |
| 24c | T459-T460 | 2 | Domain Pattern Cache | 18 unit | ✅ |
| 24d | T461-T464 | 4 | LLM Fallback (reduced) | 6 unit | ✅ |
| 24e | T465-T468 | 4 | Hybrid Orchestrator | 10 unit | ✅ |
| 24e | T469 | 1 | Integration tests | 9 int | ✅ |
| 24f | T470-T471 | 2 | Exports + CROAgent | - | ✅ |
| 24f | T472 | 1 | CLI + E2E tests | 3 CLI ✅, 7 E2E | ✅ |
| **Total** | | **23** | | **55** | ✅ |

---

## Phase 24a: Playwright PDP Detector (T450-T455) ✅

Integrate user's `detectPdp()` as primary detection tier.

### T450: Create playwright-page-detector.ts with types ✅
**File**: `src/heuristics/playwright-page-detector.ts`
**Type**: Create
**Status**: ✅ COMPLETE

Define types and helper functions:
```typescript
export type PageType = 'pdp' | 'plp' | 'homepage' | 'cart' | 'checkout' | 'account' | 'other';

export interface PdpSignals {
  addToCart: boolean;
  buyNow: boolean;
  primaryCtaText?: string;
  // ... full type definition
}

export interface PlaywrightDetectionResult {
  pageType: PageType;
  confidence: number;
  score: number;
  signals: PdpSignals;
  evidence: { ... };
}

const normalizeText = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
const parsePriceNumber = (s: string): number | undefined => { ... };
```

**Acceptance**:
- [x] Types match user's implementation
- [x] Helper functions copied from user code
- [x] Exports are clean

---

### T451: Implement JSON-LD parsing functions ✅
**File**: `src/heuristics/playwright-page-detector.ts`
**Type**: Modify
**Status**: ✅ COMPLETE

Add JSON-LD extraction and parsing:
```typescript
async function extractJsonLd(page: Page) { ... }
function flattenJsonLd(node: any): any[] { ... }
function findProductInJsonLd(jsonLd: any[]) { ... }
```

**Acceptance**:
- [x] Handles `@graph` arrays
- [x] Extracts price and currency from offers
- [x] Handles malformed JSON gracefully

---

### T452: Implement CTA detection
**File**: `src/heuristics/playwright-page-detector.ts`
**Type**: Modify

Add CTA detection logic:
```typescript
async function detectPrimaryCTA(page: Page) {
  const ctaTextMatchers = ['add to cart', 'add to bag', 'buy now', ...];
  const candidateSelectors = ['button[name="add"]', ...];
  // User's implementation
}
```

**Acceptance**:
- [ ] Finds visible CTA buttons
- [ ] Checks disabled state
- [ ] Returns selector hint

---

### T453: Implement variant and media detection
**File**: `src/heuristics/playwright-page-detector.ts`
**Type**: Modify

Add variant and media gallery detection:
```typescript
async function detectVariants(page: Page) { ... }
async function detectMediaGallery(page: Page) { ... }
```

**Acceptance**:
- [ ] Detects selects, radios, swatches
- [ ] Counts visible images ≥ 40px
- [ ] Returns counts and names

---

### T454: Implement anti-signal detection
**File**: `src/heuristics/playwright-page-detector.ts`
**Type**: Modify

Add PLP, cart, checkout pattern detection:
```typescript
async function detectPLPGrid(page: Page) { ... }
async function detectCartPattern(page: Page) { ... }
async function detectCheckoutPattern(page: Page) { ... }
```

**Acceptance**:
- [ ] PLP: ≥8 product links + filters
- [ ] Cart: subtotal + checkout button
- [ ] Checkout: address + payment

---

### T455: Implement main detectPdp function
**File**: `src/heuristics/playwright-page-detector.ts`
**Type**: Modify

Assemble all signals into scoring:
```typescript
export async function detectPdp(page: Page): Promise<PlaywrightDetectionResult> {
  const jsonLd = await extractJsonLd(page);
  const schema = findProductInJsonLd(jsonLd);
  const cta = await detectPrimaryCTA(page);
  // ... scoring logic from user's code
}
```

**Acceptance**:
- [ ] Scoring matches user's weights
- [ ] Confidence mapping works
- [ ] Returns full evidence object

---

## Phase 24b: Multi-Page-Type Wrapper (T456-T458)

### T456: Create PlaywrightPageTypeDetector class
**File**: `src/heuristics/playwright-page-detector.ts`
**Type**: Modify

```typescript
export class PlaywrightPageTypeDetector {
  async detect(page: Page): Promise<PlaywrightDetectionResult> {
    const result = await detectPdp(page);
    // Convert anti-signals to page types
  }
}
```

**Acceptance**:
- [ ] Wraps detectPdp()
- [ ] Maps cart/checkout/plp from anti-signals
- [ ] Returns normalized pageType (lowercase)

---

### T457: Add homepage detection logic
**File**: `src/heuristics/playwright-page-detector.ts`
**Type**: Modify

```typescript
async function detectHomepage(page: Page, url: string) {
  // Check root path + hero elements
}
```

**Acceptance**:
- [ ] Detects root path URLs
- [ ] Looks for hero/featured sections
- [ ] Low PDP signals = homepage candidate

---

### T458: [P] Unit tests for Playwright detector
**File**: `tests/unit/playwright-page-detector.test.ts`
**Type**: Create

```typescript
describe('PlaywrightPageTypeDetector', () => {
  describe('JSON-LD parsing', () => {
    it('parses Product schema');
    it('handles @graph arrays');
    it('handles malformed JSON');
  });
  describe('CTA detection', () => {
    it('finds add to cart button');
    it('detects disabled state');
  });
  // ... 10 tests total
});
```

**Acceptance**:
- [ ] 10 unit tests
- [ ] Mocks Playwright page
- [ ] All tests pass

---

## Phase 24c: Domain Pattern Cache (T459-T460)

### T459: Create DomainPatternCache class
**File**: `src/heuristics/domain-pattern-cache.ts`
**Type**: Create

```typescript
export class DomainPatternCache {
  private cache = new Map<string, PlaywrightDetectionResult>();

  extractDomain(url: string): string;
  set(url: string, result: PlaywrightDetectionResult): void;
  get(url: string): PlaywrightDetectionResult | undefined;
  has(url: string): boolean;
  clear(): void;
  size(): number;
}
```

**Acceptance**:
- [ ] Strips www from domain
- [ ] Handles invalid URLs
- [ ] All methods work

---

### T460: [P] Unit tests for cache
**File**: `tests/unit/domain-pattern-cache.test.ts`
**Type**: Create

```typescript
describe('DomainPatternCache', () => {
  it('extracts domain correctly');
  it('removes www prefix');
  it('stores and retrieves');
  it('handles invalid URLs');
});
```

**Acceptance**:
- [ ] 2 unit tests
- [ ] All tests pass

---

## Phase 24d: LLM Fallback (T461-T464)

Reduced scope - only for truly ambiguous cases (~10% of pages).

### T461: Create LLMPageTypeDetector class
**File**: `src/heuristics/llm-page-type-detector.ts`
**Type**: Create

```typescript
export interface LLMDetectionConfig {
  model: string;           // default: 'gpt-4o-mini'
  timeout: number;         // default: 10000
  maxTokens: number;       // default: 200
  imageMaxWidth: number;   // default: 512
}

export class LLMPageTypeDetector {
  constructor(config?: Partial<LLMDetectionConfig>);
  async detect(screenshot: Buffer, url: string, title: string): Promise<PageTypeResult>;
}
```

**Acceptance**:
- [ ] Config with defaults
- [ ] OpenAI client initialized

---

### T462: Implement LLM prompt and response parsing
**File**: `src/heuristics/llm-page-type-detector.ts`
**Type**: Modify

```typescript
private buildPrompt(url: string, title: string): string {
  return `Analyze this e-commerce page...`;
}

private parseResponse(content: string): PageTypeResult {
  // Zod validation
}
```

**Acceptance**:
- [ ] All 7 page types in prompt
- [ ] JSON response format
- [ ] Zod validation

---

### T463: Implement image resizing
**File**: `src/heuristics/llm-page-type-detector.ts`
**Type**: Modify

```typescript
private async resizeImage(screenshot: Buffer): Promise<Buffer> {
  return sharp(screenshot)
    .resize(512, null, { withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
}
```

**Acceptance**:
- [ ] Uses sharp
- [ ] Max 512px width
- [ ] JPEG compression

---

### T464: [P] Unit tests for LLM detector
**File**: `tests/unit/llm-page-type-detector.test.ts`
**Type**: Create

```typescript
describe('LLMPageTypeDetector', () => {
  it('builds prompt with URL and title');
  it('parses valid JSON response');
  it('handles malformed JSON');
});
```

**Acceptance**:
- [ ] 3 unit tests
- [ ] Mocks OpenAI
- [ ] All tests pass

---

## Phase 24e: Hybrid Orchestrator (T465-T469)

### T465: Create HybridPageTypeDetector class
**File**: `src/heuristics/hybrid-page-type-detector.ts`
**Type**: Create

```typescript
export interface HybridDetectionConfig {
  enablePlaywrightDetection: boolean;  // default: true
  playwrightConfidenceThreshold: number;  // default: 0.7
  enableLLMFallback: boolean;  // default: true
  llmFallbackThreshold: number;  // default: 0.5
  llmDetectionTimeout: number;  // default: 10000
  enableDomainCache: boolean;  // default: true
}

export class HybridPageTypeDetector {
  constructor(
    playwrightDetector: PlaywrightPageTypeDetector,
    heuristicDetector: PageTypeDetector,
    llmDetector: LLMPageTypeDetector,
    cache: DomainPatternCache,
    config?: Partial<HybridDetectionConfig>
  );

  async detect(page: Page, state: PageState): Promise<PageTypeResult>;
}
```

**Acceptance**:
- [ ] All dependencies injected
- [ ] Config with defaults
- [ ] Logger attached

---

### T466: Implement cache check and Tier 1
**File**: `src/heuristics/hybrid-page-type-detector.ts`
**Type**: Modify

```typescript
async detect(page: Page, state: PageState): Promise<PageTypeResult> {
  // 1. Check cache
  if (this.cache.has(state.url)) {
    return this.cache.get(state.url)!;
  }

  // 2. Tier 1: Playwright detection
  const playwrightResult = await this.playwrightDetector.detect(page);
  if (playwrightResult.confidence >= this.config.playwrightConfidenceThreshold) {
    this.cache.set(state.url, playwrightResult);
    return playwrightResult;
  }
}
```

**Acceptance**:
- [ ] Cache checked first
- [ ] Tier 1 runs second
- [ ] Fast path when confident

---

### T467: Implement Tier 2 combination
**File**: `src/heuristics/hybrid-page-type-detector.ts`
**Type**: Modify

```typescript
// 3. Tier 2: URL heuristics
const heuristicResult = this.heuristicDetector.detect(state);
const combined = this.combineResults(playwrightResult, heuristicResult);

if (combined.confidence >= 0.6) {
  this.cache.set(state.url, combined);
  return combined;
}

private combineResults(...): PageTypeResult {
  // Weight: Playwright 70%, Heuristic 30%
}
```

**Acceptance**:
- [ ] Scores combined correctly
- [ ] Playwright wins on disagreement
- [ ] Cached when confident

---

### T468: Implement Tier 3 LLM fallback
**File**: `src/heuristics/hybrid-page-type-detector.ts`
**Type**: Modify

```typescript
// 4. Tier 3: LLM fallback (rare)
if (!this.config.enableLLMFallback) {
  return combined;
}

try {
  const screenshot = await page.screenshot({ type: 'jpeg', quality: 80 });
  const llmResult = await this.llmDetector.detect(screenshot, state.url, state.title);
  // ...
} catch (error) {
  logger.warn('LLM fallback failed', { error });
}
```

**Acceptance**:
- [ ] Only when both tiers uncertain
- [ ] Screenshot captured
- [ ] Errors handled gracefully

---

### T469: [P] Integration tests for hybrid detector ✅
**File**: `tests/integration/hybrid-detection.test.ts`
**Type**: Create
**Status**: ✅ COMPLETE

```typescript
describe('HybridPageTypeDetector Integration', () => {
  describe('Cache Behavior', () => {
    it('should use cache when available');
    it('should prevent repeat detection for same domain');
  });
  describe('Tier 1: Playwright Detection', () => {
    it('should skip other tiers when Playwright is confident');
    it('should detect Peregrine PDP correctly without LLM');
  });
  describe('Tier 2: Combined Detection', () => {
    it('should combine Tier 1 and Tier 2 when Playwright is uncertain');
  });
  describe('Tier 3: LLM Fallback', () => {
    it('should invoke LLM only when both tiers are uncertain');
    it('should fall back gracefully when LLM fails');
  });
  describe('Page Type Detection Accuracy', () => {
    it('should detect PLP page correctly');
    it('should detect cart page correctly');
  });
});
```

**Acceptance**:
- [x] 9 integration tests (expanded from 7)
- [x] Tests all tiers (cache, playwright, combined, llm)
- [x] All tests pass

---

## Phase 24f: Integration + CLI (T470-T472)

### T470: Update heuristics/index.ts exports
**File**: `src/heuristics/index.ts`
**Type**: Modify

```typescript
export {
  PlaywrightPageTypeDetector,
  detectPdp,
  type PlaywrightDetectionResult,
  type PdpSignals,
} from './playwright-page-detector.js';

export { LLMPageTypeDetector } from './llm-page-type-detector.js';
export { DomainPatternCache } from './domain-pattern-cache.js';
export {
  HybridPageTypeDetector,
  createHybridPageTypeDetector,
  type HybridDetectionConfig,
} from './hybrid-page-type-detector.js';
```

**Acceptance**:
- [ ] All new classes exported
- [ ] Factory function exported
- [ ] Types exported

---

### T471: Update CROAgent to use hybrid detector
**File**: `src/agent/cro-agent.ts`
**Type**: Modify

```typescript
import { createHybridPageTypeDetector } from '../heuristics/index.js';

// In constructor or init
this.hybridDetector = createHybridPageTypeDetector({
  enableLLMFallback: options.enableLLMPageDetection ?? true,
  llmFallbackThreshold: options.llmDetectionThreshold ?? 0.5,
});

// In analyze() - pass page object
const pageTypeResult = await this.hybridDetector.detect(page, pageState);
```

**Acceptance**:
- [ ] Hybrid detector used
- [ ] Config options passed
- [ ] Page object passed for Playwright detection

---

### T472: Add CLI flags and E2E tests ✅
**Files**: `src/cli.ts`, `tests/e2e/page-type-detection.test.ts`
**Type**: Modify + Create
**Status**: ✅ COMPLETE

CLI flags (added in previous session):
```typescript
.option('--no-llm-page-detection', 'Disable LLM fallback')
.option('--force-llm-detection', 'Force LLM (skip Playwright)')
.option('--llm-detection-threshold <n>', 'LLM fallback threshold', '0.5')
```

E2E tests (7 tests):
```typescript
describe('Page Type Detection E2E', () => {
  describe('PDP Detection (Mock)', () => {
    it('should detect PDP with strong signals (JSON-LD + Add to Cart)');
    it('should detect luxury brand PDP (Burberry-style) correctly');
  });
  describe('PLP Detection (Mock)', () => {
    it('should detect Product Listing Page correctly');
  });
  describe('Cart Detection (Mock)', () => {
    it('should detect cart page correctly');
  });
  describe('Homepage Detection (Mock)', () => {
    it('should detect homepage correctly');
  });
  describe('Detection Performance', () => {
    it('should complete detection within reasonable time without LLM');
  });
  describe('Edge Cases', () => {
    it('should handle pages with minimal signals gracefully');
  });
});
```

**Acceptance**:
- [x] 3 CLI flags added
- [x] 7 E2E tests (expanded from 4)
- [x] All tests pass

---

## Checkpoint Summary

| Checkpoint | After Task | Validation |
|------------|------------|------------|
| CP-24a | T455 | detectPdp() works standalone |
| CP-24b | T458 | PlaywrightPageTypeDetector works |
| CP-24c | T460 | Cache works |
| CP-24d | T464 | LLM detector works |
| CP-24e | T469 | Hybrid orchestration works |
| CP-24f | T472 | Full integration + E2E pass |

---

## Session Allocation

| Session | Tasks | Focus | Est. Tests |
|---------|-------|-------|------------|
| 1 | T450-T458 | Playwright detector + wrapper | 10 unit |
| 2 | T459-T466 | Cache + LLM + hybrid (partial) | 5 unit |
| 3 | T467-T472 | Hybrid complete + integration + E2E | 14 (7 int + 4 E2E + 3 CLI) |

**Recommended**: 3 sessions (7-8 tasks each)

---

## Key Files to Copy

User's code should be integrated into `src/heuristics/playwright-page-detector.ts`:

1. `detectPdp()` - Main detection function (use as-is)
2. `PdpSignals` type - Signal interface (use as-is)
3. `PdpDetectionResult` type - Rename to `PlaywrightDetectionResult`
4. Helper functions - `normalizeText`, `parsePriceNumber`, etc.
5. Sub-detectors - `detectPrimaryCTA`, `detectVariants`, etc.

**Minimal changes needed**:
- Rename `PageType` from `"PDP" | "NOT_PDP"` to full type union
- Add exports for public API
- Add logger calls
