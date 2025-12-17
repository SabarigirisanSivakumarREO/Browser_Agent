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

**Checkpoint**: Can load https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711 and get title "Example Domain"

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
  - Use ChatOpenAI with gpt-4o model
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

**Checkpoint**: `npm run start -- https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711` produces full output

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

## Phase 15: Tool System (US6) ✅

**Purpose**: Tool registry and execution framework for CRO analysis

**Design**: Interface-based tools. ToolExecutor owns validation, timing, error handling. See plan.md Section 8.

**Requirements**: FR-031 to FR-038, CR-016, CR-017, SC-016 to SC-018

- [x] T073 [US6] Create src/agent/tools/types.ts
  - ToolContext, Tool, ToolDefinitionForLLM interfaces
  - Re-export ToolResult from models
- [x] T074 [US6] Create src/agent/tools/tool-registry.ts
  - ToolRegistry class with register, get, has, getAll, getToolDefinitions, clear
  - Uses native Zod v4 `z.toJSONSchema()` for LLM definitions
- [x] T075 [US6] Create src/agent/tools/tool-executor.ts
  - ToolExecutor class with execute method
  - Validates params, tracks timing, handles errors
- [x] T076 [US6] Create src/agent/tools/index.ts - Module exports
- [x] T077 [US6] Create tests/unit/tool-system.test.ts (20 tests)

**Checkpoint**: ✅ COMPLETE (2025-12-05)
- 131 unit tests passing (20 new tool system tests)
- Uses native Zod v4 `z.toJSONSchema()` (no external package needed)

---

## Phase 15b: CLI Integration - Tool Execution (US6) ✅

**Purpose**: Allow manual tool execution via CLI for testing

- [x] T077a [US6] Update src/cli.ts with --tool flag
  - `--tool analyze_ctas` executes specific tool on page
  - Outputs tool result (insights, extracted data)
- [x] T077b [US6] Create src/output/tool-result-formatter.ts
  - formatToolResult(result: ToolResult): string
- [x] T077c [US6] Create src/agent/tools/cro/analyze-ctas.ts (sample tool)
- [x] T077d [US6] Create src/agent/tools/create-cro-registry.ts (factory)
- [x] T077e [US6] Add 5 unit tests for ToolResultFormatter

**Checkpoint**: ✅ COMPLETE (2025-12-05)
- `npm run start -- --cro-extract --tool analyze_ctas https://carwale.com` works
- 136 unit tests passing (5 new formatter tests)

---

## Phase 16: Agent Core (US6) **[COMPLETE]**

**Purpose**: Main CRO agent orchestration with observe→reason→act loop

**Prerequisites**: Phase 15 ✅, Phase 14 ✅, Phase 13b ✅

**Implementation Reference**: See plan.md "Phase 16: Agent Core Implementation Details" for code

**Requirements**: FR-018 to FR-024, FR-039 to FR-048, CR-010 to CR-014, SC-019 to SC-026

---

### Phase 16a: System Prompt

- [x] T078 [US6] Create src/agent/prompt-builder.ts with PromptBuilder class ✅
  - Methods: buildSystemPrompt(), buildUserMessage(state, memory), formatToolsSection()
  - Injects tool definitions from ToolRegistry.getToolDefinitions()
  - Ref: FR-039, FR-040

- [x] T078a [P] [US6] Create src/prompts/system-cro.md template file ✅
  - Sections: identity, expertise, input_format, output_format, available_tools, completion_criteria
  - Ref: FR-020

---

### Phase 16b: State & Memory Management

- [x] T079 [US6] Create src/agent/message-manager.ts with MessageManager class ✅
  - Uses @langchain/core/messages (HumanMessage, AIMessage, SystemMessage)
  - Methods: addUserMessage(), addAssistantMessage(), getMessages(), clear(), trimToLimit()
  - Ref: FR-041, FR-042

- [x] T080 [US6] Create src/agent/state-manager.ts with StateManager class ✅
  - State: step, consecutiveFailures, totalFailures, insights, isDone, memory
  - Methods: incrementStep(), setDone(), recordFailure(), resetFailures(), shouldTerminate()
  - Termination: step >= maxSteps OR consecutiveFailures >= 3 OR isDone
  - Ref: FR-043, FR-044, FR-045, CR-010, CR-014

