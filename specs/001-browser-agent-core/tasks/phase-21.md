# Tasks: Phase 21 (Vision-Based CRO Heuristics)

**Input**: Requirements from [spec/requirements-phase21.md](../spec/requirements-phase21.md)
**Plan**: [plan/phase-21.md](../plan/phase-21.md)

---

## Phase 21a: Foundation (PageType Detection) - COMPLETE

### PageType Model (T285-T286)

- [x] **T285** [US10] Create `src/models/page-type.ts`
  - PageType enum: 'pdp' | 'plp' | 'homepage' | 'cart' | 'checkout' | 'account' | 'other'
  - PageTypeResult interface: type, confidence, signals
  - PageTypeSignals interface: urlPatterns, elementSelectors, keywords
  - PAGE_TYPE_SIGNALS constant with detection patterns
  - **Tests**: 0 (types only)

- [x] **T286** [US10] Update `src/models/index.ts`
  - Export PageType, PageTypeResult, PageTypeSignals
  - **Tests**: 0 (exports only)

### PageTypeDetector (T287-T289)

- [x] **T287** [US10] Create `src/heuristics/page-type-detector.ts`
  - PageTypeDetectorConfig interface
  - PageTypeDetector class with detect(state) method
  - Weighted scoring: URL (45%), elements (35%), keywords (20%)
  - **Tests**: 15 unit tests

- [x] **T288** [US10] Create `tests/unit/page-type-detector.test.ts`
  - Test PDP/PLP/homepage/cart/checkout detection
  - Test confidence threshold behavior
  - **Tests**: 20+ unit tests

- [x] **T289** [US10] Update `src/heuristics/index.ts`
  - Export PageTypeDetector, createPageTypeDetector
  - **Tests**: 0 (exports only)

### Heuristic System Extensions (T290-T292)

- [x] **T290** [US10] Modify `src/heuristics/types.ts`
  - Add pageTypes field to HeuristicRule
  - Add filterByPageType to HeuristicEngineOptions
  - **Tests**: 0 (types only)

- [x] **T291** [US10] Modify `src/heuristics/heuristic-engine.ts`
  - Add pageType parameter to run() method
  - Add page type filtering logic
  - **Tests**: existing tests updated

- [x] **T292** [US10] Update heuristic-engine.test.ts
  - Tests pass pageType as parameter
  - **Tests**: All passing

**Phase 21a Total**: 8 tasks, 35+ tests - COMPLETE

---

## Phase 21b: Heuristics Knowledge Base - COMPLETE

### Knowledge Base Types (T293-T294)

- [x] **T293** [US10] Create `src/heuristics/knowledge/types.ts`
  - HeuristicItem interface (id, principle, checkpoints, severity, category)
  - HeuristicCategory interface (name, description, heuristics)
  - PageTypeHeuristics interface (pageType, source, lastUpdated, totalCount, categories)
  - **Tests**: 0 (types only)

- [x] **T294** [US10] Create `src/heuristics/knowledge/index.ts`
  - loadHeuristics(pageType) function
  - Lazy loading with caching
  - Error handling for unsupported page types
  - **Tests**: 5 unit tests

### PDP Heuristics JSON Files (T295-T304)

- [x] **T295** [US10] Create `src/heuristics/knowledge/pdp/layout-structure.json`
  - 4 heuristics: PDP-LAYOUT-001 to PDP-LAYOUT-004
  - Principles from Baymard research
  - Checkpoints for visual evaluation
  - **Tests**: 1 (valid JSON)

- [x] **T296** [US10] Create `src/heuristics/knowledge/pdp/imagery-media.json`
  - 4 heuristics: PDP-IMAGE-001 to PDP-IMAGE-004
  - Product imagery best practices
  - **Tests**: 1 (valid JSON)

- [x] **T297** [US10] Create `src/heuristics/knowledge/pdp/pricing-transparency.json`
  - 4 heuristics: PDP-PRICE-001 to PDP-PRICE-004
  - PDP-PRICE-001 is critical severity
  - **Tests**: 1 (valid JSON)

- [x] **T298** [US10] Create `src/heuristics/knowledge/pdp/description-value-prop.json`
  - 3 heuristics: PDP-DESC-001 to PDP-DESC-003
  - Description and value proposition
  - **Tests**: 1 (valid JSON)

- [x] **T299** [US10] Create `src/heuristics/knowledge/pdp/specifications.json`
  - 3 heuristics: PDP-SPEC-001 to PDP-SPEC-003
  - Technical specifications
  - **Tests**: 1 (valid JSON)

- [x] **T300** [US10] Create `src/heuristics/knowledge/pdp/reviews-social-proof.json`
  - 4 heuristics: PDP-REVIEW-001 to PDP-REVIEW-004
  - Reviews and social proof
  - **Tests**: 1 (valid JSON)

