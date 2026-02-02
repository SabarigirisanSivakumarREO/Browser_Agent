# Session Handoff - CRO Browser Agent

**Last Updated**: 2026-01-30 (Spec kit sync complete)

---

## Project Overview

**Browser Agent** is a TypeScript-based CRO (Conversion Rate Optimization) analysis tool that uses:
- **Playwright** for browser automation
- **GPT-4o-mini** for intelligent website analysis (cost-optimized, ~$0.005-0.01/page)
- **GPT-4o-mini Vision** for screenshot-based heuristic evaluation
- **Zod** for runtime validation
- **LangChain** for LLM orchestration

### Primary Purpose
Automatically analyze websites for CRO issues (CTAs, forms, trust signals, value propositions, navigation) and generate actionable insights with A/B test hypotheses.

---

## Current State

**Phase**: Phase 21j CLI Vision Agent Fix - PLANNED 📋
**Status**: CR-001 ✅, Phase 21h ✅, Phase 21i ✅, Phase 21j 📋 (8 tasks pending)
**Tests**: 925+ tests passing
**Build**: Compiles successfully ✅

### BUG FOUND (2026-02-02): CLI --vision-agent uses deprecated VisionAgent

**Symptoms**:
1. Only 1 viewport captured (should be 3-5 for full page)
2. Evidence not saving to ./evidence/ directory
3. No DOM-Screenshot mapping proof in console output

**Root Cause**: `src/cli.ts:643` uses deprecated `createVisionAgent()` instead of CROAgent unified mode

**Fix**: Phase 21j - Replace VisionAgent with CROAgent({ enableUnifiedMode: true })

### Phase 21h Progress (2026-01-30) - COMPLETE ✅
- ✅ T353: DOMElementRef, BoundingBox interfaces added
- ✅ T354: elementIndices, elementBoundingBoxes added to agent types
- ✅ T355: evaluate-batch-tool extended for elementIndices
- ✅ T356: ViewportContext and evidence capture in state manager
- ✅ T357: Vision agent passes viewport context
- ✅ T358: ScreenshotWriter class created
- ✅ T359: CLI --save-evidence and --evidence-dir flags added
- ✅ T360: agent-progress-formatter displays evidence fields (4 tests)
- ✅ T361: vision-prompt-builder includes elementIndices instruction (2 tests)
- ✅ T361b: capture-viewport-tool extracts bounding boxes
- ✅ T362: vision-state-manager evidence tests (5 tests)
- ✅ T363: evaluate-batch-tool elementIndices tests (4 tests)
- ✅ T364: Integration tests for evidence capture (6 tests)
- ✅ T365: Exports verified (DOMElementRef, BoundingBox, ScreenshotWriter)
- ✅ T366: Evidence export gap fixed (13 tests)
  - Extended Evidence interface in cro-insight.ts with viewportIndex, timestamp, domElementRefs, boundingBox
  - Updated evaluationToInsight() in analyzer.ts and multi-viewport-analyzer.ts to map all evidence fields
  - Added Zod schemas for DOMElementRef and BoundingBox validation

### Phase 21i Progress (2026-02-02) - COMPLETE ✅ (17/17 tasks)
- ✅ T366: Created `src/browser/dom/coordinate-mapper.ts` (26 tests)
  - ScreenshotCoords interface (x, y, width, height, isVisible, visibilityRatio)
  - ElementMapping interface (index, xpath, text, croType, tagName, pageCoords, screenshotCoords)
  - toScreenshotCoords() - transforms page coords to screenshot coords
  - mapElementsToScreenshot() - maps all indexed DOM elements
  - filterVisibleElements(), getElementByIndex(), getElementsByIndices() helpers
- ✅ T367: ElementMapping types defined in coordinate-mapper.ts
- ✅ T368: Updated `src/browser/dom/index.ts` with coordinate-mapper exports
- ✅ T369: Extended ViewportSnapshot in both:
  - `src/agent/vision/types.ts` - elementMappings, visibleElements fields
  - `src/models/agent-state.ts` - same fields for consistency
  - `src/models/index.ts` - re-exports ElementMapping, ScreenshotCoords
