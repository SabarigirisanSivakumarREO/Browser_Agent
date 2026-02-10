# Phase 26 Requirements: LLM Analysis Optimization

**Phase**: 26
**Status**: Planned (Revised 2026-02-10)
**Created**: 2026-02-05
**Updated**: 2026-02-10
**Dependencies**: Phase 25 (Enhanced Extraction), Phase 24 (Hybrid Detection)

---

## Overview

Optimize LLM analysis pipeline to reduce execution time and token usage while maintaining analysis quality. Current analysis takes ~337 seconds with ~266K tokens per page (10 sequential LLM calls with duplicated context). Target: ~35 seconds with ~113K tokens.

**Optimization Strategies**:
1. **26a: Parallel Category Analysis** - Run category analyses concurrently (10x speed)
2. **26b: Batch Multiple Categories Per Call** - Reduce redundant context (56% token savings)
3. **26c: Intelligent Viewport Filtering** - Send only relevant viewports per category (15-30% additional savings)

**Dropped** (from original plan):
- ~~26d: Response Token Optimization~~ - Only 1.5% savings, not worth complexity
- ~~Runtime auto-rollback~~ - Over-engineered; quality validation moved to CI-only

**Quality Validation** (CI-only):
- **26e: Quality Validation** - CI-only comparison of optimized vs baseline results

**Key Constraint**: All changes MUST be backward compatible. Existing API and CLI behavior preserved. New features enabled via configuration.

---

## Problem Statement

### Problem 1: Sequential Category Analysis

Current code (`analysis-orchestrator.ts:122-128`):
```typescript
parallelAnalysis: false,  // Default for cost control
```

| Metric | Current | Impact |
|--------|---------|--------|
| Categories | 10 | Sequential execution |
| Avg time/category | 33.6s | Blocking on each |
| Total time | 336.7s | 10x slower than parallel |

### Problem 2: Duplicate Context Per Call

Current implementation sends **full DOM + all screenshots** for EVERY category:

```
Per category call: ~26,650 tokens
  - System prompt: ~350 tokens
  - User/DOM context: ~20,000 tokens
  - Screenshot images: ~5,500 tokens
  - Heuristics (unique): ~1,500 tokens
  - Response: ~800 tokens

Full analysis: 10 × 26,650 = ~266K tokens
93% of per-call input is duplicated (only heuristics differ)
```

### Problem 3: All Viewports Sent Every Call

Current code sends all 10-12 viewports to every category analysis, regardless of relevance:
- Mobile Usability only needs viewport 0
- Reviews typically in viewports 6-8
- Above-fold analysis only needs viewport 0-1

---

## Functional Requirements

### FR-420: Parallel Category Analysis Configuration

The system SHALL support parallel category analysis via configuration:

```typescript
interface AnalysisOrchestratorConfig {
  parallelAnalysis: boolean;      // default: true (CHANGED from false)
  maxConcurrentCategories: number; // default: 5 (rate limiting)
  parallelTimeoutMs: number;       // default: 120000 (2 min per category)
}
```

**Acceptance Criteria**:
- AC-420.1: `parallelAnalysis` defaults to `true` (backward compatible via config)
- AC-420.2: Uses `Promise.all()` for concurrent execution
- AC-420.3: `maxConcurrentCategories` limits concurrent API calls via p-limit
- AC-420.4: Individual category timeout prevents hanging
- AC-420.5: Errors in one category don't fail entire analysis (error isolation)
- AC-420.6: CLI flag `--sequential-analysis` to disable parallel mode
- AC-420.7: CLI flag `--max-concurrent-categories <n>` to control concurrency

### FR-421: Category Batching Strategy

The system SHALL support batching multiple categories into single LLM calls:

```typescript
interface CategoryBatchConfig {
  enableBatching: boolean;         // default: true
  maxCategoriesPerBatch: number;   // default: 3
  batchStrategy: 'size' | 'related' | 'custom';  // default: 'related'
}

// Predefined batch groups (related categories)
const CATEGORY_BATCHES = [
  ['Layout & Structure', 'Mobile Usability'],           // Layout group
  ['Pricing & Cost Transparency', 'Description & Value Proposition'], // Value group
  ['Reviews & Social Proof', 'Selection & Configuration'], // Social group
  ['Product Imagery & Media', 'Specifications & Details'], // Content group
  ['CTA & Purchase Confidence', 'Utility & Secondary Actions'], // Action group
];
```

