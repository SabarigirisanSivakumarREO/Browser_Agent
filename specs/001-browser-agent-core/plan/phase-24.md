# Phase 24: Hybrid Page Type Detection

**Status**: Planned
**Tasks**: T450-T472 (23 tasks)
**Tests**: 29 (15 unit + 10 integration + 4 E2E)
**Dependencies**: Phase 21a (PageTypeDetector)

---

## Overview

Implement three-tier hybrid page type detection:
1. **Tier 1**: Playwright-based detection (PRIMARY) - Rich DOM analysis
2. **Tier 2**: URL/selector heuristics (SECONDARY) - Fast pattern matching
3. **Tier 3**: LLM vision (FALLBACK) - Edge cases only (~10%)

**Key Change**: User-provided `detectPdp()` function becomes the primary detection method, replacing simplistic URL pattern matching with deep DOM inspection.

---

## Architecture

### Detection Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    HybridPageTypeDetector                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Check Domain Cache                                              │
│     └─ If cached → Return cached result                             │
│                                                                     │
│  2. TIER 1: Playwright Detection (PRIMARY)                          │
│     ├─ detectPdp() - JSON-LD, CTA, variants, media, anti-signals   │
│     ├─ detectPlpGrid() - Product links + filters                   │
│     ├─ detectCartPattern() - Subtotal + checkout                   │
│     └─ detectCheckoutPattern() - Address + payment                 │
│     └─ If confidence >= 0.7 → Return result (FAST PATH)            │
│                                                                     │
│  3. TIER 2: URL Heuristics (SECONDARY)                             │
│     ├─ Existing PageTypeDetector                                   │
│     └─ Combine scores with Tier 1                                  │
│     └─ If combined >= 0.6 → Return result                          │
│                                                                     │
│  4. TIER 3: LLM Vision (FALLBACK - rare)                           │
│     ├─ Only when Tier 1+2 confidence < 0.5                         │
│     ├─ Capture 512px screenshot                                    │
│     └─ Call gpt-4o-mini for classification                         │
│                                                                     │
│  5. Cache Result by Domain                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Module Structure

```
src/heuristics/
├── page-type-detector.ts              # Existing (Tier 2)
├── playwright-page-detector.ts        # NEW: Tier 1 - Playwright detection
│   ├── detectPdp()                    # PDP detection (user's code)
│   ├── detectPlpGrid()                # PLP detection
│   ├── detectCartPattern()            # Cart detection
│   └── detectCheckoutPattern()        # Checkout detection
├── llm-page-type-detector.ts          # NEW: Tier 3 - LLM fallback
├── hybrid-page-type-detector.ts       # NEW: Orchestrates all tiers
├── domain-pattern-cache.ts            # NEW: Domain caching
└── index.ts                           # Updated exports
```

### Type Definitions

```typescript
// src/heuristics/playwright-page-detector.ts
export type PageType = 'pdp' | 'plp' | 'homepage' | 'cart' | 'checkout' | 'account' | 'other';

export interface PdpSignals {
  // CTA signals
  addToCart: boolean;
  buyNow: boolean;
  primaryCtaText?: string;
  primaryCtaSelector?: string;
  ctaDisabled?: boolean;

  // Schema signals
  schemaProduct: boolean;
  schemaOffersPrice?: number;
  schemaCurrency?: string;

  // Content signals
  title?: string;
  priceFound: boolean;
  price?: number;
  currency?: string;
  variants: boolean;
  variantCount?: number;
  variantNames?: string[];
  mediaGallery: boolean;
  mediaCount?: number;

  // Anti-signals
  plpGrid: boolean;
  cartPattern: boolean;
  checkoutPattern: boolean;
}

export interface PlaywrightDetectionResult {
  pageType: PageType;
  confidence: number;
  score: number;
  signals: PdpSignals;
  evidence: {
    title?: string;
    price?: { amount?: number; currency?: string };
    cta?: { text?: string; selector?: string; disabled?: boolean };
    variants?: { count?: number; names?: string[] };
    media?: { count?: number };
    schema?: { hasProduct: boolean; price?: number; currency?: string };
  };
}
```

---

## Implementation Details

### 24a: Playwright PDP Detector (T450-T455)

Integrate user's `detectPdp()` as primary detection.

