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

- [x] T029 Create tests/e2e/workflow.test.ts with 5-URL test (updated)
  - Test 1: https://www.conversion.com/ (CRO agency, expect success)
  - Test 2: https://www.invespcro.com/ (CRO agency, expect success)
  - Test 3: https://www.npdigital.com/ (digital marketing, expect success)
  - Test 4: https://www.roihunt.in/conversion-rate-optimization-agency-in-india/ (CRO agency, expect success)
  - Test 5: https://www.wearetenet.com/in/growth/conversion-rate-optimization-services (CRO services, expect success)
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
  - Ensures browser binaries are installed automatically with `npm install`
  - Eliminates need for separate `npx playwright install` step
  - **Note**: Updated T002 to reflect this addition
- [x] T037 Add `ignoreHTTPSErrors: true` to browser context in browser-manager.ts
  - Fixes SSL certificate errors (ERR_CERT_COMMON_NAME_INVALID) on some websites
  - Required for sites with misconfigured or self-signed certificates
- [x] T038 Add dotenv config import to vitest.config.ts
  - Loads `.env` file during test execution
  - Fixes "Missing OPENAI_API_KEY" errors in e2e tests
  - **Note**: `dotenv` added to production dependencies, updated T002
- [x] T039 Update e2e test URLs to use real CRO agency websites
  - Replaced example.com and httpstat.us with production URLs
  - Tests now validate against real-world dynamic websites

**Additional Infrastructure Updates** (not originally tracked):
- Added `tsx` to dev dependencies (replaces ts-node for ESM support)
- Added `@typescript-eslint/parser` to dev dependencies (required for ESLint)
- Updated all dependency versions to latest compatible versions (see plan.md)

**Checkpoint**: All 7 e2e tests pass, application works with real websites

---

## Phase 11: Wait Strategy & Dynamic Content (Post-Implementation)

**Purpose**: Fix timeout issues and improve dynamic content extraction

- [x] T040 Change default wait strategy from `networkidle` to `load`
  - Prevents timeouts on sites with persistent network activity (analytics, websockets)
  - `load` event fires reliably on all sites
- [x] T041 Add `--wait-until` CLI flag for user override
  - Options: `load` (default), `domcontentloaded`, `networkidle`
  - Allows users to choose strategy per site
- [x] T042 Implement hybrid wait strategy in PageLoader
  - Primary: Use configured `waitUntil` strategy for initial load
  - Secondary: Wait for `networkidle` with short timeout for JS rendering
  - Fallback: If networkidle times out, continue with extraction
- [x] T043 Add `--post-load-wait` CLI flag for JS rendering wait
  - Default: 5000ms (5 seconds)
  - Set to 0 to disable hybrid waiting
  - Configurable for heavy JS sites
- [x] T044 Add `postLoadWait` to BrowserConfig type and defaults
  - Updated `src/types/index.ts` with new config option
  - Wired through BrowserAgent to PageLoader

**Checkpoint**: mrandmrssmith.com extracts all 50 headings (was 43 before)

---

## Phase 12: Cookie Consent Handling (User Story 5)

**Purpose**: Auto-dismiss cookie consent popups before extraction

### Types & Configuration

- [x] T045 [US5] Add `dismissCookieConsent` to BrowserConfig in `src/types/index.ts`
  - Type: `boolean`, default: `true`
  - Add to `DEFAULT_BROWSER_CONFIG`
  - Added `CookieConsentPattern` and `CookieConsentResult` interfaces
- [x] T046 [US5] Add `--no-cookie-dismiss` CLI flag to `src/cli.ts`
  - When present, sets `dismissCookieConsent: false`
  - Update help text

### CMP Patterns

- [x] T047 [US5] Create `src/browser/cookie-patterns.ts` with CMP selector patterns
  - TypeScript const array (not JSON file)
  - Include: OneTrust, Cookiebot, Usercentrics, TrustArc, Quantcast, Didomi, Osano, Consent Manager
  - Interface: `{ id, detectSelector, acceptSelector, frameHint? }`

### Cookie Handler Implementation

- [x] T048 [US5] Create `src/browser/cookie-handler.ts` with CookieConsentHandler class
  - `dismiss(page: Page): Promise<CookieConsentResult>`
  - `tryKnownCMPs(page: Page)`: Loop patterns, check iframe if `frameHint` present
  - `tryHeuristic(page: Page)`: Find buttons with "accept", "allow", "agree", "ok" text
  - Max 3 attempts, 1s timeout per selector (satisfies CR-009: ≤3s total timeout)
  - Structured logging: `{ type, url, mode, cmpId, buttonText, success }`
