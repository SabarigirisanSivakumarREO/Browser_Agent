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
- Load `https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711`
- Verify page title extracted
- Verify no errors

### Test Case 2: Data Extraction Accuracy (US2)
- Load page with known heading structure
- Verify all h1-h6 captured
- Verify correct hierarchy levels
- Verify document order preserved

### Test Case 3: End-to-End Multi-URL Workflow (US1-US4)
- Process 3 different URLs sequentially:
  1. `https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711` (simple)
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

#### 8. Tools Module (`src/agent/tools/`)

**Responsibility**: Tool registration, validation, execution, and CRO-specific analysis

**Design Decision**: Interface-based tools (not abstract class) for simplicity. ToolExecutor owns validation, timing, and error handling. This avoids the complexity of class inheritance while maintaining testability.

**Components**:
- `types.ts`: Tool, ToolContext, ToolDefinitionForLLM interfaces
- `tool-registry.ts`: ToolRegistry class for tool storage and retrieval
- `tool-executor.ts`: ToolExecutor class for validation and execution
- `index.ts`: Module exports

**Directory Structure**:
```
src/agent/tools/
├── index.ts              # Module exports
├── types.ts              # Tool, ToolContext, ToolDefinitionForLLM
├── tool-registry.ts      # ToolRegistry class
└── tool-executor.ts      # ToolExecutor class
```

**Key Interfaces** (src/agent/tools/types.ts):
```typescript
import type { Page } from 'playwright';
import type { ZodSchema } from 'zod';
import type { PageState, CROInsight, CROActionName } from '../../models/index.js';
import type { Logger } from '../../utils/index.js';

/**
 * Context injected into tool execution
 */
export interface ToolContext {
  params: unknown;          // Raw params (validated by executor)
  page: Page;               // Playwright page instance
  state: PageState;         // Current page state with DOM tree
  logger: Logger;           // Scoped logger for tool
}

/**
 * Tool execution result (re-exported from models for convenience)
 */
export { ToolResult } from '../../models/index.js';

/**
 * Tool interface - all CRO tools implement this
 * Design: Interface-based, not abstract class, for simplicity
 */
export interface Tool {
  /** Tool name matching CROActionName */
  readonly name: CROActionName;

  /** Human-readable description for LLM context */
  readonly description: string;

  /** Zod schema for params validation */
  readonly parameters: ZodSchema;

  /**
   * Execute the tool
   * @param context - Injected context with validated params
   * @returns ToolResult with success, insights, optional extracted data
   */
  execute(context: ToolContext): Promise<ToolResult>;
}

/**
 * LLM-friendly tool definition (no execute function)
 * Used by ToolRegistry.getToolDefinitions() for system prompt
 */
export interface ToolDefinitionForLLM {
  name: CROActionName;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema from Zod
}
```

**ToolRegistry** (src/agent/tools/tool-registry.ts):
```typescript
import type { Tool, ToolDefinitionForLLM } from './types.js';
import type { CROActionName } from '../../models/index.js';
import { createLogger } from '../../utils/index.js';
import { zodToJsonSchema } from 'zod-to-json-schema';  // Optional, for LLM

export class ToolRegistry {
  private tools: Map<CROActionName, Tool> = new Map();
  private logger = createLogger('ToolRegistry');

  /**
   * Register a tool. Throws if duplicate name.
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    this.logger.debug(`Registered tool: ${tool.name}`);
  }

  /**
   * Get tool by name. Returns undefined if not found.
   */
  get(name: CROActionName): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if tool exists
   */
  has(name: CROActionName): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool definitions for LLM system prompt
   * Returns name + description only (no execute function)
   */
  getToolDefinitions(): ToolDefinitionForLLM[] {
    return this.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: this.schemaToJson(tool.parameters),
    }));
  }

  /**
   * Convert Zod schema to JSON Schema for LLM
   */
  private schemaToJson(schema: ZodSchema): Record<string, unknown> {
    try {
      return zodToJsonSchema(schema) as Record<string, unknown>;
    } catch {
      return { type: 'object' };  // Fallback
    }
  }

  /**
   * Clear all tools (for testing)
   */
  clear(): void {
    this.tools.clear();
  }
}
```

**ToolExecutor** (src/agent/tools/tool-executor.ts):
```typescript
import type { Tool, ToolContext } from './types.js';
import type { ToolResult, CROActionName, PageState } from '../../models/index.js';
import type { Page } from 'playwright';
import type { ToolRegistry } from './tool-registry.js';
import { createLogger, Logger } from '../../utils/index.js';

export interface ExecutionContext {
  page: Page;
  state: PageState;
}

export class ToolExecutor {
  private logger = createLogger('ToolExecutor');

  constructor(private registry: ToolRegistry) {}

  /**
   * Execute a tool by name with params
   *
   * Flow:
   * 1. Look up tool in registry
   * 2. Validate params against tool.parameters schema
   * 3. Execute tool with injected context
   * 4. Track execution time
   * 5. Handle errors gracefully
   *
   * @returns ToolResult - always returns, never throws
   */
  async execute(
    name: CROActionName,
    params: unknown,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const start = Date.now();
    const toolLogger = createLogger(`Tool:${name}`);

    // Step 1: Look up tool
    const tool = this.registry.get(name);
    if (!tool) {
      this.logger.warn(`Unknown tool: ${name}`);
      return {
        success: false,
        insights: [],
        error: `Unknown tool: ${name}`,
        executionTimeMs: Date.now() - start,
      };
    }

    // Step 2: Validate params
    const validation = tool.parameters.safeParse(params);
    if (!validation.success) {
      const errorMsg = this.formatZodError(validation.error);
      this.logger.warn(`Validation failed for ${name}: ${errorMsg}`);
      return {
        success: false,
        insights: [],
        error: `Invalid params for ${name}: ${errorMsg}`,
        executionTimeMs: Date.now() - start,
      };
    }

    // Step 3: Execute with injected context
    this.logger.info(`Executing tool: ${name}`, { params: validation.data });

    try {
      const toolContext: ToolContext = {
        params: validation.data,
        page: context.page,
        state: context.state,
        logger: toolLogger,
      };

      const result = await tool.execute(toolContext);
      result.executionTimeMs = Date.now() - start;

      this.logger.info(`Tool completed: ${name}`, {
        success: result.success,
        insightCount: result.insights.length,
        durationMs: result.executionTimeMs,
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Tool execution failed: ${name}`, { error: errorMsg });

      return {
        success: false,
        insights: [],
        error: `Tool execution failed: ${errorMsg}`,
        executionTimeMs: Date.now() - start,
      };
    }
  }

  /**
   * Format Zod error for user-friendly message
   */
  private formatZodError(error: z.ZodError): string {
    return error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
  }
}
```

**Module Exports** (src/agent/tools/index.ts):
```typescript
export type { Tool, ToolContext, ToolDefinitionForLLM } from './types.js';
export { ToolRegistry } from './tool-registry.js';
export { ToolExecutor, type ExecutionContext } from './tool-executor.js';
```

**CRO Tool Implementation Pattern** (for Phase 17):
```typescript
// Example: src/agent/tools/cro/analyze-cta-tool.ts
import { z } from 'zod';
import type { Tool, ToolContext, ToolResult } from '../types.js';

const AnalyzeCTAParams = z.object({
  focusIndex: z.number().optional().describe('Specific element index to analyze'),
  includeSecondary: z.boolean().default(true).describe('Include secondary CTAs'),
});

export const analyzeCTATool: Tool = {
  name: 'analyze_ctas',
  description: 'Analyze call-to-action buttons for text clarity, placement, prominence, and conversion potential',
  parameters: AnalyzeCTAParams,

  async execute(context: ToolContext): Promise<ToolResult> {
    const { params, state, logger } = context;
    const typedParams = params as z.infer<typeof AnalyzeCTAParams>;

    logger.debug('Analyzing CTAs', typedParams);

    // Implementation here...
    const insights = [];

    return {
      success: true,
      insights,
      extracted: { ctaCount: 0 },  // Raw data for debugging
    };
  },
};
```

**ToolResult** (already in models, enhanced):
```typescript
interface ToolResult {
  success: boolean;
  insights: CROInsight[];
  extracted?: unknown;        // Raw data for debugging
  error?: string;             // Error message if !success
  executionTimeMs?: number;   // Set by ToolExecutor
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

---

### Phase 16: Agent Core Implementation Details

**Purpose**: Implement the main agent loop with observe→reason→act pattern

**Directory Structure**:
```
src/agent/
├── index.ts              # Module exports (update for Phase 16)
├── prompt-builder.ts     # NEW: System prompt construction
├── message-manager.ts    # NEW: Conversation history
├── state-manager.ts      # NEW: Agent state transitions
├── cro-agent.ts          # NEW: Main CROAgent class
└── tools/                # Existing from Phase 15
    ├── index.ts
    ├── types.ts
    ├── tool-registry.ts
    ├── tool-executor.ts
    └── cro/
        └── analyze-ctas.ts

src/prompts/
└── system-cro.md         # NEW: System prompt template
```

#### PromptBuilder (`src/agent/prompt-builder.ts`)

**Responsibility**: Construct system and user prompts for LLM

```typescript
import { ToolRegistry } from './tools/index.js';
import type { PageState, CROMemory } from '../models/index.js';
import { DOMSerializer } from '../browser/dom/index.js';

export class PromptBuilder {
  private systemPromptTemplate: string;

  constructor(private registry: ToolRegistry) {
    // Load template from src/prompts/system-cro.md
    this.systemPromptTemplate = this.loadTemplate();
  }

  /**
   * Build complete system prompt with tools injected
   */
  buildSystemPrompt(): string {
    const toolsSection = this.formatToolsSection();
    return this.systemPromptTemplate.replace('{{TOOLS_PLACEHOLDER}}', toolsSection);
  }

  /**
   * Build user message with current page state and memory
   */
  buildUserMessage(state: PageState, memory: CROMemory): string {
    const serializer = new DOMSerializer();
    const serialized = serializer.serialize(state.domTree);

    return `
<page_url>${state.url}</page_url>
<page_title>${state.title}</page_title>
<viewport>${state.viewport.width}x${state.viewport.height}</viewport>
<scroll_position>x:${state.scrollPosition.x}, y:${state.scrollPosition.y}</scroll_position>

<cro_elements>
${serialized.output}
</cro_elements>

<memory>
Current focus: ${memory.currentFocus}
Steps completed: ${memory.stepHistory.length}
Findings so far: ${memory.findings.length} insights
${memory.errors.length > 0 ? `Recent errors: ${memory.errors.slice(-2).join(', ')}` : ''}
</memory>

Analyze the page and decide your next action.`;
  }

  private formatToolsSection(): string {
    const tools = this.registry.getToolDefinitions();
    return tools.map(t =>
      `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters, null, 2)}`
    ).join('\n\n');
  }

  private loadTemplate(): string {
    // Read from src/prompts/system-cro.md
    // In implementation, use fs.readFileSync or embed at build time
  }
}
```

