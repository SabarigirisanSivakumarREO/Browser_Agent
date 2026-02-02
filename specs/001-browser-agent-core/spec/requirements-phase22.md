**Navigation**: [Index](./index.md) | [Previous](./requirements-phase21.md)

---

## Phase 22: Page Type Knowledge Bases Requirements

**Purpose**: Requirements for adding heuristics knowledge bases for all page types (PLP, Homepage, Cart, Checkout, Generic)

**Created**: 2026-01-29 (per CR-001)

---

### Functional Requirements

#### FR-343: PLP Knowledge Base
The system shall provide a PLP (Product Listing Page) knowledge base with ~25-30 heuristics covering:
- Grid layout and product card consistency
- Filtering and sorting functionality
- Product card content (images, prices, ratings)
- Pagination and infinite scroll
- Navigation and breadcrumbs
- Mobile usability

**Sub-Requirements**:
- **FR-343a**: `plp/layout-grid.json` - Grid layout, product card consistency (~4-5 heuristics)
- **FR-343b**: `plp/filtering-sorting.json` - Filter visibility, sort options (~4-5 heuristics)
- **FR-343c**: `plp/product-cards.json` - Card content, images, prices (~5-6 heuristics)
- **FR-343d**: `plp/pagination-loading.json` - Pagination, infinite scroll, load more (~4 heuristics)
- **FR-343e**: `plp/navigation-breadcrumbs.json` - Category nav, breadcrumbs (~3-4 heuristics)
- **FR-343f**: `plp/mobile-usability.json` - Touch targets, filter drawer (~4-5 heuristics)

**Acceptance Criteria**:
- `loadHeuristics('plp')` returns valid PageTypeHeuristics
- All heuristics follow established JSON schema
- Each heuristic has id, principle, checkpoints, severity, category

#### FR-344: Homepage Knowledge Base
The system shall provide a Homepage knowledge base with ~20-25 heuristics covering:
- Hero section and primary CTA
- Value proposition clarity
- Main navigation and search
- Trust signals and testimonials
- Featured content and promotions

**Sub-Requirements**:
- **FR-344a**: `homepage/hero-section.json` - Hero content, CTA visibility (~5-6 heuristics)
- **FR-344b**: `homepage/value-proposition.json` - Brand promise, benefits (~4-5 heuristics)
- **FR-344c**: `homepage/navigation.json` - Main nav, search, categories (~4-5 heuristics)
- **FR-344d**: `homepage/trust-signals.json` - Social proof, testimonials (~3-4 heuristics)
- **FR-344e**: `homepage/featured-content.json` - Products, promotions (~4-5 heuristics)

**Acceptance Criteria**:
- `loadHeuristics('homepage')` returns valid PageTypeHeuristics
- All heuristics follow established JSON schema

#### FR-345: Cart Knowledge Base
The system shall provide a Cart page knowledge base with ~15-20 heuristics covering:
- Cart summary (items, quantities, totals)
- Checkout CTA visibility and prominence
- Trust and reassurance elements
- Edit and update functionality

**Sub-Requirements**:
- **FR-345a**: `cart/cart-summary.json` - Items, quantities, totals (~5-6 heuristics)
- **FR-345b**: `cart/checkout-cta.json` - Checkout button visibility (~4-5 heuristics)
- **FR-345c**: `cart/trust-reassurance.json` - Security, returns, shipping (~5-6 heuristics)

**Acceptance Criteria**:
- `loadHeuristics('cart')` returns valid PageTypeHeuristics
- All heuristics follow established JSON schema

#### FR-346: Checkout Knowledge Base
The system shall provide a Checkout knowledge base with ~25-30 heuristics covering:
- Form design and validation
- Progress indicator
- Order summary visibility
- Payment options and security
- Shipping options and costs
- Trust and security signals
- Mobile checkout experience

**Sub-Requirements**:
- **FR-346a**: `checkout/form-design.json` - Form layout, labels, validation (~5-6 heuristics)
- **FR-346b**: `checkout/progress-indicator.json` - Steps, current position (~3-4 heuristics)
- **FR-346c**: `checkout/order-summary.json` - Items, totals, editable (~3-4 heuristics)
- **FR-346d**: `checkout/payment-options.json` - Payment methods, security (~4-5 heuristics)
- **FR-346e**: `checkout/shipping-options.json` - Delivery choices, costs (~3-4 heuristics)
- **FR-346f**: `checkout/trust-security.json` - SSL, badges, guarantees (~3-4 heuristics)
- **FR-346g**: `checkout/mobile-checkout.json` - Mobile-specific UX (~3-4 heuristics)

**Acceptance Criteria**:
- `loadHeuristics('checkout')` returns valid PageTypeHeuristics
- All heuristics follow established JSON schema

#### FR-347: Generic Knowledge Base
The system shall provide a Generic/fallback knowledge base with ~10-15 heuristics for unknown page types covering:
- Universal UX principles
- Basic accessibility
- Core conversion elements

**Sub-Requirements**:
- **FR-347a**: `generic/general-ux.json` - Universal UX principles (~10-15 heuristics)

**Acceptance Criteria**:
- `loadHeuristics('other')` returns valid PageTypeHeuristics
- Used as fallback when page type is unknown

---

### Configuration Requirements

#### CR-041: Knowledge Base Selection
The system shall automatically select the appropriate knowledge base based on detected page type.

#### CR-042: Knowledge Base Lazy Loading
Knowledge bases shall be loaded on demand to minimize memory usage.

#### CR-043: Knowledge Base Extensibility
New knowledge bases shall be addable without code changes to the analyzer.

---

### Success Criteria

#### SC-151: PLP Analysis Coverage
The system shall evaluate ~25-30 PLP-specific heuristics when analyzing product listing pages.

#### SC-152: Homepage Analysis Coverage
The system shall evaluate ~20-25 Homepage-specific heuristics when analyzing home pages.

#### SC-153: Cart Analysis Coverage
The system shall evaluate ~15-20 Cart-specific heuristics when analyzing cart pages.

#### SC-154: Checkout Analysis Coverage
The system shall evaluate ~25-30 Checkout-specific heuristics when analyzing checkout pages.

#### SC-155: Generic Fallback Coverage
The system shall evaluate ~10-15 generic heuristics when page type is unknown.

#### SC-156: Total Heuristic Coverage
The system shall support 130-155 total heuristics across all page types:
- PDP: 35 (existing)
- PLP: ~25-30
- Homepage: ~20-25
- Cart: ~15-20
- Checkout: ~25-30
- Generic: ~10-15

---

### Heuristic ID Format

All heuristics shall follow the naming convention: `{PAGETYPE}-{CATEGORY}-{NNN}`

| Page Type | Prefix | Example |
|-----------|--------|---------|
| PDP | `PDP-` | `PDP-PRICE-001` |
| PLP | `PLP-` | `PLP-GRID-001` |
| Homepage | `HOME-` | `HOME-HERO-001` |
| Cart | `CART-` | `CART-SUMMARY-001` |
| Checkout | `CHECKOUT-` | `CHECKOUT-FORM-001` |
| Generic | `GEN-` | `GEN-UX-001` |

---

### Related

- **Plan**: [../plan/phase-22.md](../plan/phase-22.md)
- **Tasks**: [../tasks/phase-22.md](../tasks/phase-22.md)
- **Existing PDP KB**: Phase 21b (FR-171 to FR-190)