---

### Phase 16c: Main Agent

- [x] T081 [US6] Create src/agent/cro-agent.ts with CROAgent class ✅
  - Constructor: options merged with DEFAULT_CRO_OPTIONS
  - Method: analyze(url) returns CROAnalysisResult
  - Loop: observe→reason→act pattern with LLM (gpt-4o)
  - Error handling: LLM timeout, invalid JSON, tool errors, page errors
  - Re-extracts DOM after scroll/click actions
  - Ref: FR-046, FR-047, FR-048, CR-011, CR-012

- [x] T082 [US6] Update src/agent/index.ts with Phase 16 exports ✅
  - Export: PromptBuilder, MessageManager, StateManager, CROAgent, CROAnalysisResult

---

### Phase 16d: Unit Tests

- [x] T083 [P] [US6] Create tests/unit/prompt-builder.test.ts (20 tests) ✅
  - System prompt contains all 6 sections
  - User message includes URL, title, CRO elements, memory
  - Ref: SC-019

- [x] T084 [P] [US6] Create tests/unit/message-manager.test.ts (22 tests) ✅
  - Message ordering, types, count, clear, trimToLimit
  - Ref: SC-020

- [x] T085 [P] [US6] Create tests/unit/state-manager.test.ts (28 tests) ✅
  - Initial state, step management, failure tracking, termination conditions, insights
  - Ref: SC-021

---

### Phase 16e: Integration & E2E Tests

- [x] T086 [US6] Create tests/integration/cro-agent.test.ts (18 tests) ✅
  - Mock LLM with pre-canned responses
  - Test: loop completion, maxSteps, failure handling, state accumulation
  - Ref: SC-022, SC-024

- [x] T087 [US6] Create tests/e2e/cro-agent-workflow.test.ts (8 tests) ✅
  - Real browser + mock LLM responses
  - Verify: DOM extraction, tool execution, workflow completion, proper cleanup
  - Ref: SC-023, SC-025

---

**Checkpoint**: Agent completes loop with mock LLM, terminates on done/max-steps/failures ✅

**Total Tests**: 96 (70 unit + 18 integration + 8 e2e)

---

## Phase 16-CLI: CLI Integration - Agent Loop (US6) **[COMPLETE]**

**Purpose**: Run CRO agent analysis via CLI

**Prerequisites**: Phase 16 (Agent Core) complete

- [x] T088 [US6] Update src/cli.ts with --analyze flag ✅
  - New flags: --analyze, --max-steps N, --verbose
  - Runs CROAgent.analyze() and formats output

- [x] T089 [US6] Create src/output/agent-progress-formatter.ts ✅
  - Methods: formatAnalysisStart(), formatStepComplete(), formatAnalysisResult()
  - Shows step number, action, insights, timing

- [x] T090 [P] [US6] Create tests/unit/agent-progress-formatter.test.ts (6 tests) ✅
  - Tests for step formatting and result formatting

**Checkpoint**: `npm run start -- --analyze --max-steps 5 https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711` ✅

**Total Tests**: 6 tests (212 unit tests total)

---

## Phase 17a: Navigation Tools (US7) **[COMPLETE]**

**Purpose**: Implement navigation tools (scroll, click, go_to_url) that change page state

**Prerequisites**:
- Phase 16 (Agent Core) complete
- Dependencies: PageState, DOMTree from `src/models/`
- Pattern: Navigation tools return `insights: []` (empty array)

**CROActionNames Coverage** (Phase 17 total - must implement ALL):
```
Analysis:  analyze_ctas ✅, analyze_forms, detect_trust_signals, assess_value_prop, check_navigation, find_friction
Navigation: scroll_page ✅, click ✅, go_to_url ✅  ← COMPLETE
Control:    record_insight, done
```

**Note**: analyze_ctas exists from Phase 15b (T077c)

---

#### T091 [US7] Create src/agent/tools/cro/scroll-tool.ts ✅

**Action Name**: `scroll_page`

**Parameters**:
```typescript
z.object({
  direction: z.enum(['up', 'down', 'top', 'bottom']),
  amount: z.number().positive().optional().default(500),
})
```

