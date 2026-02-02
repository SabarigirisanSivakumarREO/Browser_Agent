# Implementation Plan: Goal-Oriented CRO Analysis

**Status**: AWAITING REVIEW
**Created**: 2026-01-21

---

## Summary

Transform the Browser Agent from a **pattern-matching element finder** into a **goal-oriented CRO analyst** that:

1. Understands page purpose
2. Identifies the PRIMARY conversion action
3. Evaluates the conversion funnel
4. Generates impact-quantified insights

---

## Files Created So Far

| File | Status | Purpose |
|------|--------|---------|
| `specs/REDESIGN-PROPOSAL.md` | ✅ Created | Architecture design |
| `src/detection/semantic-matcher.ts` | ✅ Created | Fixed class matching |
| `src/detection/page-analyzer.ts` | ✅ Created | Page understanding |
| `src/detection/index.ts` | ✅ Created | Module exports |

---

## Implementation Phases

### Phase 1: Foundation (Non-Breaking)
**Adds new modules without changing existing behavior**

| # | Component | File | Purpose | Tests |
|---|-----------|------|---------|-------|
| 1.1 | SemanticMatcher | `src/detection/semantic-matcher.ts` | ✅ Fix class matching | 25 |
| 1.2 | PageAnalyzer | `src/detection/page-analyzer.ts` | ✅ Detect page type/goal | 20 |
| 1.3 | PrimaryActionDetector | `src/detection/primary-action-detector.ts` | Find THE conversion action | 20 |
| 1.4 | ElementClassifier | `src/analyzer/element-classifier.ts` | Priority: Primary→Supporting→Secondary | 25 |

**Deliverable**: New detection system that can run alongside existing code

---

### Phase 2: Funnel System
**Adds funnel templates and analysis**

| # | Component | File | Purpose | Tests |
|---|-----------|------|---------|-------|
| 2.1 | FunnelTemplates | `src/funnel/templates/*.ts` | PDP, Lead Gen, SaaS templates | 15 |
| 2.2 | FunnelMatcher | `src/funnel/funnel-matcher.ts` | Match page to funnel | 15 |
| 2.3 | FunnelAnalyzer | `src/analyzer/funnel-analyzer.ts` | Evaluate each funnel step | 30 |
| 2.4 | FrictionDetector | `src/analyzer/friction-detector.ts` | Find blockers per step | 20 |

**Deliverable**: Funnel-aware analysis system

---

### Phase 3: DOM+Vision Correlation
**Deep integration of structural and visual analysis**

| # | Component | File | Purpose | Tests |
|---|-----------|------|---------|-------|
| 3.1 | SmartDOMExtractor | `src/browser/dom/smart-extractor.ts` | Priority-based extraction | 20 |
| 3.2 | VisualMetricsCollector | `src/analyzer/visual-metrics.ts` | Prominence, contrast, whitespace | 15 |
| 3.3 | DOMVisionCorrelator | `src/analyzer/dom-vision-correlator.ts` | Cross-reference findings | 25 |

**Deliverable**: Integrated DOM+Vision analysis

---

### Phase 4: Insight Engine
**Generate impact-quantified, funnel-aware insights**

| # | Component | File | Purpose | Tests |
|---|-----------|------|---------|-------|
| 4.1 | ImpactEstimator | `src/analyzer/impact-estimator.ts` | Conversion impact calculation | 15 |
| 4.2 | FunnelInsightEngine | `src/analyzer/insight-engine.ts` | Generate prioritized insights | 25 |
| 4.3 | RecommendationGenerator | `src/analyzer/recommendation-generator.ts` | Actionable fix suggestions | 15 |

**Deliverable**: Business-impact-aware insight generation

---

### Phase 5: New Agent Loop
**Goal-oriented agent with funnel evaluation**

| # | Component | File | Purpose | Tests |
|---|-----------|------|---------|-------|
| 5.1 | GoalOrientedAgent | `src/agent/goal-oriented-agent.ts` | New analysis flow | 30 |
| 5.2 | CLI Integration | `src/cli.ts` | `--goal-oriented` flag | 10 |
| 5.3 | Output Formatter | `src/output/funnel-report-formatter.ts` | New report format | 10 |