- ✅ T370: Modified `src/agent/tools/cro/capture-viewport-tool.ts`
  - Calls mapElementsToScreenshot() after DOM extraction
  - Filters to visibleElements using filterVisibleElements()
  - Stores both in ViewportSnapshot
  - Added viewport dimension capture (width, height, devicePixelRatio)
- ✅ T371: Modified `src/agent/vision/vision-prompt-builder.ts` (10 tests)
  - Added formatDOMContextWithCoords(visibleElements) function
  - Format: [index] <tag> [cro-type] "text" → (x, y, width×height)
  - Text truncation, coordinate rounding, visibility indicators
- ✅ T372: Updated `src/prompts/system-vision-agent.md`
  - Added <element_coordinates> section with coordinate format docs
  - Instructed LLM to include [index] and position in evaluations
- ✅ T373: Modified `src/heuristics/vision/response-parser.ts` (17 tests)
  - Added extractElementReferences(text) using regex /\[(\d+)\]/g
  - Added parseEvaluationWithElements(), parseEvaluationsWithElements()
- ✅ T374: Added ParsedEvaluation interface to types.ts
  - Extends HeuristicEvaluation with relatedElements: number[]
- ✅ T375: Modified `src/agent/vision/vision-state-manager.ts` (9 tests)
  - Added elementMappings to ViewportContext
  - Added getLatestElementMappings(), enrichEvaluationWithMappings()
  - Added buildViewportContextFromLatest() helper
- ✅ T376: Modified `src/agent/vision/tools/evaluate-batch-tool.ts` (10 tests)
  - Uses extractElementReferences() for auto-extraction from text
  - Populates elementIndices when not explicitly provided
- ✅ T377: Created `src/output/screenshot-annotator.ts` (27 tests)
  - AnnotationOptions interface (highlightIssues, showElementIndexes, showCoordinates)
  - annotateScreenshot() function using sharp to composite SVG overlay
  - Draw bounding boxes: red for failed, orange for partial, green for passed
  - Draw element index labels [0], [1], etc.
  - ScreenshotAnnotator class and createScreenshotAnnotator factory
- ✅ T378: Updated `src/output/index.ts`
  - Export ScreenshotAnnotator, annotateScreenshot, createScreenshotAnnotator
  - Export AnnotationOptions, AnnotationResult, DEFAULT_ANNOTATION_OPTIONS
- ✅ T379: Modified `src/cli.ts`
  - Added --annotate-screenshots flag parsing
  - Integrated with --save-evidence (annotate before saving)
  - Updated help text with examples
- ✅ T380: `tests/unit/coordinate-mapper.test.ts` (26 tests - already complete)
- ✅ T381: Created `tests/unit/screenshot-annotator.test.ts` (27 tests)
  - Test bounding box drawing, color coding, element index labels
  - Test SVG overlay composition, error handling
  - Test ScreenshotAnnotator class and factory
- ✅ T382: Created `tests/integration/dom-screenshot-mapping.test.ts` (19 tests)
  - End-to-end DOM to screenshot coordinate mapping flow
  - Test prompt includes coordinates via formatDOMContextWithCoords()
  - Test element references parsed from mock responses
  - Test annotated screenshot output with color coding

### CHANGE REQUEST 001: Architecture Simplification - APPROVED 🔄

**See**: `CHANGE-REQUEST-001.md` for full details

**Key Decisions**:
1. **REMOVE**: `--vision`, `--full-page-vision`, `--full-page-screenshot` modes
2. **KEEP**: `--vision-agent` as the ONE vision mode
3. **MERGE**: Vision Agent into CRO Agent (single agent loop)
4. **DEFER**: Phase 20 (60 tasks) to backlog
5. **ADD NOW**: PLP, Homepage, Cart, Checkout, Generic knowledge bases

**Target Architecture**:
```
Unified CRO Agent
├── DATA COLLECTION: scroll, click, navigate, capture (DOM + screenshots)
├── ANALYSIS: Multiple LLM calls per heuristic category (after collection)
└── OUTPUT: Console, JSON, evidence, hypotheses, A/B test ideas
```

---

### Completed Work (CR-001)

