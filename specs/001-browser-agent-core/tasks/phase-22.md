**Navigation**: [Index](./index.md) | [Previous](./phase-21.md)

---

## Phase 22: Page Type Knowledge Bases

**Purpose**: Add heuristics knowledge bases for all page types (PLP, Homepage, Cart, Checkout, Generic)

**Status**: ⏳ IN PROGRESS (22A ✅, 22B-E 📋)

**Created**: 2026-01-29 (per CR-001)

**User Stories**: US10 (Page Type Support)

**Acceptance Tests**:
- loadHeuristics('plp') returns valid PageTypeHeuristics ✅
- loadHeuristics('homepage') returns valid PageTypeHeuristics
- loadHeuristics('cart') returns valid PageTypeHeuristics
- loadHeuristics('checkout') returns valid PageTypeHeuristics
- loadHeuristics('other') returns valid PageTypeHeuristics (generic fallback)

---

### Phase 22A: PLP Knowledge Base (T578-T587) ✅ DONE

**Purpose**: Product Listing Page heuristics (25 rules across 6 categories)

- [x] **T578** [US10] [FR-343] Create `src/heuristics/knowledge/plp/` directory structure
- [x] **T579** [US10] [FR-343a] Create `plp/layout-grid.json` - Grid layout, product card consistency (5 heuristics)
- [x] **T580** [US10] [FR-343b] Create `plp/filtering-sorting.json` - Filter visibility, sort options (5 heuristics)
- [x] **T581** [US10] [FR-343c] Create `plp/product-cards.json` - Card content, images, prices (5 heuristics)
- [x] **T582** [US10] [FR-343d] Create `plp/pagination-loading.json` - Pagination, infinite scroll, load more (4 heuristics)
- [x] **T583** [US10] [FR-343e] Create `plp/navigation-breadcrumbs.json` - Category nav, breadcrumbs (3 heuristics)
- [x] **T584** [US10] [FR-343f] Create `plp/mobile-usability.json` - Touch targets, filter drawer (3 heuristics)
- [x] **T585** [US10] [FR-343] Create `plp/index.ts` - Aggregate all PLP heuristics
- [x] **T586** [US10] [FR-343, CR-041] Update `src/heuristics/knowledge/index.ts` + `types.ts` - Add PLP support
- [x] **T587** [US10] [SC-151] Create `tests/unit/knowledge-loader-plp.test.ts` (15 tests) + update existing PDP tests

**Checkpoint**: ✅ loadHeuristics('plp') returns 25 heuristics across 6 categories. 42 tests passing (27 PDP + 15 PLP).

---

### Phase 22B: Homepage Knowledge Base (T588-T595)

**Purpose**: Homepage heuristics (~20-25 rules)

- [ ] **T588** [US10] [FR-344] Create `src/heuristics/knowledge/homepage/` directory structure
- [ ] **T589** [US10] [FR-344a] Create `homepage/hero-section.json` - Hero content, CTA visibility
- [ ] **T590** [US10] [FR-344b] Create `homepage/value-proposition.json` - Brand promise, benefits
- [ ] **T591** [US10] [FR-344c] Create `homepage/navigation.json` - Main nav, search, categories
- [ ] **T592** [US10] [FR-344d] Create `homepage/trust-signals.json` - Social proof, testimonials
- [ ] **T593** [US10] [FR-344e] Create `homepage/featured-content.json` - Products, promotions
- [ ] **T594** [US10] [FR-344] Create `homepage/index.ts` - Aggregate all Homepage heuristics
- [ ] **T595** [US10] [SC-152] Create `tests/unit/knowledge-loader-homepage.test.ts` (8 tests)

**Checkpoint**: loadHeuristics('homepage') returns ~20-25 heuristics

---

### Phase 22C: Cart Knowledge Base (T596-T601)

**Purpose**: Cart page heuristics (~15-20 rules)

