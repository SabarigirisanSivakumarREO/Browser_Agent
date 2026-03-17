# Phase 27: Analysis Quality & Annotation Fix — Tasks

**Date**: 2026-02-19 | **Tasks**: T616-T641 (26 tasks) | **Tests**: ~63

---

## Phase 27A: Model Default & Centralization (T616-T618) ✅ COMPLETE (2026-02-19)

### T616: Create MODEL_DEFAULTS constant ✅
- **Create** `src/heuristics/model-config.ts` with `MODEL_DEFAULTS = { analysis: 'gpt-4o-mini', fast: 'gpt-4o-mini' }`
- **Modify** `src/heuristics/index.ts` — export `MODEL_DEFAULTS`
- **Tests**: 2 unit ✅
- **AC**: ✅ `MODEL_DEFAULTS.analysis === 'gpt-4o-mini'`, `MODEL_DEFAULTS.fast === 'gpt-4o-mini'`
- **Updated 2026-03-04**: Changed default from gpt-4o to gpt-4o-mini (gpt-4o exceeds 30K TPM limit with batched 9-viewport requests)

### T617: Replace hardcoded gpt-4o-mini references ✅
- **Modify** `src/heuristics/category-analyzer.ts` — `DEFAULT_CATEGORY_ANALYZER_CONFIG.model`
- **Modify** `src/heuristics/analysis-orchestrator.ts` — batched LLM fallback
- **Modify** `src/agent/cro-agent.ts` — `resolveVisionOptions()`
- **Modify** `src/heuristics/vision/types.ts` — default configs
- **Tests**: 0 (type-check only) ✅
- **AC**: ✅ No hardcoded `'gpt-4o-mini'` in analysis pipeline source files

### T618: Add --fast-analysis CLI flag ✅
- **Modify** `src/cli.ts` — add `--fast-analysis` flag, override `visionModel` to `MODEL_DEFAULTS.fast`
- **Tests**: 1 unit ✅
- **AC**: ✅ `--fast-analysis` sets model to gpt-4o-mini (same as default — retained for backward compatibility)

---

## Phase 27B: Structured Element Refs in JSON Schema (T619-T622) ✅ COMPLETE (2026-02-20)

### T619: Add elementRefs to JSON schema ✅
- **Modify** `src/heuristics/category-analyzer.ts` — added `elementRefs?: string[]` to `RawCategoryEvaluation` and JSON schema in prompt
- **Modify** `src/heuristics/batch-prompt-builder.ts` — same schema update
- **Modify** `src/heuristics/batch-response-parser.ts` — added `elementRefs?: string[]` to `RawBatchEvaluation`
- **Tests**: 3 unit ✅
- **AC**: ✅ LLM JSON schema includes `elementRefs` field description

### T620: Update system prompt for elementRefs ✅
- **Modify** `src/heuristics/category-analyzer.ts` (`buildSystemPrompt`) — added `elementRefs: REQUIRED for non-N/A evaluations` instruction
- **Modify** `src/heuristics/batch-prompt-builder.ts` (`buildBatchedSystemPrompt`) — same
- **Tests**: 2 unit ✅
- **AC**: ✅ System prompt contains instruction to populate elementRefs array

### T621: Update parseResponse for structured elementRefs ✅
- **Modify** `src/heuristics/category-analyzer.ts` — `parseResponse()` attaches `_structuredElementRefs` from JSON; `populateElementRefs()` uses structured refs first, text scan fallback
- **Tests**: 3 unit ✅
- **AC**: ✅ Structured refs parsed before text scan, both paths work

### T622: Update batch response parser for elementRefs ✅
- **Modify** `src/heuristics/batch-response-parser.ts` — `parseBatchedResponse()` carries `_structuredElementRefs` on evaluations
- **Tests**: 2 unit ✅
- **AC**: ✅ Batch parser extracts elementRefs from structured JSON

---

## Phase 27C: Prompt Strengthening (T623-T624) ✅ COMPLETE (2026-03-03)

### T623: Add few-shot examples to system prompt ✅
- **Modify** `src/heuristics/category-analyzer.ts`, `src/heuristics/batch-prompt-builder.ts`
- Added `<examples>` XML section with 3 JSON examples: (1) fail with `["[v0-15]"]`, (2) pass with `["[v0-22]", "[v0-23]"]`, (3) N/A with `[]`
- **Tests**: 3 unit ✅
- **AC**: ✅ System prompt contains 3 few-shot examples with elementRefs arrays

