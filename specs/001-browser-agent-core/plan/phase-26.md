# Phase 26: LLM Analysis Optimization

**Status**: Planned (Revised 2026-02-10)
**Tasks**: T550-T577 (28 tasks)
**Tests**: 20 unit + 4 integration + 4 E2E = 28 total
**Dependencies**: Phase 25 (Enhanced Extraction)

---

## Overview

Optimize LLM analysis pipeline for speed and cost:

1. **26a**: Parallel Category Analysis (T550-T555) - 6 tasks
2. **26b**: Batch Multiple Categories Per Call (T556-T563) - 8 tasks
3. **26c**: Intelligent Viewport Filtering (T564-T568) - 5 tasks
4. **26e**: Quality Validation — CI-only (T569-T574) - 6 tasks
5. **26f**: Cross-cutting E2E Tests (T575-T577) - 3 tasks

**Dropped**:
- ~~26d: Response Token Optimization~~ - Only 1.5% savings, not worth added complexity
- ~~Runtime auto-rollback~~ - Over-engineered; quality validation is CI-only

**Target Improvements**:
| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Analysis Time | 336.7s | ~35s | 10x faster |
| Token Usage | 266K | ~113K | 56% reduction |
| API Calls | 10 | 3-5 | 50-70% fewer |
| Cost/Page | $0.20 | $0.09 | 56% cheaper |

---

## Architecture

### Current Flow (Sequential, Redundant)

```
┌─────────────────────────────────────────────────────────────┐
│ CURRENT: Sequential Category Analysis (336.7s total)        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Category 1: Layout         ──────► LLM Call (33s)          │
│    [DOM 20K + Screenshots 5.5K + Heuristics 1.5K]          │
│                     │                                       │
│                     ▼                                       │
│  Category 2: Imagery        ──────► LLM Call (34s)          │
│    [DOM 20K + Screenshots 5.5K + Heuristics 1.5K] DUPLICATE│
│                     │                                       │
│                     ▼                                       │
│  Category 3: Pricing        ──────► LLM Call (21s)          │
│    [DOM 20K + Screenshots 5.5K + Heuristics 1.5K] DUPLICATE│
│                     │                                       │
│                    ...                                      │
│                     ▼                                       │
│  Category 10: Utility       ──────► LLM Call (19s)          │
│    [DOM 20K + Screenshots 5.5K + Heuristics 1.5K] DUPLICATE│
│                                                             │
│  TOTAL: 10 calls × ~26.6K tokens = ~266K tokens            │
│  TOTAL TIME: 336.7 seconds (sequential)                     │
└─────────────────────────────────────────────────────────────┘
```

### Optimized Flow (Parallel, Batched, Filtered)

```
┌─────────────────────────────────────────────────────────────┐
│ OPTIMIZED: Parallel Batched Analysis (~35s total)           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ BATCH 1: Layout + Mobile (viewports: 0-2)           │    │
│  │   [DOM filtered + Screenshots subset + 2× heuristics]────┼──► LLM
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │    PARALLEL
│  │ BATCH 2: Pricing + Description (viewports: 0-1)     │    │    (concurrent)
│  │   [DOM filtered + Screenshots subset + 2× heuristics]────┼──► LLM
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ BATCH 3: Reviews + Selection (viewports: 2-8)       │    │
│  │   [DOM filtered + Screenshots subset + 2× heuristics]────┼──► LLM
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ BATCH 4: Imagery + Specs (viewports: 0-5)           │    │
│  │   [DOM filtered + Screenshots subset + 2× heuristics]────┼──► LLM
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ BATCH 5: CTA + Utility (viewports: 0-4)             │    │
│  │   [DOM filtered + Screenshots subset + 2× heuristics]────┼──► LLM
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  TOTAL: 5 calls × ~22K tokens = ~113K tokens               │
│  TOTAL TIME: ~35 seconds (parallel max)                     │
└─────────────────────────────────────────────────────────────┘
```