- [x] **T301** [US10] Create `src/heuristics/knowledge/pdp/selection-configuration.json`
  - 3 heuristics: PDP-SELECT-001 to PDP-SELECT-003
  - Variant selection
  - **Tests**: 1 (valid JSON)

- [x] **T302** [US10] Create `src/heuristics/knowledge/pdp/cta-purchase-confidence.json`
  - 4 heuristics: PDP-CTA-001 to PDP-CTA-004
  - PDP-CTA-001 is critical severity
  - **Tests**: 1 (valid JSON)

- [x] **T303** [US10] Create `src/heuristics/knowledge/pdp/mobile-usability.json`
  - 3 heuristics: PDP-MOBILE-001 to PDP-MOBILE-003
  - Mobile-specific usability
  - **Tests**: 1 (valid JSON)

- [x] **T304** [US10] Create `src/heuristics/knowledge/pdp/utility-secondary.json`
  - 3 heuristics: PDP-UTILITY-001 to PDP-UTILITY-003
  - Secondary actions (wishlist, share)
  - **Tests**: 1 (valid JSON)

### PDP Aggregator (T305)

- [x] **T305** [US10] Create `src/heuristics/knowledge/pdp/index.ts`
  - Import all category JSON files
  - Export combined PageTypeHeuristics for PDP
  - Calculate totalCount
  - **Tests**: 3 unit tests

### Knowledge Base Tests (T306)

- [x] **T306** [US10] Create `tests/unit/knowledge-loader.test.ts`
  - Test loadHeuristics('pdp') returns all 35 heuristics
  - Test each heuristic has required fields
  - Test category counts match expected
  - Test caching works correctly
  - Test error for unsupported page type
  - **Tests**: 25 unit tests

**Phase 21b Total**: 14 tasks, 25 tests - COMPLETE

---

## Phase 21c: CRO Vision Analyzer - COMPLETE

### Vision Types (T307)

- [x] **T307** [US10] Create `src/heuristics/vision/types.ts`
  - CROVisionAnalyzerConfig interface
  - HeuristicEvaluation interface
  - CROVisionAnalysisResult interface
  - **Tests**: 0 (types only)

### Vision Analyzer Implementation (T308-T311)

- [x] **T308** [US10] Create `src/heuristics/vision/prompt-builder.ts`
  - buildVisionPrompt(heuristics, viewport) function
  - Include all heuristics with principles and checkpoints
  - Request structured JSON output
  - **Tests**: 5 unit tests

- [x] **T309** [US10] Create `src/heuristics/vision/response-parser.ts`
  - parseVisionResponse(response, heuristics) function
  - Validate against expected heuristic IDs
  - Handle malformed responses gracefully
  - **Tests**: 8 unit tests

- [x] **T310** [US10] Create `src/heuristics/vision/analyzer.ts`
  - CROVisionAnalyzer class
  - analyze(screenshot, pageType, viewport) method
  - loadHeuristics() with caching
  - callVisionAPI() using OpenAI
  - transformToInsights() for CROInsight compatibility
  - calculateSummary() for statistics
  - **Tests**: 10 unit tests (with mocked API)

- [x] **T311** [US10] Create `src/heuristics/vision/index.ts`
  - Export CROVisionAnalyzer, types
  - Export createCROVisionAnalyzer factory
  - **Tests**: 0 (exports only)

### Vision Analyzer Tests (T312-T313)

- [x] **T312** [US10] Create `tests/unit/vision-analyzer.test.ts`
  - Test prompt includes all heuristics
  - Test response parsing for pass/fail/partial/not_applicable
  - Test transformation to CROInsight
  - Test summary calculation
  - Test error handling
  - **Tests**: 44 unit tests

- [x] **T313** [US10] Update `src/heuristics/index.ts`
  - Export vision analyzer components
  - Export knowledge loader
  - **Tests**: 0 (exports only)

**Phase 21c Total**: 7 tasks, 44 tests - COMPLETE

---

## Phase 21d: Integration - COMPLETE

### PageState Extension (T314)

- [x] **T314** [US10] Modify `src/models/page-state.ts`
  - Add optional visionAnalysis field
  - Add screenshotBase64 field for vision analysis
  - Import CROVisionAnalysisResult type
  - **Tests**: 0 (types only)

### Agent Integration (T315-T316)

- [x] **T315** [US10] Modify CRO Agent to use vision analysis
  - Detect page type using PageTypeDetector
  - Capture screenshot via Playwright page.screenshot()
  - If supported page type (pdp), run CROVisionAnalyzer
  - Store result in PageState.visionAnalysis
  - Include vision insights in report
  - **Tests**: 14 integration tests

- [x] **T316** [US10] Add vision analysis configuration
  - useVisionAnalysis option (default: true for supported types)
  - visionModel option ('gpt-4o' | 'gpt-4o-mini')
  - visionConfig option for custom analyzer settings
  - **Tests**: included in integration tests