#### MessageManager (`src/agent/message-manager.ts`)

**Responsibility**: Manage LangChain message history

```typescript
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import type { CROAgentOutput } from '../models/index.js';

export class MessageManager {
  private messages: BaseMessage[] = [];
  private systemMessage: SystemMessage;

  constructor(systemPrompt: string) {
    this.systemMessage = new SystemMessage(systemPrompt);
  }

  /**
   * Add user message (page state + memory context)
   */
  addUserMessage(content: string): void {
    this.messages.push(new HumanMessage(content));
  }

  /**
   * Add assistant message (agent output)
   */
  addAssistantMessage(output: CROAgentOutput): void {
    this.messages.push(new AIMessage(JSON.stringify(output)));
  }

  /**
   * Get all messages for LLM call
   */
  getMessages(): BaseMessage[] {
    return [this.systemMessage, ...this.messages];
  }

  /**
   * Get message count (excluding system)
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Clear conversation history (keeps system message)
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Trim to limit for token management
   * Keeps system message + last N messages
   */
  trimToLimit(maxMessages: number): void {
    if (this.messages.length > maxMessages) {
      this.messages = this.messages.slice(-maxMessages);
    }
  }
}
```

#### StateManager (`src/agent/state-manager.ts`)

**Responsibility**: Manage agent state transitions and termination conditions

```typescript
import type {
  CROAgentOptions, AgentState, CROInsight, StepRecord, CROMemory
} from '../models/index.js';
import { DEFAULT_CRO_OPTIONS, createInitialState } from '../models/index.js';

export class StateManager {
  private state: AgentState;
  private options: CROAgentOptions;

  constructor(options?: Partial<CROAgentOptions>) {
    this.options = { ...DEFAULT_CRO_OPTIONS, ...options };
    this.state = createInitialState();
  }

  // ─── State Accessors ───────────────────────────────────────────
  getState(): AgentState { return { ...this.state }; }
  getStep(): number { return this.state.step; }
  getInsights(): CROInsight[] { return [...this.state.insights]; }
  isDone(): boolean { return this.state.isDone; }
  getMemory(): CROMemory { return { ...this.state.memory }; }

  // ─── Step Management ───────────────────────────────────────────
  incrementStep(): void {
    this.state.step++;
    this.state.lastActionTime = Date.now();
  }

  setDone(reason: string): void {
    this.state.isDone = true;
    this.state.doneReason = reason;
  }

  // ─── Failure Tracking (FR-023, CR-014) ─────────────────────────
  recordFailure(error: string): void {
    this.state.consecutiveFailures++;
    this.state.totalFailures++;
    this.state.memory.errors.push(error);
  }

  resetFailures(): void {
    this.state.consecutiveFailures = 0;
    // Note: totalFailures is NOT reset
  }

  shouldTerminate(): boolean {
    return (
      this.state.step >= this.options.maxSteps ||
      this.state.consecutiveFailures >= this.options.failureLimit ||
      this.state.isDone
    );
  }

  getTerminationReason(): string {
    if (this.state.isDone) return this.state.doneReason || 'Agent completed';
    if (this.state.step >= this.options.maxSteps) return 'Max steps reached';
    if (this.state.consecutiveFailures >= this.options.failureLimit) return 'Too many failures';
    return 'Unknown';
  }

  // ─── Insight Management ────────────────────────────────────────
  addInsight(insight: CROInsight): void {
    this.state.insights.push(insight);
    this.state.memory.findings.push(insight);
  }

  addInsights(insights: CROInsight[]): void {
    insights.forEach(i => this.addInsight(i));
  }

  // ─── Memory Management ─────────────────────────────────────────
  recordStep(record: StepRecord): void {
    this.state.memory.stepHistory.push(record);
  }

  updateFocus(focus: string): void {
    this.state.memory.currentFocus = focus;
  }

  addPageSeen(url: string): void {
    if (!this.state.memory.pagesSeen.includes(url)) {
      this.state.memory.pagesSeen.push(url);
    }
  }
}
```

#### CROAgent (`src/agent/cro-agent.ts`)

**Responsibility**: Main agent orchestrating the observe→reason→act loop

```typescript
import { ChatOpenAI } from '@langchain/openai';
import type { CROAgentOptions, CROInsight, PageState } from '../models/index.js';
import { DEFAULT_CRO_OPTIONS, parseAgentOutput } from '../models/index.js';
import { BrowserManager, PageLoader } from '../browser/index.js';
import { DOMExtractor } from '../browser/dom/index.js';
import { ToolRegistry, ToolExecutor } from './tools/index.js';
import { PromptBuilder } from './prompt-builder.js';
import { MessageManager } from './message-manager.js';
import { StateManager } from './state-manager.js';
import { createCRORegistry } from './tools/create-cro-registry.js';
import { createLogger } from '../utils/index.js';

export interface CROAnalysisResult {
  url: string;
  success: boolean;
  insights: CROInsight[];
  stepsExecuted: number;
  totalTimeMs: number;
  terminationReason: string;
  errors: string[];
}

export class CROAgent {
  private options: CROAgentOptions;
  private logger = createLogger('CROAgent');
  private browserManager?: BrowserManager;

  constructor(options?: Partial<CROAgentOptions>) {
    this.options = { ...DEFAULT_CRO_OPTIONS, ...options };
  }

  async analyze(url: string): Promise<CROAnalysisResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // ─── 1. INITIALIZE ─────────────────────────────────────────
      this.browserManager = new BrowserManager();
      await this.browserManager.launch();
      const page = this.browserManager.getPage();

      const pageLoader = new PageLoader(page, { timeout: 60000 });
      await pageLoader.load(url);

      const domExtractor = new DOMExtractor();
      const domTree = await domExtractor.extract(page);

      const registry = createCRORegistry();
      const toolExecutor = new ToolExecutor(registry);
      const stateManager = new StateManager(this.options);
      const promptBuilder = new PromptBuilder(registry);
      const messageManager = new MessageManager(promptBuilder.buildSystemPrompt());

      const llm = new ChatOpenAI({
        model: 'gpt-4o',
        temperature: 0,
        timeout: this.options.llmTimeoutMs,
      });

      stateManager.addPageSeen(url);

      // ─── 2. AGENT LOOP ─────────────────────────────────────────
      while (!stateManager.shouldTerminate()) {
        const step = stateManager.getStep();
        this.logger.info(`Step ${step + 1}/${this.options.maxSteps}`);

        // a. OBSERVE: Build PageState
        const pageState = await this.buildPageState(page, domTree, url);

        // b. REASON: Call LLM
        const userMsg = promptBuilder.buildUserMessage(pageState, stateManager.getMemory());
        messageManager.addUserMessage(userMsg);

        let llmResponse: string;
        try {
          const result = await llm.invoke(messageManager.getMessages());
          llmResponse = result.content as string;
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : 'LLM call failed';
          this.logger.error('LLM timeout/error', { error: errMsg });
          stateManager.recordFailure(errMsg);
          errors.push(errMsg);
          stateManager.incrementStep();
          continue;
        }

        // Parse LLM output
        const parseResult = parseAgentOutput(llmResponse);
        if (!parseResult.success) {
          this.logger.warn('Invalid LLM output', { error: parseResult.error });
          stateManager.recordFailure(parseResult.error!);
          errors.push(`Parse error: ${parseResult.error}`);
          stateManager.incrementStep();
          continue;
        }

        const output = parseResult.output!;
        messageManager.addAssistantMessage(output);
        stateManager.updateFocus(output.next_goal);

        // c. ACT: Execute tool
        const toolResult = await toolExecutor.execute(
          output.action.name,
          output.action.params || {},
          { page, state: pageState }
        );

        if (toolResult.success) {
          stateManager.resetFailures();
          stateManager.addInsights(toolResult.insights);
          this.logger.info('Tool success', {
            tool: output.action.name,
            insights: toolResult.insights.length,
          });
        } else {
          stateManager.recordFailure(toolResult.error || 'Tool failed');
          errors.push(`Tool error: ${toolResult.error}`);
        }

        stateManager.recordStep({
          step,
          action: output.action.name,
          params: output.action.params,
          result: toolResult,
          thinking: output.thinking,
          timestamp: Date.now(),
        });

        // d. CHECK: Done action?
        if (output.action.name === 'done') {
          stateManager.setDone('Agent completed analysis');
        }

        // e. WAIT (CR-011)
        await this.sleep(this.options.actionWaitMs);

        // f. INCREMENT
        stateManager.incrementStep();

        // Re-extract DOM if scroll or navigation changed page
        if (['scroll_page', 'click'].includes(output.action.name)) {
          domTree = await domExtractor.extract(page);
        }
      }

      // ─── 3. CLEANUP & RETURN ───────────────────────────────────
      return {
        url,
        success: true,
        insights: stateManager.getInsights(),
        stepsExecuted: stateManager.getStep(),
        totalTimeMs: Date.now() - startTime,
        terminationReason: stateManager.getTerminationReason(),
        errors,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Analysis failed', { error: errMsg });
      return {
        url,
        success: false,
        insights: [],
        stepsExecuted: 0,
        totalTimeMs: Date.now() - startTime,
        terminationReason: `Error: ${errMsg}`,
        errors: [errMsg],
      };
    } finally {
      await this.close();
    }
  }

  async close(): Promise<void> {
    if (this.browserManager) {
      await this.browserManager.close();
      this.browserManager = undefined;
    }
  }

  private async buildPageState(page: any, domTree: any, url: string): Promise<PageState> {
    const title = await page.title();
    const viewport = page.viewportSize() || { width: 1280, height: 720 };
    const scroll = await page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY,
      maxX: document.documentElement.scrollWidth - window.innerWidth,
      maxY: document.documentElement.scrollHeight - window.innerHeight,
    }));

    return {
      url,
      title,
      domTree,
      viewport: { ...viewport, deviceScaleFactor: 1, isMobile: false },
      scrollPosition: scroll,
      timestamp: Date.now(),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### Test Strategy for Phase 16

**Unit Tests (40 tests)**:
- PromptBuilder: 10 tests (sections, tools injection, user message format)
- MessageManager: 12 tests (message types, ordering, trimming)
- StateManager: 18 tests (state transitions, termination conditions)

**Integration Tests (15 tests)**:
- CROAgent with mock LLM returning controlled responses
- Full loop execution with mock tools
- Failure handling and retry logic
- State accumulation across steps

**E2E Tests (8 tests)**:
- Real LLM (GPT-4o-mini) with simple test page
- Verify insights generated
- Verify termination behavior
- Performance within acceptable bounds

---

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

---

### Phase 17: CRO Tools Implementation Details

**Purpose**: Implement all CRO-specific tools with defined schemas, insight types, and tests.

**Directory Structure**:
```
src/agent/tools/cro/
├── index.ts              # Barrel exports
├── analyze-ctas.ts       # ✅ EXISTS (Phase 15b)
├── scroll-tool.ts        # NEW (T091)
├── click-tool.ts         # NEW (T092)
├── analyze-forms-tool.ts # NEW (T093)
├── analyze-trust-tool.ts # NEW (T094)
├── analyze-value-prop-tool.ts # NEW (T095)
├── record-insight-tool.ts # NEW (T096)
└── done-tool.ts          # NEW (T097)
```

#### Tool Categories

**1. Navigation Tools** - Change page state, return no insights

| Tool | Purpose | Parameters | Returns |
|------|---------|------------|---------|
| `scroll_page` | Scroll viewport | direction, amount | newY, atBottom |
| `click` | Click element | elementIndex, waitForNavigation | clickedElement |

**2. Analysis Tools** - Examine elements, return CROInsight[]

| Tool | Purpose | Parameters | Insight Count |
|------|---------|------------|---------------|
| `analyze_ctas` | CTA clarity/placement | focusArea, minConfidence | 6 types |
| `analyze_forms` | Form UX issues | formSelector, includeHidden | 6 types |
| `detect_trust_signals` | Trust signal presence | focusArea | 5 types |
| `assess_value_prop` | Headline clarity | checkH1Only | 5 types |

**3. Control Tools** - Agent state management

| Tool | Purpose | Parameters | Behavior |
|------|---------|------------|----------|
| `record_insight` | Manual insight | type, severity, issue, recommendation | Creates CROInsight |
| `done` | Signal completion | summary, confidenceScore | Triggers agent exit |

#### Tool Interface Implementations

**scroll-tool.ts** (T091):
```typescript
import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';