**Acceptance Criteria**:
- AC-421.1: Batching enabled by default
- AC-421.2: DOM and screenshots sent ONCE per batch (not per category)
- AC-421.3: Response parser handles multi-category output
- AC-421.4: Related categories grouped for semantic coherence
- AC-421.5: Fallback to single-category on parse failure
- AC-421.6: CLI flag `--no-category-batching` to disable

### FR-422: Batch Prompt Structure

The system SHALL structure batched prompts with clear category separation:

```
<context>
[DOM context - sent once]
[Screenshots - sent once]
</context>

<analysis_tasks>
=== CATEGORY 1: Layout & Structure ===
Evaluate these heuristics:
- PDP-LAYOUT-001: ...
- PDP-LAYOUT-002: ...

=== CATEGORY 2: Mobile Usability ===
Evaluate these heuristics:
- PDP-MOBILE-001: ...
- PDP-MOBILE-002: ...
</analysis_tasks>

<output_format>
Return JSON with category-keyed results:
{
  "Layout & Structure": { "evaluations": [...] },
  "Mobile Usability": { "evaluations": [...] }
}
</output_format>
```

**Acceptance Criteria**:
- AC-422.1: Clear category separators in prompt
- AC-422.2: Output format specifies category-keyed JSON
- AC-422.3: Parser extracts evaluations per category
- AC-422.4: Handles partial responses (some categories missing)

### FR-423: Intelligent Viewport Filtering

The system SHALL filter viewports based on category requirements:

```typescript
interface CategoryViewportConfig {
  category: string;
  requiredViewports: 'all' | 'above_fold' | 'below_fold' | 'custom';
  viewportIndices?: number[];      // For 'custom' mode
  maxViewports: number;            // Hard cap
}

const CATEGORY_VIEWPORT_REQUIREMENTS: CategoryViewportConfig[] = [
  { category: 'Layout & Structure', requiredViewports: 'all', maxViewports: 6 },
  { category: 'Product Imagery & Media', requiredViewports: 'above_fold', maxViewports: 3 },
  { category: 'Pricing & Cost Transparency', requiredViewports: 'above_fold', maxViewports: 2 },
  { category: 'Description & Value Proposition', requiredViewports: 'custom', viewportIndices: [0, 1, 2, 3], maxViewports: 4 },
  { category: 'Specifications & Details', requiredViewports: 'custom', viewportIndices: [2, 3, 4, 5], maxViewports: 4 },
  { category: 'Reviews & Social Proof', requiredViewports: 'below_fold', maxViewports: 4 },
  { category: 'Selection & Configuration', requiredViewports: 'above_fold', maxViewports: 2 },
  { category: 'CTA & Purchase Confidence', requiredViewports: 'above_fold', maxViewports: 3 },
  { category: 'Mobile Usability', requiredViewports: 'custom', viewportIndices: [0], maxViewports: 1 },
  { category: 'Utility & Secondary Actions', requiredViewports: 'all', maxViewports: 4 },
];
```

**Acceptance Criteria**:
- AC-423.1: Each category has defined viewport requirements
- AC-423.2: `above_fold` = viewports 0-1
- AC-423.3: `below_fold` = viewports 2+
- AC-423.4: `maxViewports` enforced per category
- AC-423.5: DOM context filtered to match viewport range
- AC-423.6: CLI flag `--no-viewport-filtering` to send all viewports

### FR-424: Viewport Selection Logic

The system SHALL implement viewport selection for filtered analysis:

```typescript
function selectViewportsForCategory(
  category: string,
  snapshots: ViewportSnapshot[],
  config: CategoryViewportConfig
): ViewportSnapshot[] {
  // Implementation selects relevant viewports based on config
}
```

**Acceptance Criteria**:
- AC-424.1: Returns subset of snapshots matching requirements
- AC-424.2: Preserves viewport indices in output
- AC-424.3: Handles fewer snapshots than requested gracefully
- AC-424.4: Logs viewport selection decisions

### FR-427: Backward Compatibility Layer

The system SHALL maintain full backward compatibility:

**Acceptance Criteria**:
- AC-427.1: Existing programmatic API unchanged
- AC-427.2: Existing CLI flags continue to work
- AC-427.3: Old config keys mapped to new equivalents
- AC-427.4: No breaking changes to `CROAnalysisResult`