### CLI Integration (T317-T318)

- [x] **T317** [US10] Add CLI vision flags
  - `--vision` / `--no-vision` flags
  - `--vision-model <model>` flag (gpt-4o, gpt-4o-mini)
  - `--vision-model=<model>` syntax support
  - Update help text with VISION ANALYSIS OPTIONS section
  - **Tests**: included in integration tests

- [x] **T318** [US10] Update output formatter for vision insights
  - Display heuristic evaluations in formatVisionSummary()
  - Show pass/fail/partial/notApplicable counts
  - Include severity breakdown (critical, high, medium, low)
  - Color-coded output for terminal
  - **Tests**: 6 unit tests (agent-progress-formatter.test.ts)

### Integration Tests (T319-T320)

- [x] **T319** [US10] Create `tests/integration/vision-analysis.test.ts`
  - Full flow: page state → page type detection → support check → load heuristics
  - Test with mock GPT-4o responses
  - Verify PageState structure matches interface
  - **Tests**: 14 integration tests

- [x] **T320** [US10] Create `tests/e2e/vision-analysis-workflow.test.ts`
  - Page type detection from mock HTML PDP
  - Screenshot capture verification (PNG base64)
  - Heuristics loading (35 PDP heuristics)
  - Vision analyzer configuration
  - E2E tests with real API (skipped without OPENAI_API_KEY)
  - **Tests**: 16 E2E tests (some conditional)

**Phase 21d Total**: 7 tasks, 44+ tests - COMPLETE

---

## Phase 21e: Multi-Viewport Full-Page Vision Analysis - COMPLETE

### Multi-Viewport Types (T321)

- [x] **T321** [US10] Modify `src/heuristics/vision/types.ts`
  - Add ViewportScreenshot interface
  - Add MultiViewportVisionConfig interface
  - Add MultiViewportAnalysisResult interface
  - Add ViewportVisionResult interface
  - Add HeuristicEvaluationWithViewport interface
  - Add MergedViewportResult interface
  - Add DEFAULT_MULTI_VIEWPORT_CONFIG constant
  - **Tests**: 0 (types only)

### Multi-Viewport Analyzer (T322-T324)

- [x] **T322** [US10] Create `src/heuristics/vision/result-merger.ts`
  - mergeViewportResults(results, dedupeThreshold) function
  - Deduplicate by heuristicId (keep highest confidence)
  - Track deduplicatedCount and viewportIndex
  - calculateTextSimilarity() for future use
  - findBestEvaluation(), getIssueEvaluations(), groupByViewport() utilities
  - calculateMergedSummary() for statistics
  - **Tests**: 18 unit tests

- [x] **T323** [US10] Create `src/heuristics/vision/multi-viewport-analyzer.ts`
  - MultiViewportVisionAnalyzer class
  - analyzeFullPage(screenshots, pageType, viewport) method
  - analyzeParallel() for concurrent API calls
  - analyzeSequential() for fallback
  - Integration with existing CROVisionAnalyzer
  - transformToInsights() for CROInsight compatibility
  - createMultiViewportVisionAnalyzer() factory function
  - **Tests**: 10 unit tests

- [x] **T324** [US10] Update `src/heuristics/vision/index.ts`
  - Export MultiViewportVisionAnalyzer
  - Export multi-viewport types
  - Export result-merger functions
  - Export DEFAULT_MULTI_VIEWPORT_CONFIG
  - **Tests**: 0 (exports only)

### Agent Integration (T325-T326)

- [x] **T325** [US10] Modify `src/agent/cro-agent.ts`
  - Add fullPageVision, visionMaxViewports, parallelVision to AnalyzeOptions
  - Capture screenshots at each scroll position using coverageTracker segments
  - Use MultiViewportVisionAnalyzer when fullPageVision enabled
  - Display multi-viewport progress and deduplication stats
  - Cost-optimized default: gpt-4o-mini for full-page mode
  - **Tests**: included in integration tests

- [x] **T326** [US10] Modify `src/cli.ts`
  - Add `--full-page-vision` flag
  - Add `--vision-max-viewports <N>` option (default: 10, max: 20)
  - Add `--no-parallel-vision` flag
  - Update help text with FULL-PAGE VISION OPTIONS section
  - Add examples for full-page vision usage
  - **Tests**: included in integration tests

### Tests (T327-T328)

- [x] **T327** [US10] Create `tests/unit/multi-viewport-analyzer.test.ts`
  - Test mergeViewportResults() deduplication
  - Test calculateTextSimilarity() Jaccard similarity
  - Test findBestEvaluation() highest confidence selection
  - Test getIssueEvaluations() filtering and sorting
  - Test groupByViewport() grouping
  - Test calculateMergedSummary() statistics
  - Test MultiViewportVisionAnalyzer configuration
  - Test createMultiViewportVisionAnalyzer() factory
  - **Tests**: 28 unit tests

