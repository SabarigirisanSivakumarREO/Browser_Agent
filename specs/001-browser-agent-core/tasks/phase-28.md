# Phase 28: Annotation & Ref Quality Improvements — Tasks

**Date**: 2026-03-04 | **Tasks**: T635-T640 (6 tasks) | **Status**: ❌ REVERTED

---

## Phase 28A: Rate Limit Retry (T635-T636) ✅ COMPLETE (2026-03-04)

### T635: Add retryWithBackoff() wrapper for LLM calls ✅
- **Modify** `src/heuristics/category-analyzer.ts` — added `retryWithBackoff()`, `isRateLimitError()`, `getRetryAfterMs()`. Wraps `this.llm.invoke()` in `analyzeCategory()`. Backoff: [15000, 30000, 60000]ms, max 2 retries. Respects Retry-After header.
- **Modify** `src/heuristics/analysis-orchestrator.ts` — wrapped batched LLM call in `runBatchedAnalysis()` with same retry logic
- **Modify** `src/heuristics/index.ts` — exported `retryWithBackoff`, `isRateLimitError`
- **Tests**: 0 (tested in T636)
- **AC**: ✅ 429 errors trigger exponential backoff retry, non-429 errors pass through immediately, type check passes

### T636: Unit tests for rate limit retry ✅
- **Create** `tests/unit/rate-limit-retry.test.ts`
- **Tests**: 8 unit (isRateLimitError: 3, retryWithBackoff: 5) ✅
- **AC**: ✅ All 8 tests pass

---

## Phase 28B: Confidence Downgrade (T637-T638) ✅ COMPLETE (2026-03-04)

### T637: Add downgradeUngroundedConfidence() function ✅
- **Modify** `src/heuristics/analysis-orchestrator.ts` — added `downgradeUngroundedConfidence()`, called after `populateElementRefs()` before `crossValidateEvaluations()`. 0.7x penalty for non-N/A evals with empty `domElementRefs`.
- **Modify** `src/heuristics/index.ts` — exported `downgradeUngroundedConfidence`
- **Tests**: 0 (tested in T638)
- **AC**: ✅ Non-N/A evals without refs get 0.7x confidence, N/A and ref'd evals unchanged

### T638: Unit tests for confidence downgrade ✅
- **Create** `tests/unit/confidence-downgrade.test.ts`
- **Tests**: 4 unit (non-N/A no refs→0.7x, N/A→unchanged, has refs→unchanged, empty array→0) ✅
- **AC**: ✅ All 4 tests pass

---

## Phase 28C: Evaluations in Evidence (T639-T640) ✅ COMPLETE (2026-03-04)

### T639: Add EvidenceEvaluation type and populate in evidence packager ✅
- **Modify** `src/types/evidence-schema.ts` — added `EvidenceEvaluation` interface, optional `evaluations?: EvidenceEvaluation[]` on `EvidencePackage`
- **Modify** `src/output/evidence-packager.ts` — added `evaluations` to `BuildEvidenceInput`, maps `HeuristicEvaluation[]` → `EvidenceEvaluation[]` in `buildEvidencePackage()`
- **Tests**: 0 (tested in T640)
- **AC**: ✅ evidence.json includes `evaluations` array with all fields; omitted when not provided; empty array when empty input

### T640: Unit tests for evidence evaluations ✅
- **Create** `tests/unit/evidence-evaluations.test.ts`
- **Tests**: 4 unit (populated with fields, empty→empty array, omitted when undefined, downgraded confidence reflected) ✅
- **AC**: ✅ All 4 tests pass

---

## Validation

```bash
# All Phase 28 tests
npx vitest run tests/unit/rate-limit-retry.test.ts tests/unit/confidence-downgrade.test.ts tests/unit/evidence-evaluations.test.ts

# Type check
npx tsc --noEmit
```