### FR-428: Performance Metrics Tracking

The system SHALL track optimization metrics:

```typescript
interface OptimizationMetrics {
  totalAnalysisTimeMs: number;
  parallelSpeedup: number;         // e.g., 9.6x
  tokensSaved: number;             // Compared to baseline
  tokensUsed: number;
  apiCallCount: number;
  averageCallTimeMs: number;
  batchEfficiency: number;         // Categories per call
  viewportFilteringRatio: number;  // Viewports sent / total
}
```

**Acceptance Criteria**:
- AC-428.1: Metrics computed after analysis
- AC-428.2: Included in verbose output
- AC-428.3: Logged at INFO level
- AC-428.4: Available via `CROAnalysisResult.optimizationMetrics`

### FR-429: Graceful Degradation

The system SHALL degrade gracefully on errors:

```typescript
interface DegradationStrategy {
  onBatchParseFailure: 'retry_single' | 'skip' | 'fail';
  onParallelTimeout: 'sequential_fallback' | 'partial_results' | 'fail';
  onViewportFilterMiss: 'expand_range' | 'use_all' | 'proceed';
  maxRetries: number;              // default: 2
}
```

**Acceptance Criteria**:
- AC-429.1: Batch parse failure retries with single categories
- AC-429.2: Parallel timeout falls back to sequential
- AC-429.3: Viewport filter miss expands to include more
- AC-429.4: Errors logged with context for debugging

### FR-430: Quality Validation Framework (CI-only)

The system SHALL include a CI-only quality validation framework to compare optimized vs baseline results:

```typescript
interface QualityValidationConfig {
  enableValidation: boolean;           // default: false (CI/testing only)
  comparisonThreshold: number;         // default: 0.95 (95% match required)
}

interface QualityValidationResult {
  totalHeuristics: number;
  matchingResults: number;
  discrepancies: QualityDiscrepancy[];
  matchRate: number;                   // 0-1
  passed: boolean;
  recommendations: string[];
}

interface QualityDiscrepancy {
  heuristicId: string;
  category: string;
  baselineStatus: HeuristicStatus;
  optimizedStatus: HeuristicStatus;
  baselineConfidence: number;
  optimizedConfidence: number;
  severity: 'minor' | 'major' | 'critical';
  likelyCause: string;
}
```

**Acceptance Criteria**:
- AC-430.1: Runs baseline (non-optimized) analysis for comparison
- AC-430.2: Compares pass/fail/partial status for each heuristic
- AC-430.3: Flags discrepancies with severity levels
- AC-430.4: Computes overall match rate
- AC-430.5: CLI flag `--validate-quality` triggers validation (CI use)

### FR-431: Quality Discrepancy Detection

The system SHALL detect and classify quality discrepancies:

```typescript
type DiscrepancySeverity = 'minor' | 'major' | 'critical';

function classifyDiscrepancy(
  baseline: HeuristicEvaluation,
  optimized: HeuristicEvaluation
): DiscrepancySeverity {
  // Critical: pass→fail or fail→pass (wrong conclusion)
  if (baseline.status === 'passed' && optimized.status === 'failed') return 'critical';
  if (baseline.status === 'failed' && optimized.status === 'passed') return 'critical';

  // Major: partial↔pass/fail (significant difference)
  if (baseline.status === 'partial' && optimized.status !== 'partial') return 'major';
  if (optimized.status === 'partial' && baseline.status !== 'partial') return 'major';

  // Minor: confidence difference > 20%
  if (Math.abs(baseline.confidence - optimized.confidence) > 0.2) return 'minor';

  return 'minor';
}
```

**Acceptance Criteria**:
- AC-431.1: Critical = status flip between pass/fail
- AC-431.2: Major = partial status mismatch
- AC-431.3: Minor = confidence difference > 20%
- AC-431.4: No critical discrepancies allowed for validation pass

---

## Configuration Requirements

### CR-050: Phase 26 Configuration

