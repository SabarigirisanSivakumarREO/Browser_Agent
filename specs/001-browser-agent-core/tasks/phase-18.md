**Navigation**: [Index](./index.md) | [Previous](./phase-17.md) | [Next](./phase-19.md)

---

## Phase 18a: Models & Types (US9, US10) **[COMPLETE]**

**Purpose**: Define new models for heuristics, business type, and hypothesis generation

**Prerequisites**: Phase 17 (CRO Tools) complete

**Requirements**: FR-064 to FR-066

- [x] T104 [US9] Create src/models/business-type.ts ✅
  - Export: BusinessType enum (ecommerce, saas, banking, insurance, travel, media, other)
  - Export: BusinessTypeResult interface (type, confidence, signals)
  - Export: BusinessTypeSignals interface (urlPatterns, elementSelectors, keywords)
  - Export: BUSINESS_TYPE_SIGNALS constant with detection patterns
- [x] T105 [US10] Create src/models/hypothesis.ts ✅
  - Export: ExpectedImpact type ('low' | 'medium' | 'high')
  - Export: Hypothesis interface (id, title, hypothesis, control, treatment, metric, impact, priority, relatedInsights)
  - Export: HypothesisSchema (Zod validation)
- [x] T105a [US9] Update src/models/index.ts with Phase 18a exports ✅

**Checkpoint**: Models compile, Zod schema validates (SC-041, SC-042) ✅

---

## Phase 18b: Heuristic Engine Core (US9) **[COMPLETE]**

**Purpose**: Build heuristic rule engine and business type detection

**Prerequisites**: Phase 18a (Models) complete

**Requirements**: FR-067 to FR-071, SC-043 to SC-046

- [x] T106 [US9] Create src/heuristics/types.ts ✅
  - Export: HeuristicRule interface (id, name, description, category, severity, businessTypes, check function)
  - Export: HeuristicResult interface (insights, rulesExecuted, rulesPassed, rulesFailed, executionTimeMs)

- [x] T106a [US9] Create src/heuristics/heuristic-engine.ts (11 tests) ✅
  - HeuristicEngine class with register(), registerAll(), run(), getRule(), getAllRules(), clear()
  - Run filters rules by applicable businessTypes
  - Returns HeuristicResult with collected insights
  - Tests: register rule, duplicate throws, run all rules, filter by business type, empty rules, error handling

- [x] T106b [US9] Create src/heuristics/business-type-detector.ts (8 tests) ✅
  - BusinessTypeDetector class with detect(pageState) method
  - Checks URL patterns, element selectors, keywords from BUSINESS_TYPE_SIGNALS
  - Returns BusinessTypeResult with confidence score
  - Configurable confidence threshold (default 0.6, CR-019)
  - Tests: detect ecommerce, detect saas, low confidence returns 'other', URL matching, keyword matching, element matching, threshold config, signals captured

- [x] T106c [US9] Create src/heuristics/severity-scorer.ts (7 tests) ✅
  - SeverityScorer class with adjustSeverity(insights, businessType) method
  - Increases severity for business-critical issues (e.g., no cart for ecommerce)
  - Tests: ecommerce boost, saas boost, no change for other, severity cap at critical

- [x] T106d [US9] Create src/heuristics/index.ts - Module exports ✅

**Checkpoint**: ✅ Engine runs, business type detected on test pages (SC-043, SC-045)
- 26 new unit tests (11 engine + 8 detector + 7 scorer), 322 total tests passing
- Completed: 2025-12-09

---

## Phase 18c: Heuristic Rules (US9) **[COMPLETE]**

**Purpose**: Implement 10 heuristic rules (H001-H010) per FR-072 to FR-081

**Prerequisites**: Phase 18b (Engine Core) complete

**Requirements**: FR-072 to FR-081, SC-044 (20 tests)

Each rule has 2 tests: positive case (violation found), negative case (passes)

### CTA Rules (src/heuristics/rules/cta-rules.ts)

- [x] T107a [US9] Implement H001: vague_cta_text (2 tests) ✅
  - Severity: medium
  - Condition: CTA text matches generic patterns (Click Here, Learn More, Submit, etc.)
  - Tests: "Submit" button → insight, "Get Free Quote" → no insight

- [x] T107b [US9] Implement H002: no_cta_above_fold (2 tests) ✅
  - Severity: high
  - Condition: No CTA visible in initial viewport (boundingBox.y < viewport.height)
  - Tests: page with no CTA above fold → insight, page with CTA at top → no insight

### Form Rules (src/heuristics/rules/form-rules.ts)

- [x] T108a [US9] Implement H003: form_field_overload (2 tests) ✅
  - Severity: high
  - Condition: Form has >5 visible input fields
  - Tests: form with 7 fields → insight, form with 3 fields → no insight

- [x] T108b [US9] Implement H004: missing_field_label (2 tests) ✅
  - Severity: medium
  - Condition: Input without associated label, placeholder, or aria-label
  - Tests: input without label → insight, input with placeholder → no insight

### Trust Rules (src/heuristics/rules/trust-rules.ts)

