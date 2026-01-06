# Requirements: Phase 19-20 (Coverage & Pipeline)

**Navigation**: [Index](./index.md) | [CRO Requirements](./requirements-cro.md)

---

## Coverage System Requirements (Phase 19)

**Functional Requirements**:
- **FR-098**: System MUST provide ScanMode type with values: 'full_page' (default), 'above_fold', 'llm_guided'
- **FR-099**: System MUST provide CoverageTracker class that tracks page segments and element discovery
- **FR-100**: System MUST initialize segments based on page height with configurable overlap (default 100px)
- **FR-101**: System MUST track which segments have been scanned and calculate coverage percentage
- **FR-102**: System MUST record all discovered CRO elements with their first-seen segment
- **FR-103**: System MUST block 'done' action when coverage < minCoveragePercent (default 100%)
- **FR-104**: System MUST auto-scroll to next uncovered segment when 'done' is blocked
- **FR-105**: System MUST provide DOMMerger class that merges DOM snapshots from multiple segments
- **FR-106**: System MUST convert bounding box coordinates from viewport-relative to page-absolute
- **FR-107**: System MUST calculate dynamic maxSteps based on page height and viewport size
- **FR-108**: System MUST include coverage report in LLM prompts showing scanned/unscanned regions
- **FR-109**: System MUST provide getCoverageReport() for human-readable coverage status

**Configuration Requirements**:
- **CR-022**: ScanMode MUST default to 'full_page' for guaranteed coverage
- **CR-023**: minCoveragePercent MUST default to 100 (full coverage required)
- **CR-024**: segmentOverlapPx MUST default to 100 for seamless element capture
- **CR-025**: Token budget MUST be 32000 for full_page mode (vs 8000 for llm_guided)
- **CR-026**: Dynamic maxSteps MUST be calculated as: segments + analysisTools + 2

**CLI Requirements**:
- **FR-110**: CLI MUST support --scan-mode flag with values: full_page, above_fold, llm_guided
- **FR-111**: CLI MUST support --min-coverage flag (0-100, default 100)
- **FR-112**: CLI MUST default to full_page scan mode when no --scan-mode specified

### Success Criteria (Phase 19)

**Coverage Tracker**:
- **SC-060**: CoverageTracker initializes correct segment count for page dimensions
- **SC-061**: CoverageTracker marks segments scanned and updates coverage percentage
- **SC-062**: CoverageTracker returns next unscanned segment correctly
- **SC-063**: CoverageTracker generates accurate coverage report for LLM
- **SC-064**: Coverage enforcement blocks premature 'done' calls
- **SC-065**: Coverage enforcement forces scroll to uncovered segment

**DOM Handling**:
- **SC-066**: Bounding boxes use page-absolute coordinates (include scrollY)
- **SC-067**: DOMMerger correctly merges snapshots from multiple segments
- **SC-068**: DOMMerger deduplicates elements by xpath
- **SC-069**: DOMMerger recalculates element indices after merge

**Integration**:
- **SC-070**: full_page mode achieves 100% coverage on 3-viewport test page
- **SC-071**: full_page mode achieves 100% coverage on 10-viewport test page
- **SC-072**: above_fold mode only scans initial viewport
- **SC-073**: llm_guided mode preserves original behavior
- **SC-074**: Dynamic maxSteps adjusts for page height

**Test Totals**:
- **SC-075**: Phase 19 adds 26 tests (16 unit + 6 integration + 4 e2e)

---

## Hybrid Extraction Pipeline Requirements (Phase 20)

**Overview**: Replace the original 10-module extraction pipeline with a focused hybrid approach that combines framework-agnostic selectors, LLM DOM classification, and vision analysis for near-100% element detection accuracy.

**Architecture**:
```
Layer 1: Framework-Agnostic Selectors (Free, Fast)
   ↓ High-confidence elements pass through
   ↓ Low-confidence elements → Layer 2
Layer 2: LLM DOM Classification (Paid, Accurate)
   ↓ Classifies unmatched interactive elements
Layer 3: Vision Analysis (Already Built - Phase 21)
   ↓ UX-level heuristic evaluation
Output: Complete CRO Analysis
```

### Phase 20A: Framework-Agnostic CRO Detection

**Functional Requirements**:
- **FR-113**: System MUST detect CRO elements using semantic HTML patterns (button, a[href], type=submit, role=button) regardless of CSS framework
- **FR-114**: System MUST detect CRO elements using text patterns (add to cart, buy now, checkout, subscribe, etc.)
- **FR-115**: System MUST detect CRO elements using ARIA patterns (aria-label, role attributes)
- **FR-116**: System MUST detect CRO elements using common data attributes (data-testid, data-action)
- **FR-117**: System MAY detect e-commerce platform (Shopify, WooCommerce, Magento) and apply platform-specific selectors as bonus layer
- **FR-118**: System MUST work on sites using Tailwind CSS, Styled Components, CSS Modules, or any custom CSS framework

