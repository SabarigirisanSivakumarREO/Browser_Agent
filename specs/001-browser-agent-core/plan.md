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

---

## CRO Agent Architecture (Phases 13-18)

### Summary

Evolve Browser Agent from single-pass heading extractor to autonomous CRO analysis agent with iterative analysis loop, tool registry, and hypothesis generation. Based on Browser Use (Python) patterns adapted to Node.js/TypeScript/Playwright.

### New Modules

#### 6. Agent Module (`src/agent/`)

**Responsibility**: Core agent loop, state management, LLM interaction

**Components**:
- `CROAgent`: Main agent with step loop (observe→reason→act)
- `MessageBuilder`: Assembles LLM context from page state and memory
- `OutputParser`: Validates LLM response against Zod schema
- `State`: Agent state management (step count, failures, insights)
- `Memory`: Analysis context (step history, findings)

**Key Interfaces**:
```typescript
interface CROAgentOptions {
  maxSteps: number;           // 10 per CR-010
  actionWaitMs: number;       // 500ms per CR-011
  llmTimeoutMs: number;       // 60000ms per CR-012
  failureLimit: number;       // 3 per CR-014
}

interface AgentState {
  step: number;
  consecutiveFailures: number;
  insights: CROInsight[];
  memory: CROMemory;
  isDone: boolean;
}

interface CROMemory {
  stepHistory: StepRecord[];
  findings: CROInsight[];
  pagesSeen: string[];
  currentFocus: string;
}
```

#### 7. DOM Module (`src/browser/dom/`)

**Responsibility**: DOM extraction, visibility detection, CRO classification

**Components**:
- `DOMExtractor`: Orchestrates DOM extraction via injected script
- `buildCroDomTree.js`: Injected script for DOM traversal and classification
- `Visibility`: Element visibility detection (CSS + viewport + clip)
- `Interactive`: Interactive element detection (tag + ARIA + handlers)
- `Serializer`: DOM to indexed text format for LLM

**Key Interfaces**:
```typescript
interface DOMTree {
  root: DOMNode;
  interactiveCount: number;
  croElementCount: number;
}

interface DOMNode {
  tagName: string;
  xpath: string;
  index?: number;           // Only for visible CRO elements
  text: string;             // Truncated to 100 chars per CR-015
  isInteractive: boolean;
  isVisible: boolean;
  croType: 'cta' | 'form' | 'trust' | 'value_prop' | 'navigation' | null;
  boundingBox?: { x: number; y: number; width: number; height: number };
  children: DOMNode[];
}

interface CROClassification {
  type: 'cta' | 'form' | 'trust' | 'value_prop' | 'navigation';
  confidence: number;
  matchedSelector: string;
}
```

#### 8. Tools Module (`src/tools/`)

**Responsibility**: Tool registration, execution, and CRO-specific analysis

**Components**:
- `ToolRegistry`: Register/execute tools with Zod validation
- `Navigation`: scroll_page, go_to_url tools
- `Done`: Complete analysis tool
- CRO Tools: cta-analyzer, form-analyzer, trust-detector, value-prop, navigation-analyzer, friction-finder

**Key Interfaces**:
```typescript
interface ToolDefinition {
  name: string;
  description: string;        // For LLM context
  parameters: ZodSchema;
  execute: (params: unknown, page: Page, state: PageState) => Promise<ToolResult>;
}

interface ToolResult {
  success: boolean;
  insights: CROInsight[];
  extracted?: unknown;        // Raw data for debugging
  error?: string;
}

interface CROInsight {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  element: string;            // XPath
  issue: string;
  recommendation: string;
  evidence?: {
    text?: string;
    screenshot?: string;
    styles?: Record<string, string>;
  };
}
```

#### 9. Analysis Module (`src/analysis/`)

**Responsibility**: Heuristics, business type detection, severity scoring