- [x] T109a [US9] Implement H005: no_trust_above_fold (2 tests) ✅
  - Severity: medium
  - Condition: No trust signals (badges, reviews, testimonials) in initial viewport
  - Tests: page without trust above fold → insight, page with trust badge at top → no insight

- [x] T109b [US9] Implement H006: no_security_badge (2 tests) ✅
  - Severity: high
  - businessTypes: ['ecommerce', 'banking', 'insurance'] (only applies to these)
  - Condition: Checkout/payment page without SSL/security badge
  - Tests: checkout without badge → insight, checkout with badge → no insight

### Value Prop Rules (src/heuristics/rules/value-prop-rules.ts)

- [x] T110a [US9] Implement H007: unclear_value_prop (2 tests) ✅
  - Severity: high
  - Condition: Missing H1 or H1 matches generic patterns (Welcome, Home, Untitled)
  - Tests: page with "Welcome" H1 → insight, page with specific H1 → no insight

- [x] T110b [US9] Implement H008: headline_too_long (2 tests) ✅
  - Severity: low
  - Condition: H1 has >10 words
  - Tests: H1 with 15 words → insight, H1 with 6 words → no insight

### Navigation Rules (src/heuristics/rules/navigation-rules.ts)

- [x] T111a [US9] Implement H009: no_breadcrumbs (2 tests) ✅
  - Severity: low
  - Condition: Category/product page (detected by URL pattern) without breadcrumb navigation
  - Tests: /product/123 without breadcrumb → insight, /product/123 with breadcrumb → no insight

- [x] T111b [US9] Implement H010: no_search_ecommerce (2 tests) ✅
  - Severity: medium
  - businessTypes: ['ecommerce'] (only applies to ecommerce)
  - Condition: Ecommerce site without visible search input/button
  - Tests: ecommerce without search → insight, ecommerce with search → no insight

- [x] T111c [US9] Create src/heuristics/rules/index.ts ✅
  - Export: ctaRules, formRules, trustRules, valuePropRules, navigationRules arrays
  - Export: allRules combined array
  - Export: createHeuristicEngine() factory function that registers all 10 rules

**Checkpoint**: ✅ 10 rules pass 22 tests (SC-044, SC-012)
- 22 new unit tests, 344 total tests passing
- Completed: 2025-12-09

---

## Phase 18d: Output Generation (US10) **[COMPLETE]**

**Purpose**: Hypothesis generation, insight processing, and report generation

**Prerequisites**: Phase 18c (Heuristic Rules) complete

**Requirements**: FR-082 to FR-087, SC-047 to SC-050

- [x] T112 [US10] Create src/output/hypothesis-generator.ts (6 tests) ✅
  - HypothesisGenerator class with generate(insights) method
  - Configurable minSeverity (default 'high', CR-020)
  - Creates hypothesis in format: "If {recommendation}, then {metric} will improve because {issue}"
  - Maps insight category to primary metric (CTR, form completion, conversion rate, etc.)
  - Calculates priority from severity, estimated effort from category
  - Tests: generate from high insight, skip low insight, priority sorting, hypothesis format, empty insights, metric mapping

- [x] T113 [US10] Create src/output/insight-deduplicator.ts (4 tests) ✅
  - InsightDeduplicator class with deduplicate(insights) method
  - Removes duplicates based on type + element combination
  - Keeps first occurrence, merges evidence if different
  - Tests: remove exact duplicate, keep different elements, keep different types, merge evidence

- [x] T114 [US10] Create src/output/insight-prioritizer.ts (3 tests) ✅
  - InsightPrioritizer class with prioritize(insights, businessType) method
  - Sorts by severity (critical > high > medium > low)
  - Boosts business-relevant insights (e.g., cart issues for ecommerce)
  - Tests: severity sorting, business type boost, stable sort for same severity

- [x] T115 [US10] Create src/output/markdown-reporter.ts (4 tests) ✅
  - MarkdownReporter class with generate(result) method
  - Sections: Header, Executive Summary, Critical Issues, High Priority, Medium Priority, Low Priority, Recommended Tests, Footer
  - Tests: all sections present, empty insights handled, hypotheses formatted, scores displayed

- [x] T116 [US10] Create src/output/json-exporter.ts (3 tests) ✅
  - JSONExporter class with export(result) method
  - Outputs full CROAnalysisResult as formatted JSON
  - Includes all fields: insights, heuristicInsights, businessType, hypotheses, scores
  - Tests: valid JSON output, all fields present, parseable result

- [x] T116a [US10] Update src/output/index.ts with Phase 18d exports ✅

**Checkpoint**: ✅ Hypotheses generated for high/critical issues (SC-047), reports include all sections (SC-049)
- 21 new unit tests, 365 total unit tests passing
- Completed: 2025-12-09

---

## Phase 18e: Agent Integration (US9, US10) **[COMPLETE]**

**Purpose**: Integrate post-processing pipeline into CROAgent

**Prerequisites**: Phase 18d (Output Generation) complete

**Requirements**: FR-088 to FR-092, SC-051 to SC-053