- [x] **T328** [US10] Create `tests/integration/multi-viewport-vision.test.ts`
  - Test empty screenshots handling
  - Test result structure validation
  - Test configuration integration
  - Test deduplication across viewports
  - Test viewport tracking
  - Test error handling with invalid page type
  - Test performance metrics (timing, timestamps)
  - Test single vs multi-viewport analyzer compatibility
  - **Tests**: 15 integration tests

**Phase 21e Total**: 8 tasks, 43 tests - COMPLETE

---

## Phase 21f: Full-Page Screenshot Mode - COMPLETE

### Full-Page Screenshot Types (T329)

- [x] **T329** [US10] Modify `src/heuristics/vision/types.ts`
  - Add FullPageScreenshotConfig interface
  - Add FullPageScreenshotResult interface
  - Add DEFAULT_FULL_PAGE_SCREENSHOT_CONFIG constant
  - **Tests**: 0 (types only)

### Image Resizer (T330-T331)

- [x] **T330** [US10] Create `src/heuristics/vision/image-resizer.ts`
  - processFullPageScreenshot(buffer, config) function
  - Uses sharp for efficient image processing
  - Auto-resize if height > 16000px (GPT-4o limit)
  - Maintains aspect ratio when resizing
  - getImageDimensions() utility function
  - **Tests**: Unit tests planned

- [x] **T331** [US10] Update `src/heuristics/vision/index.ts`
  - Export FullPageScreenshotConfig, FullPageScreenshotResult types
  - Export DEFAULT_FULL_PAGE_SCREENSHOT_CONFIG
  - Export processFullPageScreenshot, getImageDimensions
  - **Tests**: 0 (exports only)

### CLI Integration (T332-T333)

- [x] **T332** [US10] Add sharp dependency to package.json
  - Add `"sharp": "^0.33.0"` to dependencies
  - **Tests**: 0 (dependency only)

- [x] **T333** [US10] Modify `src/cli.ts`
  - Add `--full-page-screenshot` flag parsing
  - Add processFullPageScreenshotMode() function
  - Capture full page with `page.screenshot({ fullPage: true })`
  - Process and resize with processFullPageScreenshot()
  - Analyze with existing CROVisionAnalyzer
  - Display detailed results
  - Update help text with examples
  - **Tests**: Manual verification

### Export Updates (T334)

- [x] **T334** [US10] Update `src/heuristics/index.ts`
  - Re-export FullPageScreenshotConfig, FullPageScreenshotResult types
  - Re-export DEFAULT_FULL_PAGE_SCREENSHOT_CONFIG
  - Re-export processFullPageScreenshot, getImageDimensions
  - **Tests**: 0 (exports only)

**Phase 21f Total**: 6 tasks - COMPLETE

---

## Phase 21g: Vision Agent Loop with DOM + Vision Context - COMPLETE

### Vision Agent Types (T335)

- [x] **T335** [US10] Create `src/agent/vision/types.ts`
  - VisionAgentState interface (snapshots, evaluatedIds, pendingIds)
  - ViewportSnapshot interface (dom + screenshot)
  - VisionAgentOptions interface
  - VisionToolContext, VisionToolResult types
  - **Tests**: 0 (types only)

### Vision Agent State Manager (T336-T337)

- [x] **T336** [US10] Create `src/agent/vision/vision-state-manager.ts`
  - VisionStateManager class
  - recordSnapshot(), addEvaluations(), markHeuristicsEvaluated()
  - shouldTerminate(), getTerminationReason()
  - getCoveragePercent(), getPendingHeuristics()
  - **Tests**: 15 unit tests

- [x] **T337** [US10] Create `tests/unit/vision-state-manager.test.ts`
  - Test state initialization with all heuristics pending
  - Test snapshot recording and coverage tracking
  - Test termination conditions
  - **Tests**: 35 unit tests

### Vision Agent Tools (T338-T342)

- [x] **T338** [US10] Create `src/agent/vision/tools/capture-viewport-tool.ts`
  - Captures PNG screenshot via page.screenshot()
  - Extracts DOM via DOMExtractor.extract()
  - Serializes DOM via DOMSerializer.serialize()
  - Returns ViewportSnapshot with both
  - **Tests**: 5 unit tests

- [x] **T339** [US10] Create `src/agent/vision/tools/scroll-page-tool.ts`
  - Reuse scroll logic from existing scroll tool
  - Return new scroll position
  - **Tests**: 3 unit tests

- [x] **T340** [US10] Create `src/agent/vision/tools/evaluate-batch-tool.ts`
  - Accept array of heuristic evaluations
  - Validate heuristic IDs are pending
  - Record evaluations in state
  - **Tests**: 8 unit tests