**Returns**: `{ success, insights: [], extracted: { previousY, newY, atTop, atBottom } }`

**Error Handling**:
| Condition | Behavior |
|-----------|----------|
| Already at top + scroll up | success: true, atTop: true, newY unchanged |
| Already at bottom + scroll down | success: true, atBottom: true, newY unchanged |
| Page evaluation fails | success: false, error: message |

**Acceptance Criteria**:
- [ ] Scroll down increases scrollY by amount
- [ ] Scroll up decreases scrollY by amount
- [ ] Scroll top sets scrollY to 0
- [ ] Scroll bottom sets scrollY to max
- [ ] Returns atTop: true when scrollY === 0
- [ ] Returns atBottom: true when scrollY >= maxScroll

**Unit Tests** (6):
1. scroll down from top
2. scroll up from middle
3. scroll to top
4. scroll to bottom
5. scroll at boundary (no movement)
6. invalid direction rejected by Zod

---

#### T092 [US7] Create src/agent/tools/cro/click-tool.ts ✅

**Action Name**: `click`

**Parameters**:
```typescript
z.object({
  elementIndex: z.number().int().nonnegative(),
  waitForNavigation: z.boolean().optional().default(false),
})
```

**Returns**: `{ success, insights: [], extracted: { clickedXpath, elementText, navigationOccurred } }`

**Error Handling**:
| Condition | Behavior |
|-----------|----------|
| Element index not found | success: false, error: "Element with index N not found" |
| Element not visible | success: false, error: "Element N is not visible" |
| Element disappeared (DOM mutation) | success: false, error: "Element no longer in DOM" |
| Click timeout | success: false, error: "Click timed out after 5000ms" |

**Acceptance Criteria**:
- [ ] Click by valid index succeeds
- [ ] Click by invalid index returns error (not throws)
- [ ] Click hidden element returns error
- [ ] waitForNavigation: true waits up to 5s
- [ ] Returns navigationOccurred: true if URL changed
- [ ] Returns clickedXpath and elementText in extracted

**Unit Tests** (7):
1. click valid visible element
2. click invalid index (not found)
3. click hidden element
4. click with navigation wait (mock)
5. navigation detection
6. element xpath captured
7. negative index rejected by Zod

---

#### T093 [US7] Create src/agent/tools/cro/go-to-url-tool.ts ✅

**Action Name**: `go_to_url`

**Parameters**:
```typescript
z.object({
  url: z.string().url(),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional().default('load'),
})
```

**Returns**: `{ success, insights: [], extracted: { previousUrl, newUrl, loadTimeMs } }`

**Error Handling**:
| Condition | Behavior |
|-----------|----------|
| Invalid URL format | Zod validation fails |
| Navigation timeout (60s) | success: false, error: "Navigation timed out" |
| Network error | success: false, error: "Navigation failed: {message}" |

**Acceptance Criteria**:
- [ ] Navigates to valid URL
- [ ] Returns previous and new URL
- [ ] Tracks load time in ms
- [ ] Invalid URL rejected by Zod
- [ ] Timeout after 60s returns error

**Unit Tests** (5):
1. navigate to valid URL
2. invalid URL rejected
3. load time tracked
4. previous URL captured
5. waitUntil parameter respected

---

### Phase 17a Tests

- [x] T093a [P] [US7] Create tests/unit/navigation-tools.test.ts (21 tests) ✅
  | Tool | Tests |
  |------|-------|
  | scroll-tool | 6 |
  | click-tool | 7 |
  | go-to-url-tool | 5 |
  | schema validation | 3 |

---

**Phase 17a Checkpoint**: ✅
- [x] 3 navigation tools compile and export ✅
- [x] 21 unit tests passing (233 total) ✅
- [x] All tools return `insights: []` ✅
- [x] Test: `npm run start -- --tool scroll_page <url>` works ✅

**Phase 17a Total**: 4 tasks, 21 tests (completed 2025-12-08)

---

## Phase 17b: Analysis Tools (US7, US8) **[COMPLETE]**

**Purpose**: Implement analysis tools that examine DOM and return CROInsight[]

**Prerequisites**: Phase 17a (Navigation Tools) complete

