# Phase 28: Annotation & Ref Quality Improvements

**Date**: 2026-03-04 | **Status**: ❌ REVERTED (retries caused timeouts, confidence downgrade broke annotations)

## Overview

Live testing on a Peregrine Bexley Jacket PDP with gpt-4o-mini revealed:
- **8/35 heuristics lost** due to 429 rate limits with no retry mechanism
- **1 evaluated heuristic** (PDP-IMAGE-004) had no element refs despite enforcement rules — LLM gave vague reasoning
- **evidence.json** lacks evaluation data for post-hoc analysis

Three targeted fixes: rate limit retry, confidence downgrade for ungrounded evaluations, and evaluations in evidence output.

## Architecture

### 28A: Rate Limit Retry (T635-T636)
- Add `retryWithBackoff()` wrapper around `this.llm.invoke()` in `src/heuristics/category-analyzer.ts`
- Detect 429 via error message string match ("429", "rate limit") and error.status property
- Backoff schedule: [15000, 30000, 60000]ms, max 2 retries
- Respect `Retry-After` header if present in error
- Log each retry: category name, attempt #, wait duration
- Also wrap batched LLM call in `src/heuristics/analysis-orchestrator.ts` `runBatchedAnalysis()`

### 28B: Confidence Downgrade (T637-T638)
- Add `downgradeUngroundedConfidence()` in `src/heuristics/analysis-orchestrator.ts`
- Called after `populateElementRefs()` and before `crossValidateEvaluations()` (~line 165)
- Non-N/A evaluations with empty `domElementRefs` → confidence *= 0.7
- Returns count of downgraded evaluations, orchestrator logs summary

### 28C: Evaluations in Evidence (T639-T640)
- Add `EvidenceEvaluation` type in `src/types/evidence-schema.ts`
- Fields: heuristicId, status, confidence, observation, elementRefs (as viewportRef strings)
- Add optional `evaluations?: EvidenceEvaluation[]` to `EvidencePackage`
- Update `buildEvidencePackage()` in `src/output/evidence-packager.ts` to accept and map evaluations

## Key Decisions (from research.md)

1. **Retry location**: Inside `CategoryAnalyzer.analyzeCategory()` wrapping `this.llm.invoke()` — both per-category and batched benefit
2. **Downgrade location**: In orchestrator after `populateElementRefs()` — works for both modes without duplication
3. **Evidence structure**: Optional `evaluations` field on `EvidencePackage` — backward compatible
4. **429 detection**: Check both error message string and error.status property — covers all LangChain wrapper variants
