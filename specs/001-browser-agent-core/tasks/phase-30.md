# Tasks: Phase 30 — Vision Optimization Layer

**Spec**: `spec/requirements-phase30.md`
**Plan**: `plan/phase-30.md`
**Total Tasks**: 20 (T653-T672)
**Total Tests**: ~31 (22 unit + 6 integration + regression)

## Phase 30a: Token Calculator

**Goal**: Calculate OpenAI vision token cost, find optimal dimensions.

- [x] T653 [P] Create `src/heuristics/vision/image-token-calculator.ts` with `calculateImageTokens(width, height)` (tiles = ceil(w/512) * ceil(h/512), tokens = tiles*85+85) and `findOptimalDimensions(origWidth, origHeight, maxTokens)` (step-down search maintaining aspect ratio, returns { width, height, tokens })
- [x] T654 Export `calculateImageTokens`, `findOptimalDimensions` from `src/heuristics/vision/index.ts`
- [x] T655 [P] Create `tests/unit/image-token-calculator.test.ts` — 6 tests: 512x512 = 170 tokens, 1024x512 = 255 tokens, 1280x720 = 425 tokens, 100x100 = 170 tokens (1 tile min), findOptimalDimensions fits within budget, findOptimalDimensions preserves aspect ratio

**Checkpoint**: Token calculator works standalone. 6 unit tests passing.

---

## Phase 30b: Category Element Mapper

**Goal**: Map categories to element types, compute union bounding boxes.

- [x] T656 [P] Create `src/heuristics/vision/category-crop-mapper.ts` with `CATEGORY_ELEMENT_TYPES` mapping (cta→['cta'], forms→['form'], trust→['trust'], value_prop→['value_prop'], navigation→['navigation'], pricing→['cta','value_prop'], reviews→['trust'], layout→all types, imagery→['value_prop','cta']), `computeCropRegion(category, visibleElements, vpWidth, vpHeight, padding)` returning `CropRegion | null` ({ x, y, width, height }), and `CropRegion` type
- [x] T657 Export `computeCropRegion`, `CATEGORY_ELEMENT_TYPES`, `CropRegion` from `src/heuristics/vision/index.ts`
- [x] T658 [P] Create `tests/unit/category-crop-mapper.test.ts` — 8 tests: maps CTA category to cta elements, computes union bbox from multiple elements, adds padding clamped to viewport, returns null when no relevant elements, returns null when crop >80% of viewport, handles single element, handles elements at viewport edges, minimum crop size enforced (100x100)

**Checkpoint**: Crop mapper works standalone. 8 unit tests passing.

---

## Phase 30c: Auto-Crop Pipeline

**Goal**: Crop and compress screenshots within token budget.

- [x] T659 Create `CropPipelineConfig` interface in `src/heuristics/vision/image-crop-pipeline.ts` with `maxTokensPerImage` (300), `paddingPx` (50), `minCropSize` (100), `jpegQualityRange` ([30, 70]), `coverageThreshold` (0.8)
- [x] T660 Create `cropForCategory(screenshotBase64, category, visibleElements, vpWidth, vpHeight, config?)` in `src/heuristics/vision/image-crop-pipeline.ts` — computes crop region, crops with sharp, finds optimal dimensions within token budget, compresses with best JPEG quality that fits, returns `{ base64, tokens, cropped }`
- [x] T661 Add fallback logic: if no crop region or coverage >80%, compress full image to fit token budget
- [x] T662 Add minimum size enforcement: if crop region <100x100, expand to 100x100 centered on region
- [x] T663 Export `cropForCategory`, `CropPipelineConfig` from `src/heuristics/vision/index.ts`
- [x] T664 [P] Create `tests/unit/image-crop-pipeline.test.ts` — 8 tests: crops to relevant region, output fits within token budget, falls back to full image when no elements, falls back when coverage >80%, minimum size enforced, JPEG quality adjusted to fit budget, preserves aspect ratio on resize, returns cropped=false on fallback

**Checkpoint**: Pipeline works end-to-end. 8 unit tests passing.

---

## Phase 30d: Category Analyzer Integration

**Goal**: Use cropped screenshots in per-category LLM analysis.

- [x] T665 Modify `CategoryAnalyzer.analyzeCategory()` in `src/heuristics/category-analyzer.ts` — before building user message, call `cropForCategory()` to get category-specific cropped screenshot. Use cropped base64 in the image message. Add `autoCrop` and `imageTokenBudget` to analyzer config. Skip cropping when `autoCrop === false`.
- [x] T666 Modify `src/heuristics/analysis-orchestrator.ts` — pass `autoCrop` and `imageTokenBudget` config through to category analyzer. For batched mode, explicitly skip cropping (batched categories share one image).
- [x] T667 [P] Create `tests/integration/vision-crop-analysis.test.ts` — 4 tests: per-category analysis uses cropped screenshot, batched analysis uses full screenshot, autoCrop=false uses full screenshot, token count in result reflects cropped size

**Checkpoint**: Cropped screenshots used in analysis. 4 integration tests passing.

---

## Phase 30e: CLI Flags

**Goal**: `--no-auto-crop` and `--image-token-budget` flags.

- [x] T668 Add `--no-auto-crop` flag in `src/cli.ts` (sets `autoCrop = false`, default: true). Add `--image-token-budget <n>` flag (default: 300, range 100-1000). Add `autoCrop?: boolean` and `imageTokenBudget?: number` to `AnalyzeOptions` in `src/agent/cro-agent.ts`. Wire through to orchestrator config.
- [x] T669 [P] Add 2 tests: `--no-auto-crop` flag parsed correctly, `--image-token-budget` parsed with range validation

**Checkpoint**: CLI flags work. 2 tests passing.

---

## Phase 30f: Quality Validation

**Goal**: Verify token savings, no quality regression.

- [x] T670 [P] Add 2 integration tests to `tests/integration/vision-crop-analysis.test.ts`: analysis with auto-crop produces valid insights (no empty results), analysis with auto-crop disabled matches baseline results
- [x] T671 Run full test suite (`npm test`), verify all 1281+ existing tests pass
- [x] T672 Update `specs/001-browser-agent-core/quickstart.md` with Phase 30 status, key files, CLI flags

**Checkpoint**: All tests pass. Phase 30 complete.

---

## Dependencies & Execution Order

- **30a** (T653-T655): No dependencies — start immediately
- **30b** (T656-T658): No dependencies — parallel with 30a
- **30c** (T659-T664): Depends on 30a + 30b
- **30d** (T665-T667): Depends on 30c
- **30e** (T668-T669): Depends on 30c, can parallel with 30d
- **30f** (T670-T672): Depends on 30d + 30e

## Session Plan

- **Session 1**: 30a + 30b + 30c (T653-T664) — 12 tasks, ~22 tests
- **Session 2**: 30d + 30e + 30f (T665-T672) — 8 tasks, ~9 tests

## Mock Update Note

Tests mocking `category-analyzer.js` may need `cropForCategory` mock
if it becomes an import there. Follow the same pattern used for
`buildAccessibilityTreeBlock` in Phase 29.