### Module Structure

```
src/
├── heuristics/
│   ├── analysis-orchestrator.ts    # MODIFY: Add parallel + batching
│   ├── category-analyzer.ts        # MODIFY: Viewport filtering integration
│   ├── category-batcher.ts         # CREATE: Batch grouping logic
│   ├── batch-prompt-builder.ts     # CREATE: Multi-category prompts
│   ├── batch-response-parser.ts    # CREATE: Multi-category parsing
│   ├── viewport-selector.ts        # CREATE: Per-category viewport selection
│   └── index.ts                    # MODIFY: Export new modules
├── validation/
│   ├── result-comparator.ts        # CREATE: Compare baseline vs optimized
│   ├── discrepancy-classifier.ts   # CREATE: Classify severity
│   ├── quality-validator.ts        # CREATE: CI-only validation orchestrator
│   └── index.ts                    # CREATE: Validation barrel export
├── types/
│   └── index.ts                    # MODIFY: Add optimization config types
└── cli.ts                          # MODIFY: Add CLI flags
```

---

## Phase 26a: Parallel Category Analysis (T550-T555)

### Core Changes

**File: `src/heuristics/analysis-orchestrator.ts`**

```typescript
// BEFORE (line ~122):
parallelAnalysis: false,  // Default for cost control

// AFTER:
parallelAnalysis: true,   // Default ON for performance
maxConcurrentCategories: 5,  // Rate limiting via p-limit
parallelTimeoutMs: 120000,   // 2 min per category
```

### Implementation

```typescript
// src/heuristics/analysis-orchestrator.ts

import pLimit from 'p-limit';

interface ParallelConfig {
  parallelAnalysis: boolean;
  maxConcurrentCategories: number;
  parallelTimeoutMs: number;
}

async function runParallelAnalysis(
  categories: HeuristicCategory[],
  snapshots: ViewportSnapshot[],
  config: ParallelConfig
): Promise<CategoryAnalysisResult[]> {
  const limit = pLimit(config.maxConcurrentCategories);
  const startTime = Date.now();

  const promises = categories.map(category =>
    limit(async () => {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: ${category.name}`)), config.parallelTimeoutMs)
      );

      const analysisPromise = analyzeCategory(category, snapshots);

      try {
        return await Promise.race([analysisPromise, timeoutPromise]);
      } catch (error) {
        logger.warn(`Category analysis failed: ${category.name}`, { error });
        return createEmptyResult(category, error);
      }
    })
  );

  const results = await Promise.all(promises);
  const totalTime = Date.now() - startTime;

  logger.info('Parallel analysis complete', {
    categories: categories.length,
    totalTimeMs: totalTime,
    avgTimeMs: totalTime / categories.length,
  });

  return results;
}
```

### Backward Compatibility

```typescript
// Existing code path preserved
async function runAnalysis(
  categories: HeuristicCategory[],
  snapshots: ViewportSnapshot[],
  config: AnalysisConfig
): Promise<AnalysisResult> {
  if (config.parallelAnalysis) {
    return runParallelAnalysis(categories, snapshots, config);
  } else {
    // Original sequential path (unchanged)
    return runSequentialAnalysis(categories, snapshots, config);
  }
}
```

---

## Phase 26b: Batch Multiple Categories Per Call (T556-T563)

### Category Batch Groups

```typescript
// src/heuristics/category-batcher.ts

export const CATEGORY_BATCHES: string[][] = [
  // Batch 1: Layout focus
  ['Layout & Structure', 'Mobile Usability'],

  // Batch 2: Value focus
  ['Pricing & Cost Transparency', 'Description & Value Proposition'],

  // Batch 3: Social focus
  ['Reviews & Social Proof', 'Selection & Configuration'],

  // Batch 4: Content focus
  ['Product Imagery & Media', 'Specifications & Details'],

  // Batch 5: Action focus
  ['CTA & Purchase Confidence', 'Utility & Secondary Actions'],
];