```typescript
// src/heuristics/playwright-page-detector.ts

import { Page, Locator } from 'playwright';

// === HELPER FUNCTIONS ===

const normalizeText = (s: string) =>
  s.replace(/\s+/g, ' ').trim().toLowerCase();

const parsePriceNumber = (s: string): number | undefined => {
  const m = s.replace(/,/g, '').match(/(\d{1,6})(\.\d{1,2})?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : undefined;
};

async function isVisibleEnabled(locator: Locator) {
  try {
    const visible = await locator.first().isVisible();
    if (!visible) return { visible: false, disabled: undefined };
    const disabled = await locator.first().isDisabled().catch(() => undefined);
    return { visible: true, disabled };
  } catch {
    return { visible: false, disabled: undefined };
  }
}

// === JSON-LD PARSING ===

async function extractJsonLd(page: Page) {
  return page.evaluate(() => {
    const scripts = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]')
    );
    return scripts.map(s => {
      try { return JSON.parse(s.textContent || ''); }
      catch { return null; }
    }).filter(Boolean);
  });
}

function flattenJsonLd(node: any): any[] {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(flattenJsonLd);
  if (node['@graph']) return flattenJsonLd(node['@graph']);
  return [node];
}

function findProductInJsonLd(jsonLd: any[]) {
  const all = jsonLd.flatMap(flattenJsonLd);
  const products = all.filter(x => {
    const t = x?.['@type'];
    if (Array.isArray(t)) return t.includes('Product');
    return t === 'Product';
  });

  if (!products.length) return { hasProduct: false };

  const p = products[0];
  const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
  const price = offer?.price ?? offer?.lowPrice;

  return {
    hasProduct: true,
    price: typeof price === 'number' ? price : parsePriceNumber(String(price)),
    currency: offer?.priceCurrency,
  };
}

// === MAIN DETECTION FUNCTION ===

export async function detectPdp(page: Page): Promise<PlaywrightDetectionResult> {
  // ... (user's full implementation)
}
```

### 24b: Multi-Page-Type Wrapper (T456-T458)

Wrap PDP detector to support all page types.

```typescript
// src/heuristics/playwright-page-detector.ts

export class PlaywrightPageTypeDetector {
  async detect(page: Page): Promise<PlaywrightDetectionResult> {
    const result = await detectPdp(page);

    // Use anti-signals for other page types
    if (result.signals.cartPattern) {
      return {
        pageType: 'cart',
        confidence: 0.85,
        score: 80,
        signals: result.signals,
        evidence: result.evidence,
      };
    }

    if (result.signals.checkoutPattern) {
      return {
        pageType: 'checkout',
        confidence: 0.85,
        score: 80,
        signals: result.signals,
        evidence: result.evidence,
      };
    }

    if (result.signals.plpGrid && result.pageType !== 'PDP') {
      return {
        pageType: 'plp',
        confidence: 0.75,
        score: 70,
        signals: result.signals,
        evidence: result.evidence,
      };
    }

    return {
      ...result,
      pageType: result.pageType === 'PDP' ? 'pdp' : 'other',
    };
  }
}
```

### 24c: Domain Cache (T459-T460)

```typescript
// src/heuristics/domain-pattern-cache.ts

export class DomainPatternCache {
  private cache = new Map<string, PlaywrightDetectionResult>();

  extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  set(url: string, result: PlaywrightDetectionResult): void {
    this.cache.set(this.extractDomain(url), result);
  }

  get(url: string): PlaywrightDetectionResult | undefined {
    return this.cache.get(this.extractDomain(url));
  }

  has(url: string): boolean {
    return this.cache.has(this.extractDomain(url));
  }

  clear(): void {
    this.cache.clear();
  }
}
```

### 24d: LLM Fallback (T461-T464)

Reduced scope - only for truly ambiguous cases.

```typescript
// src/heuristics/llm-page-type-detector.ts

export class LLMPageTypeDetector {
  async detect(
    screenshot: Buffer,
    url: string,
    title: string
  ): Promise<PageTypeResult> {
    const resized = await sharp(screenshot)
      .resize(512, null, { withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: this.buildPrompt(url, title) },
          { type: 'image_url', image_url: {
            url: `data:image/jpeg;base64,${resized.toString('base64')}`
          }}
        ]
      }],
      max_tokens: 200,
      temperature: 0,
    });

    return this.parseResponse(response.choices[0].message.content);
  }
}
```

### 24e: Hybrid Orchestrator (T465-T469)

