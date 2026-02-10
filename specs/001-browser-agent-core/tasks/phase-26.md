# Phase 26 Tasks: LLM Analysis Optimization

**Phase**: 26
**Status**: Planned (Revised 2026-02-10)
**Tasks**: T550-T577 (28 tasks)
**Tests**: 20 unit + 4 integration + 4 E2E = 28 total

---

## Task Summary

| Sub-phase | Tasks | Count | Focus | Tests | Status |
|-----------|-------|-------|-------|-------|--------|
| 26a | T550-T555 | 6 | Parallel Category Analysis | 6 unit |  |
| 26b | T556-T563 | 8 | Category Batching | 4+4 unit, 1 int |  |
| 26c | T564-T568 | 5 | Intelligent Viewport Filtering | 6 unit, 1 int |  |
| 26e | T569-T574 | 6 | Quality Validation (CI-only) | — unit, 1 int |  |
| 26f | T575-T577 | 3 | Cross-cutting E2E Tests | 4 E2E |  |
| **Total** | | **28** | | **28** | |

**Dropped** (from original 52-task plan):
- ~~26d: Response Token Optimization~~ - Only 1.5% savings, not worth complexity
- ~~Runtime auto-rollback~~ - Over-engineered; quality validation is CI-only
- ~~test-suites.ts~~ - Not needed for CI-only validation
- ~~baseline-runner.ts~~ - Validator handles baseline directly
- ~~optimization-metrics.ts~~ - Metrics tracked inline in orchestrator

---

## Phase 26a: Parallel Category Analysis (T550-T555)

### T550: Add parallel config + install p-limit
**Files**: `src/heuristics/analysis-orchestrator.ts`, `package.json`
**Type**: Modify
**Status**: TODO

Install p-limit for concurrency control and add parallel config fields:

```bash
npm install p-limit@4
```

Update orchestrator config defaults:
```typescript
// BEFORE:
parallelAnalysis: false,

// AFTER:
parallelAnalysis: true,
maxConcurrentCategories: 5,
parallelTimeoutMs: 120000,
```

**Acceptance**:
- [ ] p-limit@4.x installed
- [ ] package.json updated
- [ ] Config fields added with defaults
- [ ] No version conflicts

---

### T551: Implement rate-limited parallel with timeout + error isolation
**File**: `src/heuristics/analysis-orchestrator.ts`
**Type**: Modify
**Status**: TODO

