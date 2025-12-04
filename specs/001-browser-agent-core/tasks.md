# Tasks: Browser Agent Core

**Input**: Design documents from `/specs/001-browser-agent-core/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md (required)

**Tests**: Integration and E2E tests included as specified in SC-006.

**Organization**: Tasks grouped by user story for independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and TypeScript configuration

- [x] T001 Initialize npm project with package.json (name: browser-agent, type: module)
- [x] T002 Install production dependencies: playwright, langchain, @langchain/openai, zod, dotenv, @playwright/browser-chromium
- [x] T003 [P] Install dev dependencies: typescript, @types/node, vitest, @playwright/test, eslint, prettier, tsx, @typescript-eslint/parser
- [x] T004 [P] Create tsconfig.json with strict mode enabled per constitution
- [x] T005 [P] Create .eslintrc.json with TypeScript plugin configuration
- [x] T006 [P] Create .prettierrc with formatting rules
- [x] T007 Install Playwright Chromium browser via `npx playwright install chromium`
- [x] T008 Create src/types/index.ts with all interfaces from data-model.md

**Checkpoint**: Project compiles with `tsc --noEmit`, linting passes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities that ALL modules depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T009 Create src/utils/logger.ts with structured JSON logging (debug, info, warn, error levels)
- [x] T010 [P] Create src/utils/validator.ts with URL validation function returning ValidationResult
- [x] T011 [P] Create src/utils/index.ts exporting logger and validator

**Checkpoint**: Utilities importable, logger outputs JSON, validator handles valid/invalid URLs

---

## Phase 3: User Story 1 - URL Navigation and Page Loading (Priority: P1)

**Goal**: Load URLs via Playwright and return page title/status

**Independent Test**: Verify example.com loads successfully with title

### Tests for User Story 1

- [x] T012 [P] [US1] Create tests/unit/validator.test.ts with URL validation tests
- [x] T013 [P] [US1] Create tests/integration/browser.test.ts with page load tests

### Implementation for User Story 1

- [x] T014 [US1] Create src/browser/browser-manager.ts with BrowserManager class
  - launch(): Promise<void> - launches Chromium in visible mode
  - getContext(): BrowserContext
  - getPage(): Page
  - close(): Promise<void> - cleanup resources
- [x] T015 [US1] Create src/browser/page-loader.ts with PageLoader class
  - constructor(page: Page, config: { timeout: number })
  - load(url: string): Promise<PageLoadResult>
  - Implement 60s timeout, network idle wait
  - Handle timeout errors with clear messages
- [x] T016 [US1] Create src/browser/index.ts exporting BrowserManager and PageLoader

**Checkpoint**: Can load https://example.com and get title "Example Domain"

---

## Phase 4: User Story 2 - Heading Extraction (Priority: P2)

**Goal**: Extract h1-h6 elements with level and text from loaded pages

**Independent Test**: Load page with known headings, verify all captured

### Tests for User Story 2

- [x] T017 [P] [US2] Create tests/unit/heading-extractor.test.ts with extraction tests
  - Test extraction from HTML string with known headings
  - Test empty page returns empty array
  - Test document order preservation

### Implementation for User Story 2

- [x] T018 [US2] Create src/extraction/heading-extractor.ts with HeadingExtractor class
  - extract(page: Page): Promise<ExtractionResult>
  - Use Playwright locator('h1, h2, h3, h4, h5, h6')
  - Extract text content, determine level from tag name
  - Build countByLevel summary
  - Decode HTML entities, trim whitespace
- [x] T019 [US2] Create src/extraction/index.ts exporting HeadingExtractor

**Checkpoint**: Extract headings from example.com, returns { level: 1, text: "Example Domain", index: 0 }

---

## Phase 5: User Story 3 - LangChain Processing (Priority: P3)

**Goal**: Process headings through GPT-4o-mini for insights and categorization

**Independent Test**: Pass mock headings to processor, verify structured response

### Tests for User Story 3

- [x] T020 [P] [US3] Create tests/integration/langchain.test.ts with processing tests
  - Test with sample headings array
  - Test empty headings returns appropriate message
  - Requires OPENAI_API_KEY environment variable

### Implementation for User Story 3

- [x] T021 [US3] Create src/langchain/processor.ts with LangChainProcessor class
  - constructor(config: ProcessingConfig)
  - analyze(extraction: ExtractionResult): Promise<ProcessingResult>
  - Use ChatOpenAI with gpt-4o-mini model
  - Create prompt for heading analysis (count summary, categorization, insights)
  - Parse structured response using Zod schema
  - Handle API errors gracefully with fallback
- [x] T022 [US3] Create src/langchain/index.ts exporting LangChainProcessor

**Checkpoint**: Process sample headings, returns summary with categories and insights

---

## Phase 6: User Story 4 - Console Output and Results (Priority: P4)

**Goal**: Format and display results in readable console output

**Independent Test**: Pass mock AgentResult, verify formatted output

### Tests for User Story 4

- [x] T023 [P] [US4] Create tests/unit/formatter.test.ts with formatting tests
  - Test success result formatting
  - Test error result formatting
  - Test multi-URL batch formatting

### Implementation for User Story 4

- [x] T024 [US4] Create src/output/formatter.ts with ResultFormatter class
  - formatResult(result: AgentResult): string
  - formatBatch(batch: BatchResult): string
  - formatError(error: string, stage: string): string
  - Include URL, status, heading counts, extracted headings, LangChain insights
  - Use box-drawing characters for visual structure
- [x] T025 [US4] Create src/output/index.ts exporting ResultFormatter

**Checkpoint**: Mock result produces readable console output with all sections

---

## Phase 7: Orchestrator and CLI

**Purpose**: Main entry point coordinating all modules

- [x] T026 Create src/index.ts with BrowserAgent class
  - constructor(config?: Partial<AgentConfig>)
  - validateEnvironment(): void - check OPENAI_API_KEY, fail fast if missing
  - processUrl(url: string): Promise<AgentResult>
  - processBatch(urls: string[]): Promise<BatchResult>
  - close(): Promise<void>
  - Orchestrate: validate → load → extract → process → format → output
  - Track timing for each stage
  - Handle errors at each stage with appropriate errorStage
- [x] T027 Create src/cli.ts with CLI argument parsing
  - Parse URLs from command line arguments
  - Support --headless, --timeout, --verbose flags
  - Display formatted results to console
- [x] T028 Update package.json with scripts
  - "start": "node --loader ts-node/esm src/cli.ts"
  - "build": "tsc"
  - "test": "vitest"
  - "test:unit": "vitest run tests/unit"
  - "test:integration": "vitest run tests/integration"
  - "test:e2e": "vitest run tests/e2e"
  - "lint": "eslint src tests"
  - "format": "prettier --write src tests"

**Checkpoint**: `npm run start -- https://example.com` produces full output

