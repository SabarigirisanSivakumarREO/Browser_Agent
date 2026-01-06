**Navigation**: [Index](./index.md) | [Previous](./phase-19.md) | [Next](./phase-21.md)

## Phase 20: Hybrid Extraction Pipeline

### Summary

Replace the original 10-module extraction pipeline with a focused **hybrid approach** that combines framework-agnostic selectors, LLM DOM classification, and vision analysis for near-100% element detection accuracy.

**Key Change**: Instead of building 10 new modules (styles, network, storage, a11y, frames, vision), we enhance the existing extraction with:
- Framework-agnostic CRO detection (works on Tailwind, Styled Components, any CSS)
- Extended CRO types (price, variant, stock, delivery, etc.)
- Multi-strategy selectors (preferred + fallbacks)
- LLM DOM classification (catches what selectors miss)
- Enhanced visibility and context tracking

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    HYBRID DETECTION PIPELINE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Framework-Agnostic Selectors (Fast, Free)             │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │ Semantic HTML  │  │ Text Patterns  │  │ ARIA Patterns  │    │
│  │ button, a[href]│  │ add to cart,   │  │ role=button,   │    │
│  │ type=submit    │  │ buy now, etc.  │  │ aria-label     │    │
│  └────────────────┘  └────────────────┘  └────────────────┘    │
│      ↓ High-confidence elements pass through (~70%)             │
│      ↓ Low-confidence elements → Layer 2                        │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 2: LLM DOM Classification (Accurate, Paid)               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Unclassified interactive elements → GPT-4o-mini          │  │
│  │ Input: tag, text, attributes, context                    │  │
│  │ Output: CRO type + confidence + reasoning                │  │
│  │ Cost: ~$0.01-0.02 per page (10-30 elements batched)      │  │
│  └──────────────────────────────────────────────────────────┘  │
│      ↓ All elements now classified                              │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 3: Vision Analysis (Already Built - Phase 21)            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Screenshot → GPT-4o Vision                               │  │
│  │ Baymard heuristics evaluation (35 PDP rules)             │  │
│  │ UX-level insights independent of DOM structure           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Output: Complete CRO Analysis                                  │
│  ├─ Element-level insights (from Layers 1-2)                   │
│  └─ UX-level insights (from Layer 3)                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Why Hybrid?

| Approach | Coverage | Cost | Speed |
|----------|----------|------|-------|
| Hardcoded selectors only | ~60-70% | Free | Fast |
| LLM classification only | ~95% | ~$0.10/page | Slow |
| **Hybrid (selectors + LLM)** | **~95%** | **~$0.01-0.02** | **Fast** |

- **Cost efficient**: Selectors handle 70% of elements (free)
- **Accurate**: LLM catches what selectors miss
- **Framework-agnostic**: Works on Tailwind, Styled Components, any CSS
- **Complete**: Vision provides UX-level insights regardless of DOM structure

### Phase 20A: Framework-Agnostic CRO Detection

**Goal**: Detect CRO elements regardless of CSS framework

**Problem solved**: Tailwind, Styled Components, CSS Modules use non-semantic class names that hardcoded selectors can't match.

**Solution**: Prioritize semantic HTML, text patterns, and ARIA over class names.

```typescript
// Layer 1a: Semantic HTML (works on ANY site)
{ type: 'tag', pattern: 'button', weight: 0.7 },
{ type: 'tag', pattern: 'a[href]', weight: 0.6 },
{ type: 'attr', pattern: 'type=submit', weight: 0.9 },
{ type: 'attr', pattern: 'role=button', weight: 0.8 },

// Layer 1b: Text Patterns (works on ANY site)
{ type: 'text', pattern: 'add to cart|buy now|checkout|subscribe', weight: 0.9 },
{ type: 'text', pattern: 'sign up|get started|learn more|shop now', weight: 0.8 },
{ type: 'text', pattern: 'free shipping|guaranteed|secure|trusted', weight: 0.7 },

// Layer 1c: Common Data Attributes
{ type: 'attr', pattern: 'data-testid*=cart|buy|checkout', weight: 0.85 },
{ type: 'attr', pattern: 'aria-label*=add|buy|cart', weight: 0.85 },

// Layer 1d: Platform-Specific (optional bonus)
// Only applied if platform detected (Shopify, WooCommerce, etc.)
```

**Files to modify**:
- `src/browser/dom/cro-selectors.ts` - Reorganize into framework-agnostic layers

### Phase 20B: Extended CRO Types

**Goal**: Provide richer data for actionable insights

**Current types**: `cta`, `form`, `trust_signal`, `value_prop`, `navigation`

**New types**:
- `price` - Price display elements (current, original, sale)
- `variant_selector` - Size/color/option selectors
- `stock_status` - Availability indicators
- `delivery_info` - Shipping/returns information
- `product_image` - Main product images
- `review_widget` - Review/rating displays