export function groupCategoriesIntoBatches(
  categories: HeuristicCategory[],
  strategy: 'size' | 'related' | 'custom',
  customBatches?: string[][]
): HeuristicCategory[][] {
  const batches = strategy === 'custom' && customBatches
    ? customBatches
    : CATEGORY_BATCHES;

  return batches.map(batchNames =>
    categories.filter(c => batchNames.includes(c.name))
  ).filter(batch => batch.length > 0);
}
```

### Batch Prompt Builder

```typescript
// src/heuristics/batch-prompt-builder.ts

export function buildBatchedPrompt(
  categories: HeuristicCategory[],
  snapshots: ViewportSnapshot[],
  domContext: string,
  screenshotRefs: string[]
): string {
  const sections: string[] = [];

  // Shared context (sent once)
  sections.push(`<context>
${domContext}

Screenshots: ${screenshotRefs.join(', ')}
</context>`);

  // Category-specific sections
  sections.push('<analysis_tasks>');
  for (const category of categories) {
    sections.push(`
=== CATEGORY: ${category.name} ===
Evaluate these heuristics:
${category.heuristics.map(h => `- ${h.id}: ${h.principle}`).join('\n')}
`);
  }
  sections.push('</analysis_tasks>');

  // Output format
  sections.push(`<output_format>
Return JSON with category-keyed results:
{
${categories.map(c => `  "${c.name}": { "evaluations": [...] }`).join(',\n')}
}
</output_format>`);

  return sections.join('\n\n');
}
```

### Batch Response Parser

```typescript
// src/heuristics/batch-response-parser.ts

export interface BatchedResponse {
  [categoryName: string]: {
    evaluations: HeuristicEvaluation[];
  };
}

export function parseBatchedResponse(
  response: string,
  expectedCategories: string[]
): BatchedResponse {
  try {
    const json = extractJSON(response);
    const parsed = JSON.parse(json);

    // Validate all expected categories present
    for (const category of expectedCategories) {
      if (!parsed[category]) {
        logger.warn(`Missing category in response: ${category}`);
        parsed[category] = { evaluations: [] };
      }
    }

    return parsed;
  } catch (error) {
    logger.error('Failed to parse batched response', { error, response });
    throw new BatchParseError(response, error);
  }
}
```

---

## Phase 26c: Intelligent Viewport Filtering (T564-T568)

### Viewport Requirements Configuration

```typescript
// src/heuristics/viewport-selector.ts

export interface CategoryViewportConfig {
  category: string;
  requiredViewports: 'all' | 'above_fold' | 'below_fold' | 'custom';
  viewportIndices?: number[];
  maxViewports: number;
}