| Sub-Phase | Tasks | Status |
|-----------|-------|--------|
| CR-001-A | T500-T504 (5) | ✅ Remove redundant vision modes |
| CR-001-B | T505-T514 (10) | ✅ Merge Vision Agent into CRO Agent |
| CR-001-C | T515-T522 (8) | ✅ Refactor analysis to post-collection |

### Immediate Work (Next Priority)

| Priority | Task | Tasks |
|----------|------|-------|
| 1 | **Phase 21j: CLI Vision Agent Fix** | **8** |
| 2 | Phase 22: New Page Type Knowledge Bases | ~38 |

### Phase 21j: CLI Vision Agent Fix - NEXT 📋

**Purpose**: Fix CLI --vision-agent to use unified CROAgent instead of deprecated VisionAgent

**Bug Summary**:
- CLI `processVisionAgentMode()` at line 643 uses `createVisionAgent()` (DEPRECATED)
- VisionAgent relies on LLM to decide when to scroll/capture
- LLM may stop after 1 viewport
- No enforced full-page coverage

**Solution**: Use CROAgent with unified mode:
```typescript
// Replace this (cli.ts:643):
const visionAgent = createVisionAgent({...});
const result = await visionAgent.analyze(page, pageType);

// With this:
const croAgent = new CROAgent({...});
const result = await croAgent.analyze(url, {
  enableUnifiedMode: true,
  visionAgentMode: true,
  scanMode: 'full_page',
});
```

**Tasks**: T383-T390 (8 tasks, ~20 tests)
- T383: Refactor processVisionAgentMode() to use CROAgent
- T384: Update CROAgent to return snapshots in result
- T385: Add console output for DOM-Screenshot mapping proof
- T386: Fix evidence saving to use CROAgent result
- T387: Add verbose logging for collection phase
- T388: Update CLI help text
- T389: Integration test: full-page + evidence
- T390: Integration test: annotated screenshots

**Files**: See `plan/phase-21j.md` and `tasks/phase-21j.md`

### Deferred

- **Phase 20**: Hybrid Extraction Pipeline (60 tasks) - moved to backlog

---

### Phase 21h: Evidence Capture - PLANNED 📋

**Goal**: Add 5 evidence fields to HeuristicEvaluation for audit trails.

**Evidence Fields**:
- `viewportIndex` - Which viewport snapshot the evaluation came from
- `screenshotRef` - Path to saved screenshot (when --save-evidence used)
- `domElementRefs` - Structured references to DOM elements
- `boundingBox` - Coordinates from Playwright element.boundingBox()
- `timestamp` - When evaluation was made (epoch ms)

**Tasks**: 14 tasks, ~49 tests

---

### Phase 21i: DOM-Screenshot Coordinate Mapping - PLANNED 📋

**Purpose**: Coordinate mapping between DOM elements and screenshot positions.

**Tasks**: 17 tasks, ~88 tests

---

### Phase 22: Page Type Knowledge Bases - PLANNED 📋

**New Knowledge Bases**:
| Page Type | Est. Heuristics | Est. Tasks |
|-----------|-----------------|------------|
| PLP | ~25-30 | 10 |
| Homepage | ~20-25 | 8 |
| Cart | ~15-20 | 6 |
| Checkout | ~25-30 | 10 |
| Generic | ~10-15 | 4 |

---

### CR-001-C: Analysis Refactor - COMPLETE ✅ (2026-01-30)

**Purpose**: Move analysis to post-collection phase with category-based LLM calls

**Key Files Created**:
- `src/heuristics/category-grouper.ts` - `groupHeuristicsByCategory(pageType, options)`
- `src/heuristics/category-analyzer.ts` - `analyzeCategory(snapshots, category, pageType)`
- `src/heuristics/analysis-orchestrator.ts` - `runAnalysis(snapshots, pageType)`
- `src/prompts/analysis-category.md` - Prompt template documentation
- `tests/integration/unified-agent-flow.test.ts` - 19 tests

