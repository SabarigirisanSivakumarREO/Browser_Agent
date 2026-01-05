**Navigation**: [Index](./index.md) | [Previous](./phase-18.md) | [Next](./phase-20.md)

---

## Phase 19a: Foundation (Models & Tracker)

**Purpose**: Coverage tracking interfaces and CoverageTracker class

**Requirements**: FR-098 to FR-102, FR-109

- [x] T126 [US11] Create src/models/coverage.ts
  - Export: PageSegment, ElementCoverage, CoverageState, CoverageConfig, ScanMode interfaces
  - Export: DEFAULT_COVERAGE_CONFIG constant
  - PageSegment: index, startY, endY, scanned, scannedAt?, elementsFound, elementsAnalyzed
  - CoverageState: segments[], elementsDiscovered Map, coverage metrics
  - CoverageConfig: minCoveragePercent (100), segmentOverlapPx (100), requireAllSegments, requireElementAnalysis

- [x] T127 [US11] Create src/agent/coverage-tracker.ts
  - CoverageTracker class with initialize(), markSegmentScanned(), recordElementDiscovered()
  - Methods: getCoveragePercent(), isFullyCovered(), getNextUnscannedSegment()
  - Method: getCoverageReport() returns human-readable string for LLM
  - Segment calculation: Math.ceil(pageHeight / (viewportHeight - overlap))

- [x] T128 [P] [US11] Create tests/unit/coverage-tracker.test.ts (16 tests)
  - Test: initializes correct segment count for page dimensions
  - Test: calculates segments with overlap correctly
  - Test: marks segments as scanned, updates coverage percentage
  - Test: returns next unscanned segment in order
  - Test: tracks element discovery with xpath and croType
  - Test: tracks element analysis by tool name
  - Test: handles overlap deduplication
  - Test: reports 100% when all segments scanned
  - Test: respects minCoveragePercent config
  - Test: generates accurate coverage report string

- [x] T129 [US11] Update src/models/index.ts and src/agent/index.ts with Phase 19a exports
  - Export: PageSegment, ElementCoverage, CoverageState, CoverageConfig, ScanMode
  - Export: DEFAULT_COVERAGE_CONFIG
  - Export: CoverageTracker from agent module

**Checkpoint**: CoverageTracker passes 16 unit tests, initializes segments correctly ✅

---

## Phase 19b: DOM Changes **[COMPLETE]**

**Purpose**: Absolute coordinates and DOM merging for multi-segment extraction

**Requirements**: FR-105, FR-106

- [x] T130 [US11] Modify src/browser/dom/build-dom-tree.ts for absolute coordinates ✅
  - Change bounding box calculation: y = rect.y + window.scrollY
  - Elements get page-absolute Y coordinates instead of viewport-relative

- [x] T131 [US11] Create src/browser/dom/dom-merger.ts ✅
  - DOMMerger class with merge(snapshots: DOMTree[]) method
  - Deduplicates elements by xpath using Set
  - Preserves first occurrence, merges children from subsequent snapshots
  - Recalculates totalNodeCount, croElementCount, interactiveCount
  - Reindexes elements sequentially after merge

- [x] T132 [P] [US11] Create tests/unit/dom-merger.test.ts (7 tests) ✅
  - Test: merges two DOM snapshots correctly
  - Test: deduplicates elements by xpath
  - Test: preserves document order
  - Test: handles empty snapshots array (throws)
  - Test: recalculates indices after merge
  - Test: updates count totals accurately
  - Test: returns single snapshot unchanged

- [x] T133 [US11] Update src/browser/dom/serializer.ts with dynamic token budget ✅
  - Add mode parameter: serialize(tree, mode: ScanMode)
  - full_page mode: 32000 tokens (CR-025)
  - llm_guided mode: 8000 tokens (existing)
  - above_fold mode: 8000 tokens
  - Export SCAN_MODE_TOKEN_BUDGETS constant

**Checkpoint**: ✅ DOMMerger passes 7 tests, bounding boxes use absolute coordinates

**Completed**: 2025-12-15

---

## Phase 19c: Agent Integration **[COMPLETE]**

**Purpose**: Integrate coverage tracking into CROAgent loop

**Requirements**: FR-103, FR-104, FR-107, FR-108

- [x] T134 [US11] Add ScanMode type to src/types/index.ts ✅
  - Export: ScanMode = 'full_page' | 'above_fold' | 'llm_guided'
  - Update AnalyzeOptions: add scanMode?, coverageConfig?
  - Add: CoverageConfig type re-export

- [x] T135 [US11] Modify src/agent/cro-agent.ts with full-page scan loop ✅
  - Initialize CoverageTracker with page dimensions
  - Deterministic scan phase: scroll through all segments, extract DOM at each
  - Use DOMMerger to combine segment snapshots
  - Pass complete DOM to LLM analysis phase
  - Add scanMode parameter (default: 'full_page')

- [x] T136 [US11] Implement coverage enforcement logic in cro-agent.ts ✅
  - Before executing 'done' tool, check coverageTracker.getCoveragePercent()
  - If coverage < minCoveragePercent, BLOCK 'done' and continue analysis
  - Log warning when enforcement triggers

