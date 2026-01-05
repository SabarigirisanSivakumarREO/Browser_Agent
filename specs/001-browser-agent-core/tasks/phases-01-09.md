**Navigation**: [Index](./index.md) | [Next](./phases-10-12.md)

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

**Checkpoint**: Can load https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy and get title "Example Domain"

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

**Checkpoint**: `npm run start -- https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy` produces full output

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