**Key Files Updated**:
- `src/agent/cro-agent.ts` - Unified mode calls orchestrator after collection
- `src/heuristics/index.ts` - Exports for new modules
- `src/output/markdown-reporter.ts` - Added visionInsights, pageType, unifiedAnalysis
- `src/output/json-exporter.ts` - Added bySource breakdown, unified metadata
- `src/output/agent-progress-formatter.ts` - Fixed visionInsights null handling

**Architecture**:
```
CROAgent.analyze(url, { enableUnifiedMode: true, visionAgentMode: true })
  ├── runCollectionPhase() → ViewportSnapshot[]
  │   └── Tools: scroll_page, capture_viewport, collection_done
  ├── orchestrator.runAnalysis(snapshots, pageType) → AnalysisResult
  │   ├── groupHeuristicsByCategory() → CategoryGroup[]
  │   └── For each category: analyzeCategory() → evaluations
  └── generateReport(analysisResult) → CROAnalysisResult
```

---

### Phase 21g: Vision Agent Loop - COMPLETE ✅ (merged into CRO Agent)

**Note**: Merged into CRO Agent per CR-001-B.

**Completed Tasks (18/18)**:
- T335: `src/agent/vision/types.ts` ✅
- T336: `src/agent/vision/vision-state-manager.ts` ✅
- T337: `tests/unit/vision-state-manager.test.ts` (35 tests) ✅
- T338: `src/agent/vision/tools/capture-viewport-tool.ts` ✅
- T339: `src/agent/vision/tools/scroll-page-tool.ts` ✅
- T340: `src/agent/vision/tools/evaluate-batch-tool.ts` ✅
- T341: `src/agent/vision/tools/vision-done-tool.ts` ✅
- T342: `src/agent/vision/tools/create-vision-registry.ts` ✅
- T343: `src/agent/vision/vision-prompt-builder.ts` ✅
- T344: `src/prompts/system-vision-agent.md` ✅
- T345: `src/agent/vision/vision-message-manager.ts` ✅
- T346: `src/agent/vision/vision-agent.ts` ✅
- T347: `src/agent/vision/index.ts` ✅
- T348: `src/cli.ts` (--vision-agent flags) ✅
- T349: `src/agent/cro-agent.ts` (VisionAgent integration) ✅
- T350: `tests/unit/vision-agent.test.ts` (35 tests) ✅
- T351: `tests/integration/vision-agent.test.ts` (21 tests) ✅
- T352: `src/agent/index.ts` (exports) ✅

---

## CLI Usage

```bash
# Vision agent mode (THE ONE MODE after CR-001)
npm run start -- --vision-agent https://example.com/product

# With specific model (default: gpt-4o-mini)
npm run start -- --vision-agent --vision-model gpt-4o https://example.com/product

# With evidence saving (Phase 21h)
npm run start -- --vision-agent --save-evidence https://example.com/product

# With screenshot annotation (Phase 21i)
npm run start -- --vision-agent --annotate-screenshots https://example.com/product

# Combined with other flags
npm run start -- --vision-agent --headless --verbose https://example.com/product
```

**Removed Flags** (after CR-001 implementation):
- `--vision`, `--vision-only`, `--no-vision`
- `--full-page-vision`, `--vision-max-viewports`, `--no-parallel-vision`
- `--full-page-screenshot`

---

## Implemented Architecture (CR-001 Complete ✅)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│               UNIFIED CRO AGENT (merged)                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  PHASE 1: DATA COLLECTION                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Tools:                                                                 │   │
│  │  ├── scroll_page        (navigate full page)                            │   │
│  │  ├── click_element      (reveal hidden content)                         │   │
│  │  ├── navigate_to_url    (multi-page)                                    │   │
│  │  ├── capture_viewport   (DOM + screenshot at current position)          │   │
│  │  └── collection_done    (signal data collection complete)               │   │
│  │                                                                         │   │
│  │  Output: { dom: DOMTree[], screenshots: Base64[], metadata }            │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                                  │
│  PHASE 2: ANALYSIS (after collection)                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  For each heuristic category:                                           │   │
│  │  ├── Send: DOM + Screenshots + Category Heuristics                      │   │
│  │  ├── LLM evaluates all heuristics in category                           │   │
│  │  └── Collect: evaluations with evidence                                 │   │
│  │                                                                         │   │
│  │  Categories: Layout, Imagery, Pricing, CTAs, Trust, Reviews, etc.       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                                  │
│  PHASE 3: OUTPUT                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ├── Console: formatted report                                          │   │
│  │  ├── JSON: structured data                                              │   │
│  │  ├── Evidence: screenshots with annotations                             │   │
│  │  └── Report: hypotheses, A/B test ideas, severity ratings               │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  COST: ~$0.005-0.010/page with gpt-4o-mini                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files (CR-001)