Implement `runParallelAnalysis` with p-limit rate limiting, per-category timeout via Promise.race, and error isolation (one failure returns empty result, doesn't fail all):

```typescript
import pLimit from 'p-limit';

async function runParallelAnalysis(
  categories: HeuristicCategory[],
  snapshots: ViewportSnapshot[],
  config: ParallelConfig
): Promise<CategoryAnalysisResult[]> {
  const limit = pLimit(config.maxConcurrentCategories);

  const promises = categories.map(category =>
    limit(async () => {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: ${category.name}`)), config.parallelTimeoutMs)
      );
      try {
        return await Promise.race([analyzeCategory(category, snapshots), timeoutPromise]);
      } catch (error) {
        logger.warn(`Category analysis failed: ${category.name}`, { error });
        return createEmptyResult(category, error);
      }
    })
  );

  return await Promise.all(promises);
}
```

**Acceptance**:
- [ ] Uses Promise.all for concurrency
- [ ] Rate limited via p-limit
- [ ] Timeout per category (configurable)
- [ ] Error isolation (one failure doesn't fail all)
- [ ] createEmptyResult helper added

---

### T552: Wire parallelAnalysis in cro-agent.ts
**File**: `src/agent/cro-agent.ts`
**Type**: Modify
**Status**: TODO

Pass `parallelAnalysis: true` when creating the AnalysisOrchestrator at ~line 861. Route to parallel vs sequential path based on config.

**Acceptance**:
- [ ] Orchestrator receives parallelAnalysis config
- [ ] Parallel path used when true or undefined
- [ ] Sequential path when explicitly false
- [ ] Backward compatible

---

### T553: Add --sequential-analysis + --max-concurrent-categories CLI flags
**File**: `src/cli.ts`
**Type**: Modify
**Status**: TODO

```typescript
.option('--sequential-analysis', 'Disable parallel analysis, run categories sequentially')
.option('--max-concurrent-categories <n>', 'Max concurrent category analyses (default: 5)', '5')
```

Parse and pass to orchestrator config.

**Acceptance**:
- [ ] Flags parsed correctly
- [ ] Passed to orchestrator config
- [ ] Help text accurate

---

### T554: Export updated types from heuristics index
**File**: `src/heuristics/index.ts`
**Type**: Modify
**Status**: TODO

Ensure parallel config types and any new exports are available from the heuristics barrel.

**Acceptance**:
- [ ] Types exported
- [ ] No circular dependencies

---

### T555: Unit tests for parallel analysis
**File**: `tests/unit/parallel-analysis.test.ts`
**Type**: Create
**Status**: TODO

```typescript
describe('runParallelAnalysis', () => {
  it('should execute categories in parallel using Promise.all');
  it('should respect maxConcurrentCategories rate limit');
  it('should timeout individual categories after parallelTimeoutMs');
  it('should isolate errors (one failure does not fail all)');
  it('should fall back to sequential when parallelAnalysis is false');
  it('should track execution metrics correctly');
});
```

**Acceptance**:
- [ ] 6 unit tests written
- [ ] All tests pass
- [ ] Mocks API calls appropriately

---

## Phase 26b: Category Batching (T556-T563)

### T556: Create category-batcher.ts with batch definitions
**File**: `src/heuristics/category-batcher.ts`
**Type**: Create
**Status**: TODO

Create batch grouping module with predefined related-category batches and `groupCategoriesIntoBatches()` function.

```typescript
export const CATEGORY_BATCHES: string[][] = [
  ['Layout & Structure', 'Mobile Usability'],
  ['Pricing & Cost Transparency', 'Description & Value Proposition'],
  ['Reviews & Social Proof', 'Selection & Configuration'],
  ['Product Imagery & Media', 'Specifications & Details'],
  ['CTA & Purchase Confidence', 'Utility & Secondary Actions'],
];

export function groupCategoriesIntoBatches(
  categories: HeuristicCategory[],
  strategy: 'size' | 'related' | 'custom',
  customBatches?: string[][]
): HeuristicCategory[][] { /* ... */ }
```

**Acceptance**:
- [ ] 5 predefined batches defined
- [ ] Grouping function exported
- [ ] Handles custom batches
- [ ] Filters empty batches

---

### T557: Create batch-prompt-builder.ts
**File**: `src/heuristics/batch-prompt-builder.ts`
**Type**: Create
**Status**: TODO

Build multi-category prompts with shared context (DOM + screenshots sent once) and per-category heuristic sections.

```typescript
export function buildBatchedPrompt(
  categories: HeuristicCategory[],
  snapshots: ViewportSnapshot[],
  domContext: string,
  screenshotRefs: string[]
): string { /* ... */ }
```

**Acceptance**:
- [ ] Shared context section (DOM + screenshots)
- [ ] Per-category heuristics sections with clear separators
- [ ] Output format specification with category-keyed JSON
- [ ] Handles single-category batch correctly

---

### T558: Create batch-response-parser.ts
**File**: `src/heuristics/batch-response-parser.ts`
**Type**: Create
**Status**: TODO

Parse multi-category LLM responses with category-keyed JSON extraction.

```typescript
export interface BatchedResponse {
  [categoryName: string]: { evaluations: HeuristicEvaluation[] };
}

export function parseBatchedResponse(
  response: string,
  expectedCategories: string[]
): BatchedResponse { /* ... */ }