**Configuration Requirements**:
- **CR-027**: Text pattern matching MUST be case-insensitive
- **CR-028**: Selector weights MUST be configurable (default: semantic HTML 0.7-0.9, text 0.8-0.9, ARIA 0.8-0.85)

### Phase 20B: Extended CRO Types

**Functional Requirements**:
- **FR-119**: System MUST classify `price` elements (current, original, sale prices)
- **FR-120**: System MUST classify `variant_selector` elements (size, color, option selectors)
- **FR-121**: System MUST classify `stock_status` elements (in stock, out of stock, limited)
- **FR-122**: System MUST classify `delivery_info` elements (shipping, returns information)
- **FR-123**: System MUST classify `product_image` elements (main product images)
- **FR-124**: System MUST classify `review_widget` elements (ratings, reviews displays)
- **FR-125**: System MUST extend CROType union to include new types

### Phase 20C: Multi-Strategy Selectors

**Functional Requirements**:
- **FR-126**: System MUST define SelectorBundle with preferred CSS selector and fallback strategies
- **FR-127**: System MUST define SelectorStrategy union: role, text, nth, xpath
- **FR-128**: System MUST generate SelectorBundle for each indexed element with:
  - preferred: data-testid or id-based CSS selector (if available)
  - css: Robust CSS selector
  - xpath: Current XPath (fallback)
  - text: Button/link text content (for interactive elements)
- **FR-129**: System MUST provide SelectorResolver that tries strategies in order until unique match

**Configuration Requirements**:
- **CR-029**: SelectorResolver MUST timeout after 5s per strategy attempt
- **CR-030**: SelectorResolver MUST never throw, return null on failure

### Phase 20D: LLM DOM Classification

**Functional Requirements**:
- **FR-130**: System MUST identify unclassified interactive elements (croType null or confidence < 0.5)
- **FR-131**: System MUST batch unclassified elements and send to LLM for classification
- **FR-132**: System MUST use classification prompt that returns: type, confidence, reasoning
- **FR-133**: System MUST support CRO types: cta, form, trust_signal, value_prop, navigation, price, variant_selector, stock_status, delivery_info, review_widget, other
- **FR-134**: System MUST track classificationSource: 'selector' | 'llm' for each element
- **FR-135**: System MUST cache LLM classifications by element fingerprint

**Configuration Requirements**:
- **CR-031**: LLM classification MUST use gpt-4o-mini by default (cost optimization)
- **CR-032**: LLM classification MUST batch up to 30 elements per API call
- **CR-033**: LLM classification timeout MUST be 30 seconds
- **CR-034**: Classification cache TTL MUST be configurable (default: 24 hours)

### Phase 20E: Enhanced Visibility & Context

**Functional Requirements**:
- **FR-136**: System MUST use 50% visibility threshold for above-fold detection
- **FR-137**: System MUST track landmark context (header, nav, main, footer, aside) for each element
- **FR-138**: System MUST track nearest heading context for each element
- **FR-139**: System MUST detect element occlusion (covered by modal, banner, sticky header)

### Success Criteria (Phase 20)

**Phase 20A - Framework-Agnostic Detection**:
- **SC-076**: Semantic HTML patterns detect buttons regardless of CSS classes
- **SC-077**: Text patterns detect CTAs with "add to cart", "buy now", etc.
- **SC-078**: ARIA patterns detect elements with role=button, aria-label
- **SC-079**: Detection works on Tailwind CSS sites (utility classes only)
- **SC-080**: Detection works on Styled Components sites (hashed classes)
- **SC-081**: Platform detection identifies Shopify, WooCommerce (optional)

**Phase 20B - Extended CRO Types**:
- **SC-082**: Price elements detected and classified
- **SC-083**: Variant selectors detected and classified
- **SC-084**: Stock status elements detected and classified
- **SC-085**: Delivery info elements detected and classified
- **SC-086**: CROType union includes all new types

**Phase 20C - Multi-Strategy Selectors**:
- **SC-087**: SelectorBundle generated with preferred + fallback strategies
- **SC-088**: SelectorResolver tries strategies in order
- **SC-089**: SelectorResolver returns null on failure (never throws)
- **SC-090**: Elements can be re-selected after page navigation

**Phase 20D - LLM Classification**:
- **SC-091**: Unclassified interactive elements identified correctly
- **SC-092**: LLM classification returns valid CRO types
- **SC-093**: Classification source tracked ('selector' vs 'llm')
- **SC-094**: LLM classifications cached by fingerprint
- **SC-095**: Batch classification reduces API calls

**Phase 20E - Visibility & Context**:
- **SC-096**: Above-fold detection uses 50% visibility threshold
- **SC-097**: Landmark context tracked for each element
- **SC-098**: Nearest heading context tracked for each element
- **SC-099**: Occluded elements detected correctly

**Integration**:
- **SC-100**: Hybrid detection achieves 95%+ element accuracy
- **SC-101**: Cost per page ~$0.01-0.02 for LLM classification
- **SC-102**: Total extraction time < 5 seconds (excluding LLM)

**Test Totals**:
- **SC-103**: Phase 20 adds ~100 tests (75 unit + 20 integration + 5 e2e)