### CR-001-C Analysis Orchestration (NEW)

| File | Purpose |
|------|---------|
| `src/heuristics/category-grouper.ts` | Groups heuristics by category with filtering |
| `src/heuristics/category-analyzer.ts` | Single LLM call per category (multimodal) |
| `src/heuristics/analysis-orchestrator.ts` | Loops categories, merges evaluations |
| `src/prompts/analysis-category.md` | Prompt template documentation |
| `tests/integration/unified-agent-flow.test.ts` | 19 tests for unified flow |

### CR-001-B Collection Phase

| File | Purpose |
|------|---------|
| `src/agent/tools/cro/capture-viewport-tool.ts` | Captures DOM + screenshot |
| `src/agent/tools/cro/collection-done-tool.ts` | Signals collection complete |
| `src/prompts/system-collection.md` | Collection phase prompt |

### Phase 21g Vision Agent (deprecated - merged)

**Clarification on "Merged" Status**:
- **"Merged"** means Vision Agent functionality is now part of the unified CRO Agent
- `src/agent/vision/` directory **still exists** (kept for backwards compatibility)
- Vision Agent files are marked `@deprecated` - use unified mode via `--vision-agent` flag
- The standalone VisionAgent class is NOT deleted, just deprecated
- Unified mode in CRO Agent is the primary path for all new development

| File | Purpose |
|------|---------|
| `src/agent/vision/vision-agent.ts` | @deprecated - use unified mode |
| `src/agent/vision/vision-state-manager.ts` | State tracking (reused in unified) |
| `tests/integration/vision-agent.test.ts` | 21 integration tests |

---

## Key Technical Details

### String-Based page.evaluate
DOM operations use string-based evaluate to avoid TypeScript DOM type issues:
```typescript
const dimensions = await page.evaluate(`
  (() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }))()
`) as { scrollHeight: number; clientHeight: number };
```

### LangChain Tool Binding
```typescript
const modelWithTools = new ChatOpenAI({
  modelName: this.options.model,
  maxTokens: this.options.maxResponseTokens,
  temperature: this.options.temperature,
}).bindTools(this.toolRegistry.getToolSchemas());
```

### Default Model
- **All modes use `gpt-4o-mini` by default** (cost-optimized)
  - CRO Agent loop, Vision analysis, Full-page vision, Vision Agent
- Override with `--vision-model gpt-4o` for higher quality

### Severity Types
Uses 'critical' | 'high' | 'medium' | 'low' (matches cro-insight.ts Severity type)

---

## Quick Start Commands

```bash
# Install dependencies
npm install

# Build
npm run build

# Type check
npx tsc --noEmit

# Run all tests
npm test

# Run CR-001-C tests (unified flow)
npm test -- tests/integration/unified-agent-flow.test.ts tests/integration/cro-agent.test.ts

# Run vision agent tests
npm test -- tests/unit/vision-state-manager.test.ts tests/unit/vision-agent.test.ts tests/integration/vision-agent.test.ts

# Run unified mode (CR-001)
npm run start -- --vision-agent https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt
```

---

## Phase Summary

