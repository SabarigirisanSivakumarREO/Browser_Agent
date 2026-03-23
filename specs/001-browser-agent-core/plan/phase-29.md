# Phase 29: AX Tree in Perception Layer

**Date**: 2026-03-23
**Spec**: `spec/requirements-phase29.md`
**Tasks**: `tasks/phase-29.md`

## Summary

Add the browser's accessibility tree to the perception layer. Capture
Playwright's `page.accessibility.snapshot()` at each viewport position,
filter to interactive + landmark nodes within a 500-token budget, store
as `axTree` on `ViewportSnapshot`, and include as
`<accessibility_tree>` block in LLM prompts for both per-category and
batched analysis.

## Technical Context

**API**: `page.accessibility.snapshot({ interestingOnly: true })`
- Returns tree with: role, name, value, description, children, and
  boolean state properties (disabled, checked, expanded, etc.)
- `interestingOnly: true` is the default — excludes decorative nodes

**Serialization Format**:
```
- navigation "Main navigation"
  - link "Home"
  - link "Products"
- main
  - heading "iPhone 15 Pro" [level=1]
  - button "Add to Cart" [focusable]
  - textbox "Email" [required] [invalid]
```

**Token Budget**: 500 tokens default, depth-first truncation.

## Sub-phases

### 29a: AX Tree Serializer (Core Module)

**Files**:
- NEW: `src/browser/ax-tree-serializer.ts`
- MODIFY: `src/browser/index.ts` (barrel export)
- MODIFY: `src/types/index.ts` (config type)

**Exports**:
- `captureAccessibilityTree(page, config?): Promise<string | null>`
- `serializeAccessibilityNode(node, indent?): string`
- `truncateToTokenBudget(text, maxTokens): string`

### 29b: ViewportSnapshot Integration

**Files**:
- MODIFY: `src/models/agent-state.ts` — add `axTree?: string`
- MODIFY: `src/agent/cro-agent.ts` — call capture in all 3 modes

Integration points (same as DOM extraction):
- Viewport mode: capture at each scroll position
- Tiled mode: capture once for full page
- Hybrid mode: capture at each viewport position

### 29c: LLM Prompt Integration

**Files**:
- MODIFY: `src/heuristics/category-analyzer.ts` — new
  `buildAccessibilityTreeBlock()` helper
- MODIFY: `src/heuristics/batch-prompt-builder.ts` — AX tree in
  shared context

Prompt placement: after `<element_positions>`, before heuristic
instructions.

### 29d: CLI Flag

**Files**:
- MODIFY: `src/cli.ts` — `--no-ax-tree` flag
- MODIFY: `src/agent/cro-agent.ts` — `captureAxTree` in AnalyzeOptions

### 29e: Quality Validation

**Tests**:
- Unit: serializer (8 tests)
- Integration: prompt format + collection (8 tests)
- Regression: all 1250+ existing tests

## Dependencies

```
29a (serializer) ← start immediately
  ↓
29b (snapshot) ← depends on 29a
  ↓
29c (prompts) ←─┐ depends on 29b
29d (CLI)     ←─┘ can parallel with 29c
  ↓
29e (validation) ← depends on 29c + 29d
```

## Session Plan

- **Session 1**: 29a + 29b + 29d (~10 tasks, ~14 tests)
- **Session 2**: 29c + 29e (~7 tasks, ~10 tests)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AX tree too large | Medium | Low | 500-token budget with truncation |
| Capture API slow | Low | Low | Typically <50ms |
| Degrades LLM quality | Low | Medium | Opt-out flag + quality validation |
| Existing tests break | Low | High | axTree is optional, additive only |
