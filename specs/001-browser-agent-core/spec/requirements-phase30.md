# Requirements: Phase 30 — Vision Optimization Layer

**Phase**: 30
**Created**: 2026-03-23
**Status**: Draft

## Overview

Add category-aware auto-cropping and a token-aware image compression
pipeline. Instead of sending full 1280x720 screenshots, crop to the
CRO-relevant region per category using existing element bounding boxes,
then compress to fit a per-image token budget based on OpenAI's tile
pricing model.

## User Stories

### US-30a: Category-Aware Auto-Cropping (P1)

As the analysis engine, I need screenshots cropped to the region
containing relevant CRO elements for each category so the LLM receives
focused, noise-free images instead of full viewport screenshots with
irrelevant headers, footers, and whitespace.

**Acceptance Scenarios**:

1. **Given** a viewport with CTA elements at y:300-400 and a 720px
   viewport, **When** analyzing the CTA category, **Then** the
   screenshot sent to the LLM is cropped to the CTA region (with
   padding) rather than the full viewport.
2. **Given** a viewport with no relevant elements for a category,
   **When** that category is analyzed, **Then** the full viewport
   screenshot is sent unchanged (fallback).
3. **Given** elements spread across the full viewport, **When** the
   union bounding box covers >80% of the viewport, **Then** the full
   screenshot is sent (cropping would save negligible tokens).

### US-30b: Token-Aware Image Compression (P2)

As a cost-conscious user, I want the image pipeline to calculate actual
OpenAI token costs and compress images to fit a per-image token budget
so I pay only for the detail level needed.

**Acceptance Scenarios**:

1. **Given** a cropped screenshot, **When** the pipeline processes it,
   **Then** the output image fits within the configured token budget.
2. **Given** a viewport with dense CRO content, **When** compressed,
   **Then** more detail is preserved (higher resolution within budget).
3. **Given** a viewport with sparse CRO content, **When** compressed,
   **Then** the image is aggressively compressed (smaller, cheaper).
4. **Given** the `--image-token-budget` flag set to 200, **When**
   analysis runs, **Then** each image consumes at most ~200 tokens.

### US-30c: Integration with Analysis Pipeline (P3)

As a developer, I need the vision optimization layer to integrate
seamlessly with the existing category analyzer and batch prompt builder
so cropped images are used automatically during analysis.

**Acceptance Scenarios**:

1. **Given** vision analysis with auto-cropping enabled, **When**
   per-category analysis runs, **Then** each category receives a
   screenshot cropped to its relevant elements.
2. **Given** batched analysis mode, **When** batch prompt builder
   constructs shared context, **Then** the full viewport screenshot
   is used (batched categories share one image).
3. **Given** `--no-auto-crop` flag, **When** analysis runs, **Then**
   full viewport screenshots are used (backward compatible).

## Functional Requirements

- **FR-30-001**: System MUST compute a union bounding box from
  `ElementMapping[]` for elements relevant to each heuristic category
  (CTA, forms, trust, value_prop, navigation, friction).
- **FR-30-002**: System MUST add configurable padding around the union
  bounding box (default: 50px on each side, clamped to image bounds).
- **FR-30-003**: System MUST crop the viewport screenshot to the
  padded union bounding box using sharp.
- **FR-30-004**: System MUST fall back to the full viewport screenshot
  when no relevant elements exist or when the crop region covers >80%
  of the viewport area.
- **FR-30-005**: System MUST calculate OpenAI vision token cost using
  the tile-based formula: images are split into 512x512 tiles, each
  tile costs 85 tokens, plus 85 base tokens.
- **FR-30-006**: System MUST compress images to fit within a
  configurable per-image token budget (default: 300 tokens).
- **FR-30-007**: System MUST select optimal resolution and JPEG
  quality to minimize tokens while maximizing detail within budget.
- **FR-30-008**: System MUST integrate auto-cropping into the
  per-category analysis path in the category analyzer.
- **FR-30-009**: System MUST use full (uncropped) screenshots for
  batched analysis mode (multiple categories share one image).
- **FR-30-010**: System MUST support `--no-auto-crop` CLI flag to
  disable cropping (default: enabled).
- **FR-30-011**: System MUST support `--image-token-budget <n>` CLI
  flag (default: 300 tokens per image).
- **FR-30-012**: System MUST NOT modify the original `ViewportSnapshot`
  screenshots — cropping produces temporary buffers for LLM submission
  only. Evidence screenshots remain full resolution.

## Edge Cases

- No relevant elements for a category in a viewport: use full screenshot.
- Union bounding box covers entire viewport: skip cropping.
- Very small crop region (<50x50px): expand to minimum 100x100px.
- Token budget too low for any meaningful image: send minimum viable
  image (128x128 JPEG quality 30) with warning.
- Tiled screenshot mode: cropping applies to each tile's relevant
  region within the tile bounds.

## Assumptions

- OpenAI's vision token pricing follows the tile model: 512x512 tiles
  at 85 tokens each + 85 base tokens. This is current as of 2025.
- Category-to-element mapping can use existing `croType` classification
  on DOM elements (cta, form, trust, value_prop, navigation).
- sharp can crop and recompress in <50ms per image (fast enough to not
  impact the 5% time budget).
- Default 300-token budget allows ~3 tiles (255 + 85 = 340 tokens)
  which fits a ~1024x512 image — sufficient for most CRO regions.

## Success Criteria

- **SC-30-001**: Image token cost per analysis reduced by 30-50%
  compared to current fixed compression (measured across 10+ pages).
- **SC-30-002**: Auto-cropping adds <2% to total analysis time.
- **SC-30-003**: LLM analysis quality (effective match rate) stays
  >=80% with cropping enabled vs baseline.
- **SC-30-004**: All existing 1281+ tests pass (zero regressions).
- **SC-30-005**: Evidence screenshots remain full resolution (cropping
  is LLM-submission only).