export const ScrollParamsSchema = z.object({
  direction: z.enum(['up', 'down', 'top', 'bottom']),
  amount: z.number().positive().optional().default(500),
});

export const scrollTool: Tool = {
  name: 'scroll_page',
  description: 'Scroll the page to reveal more content. Use to analyze below-the-fold elements.',
  parameters: ScrollParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as z.infer<typeof ScrollParamsSchema>;
    const page = context.page;

    const previousY = await page.evaluate(() => window.scrollY);

    switch (params.direction) {
      case 'down':
        await page.evaluate((amt) => window.scrollBy(0, amt), params.amount);
        break;
      case 'up':
        await page.evaluate((amt) => window.scrollBy(0, -amt), params.amount);
        break;
      case 'top':
        await page.evaluate(() => window.scrollTo(0, 0));
        break;
      case 'bottom':
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        break;
    }

    const newY = await page.evaluate(() => window.scrollY);
    const maxY = await page.evaluate(() =>
      document.documentElement.scrollHeight - window.innerHeight
    );

    return {
      success: true,
      insights: [], // Navigation tool - no insights
      extracted: {
        previousY,
        newY,
        atTop: newY === 0,
        atBottom: newY >= maxY - 1,
      },
    };
  },
};
```

**click-tool.ts** (T092):
```typescript
import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult, DOMNode } from '../../../models/index.js';

export const ClickParamsSchema = z.object({
  elementIndex: z.number().int().positive(),
  waitForNavigation: z.boolean().optional().default(false),
});

