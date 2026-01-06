**Navigation**: [Index](./index.md) | [Previous](./phase-19.md) | [Next](./phase-21.md)

---

## Phase 20: Hybrid Extraction Pipeline

**Purpose**: Implement framework-agnostic CRO detection with LLM classification fallback for near-100% element detection accuracy

**User Stories**: US12 (Detection Accuracy), US13 (Framework Compatibility), US14 (Actionable Insights)

**Acceptance Tests** (must pass before phase complete):
- Detection works on Tailwind CSS site (utility classes only)
- Detection works on Styled Components site (hashed classes)
- LLM classification catches unmatched interactive elements
- Extended CRO types (price, variant, stock) classified correctly
- Multi-strategy selectors resolve elements after page navigation
- 95%+ element detection accuracy on test PDPs

---

### Phase 20A: Framework-Agnostic CRO Detection (T147-T158)

**Purpose**: Detect CRO elements regardless of CSS framework

- [ ] T147 [P] [US12] Reorganize CRO_SELECTORS into detection layers
  - Layer 1a: Semantic HTML (button, a[href], type=submit, role=button)
  - Layer 1b: Text patterns (add to cart, buy now, etc.)
  - Layer 1c: Data attributes (data-testid, data-action)
  - Layer 1d: ARIA patterns (aria-label, role)
  - File: `src/browser/dom/cro-selectors.ts`

- [ ] T148 [P] [US12] Add semantic HTML patterns for CTA detection
  - Pattern: button elements → cta (weight: 0.7)
  - Pattern: a[href] elements → cta (weight: 0.6)
  - Pattern: type=submit → cta (weight: 0.9)
  - Pattern: role=button → cta (weight: 0.8)

- [ ] T149 [P] [US12] Add text patterns for CTA detection
  - Pattern: 'add to cart|buy now|checkout|subscribe' → cta (weight: 0.9)
  - Pattern: 'sign up|get started|learn more|shop now' → cta (weight: 0.8)
  - Pattern: 'continue|proceed|confirm' → cta (weight: 0.75)
  - Case-insensitive matching

- [ ] T150 [P] [US12] Add text patterns for trust signal detection
  - Pattern: 'free shipping|guaranteed|secure|trusted' → trust_signal (weight: 0.8)
  - Pattern: 'money back|satisfaction|certified' → trust_signal (weight: 0.75)
  - Pattern: 'verified|authentic|official' → trust_signal (weight: 0.7)

- [ ] T151 [P] [US12] Add ARIA and data-testid patterns
  - Pattern: aria-label*=add|buy|cart → cta (weight: 0.85)
  - Pattern: aria-label*=price|cost → price (weight: 0.8)
  - Pattern: data-testid*=cart|buy|checkout → cta (weight: 0.85)
  - Pattern: data-testid*=price|amount → price (weight: 0.8)

- [ ] T152 [US13] Add optional platform detection
  - Detect Shopify from meta tags, Shopify.theme, script sources
  - Detect WooCommerce from body classes, wp-content paths
  - Detect Magento from X-Magento-* headers
  - Return 'custom' if no platform detected

- [ ] T153 [US13] Add platform-specific selector bonus layer
  - Shopify: form[action*="/cart/add"], .product-form__submit
  - WooCommerce: .add_to_cart_button, .single_add_to_cart_button
  - Only apply if platform detected

- [ ] T154 [P] Create tests/unit/framework-agnostic-detection.test.ts (10 tests)
  - Test: Semantic HTML patterns detect buttons
  - Test: Text patterns detect CTAs
  - Test: ARIA patterns detect elements
  - Test: Detection works with Tailwind utility classes
  - Test: Detection works with hashed class names
  - Test: Platform detection identifies Shopify
  - Test: Platform detection identifies WooCommerce
  - Test: Platform detection returns 'custom' for unknown

- [ ] T155 [P] Create tests/unit/text-pattern-matching.test.ts (8 tests)
  - Test: Case-insensitive matching
  - Test: Partial text matching
  - Test: Multiple patterns in OR relationship
  - Test: Button text extraction
  - Test: Link text extraction
  - Test: Input placeholder matching
  - Test: Aria-label matching
  - Test: Data attribute matching