---

## Phase 8: End-to-End Tests

**Purpose**: Verify complete workflow with multiple URLs per SC-006

- [x] T029 Create tests/e2e/workflow.test.ts with 5-URL test
  - Test real CRO agency websites
  - Verify each result has correct success/failure status
  - Verify batch processing works with all 5 URLs
  - Verify console output is parseable

**Checkpoint**: All 5 URLs process correctly, errors handled gracefully

---

## Phase 9: Polish & Documentation

**Purpose**: Final quality improvements

- [x] T030 [P] Add JSDoc comments to all public APIs per constitution VIII
- [x] T031 [P] Create .env.example with OPENAI_API_KEY placeholder
- [x] T032 [P] Create .gitignore with node_modules, dist, .env, coverage
- [x] T033 Run full test suite, fix any failures
- [x] T034 Run linting and fix any warnings
- [x] T035 Verify quickstart.md examples work correctly

**Checkpoint**: All tests pass, linting clean, documentation accurate

---

## Phase 10: Bug Fixes & Improvements (Post-Implementation)

**Purpose**: Runtime issues discovered during testing

- [x] T036 Add `@playwright/browser-chromium` to package.json dependencies
- [x] T037 Add `ignoreHTTPSErrors: true` to browser context in browser-manager.ts
- [x] T038 Add dotenv config import to vitest.config.ts
- [x] T039 Update e2e test URLs to use real CRO agency websites

**Checkpoint**: All e2e tests pass, application works with real websites

---

## Phase 11: Wait Strategy & Dynamic Content (Post-Implementation)

**Purpose**: Fix timeout issues and improve dynamic content extraction

- [x] T040 Change default wait strategy from `networkidle` to `load`
- [x] T041 Add `--wait-until` CLI flag for user override
- [x] T042 Implement hybrid wait strategy in PageLoader
- [x] T043 Add `--post-load-wait` CLI flag for JS rendering wait
- [x] T044 Add `postLoadWait` to BrowserConfig type and defaults

**Checkpoint**: Dynamic content sites extract all headings correctly