**CROActionNames Coverage**:
```
Analysis:  analyze_ctas ✅, analyze_forms ✅, detect_trust_signals ✅, assess_value_prop ✅, check_navigation ✅, find_friction ✅  ← THIS PHASE COMPLETE
Navigation: scroll_page ✅, click ✅, go_to_url ✅
Control:    record_insight, done
```

---

#### T094 [US7] Create src/agent/tools/cro/analyze-forms-tool.ts ✅

**Action Name**: `analyze_forms`

**Parameters**:
```typescript
z.object({
  formSelector: z.string().optional(),
  includeHiddenFields: z.boolean().optional().default(false),
})
```

**Insight Types** (6):
| ID | Type | Severity | Condition | US8 Criteria |
|----|------|----------|-----------|--------------|
| F001 | `form_field_overload` | high | >5 visible fields | field count ✓ |
| F002 | `missing_field_label` | medium | input without label/placeholder | label quality ✓ |
| F003 | `missing_input_type` | medium | input without type attribute | validation issues ✓ |
| F004 | `no_required_indicator` | low | required without visual indicator | validation issues ✓ |
| F005 | `no_error_container` | low | form without error message area | validation issues ✓ |
| F006 | `no_submit_button` | high | form without submit button | field count ✓ |

**Error Handling**:
| Condition | Behavior |
|-----------|----------|
| No forms found | success: true, insights: [], extracted: { totalForms: 0 } |
| formSelector matches nothing | success: true, insights: [], extracted: { totalForms: 0 } |

**Acceptance Criteria** (maps to US8):
- [ ] Detects forms with >5 fields (field count)
- [ ] Detects inputs without labels (label quality)
- [ ] Detects inputs without type attribute (validation)
- [ ] Detects required fields without indicator (validation)
- [ ] Detects forms without submit button
- [ ] Returns empty insights for pages with no forms

**Unit Tests** (12):
1. form with 6 fields → F001
2. form with 4 fields → no F001
3. input without label → F002
4. input with placeholder → no F002
5. input without type → F003
6. input with type="email" → no F003
7. required without indicator → F004
8. form without submit → F006
9. form with button type=submit → no F006
10. multiple forms analyzed
11. formSelector filters correctly
12. empty page returns empty insights

---

#### T095 [US7] Create src/agent/tools/cro/analyze-trust-tool.ts ✅

**Action Name**: `detect_trust_signals`

**Parameters**:
```typescript
z.object({
  focusArea: z.string().optional().default('full_page'),
}).transform((data) => ({
  focusArea: normalizeAreaParam(data.focusArea), // Handles LLM variations
}))
```

**Insight Types** (5):
| ID | Type | Severity | Condition | US8 Criteria |
|----|------|----------|-----------|--------------|
| TR001 | `no_trust_above_fold` | medium | No trust elements in viewport | badges ✓ |
| TR002 | `no_reviews` | low | No review/testimonial elements | reviews ✓ |
| TR003 | `no_security_badge` | medium | No SSL/security/payment badges | badges ✓ |
| TR004 | `no_guarantees` | low | No guarantee/warranty mentions | guarantees ✓ |
| TR005 | `no_certifications` | low | No certification badges | certifications ✓ |

**Detection Patterns**:
```typescript
const TRUST_PATTERNS = {
  reviews: ['.review', '.testimonial', '[class*="rating"]', '.stars'],
  badges: ['.trust-badge', '.security-seal', '[class*="secure"]', 'img[alt*="ssl"]'],
  guarantees: ['[class*="guarantee"]', '[class*="warranty"]', '[class*="money-back"]'],
  certifications: ['.certification', '.accredited', '[class*="certified"]'],
};
```

**Error Handling**:
| Condition | Behavior |
|-----------|----------|
| No trust elements found | success: true, insights: [TR001-TR005 as applicable] |

**Acceptance Criteria** (maps to US8):
- [ ] Detects trust badges (security seals, payment icons)
- [ ] Finds review/testimonial sections
- [ ] Identifies guarantee mentions
- [ ] Recognizes certification badges
- [ ] Distinguishes above-fold vs full-page

