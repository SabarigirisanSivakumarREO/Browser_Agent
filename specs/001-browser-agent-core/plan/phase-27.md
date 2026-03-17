# Phase 27: Analysis Quality & Annotation Fix

**Date**: 2026-02-19 | **Status**: ✅ Complete

## Overview

Live testing on a Peregrine Clothing PDP revealed systemic quality issues in the LLM analysis pipeline:

- **29% finding accuracy**: Only 2/14 partial findings were fully valid
- **Broken annotations**: Only 1 of 12 viewport screenshots had bounding box overlay
- **LLM hallucination**: 7/14 findings factually wrong (gpt-4o-mini quality ceiling)
- **Missing element refs**: LLM rarely uses `[v0-N]` format, `populateElementRefs()` finds nothing
- **Dedup bug**: All insights have `element: "N/A"` causing 14→1 collapse
- **Annotation filter bug**: CLI filters by `viewportIndex` but evaluations often have `viewportIndex: undefined`

## Architecture

### 27A: Model Default & Centralization (T616-T618)
- Create `MODEL_DEFAULTS` constant in `src/heuristics/model-config.ts`
- Replace all hardcoded model strings in analysis pipeline with `MODEL_DEFAULTS.analysis`
- Default model: `gpt-4o-mini` (fits within 30K TPM limit for batched multi-viewport requests)
- `--fast-analysis` CLI flag retained for backward compatibility (same as default)

### 27B: Structured Element Refs in JSON Schema (T619-T622)
- Add `elementRefs: string[]` to LLM JSON schema
- Force LLM to return element refs as structured data (not buried in prose)
- Extract from structured JSON first, fall back to text scan

### 27C: Prompt Strengthening (T623-T624)
- Add few-shot examples with proper element refs
- Add enforcement instructions against hallucination

### 27D: Confidence Threshold Filtering (T625-T627)
- Add `--min-confidence` CLI flag (default 0.7)
- Filter low-confidence evaluations from display (keep in evidence)
- Show confidence distribution summary

### 27E: Deduplication Fix (T628-T629)
- Fix `InsightDeduplicator.createKey()` to use `heuristicId`
- Fix `evaluationsToInsights()` to populate `element` from `domElementRefs`

### 27F: Annotation Pipeline Fix (T630-T632)
- Fix viewport assignment from element refs
- Fix CLI annotation filter to use `domElementRefs` presence
- Add annotation coverage metric

### 27G: DOM Cross-Validation (T633-T634)
- Rule-based post-processing to catch suspect LLM claims
- Downgrade confidence of contradicted evaluations

### 27H: Annotation Overlay Rendering Fix (T635-T640)
- Viewport-aware element matching in `getElementStatus()` (prevents cross-viewport false positives)
- Full-edge bounding box clamping (top, bottom, left, right)
- Label position clamping within viewport bounds
- DPR scale mismatch detection and coordinate scaling
- Heuristic ID labels below bounding boxes for cross-referencing

## Key Files

| File | Change |
|------|--------|
| `src/heuristics/model-config.ts` | **CREATE** — centralized model defaults |
| `src/heuristics/category-analyzer.ts` | Model ref, JSON schema, prompt, parsing |
| `src/heuristics/analysis-orchestrator.ts` | Model ref, dedup fix |
| `src/heuristics/batch-prompt-builder.ts` | JSON schema, prompt |
| `src/heuristics/batch-response-parser.ts` | elementRefs extraction |
| `src/output/insight-deduplicator.ts` | Fix createKey() |
| `src/output/screenshot-annotator.ts` | Viewport matching, clamping, DPR scaling |
| `src/agent/cro-agent.ts` | Model ref |
| `src/cli.ts` | --fast-analysis, --min-confidence, annotation fix |

## Session Plan

| Session | Tasks | Focus | Status |
|---------|-------|-------|--------|
| 1 | T616-T618 + T628-T629 | Model upgrade + Dedup fix | ✅ 9 tests |
| 2 | T619-T622 | Structured element refs | ✅ 10 tests |
| 3 | T623-T624 | Prompt strengthening | ✅ 5 tests |
| 3b | T630-T632 | Annotation pipeline fix | ✅ 7 tests |
| 4 | T625-T627 | Confidence filtering | ✅ 7 tests |
| 5 | T633-T634 | DOM cross-validation | ✅ 5 tests |
| 6 | T635-T640 | Annotation overlay rendering fix | ✅ 8 tests |