export class BatchParseError extends Error {
  constructor(public response: string, public cause: Error) {
    super(`Failed to parse batched response: ${cause.message}`);
  }
}
```

**Acceptance**:
- [ ] Parses category-keyed JSON
- [ ] Handles missing categories gracefully (empty evaluations)
- [ ] Custom BatchParseError class
- [ ] extractJSON helper for response cleaning

---

### T559: Implement analyzeBatch + integrate into orchestrator
**File**: `src/heuristics/analysis-orchestrator.ts`
**Type**: Modify
**Status**: TODO

Add batched execution path using category-batcher and batch-prompt-builder. Fallback to single-category on BatchParseError.

```typescript
async runBatchedAnalysis(
  categories: HeuristicCategory[],
  snapshots: ViewportSnapshot[],
  config: AnalysisConfig
): Promise<CategoryAnalysisResult[]> {
  const batches = groupCategoriesIntoBatches(categories, config.batchStrategy);
  // Execute batches (parallel or sequential based on config)
  // Fallback to single on parse failure
}
```

**Acceptance**:
- [ ] Groups categories into batches
- [ ] Executes batch analysis via prompt builder + parser
- [ ] Fallback to single on parse failure
- [ ] Results correctly merged
- [ ] Works with parallel execution

---

### T560: Add --no-category-batching CLI flag
**File**: `src/cli.ts`
**Type**: Modify
**Status**: TODO

```typescript
.option('--no-category-batching', 'Disable category batching, one LLM call per category')
```

**Acceptance**:
- [ ] Flag parsed correctly
- [ ] Passed to orchestrator config
- [ ] Help text clear

---

### T561: Export batching modules from heuristics index
**File**: `src/heuristics/index.ts`
**Type**: Modify
**Status**: TODO

```typescript
export { groupCategoriesIntoBatches, CATEGORY_BATCHES } from './category-batcher';
export { buildBatchedPrompt } from './batch-prompt-builder';
export { parseBatchedResponse, BatchParseError } from './batch-response-parser';
```

**Acceptance**:
- [ ] All new modules exported
- [ ] No circular dependencies

---

### T562: Unit tests for category batcher + prompt builder
**File**: `tests/unit/category-batching.test.ts`
**Type**: Create
**Status**: TODO

```typescript
describe('groupCategoriesIntoBatches', () => {
  it('should group related categories together');
  it('should handle custom batch configuration');
});

describe('buildBatchedPrompt', () => {
  it('should include shared context once');
  it('should include category separators and output format');
});
```

**Acceptance**:
- [ ] 4 unit tests
- [ ] All pass

---

### T563: Unit tests for batch response parser + integration test
**Files**: `tests/unit/batch-response-parser.test.ts`, `tests/integration/batched-analysis.test.ts`
**Type**: Create
**Status**: TODO

```typescript
// Unit tests
describe('parseBatchedResponse', () => {
  it('should parse valid category-keyed JSON');
  it('should handle missing categories gracefully');
  it('should throw BatchParseError on invalid JSON');
  it('should handle partial responses');
});

// Integration test
describe('Batched Analysis Integration', () => {
  it('should reduce API calls from 10 to 5 with batching');
  it('should fall back to single-category on parse failure');
});
```

**Acceptance**:
- [ ] 4 unit tests + 1 integration test (2 cases)
- [ ] All pass

---

## Phase 26c: Intelligent Viewport Filtering (T564-T568)

### T564: Create viewport-selector.ts (config + select + DOM filter)
**File**: `src/heuristics/viewport-selector.ts`
**Type**: Create
**Status**: TODO

Create viewport selection module with:
1. `CategoryViewportConfig` interface
2. `VIEWPORT_REQUIREMENTS` constant (10 categories)
3. `selectViewportsForCategory()` function
4. `filterDOMForViewports()` function

**Acceptance**:
- [ ] All 10 categories have viewport requirements
- [ ] selectViewportsForCategory handles all modes (all, above_fold, below_fold, custom)
- [ ] maxViewports enforced
- [ ] filterDOMForViewports parses viewport sections
- [ ] Fallback to all viewports when category not found

---

### T565: Integrate viewport filtering into category-analyzer.ts
**File**: `src/heuristics/category-analyzer.ts`
**Type**: Modify
**Status**: TODO

Before building the LLM prompt, filter viewports and DOM based on category:

```typescript
const snapshots = config.enableViewportFiltering !== false
  ? selectViewportsForCategory(category.name, allSnapshots)
  : allSnapshots;

