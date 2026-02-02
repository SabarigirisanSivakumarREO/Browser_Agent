**Navigation**: [Index](./index.md) | [Previous](./phase-21.md)

---

## Phase 22: Page Type Knowledge Bases

**Purpose**: Add heuristics knowledge bases for all page types (PLP, Homepage, Cart, Checkout, Generic)

**Created**: 2026-01-29 (per CR-001)

**User Stories**: US10 (Page Type Support)

**Acceptance Tests**:
- loadHeuristics('plp') returns valid PageTypeHeuristics
- loadHeuristics('homepage') returns valid PageTypeHeuristics
- loadHeuristics('cart') returns valid PageTypeHeuristics
- loadHeuristics('checkout') returns valid PageTypeHeuristics
- loadHeuristics('other') returns valid PageTypeHeuristics (generic fallback)

---

### Phase 22A: PLP Knowledge Base (T400-T409)

**Purpose**: Product Listing Page heuristics (~25-30 rules)

- [ ] **T400** [US10] [FR-343] Create `src/heuristics/knowledge/plp/` directory structure
- [ ] **T401** [US10] [FR-343a] Create `plp/layout-grid.json` - Grid layout, product card consistency
- [ ] **T402** [US10] [FR-343b] Create `plp/filtering-sorting.json` - Filter visibility, sort options
- [ ] **T403** [US10] [FR-343c] Create `plp/product-cards.json` - Card content, images, prices
- [ ] **T404** [US10] [FR-343d] Create `plp/pagination-loading.json` - Pagination, infinite scroll, load more
- [ ] **T405** [US10] [FR-343e] Create `plp/navigation-breadcrumbs.json` - Category nav, breadcrumbs
- [ ] **T406** [US10] [FR-343f] Create `plp/mobile-usability.json` - Touch targets, filter drawer
- [ ] **T407** [US10] [FR-343] Create `plp/index.ts` - Aggregate all PLP heuristics
- [ ] **T408** [US10] [FR-343, CR-041] Update `src/heuristics/knowledge/index.ts` - Add PLP support
- [ ] **T409** [US10] [SC-151] Create `tests/unit/knowledge-loader-plp.test.ts` (10 tests)

**Checkpoint**: loadHeuristics('plp') returns ~25-30 heuristics

---

### Phase 22B: Homepage Knowledge Base (T410-T417)

**Purpose**: Homepage heuristics (~20-25 rules)

- [ ] **T410** [US10] [FR-344] Create `src/heuristics/knowledge/homepage/` directory structure
- [ ] **T411** [US10] [FR-344a] Create `homepage/hero-section.json` - Hero content, CTA visibility
- [ ] **T412** [US10] [FR-344b] Create `homepage/value-proposition.json` - Brand promise, benefits
- [ ] **T413** [US10] [FR-344c] Create `homepage/navigation.json` - Main nav, search, categories
- [ ] **T414** [US10] [FR-344d] Create `homepage/trust-signals.json` - Social proof, testimonials
- [ ] **T415** [US10] [FR-344e] Create `homepage/featured-content.json` - Products, promotions
- [ ] **T416** [US10] [FR-344] Create `homepage/index.ts` - Aggregate all Homepage heuristics
- [ ] **T417** [US10] [SC-152] Create `tests/unit/knowledge-loader-homepage.test.ts` (8 tests)

**Checkpoint**: loadHeuristics('homepage') returns ~20-25 heuristics

---

### Phase 22C: Cart Knowledge Base (T418-T423)

**Purpose**: Cart page heuristics (~15-20 rules)

- [ ] **T418** [US10] [FR-345] Create `src/heuristics/knowledge/cart/` directory structure
- [ ] **T419** [US10] [FR-345a] Create `cart/cart-summary.json` - Items, quantities, totals
- [ ] **T420** [US10] [FR-345b] Create `cart/checkout-cta.json` - Checkout button visibility
- [ ] **T421** [US10] [FR-345c] Create `cart/trust-reassurance.json` - Security, returns, shipping
- [ ] **T422** [US10] [FR-345] Create `cart/index.ts` - Aggregate all Cart heuristics
- [ ] **T423** [US10] [SC-153] Create `tests/unit/knowledge-loader-cart.test.ts` (6 tests)

**Checkpoint**: loadHeuristics('cart') returns ~15-20 heuristics

---

### Phase 22D: Checkout Knowledge Base (T424-T433)

**Purpose**: Checkout page heuristics (~25-30 rules)

- [ ] **T424** [US10] [FR-346] Create `src/heuristics/knowledge/checkout/` directory structure
- [ ] **T425** [US10] [FR-346a] Create `checkout/form-design.json` - Form layout, labels, validation
- [ ] **T426** [US10] [FR-346b] Create `checkout/progress-indicator.json` - Steps, current position
- [ ] **T427** [US10] [FR-346c] Create `checkout/order-summary.json` - Items, totals, editable
- [ ] **T428** [US10] [FR-346d] Create `checkout/payment-options.json` - Payment methods, security
- [ ] **T429** [US10] [FR-346e] Create `checkout/shipping-options.json` - Delivery choices, costs
- [ ] **T430** [US10] [FR-346f] Create `checkout/trust-security.json` - SSL, badges, guarantees
- [ ] **T431** [US10] [FR-346g] Create `checkout/mobile-checkout.json` - Mobile-specific UX
- [ ] **T432** [US10] [FR-346] Create `checkout/index.ts` - Aggregate all Checkout heuristics
- [ ] **T433** [US10] [SC-154] Create `tests/unit/knowledge-loader-checkout.test.ts` (10 tests)

**Checkpoint**: loadHeuristics('checkout') returns ~25-30 heuristics

---

### Phase 22E: Generic Knowledge Base (T434-T437)

**Purpose**: Generic/fallback heuristics for unknown page types (~10-15 rules)

- [ ] **T434** [US10] [FR-347] Create `src/heuristics/knowledge/generic/` directory structure
- [ ] **T435** [US10] [FR-347a] Create `generic/general-ux.json` - Universal UX principles
- [ ] **T436** [US10] [FR-347] Create `generic/index.ts` - Aggregate all Generic heuristics
- [ ] **T437** [US10] [SC-155] Create `tests/unit/knowledge-loader-generic.test.ts` (4 tests)

**Checkpoint**: loadHeuristics('other') returns ~10-15 heuristics

---

## Task Summary

| Sub-Phase | Tasks | Heuristics | Tests | Purpose |
|-----------|-------|------------|-------|---------|
| **22A** | T400-T409 (10) | ~25-30 | 10 | PLP Knowledge Base |
| **22B** | T410-T417 (8) | ~20-25 | 8 | Homepage Knowledge Base |
| **22C** | T418-T423 (6) | ~15-20 | 6 | Cart Knowledge Base |
| **22D** | T424-T433 (10) | ~25-30 | 10 | Checkout Knowledge Base |
| **22E** | T434-T437 (4) | ~10-15 | 4 | Generic Knowledge Base |
| **TOTAL** | **38 tasks** | **~95-120** | **38 tests** | |

---

## Implementation Notes

1. **Follow PDP structure**: Use same JSON schema as PDP heuristics
2. **Baymard research**: Source heuristics from Baymard Institute studies
3. **Lazy loading**: Knowledge bases loaded on demand
4. **Tests**: Each knowledge base has loader tests verifying structure