- [ ] T156 [P] Create tests/integration/tailwind-site.test.ts (4 tests)
  - Test: CTA detection on Tailwind site
  - Test: Form detection on Tailwind site
  - Test: Trust signal detection on Tailwind site
  - Test: Navigation detection on Tailwind site

- [ ] T157 [P] Create tests/integration/styled-components-site.test.ts (3 tests)
  - Test: CTA detection with hashed classes
  - Test: Form detection with hashed classes
  - Test: Element indexing works correctly

- [ ] T158 Update existing cro-selectors tests for new structure

**Checkpoint**: Framework-agnostic detection works on Tailwind/SC sites

---

### Phase 20B: Extended CRO Types (T159-T170)

**Purpose**: Add new CRO types for richer e-commerce analysis

- [ ] T159 [P] [US14] Extend CROType union in dom-tree.ts
  - Add: 'price' | 'variant_selector' | 'stock_status'
  - Add: 'delivery_info' | 'product_image' | 'review_widget'
  - Update type guards and validation

- [ ] T160 [P] [US14] Add price detection patterns
  - Pattern: text matches currency + number → price (weight: 0.9)
  - Pattern: data-price, data-sale-price attrs → price (weight: 0.85)
  - Pattern: class*=price, class*=amount → price (weight: 0.7)

- [ ] T161 [P] [US14] Add variant selector detection patterns
  - Pattern: select within form → variant_selector (weight: 0.8)
  - Pattern: role=radiogroup, role=listbox → variant_selector (weight: 0.85)
  - Pattern: class*=swatch, class*=variant → variant_selector (weight: 0.75)

- [ ] T162 [P] [US14] Add stock status detection patterns
  - Pattern: text*='in stock|out of stock|available' → stock_status (weight: 0.9)
  - Pattern: class*=stock, class*=availability → stock_status (weight: 0.8)
  - Pattern: data-inventory, data-stock attrs → stock_status (weight: 0.85)

- [ ] T163 [P] [US14] Add delivery info detection patterns
  - Pattern: text*='free shipping|delivery|ships within' → delivery_info (weight: 0.85)
  - Pattern: text*='returns|return policy|easy returns' → delivery_info (weight: 0.8)
  - Pattern: class*=shipping, class*=delivery → delivery_info (weight: 0.7)

- [ ] T164 [P] [US14] Add product image detection patterns
  - Pattern: img within product container → product_image (weight: 0.7)
  - Pattern: img[alt*=product], data-product-image → product_image (weight: 0.85)
  - Pattern: role=img within main → product_image (weight: 0.75)

- [ ] T165 [P] [US14] Add review widget detection patterns
  - Pattern: class*=review, class*=rating → review_widget (weight: 0.8)
  - Pattern: aria-label*=rating, aria-label*=stars → review_widget (weight: 0.85)
  - Pattern: text*='reviews|ratings|stars' → review_widget (weight: 0.75)

- [ ] T166 [P] Create tests/unit/extended-cro-types.test.ts (12 tests)
  - Test: Price detection from currency text
  - Test: Price detection from data attributes
  - Test: Variant selector detection
  - Test: Stock status detection
  - Test: Delivery info detection
  - Test: Product image detection
  - Test: Review widget detection
  - Test: CROType union includes new types
  - Test: Type guards work for new types

- [ ] T167 [P] Create tests/integration/pdp-extended-types.test.ts (3 tests)
  - Test: PDP extracts price elements
  - Test: PDP extracts variant selectors
  - Test: PDP extracts stock status

- [ ] T168 Update heuristic rules to use new CRO types
  - Add price-above-fold rule
  - Add variant-visibility rule
  - Add stock-status-clarity rule

- [ ] T169 Update agent tools to handle new CRO types
- [ ] T170 Update serializer to include new type annotations

**Checkpoint**: Extended CRO types detected on e-commerce PDPs

---

### Phase 20C: Multi-Strategy Selectors (T171-T180)

**Purpose**: Improve element selection reliability with fallback strategies

- [ ] T171 [P] [US14] Create SelectorBundle interface in dom-tree.ts
  - preferred: string | null (data-testid, id-based)
  - css: string (robust CSS selector)
  - xpath: string (current fallback)
  - text?: string (for buttons/links)

- [ ] T172 [P] [US14] Create SelectorStrategy union type
  - { type: 'role'; role: string; name?: string }
  - { type: 'text'; tag: string; text: string }
  - { type: 'nth'; tag: string; nth: number; withinLandmark?: string }
  - { type: 'xpath'; value: string }

