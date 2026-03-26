# Tasks: Phase 35 — Intelligent Element Perception & Targeting

**Input**: `spec/requirements-phase35.md`, `plan/phase-35.md`
**Total**: 29 tasks (T797-T825)
**Tests**: 5 test files, ~30 tests

---

## Phase 35A: Viewport-Aware Element Collector (5 tasks)

**Goal**: Extract element collection from perceiver; score by viewport + content region
**Independent Test**: Product links appear in element list on content-rich pages

- [x] T797 [P] Create `src/agent/agent-loop/element-collector.ts` — `collectInteractiveElements(page, config)` with `ElementCollectionConfig`, `CollectedElement` interface, scoring algorithm (viewport +10, main content +8, meaningful text +5, link with href +3, aria-label +2, header/nav -5), single `page.evaluate` call
- [x] T798 [P] Add `ContentRegion` interface to `src/agent/agent-loop/types.ts` — `hasMainLandmark`, `mainContentLinks`, `mainContentButtons`, `headerElements`, `totalInteractive`; expand `InteractiveElement` with `region`, `score`, `accessibleName` fields
- [x] T799 Update `perceivePage()` in `src/agent/agent-loop/perceiver.ts` — replace inline element collection (lines 98-149) with `collectInteractiveElements()` call, pass `ContentRegion` through `PerceivedState` (depends T797, T798)
- [x] T800 Add `contentRegion` to `PerceivedState` in `src/agent/agent-loop/types.ts`, add `agentMode?: boolean` param to `perceivePage()` signature for expanded AX tree budget (depends T798)
- [x] T801 Create `tests/unit/agent-loop/element-collector.test.ts` — 6 tests: viewport priority, main content detection, header cap at 10, score sorting, content region summary, 50-element limit (depends T797)

**Checkpoint**: Products in main content area score higher than header links

---

## Phase 35B: Robust Selector Generation (4 tasks)

**Goal**: Generate uniquely-scoped selectors that resolve to exactly one element
**Independent Test**: No selector resolves to wrong element

- [x] T802 [P] Create `src/agent/agent-loop/selector-generator.ts` — `generateUniqueSelector(el)` strategy chain: id → aria-label → data-testid → text content → scoped CSS path → absolute XPath; uniqueness verification via `querySelectorAll(sel).length === 1`
- [x] T803 Integrate `generateUniqueSelector` into `element-collector.ts` `page.evaluate` — replace old xpath logic, set `selector` field on each `CollectedElement` (depends T797, T802)
- [x] T804 Update `buildMinimalPageState()` in `src/agent/agent-loop/agent-loop.ts` — map `CollectedElement.selector` to `DOMNode.xpath` for tool compatibility (depends T803)
- [x] T805 Create `tests/unit/agent-loop/selector-generator.test.ts` — 6 tests: id selector, aria-label selector, data-testid, scoped CSS path, absolute XPath fallback, uniqueness verification (depends T802)

**Checkpoint**: Every generated selector resolves to exactly one element

---

## Phase 35C: AX Tree Enhancements (4 tasks)

**Goal**: Expand AX tree for agent mode and prioritize content nodes
**Independent Test**: AX tree on dense pages includes product names

- [x] T806 [P] Add `agentMode` config to `perceivePage()` in `src/agent/agent-loop/perceiver.ts` — when true, use `AX_TREE_MAX_CHARS = 16000` and `maxTokens: 4000` for `captureAccessibilityTree`
- [x] T807 [P] Add `prioritizeContent` option to `captureAccessibilityTree` in `src/browser/ax-tree-serializer.ts` — when true, serialize nodes inside `<main>`/`[role="main"]` first, then remaining nodes; increase node name truncation from 50 to 80 chars
- [x] T808 Pass `agentMode: true` from `runAgentLoop()` in `src/agent/agent-loop/agent-loop.ts` to `perceivePage()` calls (depends T806)
- [x] T809 Populate `accessibleName` field on each `CollectedElement` from `el.getAttribute('aria-label') || el.innerText.slice(0, 80)` in `element-collector.ts` (depends T797, T798)

**Checkpoint**: AX tree includes product-level content on dense pages

---

## Phase 35D: Planner Prompt Enhancement (4 tasks)

**Goal**: Give planner better context for element selection
**Independent Test**: Planner prompt includes content region summary and scored elements

- [x] T810 Update planner system prompt in `src/agent/agent-loop/planner.ts` — add rules: prefer main content elements, use scroll/get_ax_tree if no suitable element, match element text with AX tree
- [x] T811 Update planner user message format in `src/agent/agent-loop/planner.ts` — add `CONTENT REGION` section (main links/buttons count, header count), element format: `[index] <tag> "text" (region: main, score: 18)` (depends T798, T800)
- [x] T812 Include `accessibleName` in element format when different from display text (depends T809, T811)
- [x] T813 Create `tests/unit/agent-loop/planner-context.test.ts` — 4 tests: prompt contains content region, elements show region/score, accessibleName included, scroll instruction present (depends T810-T812)