- [x] **T341** [US10] Create `src/agent/vision/tools/vision-done-tool.ts`
  - Require coverageConfirmation flag
  - Block if pending heuristics without explanation
  - **Tests**: 5 unit tests

- [x] **T342** [US10] Create `src/agent/vision/tools/create-vision-registry.ts`
  - Register all vision tools
  - createVisionToolRegistry() factory
  - **Tests**: 2 unit tests

### Vision Agent Prompt Builder (T343-T344)

- [x] **T343** [US10] Create `src/agent/vision/vision-prompt-builder.ts`
  - buildVisionAgentSystemPrompt() - expert instructions
  - buildVisionAgentUserPrompt() - DOM + heuristics + state
  - formatDOMContext() - serialized CRO elements
  - formatPendingHeuristics() - remaining to evaluate
  - **Tests**: 8 unit tests

- [x] **T344** [US10] Create `src/prompts/system-vision-agent.md`
  - Vision agent expert role
  - Cross-reference DOM + Vision instructions
  - Tool usage guidelines
  - **Tests**: 0 (prompt template)

### Vision Agent Message Manager (T345)

- [x] **T345** [US10] Create `src/agent/vision/vision-message-manager.ts`
  - Support messages with image content
  - buildUserMessageWithImage() for vision API
  - Token estimation for DOM + heuristics context
  - **Tests**: 5 unit tests

### Vision Agent Core (T346-T347)

- [x] **T346** [US10] Create `src/agent/vision/vision-agent.ts`
  - VisionAgent class with analyze(page, pageType) method
  - observe-reason-act loop
  - Integration with GPT-4o Vision API via LangChain
  - **Tests**: 10 unit tests (with mocked API)

- [x] **T347** [US10] Create `src/agent/vision/index.ts`
  - Export VisionAgent, types, tools
  - Export createVisionAgent factory
  - **Tests**: 0 (exports only)

### CLI Integration (T348-T349)

- [x] **T348** [US10] Modify `src/cli.ts`
  - Add `--vision-agent` flag parsing
  - Add `--vision-agent-max-steps` flag
  - Add processVisionAgentMode() function
  - Integrate with existing flags (--headless, --verbose)
  - **Tests**: Manual verification

- [x] **T349** [US10] Modify `src/agent/cro-agent.ts`
  - Add visionAgentMode, visionAgentMaxSteps to AnalyzeOptions
  - Add visionAgentResult to CROAnalysisResult
  - Integrate VisionAgent as Phase 21g vision analysis mode
  - **Tests**: Integration tests

### Tests (T350-T351)

- [x] **T350** [US10] Create `tests/unit/vision-agent.test.ts`
  - Test tool registry, prompt builder, message manager
  - Test tool execution (evaluate_batch, done)
  - Test termination conditions
  - Test state management integration
  - **Tests**: 35 unit tests

- [x] **T351** [US10] Create `tests/integration/vision-agent.test.ts`
  - Full flow with mock LLM responses
  - Test complete analysis lifecycle
  - Test DOM + Vision cross-referencing
  - Test state tracking through analysis
  - **Tests**: 21 integration tests

### Export Updates (T352)

- [x] **T352** [US10] Update `src/agent/index.ts`
  - Export VisionAgent, createVisionAgent
  - Export vision agent types
  - **Tests**: 0 (exports only)

**Phase 21g Total**: 18 tasks, 91 tests - COMPLETE ✅

---

## Phase 21h: Evidence Capture for Heuristic Evaluations - COMPLETE ✅

### Evidence Types (T353-T354) - COMPLETE ✅

- [x] **T353** [US10] [FR-302, FR-303, FR-304, FR-305, FR-306, FR-307, FR-308] Modify `src/heuristics/vision/types.ts`
  - Add DOMElementRef interface (index, selector, xpath, elementType, textContent)
  - Add BoundingBox interface (x, y, width, height, viewportIndex)
  - Extend HeuristicEvaluation with 5 evidence fields
  - **Tests**: 0 (types only)

- [x] **T354** [US10] [FR-309] Modify `src/agent/vision/types.ts`
  - Add elementIndices to BatchEvaluation
  - Add elementBoundingBoxes to ViewportSnapshot
  - **Tests**: 0 (types only)

### Evidence Capture (T355-T357) - COMPLETE ✅

- [x] **T355** [US10] [FR-309] Modify `src/agent/vision/tools/evaluate-batch-tool.ts`
  - Extend JSON schema to accept elementIndices array
  - Validate element indices are numbers
  - Return enriched BatchEvaluation with elementIndices
  - **Tests**: 5 unit tests

