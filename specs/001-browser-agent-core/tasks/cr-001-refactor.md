**Navigation**: [Index](./index.md) | [Change Request](../CHANGE-REQUEST-001.md)

---

## CR-001: Architecture Simplification Tasks

**Purpose**: Implement architecture changes from Change Request 001

**Created**: 2026-01-29

**Acceptance Tests**:
- Only `--vision-agent` flag works for vision analysis
- CRO Agent handles both data collection and vision analysis
- Analysis happens after data collection (not during)
- All existing tests pass after refactor

---

### CR-001-A: Remove Redundant Vision Modes (T500-T504) ✅ COMPLETE

**Purpose**: Remove `--vision`, `--full-page-vision`, `--full-page-screenshot` modes

- [x] **T500** Remove `--vision` flag and single-viewport mode from CLI ✅
  - File: `src/cli.ts`
  - Remove: processVisionMode(), --vision flag parsing
  - Tests: Update CLI tests

- [x] **T501** Remove `--full-page-vision` flag and multi-viewport mode from CLI ✅
  - File: `src/cli.ts`
  - Remove: processFullPageVisionMode(), --full-page-vision, --vision-max-viewports, --no-parallel-vision
  - Tests: Update CLI tests

- [x] **T502** Remove `--full-page-screenshot` flag and single-image mode from CLI ✅
  - File: `src/cli.ts`
  - Remove: processFullPageScreenshotMode(), --full-page-screenshot flag
  - Tests: Update CLI tests

- [x] **T503** Remove multi-viewport analyzer code ✅
  - File: `src/heuristics/vision/multi-viewport-analyzer.ts` - DEPRECATED (not exported)
  - File: `src/heuristics/vision/result-merger.ts` - DEPRECATED (not exported)
  - Update: `src/heuristics/vision/index.ts` exports - Removed deprecated exports

- [x] **T504** Update help text and documentation ✅
  - File: `src/cli.ts` - Update VISION ANALYSIS OPTIONS section
  - Keep only: --vision-agent, --vision-model, --vision-agent-max-steps

**Checkpoint**: Only --vision-agent mode available ✅

**Completed**: 2026-01-30

---

### CR-001-B: Merge Vision Agent into CRO Agent (T505-T514)

**Purpose**: Single unified agent loop for data collection + analysis

- [x] **T505** Define unified agent architecture ✅
  - Phase 1: Data Collection (scroll, click, capture DOM + screenshots)
  - Phase 2: Analysis (evaluate heuristics per category)
  - Phase 3: Output (report generation)

- [x] **T506** Extend CROAgent with vision capabilities ✅
  - File: `src/agent/cro-agent.ts`
  - Added: captureViewport tool from Vision Agent
  - Added: ViewportSnapshot storage in AgentState
  - Added: agentPhase tracking (collection/analysis/output)
  - Keep: existing scroll, click, navigate tools

- [x] **T507** Add collection phase to CROAgent ✅
  - Added: runCollectionPhase() method
  - Store in state.viewportSnapshots[]
  - Added: collection_done tool to signal phase complete
  - Added: system-collection.md prompt for collection phase

- [x] **T508** Add analysis phase to CROAgent ✅
  - After collection_done, run heuristic analysis
  - Uses existing CROVisionAnalyzer for analysis
  - Integrated with enableUnifiedMode flag

- [x] **T509** Update AnalyzeOptions for unified agent ✅
  - Added: enableUnifiedMode (default: false)
  - Added: enableVision (default: true when visionAgentMode)
  - Added: heuristicCategories (optional filter)
  - Kept: visionAgentMode for backward compatibility

**Completed**: 2026-01-30

- [x] **T510** Migrate Vision Agent tools to CRO Agent ✅
  - Move: capture_viewport → CRO Agent tool
  - Keep: scroll_page (already exists)
  - Remove: evaluate_batch (analysis happens after collection)
  - Remove: vision_done (use unified done)

- [x] **T511** Update prompt builder for unified agent ✅
  - File: `src/agent/prompt-builder.ts`
  - Add: buildAnalysisSystemPrompt() for analysis phase
  - Add: buildAnalysisUserMessage() with DOM context + screenshot refs
  - Add: Category-specific heuristic instructions