- [x] T049 [US5] Update `src/browser/index.ts` to export CookieConsentHandler

### Integration

- [x] T050 [US5] Integrate CookieConsentHandler into PageLoader
  - Call after hybrid wait, before returning `PageLoadResult`
  - Only if `dismissCookieConsent` is true
  - Add `cookieConsent` field to `PageLoadResult`
- [x] T051 [US5] Wire `dismissCookieConsent` config through BrowserAgent to PageLoader

### Tests

- [x] T052 [P] [US5] Create `tests/integration/cookie-handler.test.ts`
  - Test with known CMP patterns (OneTrust, Cookiebot)
  - Test heuristic fallback with various button texts
  - Test sites without popups (no delay)
  - 7 test cases covering all acceptance scenarios
- [x] T053 [US5] Update e2e tests to verify cookie popups don't block extraction
  - Added cookie consent verification tests
  - Test with dismissal enabled and disabled
  - Verify extraction works regardless of popup

**Checkpoint**: Sites with cookie popups have them dismissed before extraction ✅ COMPLETE

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundational) → Phases 3-6 (User Stories) → Phase 7 (Orchestrator) → Phase 8 (E2E) → Phase 9 (Polish)
  ↓
Phase 10 (Bug Fixes) → Phase 11 (Wait Strategy) → Phase 12 (Cookie Consent)
```

**Post-MVP phases** (10-12) depend on Phase 9 completion but are independent of each other.

### Within Phases

- Phase 1: T001 → T002 → (T003, T004, T005, T006 in parallel) → T007 → T008
- Phase 2: T009 → (T010, T011 in parallel)
- Phase 3: (T012, T013 in parallel) → T014 → T015 → T016
- Phase 4: T017 → T018 → T019
- Phase 5: T020 → T021 → T022
- Phase 6: T023 → T024 → T025
- Phase 7: T026 → T027 → T028
- Phase 8: T029 (depends on Phase 7)
- Phase 9: All tasks can run in parallel
- Phase 10: T036 → T037 → T038 → T039
- Phase 11: T040 → T041 → T042 → T043 → T044
- Phase 12: T045 → T046 → T047 → T048 → T049 → (T050, T051 in parallel) → T052 → T053

### User Story Independence

After Phase 2 completes:
- US1 (Phase 3) can start immediately
- US2 (Phase 4) depends on US1 (needs loaded page)
- US3 (Phase 5) depends on US2 (needs extracted headings)
- US4 (Phase 6) can start after US1 (only needs result types)
- US5 (Phase 12) depends on US1 (needs PageLoader integration)

### Parallel Opportunities

```bash
# Phase 1 parallel tasks:
T003, T004, T005, T006

# Phase 2 parallel tasks:
T010, T011

# Test tasks can run parallel within each phase:
T012, T013 (Phase 3)
T017 (Phase 4)
T020 (Phase 5)
T023 (Phase 6)

# Phase 9 parallel tasks:
T030, T031, T032

# Phase 12 parallel tasks:
T050, T051 (integration tasks)
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test URL loading independently
5. Continue to US2, US3, US4

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Add US1 → Can load URLs
3. Add US2 → Can extract headings
4. Add US3 → Can process with AI
5. Add US4 → Full formatted output
6. Phase 7 → CLI working
7. Phase 8 → E2E validated
8. Phase 9 → Production ready
9. Phase 10 → Bug fixes (browser install, SSL, env loading)
10. Phase 11 → Wait strategy improvements (hybrid wait)
11. Phase 12 → Cookie consent handling (auto-dismiss popups)

---

## Task Summary

| Phase | Tasks | Purpose | Status |
|-------|-------|---------|--------|
| 1 | T001-T008 | Project setup | ✅ Complete |
| 2 | T009-T011 | Utilities | ✅ Complete |
| 3 | T012-T016 | URL loading (US1) | ✅ Complete |
| 4 | T017-T019 | Extraction (US2) | ✅ Complete |
| 5 | T020-T022 | LangChain (US3) | ✅ Complete |
| 6 | T023-T025 | Output (US4) | ✅ Complete |
| 7 | T026-T028 | Orchestrator | ✅ Complete |
| 8 | T029 | E2E tests | ✅ Complete |
| 9 | T030-T035 | Polish | ✅ Complete |
| 10 | T036-T039 | Bug fixes | ✅ Complete |
| 11 | T040-T044 | Wait strategy & dynamic content | ✅ Complete |
| 12 | T045-T053 | Cookie consent handling (US5) | ✅ Complete |

**Total**: 53 tasks (35 original + 18 post-implementation) - **ALL COMPLETE** ✅