**Unit Tests** (10):
1. page with trust badge → no TR003
2. page without trust badge → TR003
3. page with reviews → no TR002
4. page without reviews → TR002
5. page with guarantee → no TR004
6. above_fold filters correctly
7. full_page includes footer
8. multiple trust signals detected
9. trust signal count in extracted
10. empty page returns all applicable insights

---

#### T096 [US7] Create src/agent/tools/cro/analyze-value-prop-tool.ts ✅

**Action Name**: `assess_value_prop`

**Parameters**:
```typescript
z.object({
  checkH1Only: z.boolean().optional().default(false),
})
```

**Insight Types** (5):
| ID | Type | Severity | Condition | US8 Criteria |
|----|------|----------|-----------|--------------|
| VP001 | `missing_h1` | high | No H1 on page | headline clarity ✓ |
| VP002 | `multiple_h1` | medium | >1 H1 elements | headline clarity ✓ |
| VP003 | `generic_headline` | medium | H1 matches generic patterns | benefit communication ✓ |
| VP004 | `no_subheadline` | low | H1 without H2 support | benefit communication ✓ |
| VP005 | `headline_too_long` | low | H1 >10 words | headline clarity ✓ |

**Generic Patterns**:
```typescript
const GENERIC_PATTERNS = [
  /^welcome$/i, /^home$/i, /^homepage$/i,
  /^untitled$/i, /^page\s*\d*$/i, /^about$/i,
];
```

**Error Handling**:
| Condition | Behavior |
|-----------|----------|
| No value_prop elements | success: true, insights: [VP001] |

**Acceptance Criteria** (maps to US8):
- [ ] Detects missing H1 (headline clarity)
- [ ] Detects multiple H1s (headline clarity)
- [ ] Flags generic headlines like "Welcome" (benefit communication)
- [ ] Checks for supporting H2 (benefit communication)
- [ ] Flags headlines >10 words

**Unit Tests** (10):
1. page with single H1 → no VP001, VP002
2. page with no H1 → VP001
3. page with 2 H1s → VP002
4. H1 = "Welcome" → VP003
5. H1 = "Get 50% Off Your First Order" → no VP003
6. H1 without H2 → VP004
7. H1 with H2 → no VP004
8. H1 with 12 words → VP005
9. H1 with 8 words → no VP005
10. checkH1Only: true ignores H2-H6

---

#### T097 [US7] Create src/agent/tools/cro/check-navigation-tool.ts ✅

**Action Name**: `check_navigation`

**Parameters**:
```typescript
z.object({
  includeFooter: z.boolean().optional().default(true),
})
```

**Insight Types** (5):
| ID | Type | Severity | Condition | US8 Criteria |
|----|------|----------|-----------|--------------|
| NAV001 | `no_main_nav` | high | No <nav> or role="navigation" | menu structure ✓ |
| NAV002 | `no_breadcrumbs` | low | No breadcrumb on non-home page | breadcrumbs ✓ |
| NAV003 | `no_search` | medium | No search input/button | search presence ✓ |
| NAV004 | `deep_nav_nesting` | low | Nav menu >3 levels deep | menu structure ✓ |
| NAV005 | `no_home_link` | low | No link to home/root | menu structure ✓ |

**Detection Patterns**:
```typescript
const NAV_PATTERNS = {
  mainNav: ['nav', '[role="navigation"]', '.main-nav', '.primary-nav'],
  breadcrumbs: ['.breadcrumb', '[aria-label*="breadcrumb"]', '.crumbs'],
  search: ['[type="search"]', '.search', '[role="search"]', 'input[name*="search"]'],
};
```

**Acceptance Criteria** (maps to US8):
- [ ] Detects main navigation element
- [ ] Finds breadcrumb on category/product pages
- [ ] Identifies search functionality
- [ ] Checks nav menu depth
- [ ] Verifies home link exists

**Unit Tests** (8):
1. page with <nav> → no NAV001
2. page without nav → NAV001
3. product page with breadcrumbs → no NAV002
4. product page without breadcrumbs → NAV002
5. page with search → no NAV003
6. page without search → NAV003
7. deep nav (4 levels) → NAV004
8. nav menu depth in extracted

---

#### T098 [US7] Create src/agent/tools/cro/find-friction-tool.ts ✅