export const clickTool: Tool = {
  name: 'click',
  description: 'Click an element by its index number. Use for expanding sections or testing interactions.',
  parameters: ClickParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as z.infer<typeof ClickParamsSchema>;
    const { page, state, logger } = context;

    // Find element by index in DOM tree
    const element = findElementByIndex(state.domTree.root, params.elementIndex);

    if (!element) {
      return {
        success: false,
        insights: [],
        error: `Element with index ${params.elementIndex} not found`,
      };
    }

    if (!element.isVisible) {
      return {
        success: false,
        insights: [],
        error: `Element ${params.elementIndex} is not visible`,
      };
    }

    try {
      const locator = page.locator(`xpath=${element.xpath}`);

      if (params.waitForNavigation) {
        await Promise.all([
          page.waitForNavigation({ timeout: 5000 }).catch(() => null),
          locator.click(),
        ]);
      } else {
        await locator.click();
      }

      const navigationOccurred = page.url() !== state.url;

      return {
        success: true,
        insights: [],
        extracted: {
          clickedElement: element.xpath,
          elementText: element.text,
          navigationOccurred,
        },
      };
    } catch (error) {
      return {
        success: false,
        insights: [],
        error: `Click failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

function findElementByIndex(node: DOMNode, index: number): DOMNode | null {
  if (node.index === index) return node;
  for (const child of node.children) {
    const found = findElementByIndex(child, index);
    if (found) return found;
  }
  return null;
}
```

**analyze-forms-tool.ts** (T093):
```typescript
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult, CROInsight, DOMNode } from '../../../models/index.js';

export const AnalyzeFormsParamsSchema = z.object({
  formSelector: z.string().optional(),
  includeHiddenFields: z.boolean().optional().default(false),
});

// Insight type constants
const INSIGHT_TYPES = {
  FORM_FIELD_OVERLOAD: 'form_field_overload',
  MISSING_FIELD_LABEL: 'missing_field_label',
  MISSING_INPUT_TYPE: 'missing_input_type',
  NO_REQUIRED_INDICATOR: 'no_required_indicator',
  NO_ERROR_CONTAINER: 'no_error_container',
  NO_SUBMIT_BUTTON: 'no_submit_button',
} as const;

export const analyzeFormsTool: Tool = {
  name: 'analyze_forms',
  description: 'Analyze form elements for UX issues: field count, labels, validation, submit buttons.',
  parameters: AnalyzeFormsParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as z.infer<typeof AnalyzeFormsParamsSchema>;
    const insights: CROInsight[] = [];
    const forms: DOMNode[] = [];

    collectForms(context.state.domTree.root, forms);
    context.logger.debug(`Found ${forms.length} forms`);

    for (const form of forms) {
      const fields = getFormFields(form, params.includeHiddenFields);

      // F001: Form Field Overload (>5 fields)
      if (fields.length > 5) {
        insights.push({
          id: randomUUID().slice(0, 8),
          type: INSIGHT_TYPES.FORM_FIELD_OVERLOAD,
          severity: 'high',
          element: form.xpath,
          issue: `Form has ${fields.length} fields. Forms with >5 fields have higher abandonment rates`,
          recommendation: 'Reduce to essential fields only. Consider multi-step form or progressive disclosure',
          category: 'form',
        });
      }

      // F002-F006: Additional checks per field...
      for (const field of fields) {
        // F002: Missing label
        if (!hasLabel(field)) {
          insights.push({
            id: randomUUID().slice(0, 8),
            type: INSIGHT_TYPES.MISSING_FIELD_LABEL,
            severity: 'medium',
            element: field.xpath,
            issue: 'Input field missing visible label or placeholder',
            recommendation: 'Add descriptive label above field for clarity',
            category: 'form',
          });
        }

        // F003: Missing input type
        if (field.tagName === 'INPUT' && !hasInputType(field)) {
          insights.push({
            id: randomUUID().slice(0, 8),
            type: INSIGHT_TYPES.MISSING_INPUT_TYPE,
            severity: 'medium',
            element: field.xpath,
            issue: 'Input lacks type attribute, defaults to text',
            recommendation: 'Specify type (email, tel, number) for mobile keyboard optimization',
            category: 'form',
          });
        }
      }

      // F006: No submit button
      if (!hasSubmitButton(form)) {
        insights.push({
          id: randomUUID().slice(0, 8),
          type: INSIGHT_TYPES.NO_SUBMIT_BUTTON,
          severity: 'high',
          element: form.xpath,
          issue: 'Form has no visible submit button',
          recommendation: 'Add clear submit button with action-oriented text',
          category: 'form',
        });
      }
    }

    return {
      success: true,
      insights,
      extracted: {
        totalForms: forms.length,
        totalFields: forms.reduce((sum, f) => sum + getFormFields(f, false).length, 0),
      },
    };
  },
};

// Helper functions omitted for brevity
```

**analyze-trust-tool.ts** (T094):
```typescript
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult, CROInsight, DOMNode } from '../../../models/index.js';

export const AnalyzeTrustParamsSchema = z.object({
  focusArea: z.string().optional().default('full_page'),
}).transform((data) => ({
  focusArea: normalizeAreaParam(data.focusArea), // Handles LLM variations like "aboveFold", "above-fold"
}));

const INSIGHT_TYPES = {
  NO_TRUST_SIGNALS: 'no_trust_signals',
  NO_REVIEWS: 'no_reviews',
  NO_SECURITY_BADGE: 'no_security_badge',
  TRUST_SIGNAL_PLACEMENT: 'trust_signal_placement',
  UNVERIFIED_CLAIMS: 'unverified_claims',
} as const;

export const analyzeTrustTool: Tool = {
  name: 'detect_trust_signals',
  description: 'Detect trust signals: reviews, badges, testimonials, security seals, guarantees.',
  parameters: AnalyzeTrustParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as z.infer<typeof AnalyzeTrustParamsSchema>;
    const insights: CROInsight[] = [];
    const trustElements: DOMNode[] = [];

    collectTrustElements(context.state.domTree.root, trustElements);

    // Filter by focus area
    let targetElements = trustElements;
    if (params.focusArea === 'above_fold') {
      const vh = context.state.viewport.height;
      targetElements = trustElements.filter(e => e.boundingBox && e.boundingBox.y < vh);
    }

    // TR001: No trust signals above fold
    const aboveFoldTrust = trustElements.filter(e =>
      e.boundingBox && e.boundingBox.y < context.state.viewport.height
    );
    if (aboveFoldTrust.length === 0) {
      insights.push({
        id: randomUUID().slice(0, 8),
        type: INSIGHT_TYPES.NO_TRUST_SIGNALS,
        severity: 'medium',
        element: '',
        issue: 'No trust signals visible above the fold',
        recommendation: 'Add trust badges, ratings, or testimonials near primary CTA',
        category: 'trust',
      });
    }

    // TR002-TR005: Additional checks...

    return {
      success: true,
      insights,
      extracted: {
        totalTrustElements: trustElements.length,
        aboveFoldCount: aboveFoldTrust.length,
      },
    };
  },
};
```

**analyze-value-prop-tool.ts** (T095):
```typescript
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult, CROInsight, DOMNode } from '../../../models/index.js';

export const AnalyzeValuePropParamsSchema = z.object({
  checkH1Only: z.boolean().optional().default(false),
});

const INSIGHT_TYPES = {
  MISSING_H1: 'missing_h1',
  MULTIPLE_H1: 'multiple_h1',
  GENERIC_HEADLINE: 'generic_headline',
  NO_SUBHEADLINE: 'no_subheadline',
  HEADLINE_TOO_LONG: 'headline_too_long',
} as const;

const GENERIC_PATTERNS = [
  /^welcome$/i,
  /^home$/i,
  /^homepage$/i,
  /^untitled$/i,
  /^page\s*\d*$/i,
];

export const analyzeValuePropTool: Tool = {
  name: 'assess_value_prop',
  description: 'Analyze headlines and value proposition clarity. Checks H1/H2 for specificity and benefit communication.',
  parameters: AnalyzeValuePropParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as z.infer<typeof AnalyzeValuePropParamsSchema>;
    const insights: CROInsight[] = [];
    const valueProps: DOMNode[] = [];

    collectValueProps(context.state.domTree.root, valueProps);

    const h1Elements = valueProps.filter(e => e.tagName === 'H1');
    const h2Elements = valueProps.filter(e => e.tagName === 'H2');

    // VP001: Missing H1
    if (h1Elements.length === 0) {
      insights.push({
        id: randomUUID().slice(0, 8),
        type: INSIGHT_TYPES.MISSING_H1,
        severity: 'high',
        element: '',
        issue: 'Page has no H1 heading. Primary value proposition unclear',
        recommendation: 'Add clear H1 that communicates core benefit or offering',
        category: 'value_prop',
      });
    }

    // VP002: Multiple H1
    if (h1Elements.length > 1) {
      insights.push({
        id: randomUUID().slice(0, 8),
        type: INSIGHT_TYPES.MULTIPLE_H1,
        severity: 'medium',
        element: h1Elements[1]?.xpath || '',
        issue: `Page has ${h1Elements.length} H1 elements. Dilutes focus`,
        recommendation: 'Use single H1 for main value prop, H2-H6 for sections',
        category: 'value_prop',
      });
    }

    // VP003: Generic headline
    for (const h1 of h1Elements) {
      const text = h1.text?.trim() || '';
      if (GENERIC_PATTERNS.some(p => p.test(text))) {
        insights.push({
          id: randomUUID().slice(0, 8),
          type: INSIGHT_TYPES.GENERIC_HEADLINE,
          severity: 'medium',
          element: h1.xpath,
          issue: `Generic H1: "${text}". Fails to communicate value`,
          recommendation: 'Rewrite to highlight specific benefit or unique value',
          category: 'value_prop',
          evidence: { text },
        });
      }

      // VP005: Headline too long
      const wordCount = text.split(/\s+/).length;
      if (wordCount > 10) {
        insights.push({
          id: randomUUID().slice(0, 8),
          type: INSIGHT_TYPES.HEADLINE_TOO_LONG,
          severity: 'low',
          element: h1.xpath,
          issue: `H1 has ${wordCount} words. May lose reader attention`,
          recommendation: 'Condense to <10 words, move details to subheadline',
          category: 'value_prop',
          evidence: { text },
        });
      }
    }

    // VP004: No subheadline
    if (h1Elements.length > 0 && h2Elements.length === 0) {
      insights.push({
        id: randomUUID().slice(0, 8),
        type: INSIGHT_TYPES.NO_SUBHEADLINE,
        severity: 'low',
        element: '',
        issue: 'H1 present but no H2 to support value proposition',
        recommendation: 'Add H2 subheadline to elaborate on primary benefit',
        category: 'value_prop',
      });
    }

    return {
      success: true,
      insights,
      extracted: {
        h1Count: h1Elements.length,
        h2Count: h2Elements.length,
        h1Text: h1Elements[0]?.text || null,
      },
    };
  },
};
```

**record-insight-tool.ts** (T096):
```typescript
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult, CROInsight } from '../../../models/index.js';

export const RecordInsightParamsSchema = z.object({
  type: z.string().min(1),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  element: z.string().optional(),
  issue: z.string().min(1),
  recommendation: z.string().min(1),
  category: z.string().optional().default('custom'),
});

export const recordInsightTool: Tool = {
  name: 'record_insight',
  description: 'Manually record a CRO observation. Use when you identify an issue not covered by other tools.',
  parameters: RecordInsightParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as z.infer<typeof RecordInsightParamsSchema>;
    const insightId = randomUUID().slice(0, 8);

    const insight: CROInsight = {
      id: insightId,
      type: params.type,
      severity: params.severity,
      element: params.element || '',
      issue: params.issue,
      recommendation: params.recommendation,
      category: params.category,
    };

    context.logger.info('Recorded manual insight', { id: insightId, type: params.type });

    return {
      success: true,
      insights: [insight],
      extracted: { insightId },
    };
  },
};
```

**done-tool.ts** (T097):
```typescript
import { z } from 'zod';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult } from '../../../models/index.js';

export const DoneParamsSchema = z.object({
  summary: z.string().min(1).describe('Brief summary of analysis findings'),
  confidenceScore: z.number().min(0).max(1).optional().describe('Confidence in analysis completeness (0-1)'),
});

export const doneTool: Tool = {
  name: 'done',
  description: 'Signal analysis completion. Call when all CRO aspects have been examined or no more actionable elements.',
  parameters: DoneParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as z.infer<typeof DoneParamsSchema>;

    context.logger.info('Analysis complete', { summary: params.summary });

    // Note: CROAgent checks action.name === 'done' to set isDone state
    // This tool just validates params and returns success

    return {
      success: true,
      insights: [], // Control tool - no insights
      extracted: {
        summary: params.summary,
        confidenceScore: params.confidenceScore ?? null,
      },
    };
  },
};
```

#### Updated CROActionNames

```typescript
// src/models/tool-definition.ts
export const CROActionNames = [
  // Analysis tools
  'analyze_ctas',
  'analyze_forms',
  'detect_trust_signals',
  'assess_value_prop',
  'check_navigation',
  'find_friction',
  // Navigation tools
  'scroll_page',
  'click',           // NEW - was missing
  'go_to_url',
  // Control tools
  'record_insight',  // NEW
  'done',
] as const;
```

#### Phase 17 Test Matrix (Split into Sub-Phases)

**Phase 17a: Navigation Tools (18 tests)**
| Tool | Unit Tests | Key Scenarios |
|------|------------|---------------|
| scroll-tool | 6 | directions, boundaries, amount |
| click-tool | 7 | valid/invalid index, hidden, navigation |
| go-to-url-tool | 5 | URL validation, timing, waitUntil |
| **17a Total** | **18** | |

**Phase 17b: Analysis Tools (46 tests)**
| Tool | Unit Tests | Key Scenarios |
|------|------------|---------------|
| analyze-forms | 12 | field count, labels, types, submit |
| analyze-trust | 10 | badges, reviews, guarantees, placement |
| analyze-value-prop | 10 | H1 count, generic text, length |
| check-navigation | 8 | nav, breadcrumbs, search, depth |
| find-friction | 6 | categories, scoring, filtering |
| **17b Total** | **46** | |

**Phase 17c: Control + Integration (27 tests)**
| Tool | Unit Tests | Key Scenarios |
|------|------------|---------------|
| record-insight | 5 | valid params, severity, category |
| done-tool | 4 | summary, confidence validation |
| Integration | 18 | chaining, executor, registry |
| **17c Total** | **27** | |

**Phase 17 Grand Total**: 91 tests (73 unit + 18 integration)

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

---

## Phase 18: Heuristics & Post-Processing Architecture

### Overview

Phase 18 implements the post-processing pipeline that runs AFTER the agent loop completes:
1. Business type detection
2. Heuristic rule execution
3. Insight deduplication & prioritization
4. Hypothesis generation
5. Report generation

### New Models (`src/models/`)

#### BusinessType (`src/models/business-type.ts`)

```typescript
/**
 * Business type classification for CRO analysis
 */
export type BusinessType =
  | 'ecommerce'
  | 'saas'
  | 'banking'
  | 'insurance'
  | 'travel'
  | 'media'
  | 'other';

/**
 * Result of business type detection
 */
export interface BusinessTypeResult {
  type: BusinessType;
  confidence: number;           // 0-1
  signals: string[];            // What matched (e.g., "cart icon", "pricing page")
}

/**
 * Signals used to detect business type
 */
export interface BusinessTypeSignals {
  urlPatterns: RegExp[];        // URL patterns (e.g., /shop/, /cart/)
  elementSelectors: string[];   // CSS selectors for business-specific elements
  keywords: string[];           // Text keywords in page content
}

export const BUSINESS_TYPE_SIGNALS: Record<BusinessType, BusinessTypeSignals> = {
  ecommerce: {
    urlPatterns: [/\/shop/i, /\/cart/i, /\/product/i, /\/checkout/i],
    elementSelectors: ['.add-to-cart', '.buy-now', '[class*="cart"]', '[class*="product"]'],
    keywords: ['add to cart', 'buy now', 'checkout', 'shipping', 'price'],
  },
  saas: {
    urlPatterns: [/\/pricing/i, /\/features/i, /\/demo/i, /\/signup/i],
    elementSelectors: ['.pricing-table', '.feature-list', '[class*="trial"]'],
    keywords: ['free trial', 'start free', 'per month', 'per user', 'enterprise'],
  },
  banking: {
    urlPatterns: [/\/account/i, /\/loans/i, /\/mortgage/i, /\/credit-card/i],
    elementSelectors: ['.account-balance', '[class*="loan"]', '[class*="rate"]'],
    keywords: ['apr', 'interest rate', 'account', 'balance', 'transfer'],
  },
  insurance: {
    urlPatterns: [/\/quote/i, /\/coverage/i, /\/policy/i, /\/claims/i],
    elementSelectors: ['.quote-form', '[class*="coverage"]', '[class*="premium"]'],
    keywords: ['get a quote', 'coverage', 'premium', 'deductible', 'policy'],
  },
  travel: {
    urlPatterns: [/\/flights/i, /\/hotels/i, /\/booking/i, /\/destination/i],
    elementSelectors: ['.search-flights', '.hotel-search', '[class*="booking"]'],
    keywords: ['book now', 'departure', 'arrival', 'check-in', 'travelers'],
  },
  media: {
    urlPatterns: [/\/article/i, /\/news/i, /\/blog/i, /\/video/i],
    elementSelectors: ['.article-content', '.video-player', '[class*="subscribe"]'],
    keywords: ['read more', 'watch now', 'subscribe', 'newsletter', 'latest'],
  },
  other: {
    urlPatterns: [],
    elementSelectors: [],
    keywords: [],
  },
};
```

#### Hypothesis (`src/models/hypothesis.ts`)

```typescript
import { z } from 'zod';

/**
 * Expected impact levels for A/B tests
 */
export type ExpectedImpact = 'low' | 'medium' | 'high';

/**
 * A/B test hypothesis generated from CRO insights
 */
export interface Hypothesis {
  id: string;                    // Unique ID (H001, H002, etc.)
  title: string;                 // Short title for the test
  hypothesis: string;            // "If X then Y because Z" format
  controlDescription: string;    // Current state
  treatmentDescription: string;  // Proposed change
  primaryMetric: string;         // What to measure (CTR, conversion rate, etc.)
  secondaryMetrics?: string[];   // Additional metrics to track
  expectedImpact: ExpectedImpact;
  priority: number;              // 1-10, higher = more important
  relatedInsights: string[];     // CROInsight IDs that led to this hypothesis
  estimatedEffort?: 'low' | 'medium' | 'high';
}

/**
 * Zod schema for Hypothesis validation
 */
export const HypothesisSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(5).max(100),
  hypothesis: z.string().min(20).max(500),
  controlDescription: z.string().min(10).max(300),
  treatmentDescription: z.string().min(10).max(300),
  primaryMetric: z.string().min(3).max(100),
  secondaryMetrics: z.array(z.string()).optional(),
  expectedImpact: z.enum(['low', 'medium', 'high']),
  priority: z.number().int().min(1).max(10),
  relatedInsights: z.array(z.string()).min(1),
  estimatedEffort: z.enum(['low', 'medium', 'high']).optional(),
});

export type HypothesisValidated = z.infer<typeof HypothesisSchema>;
```

#### Extended CROAnalysisResult

```typescript
// Update to src/agent/cro-agent.ts CROAnalysisResult

export interface CROAnalysisResult {
  // Existing fields
  url: string;
  success: boolean;
  insights: CROInsight[];           // Tool-generated insights
  stepsExecuted: number;
  totalTimeMs: number;
  terminationReason: string;
  errors: string[];
  pageTitle?: string;

  // Phase 18 additions
  businessType?: BusinessTypeResult;
  heuristicInsights: CROInsight[];  // Heuristic-generated insights
  hypotheses: Hypothesis[];
  scores: CROScores;
  report?: {
    markdown?: string;
    json?: string;
  };
}

export interface CROScores {
  overall: number;                   // 0-100
  byCategory: Record<InsightCategory, number>;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}
```

### Heuristics Module (`src/heuristics/`)

#### Directory Structure

```
src/heuristics/
├── index.ts                      # Module exports
├── types.ts                      # HeuristicRule, HeuristicResult interfaces
├── heuristic-engine.ts           # Main engine class
├── business-type-detector.ts     # Business type detection
├── severity-scorer.ts            # Severity adjustment by business type
└── rules/
    ├── index.ts                  # Export all rules
    ├── cta-rules.ts              # H001, H002
    ├── form-rules.ts             # H003, H004
    ├── trust-rules.ts            # H005, H006
    ├── value-prop-rules.ts       # H007, H008
    └── navigation-rules.ts       # H009, H010
```

#### Types (`src/heuristics/types.ts`)

```typescript
import type { CROInsight, PageState, BusinessType } from '../models/index.js';

/**
 * Single heuristic rule definition
 */
export interface HeuristicRule {
  id: string;                      // H001, H002, etc.
  name: string;                    // Human-readable name
  description: string;             // What this rule checks
  category: InsightCategory;       // cta, form, trust, etc.
  severity: Severity;              // Default severity
  businessTypes?: BusinessType[];  // Only apply to these types (empty = all)

  /**
   * Check function - returns insight if violation found, null otherwise
   */
  check(state: PageState): CROInsight | null;
}

/**
 * Result of running all heuristics
 */
export interface HeuristicResult {
  insights: CROInsight[];
  rulesExecuted: number;
  rulesPassed: number;
  rulesFailed: number;
  executionTimeMs: number;
}
```

#### HeuristicEngine (`src/heuristics/heuristic-engine.ts`)

```typescript
import type { PageState, CROInsight } from '../models/index.js';
import type { HeuristicRule, HeuristicResult } from './types.js';
import { createLogger } from '../utils/index.js';

export class HeuristicEngine {
  private rules: Map<string, HeuristicRule> = new Map();
  private logger = createLogger('HeuristicEngine');

  /**
   * Register a heuristic rule
   */
  register(rule: HeuristicRule): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Rule already registered: ${rule.id}`);
    }
    this.rules.set(rule.id, rule);
    this.logger.debug(`Registered rule: ${rule.id} - ${rule.name}`);
  }

  /**
   * Register multiple rules
   */
  registerAll(rules: HeuristicRule[]): void {
    rules.forEach(r => this.register(r));
  }

  /**
   * Run all applicable rules against page state
   */
  run(state: PageState, businessType?: BusinessType): HeuristicResult {
    const start = Date.now();
    const insights: CROInsight[] = [];
    let passed = 0;
    let failed = 0;

    for (const rule of this.rules.values()) {
      // Skip rules not applicable to this business type
      if (rule.businessTypes && rule.businessTypes.length > 0) {
        if (!businessType || !rule.businessTypes.includes(businessType)) {
          this.logger.debug(`Skipping rule ${rule.id} - not applicable to ${businessType}`);
          continue;
        }
      }

      try {
        const insight = rule.check(state);
        if (insight) {
          insight.heuristicId = rule.id;
          insights.push(insight);
          failed++;
          this.logger.info(`Rule ${rule.id} failed: ${insight.issue}`);
        } else {
          passed++;
          this.logger.debug(`Rule ${rule.id} passed`);
        }
      } catch (error) {
        this.logger.error(`Rule ${rule.id} error: ${error}`);
        failed++;
      }
    }

    return {
      insights,
      rulesExecuted: passed + failed,
      rulesPassed: passed,
      rulesFailed: failed,
      executionTimeMs: Date.now() - start,
    };
  }

  /**
   * Get rule by ID
   */
  getRule(id: string): HeuristicRule | undefined {
    return this.rules.get(id);
  }

  /**
   * Get all registered rules
   */
  getAllRules(): HeuristicRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Clear all rules (for testing)
   */
  clear(): void {
    this.rules.clear();
  }
}
```

#### BusinessTypeDetector (`src/heuristics/business-type-detector.ts`)

```typescript
import type { PageState, BusinessType, BusinessTypeResult } from '../models/index.js';
import { BUSINESS_TYPE_SIGNALS } from '../models/business-type.js';
import { createLogger } from '../utils/index.js';