**Components**:
- `HeuristicEngine`: 10 initial rule-based checks
- `BusinessTypeDetector`: Detect ecommerce/saas/banking/etc.
- `SeverityScorer`: Weight insights by business type

**Key Interfaces**:
```typescript
interface HeuristicRule {
  id: string;
  name: string;
  check: (state: PageState) => CROInsight | null;
  businessTypes?: BusinessType[];  // Apply only to these types
}

type BusinessType = 'ecommerce' | 'saas' | 'banking' | 'insurance' | 'travel' | 'media' | 'other';

interface ScoreResult {
  overall: number;
  byCategory: Record<string, number>;
  criticalCount: number;
  highCount: number;
}
```

#### 10. Models Module (`src/models/`)

**Responsibility**: TypeScript interfaces and Zod schemas

**Components**:
- `PageState`: Current page state for LLM context
- `DOMTree`: DOM tree structure
- `CROInsight`: Individual finding
- `AgentOutput`: Zod schema for LLM response
- `Hypothesis`: A/B test specification

**Key Zod Schema**:
```typescript
const CROAgentOutputSchema = z.object({
  thinking: z.string().describe('Analysis reasoning'),
  evaluation_previous_goal: z.string().describe('Assessment of last action'),
  memory: z.string().describe('Key findings to remember'),
  next_goal: z.string().describe('Next analysis focus'),
  action: z.object({
    name: z.enum(['analyze_ctas', 'analyze_forms', 'detect_trust_signals',
                  'assess_value_prop', 'check_navigation', 'find_friction',
                  'scroll_page', 'done']),
    params: z.record(z.any()).optional()
  })
});
```

#### 11. Output Module (Extended - `src/output/`)

**Responsibility**: Hypothesis generation, report formatting

**New Components**:
- `HypothesisGenerator`: Transform insights to A/B test specs
- `MarkdownReporter`: Generate structured reports
- `JSONExporter`: Export full analysis as JSON

**Key Interfaces**:
```typescript
interface Hypothesis {
  id: string;
  title: string;
  hypothesis: string;         // "If X then Y because Z"
  controlDescription: string;
  treatmentDescription: string;
  primaryMetric: string;
  expectedImpact: 'low' | 'medium' | 'high';
  priority: number;
  relatedInsights: string[];  // CROInsight IDs
}

interface CROReport {
  url: string;
  businessType: BusinessType;
  executiveSummary: string;
  criticalIssues: CROInsight[];
  highPriorityIssues: CROInsight[];
  mediumPriorityIssues: CROInsight[];
  lowPriorityIssues: CROInsight[];
  recommendedTests: Hypothesis[];
  analysisSteps: number;
  timestamp: string;
}
```

#### 12. Prompts Module (`src/prompts/`)

**Responsibility**: System prompts for CRO analysis

**Files**:
- `system-cro.md`: Main CRO agent system prompt

**Prompt Structure**:
```markdown
<identity>
You are a CRO (Conversion Rate Optimization) expert analyst.
</identity>

<expertise>
- UX friction detection
- CTA optimization
- Form analysis
- Trust signal assessment
- Value proposition clarity
- Navigation usability
</expertise>

<input_format>
- page_url: Current page URL
- page_title: Page title
- cro_elements: Indexed list of CRO-relevant elements
- memory: Previous findings and analysis context
</input_format>

<output_format>
JSON matching CROAgentOutputSchema
</output_format>

<available_tools>
[List of tools with descriptions]
</available_tools>

<completion_criteria>
Call done when:
- All CRO aspects analyzed (CTAs, forms, trust, value prop, navigation)
- No new elements after scrolling
- Critical friction points identified

Do NOT call done if:
- Only analyzed above-the-fold
- Haven't checked forms (if present)
</completion_criteria>
```

### Updated Project Structure