- [x] **T356** [US10] [FR-310, FR-311, FR-312, FR-313] Modify `src/agent/vision/vision-state-manager.ts`
  - Add viewportContext parameter to addEvaluations()
  - Attach viewportIndex, timestamp to each evaluation
  - Build domElementRefs from elementIndices + DOM tree
  - Look up boundingBox from elementBoundingBoxes map
  - **Tests**: 8 unit tests

- [x] **T357** [US10] [FR-310] Modify `src/agent/vision/vision-agent.ts`
  - Pass viewport context to state manager when recording evaluations
  - Track current viewport index during agent loop
  - **Tests**: 3 unit tests

### Bounding Box Extraction (T361b)

- [x] **T361b** [US10] [FR-314] Modify `src/agent/vision/tools/capture-viewport-tool.ts`
  - After DOM extraction, get bounding boxes via Playwright element.boundingBox()
  - Store element index → BoundingBox mapping in snapshot
  - Handle elements with no bounding box gracefully
  - **Tests**: 4 unit tests

### Screenshot Saving (T358-T359) - COMPLETE ✅

- [x] **T358** [US10] [FR-315] Create `src/output/screenshot-writer.ts`
  - ScreenshotWriteOptions interface (outputDir, prefix, format)
  - ScreenshotWriteResult interface (success, path, filename, error)
  - ScreenshotWriter class with saveScreenshot(), saveAllViewportScreenshots()
  - Convert base64 to PNG buffer using Node's Buffer.from()
  - Create directory if not exists
  - **Tests**: 6 unit tests

- [x] **T359** [US10] [FR-316, FR-317, FR-318] Modify `src/cli.ts`
  - Add --save-evidence flag parsing
  - Add --evidence-dir <path> option (default: ./evidence)
  - After analysis, save screenshots if flag is set
  - Update screenshotRef in evaluations with saved paths
  - **Tests**: 2 integration tests

### Output & Display (T360-T361)

- [x] **T360** [US10] [FR-319, FR-320, FR-321] Modify `src/output/agent-progress-formatter.ts`
  - Display viewportIndex for each evaluation
  - Display timestamp formatted as ISO string
  - Display screenshotRef when available
  - Display domElementRefs in structured format with selectors
  - Display boundingBox coordinates
  - **Tests**: 4 unit tests

- [x] **T361** [US10] [FR-309] Modify `src/agent/vision/vision-prompt-builder.ts`
  - Add instruction for LLM to return elementIndices array
  - Example: "Include elementIndices: [0, 3] for referenced elements"
  - **Tests**: 2 unit tests

### Tests (T362-T364)

- [x] **T362** [US10] Update `tests/unit/vision-state-manager.test.ts`
  - Test evidence fields are attached to evaluations
  - Test domElementRefs are built correctly
  - Test boundingBox lookup works
  - **Tests**: 5 unit tests

- [x] **T363** [US10] Update `tests/unit/vision-agent.test.ts` (evaluate-batch tool tests)
  - Test elementIndices are accepted and validated
  - Test invalid indices are handled
  - **Tests**: 4 unit tests

- [x] **T364** [US10] Update `tests/integration/vision-agent.test.ts`
  - Test end-to-end evidence capture flow
  - Test evidence field attachment through complete flow
  - Verify evidence serialization to JSON
  - **Tests**: 6 integration tests

### Export Updates (T365)

- [x] **T365** [US10] Update exports
  - `src/heuristics/vision/index.ts` - Export DOMElementRef, BoundingBox (verified)
  - `src/output/index.ts` - Export ScreenshotWriter (verified)
  - **Tests**: 0 (exports only)

### Evidence Export Gap Fix (T366) - COMPLETE ✅

- [x] **T366** [US10] [FR-319] Fix evidence export gap in CROInsight conversion
  - Extended Evidence interface in `src/models/cro-insight.ts` with Phase 21h fields:
    - viewportIndex, timestamp, domElementRefs, boundingBox
  - Added DOMElementRef and BoundingBox interfaces to cro-insight.ts
  - Added Zod schemas: DOMElementRefSchema, BoundingBoxSchema
  - Updated EvidenceSchema to validate new fields
  - Updated `evaluationToInsight()` in `src/heuristics/vision/analyzer.ts`:
    - Map viewportIndex, timestamp, domElementRefs, boundingBox to evidence
    - Update element field to include viewport info
  - Updated `evaluationToInsight()` in `src/heuristics/vision/multi-viewport-analyzer.ts`:
    - Same mapping for HeuristicEvaluationWithViewport
  - **Tests**: 13 new tests (7 EvidenceSchema + 6 evaluationToInsight mapping)
    - `tests/unit/models.test.ts` - Phase 21h evidence field validation (7 tests)
    - `tests/unit/vision-analyzer.test.ts` - Evidence field mapping tests (6 tests)

**Phase 21h Total**: 15 tasks, ~62 tests - COMPLETE ✅

---