export class BusinessTypeDetector {
  private logger = createLogger('BusinessTypeDetector');
  private confidenceThreshold: number;

  constructor(confidenceThreshold = 0.6) {
    this.confidenceThreshold = confidenceThreshold;
  }

  /**
   * Detect business type from page state
   */
  detect(state: PageState): BusinessTypeResult {
    const scores: Record<BusinessType, { score: number; signals: string[] }> = {
      ecommerce: { score: 0, signals: [] },
      saas: { score: 0, signals: [] },
      banking: { score: 0, signals: [] },
      insurance: { score: 0, signals: [] },
      travel: { score: 0, signals: [] },
      media: { score: 0, signals: [] },
      other: { score: 0, signals: [] },
    };

    const url = state.url.toLowerCase();
    const pageText = this.extractPageText(state);

    // Check each business type
    for (const [type, signals] of Object.entries(BUSINESS_TYPE_SIGNALS)) {
      if (type === 'other') continue;

      const bizType = type as BusinessType;

      // URL pattern matching
      for (const pattern of signals.urlPatterns) {
        if (pattern.test(url)) {
          scores[bizType].score += 0.3;
          scores[bizType].signals.push(`URL matches ${pattern.source}`);
        }
      }

      // Keyword matching
      for (const keyword of signals.keywords) {
        if (pageText.includes(keyword.toLowerCase())) {
          scores[bizType].score += 0.15;
          scores[bizType].signals.push(`Keyword: "${keyword}"`);
        }
      }

      // Element selector matching (check DOM tree)
      for (const selector of signals.elementSelectors) {
        if (this.hasElementMatching(state, selector)) {
          scores[bizType].score += 0.2;
          scores[bizType].signals.push(`Element: ${selector}`);
        }
      }
    }

    // Find highest scoring type
    let bestType: BusinessType = 'other';
    let bestScore = 0;
    let bestSignals: string[] = [];

    for (const [type, data] of Object.entries(scores)) {
      if (data.score > bestScore) {
        bestScore = Math.min(data.score, 1); // Cap at 1.0
        bestType = type as BusinessType;
        bestSignals = data.signals;
      }
    }

    // Fall back to 'other' if confidence too low
    if (bestScore < this.confidenceThreshold) {
      this.logger.info(`Low confidence (${bestScore.toFixed(2)}), defaulting to 'other'`);
      return { type: 'other', confidence: bestScore, signals: bestSignals };
    }

    this.logger.info(`Detected business type: ${bestType} (confidence: ${bestScore.toFixed(2)})`);
    return { type: bestType, confidence: bestScore, signals: bestSignals };
  }