| Phase | Scope | Tasks | Status |
|-------|-------|-------|--------|
| 21a | PageType Detection | 8 | COMPLETE ✅ |
| 21b | Knowledge Base (PDP) | 14 | COMPLETE ✅ |
| 21c | Vision Analyzer | 7 | COMPLETE ✅ |
| 21d | Integration | 7 | COMPLETE ✅ |
| ~~21e~~ | ~~Multi-Viewport~~ | ~~8~~ | ✅ REMOVED (CR-001) |
| ~~21f~~ | ~~Full-Page Screenshot~~ | ~~6~~ | ✅ REMOVED (CR-001) |
| ~~21g~~ | ~~Vision Agent Loop~~ | ~~18~~ | ✅ MERGED (CR-001) |
| **CR-001** | **Architecture Refactor** | **23** | **COMPLETE ✅** |
| **21h** | **Evidence Capture** | **15** | **COMPLETE ✅** |
| **21i** | **DOM-Screenshot Mapping** | **17** | **COMPLETE ✅** |
| **21j** | **CLI Vision Agent Fix** | **8** | **📋 NEXT** |
| **22** | **New Page Type KBs** | **~38** | **📋 PLANNED** |
| ~~20~~ | ~~Hybrid Extraction~~ | ~~60~~ | ~~📋 DEFERRED~~ |

---

## Session Guidelines

**Task Limit**: 1-5 tasks per session (optimal context usage)
**Context Target**: Stay under 60% to maintain quality

---

## Session Task Chunks

### Session 1: CR-001-A (5 tasks)
```
The new session can read these for full context:
    - specs/001-browser-agent-core/quickstart.md - Project overview
    - specs/001-browser-agent-core/SESSION-HANDOFF.md - Technical deep-dive

PROJECT: Browser Agent - TypeScript CRO analysis tool
- Uses Playwright for browser automation
- Uses GPT-4o-mini for screenshot-based heuristic evaluation (cost-optimized)
- Extracts DOM + screenshots, sends to LLM with heuristics knowledge base
- Outputs CRO analysis report, hypotheses, A/B test ideas

CURRENT WORK: CR-001 Architecture Refactor (approved 2026-01-29)
Key decisions:
- REMOVE: --vision, --full-page-vision, --full-page-screenshot modes
- KEEP: --vision-agent as the ONE mode
- MERGE: Vision Agent into CRO Agent (single agent loop)
- Analysis happens AFTER data collection (not during)

SESSION TASKS: T500-T504 (5 tasks)
File: specs/001-browser-agent-core/tasks/cr-001-refactor.md

T500: Remove --vision flag from src/cli.ts
T501: Remove --full-page-vision flag from src/cli.ts
T502: Remove --full-page-screenshot flag from src/cli.ts
T503: Remove multi-viewport analyzer code (deprecate files)
T504: Update help text (keep only --vision-agent options)

Run tests after changes. Mark tasks complete when done.
```

### Session 2: CR-001-B Part 1 (5 tasks)
```
The new session can read these for full context:
    - specs/001-browser-agent-core/quickstart.md
    - specs/001-browser-agent-core/SESSION-HANDOFF.md

PROJECT: Browser Agent - TypeScript CRO tool (Playwright + GPT-4o-mini)
PREVIOUS: Session 1 completed - removed redundant vision modes

SESSION TASKS: T505-T509 (Merge agents - architecture)
File: specs/001-browser-agent-core/tasks/cr-001-refactor.md

T505: Define unified agent architecture (collection → analysis → output)
T506: Extend CROAgent with vision capabilities (add captureViewport)
T507: Add collection phase (collect all DOM + screenshots first)
T508: Add analysis phase (LLM calls per heuristic category)
T509: Update AnalyzeOptions (remove visionAgentMode, add enableVision)

Run tests. Mark tasks complete.
```

### Session 3: CR-001-B Part 2 (5 tasks) - COMPLETE ✅
```
Completed: 2026-01-30
T510-T514 all complete
- T510: Vision tools verified migrated (capture_viewport, collection_done)
- T511: Added buildAnalysisSystemPrompt(), buildAnalysisUserMessage() to PromptBuilder
- T512: Added addUserMessageWithImage(), addUserMessageWithImages() to MessageManager
- T513: Added 8 CR-001-B tests to tests/integration/cro-agent.test.ts
- T514: Added @deprecated notices to VisionAgent and vision/index.ts

Tests: 742 passed (up from 735)
```