```text
src/
├── index.ts                 # BrowserAgent (MVP) + CROAgent export
├── cli.ts                   # CLI with CRO commands
├── types/
│   └── index.ts             # Shared interfaces (extended)
├── browser/
│   ├── index.ts
│   ├── browser-manager.ts
│   ├── page-loader.ts
│   ├── cookie-handler.ts
│   ├── cookie-patterns.ts
│   └── dom/                 # NEW
│       ├── extractor.ts
│       ├── buildCroDomTree.js
│       ├── visibility.ts
│       ├── interactive.ts
│       └── serializer.ts
├── extraction/
│   ├── index.ts
│   └── heading-extractor.ts
├── langchain/
│   ├── index.ts
│   └── processor.ts
├── agent/                   # NEW
│   ├── index.ts
│   ├── cro-agent.ts
│   ├── message-builder.ts
│   ├── output-parser.ts
│   ├── state.ts
│   └── memory.ts
├── tools/                   # NEW
│   ├── index.ts
│   ├── registry.ts
│   ├── navigation.ts
│   └── cro/
│       ├── cta-analyzer.ts
│       ├── form-analyzer.ts
│       ├── trust-detector.ts
│       ├── value-prop.ts
│       ├── navigation-analyzer.ts
│       └── friction-finder.ts
├── analysis/                # NEW
│   ├── index.ts
│   ├── heuristics.ts
│   ├── business-type.ts
│   └── scoring.ts
├── models/                  # NEW
│   ├── index.ts
│   ├── page-state.ts
│   ├── dom-tree.ts
│   ├── cro-insight.ts
│   ├── agent-output.ts
│   └── hypothesis.ts
├── output/
│   ├── index.ts
│   ├── formatter.ts
│   ├── hypothesis-generator.ts  # NEW
│   ├── markdown-reporter.ts     # NEW
│   └── json-exporter.ts         # NEW
├── prompts/                 # NEW
│   └── system-cro.md
└── utils/
    ├── logger.ts
    └── validator.ts

tests/
├── unit/
│   ├── validator.test.ts
│   ├── heading-extractor.test.ts
│   ├── formatter.test.ts
│   ├── dom-extractor.test.ts    # NEW
│   ├── tool-registry.test.ts    # NEW
│   ├── heuristics.test.ts       # NEW
│   └── output-parser.test.ts    # NEW
├── integration/
│   ├── browser.test.ts
│   ├── langchain.test.ts
│   ├── cookie-handler.test.ts
│   ├── cro-agent.test.ts        # NEW
│   └── cro-tools.test.ts        # NEW
└── e2e/
    ├── workflow.test.ts
    └── cro-analysis.test.ts     # NEW
```

### Agent Loop Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                       CROAgent.analyze(url)                     │
├─────────────────────────────────────────────────────────────────┤
│  1. Initialize                                                  │
│     ├─ Load page via BrowserManager/PageLoader                 │
│     ├─ Extract DOM via DOMExtractor                            │
│     └─ Initialize state (step=0, failures=0, insights=[])      │
├─────────────────────────────────────────────────────────────────┤
│  2. Agent Loop (while step < maxSteps && !isDone)              │
│     ├─ OBSERVE: Get PageState (DOM + meta)                     │
│     ├─ REASON: Build messages, call LLM, parse output          │
│     ├─ ACT: Execute tool via ToolRegistry                      │
│     │   ├─ Success: Add insights, reset failures               │
│     │   └─ Failure: Increment failures, check limit (3)        │
│     ├─ CHECK: If action.name === 'done', exit loop             │
│     └─ INCREMENT: step++                                        │
├─────────────────────────────────────────────────────────────────┤
│  3. Post-Process                                                │
│     ├─ Run HeuristicEngine on final state                      │
│     ├─ Detect business type                                    │
│     ├─ Score severity                                          │
│     └─ Generate hypotheses from high/critical insights         │
├─────────────────────────────────────────────────────────────────┤
│  4. Output                                                      │
│     ├─ Generate CROReport                                      │
│     ├─ Format as markdown or JSON per CLI flags                │
│     └─ Return PageAnalysis                                      │
└─────────────────────────────────────────────────────────────────┘
```

### DOM Extraction Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    DOMExtractor.extract(page)                   │
├─────────────────────────────────────────────────────────────────┤
│  1. Inject buildCroDomTree.js via page.evaluate()              │
│                                                                 │
│  2. Recursive DOM Traversal (from document.body)               │
│     ├─ For each element:                                       │
│     │   ├─ Check visibility (CSS display/visibility/opacity)   │
│     │   ├─ Check if clipped by parent overflow                 │
│     │   ├─ Check if interactive (tag/role/onclick/cursor)      │
│     │   ├─ Classify CRO type (cta|form|trust|value_prop|nav)   │
│     │   └─ Get bounding box if visible                         │
│     └─ Build tree structure with children                      │
│                                                                 │
│  3. Index Assignment                                            │
│     └─ Assign sequential index to visible CRO elements only    │
│                                                                 │
│  4. Serialization                                               │
│     ├─ Format: [index]<tag attrs>text</tag>                    │
│     ├─ Truncate text to 100 chars                              │
│     └─ Track token count, warn at 60% budget                   │
└─────────────────────────────────────────────────────────────────┘
```

