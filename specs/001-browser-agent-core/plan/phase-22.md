**Navigation**: [Index](./index.md) | [Previous](./phase-21.md)

## Phase 22: Page Type Knowledge Bases

### Summary

Add heuristics knowledge bases for all page types beyond PDP, enabling comprehensive CRO analysis across entire ecommerce flows.

**Goal**: Every page type gets its own knowledge base of Baymard-research-backed heuristics.

**Created**: 2026-01-29 (per CR-001)

---

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│               PAGE TYPE KNOWLEDGE BASES (Phase 22)                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  src/heuristics/knowledge/                                                      │
│  ├── index.ts              # loadHeuristics(pageType) dispatcher                │
│  ├── types.ts              # HeuristicItem, HeuristicCategory, PageTypeHeuristics│
│  ├── pdp/                  # ✅ COMPLETE (Phase 21b) - 35 heuristics            │
│  ├── plp/                  # 📋 Phase 22A - ~25-30 heuristics                   │
│  │   ├── layout-grid.json                                                       │
│  │   ├── filtering-sorting.json                                                 │
│  │   ├── product-cards.json                                                     │
│  │   ├── pagination-loading.json                                                │
│  │   ├── navigation-breadcrumbs.json                                            │
│  │   ├── mobile-usability.json                                                  │
│  │   └── index.ts                                                               │
│  ├── homepage/             # 📋 Phase 22B - ~20-25 heuristics                   │
│  │   ├── hero-section.json                                                      │
│  │   ├── value-proposition.json                                                 │
│  │   ├── navigation.json                                                        │
│  │   ├── trust-signals.json                                                     │
│  │   ├── featured-content.json                                                  │
│  │   └── index.ts                                                               │
│  ├── cart/                 # 📋 Phase 22C - ~15-20 heuristics                   │
│  │   ├── cart-summary.json                                                      │
│  │   ├── checkout-cta.json                                                      │
│  │   ├── trust-reassurance.json                                                 │
│  │   └── index.ts                                                               │
│  ├── checkout/             # 📋 Phase 22D - ~25-30 heuristics                   │
│  │   ├── form-design.json                                                       │
│  │   ├── progress-indicator.json                                                │
│  │   ├── order-summary.json                                                     │
│  │   ├── payment-options.json                                                   │
│  │   ├── shipping-options.json                                                  │
│  │   ├── trust-security.json                                                    │
│  │   ├── mobile-checkout.json                                                   │
│  │   └── index.ts                                                               │
│  └── generic/              # 📋 Phase 22E - ~10-15 heuristics                   │
│      ├── general-ux.json                                                        │
│      └── index.ts                                                               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### Sub-Phases

| Sub-Phase | Focus | Tasks | Heuristics | Tests |
|-----------|-------|-------|------------|-------|
| 22A | PLP Knowledge Base | T400-T409 (10) | ~25-30 | 10 |
| 22B | Homepage Knowledge Base | T410-T417 (8) | ~20-25 | 8 |
| 22C | Cart Knowledge Base | T418-T423 (6) | ~15-20 | 6 |
| 22D | Checkout Knowledge Base | T424-T433 (10) | ~25-30 | 10 |
| 22E | Generic Knowledge Base | T434-T437 (4) | ~10-15 | 4 |
| **TOTAL** | | **38 tasks** | **~95-120** | **38 tests** |

---

### Knowledge Base JSON Schema

All knowledge bases follow the same schema established in Phase 21b:

```json
{
  "name": "Category Name",
  "description": "What this category covers",
  "heuristics": [
    {
      "id": "PAGETYPE-CATEGORY-NNN",
      "principle": "The UX principle from Baymard research",
      "checkpoints": [
        "Specific thing to verify visually",
        "Another checkpoint"
      ],
      "severity": "critical | high | medium | low",
      "category": "Category Name"
    }
  ]
}
```

**ID Format**: `{PAGETYPE}-{CATEGORY}-{NNN}`
- PLP: `PLP-GRID-001`, `PLP-FILTER-001`
- Homepage: `HOME-HERO-001`, `HOME-NAV-001`
- Cart: `CART-SUMMARY-001`, `CART-CTA-001`
- Checkout: `CHECKOUT-FORM-001`, `CHECKOUT-PAY-001`
- Generic: `GEN-UX-001`

---

### Integration

Knowledge bases integrate with the existing unified agent architecture (CR-001):

```typescript
// In analysis orchestrator
const heuristics = await loadHeuristics(detectedPageType);
// Returns PageTypeHeuristics with all categories for that page type

// Categories are analyzed one at a time
for (const category of heuristics.categories) {
  const result = await analyzeCategory(snapshots, category, pageType);
  evaluations.push(...result.evaluations);
}
```

---

### Implementation Notes

1. **Source**: Baymard Institute research (baymard.com)
2. **Follow PDP structure**: Use identical JSON schema
3. **Lazy loading**: Knowledge bases loaded on demand
4. **No code changes**: Only JSON files + index.ts aggregators
5. **Tests**: Loader tests verify structure and counts

---

### Related Files

- **Tasks**: [../tasks/phase-22.md](../tasks/phase-22.md)
- **Existing PDP KB**: `src/heuristics/knowledge/pdp/`
- **Loader**: `src/heuristics/knowledge/index.ts`