---

## Phase 12: Cookie Consent Handling (User Story 5)

**Purpose**: Auto-dismiss cookie consent popups before extraction

- [x] T045 [US5] Add `dismissCookieConsent` to BrowserConfig in src/types/index.ts
- [x] T046 [US5] Add `--no-cookie-dismiss` CLI flag to src/cli.ts
- [x] T047 [US5] Create src/browser/cookie-patterns.ts with CMP selector patterns
- [x] T048 [US5] Create src/browser/cookie-handler.ts with CookieConsentHandler class
- [x] T049 [US5] Update src/browser/index.ts to export CookieConsentHandler
- [x] T050 [US5] Integrate CookieConsentHandler into PageLoader
- [x] T051 [US5] Wire `dismissCookieConsent` config through BrowserAgent to PageLoader
- [x] T052 [P] [US5] Create tests/integration/cookie-handler.test.ts
- [x] T053 [US5] Update e2e tests to verify cookie popups don't block extraction

**Checkpoint**: Sites with cookie popups have them dismissed before extraction

---

## Phase 13a: Core Models (US6, US7)

**Purpose**: Define foundational TypeScript interfaces for CRO Agent

- [x] T054 [US6] Create src/models/dom-tree.ts
  - Export: BoundingBox, CROType, CROClassification, DOMNode, DOMTree
- [x] T055 [US6] Create src/models/page-state.ts
  - Export: ViewportInfo, ScrollPosition, PageState
- [x] T056 [US7] Create src/models/cro-insight.ts
  - Export: Severity, Evidence, InsightCategory, CROInsight, CROInsightSchema (Zod)
- [x] T060 [US6] Create src/models/tool-definition.ts
  - Export: ToolResult, ToolDefinition, CROActionNames, CROActionName
- [x] T063a [US6] Create src/models/index.ts with all Phase 13a exports
- [x] T064a [P] [US6] Create tests/unit/models.test.ts (24 tests)

**Checkpoint**: All models compile, Zod schemas validate correctly

---

## Phase 13b: Agent Models (US6, US7)

**Purpose**: Agent state, memory, and output parsing

- [x] T057 [US6] Create src/models/agent-output.ts
  - Export: CROAgentOutputSchema, CROAgentOutput, ParseResult, parseAgentOutput()
- [x] T058 [US6] Create src/models/agent-state.ts
  - Export: CROAgentOptions, DEFAULT_CRO_OPTIONS, AgentState, createInitialState()
- [x] T059 [US6] Create src/models/cro-memory.ts
  - Export: StepRecord, CROMemory, createInitialMemory()
- [x] T063b [US6] Update src/models/index.ts with Phase 13b exports
- [x] T064b [P] [US6] Create tests/unit/agent-models.test.ts (33 tests)

**Checkpoint**: Agent models compile, parser handles valid/invalid JSON

---

## Phase 14: DOM Extraction Pipeline (US6)

**Purpose**: Build DOM extraction with CRO classification

- [x] T065 [US6] Create src/browser/dom/cro-selectors.ts
  - Export: CRO_SELECTORS, INTERACTIVE_TAGS, INTERACTIVE_ROLES, SKIP_TAGS, MAX_TEXT_LENGTH
- [x] T066 [US6] Create src/browser/dom/build-dom-tree.ts
  - Export: RawDOMNode, RawDOMTree, generateDOMTreeScript, DOM_TREE_SCRIPT
  - Injectable script with XPath, visibility, interactivity, CRO classification
- [x] T067 [US6] Create src/browser/dom/extractor.ts
  - Export: DOMExtractor, DOMExtractorOptions
  - extract(page): Promise<DOMTree>
- [x] T068 [US6] Create src/browser/dom/serializer.ts
  - Export: DOMSerializer, DOMSerializerOptions, SerializationResult
  - Token budget tracking with 60% warning (CR-013)
- [x] T069 [US6] Create src/browser/dom/index.ts with all Phase 14 exports
- [x] T070 [P] [US6] Create tests/unit/dom-extraction.test.ts (35 tests)
- [x] T071 [US6] Create tests/integration/dom-extraction.test.ts (14 tests)

**Checkpoint**: DOM extraction captures >90% visible interactive elements (SC-008)

---

## Phase 14b: CLI Integration - DOM Extraction (US6) **[COMPLETE]**

**Purpose**: Wire DOM extraction into CLI for immediate testing

