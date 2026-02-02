**Navigation**: [Index](./index.md) | [Previous](./phase-13-15.md) | [Next](./phase-17.md)
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
        model: 'gpt-4o-mini',
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