```typescript
interface Phase26Config {
  // Parallel analysis
  parallelAnalysis: boolean;           // default: true
  maxConcurrentCategories: number;     // default: 5
  parallelTimeoutMs: number;           // default: 120000

  // Category batching
  enableCategoryBatching: boolean;     // default: true
  maxCategoriesPerBatch: number;       // default: 3
  batchStrategy: 'size' | 'related' | 'custom';  // default: 'related'
  customBatches?: string[][];          // For 'custom' strategy

  // Viewport filtering
  enableViewportFiltering: boolean;    // default: true
  viewportRequirements?: CategoryViewportConfig[];  // Override defaults

  // Degradation
  degradationStrategy: DegradationStrategy;

  // Metrics
  trackOptimizationMetrics: boolean;   // default: true
}
```

### CR-051: CLI Flags

```bash
# Parallel analysis (default: enabled)
--sequential-analysis              # Disable parallel, run sequentially
--max-concurrent-categories <n>    # Limit concurrent API calls (default: 5)

# Category batching (default: enabled)
--no-category-batching             # Disable batching, one call per category

# Viewport filtering (default: enabled)
--no-viewport-filtering            # Send all viewports to all categories

# Quality validation (CI-only)
--validate-quality                 # Run quality validation comparing optimized vs baseline
```

---

## Success Criteria

### SC-170: Parallel Speedup
Given parallel analysis enabled
When analyzing a PDP with 10 categories
Then total analysis time SHALL be < 50 seconds (was ~337s)
And speedup SHALL be >= 6x

### SC-171: Token Reduction via Batching
Given category batching enabled
When analyzing a PDP with 10 categories
Then total tokens used SHALL be < 130K (was ~266K)
And token reduction SHALL be >= 50%

### SC-172: Viewport Filtering Efficiency
Given viewport filtering enabled
When analyzing "Mobile Usability" category
Then only viewport 0 SHALL be sent (not all 12)
And viewport tokens reduced by >= 80% for that category

### SC-174: Backward Compatibility
Given existing API usage
When upgrading to Phase 26
Then all existing CLI commands SHALL work unchanged
And all existing programmatic API calls SHALL work unchanged

### SC-175: Graceful Degradation
Given a batch parse failure
When degradation strategy is 'retry_single'
Then system SHALL retry failed categories individually
And partial results SHALL be returned

### SC-176: Quality Preservation
Given all optimizations enabled
When comparing results to non-optimized baseline
Then heuristic pass/fail results SHALL match >= 95%
And no false negatives SHALL be introduced

### SC-177: Quality Validation (CI)
Given quality validation enabled via `--validate-quality`
When running optimized analysis
Then system SHALL run baseline comparison
And report match rate and discrepancies
And pass if match rate >= 95% with no critical discrepancies

---

## Test Requirements

### Unit Tests (20 tests)

**Parallel Analysis (6 tests)**
- Parallel execution with Promise.all
- maxConcurrentCategories rate limiting
- Timeout handling per category
- Error isolation (one failure doesn't fail all)
- Sequential fallback on config
- Metrics tracking

**Category Batching (4 tests)**
- Batch grouping by strategy
- Single DOM/screenshot per batch
- Multi-category prompt generation
- Fallback to single on parse failure

**Batch Response Parser (4 tests)**
- Multi-category response parsing
- Partial response handling
- Category-keyed JSON parsing
- Error class for failures

**Viewport Filtering (6 tests)**
- above_fold selection (viewports 0-1)
- below_fold selection (viewports 2+)
- Custom viewport indices
- maxViewports enforcement
- DOM filtering to match viewports
- Graceful handling of insufficient viewports

### Integration Tests (4 tests)

- Batched analysis with mocked LLM
- Viewport filtering with DOM context
- Quality validation single URL
- Combined optimizations (parallel + batch + filter)

### E2E Tests (4 tests)

- E2E: parallel + batching combined
- E2E: viewport filtering
- E2E: full optimization stack
- E2E: quality validation

**Total**: 28 tests

---

## Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| openai | ^4.x | LLM API calls (already installed) |
| p-limit | ^4.x | Concurrency control (NEW - install) |

---

## Migration Notes

- **DEFAULT CHANGED**: `parallelAnalysis` now defaults to `true`
- **NEW DEFAULTS**: Batching and viewport filtering enabled by default
- **BACKWARD COMPATIBLE**: All old flags/config continue to work
- **NO BREAKING CHANGES**: Existing integrations unaffected
- **OPT-OUT AVAILABLE**: Every optimization has opt-out flag
- **PERFORMANCE**: Expect ~10x faster, ~56% cheaper per analysis