**Deliverable**: Complete new analysis mode

---

### Phase 6: Migration
**Make goal-oriented the default**

| # | Task | Purpose |
|---|------|---------|
| 6.1 | Default mode switch | `--goal-oriented` becomes default |
| 6.2 | Legacy flag | `--legacy` for old behavior |
| 6.3 | Documentation | Update all docs |
| 6.4 | Deprecation notices | Warn on legacy usage |

---

## New File Structure

```
src/
├── detection/                       # NEW MODULE
│   ├── semantic-matcher.ts         # ✅ Created - Fixed class matching
│   ├── page-analyzer.ts            # ✅ Created - Page understanding
│   ├── primary-action-detector.ts  # Find THE action
│   └── index.ts                    # ✅ Created
│
├── analyzer/                        # NEW MODULE
│   ├── element-classifier.ts       # Priority classification
│   ├── funnel-analyzer.ts          # Funnel step evaluation
│   ├── friction-detector.ts        # Find blockers
│   ├── visual-metrics.ts           # Visual prominence
│   ├── dom-vision-correlator.ts    # Integrated analysis
│   ├── impact-estimator.ts         # Conversion impact
│   ├── insight-engine.ts           # Generate insights
│   ├── recommendation-generator.ts # Fix suggestions
│   └── index.ts
│
├── funnel/                          # NEW MODULE
│   ├── templates/
│   │   ├── pdp.ts                  # Product page funnel
│   │   ├── lead-gen.ts             # Lead gen funnel
│   │   ├── saas-landing.ts         # SaaS funnel
│   │   ├── plp.ts                  # Listing page funnel
│   │   └── index.ts
│   ├── funnel-matcher.ts           # Match page to template
│   ├── types.ts                    # Funnel types
│   └── index.ts
│
├── agent/
│   ├── goal-oriented-agent.ts      # NEW - Goal-oriented loop
│   ├── cro-agent.ts                # Existing (becomes legacy)
│   └── ...
│
├── browser/dom/
│   ├── smart-extractor.ts          # NEW - Priority extraction
│   ├── build-dom-tree.ts           # MODIFY - Add semantic matching
│   └── ...
│
├── output/
│   ├── funnel-report-formatter.ts  # NEW - Funnel report format
│   └── ...
│
└── cli.ts                           # MODIFY - Add --goal-oriented
```

---

## Key Architectural Decisions

### 1. Element Priority System

```typescript
enum ElementPriority {
  PRIMARY = 1,      // THE conversion action (Add to Cart)
  SUPPORTING = 2,   // Required for conversion (Size selector, Price)
  SECONDARY = 3,    // Helpful (Reviews, Related products)
  PERIPHERAL = 4,   // Navigation, footer, etc.
}
```

**Rationale**: Current system treats all elements equally. Primary action issues should always be critical.

### 2. Funnel Templates

```typescript
const PDP_FUNNEL = {
  goal: 'Add product to cart',
  steps: [
    { name: 'View Product', required: true },
    { name: 'Check Price', required: true },
    { name: 'Select Variant', required: 'if_variants' },
    { name: 'Add to Cart', required: true },
  ],
};
```

**Rationale**: Different page types have different conversion paths. Templates encode expert knowledge.

### 3. Semantic Matching (Replaces Substring)

```typescript
// OLD (broken): classes.includes('nav') matches 'unavailable'
// NEW (fixed): matchesWithWordBoundary('unavailable', 'nav') = false

function matchesWithWordBoundary(value: string, pattern: string): boolean {
  // "btn-primary" matches "btn" ✓
  // "btnWrapper" does NOT match "btn" ✗
  const regex = new RegExp(`(^|[-_])${pattern}([-_]|$)`);
  return regex.test(value);
}
```

**Rationale**: Current substring matching has 15-25% false positive rate.

### 4. Impact-Based Severity