  private extractPageText(state: PageState): string {
    // Extract all text from DOM tree (simplified)
    const texts: string[] = [];
    this.collectText(state.domTree.root, texts);
    return texts.join(' ').toLowerCase();
  }

  private collectText(node: DOMNode, result: string[]): void {
    if (node.text) result.push(node.text);
    for (const child of node.children) {
      this.collectText(child, result);
    }
  }

  private hasElementMatching(state: PageState, selector: string): boolean {
    // Check if DOM tree has elements matching selector pattern
    // Simplified: check class/tag patterns in xpath or text
    return this.checkNodeForSelector(state.domTree.root, selector);
  }

  private checkNodeForSelector(node: DOMNode, selector: string): boolean {
    const selectorLower = selector.toLowerCase();
    const xpath = node.xpath?.toLowerCase() || '';
    const text = node.text?.toLowerCase() || '';

    if (xpath.includes(selectorLower) || text.includes(selectorLower)) {
      return true;
    }

    for (const child of node.children) {
      if (this.checkNodeForSelector(child, selector)) return true;
    }
    return false;
  }
}
```

#### Heuristic Rules Examples

```typescript
// src/heuristics/rules/cta-rules.ts

import { randomUUID } from 'crypto';
import type { HeuristicRule } from '../types.js';
import type { PageState, CROInsight, DOMNode } from '../../models/index.js';

const VAGUE_CTA_PATTERNS = [
  /^click here$/i,
  /^learn more$/i,
  /^read more$/i,
  /^submit$/i,
  /^send$/i,
  /^go$/i,
  /^continue$/i,
  /^next$/i,
];

/**
 * H001: Vague CTA Text
 */
export const vagueCTATextRule: HeuristicRule = {
  id: 'H001',
  name: 'vague_cta_text',
  description: 'CTAs should have specific, action-oriented text',
  category: 'cta',
  severity: 'medium',

  check(state: PageState): CROInsight | null {
    const ctas: DOMNode[] = [];
    collectCTAs(state.domTree.root, ctas);

    for (const cta of ctas) {
      const text = cta.text?.trim() || '';
      if (VAGUE_CTA_PATTERNS.some(p => p.test(text))) {
        return {
          id: randomUUID().slice(0, 8),
          category: 'cta',
          type: 'vague_cta_text',
          severity: 'medium',
          element: cta.xpath,
          issue: `CTA has vague text: "${text}". Generic CTAs reduce click-through rates`,
          recommendation: 'Use specific, benefit-driven text (e.g., "Get Free Quote" instead of "Submit")',
          evidence: { text },
        };
      }
    }
    return null;
  },
};

/**
 * H002: No CTA Above Fold
 */
export const noCTAAboveFoldRule: HeuristicRule = {
  id: 'H002',
  name: 'no_cta_above_fold',
  description: 'At least one CTA should be visible without scrolling',
  category: 'cta',
  severity: 'high',

  check(state: PageState): CROInsight | null {
    const ctas: DOMNode[] = [];
    collectCTAs(state.domTree.root, ctas);

    const viewportHeight = state.viewport.height;
    const aboveFoldCTAs = ctas.filter(
      cta => cta.boundingBox && cta.boundingBox.y < viewportHeight
    );

    if (aboveFoldCTAs.length === 0) {
      return {
        id: randomUUID().slice(0, 8),
        category: 'cta',
        type: 'no_cta_above_fold',
        severity: 'high',
        element: '',
        issue: 'No call-to-action visible above the fold',
        recommendation: 'Add primary CTA in hero section or above-fold area for immediate engagement',
      };
    }
    return null;
  },
};

function collectCTAs(node: DOMNode, result: DOMNode[]): void {
  if (node.croType === 'cta' && node.isVisible) {
    result.push(node);
  }
  for (const child of node.children) {
    collectCTAs(child, result);
  }
}

export const ctaRules: HeuristicRule[] = [vagueCTATextRule, noCTAAboveFoldRule];
```

### Output Module Extensions (`src/output/`)

#### HypothesisGenerator (`src/output/hypothesis-generator.ts`)

```typescript
import { randomUUID } from 'crypto';
import type { CROInsight, Hypothesis, Severity } from '../models/index.js';
import { createLogger } from '../utils/index.js';

const SEVERITY_PRIORITY: Record<Severity, number> = {
  critical: 10,
  high: 8,
  medium: 5,
  low: 2,
};

const METRIC_MAP: Record<string, string> = {
  cta: 'Click-through rate (CTR)',
  form: 'Form completion rate',
  trust: 'Conversion rate',
  value_prop: 'Bounce rate (decrease)',
  navigation: 'Pages per session',
  friction: 'Task completion rate',
};

export class HypothesisGenerator {
  private logger = createLogger('HypothesisGenerator');
  private minSeverity: Severity;

  constructor(minSeverity: Severity = 'high') {
    this.minSeverity = minSeverity;
  }

  /**
   * Generate hypotheses from insights
   */
  generate(insights: CROInsight[]): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];
    let counter = 1;

    // Filter to high/critical by default
    const eligibleInsights = insights.filter(
      i => SEVERITY_PRIORITY[i.severity] >= SEVERITY_PRIORITY[this.minSeverity]
    );

    this.logger.info(`Generating hypotheses from ${eligibleInsights.length} eligible insights`);

    for (const insight of eligibleInsights) {
      const hypothesis = this.createHypothesis(insight, counter++);
      if (hypothesis) {
        hypotheses.push(hypothesis);
      }
    }

    // Sort by priority (highest first)
    hypotheses.sort((a, b) => b.priority - a.priority);

    return hypotheses;
  }

  private createHypothesis(insight: CROInsight, index: number): Hypothesis | null {
    const metric = METRIC_MAP[insight.category] || 'Conversion rate';

    return {
      id: `HYP-${String(index).padStart(3, '0')}`,
      title: this.generateTitle(insight),
      hypothesis: `If we ${insight.recommendation.toLowerCase()}, then ${metric.toLowerCase()} will improve because ${insight.issue.toLowerCase()}`,
      controlDescription: `Current state: ${insight.issue}`,
      treatmentDescription: insight.recommendation,
      primaryMetric: metric,
      expectedImpact: this.mapSeverityToImpact(insight.severity),
      priority: SEVERITY_PRIORITY[insight.severity],
      relatedInsights: [insight.id],
      estimatedEffort: this.estimateEffort(insight),
    };
  }

  private generateTitle(insight: CROInsight): string {
    const typeWords = insight.type.replace(/_/g, ' ');
    return `Fix ${typeWords}`;
  }

  private mapSeverityToImpact(severity: Severity): 'low' | 'medium' | 'high' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      default:
        return 'low';
    }
  }

  private estimateEffort(insight: CROInsight): 'low' | 'medium' | 'high' {
    // Simple heuristic based on category
    if (insight.category === 'form' || insight.category === 'navigation') {
      return 'medium';
    }
    if (insight.category === 'value_prop') {
      return 'low';
    }
    return 'low';
  }
}
```

#### MarkdownReporter (`src/output/markdown-reporter.ts`)

```typescript
import type { CROAnalysisResult, CROInsight, Hypothesis } from '../models/index.js';

export class MarkdownReporter {
  /**
   * Generate full markdown report
   */
  generate(result: CROAnalysisResult): string {
    const sections: string[] = [];

    sections.push(this.generateHeader(result));
    sections.push(this.generateExecutiveSummary(result));
    sections.push(this.generateCriticalIssues(result));
    sections.push(this.generateHighPriorityIssues(result));
    sections.push(this.generateMediumPriorityIssues(result));
    sections.push(this.generateLowPriorityIssues(result));
    sections.push(this.generateRecommendedTests(result));
    sections.push(this.generateFooter(result));

    return sections.join('\n\n');
  }

