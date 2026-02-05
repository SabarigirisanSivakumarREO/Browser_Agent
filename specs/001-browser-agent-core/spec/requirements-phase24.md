# Phase 24 Requirements: Hybrid Page Type Detection

**Phase**: 24
**Status**: ✅ Complete
**Created**: 2026-02-03
**Updated**: 2026-02-04 (All tests passing: 39 unit + 9 integration + 7 E2E = 55 tests)
**Dependencies**: Phase 21a (PageTypeDetector)

---

## Overview

Improve page type detection reliability using a three-tier hybrid approach:
1. **Primary**: Playwright-based detection with rich DOM analysis (NEW)
2. **Secondary**: URL/selector heuristics (existing PageTypeDetector)
3. **Fallback**: LLM vision-based detection (edge cases only)

This replaces the simplistic URL pattern matching with deep DOM inspection including JSON-LD parsing, CTA detection, variant analysis, and anti-signal detection.

---

## Problem Statement

Current heuristic detection fails for:
- Luxury brand sites with non-standard URL patterns (e.g., `burberry.com/product-name-p12345`)
- Sites using product codes instead of `/product/` paths
- Pages where URL doesn't reflect content type

**Root Cause**: Current detector only uses URL patterns, CSS class selectors, and keywords from serialized DOM. It doesn't analyze actual page structure.

**Solution**: Use Playwright's live DOM access to detect:
- JSON-LD structured data (`Product` schema)
- Visible CTAs ("Add to Cart", "Buy Now")
- Price elements (schema, meta tags)
- Variant selectors (size, color)
- Media galleries
- Anti-signals (PLP grid, cart, checkout patterns)

---

## Functional Requirements

### FR-380: Playwright-Based PDP Detection
The system SHALL implement a Playwright-based PDP detector that analyzes:

| Signal | Detection Method | Score Impact |
|--------|-----------------|--------------|
| Add to Cart CTA | Button text + visibility | +30 |
| Buy Now CTA | Button text + visibility | +20 |
| JSON-LD Product | Schema.org parsing | +25 |
| Price Found | Schema → meta fallback | +15 |
| Variants | Selects, radios, swatches | +15 |
| Media Gallery | Image count ≥ 3 | +10 |
| Title | H1 or og:title | +5 |
| PLP Grid (anti) | Product links + filters | -25 |
| Cart Pattern (anti) | Subtotal + checkout | -20 |
| Checkout Pattern (anti) | Address + payment | -20 |

**Acceptance Criteria**:
- AC-380.1: Uses Playwright `Page` object for live DOM access
- AC-380.2: Checks element visibility before counting
- AC-380.3: Parses JSON-LD scripts for Product schema
- AC-380.4: Returns confidence score 0-1 based on weighted signals
- AC-380.5: Detects Burberry PDP with confidence ≥ 0.7

### FR-381: JSON-LD Schema Parsing
The system SHALL extract and parse JSON-LD structured data:

```typescript
// Extract all JSON-LD scripts
const scripts = document.querySelectorAll('script[type="application/ld+json"]');

// Find Product type (handles @graph arrays)
const product = findProductInJsonLd(parsed);

// Extract price from offers
const price = product.offers?.price ?? product.offers?.lowPrice;
```

**Acceptance Criteria**:
- AC-381.1: Handles `@graph` arrays in JSON-LD
- AC-381.2: Extracts price and currency from offers
- AC-381.3: Gracefully handles malformed JSON
- AC-381.4: Returns `hasProduct: boolean` signal

### FR-382: Primary CTA Detection
The system SHALL detect primary purchase CTAs:

```typescript
const ctaTextMatchers = [
  "add to cart",
  "add to bag",
  "add to basket",
  "buy now",
  "add",
];

const candidateSelectors = [
  'button[name="add"]',
  'button[id*="add" i]',
  'form[action*="cart" i] button',
  // ... more patterns
];
```

**Acceptance Criteria**:
- AC-382.1: Finds visible CTA buttons with matching text
- AC-382.2: Checks if CTA is disabled (sold out indicator)
- AC-382.3: Returns selector hint for CTA location
- AC-382.4: Ranks multiple candidates by match score

### FR-383: Anti-Signal Detection
The system SHALL detect page types that are NOT PDPs:

| Anti-Signal | Detection |
|-------------|-----------|
| PLP Grid | ≥8 product links AND filter elements |
| Cart | Subtotal text AND checkout button |
| Checkout | Address inputs AND payment/shipping text |

**Acceptance Criteria**:
- AC-383.1: PLP detection reduces confidence by 25 points
- AC-383.2: Cart pattern blocks PDP classification
- AC-383.3: Checkout pattern blocks PDP classification
- AC-383.4: Can be used to classify cart/checkout page types

### FR-384: Hybrid Detection Strategy
The system SHALL implement three-tier detection:

```
Tier 1: Playwright Detection (PRIMARY)
        └─ If confidence >= 0.7 → Return result

Tier 2: URL/Selector Heuristics (SECONDARY)
        └─ Combine with Tier 1 score
        └─ If combined >= 0.6 → Return result

Tier 3: LLM Vision (FALLBACK - edge cases only)
        └─ Only when Tier 1+2 confidence < 0.5
        └─ ~10% of cases expected
```

