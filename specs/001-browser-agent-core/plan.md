# Implementation Plan: Browser Agent Core

**Branch**: `001-browser-agent-core` | **Date**: 2025-01-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-browser-agent-core/spec.md`

## Claude Code Instructions

Keep it concise. Compromise on grammar. Clear, to the point. No fluff.

## Summary

Build a browser automation agent using Node.js/TypeScript that navigates to URLs via Playwright, extracts heading elements (h1-h6), processes them through LangChain with OpenAI GPT-4o-mini for insights, and outputs structured results to the console. The architecture follows a modular design with five core modules: Browser (including cookie consent handling), Extraction, LangChain, Output, and Orchestrator.

## Technical Context

**Language/Version**: Node.js 20.x LTS with TypeScript 5.x (strict mode)
**Primary Dependencies**: Playwright (Chromium), LangChain.js, OpenAI SDK
**Storage**: N/A (stateless processing)
**Testing**: Vitest for unit tests, Playwright Test for integration/e2e
**Target Platform**: Windows/Linux/macOS (Node.js runtime)
**Project Type**: Single project (CLI tool)
**Performance Goals**: Page load within 60s, LangChain processing within 10s
**Constraints**: 40-60% context utilization, visible browser mode, graceful error handling
**Scale/Scope**: Single URL or sequential multi-URL processing
**Out of Scope**: Authentication/login handling (CR-004) - agent will not handle login flows

## Constitution Check

*GATE: Must pass before implementation. All 8 principles verified.*

| Principle | Compliance | Implementation |
|-----------|------------|----------------|
| I. Code Quality | ✅ | Single responsibility modules, clear naming |
| II. TypeScript First | ✅ | Strict mode, explicit types, interfaces for contracts |
| III. Playwright | ✅ | Primary browser automation, built-in selectors, auto-wait |
| IV. Error Handling | ✅ | Try-catch at each stage, structured JSON logging |
| V. Async/Await | ✅ | Consistent async patterns, proper await chains |
| VI. Context Efficiency | ✅ | Modular code, concise responses, 40-60% target |
| VII. Modular Design | ✅ | 4 isolated modules with dependency injection |
| VIII. Documentation | ✅ | JSDoc on public APIs, inline comments |

## Project Structure

### Documentation (this feature)

```text
specs/001-browser-agent-core/
├── plan.md              # This file
├── data-model.md        # TypeScript interfaces and types
├── quickstart.md        # Usage guide and examples
└── tasks.md             # Implementation tasks (via /speckit.tasks)
```

### Design Diagrams

```text
design/
├── APPLICATION_FLOW.md      # ASCII diagrams of application flow
├── architecture-overview.svg # High-level architecture (7 stages)
├── component-details.svg    # Detailed component breakdown
├── configuration-types.svg  # TypeScript types and config layers
├── data-flow-pipeline.svg   # 6-stage data processing pipeline
└── sequence-diagram.svg     # UML sequence diagram for URL processing
```

### Source Code (repository root)

```text
src/
├── index.ts                 # Main entry point and CLI
├── types/
│   └── index.ts             # Shared TypeScript interfaces
├── browser/
│   ├── index.ts             # Browser module exports
│   ├── browser-manager.ts   # Playwright browser lifecycle
│   ├── page-loader.ts       # URL navigation and page loading
│   ├── cookie-handler.ts    # Cookie consent popup dismissal
│   └── cookie-patterns.ts   # CMP-specific selector patterns
├── extraction/
│   ├── index.ts             # Extraction module exports
│   └── heading-extractor.ts # h1-h6 element extraction
├── langchain/
│   ├── index.ts             # LangChain module exports
│   └── processor.ts         # LangChain/OpenAI processing
├── output/
│   ├── index.ts             # Output module exports
│   └── formatter.ts         # Console result formatting
└── utils/
    ├── logger.ts            # Structured logging utility
    └── validator.ts         # URL validation

tests/
├── unit/
│   ├── validator.test.ts
│   ├── heading-extractor.test.ts
│   └── formatter.test.ts
├── integration/
│   ├── browser.test.ts
│   ├── langchain.test.ts
│   └── cookie-handler.test.ts
└── e2e/
    └── workflow.test.ts     # End-to-end with 3 URLs
```

**Structure Decision**: Single project structure selected. This is a CLI tool with modular internal architecture. Each module (browser, extraction, langchain, output) is isolated with its own index.ts for clean exports and dependency injection.

## Module Architecture

### 1. Browser Module (`src/browser/`)

**Responsibility**: Playwright browser lifecycle, page navigation, and cookie consent handling

**Components**:
- `BrowserManager`: Creates/closes browser instances (Chromium, visible mode)
- `PageLoader`: Navigates to URLs, waits for network idle, handles timeouts
- `CookieConsentHandler`: Detects and dismisses cookie consent popups before extraction
  - Uses 1-second timeout per selector attempt
  - Maximum 3 attempts across CMP patterns and heuristics
  - Total timeout: ≤3 seconds (satisfies CR-009)

**Key Interfaces**:
```typescript
interface BrowserConfig {
  headless: boolean;           // false per CR-001
  timeout: number;             // 60000ms per CR-002
  browserType: 'chromium' | 'firefox' | 'webkit';
  waitUntil: 'load' | 'domcontentloaded' | 'networkidle';  // 'load' per CR-005
  postLoadWait: number;        // 5000ms per CR-005
  dismissCookieConsent: boolean;  // true per CR-007, disable via --no-cookie-dismiss (CR-008)
  cookieTimeoutMs?: number;    // 3000ms max per CR-009 (1s per selector × 3 attempts)
}