### CRO Element Classification

```javascript
// Priority order: cta > form > trust > value_prop > navigation
const CRO_SELECTORS = {
  cta: [
    'button', '[role="button"]', 'a.cta', '.buy-now', '.add-to-cart',
    '[class*="cta"]', '[class*="button"]', 'input[type="submit"]'
  ],
  form: [
    'form', 'input:not([type="hidden"])', 'select', 'textarea', '[role="form"]'
  ],
  trust: [
    '.trust-badge', '.security-seal', '.reviews', '.guarantee',
    '[class*="trust"]', '[class*="secure"]', 'img[alt*="ssl"]',
    '[class*="testimonial"]', '[class*="rating"]'
  ],
  value_prop: [
    'h1', '.hero-text', '.value-proposition', '.headline',
    '[class*="hero"]', '[class*="headline"]', '[class*="tagline"]'
  ],
  navigation: [
    'nav', '.breadcrumb', '.menu', '[role="navigation"]',
    '[class*="nav"]', '.search', '[type="search"]'
  ]
};
```

### Initial Heuristic Rules (10)

| ID | Rule | Severity | Condition |
|----|------|----------|-----------|
| H001 | Vague CTA Text | Medium | CTA text is generic (Learn More, Click Here, Submit) |
| H002 | Missing CTA Above Fold | High | No CTA visible in viewport on load |
| H003 | Form Field Overload | High | Form has >5 visible fields |
| H004 | Missing Field Labels | Medium | Input without associated label |
| H005 | No Trust Signals | Medium | No trust elements above fold |
| H006 | Unclear Value Prop | High | H1 is generic or missing |
| H007 | Missing Breadcrumbs | Low | Category/product page without breadcrumbs |
| H008 | No Search | Low | E-commerce site without search |
| H009 | Small Touch Targets | Medium | Button/link <44px height on mobile |
| H010 | Competing CTAs | Medium | Multiple primary CTAs in same section |

### Dependencies (New)

```json
{
  "@langchain/core": "^0.3.x"  // Already peer dep of @langchain/openai
}
```

No new production dependencies required. Zod already installed.

### Test Strategy (CRO Agent)

**Unit Tests**:
- DOM extraction with mock HTML
- Tool registry registration/execution
- Output parser validation
- Heuristic rule checks
- Serializer token counting

**Integration Tests**:
- CROAgent with real page (example.com)
- Tool execution with mock page state
- Business type detection

**E2E Tests**:
- Full CRO analysis on 3 test sites (ecommerce, saas, other)
- Verify insights generated
- Verify hypothesis output
- Verify report format