const domContext = config.enableViewportFiltering !== false
  ? filterDOMForViewports(this.fullDOM, snapshots)
  : this.fullDOM;
```

**Acceptance**:
- [ ] Viewports filtered before analysis
- [ ] DOM filtered to match selected viewports
- [ ] Configurable via enableViewportFiltering
- [ ] Backward compatible when disabled

---

### T566: Add --no-viewport-filtering CLI flag + export
**Files**: `src/cli.ts`, `src/heuristics/index.ts`
**Type**: Modify
**Status**: TODO

```typescript
// cli.ts
.option('--no-viewport-filtering', 'Send all viewports to all categories')

// heuristics/index.ts
export {
  selectViewportsForCategory,
  filterDOMForViewports,
  VIEWPORT_REQUIREMENTS,
} from './viewport-selector';
```

**Acceptance**:
- [ ] CLI flag parsed and passed to config
- [ ] Viewport selector exports added
- [ ] No circular dependencies

---

### T567: Unit tests for viewport selector
**File**: `tests/unit/viewport-filtering.test.ts`
**Type**: Create
**Status**: TODO

```typescript
describe('selectViewportsForCategory', () => {
  it('should return viewports 0-1 for above_fold');
  it('should return viewports 2+ for below_fold');
  it('should return specified indices for custom');
  it('should cap at maxViewports');
  it('should handle insufficient viewports gracefully');
  it('should return all when category not found');
});
```

**Acceptance**:
- [ ] 6 unit tests
- [ ] All modes tested

---

### T568: Integration test for viewport filtering
**File**: `tests/integration/viewport-filtering.test.ts`
**Type**: Create
**Status**: TODO

```typescript
describe('Viewport Filtering Integration', () => {
  it('should send only 1 viewport for Mobile Usability and filter DOM accordingly');
});
```

**Acceptance**:
- [ ] 1 integration test
- [ ] Verifies viewport count and DOM filtering together

---

## Phase 26e: Quality Validation — CI-only (T569-T574)

### T569: Create result-comparator.ts
**File**: `src/validation/result-comparator.ts`
**Type**: Create
**Status**: TODO

Compare baseline vs optimized analysis results:

```typescript
export interface ComparisonResult {
  total: number;
  matching: number;
  discrepancies: Array<{
    baseline: HeuristicEvaluation;
    optimized: HeuristicEvaluation;
  }>;
}

export function compareResults(
  baseline: AnalysisResult,
  optimized: AnalysisResult
): ComparisonResult { /* ... */ }
```

**Acceptance**:
- [ ] Compares by heuristicId
- [ ] Counts matching status
- [ ] Captures discrepancy pairs
- [ ] Handles missing evaluations

---

### T570: Create discrepancy-classifier.ts
**File**: `src/validation/discrepancy-classifier.ts`
**Type**: Create
**Status**: TODO

Classify discrepancies by severity:

```typescript
export function classifyDiscrepancy(
  baseline: HeuristicEvaluation,
  optimized: HeuristicEvaluation
): QualityDiscrepancy {
  // Critical: pass↔fail flip
  // Major: partial mismatch
  // Minor: confidence diff > 20%
}
```

**Acceptance**:
- [ ] Critical = pass/fail flip
- [ ] Major = partial mismatch
- [ ] Minor = confidence diff > 20%
- [ ] likelyCause populated

---

### T571: Create quality-validator.ts (CI-only)
**File**: `src/validation/quality-validator.ts`
**Type**: Create
**Status**: TODO

CI-only validation orchestrator:

```typescript
export class QualityValidator {
  constructor(
    private config: QualityValidationConfig,
    private orchestrator: AnalysisOrchestrator
  ) {}

  async validate(url: string): Promise<QualityValidationResult> {
    // 1. Run baseline (non-optimized)
    // 2. Run optimized
    // 3. Compare results
    // 4. Classify discrepancies
    // 5. Check threshold + no critical
  }
}
```

**Acceptance**:
- [ ] Runs baseline + optimized analyses
- [ ] Compares and classifies discrepancies
- [ ] Fails on any critical discrepancy
- [ ] Fails if match rate below threshold
- [ ] Generates recommendations

---

### T572: Add --validate-quality CLI flag + validation/index.ts
**Files**: `src/cli.ts`, `src/validation/index.ts`
**Type**: Create + Modify
**Status**: TODO

```typescript
// cli.ts
.option('--validate-quality', 'Run quality validation comparing optimized vs baseline (CI use)')