- [ ] **T596** [US10] [FR-345] Create `src/heuristics/knowledge/cart/` directory structure
- [ ] **T597** [US10] [FR-345a] Create `cart/cart-summary.json` - Items, quantities, totals
- [ ] **T598** [US10] [FR-345b] Create `cart/checkout-cta.json` - Checkout button visibility
- [ ] **T599** [US10] [FR-345c] Create `cart/trust-reassurance.json` - Security, returns, shipping
- [ ] **T600** [US10] [FR-345] Create `cart/index.ts` - Aggregate all Cart heuristics
- [ ] **T601** [US10] [SC-153] Create `tests/unit/knowledge-loader-cart.test.ts` (6 tests)

**Checkpoint**: loadHeuristics('cart') returns ~15-20 heuristics

---

### Phase 22D: Checkout Knowledge Base (T602-T611)

**Purpose**: Checkout page heuristics (~25-30 rules)

- [ ] **T602** [US10] [FR-346] Create `src/heuristics/knowledge/checkout/` directory structure
- [ ] **T603** [US10] [FR-346a] Create `checkout/form-design.json` - Form layout, labels, validation
- [ ] **T604** [US10] [FR-346b] Create `checkout/progress-indicator.json` - Steps, current position
- [ ] **T605** [US10] [FR-346c] Create `checkout/order-summary.json` - Items, totals, editable
- [ ] **T606** [US10] [FR-346d] Create `checkout/payment-options.json` - Payment methods, security
- [ ] **T607** [US10] [FR-346e] Create `checkout/shipping-options.json` - Delivery choices, costs
- [ ] **T608** [US10] [FR-346f] Create `checkout/trust-security.json` - SSL, badges, guarantees
- [ ] **T609** [US10] [FR-346g] Create `checkout/mobile-checkout.json` - Mobile-specific UX
- [ ] **T610** [US10] [FR-346] Create `checkout/index.ts` - Aggregate all Checkout heuristics
- [ ] **T611** [US10] [SC-154] Create `tests/unit/knowledge-loader-checkout.test.ts` (10 tests)

**Checkpoint**: loadHeuristics('checkout') returns ~25-30 heuristics

---

### Phase 22E: Generic Knowledge Base (T612-T615)

**Purpose**: Generic/fallback heuristics for unknown page types (~10-15 rules)

- [ ] **T612** [US10] [FR-347] Create `src/heuristics/knowledge/generic/` directory structure
- [ ] **T613** [US10] [FR-347a] Create `generic/general-ux.json` - Universal UX principles
- [ ] **T614** [US10] [FR-347] Create `generic/index.ts` - Aggregate all Generic heuristics
- [ ] **T615** [US10] [SC-155] Create `tests/unit/knowledge-loader-generic.test.ts` (4 tests)

**Checkpoint**: loadHeuristics('other') returns ~10-15 heuristics

---

## Task Summary

| Sub-Phase | Tasks | Heuristics | Tests | Purpose | Status |
|-----------|-------|------------|-------|---------|--------|
| **22A** | T578-T587 (10) | 25 | 15 | PLP Knowledge Base | ✅ |
| **22B** | T588-T595 (8) | ~20-25 | 8 | Homepage Knowledge Base | 📋 |
| **22C** | T596-T601 (6) | ~15-20 | 6 | Cart Knowledge Base | 📋 |
| **22D** | T602-T611 (10) | ~25-30 | 10 | Checkout Knowledge Base | 📋 |
| **22E** | T612-T615 (4) | ~10-15 | 4 | Generic Knowledge Base | 📋 |
| **TOTAL** | **38 tasks** | **~95-120** | **~43** | | |

---

## Implementation Notes

1. **Follow PDP structure**: Use same JSON schema as PDP heuristics
2. **LLM-generated**: Heuristics generated from CRO/UX best practices, user reviews and refines
3. **Lazy loading**: Knowledge bases loaded on demand with caching
4. **Tests**: Each knowledge base has loader tests verifying structure
5. **ID format**: `{PAGETYPE}-{CATEGORY}-{NNN}` (e.g., PLP-GRID-001, HP-HERO-001)