- [x] **T512** Update message manager for images ✅
  - File: `src/agent/message-manager.ts`
  - Add: addUserMessageWithImage() for single image
  - Add: addUserMessageWithImages() for multiple images
  - Add: Image token estimation in estimateTokenCount()

- [x] **T513** Update CRO Agent tests ✅
  - File: `tests/integration/cro-agent.test.ts`
  - Add: Tests for collection phase (viewport snapshots, phase transitions)
  - Add: Tests for analysis phase prompts
  - Add: Tests for vision integration (MessageManager with images)
  - 8 new tests added (26 total in file)

- [x] **T514** Deprecate standalone VisionAgent ✅
  - File: `src/agent/vision/vision-agent.ts` - Added @deprecated JSDoc
  - File: `src/agent/vision/index.ts` - Added deprecation notices + migration guide
  - Keep code for backwards compatibility

**Completed**: 2026-01-30

**Checkpoint**: CROAgent handles both collection and vision analysis ✅

---

### CR-001-C: Refactor Analysis Flow (T515-T522) ✅ COMPLETE

**Purpose**: Move analysis to post-collection phase with category-based LLM calls

- [x] **T515** Create heuristic category grouper ✅
  - File: `src/heuristics/category-grouper.ts`
  - Function: groupHeuristicsByCategory(pageType, options): CategoryGroup[]
  - Supports filtering by category name and minimum severity

- [x] **T516** Create category analyzer ✅
  - File: `src/heuristics/category-analyzer.ts`
  - Function: analyzeCategory(snapshots, category, pageType): CategoryAnalysisResult
  - Single LLM call per category with DOM + screenshots + heuristics
  - Uses LangChain message types for proper multimodal support

- [x] **T517** Create analysis orchestrator ✅
  - File: `src/heuristics/analysis-orchestrator.ts`
  - Function: runAnalysis(snapshots, pageType): AnalysisResult
  - Loops through categories, calls categoryAnalyzer
  - Merges evaluations and converts to CROInsights

- [x] **T518** Update CROAgent to use analysis orchestrator ✅
  - After collection_done, calls orchestrator.runAnalysis()
  - Passes collected ViewportSnapshot[] from collection phase
  - Receives AnalysisResult with evaluations and insights

- [x] **T519** Skip in-loop analysis tools in unified mode ✅
  - Added unifiedAnalysisComplete flag to skip agent loop
  - Analysis tools kept registered for backwards compatibility
  - Agent loop skipped when unified analysis completes

- [x] **T520** Create analysis prompt templates ✅
  - File: `src/prompts/analysis-category.md`
  - Template for category-specific analysis
  - Includes: DOM context, screenshot references, category heuristics

- [x] **T521** Update report generator ✅
  - Files: `src/output/markdown-reporter.ts`, `src/output/json-exporter.ts`
  - Added: visionInsights, pageType, unifiedAnalysis, categoriesAnalyzed
  - Reports now include unified analysis metadata and source breakdown

- [x] **T522** Create integration tests for new flow ✅
  - File: `tests/integration/unified-agent-flow.test.ts`
  - Tests: CategoryGrouper, CategoryAnalyzer, AnalysisOrchestrator
  - Tests: Collection phase, analysis phase, result structure
  - 19 tests added, all passing

**Completed**: 2026-01-30

**Checkpoint**: Analysis happens after collection with category-based LLM calls ✅

---

## Task Summary

| Sub-Phase | Tasks | Purpose |
|-----------|-------|---------|
| **CR-001-A** | T500-T504 (5) | Remove redundant vision modes |
| **CR-001-B** | T505-T514 (10) | Merge Vision Agent into CRO Agent |
| **CR-001-C** | T515-T522 (8) | Refactor analysis to post-collection |
| **TOTAL** | **23 tasks** | |

---

## Implementation Order

1. **CR-001-A first**: Remove modes to simplify codebase
2. **CR-001-B second**: Merge agents (main work)
3. **CR-001-C third**: Refactor analysis flow

## Dependencies

- CR-001-B depends on CR-001-A (simpler codebase to merge)
- CR-001-C depends on CR-001-B (unified agent exists)
- Phase 21h depends on CR-001 (evidence capture uses new architecture)
- Phase 21i depends on CR-001 (coordinate mapping uses new architecture)
