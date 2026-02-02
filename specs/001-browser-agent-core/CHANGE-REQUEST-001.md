# Change Request 001: Architecture Simplification

**Date**: 2026-01-29
**Status**: APPROVED
**Requested By**: User
**Impact**: High (affects Phases 20, 21, future phases)

---

## Summary

Simplify the Browser Agent architecture by:
1. Consolidating multiple vision modes into ONE mode
2. Merging Vision Agent into CRO Agent (single agent loop)
3. Deferring Phase 20 (Hybrid Extraction Pipeline)
4. Adding knowledge bases for all page types NOW

---

## Decisions

### A. Agent Architecture

| Decision | Item | Action |
|----------|------|--------|
| A1 | CRO Agent Loop (Phase 16) | **KEEP** - Primary agent with scroll/click/navigate |
| A2 | Vision Agent Loop (Phase 21g) | **MERGE** with CRO Agent (not separate) |
| A3 | Analysis tools in agent loop | **KEEP** - Do analysis after data collection |

### B. Vision/Screenshot Modes

| Decision | Mode | Action |
|----------|------|--------|
| B1 | `--vision` (single viewport) | **REMOVE** |
| B2 | `--full-page-vision` (multi-viewport) | **REMOVE** |
| B3 | `--full-page-screenshot` (single tall image) | **REMOVE** |
| B4 | `--vision-agent` (iterative DOM+Vision) | **KEEP** - The ONE mode |

**Result**: Single `--vision-agent` flag for all vision analysis.

### C. Data Collection Features

| Decision | Feature | Action |
|----------|---------|--------|
| C1 | Cookie consent dismissal | **KEEP** |
| C2 | Full page scrolling | **KEEP** |
| C3 | Interactive element clicks | **KEEP** |
| C4 | Multi-page navigation | **KEEP** |
| C5 | Coverage tracking | **KEEP** |

### D. Analysis Approach

| Decision | Item | Choice |
|----------|------|--------|
| D1 | When should analysis happen? | **After all data collected** |
| D2 | Single LLM call or multiple? | **Multiple calls per heuristic category** |
| D3 | DOM + Screenshot together? | **Send both to LLM** |

### E. Evidence & Debugging (Phase 21h, 21i)

| Decision | Feature | Action |
|----------|---------|--------|
| E1 | viewportIndex | **KEEP** |
| E2 | screenshotRef (--save-evidence) | **KEEP** |
| E3 | domElementRefs | **KEEP** |
| E4 | boundingBox | **KEEP** |
| E5 | timestamp | **KEEP** |
| E6 | DOM-Screenshot coordinate mapping | **KEEP** |
| E7 | Screenshot annotation | **KEEP** |

### F. Extraction Enhancements (Phase 20)

| Decision | Feature | Action |
|----------|---------|--------|
| F1 | Framework-agnostic detection | **DEFER** |
| F2 | Extended CRO types | **DEFER** |
| F3 | Multi-strategy selectors | **DEFER** |
| F4 | LLM DOM classification | **DEFER** |
| F5 | Enhanced visibility tracking | **DEFER** |

**Result**: Entire Phase 20 (60 tasks) DEFERRED.

### G. Output & Reporting

| Decision | Feature | Action |
|----------|---------|--------|
| G1 | Report format | **Console + JSON** |
| G2 | Hypothesis generation | **KEEP** |
| G3 | A/B test ideation | **KEEP** |
| G4 | Severity ratings | **KEEP** |
| G5 | Pass/fail/partial status | **KEEP** |

### H. Page Type Support

| Decision | Page Type | Action |
|----------|-----------|--------|
| H1 | PDP (35 heuristics) | **KEEP** |
| H2 | PLP | **ADD NOW** |
| H3 | Homepage | **ADD NOW** |
| H4 | Cart | **ADD NOW** |
| H5 | Checkout | **ADD NOW** |
| H6 | Generic (fallback) | **ADD NOW** |

---

## Architecture Changes

### Before (Current)

```
CRO Agent Loop (Phase 16)
├── scroll, click, navigate tools
├── analyze_ctas, analyze_forms, etc. (during loop)
└── record_insight, done

Vision Agent Loop (Phase 21g) - SEPARATE
├── capture_viewport, scroll_page tools
├── evaluate_batch (during loop)
└── vision_done

Multiple Vision Modes:
├── --vision (single viewport)
├── --full-page-vision (multi-viewport)
├── --full-page-screenshot (single tall)
└── --vision-agent (iterative)
```

