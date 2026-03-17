# Phase 28 Revert Plan

**Date**: 2026-03-04 | **Reason**: Rate limiting still too aggressive — retries alone insufficient

## Session Prompt

```
Read specs/001-browser-agent-core/plan/phase-28-revert.md and execute the revert plan.
```

## Files to Revert (Source Code)

### 1. `src/heuristics/category-analyzer.ts`
- **Remove**: `RATE_LIMIT_BACKOFF_MS`, `MAX_RATE_LIMIT_RETRIES` constants (near top, after imports)
- **Remove**: `isRateLimitError()` function
- **Remove**: `getRetryAfterMs()` function
- **Remove**: `retryWithBackoff()` function
- **Revert**: In `analyzeCategory()`, change `retryWithBackoff(() => this.llm.invoke(messages), ...)` back to `this.llm.invoke(messages)`

### 2. `src/heuristics/analysis-orchestrator.ts`
- **Remove import**: `retryWithBackoff` from category-analyzer import line
- **Revert**: In `runBatchedAnalysis()`, change `retryWithBackoff(() => llm.invoke(messages), ...)` back to `llm.invoke(messages)` and remove `batchCategoryNames` variable
- **Remove**: `downgradeUngroundedConfidence()` function (bottom of file)
- **Remove**: `UNGROUNDED_CONFIDENCE_PENALTY` constant
- **Remove**: The Phase 28B block in `runAnalysis()` that calls `downgradeUngroundedConfidence()` and logs the warning (between "Combine all evaluations" and "Phase 27G: Cross-validate")

### 3. `src/heuristics/index.ts`
- **Remove exports**: `retryWithBackoff`, `isRateLimitError`, `downgradeUngroundedConfidence`

### 4. `src/types/evidence-schema.ts`
- **Remove**: `EvidenceEvaluation` interface (Phase 28C section)
- **Remove**: `evaluations?: EvidenceEvaluation[]` field from `EvidencePackage`
- **Remove**: The "Evaluation Evidence Types (Phase 28C)" section comment block

### 5. `src/output/evidence-packager.ts`
- **Remove import**: `HeuristicEvaluation` from `../heuristics/vision/types.js`
- **Remove import**: `EvidenceEvaluation` from the evidence-schema import
- **Remove**: `evaluations?: HeuristicEvaluation[]` from `BuildEvidenceInput`
- **Remove**: `evaluations: inputEvaluations` destructuring (revert to just `domTree`)
- **Remove**: `evidenceEvaluations` mapping block before "Build final package"
- **Remove**: `...(evidenceEvaluations !== undefined ? { evaluations: evidenceEvaluations } : {})` from the package object

## Files to Delete (Tests)

- `tests/unit/rate-limit-retry.test.ts`
- `tests/unit/confidence-downgrade.test.ts`
- `tests/unit/evidence-evaluations.test.ts`

## Spec Kit Files to Update

### 6. `specs/001-browser-agent-core/tasks/phase-28.md`
- Mark all tasks as REVERTED instead of ✅

### 7. `specs/001-browser-agent-core/plan/phase-28.md`
- Change status to `❌ REVERTED`

### 8. `specs/001-browser-agent-core/quickstart.md`
- Update "Last Updated" to reflect revert

### 9. `specs/001-browser-agent-core/SESSION-PROMPT.md`
- Update to reflect Phase 28 reverted

### 10. MEMORY.md
- Update Phase 28 status to REVERTED

## Validation After Revert

```bash
# Type check — must pass clean
npx tsc --noEmit

# Verify deleted test files don't exist
ls tests/unit/rate-limit-retry.test.ts tests/unit/confidence-downgrade.test.ts tests/unit/evidence-evaluations.test.ts

# Run Phase 27 tests to confirm no regressions
npx vitest run tests/unit/model-config.test.ts tests/unit/dedup-fix.test.ts tests/unit/structured-element-refs.test.ts tests/unit/annotation-pipeline.test.ts tests/unit/confidence-filtering.test.ts tests/unit/cross-validator.test.ts tests/unit/element-mapping-prompt.test.ts
```
