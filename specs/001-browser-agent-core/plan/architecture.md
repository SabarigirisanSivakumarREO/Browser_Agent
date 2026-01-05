**Navigation**: [Index](./index.md) | Previous | [Next](./dependencies.md)

## Project Structure

### Documentation (this feature)

```text
specs/001-browser-agent-core/
├── plan.md              # This file
├── research.md          # Technology decisions and rationale
├── data-model.md        # TypeScript interfaces and types
├── quickstart.md        # Usage guide and examples
└── tasks.md             # Implementation tasks (via /speckit.tasks)
```

> **Note**: `research.md` documents technology decisions made during planning (e.g., Playwright over Puppeteer, LangChain for LLM orchestration). `contracts/` folder omitted as this is a CLI tool without external API contracts.

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
  - Uses 1-second timeout per selector attempt (Phase 12)
  - Maximum 3 attempts across CMP patterns and heuristics
  - Total timeout: ≤3 seconds (satisfies CR-009)
  - **Phase 12b Enhancement**: Extended detection for Shopify/Alpine.js banners
    - Aria-label detection: `[aria-label*="cookie"]`, `[role="region"]`
    - Alpine.js detection: `[x-data*="consent"]`, `[x-data*="cookie"]`
    - Extended element types: `<a>`, `<div role="button">`, `<span role="button">`
    - Context-aware matching: Prioritizes buttons within cookie containers
    - Extended timeout: 2000ms for dynamically-loaded banners

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