- [x] T072a [US6] Create src/output/cro-element-formatter.ts
  - formatCROElements(domTree: DOMTree): string
  - Group by CRO type (CTAs, forms, trust, value_prop, navigation)
  - Show element count, text preview, xpath
- [x] T072b [US6] Update src/cli.ts with --cro-extract flag
  - When flag present: run DOMExtractor instead of HeadingExtractor
  - Output CRO elements via new formatter
- [x] T072c [US6] Test DOM extraction on real sites via CLI

**Checkpoint**: `npm run start -- --cro-extract https://carwale.com` shows CRO elements ✅

**Test command**: `npm run start -- --cro-extract https://www.carwale.com/`

---

## Phase 15: Tool System (US6)

**Purpose**: Tool registry and execution framework

- [ ] T073 [US6] Create src/agent/tools/base-tool.ts - BaseTool abstract class
- [ ] T074 [US6] Create src/agent/tools/tool-registry.ts - ToolRegistry class
- [ ] T075 [US6] Create src/agent/tools/tool-executor.ts - ToolExecutor class
- [ ] T076 [US6] Create src/agent/tools/index.ts - Module exports
- [ ] T077 [P] [US6] Create tests/unit/tool-system.test.ts

**Checkpoint**: Tool registry accepts and executes tool definitions

---

## Phase 15b: CLI Integration - Tool Execution (US6) **[NEW - INCREMENTAL]**

**Purpose**: Allow manual tool execution via CLI for testing

- [ ] T077a [US6] Update src/cli.ts with --tool flag
  - `--tool analyze_ctas` executes specific tool on page
  - Outputs tool result (insights, extracted data)
- [ ] T077b [US6] Create src/output/tool-result-formatter.ts
  - formatToolResult(result: ToolResult): string

**Checkpoint**: `npm run start -- --cro-extract --tool analyze_ctas https://carwale.com`

---

## Phase 16: Agent Core (US6)

**Purpose**: Main CRO agent orchestration

- [ ] T078 [US6] Create src/agent/prompt-builder.ts - System prompt construction
- [ ] T079 [US6] Create src/agent/message-manager.ts - Conversation history
- [ ] T080 [US6] Create src/agent/state-manager.ts - Agent state transitions
- [ ] T081 [US6] Create src/agent/cro-agent.ts - Main CROAgent class
- [ ] T082 [US6] Create src/agent/index.ts - Module exports
- [ ] T083 [P] [US6] Create tests/unit/prompt-builder.test.ts
- [ ] T084 [P] [US6] Create tests/unit/message-manager.test.ts
- [ ] T085 [P] [US6] Create tests/unit/state-manager.test.ts
- [ ] T086 [US6] Create tests/integration/cro-agent.test.ts
- [ ] T087 [US6] Create tests/e2e/cro-agent-workflow.test.ts

**Checkpoint**: Agent completes analysis loop with mock LLM

---

## Phase 16b: CLI Integration - Agent Loop (US6) **[NEW - INCREMENTAL]**

**Purpose**: Run CRO agent analysis via CLI

- [ ] T087a [US6] Update src/cli.ts with --analyze flag (replaces --cro-extract)
  - Runs full CROAgent.analyze() loop
  - `--max-steps N` limits iterations (default: 10)
- [ ] T087b [US6] Create src/output/agent-progress-formatter.ts
  - Real-time step output during analysis
  - Shows: step number, action taken, insights found

**Checkpoint**: `npm run start -- --analyze --max-steps 5 https://carwale.com`

---

## Phase 17: CRO Tools (US7)

**Purpose**: Implement CRO-specific analysis tools

- [ ] T088 [US7] Create src/agent/tools/scroll-tool.ts
- [ ] T089 [US7] Create src/agent/tools/click-tool.ts
- [ ] T090 [US7] Create src/agent/tools/analyze-cta-tool.ts
- [ ] T091 [US7] Create src/agent/tools/analyze-form-tool.ts
- [ ] T092 [US7] Create src/agent/tools/analyze-trust-tool.ts
- [ ] T093 [US7] Create src/agent/tools/analyze-value-prop-tool.ts
- [ ] T094 [US7] Create src/agent/tools/record-insight-tool.ts
- [ ] T095 [US7] Create src/agent/tools/done-tool.ts
- [ ] T096 [P] [US7] Create tests/unit/cro-tools.test.ts
- [ ] T097 [US7] Create tests/integration/cro-tools.test.ts

**Checkpoint**: All CRO tools execute and return valid ToolResult

---