- [ ] T173 [US14] Create src/browser/dom/selector-bundle.ts
  - generateSelectorBundle(element, context): SelectorBundle
  - Generate preferred from data-testid, id
  - Generate CSS selector (robust, not too specific)
  - Generate fallback strategies in order

- [ ] T174 [US14] Create SelectorResolver class
  - resolve(page, bundle): Promise<ElementHandle | null>
  - Try strategies in order: preferred → css → role → text → nth → xpath
  - Never throw, return null on failure
  - 5s timeout per strategy

- [ ] T175 [P] Update build-dom-tree.ts to generate SelectorBundle
  - Replace xpath-only with SelectorBundle
  - Generate bundle for each indexed element

- [ ] T176 [P] Update DOMNode interface to use SelectorBundle
  - Replace xpath: string with selector: SelectorBundle
  - Update serializer for backwards compatibility

- [ ] T177 [P] Create tests/unit/selector-bundle.test.ts (10 tests)
  - Test: Generates preferred from data-testid
  - Test: Generates preferred from id
  - Test: Generates CSS selector
  - Test: Generates role strategy
  - Test: Generates text strategy
  - Test: Generates xpath fallback
  - Test: Handles elements with no attributes

- [ ] T178 [P] Create tests/unit/selector-resolver.test.ts (8 tests)
  - Test: Resolves via preferred first
  - Test: Falls back when preferred not unique
  - Test: Role strategy uses getByRole
  - Test: Text strategy matches content
  - Test: Returns null on failure
  - Test: Never throws on invalid selector
  - Test: Respects timeout

- [ ] T179 [P] Create tests/integration/selector-reliability.test.ts (5 tests)
  - Test: Element selectable after page navigation
  - Test: Element selectable after DOM update
  - Test: Element selectable in dynamic content
  - Test: Fallback works when preferred fails
  - Test: Multiple elements resolved correctly

- [ ] T180 Update agent action tools to use SelectorResolver

**Checkpoint**: Elements reliably selected after page changes

---

### Phase 20D: LLM DOM Classification (T181-T192)

**Purpose**: Classify unmatched elements using LLM for 95%+ accuracy

- [ ] T181 [P] [US12] Create src/browser/dom/classification-prompt.ts
  - CLASSIFICATION_SYSTEM_PROMPT constant
  - formatElementsForClassification(elements): string
  - parseClassificationResponse(response): ClassificationResult[]

- [ ] T182 [US12] Create src/browser/dom/llm-classifier.ts
  - class LLMClassifier
  - classify(elements: UnclassifiedElement[]): Promise<ClassificationResult[]>
  - Batch elements (max 30 per call)
  - Use gpt-4o-mini for cost efficiency

- [ ] T183 [US12] Implement classification caching
  - Cache by element fingerprint
  - Configurable TTL (default: 24 hours)
  - Memory cache with optional file persistence

- [ ] T184 [US12] Create ClassificationResult interface
  - index: number
  - type: CROType
  - confidence: number (0-1)
  - reasoning: string
  - classificationSource: 'llm'

- [ ] T185 [P] Update DOMNode interface for classification source
  - Add classificationSource: 'selector' | 'llm'
  - Track which method classified each element

- [ ] T186 [US12] Integrate LLM classifier into extractor.ts
  - After selector-based classification
  - Filter unclassified interactive elements (confidence < 0.5)
  - Batch send to LLM classifier
  - Update elements with LLM results

- [ ] T187 [P] Add feature flag for LLM classification
  - useLLMClassification: boolean (default: true)
  - CLI flag: --no-llm-classification
  - Config option in BrowserAgentConfig

- [ ] T188 [P] Create tests/unit/llm-classifier.test.ts (10 tests)
  - Test: Formats elements correctly for prompt
  - Test: Parses JSON response correctly
  - Test: Handles invalid JSON gracefully
  - Test: Batches large element sets
  - Test: Caches results by fingerprint
  - Test: Cache TTL respected
  - Test: Timeout handling

- [ ] T189 [P] Create tests/unit/classification-prompt.test.ts (5 tests)
  - Test: System prompt includes all CRO types
  - Test: Element formatting includes tag, text, attrs
  - Test: Response parsing extracts all fields
  - Test: Handles malformed responses

