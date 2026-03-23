# Tasks: Phase 29 — AX Tree in Perception Layer

**Spec**: `spec/requirements-phase29.md`
**Plan**: `plan/phase-29.md`
**Total Tasks**: 17 (T636-T652)
**Total Tests**: ~24 (11 unit + 8 integration + regression)

## Phase 29a: AX Tree Serializer

**Goal**: Core capture, filter, serialize, truncate module.

- [x] T636 [P] Add `AXTreeSerializerConfig` type (`maxTokens`, `interestingOnly`, `includeStates`, `indentSize`) to `src/types/index.ts`
- [x] T637 Create `src/browser/ax-tree-serializer.ts` with `captureAccessibilityTree(page, config?)`, `serializeAccessibilityNode(node, indent?)`, `filterNode(node)`, `truncateToTokenBudget(text, maxTokens)` — uses `page.accessibility.snapshot({ interestingOnly: true })`, filters decorative/nameless-leaf nodes, serializes as indented `- role "name" [states]`, truncates at 500-token budget with `... (N more nodes)`
- [x] T638 Export `captureAccessibilityTree`, `serializeAccessibilityNode`, `truncateToTokenBudget` from `src/browser/index.ts`
- [x] T639 [P] Create `tests/unit/ax-tree-serializer.test.ts` — 8 tests: basic serialization (role + name + states), node filtering (exclude role:none, nameless leaves), state inclusion (disabled, checked, expanded, required, selected, invalid, pressed), token budget truncation with indicator, empty tree returns null, capture error returns null + warning, indentation hierarchy, landmarks without name but with children kept

**Checkpoint**: `captureAccessibilityTree()` works standalone. 8 unit tests passing.

---

## Phase 29b: ViewportSnapshot Integration

**Goal**: Add `axTree` field to ViewportSnapshot, capture in all collection modes.

- [x] T640 Add optional `axTree?: string` field to `ViewportSnapshot` interface in `src/models/agent-state.ts`
- [x] T641 Import `captureAccessibilityTree` in `src/agent/cro-agent.ts`, call in `runDeterministicCollection()` after DOM extraction. Store result as `axTree` on snapshot. Skip when `captureAxTree` option is false.
- [x] T642 Add AX tree capture to tiled screenshot mode in `src/agent/cro-agent.ts` — capture once after tile generation, add to each tile snapshot
- [x] T643 Add AX tree capture to hybrid screenshot mode in `src/agent/cro-agent.ts` — capture at each viewport position alongside DOM extraction
- [x] T644 [P] Add 3 unit tests to `tests/unit/ax-tree-serializer.test.ts`: ViewportSnapshot includes axTree when capture succeeds, axTree is undefined when capture fails, axTree is undefined when captureAxTree is false

**Checkpoint**: All collection modes produce snapshots with `axTree`. 3 additional tests.

---

## Phase 29c: LLM Prompt Integration

**Goal**: Include `<accessibility_tree>` block in LLM prompts.

- [x] T645 Add `buildAccessibilityTreeBlock(snapshot: ViewportSnapshot): string | null` in `src/heuristics/category-analyzer.ts` — returns `<accessibility_tree>\n{axTree}\n</accessibility_tree>` or null
- [x] T646 Insert `buildAccessibilityTreeBlock()` output into system prompt in `CategoryAnalyzer.analyzeCategory()` — after `<element_positions>` block, before heuristic instructions
- [x] T647 Add AX tree to shared context in `src/heuristics/batch-prompt-builder.ts` — include `<accessibility_tree>` block in `buildBatchedUserMessage()` after element positions
- [x] T648 Export `buildAccessibilityTreeBlock` from `src/heuristics/index.ts`
- [x] T649 [P] Create `tests/integration/ax-tree-analysis.test.ts` — 5 tests: prompt includes block when axTree present, prompt omits block when axTree null, batch prompt includes AX tree in shared context, block placed after `<element_positions>`, content matches snapshot.axTree

**Checkpoint**: LLM prompts include AX tree. 5 integration tests.

---

## Phase 29d: CLI Flag

**Goal**: `--no-ax-tree` opt-out flag.

- [x] T650 Add `--no-ax-tree` flag in `src/cli.ts` (sets `captureAxTree = false`, default: true). Add `captureAxTree?: boolean` to `AnalyzeOptions` in `src/agent/cro-agent.ts`. Wire through to collection phase.

**Checkpoint**: `--no-ax-tree` disables AX tree capture end-to-end.

---

## Phase 29e: Quality Validation

**Goal**: Verify no regressions, document quality validation.

- [x] T651 Add 3 integration tests to `tests/integration/ax-tree-analysis.test.ts`: full flow with AX tree produces valid insights, flow with `--no-ax-tree` matches baseline, capture failure handled gracefully (warning logged, analysis completes)
- [x] T652 Run full test suite (`npm test`), verify all 1250+ existing tests pass. Update `specs/001-browser-agent-core/quickstart.md` Phase 29 status + key files.

**Checkpoint**: All tests pass. Phase 29 complete.

---

## Dependencies & Execution Order

- **29a** (T636-T639): No dependencies — start immediately
- **29b** (T640-T644): Depends on 29a
- **29c** (T645-T649): Depends on 29b
- **29d** (T650): Depends on 29b, can parallel with 29c
- **29e** (T651-T652): Depends on 29c + 29d

## Session Plan

- **Session 1**: 29a + 29b + 29d (T636-T644, T650) — 10 tasks, ~14 tests
- **Session 2**: 29c + 29e (T645-T652) — 7 tasks, ~10 tests