```typescript
function calculateSeverity(
  elementPriority: ElementPriority,
  frictionType: FrictionType
): Severity {
  // Primary action issues are always critical or high
  if (elementPriority === PRIMARY) {
    return frictionType === 'NOT_VISIBLE' ? 'critical' : 'high';
  }
  // ...
}
```

**Rationale**: Severity should reflect business impact, not just issue type.

### 5. DOM+Vision Correlation

```typescript
// Instead of parallel analysis, correlate findings:
const insight = {
  finding: 'Primary CTA has low visual prominence',
  domEvidence: 'Button at y=1200px (below fold)',
  visualEvidence: 'Prominence score: 35/100, 3 competing elements',
  impact: 25, // % conversion loss
};
```

**Rationale**: Current system runs DOM and Vision separately. Combined analysis is more powerful.

---

## Token Budget Strategy

### Current (Wasteful)
```
All elements extracted → Serialized in DOM order → Truncated at budget
```

**Problem**: Important elements at bottom get cut.

### Proposed (Smart)
```
Token Allocation:
├── Primary Action: 30% (2400 tokens for 8K budget)
├── Supporting Elements: 40% (3200 tokens)
├── Secondary Elements: 20% (1600 tokens)
└── Metadata: 10% (800 tokens)
```

**Benefit**: Primary action always fully described.

---

## Breaking Changes

| Change | Impact | Migration |
|--------|--------|-----------|
| Default mode → goal-oriented | High | `--legacy` flag for old behavior |
| Insight format | Medium | New fields added, old fields preserved |
| DOM extraction | Low | Internal change, same output interface |

---

## Test Strategy

| Phase | Unit Tests | Integration Tests | E2E Tests |
|-------|------------|-------------------|-----------|
| 1: Foundation | 90 | 10 | - |
| 2: Funnel | 80 | 15 | 5 |
| 3: DOM+Vision | 60 | 20 | 5 |
| 4: Insights | 55 | 15 | 5 |
| 5: Agent | 30 | 20 | 10 |
| **Total** | **315** | **80** | **25** |

---

## Estimated Effort

| Phase | Components | Estimated Tests | Complexity |
|-------|------------|-----------------|------------|
| 1: Foundation | 4 | 90 | Medium |
| 2: Funnel | 4 | 80 | Medium |
| 3: DOM+Vision | 3 | 60 | High |
| 4: Insights | 3 | 55 | Medium |
| 5: Agent | 3 | 50 | High |
| 6: Migration | 4 | 20 | Low |
| **Total** | **21** | **355** | - |

---

## Expected Outcomes

### Before (Current System)
```
Found 23 insights:
- "Button text could be better" (medium)
- "Form has many fields" (medium)
- "Multiple CTAs" (low)
- ...20 more generic observations
```

### After (Proposed System)
```
Page: Product Detail Page (92% confidence)
Goal: Add to Cart

Funnel Analysis:
  Step 1: View Product ✓ (85/100)
  Step 2: Check Price ✓ (90/100)
  Step 3: Select Size ⚠ (60/100)
  Step 4: Add to Cart ✗ (35/100) ← CRITICAL

Critical Issues:
  1. PRIMARY ACTION BELOW FOLD
     Impact: 25-40% conversion loss
     Fix: Move to sticky header
     Expected Lift: 15-25%

Conversion Score: 52/100
```

---

## Questions for Review

1. **Phase Order**: Should we implement end-to-end (one feature through all phases) or breadth-first (all foundations, then all funnels, etc.)?

2. **Migration Strategy**: Should goal-oriented be opt-in first (`--goal-oriented`), or replace default immediately?

3. **Funnel Templates**: Which page types should we support initially?
   - PDP (Product Detail Page)
   - Lead Gen Landing Page
   - SaaS Landing Page
   - PLP (Product Listing Page)
   - Other?

4. **Vision Integration**: Should DOM+Vision correlation be required or optional?

5. **Backward Compatibility**: How long should we maintain `--legacy` flag?

---

## Next Steps (After Approval)

1. Review and finalize architectural decisions
2. Prioritize which phases to implement first
3. Define acceptance criteria for each phase
4. Begin implementation

---

**Ready for your review.**