**Acceptance Criteria**:
- AC-384.1: Playwright detection runs first
- AC-384.2: LLM only invoked when both tiers uncertain
- AC-384.3: Domain cache prevents repeat LLM calls
- AC-384.4: Total detection time < 3s typical, < 8s with LLM

### FR-385: Multi-Page-Type Detection
The system SHALL detect multiple page types from Playwright signals:

| Page Type | Primary Signals |
|-----------|-----------------|
| `pdp` | CTA + price + variants + schema |
| `plp` | Product grid + filters + sort |
| `cart` | Line items + subtotal + checkout |
| `checkout` | Address + payment + shipping |
| `homepage` | Hero + featured + minimal product signals |
| `other` | No strong signals |

**Acceptance Criteria**:
- AC-385.1: Returns best matching page type
- AC-385.2: Anti-signals can flip classification
- AC-385.3: Confidence reflects signal strength

### FR-386: Evidence Collection
The system SHALL return rich evidence for debugging:

```typescript
interface PdpDetectionResult {
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

**Acceptance Criteria**:
- AC-386.1: All signals captured in result
- AC-386.2: Evidence includes extracted values
- AC-386.3: Can be logged for debugging

### FR-387: LLM Fallback (Reduced Scope)
The system SHALL use LLM only when Playwright detection uncertain:

**Trigger Conditions**:
- Playwright confidence < 0.5 AND
- URL heuristic confidence < 0.5 AND
- No cached domain pattern

**Acceptance Criteria**:
- AC-387.1: LLM called for < 10% of pages
- AC-387.2: Uses gpt-4o-mini with 512px screenshot
- AC-387.3: Timeout 10s with graceful fallback
- AC-387.4: Result cached by domain

### FR-388: Domain Pattern Cache
The system SHALL cache detection results by domain:

**Acceptance Criteria**:
- AC-388.1: Cache keyed by domain (strips www)
- AC-388.2: Stores page type + confidence
- AC-388.3: In-memory cache (session scope)
- AC-388.4: Reduces redundant detection work

### FR-389: CLI Integration
The system SHALL expose detection options via CLI:

```bash
# Default: Playwright detection enabled
npm run start -- --vision https://example.com

# Disable LLM fallback (Playwright + heuristics only)
npm run start -- --vision --no-llm-page-detection https://example.com

# Force LLM detection (skip Playwright)
npm run start -- --vision --force-llm-detection https://example.com

# Adjust fallback threshold
npm run start -- --vision --llm-detection-threshold 0.4 https://example.com
```

**Acceptance Criteria**:
- AC-389.1: `--no-llm-page-detection` disables LLM tier
- AC-389.2: `--force-llm-detection` skips to LLM tier
- AC-389.3: Threshold configurable

---

## Configuration Requirements

### CR-044: Hybrid Detection Configuration

```typescript
interface HybridDetectionConfig {
  /** Enable Playwright-based detection (default: true) */
  enablePlaywrightDetection: boolean;

  /** Playwright confidence threshold to skip other tiers (default: 0.7) */
  playwrightConfidenceThreshold: number;

  /** Enable LLM fallback (default: true) */
  enableLLMFallback: boolean;

  /** Combined confidence threshold to trigger LLM (default: 0.5) */
  llmFallbackThreshold: number;

  /** LLM timeout in ms (default: 10000) */
  llmDetectionTimeout: number;

  /** Enable domain caching (default: true) */
  enableDomainCache: boolean;
}
```

---

## Success Criteria

### SC-157: Burberry PDP Detection
Given URL `https://in.burberry.com/slim-fit-stretch-cotton-shirt-p80718001`
When page type detection runs
Then result should be `pdp` with confidence >= 0.7
And LLM should NOT be invoked (Playwright sufficient)

### SC-158: Standard PDP Fast Path
Given URL `https://example.com/product/widget`
When page type detection runs
Then Playwright detection should return confidence >= 0.8
And total detection time < 500ms

### SC-159: Cart Page Detection
Given a page with cart pattern signals
When page type detection runs
Then result should be `cart` (not `pdp`)
And PDP anti-signal should be active

### SC-160: LLM Fallback Rare
Given 100 random e-commerce pages
When page type detection runs
Then LLM should be invoked for < 10 pages

### SC-161: Evidence Completeness
Given any PDP page
When detection runs
Then evidence should include price, CTA text, variant count

---

## Test Requirements

### Unit Tests (15 tests)
- JSON-LD parsing (4 tests)
- CTA detection (3 tests)
- Variant detection (2 tests)
- Anti-signal detection (3 tests)
- Score calculation (3 tests)

### Integration Tests (10 tests)
- Playwright detection flow (4 tests)
- Hybrid tier logic (3 tests)
- Domain caching (2 tests)
- CLI flags (1 test)

### E2E Tests (4 tests)
- Burberry PDP detection
- Standard PDP detection
- Cart page detection
- PLP page detection

**Total**: 29 tests

---

## Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| playwright | ^1.x | Live DOM access (already installed) |
| openai | ^4.x | LLM fallback (already installed) |
| sharp | ^0.33.x | Screenshot resizing for LLM |
| zod | ^3.x | Response validation |

---

## Migration Notes

- Existing `PageTypeDetector` kept as secondary tier
- New `PlaywrightPageTypeDetector` becomes primary
- `HybridPageTypeDetector` orchestrates all tiers
- No breaking changes to public API
- Improved accuracy with no additional cost (LLM rarely needed)