### Session 4: CR-001-C (8 tasks) - READY
```
The new session can read these for full context:
  - specs/001-browser-agent-core/quickstart.md - Project overview
  - specs/001-browser-agent-core/SESSION-HANDOFF.md - Technical deep-dive

PROJECT: Browser Agent - TypeScript CRO analysis tool
- Uses Playwright for browser automation
- Uses GPT-4o-mini for screenshot-based heuristic evaluation (cost-optimized)
- Extracts DOM + screenshots, sends to LLM with heuristics knowledge base
- Outputs CRO analysis report, hypotheses, A/B test ideas

PREVIOUS SESSIONS: CR-001-A ✅, CR-001-B ✅ (2026-01-30)
- T500-T504: Removed redundant vision modes
- T505-T509: Unified architecture foundation
- T510-T514: Vision Agent merge complete, tests added, deprecated standalone

CR-001-B KEY FILES MODIFIED:
- src/agent/prompt-builder.ts - Added buildAnalysisSystemPrompt(), buildAnalysisUserMessage()
- src/agent/message-manager.ts - Added image support (addUserMessageWithImage, addUserMessageWithImages)
- tests/integration/cro-agent.test.ts - Added 8 CR-001-B tests
- src/agent/vision/* - Added @deprecated notices

CURRENT WORK: CR-001-C - Analysis Refactor (T515-T522, 8 tasks)
Goal: Move analysis to post-collection phase with category-based LLM calls

SESSION TASKS: T515-T522
File: specs/001-browser-agent-core/tasks/cr-001-refactor.md

T515: Create heuristic category grouper
  - File: src/heuristics/category-grouper.ts
  - Function: groupHeuristicsByCategory(heuristics): CategoryGroup[]

T516: Create category analyzer
  - File: src/heuristics/category-analyzer.ts
  - Function: analyzeCategory(dom, screenshots, category): Evaluation[]
  - Single LLM call per category

T517: Create analysis orchestrator
  - File: src/heuristics/analysis-orchestrator.ts
  - Function: runAnalysis(collectedData, pageType): AnalysisResult
  - Loop through categories, call categoryAnalyzer

T518: Update CROAgent to use analysis orchestrator
  - After collection_done, call analysisOrchestrator.runAnalysis()
  - Pass collected DOM snapshots + screenshots

T519: Remove in-loop analysis tools
  - Remove: analyze_ctas, analyze_forms, analyze_trust_signals, etc.
  - Keep: scroll, click, navigate, capture_viewport, done
  - Update: tool registry

T520: Create analysis prompt templates
  - File: src/prompts/analysis-category.md
  - Template for category-specific analysis

T521: Update report generator
  - File: src/output/report-generator.ts
  - Accept: AnalysisResult with all evaluations

T522: Create integration tests for new flow
  - File: tests/integration/unified-agent-flow.test.ts
  - Test: Full flow from URL to report

Run tests after changes. Mark tasks complete when done.
```

### Session 5: Phase 21h (14 tasks)
```
SESSION 4: T515-T518 (Analysis refactor - core)
SESSION 5: T519-T522 (Analysis refactor - integration)
File: specs/001-browser-agent-core/tasks/cr-001-refactor.md
```

### Session 6: Phase 21h Part 1 (7 tasks) - COMPLETE ✅
```
Completed: 2026-01-30
T353-T359 all complete
- T353: Added DOMElementRef, BoundingBox interfaces to vision types
- T354: Added elementIndices to BatchEvaluation, elementBoundingBoxes to ViewportSnapshot
- T355: Extended evaluate-batch-tool JSON schema for elementIndices
- T356: Added ViewportContext, evidence capture to state manager
- T357: Vision agent passes viewport context when recording evaluations
- T358: Created ScreenshotWriter class in src/output/
- T359: Added --save-evidence, --evidence-dir CLI flags

Tests: 772 passed
```

### Session 7: Phase 21h Part 2 (7 tasks) - COMPLETE ✅
```
Completed: 2026-01-30
T360-T365 + T361b all complete

Key changes:
- T360: agent-progress-formatter.ts displays evidence fields (viewportIndex, timestamp, screenshotRef, domElementRefs, boundingBox)
- T361: vision-prompt-builder.ts includes elementIndices instruction
- T361b: capture-viewport-tool.ts extracts element bounding boxes via Playwright
- T362-T364: Added 15 new tests (5 unit + 4 unit + 6 integration)
- T365: Exports verified

Tests: 118 tests passed for modified files (total 790+)
```

