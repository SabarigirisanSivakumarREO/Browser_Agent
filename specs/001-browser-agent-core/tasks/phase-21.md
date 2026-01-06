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

## Phase 21 Summary

| Sub-Phase | Scope | Tasks | Tests | Status |
|-----------|-------|-------|-------|--------|
| 21a | PageType Detection | 8 | 35+ | COMPLETE ✅ |
| 21b | Knowledge Base | 14 | 25 | COMPLETE ✅ |
| 21c | Vision Analyzer | 7 | 44 | COMPLETE ✅ |
| 21d | Integration | 7 | 44+ | COMPLETE ✅ |
| **Total** | | **36** | **148+** | **COMPLETE** ✅ |

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
