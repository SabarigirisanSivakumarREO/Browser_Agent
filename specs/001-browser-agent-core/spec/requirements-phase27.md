# Phase 27 Requirements: Analysis Quality & Annotation Fix

**Date**: 2026-02-19 | **Requirements**: FR-440 to FR-462

---

## 27A: Model Default & Centralization

**FR-440**: System MUST provide a centralized `MODEL_DEFAULTS` constant with `analysis` and `fast` model identifiers.

**FR-441**: Default analysis model MUST be `gpt-4o-mini` (fits within TPM limits for batched analysis with multiple screenshots).

**FR-442**: System MUST provide `--fast-analysis` CLI flag (uses `gpt-4o-mini`, same as default — retained for backward compatibility).

---

## 27B: Structured Element Refs

**FR-443**: LLM JSON schema MUST include `elementRefs: string[]` field for structured element references.

**FR-444**: System MUST extract element refs from structured JSON first, falling back to text scan.

**FR-445**: Both per-category and batched analysis modes MUST support structured `elementRefs`.

---

## 27C: Prompt Strengthening

**FR-446**: System prompt MUST include at least 3 few-shot examples demonstrating correct element ref usage.

**FR-447**: System prompt MUST include enforcement instructions: only report visible issues, set N/A when insufficient evidence.

---

## 27D: Confidence Threshold Filtering

**FR-448**: System MUST provide `--min-confidence` CLI flag (default: 0.7, range: 0-1).

**FR-449**: Evaluations below confidence threshold MUST be hidden from CLI display but preserved in evidence output.

**FR-450**: CLI MUST display confidence distribution summary showing filtered count.

---

## 27E: Deduplication Fix

**FR-451**: `InsightDeduplicator.createKey()` MUST use `heuristicId` as the deduplication key.

**FR-452**: `evaluationsToInsights()` MUST populate `element` field from `domElementRefs` when available.

---

## 27F: Annotation Pipeline Fix

**FR-453**: `populateElementRefs()` MUST set `viewportIndex` on evaluations from element ref viewport numbers.

**FR-454**: CLI annotation loop MUST annotate evaluations that have `domElementRefs`, not only those with exact `viewportIndex` match.

**FR-455**: CLI MUST log annotation coverage metric after annotation loop.

---

## 27G: DOM Cross-Validation

**FR-456**: System MUST provide `crossValidateEvaluations()` that checks LLM absence claims against DOM croType data.

**FR-457**: Contradicted evaluations MUST receive a 50% confidence penalty.

---

## 27H: Annotation Overlay Rendering Fix

**FR-458**: `getElementStatus()` MUST compare viewport indices when matching element refs, preventing cross-viewport false positives.

**FR-459**: `buildBoundingBoxSvg()` MUST clamp bounding boxes to viewport bounds on all four edges (top, bottom, left, right).

**FR-460**: `buildIndexLabelSvg()` MUST clamp label positions within viewport bounds.

**FR-461**: `annotateScreenshot()` MUST detect DPR scale mismatch between CSS viewport pixels and actual image resolution, and scale element coordinates accordingly.

**FR-462**: `AnnotationOptions` MUST support optional `cssViewportWidth` parameter (default: 1280) for DPR scale calculation.

---

## 27H (continued): Heuristic ID Labels

**FR-463**: Annotation overlay MUST render matching heuristic IDs (e.g., `PDP-CTA-001`) below highlighted bounding boxes for cross-referencing with analysis report.

**FR-464**: `AnnotationOptions` MUST support `showHeuristicIds` option (default: true) to toggle heuristic ID label rendering.

---

## Success Criteria

- **SC-200**: All existing tests continue to pass after Phase 27 changes.
- **SC-201**: New unit tests achieve >90% coverage of modified code paths.
- **SC-202**: Live test accuracy improves from 29% to >60% valid findings.
- **SC-203**: Evidence screenshots show bounding boxes on >50% of viewports (up from 8%).