### Session 8: Phase 21i Part 1 (5 tasks) - COMPLETE ✅
```
Completed: 2026-01-30
T366-T370 all complete

Key changes:
- T366-T367: Created src/browser/dom/coordinate-mapper.ts with:
  - ScreenshotCoords, ElementMapping interfaces
  - toScreenshotCoords(), mapElementsToScreenshot() functions
  - filterVisibleElements(), getElementByIndex(), getElementsByIndices() helpers
- T368: Updated src/browser/dom/index.ts exports
- T369: Extended ViewportSnapshot in vision types and models
- T370: Modified capture-viewport-tool.ts to compute element mappings

Tests: 26 new tests (tests/unit/coordinate-mapper.test.ts)
```

### Session 9-10: Phase 21i Part 2 (12 tasks remaining)
```
SESSION 9: T371-T376 (Prompt & response parsing)
SESSION 10: T377-T382 (Screenshot annotator & tests)
File: specs/001-browser-agent-core/tasks/phase-21.md
```

### Session 11: Phase 21j (8 tasks) - CLI Vision Agent Fix 📋 NEXT
```
The new session can read these for full context:
    - specs/001-browser-agent-core/quickstart.md - Project overview
    - specs/001-browser-agent-core/SESSION-HANDOFF.md - Technical deep-dive

PROJECT: Browser Agent - TypeScript CRO analysis tool using Playwright + GPT-4o Vision
GOAL: Analyze websites for CRO issues, generate hypotheses and A/B test ideas

BUG FOUND (2026-02-02): CLI --vision-agent uses deprecated VisionAgent
- Only 1 viewport captured (LLM-guided, not enforced full-page)
- Evidence not saving (empty snapshots)
- No DOM-Screenshot mapping proof in console

SOLUTION: Replace deprecated VisionAgent with CROAgent unified mode

SESSION TASKS: T383-T390 (8 tasks)
File: specs/001-browser-agent-core/tasks/phase-21j.md

Implementation Order:
1. T384: CROAgent returns snapshots (foundation)
2. T383: Refactor CLI to use CROAgent
3. T385: Add mapping proof output
4. T386: Fix evidence saving
5. T387: Add verbose logging
6. T388: Update help text
7. T389: Integration tests (full-page)
8. T390: Integration tests (annotation)

Key files to read:
- src/cli.ts - processVisionAgentMode() at line 540
- src/agent/cro-agent.ts - analyze() method, unified mode
- src/agent/tools/cro/capture-viewport-tool.ts - how snapshots are created

Test command after fix:
npm run start -- --vision-agent --save-evidence --annotate-screenshots https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt

Expected output after fix:
- Multiple viewports captured (3-5 for typical PDP)
- Evidence saved to ./evidence/ directory
- Annotated screenshots with bounding boxes
- Console shows DOM-Screenshot mapping counts
```

### Session 12-15: Phase 22 (38 tasks total)
```
SESSION 12: T400-T409 (PLP knowledge base)
SESSION 13: T410-T417 (Homepage knowledge base)
SESSION 14: T418-T433 (Cart + Checkout)
SESSION 15: T434-T437 (Generic knowledge base)
File: specs/001-browser-agent-core/tasks/phase-22.md
```

---

## Quick Start for Any Session

```
The new session can read these for full context:
    - specs/001-browser-agent-core/quickstart.md - Project overview
    - specs/001-browser-agent-core/SESSION-HANDOFF.md - Technical deep-dive

PROJECT: Browser Agent - TypeScript CRO analysis tool using Playwright + GPT-4o Vision
GOAL: Analyze websites for CRO issues, generate hypotheses and A/B test ideas

CURRENT WORK: CR-001 Architecture Refactor
- Merge Vision Agent into CRO Agent (single agent loop)
- Remove redundant vision modes (keep only --vision-agent)
- Analysis happens AFTER data collection (not during)

SESSION TASK: T353-T365 (Phase 21h - see tasks/phase-21.md)

Complete 1-5 tasks max. Run tests. Update task status when done.
```

---

*Generated: 2026-01-14*