## Phase 21i: DOM-Screenshot Coordinate Mapping - IN PROGRESS (11/17 tasks complete)

### Coordinate Mapper (T366-T368) - COMPLETE ✅

- [x] **T366** [US10] [FR-322, FR-323, FR-324, FR-325, FR-326] Create `src/browser/dom/coordinate-mapper.ts`
  - toScreenshotCoords(pageCoords, scrollY, viewportHeight) function
  - Calculate screenshotY = pageY - scrollY
  - Determine visibility based on viewport bounds (with visibilityRatio)
  - mapElementsToScreenshot(domTree, scrollY, viewport) function
  - filterVisibleElements(), getElementByIndex(), getElementsByIndices() helper functions
  - Return ElementMapping[] with both page and screenshot coords
  - **Tests**: 26 unit tests (tests/unit/coordinate-mapper.test.ts)

- [x] **T367** [US10] [FR-327] Create ElementMapping types in `src/browser/dom/coordinate-mapper.ts`
  - ScreenshotCoords interface (x, y, width, height, isVisible, visibilityRatio)
  - ElementMapping interface (index, xpath, text, croType, tagName, pageCoords, screenshotCoords)
  - **Tests**: 0 (types only)

- [x] **T368** [US10] Update `src/browser/dom/index.ts`
  - Export toScreenshotCoords, mapElementsToScreenshot, filterVisibleElements
  - Export getElementByIndex, getElementsByIndices
  - Export ScreenshotCoords, ElementMapping types
  - **Tests**: 0 (exports only)

### ViewportSnapshot Extension (T369-T370) - COMPLETE ✅

- [x] **T369** [US10] [FR-328, FR-329] Modify `src/agent/vision/types.ts`
  - Add elementMappings: ElementMapping[] to ViewportSnapshot
  - Add visibleElements: ElementMapping[] to ViewportSnapshot
  - Import ElementMapping from coordinate-mapper
  - Also updated `src/models/agent-state.ts` ViewportSnapshot for consistency
  - Also updated `src/models/index.ts` to re-export ElementMapping, ScreenshotCoords
  - **Tests**: 0 (types only)

- [x] **T370** [US10] [FR-340, FR-341, FR-342] Modify `src/agent/tools/cro/capture-viewport-tool.ts`
  - After DOM extraction, call mapElementsToScreenshot()
  - Filter to visibleElements using filterVisibleElements()
  - Store both elementMappings and visibleElements in ViewportSnapshot
  - Added viewport dimension capture (width, height, devicePixelRatio)
  - Updated logging to include visibleElements count
  - **Tests**: Covered by coordinate-mapper tests and existing tool tests

### Prompt Enhancement (T371-T372) - COMPLETE ✅

- [x] **T371** [US10] [FR-330, FR-331, FR-332] Modify `src/agent/vision/vision-prompt-builder.ts`
  - Added formatDOMContextWithCoords(visibleElements) function
  - Format: [index] <tag> "text" → (x, y, width×height)
  - Updated formatDOMContext() to use new format when visibleElements available
  - Text truncation (50 chars), coordinate rounding, visibility indicators
  - **Tests**: 10 unit tests (tests/unit/vision-prompt-builder.test.ts)

- [x] **T372** [US10] [FR-332] Update system prompt in `src/prompts/system-vision-agent.md`
  - Added <element_coordinates> section explaining coordinate format
  - Instructed LLM to include [index] and position when reporting issues
  - Added examples: "Element [5] at (120, 350) has low contrast..."
  - **Tests**: 0 (prompt template)

### Response Parser Enhancement (T373-T374) - COMPLETE ✅

- [x] **T373** [US10] [FR-333, FR-334, FR-335] Modify `src/heuristics/vision/response-parser.ts`
  - Added extractElementReferences(text) function using regex /\[(\d+)\]/g
  - Added parseEvaluationWithElements(evaluation) function
  - Added parseEvaluationsWithElements(evaluations) batch function
  - Extracts from observation, issue, recommendation fields
  - Returns sorted unique indices
  - **Tests**: 17 unit tests (tests/unit/response-parser.test.ts)

- [x] **T374** [US10] [FR-334] Modify `src/heuristics/vision/types.ts`
  - Added ParsedEvaluation interface extending HeuristicEvaluation
  - Added relatedElements: number[] field
  - **Tests**: 0 (types only)

### Element Mapping Integration (T375-T376) - COMPLETE ✅

- [x] **T375** [US10] [FR-335] Modify `src/agent/vision/vision-state-manager.ts`
  - Added elementMappings field to ViewportContext
  - Added getLatestElementMappings(), getElementMappingByIndex(), getElementsByIndices()
  - Added enrichEvaluationWithMappings() to add xpath, elementType, textContent
  - Added buildViewportContextFromLatest() helper
  - **Tests**: 9 unit tests (tests/unit/vision-state-manager.test.ts T41-T49)