- [ ] T190 [P] Create tests/integration/llm-classification.test.ts (7 tests)
  - Test: Unclassified elements sent to LLM
  - Test: LLM results merged into DOM tree
  - Test: Classification source tracked correctly
  - Test: Feature flag disables LLM
  - Test: Cache prevents duplicate API calls
  - Test: Timeout falls back gracefully

- [ ] T191 Add cost tracking for LLM classification
  - Track tokens used per classification
  - Log cost estimate per page

- [ ] T192 Update CLI output to show classification stats
  - Elements classified by selector: N
  - Elements classified by LLM: M
  - Estimated cost: $X.XX

**Checkpoint**: LLM classification catches unmatched elements

---

### Phase 20E: Enhanced Visibility & Context (T193-T202)

**Purpose**: Improve above-fold detection and add element context

- [ ] T193 [P] [US14] Improve above-fold detection algorithm
  - Use 50% visibility threshold (not just top edge)
  - Element must have 50%+ area in viewport
  - Update isAboveFold calculation in build-dom-tree.ts

- [ ] T194 [P] [US14] Add landmark context to DOMNode
  - landmark?: 'header' | 'nav' | 'main' | 'footer' | 'aside'
  - Detect from ARIA roles and semantic HTML
  - Traverse up to find containing landmark

- [ ] T195 [P] [US14] Add nearest heading context to DOMNode
  - nearestHeading?: { level: number; text: string }
  - Find nearest preceding h1-h6
  - Store level and text content

- [ ] T196 [P] [US14] Add occlusion detection
  - isOccluded?: boolean
  - occludedBy?: 'modal' | 'banner' | 'sticky_header' | 'cookie_consent'
  - Check if element covered by fixed/sticky elements

- [ ] T197 [P] Update build-dom-tree.ts with context fields
  - Add landmark detection
  - Add heading traversal
  - Add occlusion check

- [ ] T198 [P] Create tests/unit/above-fold-detection.test.ts (6 tests)
  - Test: Element 100% visible = above fold
  - Test: Element 50% visible = above fold
  - Test: Element 49% visible = not above fold
  - Test: Element below viewport = not above fold
  - Test: Handles zero-height elements

- [ ] T199 [P] Create tests/unit/landmark-context.test.ts (5 tests)
  - Test: Detects header landmark
  - Test: Detects main landmark
  - Test: Detects footer landmark
  - Test: Detects nav landmark
  - Test: Falls back to 'main' for body content

- [ ] T200 [P] Create tests/unit/occlusion-detection.test.ts (4 tests)
  - Test: Detects modal occlusion
  - Test: Detects sticky header occlusion
  - Test: Detects cookie banner occlusion
  - Test: Non-occluded elements marked correctly

- [ ] T201 [P] Create tests/integration/context-extraction.test.ts (5 tests)
  - Test: Full page context extraction
  - Test: Landmark context in DOM tree
  - Test: Heading context in DOM tree
  - Test: Occlusion detection on modal page

- [ ] T202 Update serializer to include context fields

**Checkpoint**: Enhanced visibility and context tracking complete

---

### Phase 20 Integration (T203-T206)

**Purpose**: Final integration and E2E tests

- [ ] T203 Create tests/e2e/hybrid-extraction.test.ts (3 tests)
  - Test: Full hybrid pipeline on Peregrine PDP
  - Test: Framework-agnostic detection + LLM fallback
  - Test: 95%+ element detection accuracy

- [ ] T204 Update existing E2E tests for new extraction
- [ ] T205 Update documentation for hybrid extraction
- [ ] T206 Performance benchmarks (extraction time, LLM cost)

**Checkpoint**: Phase 20 complete, all acceptance tests pass

---

## Task Summary

| Sub-Phase | Tasks | Tests | Purpose |
|-----------|-------|-------|---------|
| **20A** | T147-T158 (12) | 25 | Framework-agnostic detection |
| **20B** | T159-T170 (12) | 15 | Extended CRO types |
| **20C** | T171-T180 (10) | 23 | Multi-strategy selectors |
| **20D** | T181-T192 (12) | 22 | LLM DOM classification |
| **20E** | T193-T202 (10) | 20 | Visibility & context |
| **Integration** | T203-T206 (4) | 3 | E2E testing |
| **TOTAL** | **60 tasks** | **108 tests** | |
