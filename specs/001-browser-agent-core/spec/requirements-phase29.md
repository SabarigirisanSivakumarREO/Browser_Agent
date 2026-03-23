# Requirements: Phase 29 — AX Tree in Perception Layer

**Phase**: 29
**Created**: 2026-03-23
**Status**: Draft

## Overview

Add the browser's accessibility tree to the perception layer. Capture
Playwright's accessibility snapshot at each viewport position, filter
to interactive + landmark nodes within a 500-token budget, store as
`axTree` field on `ViewportSnapshot`, and include as
`<accessibility_tree>` block in LLM prompts.

## User Stories

### US-29a: AX Tree Capture During Collection (P1)

As a CRO analyst running a page analysis, I want the tool to capture
the browser's accessibility tree at each viewport position so the LLM
has semantic context (roles, states, computed names) that raw DOM
cannot provide.

**Acceptance Scenarios**:

1. **Given** a page with interactive elements, **When** vision analysis
   runs, **Then** each ViewportSnapshot includes an `axTree` field.
2. **Given** ARIA attributes (`role="button"`, `aria-label`), **When**
   the AX tree is captured, **Then** those semantic roles appear.
3. **Given** hidden elements (`aria-hidden="true"`), **When** captured,
   **Then** hidden elements are excluded.

### US-29b: AX Tree in LLM Prompts (P2)

As the analysis engine, I need the accessibility tree in LLM prompts
so the model can reason about semantic roles, focus order, and
element states.

**Acceptance Scenarios**:

1. **Given** snapshots with AX tree data, **When** the category
   analyzer builds a prompt, **Then** it includes an
   `<accessibility_tree>` block after `<element_positions>`.
2. **Given** snapshots with AX tree data, **When** batch prompt builder
   runs, **Then** the shared context includes the AX tree block.
3. **Given** an AX tree exceeding budget, **When** the prompt is built,
   **Then** the tree is truncated to 500 tokens.

### US-29c: Quality Validation (P3)

As a developer maintaining analysis quality, I want to validate that
adding the AX tree improves or maintains accuracy.

**Acceptance Scenarios**:

1. **Given** the quality validator, **When** comparing with/without AX
   tree, **Then** effective match rate is >= 80%.

## Functional Requirements

- **FR-29-001**: System MUST call `page.accessibility.snapshot()` at
  each viewport position during collection.
- **FR-29-002**: System MUST filter the AX tree to interactive nodes
  (button, link, input, select, textbox) and landmark nodes
  (navigation, main, banner, contentinfo, form).
- **FR-29-003**: System MUST serialize the filtered tree as indented
  text: `- role "name" [state1] [state2]`.
- **FR-29-004**: System MUST enforce a 500-token budget. Truncate
  deeper nodes with `... (N more nodes)` indicator.
- **FR-29-005**: System MUST store serialized AX tree in `axTree`
  field on `ViewportSnapshot`.
- **FR-29-006**: System MUST include AX tree in category analyzer
  prompt as `<accessibility_tree>` block after `<element_positions>`.
- **FR-29-007**: System MUST include AX tree in batch prompt builder's
  shared context section.
- **FR-29-008**: System MUST gracefully handle capture failures by
  omitting the block and logging a warning.
- **FR-29-009**: System MUST include role, computed name, and states
  (disabled, checked, expanded, required, selected, invalid, pressed).
- **FR-29-010**: System MUST support `--no-ax-tree` CLI flag (opt-out).
- **FR-29-011**: System MUST capture AX tree in all screenshot modes
  (viewport, tiled, hybrid).
- **FR-29-012**: AX tree capture MUST NOT increase total analysis time
  by more than 5%.

## Edge Cases

- Empty AX tree: skip `<accessibility_tree>` block, proceed normally.
- Capture API error: log warning, continue without AX tree.
- Extremely large tree (1000+ nodes): truncate within token budget.
- Tiled mode: capture one AX tree snapshot for the full page.

## Success Criteria

- **SC-29-001**: Pages with custom ARIA components are correctly
  identified (before/after on 5+ test pages).
- **SC-29-002**: AX tree capture adds <5% to collection time.
- **SC-29-003**: Token cost increase <10% per analysis.
- **SC-29-004**: Quality validation effective match rate >= 80%.
- **SC-29-005**: All existing 1250+ tests pass (zero regressions).