- [x] **T376** [US10] [FR-335] Modify `src/agent/vision/tools/evaluate-batch-tool.ts`
  - Uses extractElementReferences() to parse element indices from text
  - Extracts from observation, issue, recommendation when elementIndices not provided
  - Automatically populates elementIndices from LLM text references
  - **Tests**: 10 unit tests (tests/unit/evaluate-batch-tool.test.ts)

### Screenshot Annotator (T377-T379) - COMPLETE ✅

- [x] **T377** [US10] [FR-336, FR-337, FR-338, FR-339] Create `src/output/screenshot-annotator.ts`
  - AnnotationOptions interface (highlightIssues, showElementIndexes, showCoordinates)
  - annotateScreenshot(screenshotBase64, visibleElements, evaluations, options) function
  - Use sharp to composite SVG overlay
  - Draw bounding boxes: red for failed, green for passed
  - Draw element index labels [5]
  - ScreenshotAnnotator class and createScreenshotAnnotator factory
  - **Tests**: 27 unit tests

- [x] **T378** [US10] Update `src/output/index.ts`
  - Export ScreenshotAnnotator, annotateScreenshot, createScreenshotAnnotator
  - Export AnnotationOptions, AnnotationResult, DEFAULT_ANNOTATION_OPTIONS types
  - **Tests**: 0 (exports only)

- [x] **T379** [US10] [CR-071] Modify `src/cli.ts`
  - Add --annotate-screenshots flag parsing
  - Integrate with --save-evidence (annotate before saving)
  - Update help text with EVIDENCE CAPTURE OPTIONS section
  - **Tests**: covered by integration tests

### Tests (T380-T382) - COMPLETE ✅

- [x] **T380** [US10] Create `tests/unit/coordinate-mapper.test.ts`
  - Test toScreenshotCoords() transformation
  - Test visibility detection (above, below, partial)
  - Test mapElementsToScreenshot() with mock DOM tree
  - Test edge cases (element at exact boundary)
  - **Tests**: 26 unit tests (ALREADY COMPLETE from T366)

- [x] **T381** [US10] Create `tests/unit/screenshot-annotator.test.ts`
  - Test bounding box drawing
  - Test color coding (red/green by status)
  - Test element index labels
  - Test SVG overlay composition
  - Test ScreenshotAnnotator class methods
  - Test createScreenshotAnnotator factory
  - **Tests**: 27 unit tests

- [x] **T382** [US10] Create `tests/integration/dom-screenshot-mapping.test.ts`
  - End-to-end DOM to screenshot mapping flow
  - Test prompt includes coordinates via formatDOMContextWithCoords()
  - Test element references parsed from mock response
  - Test annotated screenshot output with color coding
  - Complete flow integration tests
  - **Tests**: 19 integration tests

**Phase 21i Total**: 17 tasks, ~158 tests - COMPLETE ✅

---

## Phase 21 Summary

| Sub-Phase | Scope | Tasks | Tests | Status |
|-----------|-------|-------|-------|--------|
| 21a | PageType Detection | 8 | 35+ | COMPLETE ✅ |
| 21b | Knowledge Base | 14 | 25 | COMPLETE ✅ |
| 21c | Vision Analyzer | 7 | 44 | COMPLETE ✅ |
| 21d | Integration | 7 | 44+ | COMPLETE ✅ |
| 21e | Multi-Viewport Full-Page Vision | 8 | 43 | COMPLETE ✅ |
| 21f | Full-Page Screenshot Mode | 6 | - | COMPLETE ✅ |
| 21g | Vision Agent Loop (DOM + Vision) | 18 | 91 | COMPLETE ✅ |
| 21h | Evidence Capture | 14 | 49 | COMPLETE ✅ |
| 21i | DOM-Screenshot Mapping | 17 | 158 | COMPLETE ✅ |
| **Total** | | **99** | **489+** | **PHASE 21 COMPLETE** |

---

## Implementation Notes

1. **Knowledge Base First**: Implement 21b before 21c - analyzer depends on knowledge base
2. **Mock API for Tests**: Use mock GPT-4o responses for unit/integration tests
3. **E2E Tests Optional**: Real API calls only in E2E tests, skip if no API key
4. **Backward Compatibility**: DOM-based heuristics (H001-H010) continue to work
5. **Vision is Additive**: Vision insights added alongside existing DOM-based insights

---

## Checkpoint: After Phase 21

```bash
# All tests pass
npm test

# Vision analysis works
npm run start -- --vision https://www.peregrineclothing.co.uk/products/...

# Knowledge base loads
node -e "import('./dist/heuristics/knowledge/index.js').then(m => m.loadHeuristics('pdp').then(h => console.log(h.totalCount)))"
# Output: 35
```