**Action Name**: `find_friction`

**Parameters**:
```typescript
z.object({
  categories: z.array(z.enum(['cta', 'form', 'trust', 'value_prop', 'navigation'])).optional(),
})
```

**Purpose**: General friction point detector that runs lightweight checks across ALL CRO categories. Use when LLM wants a quick overview before diving deep.

**Insight Types** (5 - one per category):
| ID | Type | Severity | Condition |
|----|------|----------|-----------|
| FR001 | `friction_cta` | varies | Quick CTA issues (no CTA above fold) |
| FR002 | `friction_form` | varies | Quick form issues (too many fields) |
| FR003 | `friction_trust` | varies | Quick trust issues (no signals) |
| FR004 | `friction_value` | varies | Quick value issues (no H1) |
| FR005 | `friction_nav` | varies | Quick nav issues (no search) |

**Behavior**: Runs ONE quick check per category, returns summary. For deep analysis, LLM should use specific tools.

**Acceptance Criteria** (maps to US8):
- [ ] Identifies general friction points across all categories
- [ ] Can filter to specific categories via parameter
- [ ] Returns at most 5 insights (one per category)
- [ ] Provides "friction score" in extracted

**Unit Tests** (6):
1. page with issues in all categories → 5 insights
2. clean page → 0 insights
3. categories filter works
4. friction score calculated
5. each friction type has category
6. empty categories param checks all

---

### Phase 17b Tests

- [x] T098a [P] [US7] Create tests/unit/analysis-tools.test.ts (51 tests) ✅
  | Tool | Tests |
  |------|-------|
  | analyze-forms | 12 |
  | analyze-trust | 10 |
  | analyze-value-prop | 10 |
  | check-navigation | 8 |
  | find-friction | 6 |
  | schema validation | 5 |

---

**Phase 17b Checkpoint**: ✅
- [x] 5 analysis tools compile and export ✅
- [x] 51 unit tests passing (284 total) ✅
- [x] All tools return valid CROInsight[] with correct schema ✅
- [x] Total insight types: 26 (6 form + 5 trust + 5 value + 5 nav + 5 friction) ✅
- [x] Tools registered in create-cro-registry.ts ✅

**Phase 17b Total**: 6 tasks, 51 tests (completed 2025-12-08)

---

## Phase 17c: Control Tools & Integration (US7) **[COMPLETE]**

**Purpose**: Implement control tools (record_insight, done) and finalize registry/integration

**Prerequisites**: Phase 17b (Analysis Tools) complete

**CROActionNames Coverage**:
```
Analysis:  analyze_ctas ✅, analyze_forms ✅, detect_trust_signals ✅, assess_value_prop ✅, check_navigation ✅, find_friction ✅
Navigation: scroll_page ✅, click ✅, go_to_url ✅
Control:    record_insight ✅, done ✅  ← COMPLETE
```

---

#### T099 [US7] Create src/agent/tools/cro/record-insight-tool.ts ✅

**Action Name**: `record_insight`

**Purpose**: Allow LLM to manually record an observation NOT covered by automated tools. Use cases:
1. LLM notices visual issue from DOM structure (e.g., "login button same color as background")
2. LLM infers business context issue (e.g., "pricing unclear for enterprise tier")
3. Cross-element pattern (e.g., "3 different CTA styles create inconsistency")

**Parameters**:
```typescript
z.object({
  type: z.string().min(1).max(50),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  element: z.string().optional(), // xpath
  issue: z.string().min(10).max(500),
  recommendation: z.string().min(10).max(500),
  category: z.enum(['cta', 'form', 'trust', 'value_prop', 'navigation', 'custom']).optional().default('custom'),
})
```

**Returns**: `{ success: true, insights: [recorded insight], extracted: { insightId } }`

**Error Handling**:
| Condition | Behavior |
|-----------|----------|
| Empty issue/recommendation | Zod validation fails |
| Missing type | Zod validation fails |

**Acceptance Criteria**:
- [x] Creates valid CROInsight with auto-generated ID ✅
- [x] Validates severity enum ✅
- [x] Stores custom category correctly ✅
- [x] Returns insight in insights array (not just extracted) ✅