## Phase 18: Heuristics & Output (US7, US8)

**Purpose**: Heuristic analysis and report generation

- [ ] T061 [US7] Create src/heuristics/index.ts - Heuristic engine exports
- [ ] T062a [P] [US7] Create tests/unit/heuristics.test.ts
- [ ] T098 [US7] Create src/heuristics/cta-heuristics.ts
- [ ] T099 [US7] Create src/heuristics/form-heuristics.ts
- [ ] T100 [US7] Create src/heuristics/trust-heuristics.ts
- [ ] T101 [US7] Create src/heuristics/value-prop-heuristics.ts
- [ ] T102 [US7] Create src/heuristics/heuristic-runner.ts
- [ ] T103 [US8] Create src/output/insight-formatter.ts
- [ ] T104 [US8] Create src/output/report-generator.ts
- [ ] T105 [US8] Create src/output/json-exporter.ts
- [ ] T106 [US8] Update src/output/index.ts with new exports
- [ ] T107 [P] [US8] Create tests/unit/report-generator.test.ts
- [ ] T108 [US8] Create tests/integration/output.test.ts

**Checkpoint**: Heuristics engine produces categorized insights

---

## Phase 18b: CLI Integration - Final (US6, US8) **[NEW - INCREMENTAL]**

**Purpose**: Complete CLI with reports and default CRO mode

- [ ] T109 [US6] Update src/cli.ts - make --analyze the default mode
  - Remove --cro-extract (now default behavior)
  - Add --legacy flag for old heading extraction
  - Add --output-format (json|markdown|console)
  - Add --output-file path
- [ ] T110 [US6] Update src/index.ts to export CROAgent as primary
- [ ] T111 [US6] Create tests/e2e/cro-full-workflow.test.ts
- [ ] T112 [US6] Update documentation for CRO agent usage

**Checkpoint**: `npm run start -- https://carwale.com` runs full CRO analysis

**Final test**: `npm run start -- https://www.carwale.com/ --output-format markdown`

---

## Task Summary

| Phase | Tasks | Count | Purpose | Status |
|-------|-------|-------|---------|--------|
| 1 | T001-T008 | 8 | Project setup | ✅ Complete |
| 2 | T009-T011 | 3 | Utilities | ✅ Complete |
| 3 | T012-T016 | 5 | URL loading (US1) | ✅ Complete |
| 4 | T017-T019 | 3 | Extraction (US2) | ✅ Complete |
| 5 | T020-T022 | 3 | LangChain (US3) | ✅ Complete |
| 6 | T023-T025 | 3 | Output (US4) | ✅ Complete |
| 7 | T026-T028 | 3 | Orchestrator | ✅ Complete |
| 8 | T029 | 1 | E2E tests | ✅ Complete |
| 9 | T030-T035 | 6 | Polish | ✅ Complete |
| 10 | T036-T039 | 4 | Bug fixes | ✅ Complete |
| 11 | T040-T044 | 5 | Wait strategy | ✅ Complete |
| 12 | T045-T053 | 9 | Cookie consent (US5) | ✅ Complete |
| 13a | T054-T056, T060, T063a, T064a | 6 | Core models | ✅ Complete |
| 13b | T057-T059, T063b, T064b | 5 | Agent models | ✅ Complete |
| 14 | T065-T071 | 7 | DOM extraction | ✅ Complete |
| 14b | T072a-T072c | 3 | CLI: DOM extraction | ✅ Complete |
| **15** | T073-T077 | 5 | **Tool system** | ⏳ **NEXT** |
| 15b | T077a-T077b | 2 | CLI: Tool execution | ⏳ Pending |
| 16 | T078-T087 | 10 | Agent core | ⏳ Pending |
| 16b | T087a-T087b | 2 | CLI: Agent loop | ⏳ Pending |
| 17 | T088-T097 | 10 | CRO tools | ⏳ Pending |
| 18 | T061-T062a, T098-T108 | 14 | Heuristics & output | ⏳ Pending |
| 18b | T109-T112 | 4 | CLI: Final integration | ⏳ Pending |

**Total**: 120 tasks (74 complete, 46 pending)

**Incremental CLI Milestones**:
- Phase 14b: `npm run start -- --cro-extract <url>` → Show CRO elements
- Phase 15b: `npm run start -- --cro-extract --tool <name> <url>` → Run specific tool
- Phase 16b: `npm run start -- --analyze <url>` → Full agent loop
- Phase 18b: `npm run start -- <url>` → CRO analysis as default