- [x] T117 [US9] Update src/agent/cro-agent.ts with post-processing pipeline ✅
  - Add post-processing after agent loop completes:
    1. Detect business type (BusinessTypeDetector)
    2. Run heuristics (HeuristicEngine with all 10 rules)
    3. Combine tool + heuristic insights
    4. Deduplicate (InsightDeduplicator)
    5. Prioritize (InsightPrioritizer)
    6. Generate hypotheses (HypothesisGenerator)
    7. Calculate scores (overall, byCategory, counts)
    8. Generate reports if requested
  - Add AnalyzeOptions.outputFormat field

- [x] T117a [US9] Update CROAnalysisResult interface ✅
  - Add: businessType?: BusinessTypeResult
  - Add: heuristicInsights: CROInsight[]
  - Add: hypotheses: Hypothesis[]
  - Add: scores: CROScores
  - Add: report?: { markdown?: string; json?: string }

- [x] T117b [US9] Create src/agent/score-calculator.ts ✅
  - calculateScores(insights) method
  - Returns: overall (0-100), byCategory, criticalCount, highCount, mediumCount, lowCount
  - Overall score: 100 - (critical*25 + high*15 + medium*5 + low*2), min 0

- [x] T118 [US10] Create tests/integration/post-processing.test.ts (21 tests) ✅
  - Test full pipeline with mock page state
  - Tests: business type detection, heuristics execution, deduplication, prioritization, hypothesis generation, score calculation, markdown report, json export, empty insights, high volume insights, end-to-end pipeline

**Checkpoint**: ✅ Pipeline executes in sequence (SC-051), result has all fields (SC-052)
- 21 integration tests passing, 468 total tests passing
- Completed: 2025-12-09

---

## Phase 18f: Test Fixtures (US9) **[COMPLETE]**

**Purpose**: Create test fixtures for accurate heuristic and business type testing

**Prerequisites**: None (can run in parallel with Phase 18b)

- [x] T118a [US9] Create tests/fixtures/test-pages/ ✅
  - ecommerce-good.html (passes all heuristics)
  - ecommerce-bad.html (fails multiple heuristics)
  - saas-landing.html (SaaS patterns)
  - form-heavy.html (form field overload test)
  - no-cta.html (missing CTA above fold)

- [x] T118b [US9] Create tests/fixtures/expected-results.json ✅
  - Expected business type for each test page
  - Expected heuristic failures for each test page
  - Used for accuracy measurement (SC-013, SC-045)

**Checkpoint**: ✅ Test fixtures available for integration tests

**Completed**: 2025-12-09

---

## Phase 18-CLI: CLI Integration - Final (US6, US10) **[COMPLETE]**

**Purpose**: Complete CLI with reports and default CRO mode

**Prerequisites**: Phase 18e (Agent Integration) complete

**Requirements**: FR-093 to FR-097, SC-054 to SC-057

- [x] T119 [US6] Update src/cli.ts - make --analyze the default mode (4 tests) ✅
  - Remove --cro-extract (now default behavior)
  - Add --legacy flag for old heading extraction mode
  - Add --output-format (console|markdown|json) - default: console
  - Add --output-file <path> - write report to file
  - Add progress output for post-processing stages
  - Tests: default mode runs CRO, legacy mode works, output format respected, file written

- [x] T119a [US6] Create src/output/file-writer.ts (2 tests) ✅
  - FileWriter class with write(content, path) method
  - Creates directory if missing
  - Handles existing file (overwrite with warning)
  - Returns success/error result
  - Tests: write to new file, write to existing path

- [x] T120 [US6] Update src/index.ts to export CROAgent as primary ✅
  - Export CROAgent as default export
  - Export BrowserAgent as legacy
  - Export all Phase 18 types

- [x] T121 [US6] Create tests/e2e/cro-full-workflow.test.ts (4 tests) ✅
  - Real browser + mock LLM (or limited real LLM)
  - Tests: full analysis with report, markdown output, json output, file writing

- [x] T122 [US6] Update documentation ✅
  - Update quickstart.md with new CLI usage
  - Update README.md (if exists) with CRO agent examples
  - Document all CLI flags

**Checkpoint**: `npm run start -- https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy` runs full CRO analysis (SC-054) ✅

**Final test**: `npm run start -- https://www.carwale.com/ --output-format markdown --output-file report.md`

---

## Post-Implementation Enhancements **[COMPLETE]**

- [x] T123 Model upgrade: GPT-4o-mini → GPT-4 ✅
  - Updated src/agent/cro-agent.ts
  - Updated src/types/index.ts
  - More capable model for better CRO analysis

- [x] T124 Add skipHeuristics option to AnalyzeOptions ✅
  - Allows skipping only heuristic rules (Phase 18b-c) while keeping other post-processing
  - Use case: When you only want LLM-driven insights, not rule-based
  - Usage: `agent.analyze(url, { skipHeuristics: true })`

- [x] T125 Add phase-by-phase demo logging ✅
  - Console output showing each phase's inputs/outputs
  - Useful for demos and understanding data flow
  - Shows: Phase 3 (Browser) → Phase 14 (DOM) → Phase 15 (Tools) → Phase 16 (Agent) → Phase 17 (Execution) → Phase 18 (Post-Processing)

**Updated**: 2025-12-10

---