**Checkpoint**: Planner has rich context to make correct element choices

---

## Phase 35E: Screenshot Vision for Planner (4 tasks)

**Goal**: Send viewport screenshot to planner LLM so it can "see" the page
**Independent Test**: Planner receives multimodal message with screenshot

- [x] T814 Update `perceivePage()` in `src/agent/agent-loop/perceiver.ts` — always capture screenshot (remove AX-tree-length gate), always set `screenshotBase64` on `PerceivedState` (depends T806)
- [x] T815 Update `planNextAction()` in `src/agent/agent-loop/planner.ts` — accept `screenshotBase64?: string` param, change `HumanMessage` to multimodal content array `[{ type: 'text', text }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } }]` (depends T810)
- [x] T816 Update planner system prompt in `src/agent/agent-loop/planner.ts` — add: "You can see a screenshot of the current page. Use it to identify visual elements, product listings, prices, and ratings."
- [x] T817 Pass `preState.screenshotBase64` to `planNextAction()` in `src/agent/agent-loop/agent-loop.ts` and `generateCandidates()` calls (depends T815)

**Checkpoint**: Planner LLM receives a screenshot at every step

---

## Phase 35F: Auto-Extract Page Summary (3 tasks)

**Goal**: Give planner visible page text — product names, prices, ratings
**Independent Test**: PerceivedState includes pageText from main content

- [x] T818 [P] Add `pageText?: string` to `PerceivedState` in `src/agent/agent-loop/types.ts`
- [x] T819 Extract main content text in `perceivePage()` in `src/agent/agent-loop/perceiver.ts` — `page.evaluate(() => (document.querySelector('main, [role="main"]') || document.body).innerText?.slice(0, 2000))`, set on `PerceivedState.pageText` (depends T818)
- [x] T820 Add `PAGE TEXT (main content):` section to planner user message in `src/agent/agent-loop/planner.ts` — include `state.pageText` after AX tree section, truncated to 2000 chars (depends T818, T819)

**Checkpoint**: Planner receives visible page text at every step

---

## Phase 35G: Integration Test + Exports (5 tasks)

**Goal**: End-to-end verification and barrel exports

- [x] T821 Create `tests/integration/element-perception.test.ts` — mock Amazon-like page with 15 header + 10 product elements, verify: ≥5 products in collected elements, content region counts correct, selectors unique (depends T801, T805)
- [x] T822 Add integration test: clicking product elementIndex navigates to correct URL (not logo), using generated selector (depends T803, T821)
- [x] T823 Add integration test: planner HumanMessage includes screenshot as image_url content part and pageText section (depends T815, T820)
- [x] T824 Update barrel exports in `src/agent/agent-loop/index.ts` — export `collectInteractiveElements`, `generateUniqueSelector`, `CollectedElement`, `ContentRegion`, `ElementCollectionConfig` (depends T797, T798, T802)
- [x] T825 Update existing perceiver tests in `tests/unit/agent-loop/perceiver.test.ts` to use new element collection format and always-present screenshot (depends T799, T814)

**Checkpoint**: Full perception pipeline produces correct elements on complex pages

---

## Dependencies & Execution Order

```
T797, T798 (parallel) → T799 → T800 → T801
T802 (parallel with 35A) → T803 → T804 → T805
T806, T807 (parallel with 35A/B) → T808 → T809
T818 (parallel with 35A/B/C) → T819 → T820
T810 → T811 → T812 → T813
T813, T806 → T814 → T815 → T816 → T817
T801, T805, T817, T820 → T821 → T822, T823
T821 → T824, T825
```

- **35A**, **35B**, **35C**, **35F** can start in parallel (different files)
- **35D** depends on 35A (ContentRegion) and 35C (accessibleName)
- **35E** depends on 35D (planner changes)
- **35G** depends on all

## Summary

| Phase | Tasks | Count | Key Files | New Test Files |
|-------|-------|-------|-----------|----------------|
| 35A | T797-T801 | 5 | element-collector.ts (new), perceiver.ts, types.ts | element-collector.test.ts |
| 35B | T802-T805 | 4 | selector-generator.ts (new), element-collector.ts, agent-loop.ts | selector-generator.test.ts |
| 35C | T806-T809 | 4 | perceiver.ts, ax-tree-serializer.ts, agent-loop.ts | — |
| 35D | T810-T813 | 4 | planner.ts | planner-context.test.ts |
| 35E | T814-T817 | 4 | perceiver.ts, planner.ts, agent-loop.ts | — |
| 35F | T818-T820 | 3 | types.ts, perceiver.ts, planner.ts | — |
| 35G | T821-T825 | 5 | index.ts, perceiver.test.ts | element-perception.test.ts |
| **Total** | **T797-T825** | **29** | **9 modified, 2 new** | **4 new test files (~30 tests)** |