```typescript
// src/heuristics/hybrid-page-type-detector.ts

export class HybridPageTypeDetector {
  constructor(
    private playwrightDetector: PlaywrightPageTypeDetector,
    private heuristicDetector: PageTypeDetector,
    private llmDetector: LLMPageTypeDetector,
    private cache: DomainPatternCache,
    private config: HybridDetectionConfig
  ) {}

  async detect(page: Page, state: PageState): Promise<PageTypeResult> {
    // 1. Check cache
    if (this.cache.has(state.url)) {
      return this.cache.get(state.url)!;
    }

    // 2. TIER 1: Playwright detection
    const playwrightResult = await this.playwrightDetector.detect(page);

    if (playwrightResult.confidence >= this.config.playwrightConfidenceThreshold) {
      this.cache.set(state.url, playwrightResult);
      logger.info('Tier 1 (Playwright) confident', {
        type: playwrightResult.pageType,
        confidence: playwrightResult.confidence,
      });
      return playwrightResult;
    }

    // 3. TIER 2: URL heuristics
    const heuristicResult = this.heuristicDetector.detect(state);

    // Combine scores
    const combined = this.combineResults(playwrightResult, heuristicResult);

    if (combined.confidence >= 0.6) {
      this.cache.set(state.url, combined);
      return combined;
    }

    // 4. TIER 3: LLM fallback (rare)
    if (!this.config.enableLLMFallback) {
      return combined;
    }

    try {
      const screenshot = await page.screenshot({ type: 'jpeg', quality: 80 });
      const llmResult = await this.llmDetector.detect(
        screenshot,
        state.url,
        state.title
      );

      if (llmResult.confidence > combined.confidence) {
        this.cache.set(state.url, llmResult);
        return llmResult;
      }
    } catch (error) {
      logger.warn('LLM fallback failed', { error });
    }

    return combined;
  }

  private combineResults(
    playwright: PlaywrightDetectionResult,
    heuristic: PageTypeResult
  ): PageTypeResult {
    // Weight: Playwright 70%, Heuristic 30%
    if (playwright.pageType === heuristic.type) {
      return {
        type: playwright.pageType,
        confidence: playwright.confidence * 0.7 + heuristic.confidence * 0.3,
        signals: [...(playwright.evidence ? ['Playwright detection'] : []), ...heuristic.signals],
      };
    }

    // Playwright wins on disagreement (it's more accurate)
    return {
      type: playwright.pageType,
      confidence: playwright.confidence,
      signals: ['Playwright detection (overrides heuristic)'],
    };
  }
}
```

### 24f: Integration & CLI (T470-T472)

```typescript
// src/agent/cro-agent.ts changes
import { createHybridPageTypeDetector } from '../heuristics/index.js';

// In analyze()
const pageTypeResult = await this.hybridDetector.detect(page, pageState);

// src/cli.ts additions
.option('--no-llm-page-detection', 'Disable LLM fallback for page type')
.option('--force-llm-detection', 'Force LLM detection (skip Playwright)')
.option('--llm-detection-threshold <n>', 'LLM fallback threshold', '0.5')
```

---

## File Changes Summary

| File | Change | Description |
|------|--------|-------------|
| `src/heuristics/playwright-page-detector.ts` | Create | User's detectPdp + wrapper |
| `src/heuristics/llm-page-type-detector.ts` | Create | LLM fallback (reduced) |
| `src/heuristics/hybrid-page-type-detector.ts` | Create | 3-tier orchestrator |
| `src/heuristics/domain-pattern-cache.ts` | Create | Domain caching |
| `src/heuristics/index.ts` | Modify | Export new classes |
| `src/agent/cro-agent.ts` | Modify | Use hybrid detector |
| `src/cli.ts` | Modify | Add CLI flags |
| `tests/unit/playwright-page-detector.test.ts` | Create | 10 unit tests |
| `tests/unit/hybrid-page-type-detector.test.ts` | Create | 5 unit tests |
| `tests/integration/hybrid-detection.test.ts` | Create | 10 integration tests |
| `tests/e2e/page-type-detection.test.ts` | Create | 4 E2E tests |

---

## Test Plan

### Unit Tests (15)

**playwright-page-detector.test.ts** (10 tests)
- JSON-LD parsing with @graph
- JSON-LD malformed handling
- CTA detection with visibility
- CTA disabled state
- Variant detection (selects, radios, swatches)
- Media gallery counting
- PLP grid detection
- Cart pattern detection
- Checkout pattern detection
- Score to confidence mapping

**hybrid-page-type-detector.test.ts** (5 tests)
- Cache hit returns cached result
- Tier 1 confident skips other tiers
- Tier 2 combines with Tier 1
- Tier 3 only when both uncertain
- LLM failure falls back gracefully

### Integration Tests (10)

**hybrid-detection.test.ts**
- Peregrine PDP detected via Playwright (no LLM)
- Burberry PDP detected via Playwright (no LLM)
- Cart page classified correctly
- PLP page classified correctly
- Domain cache prevents repeat detection
- CLI --no-llm-page-detection works
- CLI --force-llm-detection works
- Combined confidence calculation
- Evidence captured in result
- Detection metrics logged

### E2E Tests (4)

**page-type-detection.test.ts**
- E2E: Burberry PDP → pdp with evidence
- E2E: Standard PDP → pdp fast path
- E2E: Cart page → cart
- E2E: PLP page → plp

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Playwright detection slow | Low | Low | Runs during page load anyway |
| JSON-LD not present | Medium | Low | Falls back to CTA/visual signals |
| LLM rarely needed | Expected | Positive | Lower cost, faster detection |
| Anti-signal false positive | Low | Medium | Confidence thresholds |

---

## Session Allocation

| Session | Tasks | Focus |
|---------|-------|-------|
| 1 | T450-T458 | Playwright detector (user's code) + wrapper |
| 2 | T459-T466 | Cache + LLM fallback + hybrid orchestrator |
| 3 | T467-T472 | Integration + CLI + E2E tests |

**Recommended**: 3 sessions (7-8 tasks each)
