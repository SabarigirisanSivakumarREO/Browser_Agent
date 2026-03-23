# Phase 30: Vision Optimization Layer

**Date**: 2026-03-23
**Spec**: `spec/requirements-phase30.md`
**Tasks**: `tasks/phase-30.md`

## Summary

Add category-aware auto-cropping and token-aware image compression.
Crop screenshots to CRO-relevant regions per category using existing
element bounding boxes, then compress to fit a per-image token budget
based on OpenAI's tile pricing model. Expected impact: 30-50% fewer
image tokens, better LLM focus on relevant content.

## Technical Context

**Image Processing**: sharp (already a dependency)
**Token Model**: OpenAI vision tiles — 512x512 per tile, 85 tokens/tile + 85 base
**Integration**: Category analyzer (per-category crops), batch prompt builder (full screenshots)
**Performance Goal**: <2% additional analysis time
**Default Budget**: 300 tokens/image (~3 tiles, fits ~1024x512)

## Sub-phases

### 30a: Token Calculator

**Goal**: Calculate OpenAI vision token cost for any image dimensions.

**Files**:
- NEW: `src/heuristics/vision/image-token-calculator.ts`
- MODIFY: `src/heuristics/vision/index.ts` (barrel export)

**Design**:

```typescript
calculateImageTokens(width: number, height: number): number
  // Tiles = ceil(width/512) * ceil(height/512)
  // Tokens = tiles * 85 + 85 (base)

findOptimalDimensions(
  originalWidth: number,
  originalHeight: number,
  maxTokens: number
): { width: number; height: number; tokens: number }
  // Binary search or step-down to find largest dimensions
  // that fit within token budget while maintaining aspect ratio
```

**Tests**: 6 unit tests (token calculation, optimal dimensions, edge cases)

### 30b: Category Element Mapper

**Goal**: Map heuristic categories to relevant element types, compute
union bounding boxes.

**Files**:
- NEW: `src/heuristics/vision/category-crop-mapper.ts`
- MODIFY: `src/heuristics/vision/index.ts` (barrel export)

**Design**:

```typescript
CATEGORY_ELEMENT_TYPES: Record<string, string[]> = {
  cta: ['cta'],
  forms: ['form'],
  trust: ['trust'],
  value_prop: ['value_prop'],
  navigation: ['navigation'],
  pricing: ['cta', 'value_prop'],  // pricing often near CTAs
  // ...
}

computeCropRegion(
  category: string,
  visibleElements: ElementMapping[],
  viewportWidth: number,
  viewportHeight: number,
  padding: number = 50
): CropRegion | null
  // Filter elements by category's relevant types
  // Compute union bounding box in screenshot coords
  // Add padding, clamp to viewport bounds
  // Return null if no elements or region >80% of viewport
```

**Tests**: 8 unit tests (mapping, union box, padding, fallback, edge cases)

### 30c: Auto-Crop Pipeline

**Goal**: Crop and compress screenshots per category within token budget.

**Files**:
- NEW: `src/heuristics/vision/image-crop-pipeline.ts`
- MODIFY: `src/heuristics/vision/index.ts` (barrel export)

**Design**:

```typescript
interface CropPipelineConfig {
  maxTokensPerImage: number;  // default: 300
  paddingPx: number;          // default: 50
  minCropSize: number;        // default: 100
  jpegQualityRange: [number, number];  // default: [30, 70]
  coverageThreshold: number;  // default: 0.8 (skip crop if >80%)
}

cropForCategory(
  screenshotBase64: string,
  category: string,
  visibleElements: ElementMapping[],
  viewportWidth: number,
  viewportHeight: number,
  config?: Partial<CropPipelineConfig>
): Promise<{ base64: string; tokens: number; cropped: boolean }>
  // 1. Compute crop region via category-crop-mapper
  // 2. If no region or region >80%: compress full image to budget
  // 3. Crop with sharp
  // 4. Find optimal dimensions within token budget
  // 5. Resize + compress (JPEG quality search)
  // 6. Return base64 + token count + whether cropping was applied
```

**Tests**: 8 unit tests (crop + compress flow, budget adherence, fallback, minimum size)

### 30d: Category Analyzer Integration

**Goal**: Use cropped screenshots in per-category LLM analysis.

**Files**:
- MODIFY: `src/heuristics/category-analyzer.ts`
- MODIFY: `src/heuristics/analysis-orchestrator.ts`

**Design**:

In `CategoryAnalyzer.analyzeCategory()`, before building the user
message with the screenshot:

```typescript
// If auto-crop enabled, crop screenshot for this category
let imageBase64 = snapshot.screenshot.base64;
if (config.autoCrop !== false) {
  const cropResult = await cropForCategory(
    snapshot.screenshot.base64,
    category,
    snapshot.visibleElements ?? [],
    viewportWidth, viewportHeight,
    { maxTokensPerImage: config.imageTokenBudget }
  );
  imageBase64 = cropResult.base64;
}
// Use imageBase64 in the LLM message instead of snapshot.screenshot.base64
```

For batched mode: use full (uncropped) screenshots since multiple
categories share one image.

**Tests**: 4 integration tests

### 30e: CLI Flags & Configuration

**Goal**: `--no-auto-crop` and `--image-token-budget` flags.

**Files**:
- MODIFY: `src/cli.ts`
- MODIFY: `src/agent/cro-agent.ts` (AnalyzeOptions)

**Flags**:
```
--no-auto-crop              Disable category-aware auto-cropping (default: enabled)
--image-token-budget <n>    Max tokens per image (default: 300)
```

**Tests**: 2 unit tests (flag parsing)

### 30f: Quality Validation

**Goal**: Verify token savings and no quality regression.

**Tests**: 3 integration tests + full regression

## Dependencies

```
30a (token calc) ←─┐
30b (crop mapper) ←─┤ no dependencies, start in parallel
                    │
30c (pipeline)    ← depends on 30a + 30b
  ↓
30d (integration) ← depends on 30c
30e (CLI flags)   ← depends on 30c (can parallel with 30d)
  ↓
30f (validation)  ← depends on 30d + 30e
```

## Session Plan

- **Session 1**: 30a + 30b + 30c (~12 tasks, ~22 tests) — core modules
- **Session 2**: 30d + 30e + 30f (~8 tasks, ~9 tests) — integration + CLI

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Cropping removes relevant context | Medium | Medium | 80% coverage threshold skips crop; padding; opt-out flag |
| Token calculation doesn't match OpenAI actual | Low | Low | Conservative budget; easily tunable |
| sharp crop latency | Low | Low | Typically <50ms per image |
| Batched mode regression | Low | High | Batched uses full screenshots explicitly |