interface PageLoadResult {
  success: boolean;
  title?: string;
  url: string;
  loadTimeMs?: number;
  error?: string;
  cookieConsent?: CookieConsentResult;  // Added for US5
}

interface CookieConsentPattern {
  id: string;             // e.g., "onetrust", "cookiebot"
  detectSelector: string; // selector to detect CMP presence
  acceptSelector: string; // selector for accept button
  frameHint?: string;     // iframe src pattern if CMP uses iframe
}

interface CookieConsentResult {
  dismissed: boolean;
  mode: 'cmp' | 'heuristic' | 'none';
  cmpId?: string;
  buttonText?: string;
}
```

### 2. Extraction Module (`src/extraction/`)

**Responsibility**: DOM element extraction from loaded pages

**Components**:
- `HeadingExtractor`: Queries h1-h6 elements, returns structured data

**Key Interfaces**:
```typescript
interface Heading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  index: number;  // Document order
}

interface ExtractionResult {
  headings: Heading[];
  totalCount: number;
  countByLevel: Record<number, number>;
}
```

### 3. LangChain Module (`src/langchain/`)

**Responsibility**: AI-powered analysis of extracted data

**Components**:
- `LangChainProcessor`: Sends data to GPT-4o-mini, parses insights

**Key Interfaces**:
```typescript
interface ProcessingResult {
  summary: string;
  categories: string[];
  insights: string[];
  rawResponse?: string;
}
```

**Configuration**: Uses `OPENAI_API_KEY` environment variable per CR-003

### 4. Output Module (`src/output/`)

**Responsibility**: Format and display results to console

**Components**:
- `ResultFormatter`: Transforms results into readable console output

### 5. Main Orchestrator (`src/index.ts`)

**Responsibility**: Coordinates workflow across all modules

**Flow**:
1. Validate environment (OPENAI_API_KEY)
2. Validate URL input
3. Initialize browser (visible Chromium)
4. Load page (60s timeout)
5. Dismiss cookie consent popup (if enabled, best-effort)
6. Extract headings
7. Process via LangChain
8. Format and output results
9. Cleanup browser resources

## Dependencies

### Production
```json
{
  "playwright": "^1.56.1",
  "@playwright/browser-chromium": "^1.56.1",
  "langchain": "^1.0.6",
  "@langchain/openai": "^1.1.2",
  "dotenv": "^17.2.3",
  "zod": "^4.1.12"
}
```

**Notes**:
- `@playwright/browser-chromium`: Added in Phase 10 (T036) - auto-installs Chromium browser with npm install
- `dotenv`: Added in Phase 10 (T038) - loads .env files for configuration
- `@langchain/core`: Peer dependency of `@langchain/openai` (HumanMessage, SystemMessage)

### Development
```json
{
  "typescript": "^5.9.3",
  "@types/node": "^24.10.1",
  "vitest": "^4.0.13",
  "@playwright/test": "^1.56.1",
  "eslint": "^9.39.1",
  "@typescript-eslint/eslint-plugin": "^8.47.0",
  "@typescript-eslint/parser": "^8.47.0",
  "prettier": "^3.6.2",
  "tsx": "^4.20.6"
}
```

**Notes**:
- `@typescript-eslint/parser`: Required for ESLint to parse TypeScript
- `tsx`: Replaces ts-node for better ESM support in development
- All versions updated to current as of 2025-11-24, fully compatible with original design

## Test Strategy

### Test Case 1: Basic URL Loading Verification (US1)
- Load `https://example.com`
- Verify page title extracted
- Verify no errors

### Test Case 2: Data Extraction Accuracy (US2)
- Load page with known heading structure
- Verify all h1-h6 captured
- Verify correct hierarchy levels
- Verify document order preserved

### Test Case 3: End-to-End Multi-URL Workflow (US1-US4)
- Process 3 different URLs sequentially:
  1. `https://example.com` (simple)
  2. `https://developer.mozilla.org/en-US/` (complex)
  3. `https://httpstat.us/404` (error case)
- Verify results for each URL
- Verify error handling for 404
- Verify console output format

### Test Case 4: Cookie Consent Handling (US5)
- Test with known CMP sites (OneTrust, Cookiebot)
- Verify popup dismissed before extraction
- Verify heuristic fallback on custom banners
- Verify sites without popups have no delay
- Verify `--no-cookie-dismiss` flag disables feature

## Complexity Tracking

> No constitution violations identified. All principles satisfied.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| 4 modules | Keep | Maps directly to user stories and separation of concerns |
| LangChain abstraction | Keep | Enables future model swapping without code changes |
| Visible browser | Required | Per CR-001, aids debugging |