### T624: Add enforcement instructions ✅
- **Modify** `src/heuristics/category-analyzer.ts`, `src/heuristics/batch-prompt-builder.ts`
- Added `<enforcement>` XML section: no speculation, N/A when no evidence, MUST include refs, verify before pass
- **Tests**: 2 unit ✅
- **AC**: ✅ System prompt contains enforcement rules

---

## Phase 27D: Confidence Threshold Filtering (T625-T627) ✅ COMPLETE (2026-03-03)

### T625: Add --min-confidence CLI flag ✅
- **Modify** `src/cli.ts` — added `minConfidence: number` to options type, `let minConfidence = 0.7` default, arg parsing with 0-1 range validation, help text under ANALYSIS OPTIMIZATION OPTIONS
- **Tests**: 1 unit ✅
- **AC**: ✅ `--min-confidence 0.8` sets `options.minConfidence` to 0.8, default 0.7

### T626: Filter evaluations below threshold in display ✅
- **Modify** `src/cli.ts` — added `&& e.confidence >= options.minConfidence` to fail/partial display filters; pass and evidence output remain unfiltered
- **Tests**: 3 unit ✅ (above threshold shown, below threshold hidden, all preserved in evidence)
- **AC**: ✅ Low-confidence evaluations hidden from console but present in evidence

### T627: Add confidence distribution summary ✅
- **Modify** `src/cli.ts` — after passed heuristics display, calculates `filteredCount` and logs summary when > 0
- **Tests**: 2 unit ✅ (summary shown when filtered, no summary when nothing filtered)
- **AC**: ✅ "Filtered X/Y evaluations below Z% confidence (preserved in evidence)" logged when applicable

---

## Phase 27E: Deduplication Fix (T628-T629) ✅ COMPLETE (2026-02-19)