**Files to modify**:
- `src/browser/dom/cro-selectors.ts` - Add new type patterns
- `src/models/dom-tree.ts` - Extend CROType union

### Phase 20C: Multi-Strategy Selectors

**Goal**: Improve action reliability and accountability

**Problem**: XPath-only selectors break on dynamic content and re-renders.

**Solution**: SelectorBundle with fallback strategies

```typescript
interface SelectorBundle {
  preferred: string | null;  // data-testid, id-based CSS
  css: string;               // Robust CSS selector
  xpath: string;             // Current fallback
  text?: string;             // For buttons/links
}

interface SelectorStrategy =
  | { type: 'role'; role: string; name?: string }
  | { type: 'text'; tag: string; text: string }
  | { type: 'nth'; tag: string; nth: number; withinLandmark?: string }
  | { type: 'xpath'; value: string };
```

**Files to create/modify**:
- `src/browser/dom/selector-bundle.ts` - New file
- `src/browser/dom/build-dom-tree.ts` - Generate bundles
- `src/models/dom-tree.ts` - Update DOMNode interface

### Phase 20D: LLM DOM Classification

**Goal**: Catch elements that hardcoded selectors miss

**How it works**:

```typescript
// 1. Identify unclassified elements
const unclassified = domTree.filter(n =>
  n.isInteractive && (!n.croType || n.croConfidence < 0.5)
);

// 2. Batch send to LLM
const prompt = `
Classify these DOM elements into CRO types:
${elements.map(e => `- ${e.tag} "${e.text}" [${e.attributes}]`).join('\n')}

Types: cta, form, trust_signal, value_prop, navigation, price,
       variant_selector, stock_status, delivery_info, review_widget, other

Return JSON: [{ index, type, confidence, reasoning }]
`;

// 3. Update elements with LLM classification
for (const result of llmResults) {
  elements[result.index].croType = result.type;
  elements[result.index].croConfidence = result.confidence;
  elements[result.index].classificationSource = 'llm';
}
```

**Cost optimization**:
- Only classify unmatched interactive elements (typically 10-30 per page)
- Use `gpt-4o-mini` for classification (cheap, fast)
- Batch elements in single API call
- Cache classifications by element fingerprint

**Files to create**:
- `src/browser/dom/llm-classifier.ts` - LLM classification logic
- `src/browser/dom/classification-prompt.ts` - Prompt templates

**Files to modify**:
- `src/browser/dom/extractor.ts` - Integrate LLM classification step
- `src/models/dom-tree.ts` - Add `classificationSource: 'selector' | 'llm'`

### Phase 20E: Enhanced Visibility & Context

**Goal**: Reduce false positives, add context for better recommendations

**Improvements**:
1. **Improved above-fold detection** - 50% visibility threshold (not just top edge)
2. **Landmark context** - Which section (header/main/footer) element is in
3. **Nearest heading context** - What heading an element relates to
4. **Occlusion detection** - Is element covered by modal/banner

**Files to modify**:
- `src/browser/dom/build-dom-tree.ts` - Add context fields
- `src/models/dom-tree.ts` - Extend DOMNode interface

### Modules NOT Being Built

| Original Phase 20 Module | Skip Reason |
|--------------------------|-------------|
| `styles/` | CSS tokens don't impact CRO analysis accuracy |
| `network/` | API responses not used by heuristic rules |
| `storage/` | Cookie data not needed for CRO insights |
| `a11y/` | Separate feature, not core extraction |
| `frames/` | Edge case, add when needed |
| `vision/` | Already done in Phase 21 |

### Expected Accuracy

| Detection Layer | Coverage | Cost per Page |
|-----------------|----------|---------------|
| Framework-agnostic selectors | ~70% | Free |
| LLM classification | +25% | ~$0.01-0.02 |
| Vision analysis (Phase 21) | 100% UX | ~$0.05-0.10 |
| **Total** | **~95%+** | **~$0.06-0.12** |

### Test Summary

| Phase | Unit | Integration | E2E | Total |
|-------|------|-------------|-----|-------|
| 20A: Framework-Agnostic | 25 | - | - | 25 |
| 20B: Extended Types | 15 | - | - | 15 |
| 20C: Multi-Strategy | 15 | 5 | - | 20 |
| 20D: LLM Classification | 15 | 10 | - | 25 |
| 20E: Visibility & Context | 10 | 5 | 5 | 20 |
| **TOTAL** | **80** | **20** | **5** | **105** |

### Migration Path

1. **Phase 1 - Parallel Implementation** (no breaking changes)
   - Enhance `cro-selectors.ts` with framework-agnostic patterns
   - Add new CRO types
   - Existing extraction continues working

2. **Phase 2 - LLM Integration**
   - Add LLM classifier as optional enhancement
   - Feature flag: `useLLMClassification: boolean`
   - Run both in parallel for comparison

3. **Phase 3 - Default Enablement**
   - Make LLM classification default (opt-out available)
   - Measure accuracy improvement on real sites