  private generateHeader(result: CROAnalysisResult): string {
    return `# CRO Analysis Report

**URL**: ${result.url}
**Page Title**: ${result.pageTitle || 'N/A'}
**Analysis Date**: ${new Date().toISOString().split('T')[0]}
**Business Type**: ${result.businessType?.type || 'Unknown'} (${((result.businessType?.confidence || 0) * 100).toFixed(0)}% confidence)

---`;
  }

  private generateExecutiveSummary(result: CROAnalysisResult): string {
    const allInsights = [...result.insights, ...result.heuristicInsights];
    const scores = result.scores;

    return `## Executive Summary

| Metric | Value |
|--------|-------|
| Overall CRO Score | **${scores.overall}/100** |
| Critical Issues | ${scores.criticalCount} |
| High Priority | ${scores.highCount} |
| Medium Priority | ${scores.mediumCount} |
| Low Priority | ${scores.lowCount} |
| Recommended Tests | ${result.hypotheses.length} |
| Analysis Steps | ${result.stepsExecuted} |
| Total Time | ${(result.totalTimeMs / 1000).toFixed(1)}s |`;
  }

  private generateCriticalIssues(result: CROAnalysisResult): string {
    const critical = this.filterBySeverity(result, 'critical');
    if (critical.length === 0) return '## Critical Issues\n\n✅ No critical issues found.';

    return `## Critical Issues

${critical.map(i => this.formatInsight(i)).join('\n\n')}`;
  }

  private generateHighPriorityIssues(result: CROAnalysisResult): string {
    const high = this.filterBySeverity(result, 'high');
    if (high.length === 0) return '## High Priority Issues\n\n✅ No high priority issues found.';

    return `## High Priority Issues

${high.map(i => this.formatInsight(i)).join('\n\n')}`;
  }

  private generateMediumPriorityIssues(result: CROAnalysisResult): string {
    const medium = this.filterBySeverity(result, 'medium');
    if (medium.length === 0) return '## Medium Priority Issues\n\n✅ No medium priority issues found.';

    return `## Medium Priority Issues

${medium.map(i => this.formatInsight(i)).join('\n\n')}`;
  }

  private generateLowPriorityIssues(result: CROAnalysisResult): string {
    const low = this.filterBySeverity(result, 'low');
    if (low.length === 0) return '## Low Priority Issues\n\n✅ No low priority issues found.';

    return `## Low Priority Issues

${low.map(i => this.formatInsight(i)).join('\n\n')}`;
  }

  private generateRecommendedTests(result: CROAnalysisResult): string {
    if (result.hypotheses.length === 0) {
      return '## Recommended A/B Tests\n\nNo tests recommended based on current analysis.';
    }

    return `## Recommended A/B Tests

${result.hypotheses.map((h, i) => this.formatHypothesis(h, i + 1)).join('\n\n')}`;
  }

  private generateFooter(result: CROAnalysisResult): string {
    return `---

*Generated by CRO Browser Agent | ${new Date().toISOString()}*`;
  }

  private filterBySeverity(result: CROAnalysisResult, severity: string): CROInsight[] {
    const all = [...result.insights, ...result.heuristicInsights];
    return all.filter(i => i.severity === severity);
  }

  private formatInsight(insight: CROInsight): string {
    return `### ${insight.type.replace(/_/g, ' ').toUpperCase()}

- **Category**: ${insight.category}
- **Element**: \`${insight.element || 'N/A'}\`
- **Issue**: ${insight.issue}
- **Recommendation**: ${insight.recommendation}
${insight.heuristicId ? `- **Heuristic**: ${insight.heuristicId}` : ''}`;
  }

  private formatHypothesis(h: Hypothesis, num: number): string {
    return `### Test ${num}: ${h.title}

**Hypothesis**: ${h.hypothesis}

| Aspect | Description |
|--------|-------------|
| Control | ${h.controlDescription} |
| Treatment | ${h.treatmentDescription} |
| Primary Metric | ${h.primaryMetric} |
| Expected Impact | ${h.expectedImpact} |
| Priority | ${h.priority}/10 |
| Effort | ${h.estimatedEffort || 'Unknown'} |`;
  }
}
```

### Agent Integration

```typescript
// Addition to CROAgent.analyze() - post-processing pipeline

async analyze(url: string, analyzeOptions?: AnalyzeOptions): Promise<CROAnalysisResult> {
  // ... existing agent loop code ...

  // ─── 4. POST-PROCESSING PIPELINE ───────────────────────────
  this.logger.info('Starting post-processing pipeline');

  // 4a. Detect business type
  const businessTypeDetector = new BusinessTypeDetector();
  const businessType = businessTypeDetector.detect(finalPageState);

  // 4b. Run heuristics
  const heuristicEngine = createHeuristicEngine(); // Factory with all 10 rules
  const heuristicResult = heuristicEngine.run(finalPageState, businessType.type);

  // 4c. Combine and deduplicate insights
  const allInsights = [...stateManager.getInsights(), ...heuristicResult.insights];
  const deduplicator = new InsightDeduplicator();
  const uniqueInsights = deduplicator.deduplicate(allInsights);

  // 4d. Prioritize insights
  const prioritizer = new InsightPrioritizer();
  const prioritizedInsights = prioritizer.prioritize(uniqueInsights, businessType.type);

  // 4e. Generate hypotheses
  const hypothesisGenerator = new HypothesisGenerator('high');
  const hypotheses = hypothesisGenerator.generate(prioritizedInsights);

  // 4f. Calculate scores
  const scores = this.calculateScores(prioritizedInsights);

  // 4g. Generate reports (if requested)
  let report: { markdown?: string; json?: string } | undefined;
  if (analyzeOptions?.outputFormat) {
    if (analyzeOptions.outputFormat === 'markdown' || analyzeOptions.outputFormat === 'all') {
      const reporter = new MarkdownReporter();
      report = { ...report, markdown: reporter.generate(result) };
    }
    if (analyzeOptions.outputFormat === 'json' || analyzeOptions.outputFormat === 'all') {
      const exporter = new JSONExporter();
      report = { ...report, json: exporter.export(result) };
    }
  }

  return {
    url,
    success: true,
    insights: stateManager.getInsights(),
    heuristicInsights: heuristicResult.insights,
    businessType,
    hypotheses,
    scores,
    report,
    stepsExecuted: stateManager.getStep(),
    totalTimeMs: Date.now() - startTime,
    terminationReason: stateManager.getTerminationReason(),
    errors,
    pageTitle,
  };
}
```

### Phase 18 Test Matrix

| Sub-Phase | Component | Unit Tests | Int Tests | Total |
|-----------|-----------|------------|-----------|-------|
| 18a | Models (BusinessType, Hypothesis) | 8 | - | 8 |
| 18b | HeuristicEngine | 10 | - | 10 |
| 18b | BusinessTypeDetector | 8 | - | 8 |
| 18b | SeverityScorer | 4 | - | 4 |
| 18c | 10 Heuristic Rules (2 each) | 20 | - | 20 |
| 18d | HypothesisGenerator | 6 | - | 6 |
| 18d | InsightDeduplicator | 4 | - | 4 |
| 18d | InsightPrioritizer | 3 | - | 3 |
| 18d | MarkdownReporter | 4 | - | 4 |
| 18d | JSONExporter | 3 | - | 3 |
| 18e | Agent Integration | - | 12 | 12 |
| 18-CLI | CLI + FileWriter | 6 | - | 6 |
| **Total** | | **76** | **12** | **88** |

---

## Phase 19: 100% Page Coverage System

### Problem Statement

Current agent loop relies on LLM to decide when to scroll, leading to incomplete page coverage:

| Page Type | Estimated Coverage |
|-----------|-------------------|
| Simple landing (1 viewport) | ~90% |
| Medium landing (3 viewports) | ~60% |
| Long e-commerce (10+ viewports) | ~20-30% |
| Infinite scroll page | ~10% |

**Root Causes**:
1. LLM-dependent scrolling - may forget to scroll or call `done` prematurely
2. Token budget truncation - silently drops elements after 8000 tokens
3. Viewport-locked DOM extraction - elements below fold marked invisible
4. No scroll coverage tracking
5. Arbitrary maxSteps limit (10) insufficient for long pages
6. No coverage enforcement - `done` not blocked when coverage incomplete

### Solution Architecture

```
+---------------------------------------------------------------------+
|                      COVERAGE SYSTEM                                 |
+---------------------------------------------------------------------+
|  +---------------+    +---------------+    +---------------------+   |
|  |  Scan Mode    |    |  Coverage     |    |  Coverage           |   |
|  |  Selector     |--->|  Tracker      |--->|  Enforcer           |   |
|  |               |    |               |    |                     |   |
|  | * full_page   |    | * Segments    |    | * Block premature   |   |
|  | * above_fold  |    | * Elements    |    |   'done' calls      |   |
|  | * llm_guided  |    | * XPaths      |    | * Force scroll if   |   |
|  +---------------+    +---------------+    |   coverage < 100%   |   |
|                                            +---------------------+   |
|                                                                      |
|  +---------------------------------------------------------------+   |
|  |              SEGMENT-BASED SCANNING                            |   |
|  |                                                                |   |
|  |  Page Height: 3000px    Viewport: 800px                       |   |
|  |                                                                |   |
|  |  Segment 0: [0-800]     [x] Scanned                           |   |
|  |  Segment 1: [800-1600]  [x] Scanned                           |   |
|  |  Segment 2: [1600-2400] [ ] Pending                           |   |
|  |  Segment 3: [2400-3000] [ ] Pending                           |   |
|  |                                                                |   |
|  |  Coverage: 53%  (2/4 segments)                                |   |
|  +---------------------------------------------------------------+   |
+---------------------------------------------------------------------+
```

### New Files

```
src/models/coverage-tracker.ts       # Coverage interfaces and types
src/agent/coverage-tracker.ts        # CoverageTracker class
src/browser/dom/dom-merger.ts        # Multi-segment DOM merging
```

### Modified Files

```
src/types/index.ts                   # Add ScanMode, CoverageConfig
src/agent/cro-agent.ts               # Full-page scan, coverage enforcement
src/agent/state-manager.ts           # Coverage state, termination override
src/agent/prompt-builder.ts          # Coverage section in prompts
src/browser/dom/serializer.ts        # Dynamic token budget
src/browser/dom/build-dom-tree.ts    # Absolute bounding box coordinates
src/prompts/system-cro.md            # Coverage awareness instructions
src/cli.ts                           # Scan mode flags
```

### Key Interfaces

#### Coverage Tracker Model (`src/models/coverage-tracker.ts`)

```typescript
/**
 * Represents a vertical segment of the page
 */