**Unit Tests** (5):
1. valid insight recorded
2. auto-generated ID format
3. severity validation
4. optional element works
5. category defaults to 'custom'

---

#### T100 [US7] Create src/agent/tools/cro/done-tool.ts ✅

**Action Name**: `done`

**Purpose**: Signal analysis completion. CROAgent checks `action.name === 'done'` to exit loop.

**Parameters**:
```typescript
z.object({
  summary: z.string().min(10).max(1000),
  confidenceScore: z.number().min(0).max(1).optional(),
  areasAnalyzed: z.array(z.string()).optional(),
})
```

**Returns**: `{ success: true, insights: [], extracted: { summary, confidenceScore, areasAnalyzed } }`

**Acceptance Criteria**:
- [x] Returns success: true always ✅
- [x] Returns insights: [] always (control tool) ✅
- [x] Captures summary in extracted ✅
- [x] Validates confidenceScore range 0-1 ✅
- [x] areasAnalyzed optional array works ✅

**Unit Tests** (4):
1. valid done with summary
2. confidenceScore validation (0-1)
3. areasAnalyzed captured
4. always returns empty insights

---

### Phase 17c Tests & Integration

- [x] T100a [P] [US7] Create tests/unit/control-tools.test.ts (12 tests) ✅
  | Tool | Tests |
  |------|-------|
  | record-insight | 7 |
  | done-tool | 5 |

- [x] T101 [US7] Create tests/integration/cro-tools.test.ts (18 tests) ✅
  - Tool execution with mock PageState (5 tests)
  - Tool chaining: scroll → analyze → record (3 tests)
  - Error propagation through ToolExecutor (4 tests)
  - ToolResult schema validation (3 tests)
  - createCRORegistry() returns all 11 tools (3 tests)

- [x] T102 [US7] Update src/agent/tools/create-cro-registry.ts ✅
  - Register all 10 new tools
  - Total: 11 tools (including existing analyze_ctas)
  - Verify: `registry.getAll().length === 11`

- [x] T103 [US7] Update src/agent/tools/cro/index.ts ✅
  - Export all tool objects and param schemas

---

**Phase 17c Checkpoint**: ✅
- [x] 2 control tools compile and export ✅
- [x] 12 unit tests passing (control tools) ✅
- [x] 18 integration tests passing (all tools) ✅
- [x] createCRORegistry() returns registry with 11 tools ✅
- [x] All CROActionNames have corresponding tool implementation ✅

**Phase 17c Total**: 5 tasks, 30 tests (12 unit + 18 integration) - completed 2025-12-09

---

## Phase 17 Summary **[COMPLETE]**

| Sub-Phase | Tools | Unit Tests | Int Tests | Total | Status |
|-----------|-------|------------|-----------|-------|--------|
| 17a | 3 navigation | 21 | - | 21 | ✅ |
| 17b | 5 analysis | 51 | - | 51 | ✅ |
| 17c | 2 control + integration | 12 | 18 | 30 | ✅ |
| **Total** | **10 new (11 with analyze_ctas)** | **84** | **18** | **102** | **✅** |

**Insight Types**: 32 total (6 CTA + 6 form + 5 trust + 5 value + 5 nav + 5 friction)

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

**Checkpoint**: `npm run start -- https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711` runs full CRO analysis (SC-054) ✅

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

## Task Summary