export const VIEWPORT_REQUIREMENTS: CategoryViewportConfig[] = [
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

### Viewport Selection Logic

```typescript
// src/heuristics/viewport-selector.ts

export function selectViewportsForCategory(
  category: string,
  snapshots: ViewportSnapshot[],
  config?: CategoryViewportConfig
): ViewportSnapshot[] {
  const requirement = config ?? VIEWPORT_REQUIREMENTS.find(r => r.category === category);

  if (!requirement) {
    // Fallback: return all (backward compatible)
    return snapshots;
  }

  let selectedIndices: number[];

  switch (requirement.requiredViewports) {
    case 'above_fold':
      selectedIndices = [0, 1];
      break;
    case 'below_fold':
      selectedIndices = snapshots.map((_, i) => i).filter(i => i >= 2);
      break;
    case 'custom':
      selectedIndices = requirement.viewportIndices ?? [];
      break;
    case 'all':
    default:
      selectedIndices = snapshots.map((_, i) => i);
      break;
  }

  // Apply maxViewports cap
  const capped = selectedIndices.slice(0, requirement.maxViewports);

  // Filter snapshots
  const selected = capped
    .filter(i => i < snapshots.length)
    .map(i => snapshots[i]);

  logger.debug('Viewport selection', {
    category,
    requirement: requirement.requiredViewports,
    selectedIndices: capped,
    actualCount: selected.length,
  });

  return selected;
}
```

### DOM Filtering to Match Viewports

```typescript
// src/heuristics/viewport-selector.ts

export function filterDOMForViewports(
  fullDOM: string,
  selectedViewports: ViewportSnapshot[]
): string {
  const selectedIndices = new Set(selectedViewports.map(v => v.viewportIndex));

  const sections = fullDOM.split(/(?=--- Viewport-\d+)/);
  const filtered = sections.filter(section => {
    const match = section.match(/--- Viewport-(\d+)/);
    if (!match) return false;
    return selectedIndices.has(parseInt(match[1], 10));
  });

  return filtered.join('\n');
}
```

---

## Phase 26e: Quality Validation — CI-only (T569-T574)

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ QUALITY VALIDATION FLOW (CI-only)                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Input URL (via --validate-quality)                         │
│       │                                                     │
│       ├───────────────────┬─────────────────────┐           │
│       ▼                   ▼                     │           │
│  ┌─────────────┐    ┌─────────────┐             │           │
│  │  BASELINE   │    │  OPTIMIZED  │             │           │
│  │  (sequential│    │  (parallel  │             │           │
│  │   no batch) │    │   +batch    │             │           │
│  └──────┬──────┘    │   +filter)  │             │           │
│         │           └──────┬──────┘             │           │
│         │                  │                    │           │
│         └────────┬─────────┘                    │           │
│                  ▼                              │           │
│         ┌───────────────┐                       │           │
│         │   COMPARATOR  │                       │           │
│         │  - per heuristic                      │           │
│         │  - status match                       │           │
│         │  - confidence diff                    │           │
│         └───────┬───────┘                       │           │
│                 │                               │           │
│                 ▼                               │           │
│         ┌───────────────┐                       │           │
│         │ DISCREPANCY   │                       │           │
│         │ CLASSIFIER    │                       │           │
│         │ - critical    │──► pass→fail flip     │           │
│         │ - major       │──► partial mismatch   │           │
│         │ - minor       │──► confidence diff    │           │
│         └───────┬───────┘                       │           │
│                 │                               │           │
│                 ▼                               │           │
│         ┌───────────────┐                       │           │
│         │ MATCH RATE    │                       │           │
│         │   ≥ 95%?      │                       │           │
│         └───────┬───────┘                       │           │
│            YES  │    NO                         │           │
│                 │     ▼                          │           │
│                 │  FAIL with report              │           │
│                 ▼                               │           │
│         ┌───────────────┐                       │           │
│         │   PASS        │                       │           │
│         │ Quality OK    │                       │           │
│         └───────────────┘                       │           │
└─────────────────────────────────────────────────────────────┘
```

### Module Structure

```
src/
├── validation/
│   ├── quality-validator.ts        # CREATE: CI-only validation orchestrator
│   ├── result-comparator.ts        # CREATE: Compare baseline vs optimized
│   ├── discrepancy-classifier.ts   # CREATE: Classify severity
│   └── index.ts                    # CREATE: Barrel export
└── cli.ts                          # MODIFY: Add --validate-quality flag
```

### Quality Validator (CI-only)

```typescript
// src/validation/quality-validator.ts

export interface QualityValidationConfig {
  enableValidation: boolean;
  comparisonThreshold: number;
}

export class QualityValidator {
  constructor(
    private config: QualityValidationConfig,
    private orchestrator: AnalysisOrchestrator
  ) {}

  async validate(url: string): Promise<QualityValidationResult> {
    // 1. Run baseline (non-optimized) analysis
    const baselineResult = await this.orchestrator.runAnalysis(url, {
      parallelAnalysis: false,
      enableCategoryBatching: false,
      enableViewportFiltering: false,
    });

    // 2. Run optimized analysis
    const optimizedResult = await this.orchestrator.runAnalysis(url, {
      parallelAnalysis: true,
      enableCategoryBatching: true,
      enableViewportFiltering: true,
    });

    // 3. Compare results
    const comparison = compareResults(baselineResult, optimizedResult);

    // 4. Classify discrepancies
    const discrepancies = comparison.discrepancies.map(d =>
      classifyDiscrepancy(d.baseline, d.optimized)
    );

    // 5. Compute match rate
    const matchRate = comparison.matching / comparison.total;
    const hasCritical = discrepancies.some(d => d.severity === 'critical');

    return {
      totalHeuristics: comparison.total,
      matchingResults: comparison.matching,
      discrepancies,
      matchRate,
      passed: matchRate >= this.config.comparisonThreshold && !hasCritical,
      recommendations: this.generateRecommendations(discrepancies),
    };
  }
}
```

### Discrepancy Classifier

```typescript
// src/validation/discrepancy-classifier.ts

export function classifyDiscrepancy(
  baseline: HeuristicEvaluation,
  optimized: HeuristicEvaluation
): QualityDiscrepancy {
  let severity: 'minor' | 'major' | 'critical';
  let likelyCause: string;

  // Critical: pass↔fail flip (wrong conclusion)
  if (
    (baseline.status === 'passed' && optimized.status === 'failed') ||
    (baseline.status === 'failed' && optimized.status === 'passed')
  ) {
    severity = 'critical';
    likelyCause = optimized.status === 'passed'
      ? 'False positive: optimization missed an issue'
      : 'False negative: optimization found non-existent issue';
  }
  // Major: partial status mismatch
  else if (
    (baseline.status === 'partial' && optimized.status !== 'partial') ||
    (optimized.status === 'partial' && baseline.status !== 'partial')
  ) {
    severity = 'major';
    likelyCause = 'Partial compliance detection differs - likely viewport filtering impact';
  }
  // Minor: confidence difference > 20%
  else if (Math.abs(baseline.confidence - optimized.confidence) > 0.2) {
    severity = 'minor';
    likelyCause = 'Confidence variance - likely batching impact';
  }
  else {
    severity = 'minor';
    likelyCause = 'Minor observation difference';
  }

  return {
    heuristicId: baseline.heuristicId,
    category: baseline.category || 'unknown',
    baselineStatus: baseline.status,
    optimizedStatus: optimized.status,
    baselineConfidence: baseline.confidence,
    optimizedConfidence: optimized.confidence,
    severity,
    likelyCause,
  };
}
```

---

## File Changes Summary

| File | Change | Phase |
|------|--------|-------|
| `src/heuristics/analysis-orchestrator.ts` | Parallel execution, batching orchestration | 26a, 26b |
| `src/heuristics/category-analyzer.ts` | Viewport filtering integration | 26c |
| `src/heuristics/category-batcher.ts` | CREATE: Batch grouping logic | 26b |
| `src/heuristics/batch-prompt-builder.ts` | CREATE: Multi-category prompts | 26b |
| `src/heuristics/batch-response-parser.ts` | CREATE: Multi-category parsing | 26b |
| `src/heuristics/viewport-selector.ts` | CREATE: Per-category viewport selection | 26c |
| `src/heuristics/index.ts` | MODIFY: Export new modules | 26a, 26b, 26c |
| `src/validation/quality-validator.ts` | CREATE: CI-only validation orchestrator | 26e |
| `src/validation/result-comparator.ts` | CREATE: Compare baseline vs optimized | 26e |
| `src/validation/discrepancy-classifier.ts` | CREATE: Classify severity | 26e |
| `src/validation/index.ts` | CREATE: Validation barrel export | 26e |
| `src/types/index.ts` | Add optimization + validation config types | 26a, 26b, 26c, 26e |
| `src/cli.ts` | Add CLI flags (optimization + validation) | 26a, 26b, 26c, 26e |
| `package.json` | Add p-limit dependency | 26a |

---

## Test Plan

### Unit Tests (20)

| File | Tests | Coverage |
|------|-------|----------|
| `parallel-analysis.test.ts` | 6 | Promise.all, rate limit, timeout, errors, fallback, metrics |
| `category-batching.test.ts` | 4 | Grouping, prompt builder, parse failure fallback |
| `batch-response-parser.test.ts` | 4 | JSON parsing, partial handling, error class |
| `viewport-filtering.test.ts` | 6 | All modes, filtering, caps, DOM filtering |

### Integration Tests (4)

| Test | Coverage |
|------|----------|
| Batched analysis with mocked LLM | Batch prompt + parse flow |
| Viewport filtering with DOM | Filtered DOM + snapshot selection |
| Quality validation single URL | Baseline vs optimized comparison |
| Combined optimizations | Parallel + batch + filter together |

### E2E Tests (4)

| Test | Coverage |
|------|----------|
| Parallel + batching combined | Full parallel batch flow |
| Viewport filtering E2E | Category-specific viewport selection |
| Full optimization stack | All optimizations enabled |
| Quality validation E2E | CI validation pass/fail |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Parallel rate limiting by API | Medium | Medium | maxConcurrentCategories default 5 |
| Batch prompt too large | Low | Medium | Monitor token count, split if needed |
| Batch parse failures | Medium | Low | Fallback to single-category retry |
| Viewport filtering misses issues | Low | Medium | Conservative defaults, expand on miss |
| Quality degradation | Low | High | 95% match threshold via CI validation |

---

## Session Allocation

| Session | Tasks | Focus | Tests |
|---------|-------|-------|-------|
| 1 | T550-T555 | 26a: Parallel analysis (config, p-limit, implementation, CLI, tests) | 6 unit |
| 2 | T556-T559 | 26b part 1: Batcher + prompt builder + parser + orchestrator integration | — |
| 3 | T560-T563 | 26b part 2: CLI flag + exports + all batching tests | 4+4 unit, 1 int |
| 4 | T564-T568 | 26c: Viewport filtering (selector, integration, CLI, tests) | 6 unit, 1 int |
| 5 | T569-T574 | 26e: Quality validation CI-only (comparator, classifier, validator, tests) | — unit, 1 int |
| 6 | T575-T577 | 26f: E2E tests for full optimization stack | 4 E2E |

**Recommended**: 6 sessions

---

## CLI Flags Summary

### New Flags

```bash
# Parallel analysis (default: enabled)
--sequential-analysis              # Disable parallel mode
--max-concurrent-categories <n>    # Limit concurrent calls (default: 5)

# Category batching (default: enabled)
--no-category-batching             # One call per category

# Viewport filtering (default: enabled)
--no-viewport-filtering            # Send all viewports to all categories

# Quality validation (CI-only)
--validate-quality                 # Compare optimized vs baseline
```

---

## Expected Results

### Before Optimization (Current)

```
Analysis Time: 336.7s
API Calls: 10
Tokens: 266,000
Cost: $0.20
```

### After Phase 26a (Parallel Only)

```
Analysis Time: ~35s (10x faster)
API Calls: 10
Tokens: 266,000 (same)
Cost: $0.20 (same)
```

### After Phase 26b (+ Batching)

```
Analysis Time: ~35s
API Calls: 5 (50% fewer)
Tokens: ~113,000 (56% reduction)
Cost: $0.09 (56% cheaper)
```

### After Phase 26c (+ Viewport Filtering)

```
Analysis Time: ~30s
API Calls: 5
Tokens: ~85,000 (68% reduction)
Cost: $0.065 (68% cheaper)
```