export interface PageSegment {
  index: number;
  startY: number;
  endY: number;
  scanned: boolean;
  scannedAt?: number;
  elementsFound: number;
  elementsAnalyzed: number;
}

/**
 * Tracks which elements have been examined
 */
export interface ElementCoverage {
  xpath: string;
  croType: string | null;
  firstSeenAt: number;
  firstSeenSegment: number;
  analyzedBy: string[];
  insightsGenerated: number;
}

/**
 * Main coverage tracking state
 */
export interface CoverageState {
  pageHeight: number;
  viewportHeight: number;
  segments: PageSegment[];
  elementsDiscovered: Map<string, ElementCoverage>;
  totalCROElements: number;
  analyzedCROElements: number;
  segmentsCovered: number;
  segmentsTotal: number;
  coveragePercent: number;
  scrollPositionsVisited: number[];
  currentScrollY: number;
  maxScrollY: number;
}

/**
 * Coverage configuration
 */
export interface CoverageConfig {
  minCoveragePercent: number;     // Default: 100
  segmentOverlapPx: number;       // Default: 100
  requireAllSegments: boolean;    // Default: true
  requireElementAnalysis: boolean; // Default: true
}

export const DEFAULT_COVERAGE_CONFIG: CoverageConfig = {
  minCoveragePercent: 100,
  segmentOverlapPx: 100,
  requireAllSegments: true,
  requireElementAnalysis: true,
};
```

#### Scan Mode Type (`src/types/index.ts`)

```typescript
/**
 * Analysis scan modes
 */
export type ScanMode =
  | 'full_page'      // Deterministic: scan every segment (NEW DEFAULT)
  | 'above_fold'     // Quick: only initial viewport
  | 'llm_guided';    // Original: LLM decides scrolling

// Updated AnalyzeOptions
export interface AnalyzeOptions {
  browserConfig?: Partial<typeof DEFAULT_BROWSER_CONFIG>;
  registry?: ToolRegistry;
  verbose?: boolean;
  outputFormat?: OutputFormat;
  skipPostProcessing?: boolean;
  skipHeuristics?: boolean;
  // Phase 19 additions
  scanMode?: ScanMode;
  coverageConfig?: Partial<CoverageConfig>;
}
```

### CoverageTracker Class (`src/agent/coverage-tracker.ts`)

```typescript
export class CoverageTracker {
  private state: CoverageState;
  private config: CoverageConfig;

  constructor(config?: Partial<CoverageConfig>) {
    this.config = { ...DEFAULT_COVERAGE_CONFIG, ...config };
    this.state = this.createInitialState();
  }

  /**
   * Initialize segments based on page dimensions
   */
  initialize(pageHeight: number, viewportHeight: number): void {
    this.state.pageHeight = pageHeight;
    this.state.viewportHeight = viewportHeight;
    this.state.maxScrollY = Math.max(0, pageHeight - viewportHeight);

    const effectiveHeight = viewportHeight - this.config.segmentOverlapPx;
    const segmentCount = Math.ceil(pageHeight / effectiveHeight);

    this.state.segments = [];
    for (let i = 0; i < segmentCount; i++) {
      const startY = i * effectiveHeight;
      const endY = Math.min(startY + viewportHeight, pageHeight);
      this.state.segments.push({
        index: i,
        startY,
        endY,
        scanned: false,
        elementsFound: 0,
        elementsAnalyzed: 0,
      });
    }
    this.state.segmentsTotal = segmentCount;
  }

  markSegmentScanned(scrollY: number, elementsFound: number): void { /* ... */ }
  recordElementDiscovered(xpath: string, croType: string | null, segment: number): void { /* ... */ }
  recordElementAnalyzed(xpath: string, toolName: string): void { /* ... */ }
  getCoveragePercent(): number { return this.state.coveragePercent; }
  isFullyCovered(): boolean { return this.state.coveragePercent >= this.config.minCoveragePercent; }
  getNextUnscannedSegment(): PageSegment | null { /* ... */ }
  getCoverageReport(): string { /* ... */ }
}
```

### DOMMerger Class (`src/browser/dom/dom-merger.ts`)

```typescript
export class DOMMerger {
  /**
   * Merge multiple DOM snapshots into single complete tree
   */
  merge(snapshots: DOMTree[]): DOMTree {
    if (snapshots.length === 0) throw new Error('No snapshots to merge');
    if (snapshots.length === 1) return snapshots[0];

    const base = this.deepClone(snapshots[0]);
    const seenXPaths = new Set<string>();
    this.collectXPaths(base.root, seenXPaths);

    for (let i = 1; i < snapshots.length; i++) {
      this.mergeSnapshot(base, snapshots[i], seenXPaths);
    }

    base.totalNodeCount = this.countNodes(base.root);
    base.croElementCount = this.countCROElements(base.root);
    base.interactiveCount = this.countInteractive(base.root);
    this.reindex(base.root);

    return base;
  }
}
```

### Coverage Enforcement Logic

```typescript
// In agent loop, before executing 'done' tool:
if (action.name === 'done') {
  const coverage = coverageTracker.getCoveragePercent();

  if (coverage < config.minCoveragePercent) {
    // BLOCK the done action
    const nextSegment = coverageTracker.getNextUnscannedSegment();

    // Override LLM decision
    action = {
      name: 'scroll_page',
      params: {
        direction: 'down',
        amount: nextSegment.startY - currentScrollY
      }
    };

    logger.warn('Coverage enforcement: blocked done, forcing scroll', {
      currentCoverage: coverage,
      requiredCoverage: config.minCoveragePercent,
      scrollingTo: nextSegment.startY
    });
  }
}
```

### Dynamic maxSteps Calculation

```typescript
function calculateRequiredSteps(pageHeight: number, viewportHeight: number): number {
  const segments = Math.ceil(pageHeight / (viewportHeight * 0.8));
  const analysisToolCount = 6;
  const scrollSteps = segments;
  const analysisSteps = analysisToolCount;
  const synthesisSteps = 2;
  return scrollSteps + analysisSteps + synthesisSteps;
}

// In analyze() method:
if (scanMode === 'full_page') {
  const requiredSteps = calculateRequiredSteps(pageHeight, viewportHeight);
  options.maxSteps = Math.max(options.maxSteps, requiredSteps);
}
```

### System Prompt Update (`src/prompts/system-cro.md`)

Add new section:

```markdown
<coverage_awareness>
You will receive coverage information showing:
- Which page segments have been scanned
- Current coverage percentage
- Elements discovered vs analyzed

IMPORTANT RULES:
1. You CANNOT call 'done' until coverage reaches 100%
2. If coverage < 100%, you MUST scroll to uncovered segments
3. The system will BLOCK premature 'done' calls automatically
4. Focus on analyzing NEW elements after each scroll
5. Check the <coverage> section in each message for status
</coverage_awareness>
```

### CLI Updates (`src/cli.ts`)

```typescript
// New flags
const scanModeArg = args.find(a => a.startsWith('--scan-mode='));
const scanMode = scanModeArg
  ? scanModeArg.split('=')[1] as ScanMode
  : 'full_page';  // NEW DEFAULT

const minCoverageArg = args.find(a => a.startsWith('--min-coverage='));
const minCoverage = minCoverageArg
  ? parseInt(minCoverageArg.split('=')[1])
  : 100;

// Usage examples:
// npm run start -- https://in.burberry.com/relaxed-fit-check-cotton-flannel-shirt-p81154981                         # full_page (default)
// npm run start -- --scan-mode=above_fold https://in.burberry.com/relaxed-fit-check-cotton-flannel-shirt-p81154981  # quick scan
// npm run start -- --scan-mode=llm_guided https://in.burberry.com/relaxed-fit-check-cotton-flannel-shirt-p81154981  # original behavior
// npm run start -- --min-coverage=80 https://in.burberry.com/relaxed-fit-check-cotton-flannel-shirt-p81154981       # custom threshold
```

### Phase 19 Test Matrix

| Sub-Phase | Component | Unit Tests | Int Tests | E2E Tests | Total | Status |
|-----------|-----------|------------|-----------|-----------|-------|--------|
| 19a | CoverageTracker | 16 | - | - | 16 | ✅ Complete |
| 19b | DOMMerger | 7 | - | - | 7 | ✅ Complete |
| 19c-e | Agent Integration | 1 | - | - | 1 | ✅ Complete |
| 19f | Coverage Enforcement | - | 11 | 4 | 15 | ✅ Complete |
| **Total** | | **24** | **11** | **4** | **39** | ✅ Complete |

### Success Metrics

| Metric | Before Phase 19 | After Phase 19 |
|--------|-----------------|----------------|
| Coverage on 1-viewport page | ~90% | 100% |
| Coverage on 3-viewport page | ~60% | 100% |
| Coverage on 10-viewport page | ~25% | 100% |
| Backward compatibility | N/A | 100% (llm_guided mode) |

### Rollout Strategy

1. **Phase 1**: Implement behind `--scan-mode=full_page` flag
2. **Phase 2**: Beta testing on real sites
3. **Phase 3**: Make `full_page` the default
4. **Phase 4**: Deprecation notice for `llm_guided` as default