| Phase | Tasks | Count | Purpose | Status | Tests |
|-------|-------|-------|---------|--------|-------|
| 1 | T001-T008 | 8 | Project setup | ✅ Complete | - |
| 2 | T009-T011 | 3 | Utilities | ✅ Complete | - |
| 3 | T012-T016 | 5 | URL loading (US1) | ✅ Complete | Unit + Integration |
| 4 | T017-T019 | 3 | Extraction (US2) | ✅ Complete | Unit |
| 5 | T020-T022 | 3 | LangChain (US3) | ✅ Complete | Integration |
| 6 | T023-T025 | 3 | Output (US4) | ✅ Complete | Unit |
| 7 | T026-T028 | 3 | Orchestrator | ✅ Complete | - |
| 8 | T029 | 1 | E2E tests | ✅ Complete | E2E |
| 9 | T030-T035 | 6 | Polish | ✅ Complete | - |
| 10 | T036-T039 | 4 | Bug fixes | ✅ Complete | - |
| 11 | T040-T044 | 5 | Wait strategy | ✅ Complete | - |
| 12 | T045-T053 | 9 | Cookie consent (US5) | ✅ Complete | Integration |
| 13a | T054-T056, T060, T063a, T064a | 6 | Core models | ✅ Complete | 24 unit |
| 13b | T057-T059, T063b, T064b | 5 | Agent models | ✅ Complete | 33 unit |
| 14 | T065-T071 | 7 | DOM extraction | ✅ Complete | 35 unit + 14 int |
| 14b | T072a-T072c | 3 | CLI: DOM extraction | ✅ Complete | - |
| **15** | T073-T077 | 5 | **Tool system** | ✅ Complete | 20 unit |
| **15b** | T077a-T077e | 5 | **CLI: Tool execution** | ✅ Complete | 5 unit |
| **16** | T078-T087 | 12 | **Agent core** | ✅ Complete | 70 unit + 18 int + 8 e2e |
| **16-CLI** | T088-T090 | 3 | **CLI: Agent loop** | ✅ Complete | 6 unit |
| **17a** | T091-T093a | 4 | Navigation tools (3) | ✅ Complete | 21 unit |
| **17b** | T094-T098a | 6 | Analysis tools (5) | ✅ Complete | 51 unit |
| **17c** | T099-T103 | 6 | Control + Integration | ✅ Complete | 9 unit + 18 int |
| **18a** | T104-T105a | 3 | Models & Types | ✅ Complete | 8 unit |
| **18b** | T106-T106d | 5 | Heuristic Engine Core | ✅ Complete | 26 unit |
| **18c** | T107a-T111c | 11 | 10 Heuristic Rules | ✅ Complete | 22 unit |
| **18d** | T112-T116a | 6 | Output Generation | ✅ Complete | 21 unit |
| **18e** | T117-T118 | 4 | Agent Integration | ✅ Complete | 21 int |
| **18f** | T118a-T118b | 2 | Test Fixtures | ✅ Complete | - |
| **18-CLI** | T119-T122 | 6 | CLI: Final Integration | ✅ Complete | 2 unit + 4 e2e |
| **19a** | T126-T129 | 4 | Coverage Models & Tracker | ✅ Complete | 16 unit |
| **19b** | T130-T133 | 4 | DOM Changes | ✅ Complete | 7 unit |
| **19c** | T134-T138 | 5 | Agent Integration | ✅ Complete | - |
| **19d** | T139-T140 | 2 | Prompt Updates | ✅ Complete | - |
| **19e** | T141-T142 | 2 | CLI & Config | ✅ Complete | 1 unit |
| **19f** | T143-T146 | 4 | Testing & Polish | ✅ Complete | 11 int + 4 e2e |

**Total**: 177 tasks (177 complete)

**Phase 18 Structure**:
- 18a: Models & Types (T104-T105a) - 3 tasks, 8 tests
- 18b: Heuristic Engine Core (T106-T106d) - 5 tasks, 22 tests
- 18c: Heuristic Rules (T107a-T111c) - 11 tasks, 20 tests
- 18d: Output Generation (T112-T116a) - 6 tasks, 20 tests
- 18e: Agent Integration (T117-T118) - 4 tasks, 12 integration tests
- 18f: Test Fixtures (T118a-T118b) - 2 tasks, 0 tests (fixtures)
- 18-CLI: Final Integration (T119-T122) - 6 tasks, 10 tests

**Phase 18 Test Totals**: 88 tests (76 unit + 12 integration)

**Implementation details in plan.md** - tasks.md is task definitions only

**Incremental CLI Milestones**:
- Phase 14b: `npm run start -- --cro-extract <url>` → Show CRO elements ✅
- Phase 15b: `npm run start -- --cro-extract --tool <name> <url>` → Run specific tool ✅
- Phase 16-CLI: `npm run start -- --analyze <url>` → Full agent loop ✅
- Phase 18-CLI: `npm run start -- <url>` → CRO analysis as default ✅
- Phase 19: `npm run start -- --scan-mode=full_page <url>` → 100% page coverage (pending)

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