- [x] T137 [US11] Update src/agent/state-manager.ts with coverage state ✅
  - Add coverageTracker?: CoverageTracker to state
  - Add scanMode: ScanMode to AgentState and createInitialState()
  - Modify shouldTerminate(): in full_page mode, also check isFullyCovered()
  - Add setCoverageTracker(), getCoveragePercent(), isFullyCovered() methods

- [x] T138 [US11] Add dynamic maxSteps calculation ✅
  - Function: calculateRequiredSteps(pageHeight, viewportHeight, config)
  - Formula: segments + analysisToolCount(6) + synthesisSteps(2)
  - In full_page mode: effectiveMaxSteps = Math.max(options.maxSteps, requiredSteps)

**Checkpoint**: Agent completes with 100% coverage on multi-viewport test page ✅

**Completed**: 2025-12-16

---

## Phase 19d: Prompt Updates

**Purpose**: Add coverage awareness to LLM context

**Requirements**: FR-108

- [x] T139 [US11] Update src/prompts/system-cro.md with coverage awareness ✅
  - Add <coverage_awareness> section with rules
  - Rule 1: Cannot call 'done' until coverage reaches 100%
  - Rule 2: Must scroll to uncovered segments
  - Rule 3: System will BLOCK premature 'done' calls
  - Rule 4: Focus on NEW elements after scroll
  - Rule 5: Check <coverage> section in messages

- [x] T140 [US11] Modify src/agent/prompt-builder.ts for coverage section ✅
  - buildUserMessage() includes coverage report when tracker present
  - Format: <coverage>\n${tracker.getCoverageReport()}\n</coverage>
  - Shows: segments scanned/total, percent, uncovered regions
  - cro-agent.ts updated to pass coverageTracker to buildUserMessage()

**Checkpoint**: ✅ LLM receives coverage info in every message (2025-12-16)

---

## Phase 19e: CLI & Config **[COMPLETE]**

**Purpose**: CLI flags for scan mode control

**Requirements**: FR-110, FR-111, FR-112, CR-022

- [x] T141 [US11] Update src/cli.ts with scan mode flags ✅
  - Add --scan-mode=full_page|above_fold|llm_guided (default: full_page)
  - Add --min-coverage=N (default: 100)
  - Parse and pass to CROAgent.analyze() options

- [x] T142 [US11] Update default options to use full_page mode ✅
  - DEFAULT_CRO_OPTIONS.scanMode = 'full_page'
  - DEFAULT_COVERAGE_CONFIG used when scanMode is 'full_page'

**Checkpoint**: ✅ `npm run start -- --scan-mode=full_page <url>` runs full coverage analysis

**Completed**: 2025-12-16

---

## Phase 19f: Testing & Polish **[COMPLETE]**

**Purpose**: Integration and E2E tests for coverage system

**Requirements**: SC-060 to SC-075

- [x] T143 [US11] Create tests/integration/coverage-enforcement.test.ts (11 tests) ✅
  - Test: blocks done before full coverage
  - Test: allows done at 100% coverage
  - Test: forces scroll to uncovered segment
  - Test: merges DOM from multiple segments
  - Test: calculates dynamic maxSteps correctly
  - Test: tracks elements across segments

- [x] T144 [US11] Create tests/e2e/coverage-workflow.test.ts (4 tests) ✅
  - Test: full_page mode covers entire page on 3-viewport test
  - Test: full_page mode covers entire page on 10-viewport test
  - Test: above_fold mode only scans initial viewport
  - Test: llm_guided mode preserves original behavior

- [x] T145 [US11] Update documentation ✅
  - Updated quickstart.md with --scan-mode and --min-coverage CLI flags
  - Documented scan modes and coverage config
  - Added examples for each mode
  - Updated SESSION-HANDOFF.md with Phase 19f completion

- [x] T146 [US11] Performance testing and optimization ✅
  - Dynamic maxSteps calculation prevents unnecessary steps
  - DOM merging deduplicates efficiently via xpath Set
  - Segment overlap configurable (default 100px)

**Checkpoint**: ✅ All Phase 19 tests pass (11 integration + 4 E2E), 100% coverage achieved

**Completed**: 2025-12-16

---

## Phase 19 Summary

| Sub-Phase | Tasks | Unit | Int | E2E | Total | Status |
|-----------|-------|------|-----|-----|-------|--------|
| 19a | T126-T129 (4) | 16 | - | - | 16 | ✅ Complete |
| 19b | T130-T133 (4) | 7 | - | - | 7 | ✅ Complete |
| 19c | T134-T138 (5) | - | - | - | - | ✅ Complete |
| 19d | T139-T140 (2) | - | - | - | - | ✅ Complete |
| 19e | T141-T142 (2) | 1 | - | - | 1 | ✅ Complete |
| 19f | T143-T146 (4) | - | 11 | 4 | 15 | ✅ Complete |
| **Total** | **21 tasks** | **24** | **11** | **4** | **39** | ✅ Complete |

**CLI Command**: `npm run start -- --scan-mode=full_page https://example.com`

**Success Metrics**:
- 100% coverage on 3-viewport page (vs ~60% before)
- 100% coverage on 10-viewport page (vs ~25% before)
- Backward compatible via --scan-mode=llm_guided

---