// validation/index.ts
export { QualityValidator } from './quality-validator';
export { classifyDiscrepancy } from './discrepancy-classifier';
export { compareResults } from './result-comparator';
```

**Acceptance**:
- [ ] CLI flag parsed correctly
- [ ] Triggers validation mode in CLI
- [ ] All validation modules exported
- [ ] No circular dependencies

---

### T573: Unit tests for comparator + classifier
**File**: `tests/unit/quality-validation.test.ts`
**Type**: Create
**Status**: TODO

```typescript
describe('compareResults', () => {
  it('should count matching heuristic statuses');
  it('should capture discrepancy pairs for mismatches');
});

describe('classifyDiscrepancy', () => {
  it('should classify pass→fail as critical');
  it('should classify partial mismatch as major');
  it('should classify confidence diff > 20% as minor');
});
```

Note: These are conceptual tests - actual test count may vary. Quality validation testing is primarily integration-focused.

**Acceptance**:
- [ ] Tests cover comparison and classification logic
- [ ] All pass

---

### T574: Integration test for quality validation
**File**: `tests/integration/quality-validation.test.ts`
**Type**: Create
**Status**: TODO

```typescript
describe('Quality Validation Integration', () => {
  it('should run baseline and optimized analyses and report match rate');
});
```

**Acceptance**:
- [ ] 1 integration test
- [ ] Uses mocked LLM responses
- [ ] Tests full validation flow

---

## Phase 26f: Cross-cutting E2E Tests (T575-T577)

### T575: E2E test: parallel + batching combined
**File**: `tests/e2e/optimization-parallel-batch.test.ts`
**Type**: Create
**Status**: TODO

```typescript
describe('Parallel + Batching E2E', () => {
  it('should complete analysis with parallel batches and produce valid results');
});
```

**Acceptance**:
- [ ] 1 E2E test
- [ ] Parallel + batching both active
- [ ] Results valid and complete

---

### T576: E2E test: viewport filtering
**File**: `tests/e2e/optimization-viewport.test.ts`
**Type**: Create
**Status**: TODO

```typescript
describe('Viewport Filtering E2E', () => {
  it('should filter viewports per category and produce valid results');
});
```

**Acceptance**:
- [ ] 1 E2E test
- [ ] Category-specific viewport selection verified
- [ ] Results valid

---

### T577: E2E test: full optimization stack
**File**: `tests/e2e/optimization-full.test.ts`
**Type**: Create
**Status**: TODO

```typescript
describe('Full Optimization Stack E2E', () => {
  it('should run with all optimizations enabled (parallel + batch + viewport filter)');
  it('should pass quality validation against baseline');
});
```

**Acceptance**:
- [ ] 2 E2E tests
- [ ] All optimizations active
- [ ] Quality validation passes

---

## Checkpoint Summary

| Checkpoint | Tasks | Verification |
|------------|-------|--------------|
| 26a Complete | T550-T555 | Parallel analysis works, 10x speedup, rate limited |
| 26b Complete | T556-T563 | Batching works, 5 calls instead of 10, 56% token savings |
| 26c Complete | T564-T568 | Viewport filtering works, 15-30% additional token savings |
| 26e Complete | T569-T574 | CI-only quality validation works, comparator + classifier |
| 26f Complete | T575-T577 | E2E tests pass for full optimization stack |
| **Phase 26 Complete** | T550-T577 | All 28 tests pass, quality validated at >= 95% match |

---

## Dependencies

```json
{
  "dependencies": {
    "p-limit": "^4.0.0"
  }
}
```

---

## Rollback Plan

If issues discovered:

1. **Disable parallel**: Set `--sequential-analysis`
2. **Disable batching**: Set `--no-category-batching`
3. **Disable filtering**: Set `--no-viewport-filtering`

All optimizations are independently toggleable via CLI flags.