### After (Target)

```
Unified CRO Agent (merged)
├── DATA COLLECTION PHASE
│   ├── scroll_page
│   ├── click_element
│   ├── navigate_to_url
│   ├── capture_viewport (DOM + screenshot)
│   └── collection_done
│
├── ANALYSIS PHASE (after collection)
│   ├── For each heuristic category:
│   │   ├── Send: DOM + Screenshots + Category Heuristics
│   │   └── Receive: Evaluations with evidence
│   └── Merge all evaluations
│
└── OUTPUT
    ├── Console report
    ├── JSON data
    ├── Evidence (screenshots with annotations)
    └── Hypotheses + A/B test ideas

Single Vision Mode:
└── --vision-agent (default for CRO analysis)
```

---

## Impact on Phases

### Phase 20: DEFERRED
- 60 tasks moved to backlog
- Framework-agnostic detection can be added later if needed
- Current extraction works for most sites

### Phase 21: MODIFIED
- 21a-21f: Vision modes B1-B3 code to be removed
- 21g: Merge into CRO Agent (not separate loop)
- 21h: Keep as-is (evidence capture)
- 21i: Keep as-is (coordinate mapping)

### New Phase 22: Page Type Knowledge Bases
- PLP heuristics (~25-30 rules)
- Homepage heuristics (~20-25 rules)
- Cart heuristics (~15-20 rules)
- Checkout heuristics (~25-30 rules)
- Generic heuristics (~10-15 rules, fallback)

---

## Revised Task Breakdown

### Immediate Work

| Task Group | Description | Est. Tasks |
|------------|-------------|------------|
| Remove vision modes | Delete B1, B2, B3 code paths | ~5 |
| Merge agents | Combine Vision Agent into CRO Agent | ~10 |
| Refactor analysis | Move analysis to post-collection phase | ~8 |
| Phase 21h | Evidence capture (as planned) | 14 |
| Phase 21i | DOM-Screenshot mapping (as planned) | 17 |
| **Subtotal** | | **~54** |

### New Knowledge Bases (Phase 22)

| Page Type | Heuristics | Est. Tasks |
|-----------|------------|------------|
| PLP | ~25-30 | 10 |
| Homepage | ~20-25 | 8 |
| Cart | ~15-20 | 6 |
| Checkout | ~25-30 | 10 |
| Generic | ~10-15 | 4 |
| **Subtotal** | | **38** |

### Total New Scope: ~92 tasks

---

## CLI Changes

### Removed Flags
```bash
--vision              # REMOVED
--full-page-vision    # REMOVED
--full-page-screenshot # REMOVED
--vision-max-viewports # REMOVED
--no-parallel-vision  # REMOVED
```

### Kept/Modified Flags
```bash
--vision-agent        # KEPT - The ONE vision mode (will become default)
--vision-model        # KEPT - Model selection (gpt-4o, gpt-4o-mini)
--save-evidence       # KEPT - Save screenshots
--evidence-dir        # KEPT - Evidence output directory
--annotate-screenshots # KEPT - Draw bounding boxes
```

### Future Default
```bash
# Current
npm run start -- --vision-agent https://example.com

# Future (after merge)
npm run start -- https://example.com  # Vision analysis is default
npm run start -- --no-vision https://example.com  # Disable vision
```

---

## Approval

- [x] User approved decisions (2026-01-29)
- [ ] Spec kit updated
- [ ] Implementation started

---

## Files to Update

1. `spec/requirements-phase21.md` - Mark B1-B3 modes as deprecated
2. `plan/phase-21.md` - Update architecture diagram
3. `tasks/phase-21.md` - Add removal/merge tasks, update status
4. `tasks/phase-20.md` - Mark as DEFERRED
5. `quickstart.md` - Update status and CLI examples
6. `SESSION-HANDOFF.md` - Update technical details
7. Create `spec/requirements-phase22.md` - New page type knowledge bases
8. Create `plan/phase-22.md` - Knowledge base implementation plan
9. Create `tasks/phase-22.md` - Knowledge base tasks