### T628: Fix InsightDeduplicator.createKey() ✅
- **Modify** `src/output/insight-deduplicator.ts` — use `heuristicId` as key
- **Tests**: 2 unit ✅ (unique keys per heuristic, N/A elements don't collapse)
- **AC**: ✅ Insights with same type but different heuristicId kept separate

### T629: Fix evaluationsToInsights element field ✅
- **Modify** `src/heuristics/analysis-orchestrator.ts` — use `domElementRefs[0].viewportRef` or first ref
- **Tests**: 2 unit ✅ (populated from refs, fallback to N/A when no refs)
- **AC**: ✅ Insights have meaningful element field when domElementRefs present

---

## Phase 27F: Annotation Pipeline Fix (T630-T632) ✅ COMPLETE (2026-03-03)

### T630: Verify viewport assignment from element refs ✅
- **Verified** `src/heuristics/category-analyzer.ts` — `populateElementRefs()` already sets `viewportIndex` from element refs (line 686-688)
- **Added** `viewportRef` field to `DOMElementRef` in `src/heuristics/vision/types.ts` — stores original ref string (e.g., `[v0-5]`)
- **Modified** `populateElementRefs()` to populate `viewportRef` on each `DOMElementRef`
- **Tests**: 3 unit ✅ (structured refs set viewportIndex, text-scan refs set viewportIndex, no refs keeps undefined)
- **AC**: ✅ `viewportIndex` correctly set from both structured and text-scan element refs

### T631: Fix CLI annotation filter ✅
- **Modify** `src/cli.ts` — filter now checks `viewportIndex` match OR `domElementRefs` with matching viewport via `parseElementRef()`
- **Import** `parseElementRef` from `./heuristics/category-analyzer.js`
- **Tests**: 3 unit ✅ (matching viewportIndex included, matching domElementRefs included, no match excluded)
- **AC**: ✅ Evaluations with domElementRefs get annotated even without exact viewportIndex

### T632: Add annotation coverage metric ✅
- **Modify** `src/cli.ts` — replaced static message with `"Annotated X/Y evaluations across Z viewports (W with element refs)"`
- **Tests**: 1 unit ✅ (metric format verified)
- **AC**: ✅ Annotation coverage metric logged after annotation loop

---

## Phase 27G: DOM Cross-Validation (T633-T634) ✅ COMPLETE (2026-03-03)

### T633: Create cross-validator ✅
- **Create** `src/heuristics/cross-validator.ts` — `crossValidateEvaluations()` checks LLM absence claims against DOM `layoutBoxes` croType data
- Maps heuristic prefixes (PDP-PRICE→price, PDP-CTA→cta, etc.) to CRO types
- Regex-based absence detection (no/not found/missing/absent/cannot find)
- Contradiction penalty: 50% confidence multiplier
- **Export** types `CrossValidationFlag`, `CrossValidationResult` via `src/heuristics/index.ts`
- **Tests**: 5 unit ✅ (contradiction flagged, absence-matches-DOM no-flag, pass/partial skipped, multiple contradictions, empty snapshots)
- **AC**: ✅ Cross-validator catches contradicted claims and downgrades confidence

### T634: Integrate cross-validator ✅
- **Modify** `src/heuristics/analysis-orchestrator.ts` — call `crossValidateEvaluations()` after combining all evaluations, before converting to insights
- Logs contradiction count when > 0
- **Tests**: 0 additional (integration covered by T633 unit tests + existing orchestrator tests)
- **AC**: ✅ Contradicted evaluations have reduced confidence in analysis output

---

## Phase 27H: Annotation Overlay Rendering Fix (T635-T640) ✅ COMPLETE (2026-03-04)

### T635: Add viewport-aware matching to getElementStatus() ✅
- **Modify** `src/output/screenshot-annotator.ts` — add `viewportId` parameter, parse `ref.viewportRef` to compare viewport index
- **Tests**: 3 unit ✅ (VP0 doesn't match VP2 eval, VP2 matches VP2 eval, no viewportRef matches any)
- **AC**: ✅ Element 5 in viewport 0 no longer matches evaluation referencing `[v2-5]`

### T636: Add full-edge clamping to buildBoundingBoxSvg() ✅
- **Modify** `src/output/screenshot-annotator.ts` — add `viewportWidth`/`viewportHeight` params, clamp all 4 edges
- **Tests**: 3 unit ✅ (bottom-edge clamp, top-edge clamp, right-edge clamp)
- **AC**: ✅ Elements extending outside viewport are clipped to viewport bounds

### T637: Clamp label positions in buildIndexLabelSvg() ✅
- **Modify** `src/output/screenshot-annotator.ts` — clamp labelX/labelY within viewport bounds
- **Tests**: 1 unit ✅ (label near right edge stays within viewport)
- **AC**: ✅ Labels never extend outside viewport bounds

### T638: Propagate viewport dimensions through buildSvgOverlay() ✅
- **Modify** `src/output/screenshot-annotator.ts` — pass `width`/`height` to `buildBoundingBoxSvg()` and `buildIndexLabelSvg()`
- **Tests**: 0 (covered by T636/T637 tests)
- **AC**: ✅ Viewport dimensions flow through to all child rendering functions

### T639: Pass viewportId to getElementStatus() in buildSvgOverlay() ✅
- **Modify** `src/output/screenshot-annotator.ts` — `getElementStatus(element.index, element.viewportId, evaluations)`
- **Tests**: 0 (covered by T635 tests)
- **AC**: ✅ Viewport-aware matching active in overlay rendering

### T640: DPR scale mismatch detection and coordinate scaling ✅
- **Modify** `src/output/screenshot-annotator.ts` — detect `scaleFactor = imageWidth / cssViewportWidth`, scale all element coords
- **Add** `cssViewportWidth?: number` to `AnnotationOptions` (default 1280)
- **Tests**: 2 unit ✅ (2x DPR coords doubled, 1x DPR coords unchanged)
- **AC**: ✅ Bounding boxes align correctly on high-DPR screenshots

### T641: Add heuristic ID labels to annotation overlay ✅
- **Modify** `src/output/screenshot-annotator.ts` — add `getMatchingHeuristicIds()`, `buildHeuristicIdLabelSvg()`, wire into `buildSvgOverlay()`
- **Add** `showHeuristicIds?: boolean` to `AnnotationOptions` (default: true)
- **Tests**: 4 unit ✅ (single ID rendered, multiple IDs comma-separated, no label for unmatched, viewport-aware filtering)
- **AC**: ✅ Heuristic IDs (e.g., PDP-CTA-001) rendered below bounding boxes in amber text
