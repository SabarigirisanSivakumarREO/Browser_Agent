# Browser Use Repository Analysis for CRO Browser Agent

## 1. High-Level Summary

**What Browser Use Does:**
Browser Use is an open-source Python library (v0.9.7+) that enables LLM-powered AI agents to interact with web browsers autonomously. It bridges natural language instructions to browser automation, allowing agents to navigate websites, fill forms, click elements, extract data, and complete complex multi-step tasks without manual scripting.

**Who It's For:**
- Developers building AI-powered browser automation
- QA engineers wanting LLM-driven testing
- Researchers studying web-based AI agents
- Anyone needing programmatic web interaction via AI

**Key Strengths:**
- LLM-agnostic (OpenAI, Anthropic, Google, local models)
- Sophisticated DOM extraction and interactive element detection
- Event-driven architecture with watchdogs for error handling
- Multi-tab support and parallel execution
- CDP (Chrome DevTools Protocol) direct access for speed
- Tool/action registry for extensibility

**Technology Stack:**
- Python 3.11+
- CDP via `cdp-use` (moved from Playwright for performance)
- Pydantic v2 for data validation
- `bubus` event bus for internal messaging
- LangChain-compatible LLM integration

---

## 2. Architecture Overview

### System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER INTERFACE LAYER                        │
│  CLI / Python API / MCP Integration                            │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     AGENT ORCHESTRATION                         │
│  Agent Class → MessageManager → AgentState → AgentHistory      │
└─────────────────────────────────────────────────────────────────┘
                              │
┌──────────────────┬──────────────────┬───────────────────────────┐
│   LLM LAYER      │   TOOLS LAYER    │    BROWSER LAYER         │
│                  │                  │                           │
│  BaseChatModel   │  Tools Registry  │  BrowserSession          │
│  Provider SDKs   │  Action Events   │  CDP Client              │
│  Schema Optim.   │  Custom Actions  │  EventBus + Watchdogs    │
└──────────────────┴──────────────────┴───────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                   DOM PROCESSING ENGINE                         │
│  DomService → buildDomTree.js → EnhancedDOMTreeNode            │
│  Serialization → LLM-optimized state summaries                 │
└─────────────────────────────────────────────────────────────────┘
```

### Core Loop Pattern

```
OBSERVE → REASON → ACT → REPEAT

1. Get browser state (DOM + screenshot)
2. Build LLM context (MessageManager)
3. Query LLM for next action(s)
4. Execute action(s) via Tools registry
5. Update state & history
6. Repeat until done/max_steps/failure
```

### Key Data Flow

```
User Task → Agent.run()
    ↓
Agent.step() [loop]
    ├── BrowserSession.get_browser_state_summary()
    │       └── DomService → buildDomTree.js injection
    │       └── Screenshot capture
    │       └── BrowserStateSummary generation
    ├── MessageManager.build_messages()
    │       └── System prompt + context assembly
    │       └── History compression
    ├── LLM.ainvoke() → AgentOutput
    │       └── thinking, memory, next_goal, action[]
    └── Tools.multi_act() → ActionResult[]
            └── Event dispatch → Watchdogs
            └── CDP commands execution
```

---

## 3. Feature List with File References

### 3.1 Agent System

| Feature | Description | Key Files |
|---------|-------------|-----------|
| **Agent Class** | Main orchestrator for task execution | `browser_use/agent/service.py` (L123-1170) |
| **AgentState** | Runtime state tracking (steps, failures, history) | `browser_use/agent/views.py` |
| **MessageManager** | LLM context construction & history compression | `browser_use/agent/message_manager/service.py` |
| **System Prompts** | XML-structured prompts for agent behavior | `browser_use/agent/system_prompt.md`, `system_prompt_flash.md` |
| **AgentHistory** | Execution trace for replay/debugging | `browser_use/agent/views.py` (AgentHistoryList) |

### 3.2 Browser Session Management

| Feature | Description | Key Files |
|---------|-------------|-----------|
| **BrowserSession** | CDP connection management | `browser_use/browser/session.py` (L159-890) |
| **BrowserProfile** | 120+ configurable browser options | `browser_use/browser/profile.py` |
| **EventBus** | Async event routing (`bubus` library) | `browser_use/browser/events.py` |
| **Watchdogs** | Event handlers for actions, DOM, downloads | `browser_use/browser/watchdogs/` |
| **Tab Management** | Multi-tab support and switching | `browser_use/browser/session.py` |

### 3.3 DOM Processing Engine

| Feature | Description | Key Files |
|---------|-------------|-----------|
| **DomService** | Python interface for DOM extraction | `browser_use/dom/service.py` |
| **buildDomTree.js** | JS injection for DOM analysis | `browser_use/dom/buildDomTree.js` |
| **Interactive Detection** | isInteractiveElement(), isTopElement() | buildDomTree.js |
| **Visibility Analysis** | isElementVisible(), isTextNodeVisible() | buildDomTree.js |
| **Element Highlighting** | Visual debugging with indices | buildDomTree.js (highlightElement) |
| **DOMTreeSerializer** | LLM-optimized DOM serialization | `browser_use/dom/views.py` |
| **Selector Map** | XPath/CSS mappings for elements | `browser_use/dom/views.py` (DOMSelectorMap) |

### 3.4 Tools and Action System

| Feature | Description | Key Files |
|---------|-------------|-----------|
| **Tools Registry** | Action registration and discovery | `browser_use/tools/registry/` |
| **Built-in Actions** | click_element, input_text, go_to_url, scroll, done | `browser_use/tools/service.py` |
| **Custom Tools** | @tools.action decorator for extensions | User-defined via Tools class |
| **Action Events** | ClickElementEvent, TypeTextEvent, etc. | `browser_use/browser/events.py` |
| **ActionResult** | Standardized action response model | `browser_use/agent/views.py` |

### 3.5 LLM Integration

| Feature | Description | Key Files |
|---------|-------------|-----------|
| **BaseChatModel** | Provider abstraction layer | `browser_use/llm/base.py` |
| **Multi-Provider** | OpenAI, Anthropic, Google, Ollama | Provider-specific implementations |
| **Structured Output** | JSON schema enforcement | Agent output validation |
| **Vision Support** | Screenshot analysis (use_vision=True) | BrowserStateSummary |

---

## 4. Browser Automation & DOM Behavior

### 4.1 Browser Library

Browser Use recently migrated from **Playwright** to **CDP (Chrome DevTools Protocol)** directly via `cdp-use` library for:
- Faster element extraction
- Better async reaction capabilities
- Proper cross-origin iframe support
- Reduced latency (no Node.js relay)

### 4.2 Page Lifecycle

```python
# Connection
session = BrowserSession(browser_profile=BrowserProfile(...))
await session.start()

# Navigation
await session.navigate_to_url(url)
await session._check_and_handle_navigation(page)

# State Retrieval
state = await session.get_browser_state_summary(
    include_screenshot=True,
    include_dom=True
)
```

### 4.3 DOM Inspection Strategy

**buildDomTree.js** is injected into pages to:

1. **Recursive Tree Walk**: Traverse from `document.body`
2. **Interactive Element Detection**:
   ```javascript
   function isInteractiveElement(node) {
     // Checks: tag type, role, onclick, contenteditable
     // Tags: a, button, input, select, textarea, [role=button], etc.
   }
   ```
3. **Visibility Checks**:
   ```javascript
   function isElementVisible(node) {
     // getBoundingClientRect, checkVisibility
     // CSS: display, visibility, opacity
   }
   ```
4. **Top Element Detection**:
   ```javascript
   function isTopElement(element) {
     // elementFromPoint check for occlusion
   }
   ```
5. **Output Structure**:
   ```json
   {
     "tagName": "button",
     "xpath": "/html/body/div[1]/button[2]",
     "highlightIndex": 5,
     "isInteractive": true,
     "isVisible": true,
     "isTopElement": true,
     "attributes": {"class": "cta-primary"},
     "children": [...]
   }
   ```

### 4.4 Click, Type, Scroll Implementation

```python
# Click via CDP
element_handle = await page.query_selector(selector)
await element_handle.click(timeout=1500)
# Fallback: page.evaluate('(el) => el.click()', element_handle)

# Type
await element_handle.type(text)

# Scroll
await page.evaluate(f'window.scrollBy(0, {amount})')
```

### 4.5 Wait & Retry Logic

```python
# Page load waiting
await page.wait_for_load_state('domcontentloaded')
await page.wait_for_load_state('networkidle')

# Element waiting with viewport expansion
dom_state = await dom_service.get_clickable_elements(
    viewport_expansion=-1,  # -1 = full page
    highlight_elements=True
)

# Retry on failure
for attempt in range(max_failures):
    try:
        result = await execute_action()
        break
    except Exception as e:
        await asyncio.sleep(retry_delay)
```

### 4.6 Anti-Bot / Human-Like Behavior

Browser Use addresses this through:
- **Browser Use Cloud**: Stealth browser fingerprinting
- **BrowserProfile options**: User agent rotation, viewport settings
- **Proxy support**: For IP rotation
- No built-in mouse movement fuzzing (basic implementation)

---

## 5. AI Agent Patterns

### 5.1 Single Agent Architecture (No Planner/Worker Split)

Browser Use uses a **single unified agent** that handles both planning and execution in one loop:

```
Agent.step() = Planning + Execution combined
├── LLM decides next action(s) 
├── Agent executes immediately
└── Loop continues
```

### 5.2 Tool Definition Pattern

```python
from browser_use import Tools, ActionResult, BrowserSession

tools = Tools()

@tools.action(
    description='Click submit button using CSS selector',
    allowed_domains=['*.example.com']
)
async def click_submit(browser_session: BrowserSession):
    page = await browser_session.must_get_current_page()
    elements = await page.get_elements_by_css_selector('button[type="submit"]')
    if elements:
        await elements[0].click()
        return ActionResult(extracted_content='Clicked!')
    return ActionResult(error='Button not found')

agent = Agent(task="...", llm=llm, browser=browser, tools=tools)
```

### 5.3 Context/Memory Handling

**Three-tier memory strategy:**

1. **Short-term**: Current step's browser state (DOM, screenshot, URL)
2. **Working Memory**: `AgentOutput.memory` field (1-3 sentences per step)
3. **Long-term**: History compression, file system for persistent data

```python
class AgentOutput(BaseModel):
    thinking: str           # Reasoning block
    evaluation_previous_goal: str  # Success/failure assessment
    memory: str             # Concise progress tracking
    next_goal: str          # Immediate objective
    action: list[ActionModel]  # Actions to execute
```

### 5.4 Self-Correction / Retry Logic

**Built-in error recovery:**

```python
# From Agent.step()
if result.error:
    self.state.consecutive_failures += 1
    if self.state.consecutive_failures >= max_failures:
        # Force done action
        available_actions = ['done']
    else:
        # Retry with error context in next LLM call
        pass
```

**LLM-driven self-correction:**
- Previous action result included in next prompt
- `evaluation_previous_goal` forces explicit success/failure assessment
- LLM can adjust strategy based on failures

### 5.5 Prompt Structure

```xml
<identity>You are a highly capable browser automation agent...</identity>

<input_format>
  <user_request>Task description</user_request>
  <browser_state>URL, tabs, DOM elements</browser_state>
  <file_system>Available files</file_system>
</input_format>

<output_format>
  {
    "thinking": "...",
    "evaluation_previous_goal": "...",
    "memory": "...",
    "next_goal": "...",
    "action": [{"action_name": {...}}]
  }
</output_format>

<reasoning_rules>...</reasoning_rules>
<task_completion_rules>...</task_completion_rules>
<browser_interaction_rules>...</browser_interaction_rules>
```

---

## 6. Dependencies and Purpose

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `cdp-use` | ≥1.4.4 | Chrome DevTools Protocol client |
| `bubus` | ≥1.5.6 | Event bus for internal messaging |
| `pydantic` | ≥2.11.5 | Data validation and serialization |
| `openai` | ≥2.7.2 | OpenAI LLM integration |
| `anthropic` | ≥0.72.1 | Anthropic Claude integration |
| `google-genai` | ≥1.50.0 | Google AI integration |
| `pypdf` | ≥5.7.0 | PDF processing |
| `python-docx` | ≥1.2.0 | Word document handling |
| `pillow` | ≥11.2.1 | Image processing (screenshots) |
| `mcp` | ≥1.10.1 | Model Context Protocol support |

### Optional Dependencies

| Group | Packages | Purpose |
|-------|----------|---------|
| `cli` | textual | Terminal UI |
| `code` | pandas, numpy, matplotlib | Data analysis tasks |
| `video` | imageio | GIF generation |
| `eval` | lmnr | Observability/evaluation |

---

## 7. CRO Reuse Mapping

### ✅ Must Replicate

| Feature | Browser Use Implementation | CRO Adaptation |
|---------|---------------------------|----------------|
| **DOM Extraction Engine** | buildDomTree.js with visibility/interactivity detection | Extend for CRO-specific element types (CTAs, forms, trust badges) |
| **Agent Loop Pattern** | observe → reason → act → repeat | Use for page analysis pipeline |
| **Tool/Action Registry** | @tools.action decorator pattern | Create CRO analysis tools (friction detector, CTA analyzer) |
| **Element Indexing** | highlightIndex assignment to interactive elements | Adapt for element annotation in reports |
| **Error Handling** | Watchdog pattern + retry logic | Essential for robust crawling |
| **BrowserSession Management** | CDP-based session with multi-tab support | Required for multi-page journeys |

### 🔄 Useful With Changes

| Feature | Browser Use Implementation | CRO Adaptation Needed |
|---------|---------------------------|----------------------|
| **System Prompts** | Task execution focused | Rewrite for CRO analysis (pain point detection, heuristic checking) |
| **LLM Context Assembly** | Generic browser state | Add CRO-specific context (conversion factors, benchmark data) |
| **ActionResult Model** | Simple success/error tracking | Extend for CRO insights, scoring, recommendations |
| **Vision Analysis** | Screenshot for navigation | Use for visual hierarchy analysis, layout assessment |
| **Memory Management** | Step-by-step progress tracking | Track CRO findings across page journey |
| **File System Integration** | Generic file operations | Adapt for structured CRO report output |

### ⭐ Optional / Nice-to-Have

| Feature | Browser Use Implementation | CRO Relevance |
|---------|---------------------------|---------------|
| **Multi-model Support** | Provider-agnostic LLM layer | Nice for testing different models |
| **Cloud Deployment** | @sandbox decorator | Future scalability |
| **MCP Integration** | External tool connectivity | Potential for CRO tool ecosystem |
| **History Replay** | AgentHistoryList serialization | Debugging and audit trails |

### ❌ Not Relevant for CRO

| Feature | Reason |
|---------|--------|
| **Flash Mode Prompts** | Speed optimization for action tasks, not deep analysis |
| **CAPTCHA Handling** | Focus on analyzable pages, not login flows |
| **Download Detection** | CRO doesn't need file download tracking |
| **Code Execution Tools** | CRO is analysis, not code-running |

---

## 8. Missing but Needed for CRO

### 8.1 CRO-Specific Detection Not Present

| Missing Feature | What It Should Do | Design Suggestion |
|-----------------|-------------------|-------------------|
| **UX Pain Point Detection** | Identify friction (confusing CTAs, poor form UX, unclear value props) | LLM tool with CRO taxonomy prompt |
| **Heuristic Checklist Engine** | Baymard/NN-g style programmatic checks | Rule-based module + LLM validation |
| **Trust Signal Detection** | Find security badges, reviews, guarantees | CSS selector patterns + LLM classification |
| **CTA Analysis** | Assess button text, placement, contrast, urgency | DOM extraction + visual analysis |
| **Form Friction Analyzer** | Field count, validation UX, error messaging | Form-specific DOM parsing |
| **Value Proposition Extraction** | Headlines, benefits, unique selling points | Text extraction + semantic analysis |
| **Navigation Assessment** | Menu structure, breadcrumbs, search | Structural DOM analysis |

### 8.2 Structured CRO Output Not Present

| Missing Feature | What It Should Do | Design Suggestion |
|-----------------|-------------------|-------------------|
| **CRO Insight Model** | Structured output: issue, severity, location, recommendation | Pydantic model with CRO fields |
| **Hypothesis Generator** | Convert issues to testable A/B hypotheses | LLM prompt template |
| **Scoring System** | Rate pages on CRO dimensions | Weighted rubric in LLM prompt |
| **Evidence Capture** | Screenshot annotations, DOM snippets | Extend screenshot with element highlighting |

### 8.3 Multi-Page Journey Support Needs Enhancement

| Missing Feature | What It Should Do | Design Suggestion |
|-----------------|-------------------|-------------------|
| **URL Queue/Sitemap** | Crawl category → PDP → cart flows | Queue manager with depth control |
| **Journey Context** | Track user flow state across pages | Enhanced memory model |
| **Template Detection** | Identify page types (category, product, checkout) | LLM classification tool |
| **Cross-Page Issues** | Detect inconsistent UX patterns | Comparative analysis in post-processing |

### 8.4 Reporting & Storage Not Present

| Missing Feature | What It Should Do | Design Suggestion |
|-----------------|-------------------|-------------------|
| **Structured Report Generation** | Markdown/HTML/PDF output | Template engine with findings |
| **Screenshot Storage** | Before/after snapshots | File system with naming convention |
| **Finding Database** | Persist issues for tracking | SQLite or JSON storage |
| **Diff Analysis** | Compare scans over time | Snapshot comparison tool |

---

## 9. Step-by-Step Implementation Plan for CRO Browser Agent

### Phase 1: Core Infrastructure (Week 1-2)

#### 1.1 Project Setup
```
cro-browser-agent/
├── src/
│   ├── agent/
│   │   ├── cro_agent.ts        # Main agent class
│   │   ├── prompts/            # CRO-specific prompts
│   │   └── memory.ts           # CRO memory management
│   ├── browser/
│   │   ├── session.ts          # Playwright wrapper
│   │   ├── dom/
│   │   │   ├── extractor.ts    # DOM extraction
│   │   │   └── buildCroDomTree.js  # Injected script
│   │   └── screenshot.ts       # Screenshot capture
│   ├── tools/
│   │   ├── registry.ts         # Tool registration
│   │   ├── navigation.ts       # go_to_url, scroll, etc.
│   │   └── cro/                # CRO-specific tools
│   │       ├── cta_analyzer.ts
│   │       ├── form_analyzer.ts
│   │       ├── trust_detector.ts
│   │       └── friction_finder.ts
│   ├── analysis/
│   │   ├── heuristics.ts       # Rule-based checks
│   │   └── llm_analyzer.ts     # LLM-based analysis
│   ├── models/
│   │   ├── cro_insight.ts      # Finding data model
│   │   ├── page_state.ts       # Page analysis state
│   │   └── report.ts           # Report structure
│   └── output/
│       ├── reporter.ts         # Report generation
│       └── storage.ts          # Persistence
├── prompts/
│   ├── system_cro.md           # Main CRO system prompt
│   ├── cta_analysis.md
│   └── friction_detection.md
└── package.json
```

#### 1.2 Browser Session Module
```typescript
// src/browser/session.ts
import { chromium, Browser, Page, BrowserContext } from 'playwright';

export class CROBrowserSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async start(options: BrowserOptions = {}) {
    this.browser = await chromium.launch({
      headless: options.headless ?? true,
      args: ['--disable-blink-features=AutomationControlled']
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: options.userAgent
    });
    this.page = await this.context.newPage();
  }

  async navigateTo(url: string): Promise<void> {
    await this.page!.goto(url, { waitUntil: 'networkidle' });
  }

  async getPage(): Promise<Page> {
    if (!this.page) throw new Error('Session not started');
    return this.page;
  }

  async close() {
    await this.browser?.close();
  }
}
```

#### 1.3 DOM Extraction (Adapted from Browser Use)
```javascript
// src/browser/dom/buildCroDomTree.js
(function buildCroDomTree(doHighlight) {
  let highlightIndex = 0;
  
  const CRO_ELEMENTS = {
    cta: ['button', '[role="button"]', 'a.cta', '.buy-now', '.add-to-cart'],
    form: ['form', 'input', 'select', 'textarea'],
    trust: ['.trust-badge', '.security-seal', '.reviews', '.guarantee'],
    value_prop: ['h1', '.hero-text', '.value-proposition', '.headline'],
    navigation: ['nav', '.breadcrumb', '.menu', '.search']
  };

  function isInteractiveElement(node) {
    const tag = node.tagName?.toLowerCase();
    const role = node.getAttribute?.('role');
    return ['a', 'button', 'input', 'select', 'textarea'].includes(tag) ||
           ['button', 'link', 'menuitem'].includes(role) ||
           node.onclick != null ||
           node.getAttribute?.('contenteditable') === 'true';
  }

  function isElementVisible(node) {
    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    return rect.width > 0 && rect.height > 0 &&
           style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           parseFloat(style.opacity) > 0;
  }

  function classifyCROElement(node) {
    const tag = node.tagName?.toLowerCase();
    const classes = node.className || '';
    const id = node.id || '';
    
    for (const [type, selectors] of Object.entries(CRO_ELEMENTS)) {
      for (const selector of selectors) {
        if (node.matches?.(selector)) return type;
      }
    }
    return null;
  }

  function buildTree(node, parentIframe = null) {
    if (!node || node.nodeType === Node.COMMENT_NODE) return null;
    
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (!text) return null;
      return { type: 'TEXT_NODE', text };
    }

    const tag = node.tagName?.toLowerCase();
    if (['script', 'style', 'noscript', 'svg', 'path'].includes(tag)) return null;

    const nodeData = {
      tagName: tag,
      attributes: {},
      xpath: getXPath(node),
      children: [],
      croType: classifyCROElement(node),
      isInteractive: isInteractiveElement(node),
      isVisible: isElementVisible(node)
    };

    // Collect relevant attributes
    const attrs = ['id', 'class', 'href', 'type', 'name', 'placeholder', 
                   'aria-label', 'data-testid', 'role'];
    attrs.forEach(attr => {
      const val = node.getAttribute?.(attr);
      if (val) nodeData.attributes[attr] = val;
    });

    // Assign highlight index for interactive/CRO elements
    if (nodeData.isVisible && (nodeData.isInteractive || nodeData.croType)) {
      nodeData.highlightIndex = highlightIndex++;
      if (doHighlight) highlightElement(node, nodeData.highlightIndex);
    }

    // Recurse children
    for (const child of node.childNodes) {
      const childData = buildTree(child, parentIframe);
      if (childData) nodeData.children.push(childData);
    }

    return nodeData;
  }

  function getXPath(element) {
    if (!element) return '';
    if (element.id) return `//*[@id="${element.id}"]`;
    if (element === document.body) return '/html/body';
    
    let ix = 1;
    const siblings = element.parentNode?.childNodes || [];
    for (const sibling of siblings) {
      if (sibling === element) {
        return getXPath(element.parentNode) + '/' + 
               element.tagName.toLowerCase() + '[' + ix + ']';
      }
      if (sibling.nodeType === 1 && sibling.tagName === element.tagName) ix++;
    }
    return '';
  }

  function highlightElement(node, index) {
    const rect = node.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; left: ${rect.left}px; top: ${rect.top}px;
      width: ${rect.width}px; height: ${rect.height}px;
      border: 2px solid red; pointer-events: none; z-index: 99999;
    `;
    const label = document.createElement('span');
    label.textContent = index;
    label.style.cssText = `
      position: absolute; top: -20px; left: 0; background: red;
      color: white; padding: 2px 6px; font-size: 12px;
    `;
    overlay.appendChild(label);
    document.body.appendChild(overlay);
  }

  return JSON.stringify(buildTree(document.body));
})
```

### Phase 2: Agent Core (Week 2-3)

#### 2.1 CRO Agent Class
```typescript
// src/agent/cro_agent.ts
import { ChatOpenAI } from '@langchain/openai';
import { CROBrowserSession } from '../browser/session';
import { ToolRegistry } from '../tools/registry';
import { CROInsight, PageAnalysis } from '../models';

export class CROAgent {
  private session: CROBrowserSession;
  private llm: ChatOpenAI;
  private tools: ToolRegistry;
  private memory: CROMemory;
  private maxSteps: number;

  constructor(options: CROAgentOptions) {
    this.session = new CROBrowserSession();
    this.llm = new ChatOpenAI({ 
      modelName: options.model ?? 'gpt-4o',
      temperature: 0.3
    });
    this.tools = new ToolRegistry();
    this.memory = new CROMemory();
    this.maxSteps = options.maxSteps ?? 10;
    
    this.registerCROTools();
  }

  private registerCROTools() {
    this.tools.register('analyze_ctas', analyzeCTAs);
    this.tools.register('analyze_forms', analyzeForms);
    this.tools.register('detect_trust_signals', detectTrustSignals);
    this.tools.register('assess_value_prop', assessValueProposition);
    this.tools.register('check_navigation', checkNavigation);
    this.tools.register('find_friction', findFriction);
    this.tools.register('take_screenshot', takeScreenshot);
    this.tools.register('done', completeAnalysis);
  }

  async analyze(url: string): Promise<PageAnalysis> {
    await this.session.start();
    await this.session.navigateTo(url);

    const insights: CROInsight[] = [];
    let step = 0;

    while (step < this.maxSteps) {
      // 1. Get page state
      const pageState = await this.getPageState();
      
      // 2. Build LLM context
      const messages = this.buildMessages(pageState);
      
      // 3. Get LLM decision
      const response = await this.llm.invoke(messages);
      const action = this.parseAction(response);
      
      // 4. Execute action
      const result = await this.tools.execute(action.name, action.params);
      
      // 5. Collect insights
      if (result.insights) {
        insights.push(...result.insights);
      }
      
      // 6. Update memory
      this.memory.add(action, result);
      
      // 7. Check completion
      if (action.name === 'done') break;
      
      step++;
    }

    await this.session.close();
    
    return {
      url,
      insights,
      screenshots: this.memory.screenshots,
      summary: this.generateSummary(insights)
    };
  }

  private async getPageState(): Promise<PageState> {
    const page = await this.session.getPage();
    
    // Inject DOM extractor
    const domTree = await page.evaluate(buildCroDomTree, false);
    const parsed = JSON.parse(domTree);
    
    // Capture screenshot
    const screenshot = await page.screenshot({ fullPage: true });
    
    return {
      url: page.url(),
      title: await page.title(),
      domTree: parsed,
      screenshot: screenshot.toString('base64'),
      interactiveElements: this.extractInteractive(parsed)
    };
  }

  private buildMessages(state: PageState) {
    return [
      { role: 'system', content: CRO_SYSTEM_PROMPT },
      { role: 'user', content: this.formatStateForLLM(state) }
    ];
  }
}
```

#### 2.2 CRO System Prompt
```markdown
<!-- prompts/system_cro.md -->
<identity>
You are an expert CRO (Conversion Rate Optimization) analyst. Your job is to 
systematically analyze web pages and identify opportunities to improve conversion rates.
</identity>

<expertise>
You excel at:
- Identifying UX friction points that prevent conversions
- Assessing CTA effectiveness (copy, placement, visual prominence)
- Evaluating form usability and potential abandonment causes
- Detecting trust signals (or their absence)
- Analyzing value propositions and messaging clarity
- Reviewing navigation and user flow
</expertise>

<input_format>
You receive:
1. <page_url>: Current page URL
2. <page_title>: Document title
3. <cro_elements>: Structured list of CRO-relevant elements
   - CTAs (buttons, links) with index, text, attributes
   - Forms with fields and validation
   - Trust signals found
   - Value proposition elements
4. <screenshot>: Visual capture (if vision enabled)
5. <memory>: Previous findings in this analysis
</input_format>

<output_format>
Respond with valid JSON:
{
  "thinking": "Your analysis reasoning...",
  "findings_so_far": "Brief summary of findings collected",
  "next_focus": "What CRO aspect to analyze next",
  "action": {
    "name": "tool_name",
    "params": {...}
  }
}
</output_format>

<available_tools>
- analyze_ctas: Evaluate all CTAs on page
- analyze_forms: Assess form usability
- detect_trust_signals: Find trust indicators
- assess_value_prop: Analyze messaging clarity
- check_navigation: Review navigation UX
- find_friction: Identify conversion barriers
- take_screenshot: Capture annotated screenshot
- scroll_page: Scroll to reveal more content
- done: Complete analysis with final insights
</available_tools>

<cro_heuristics>
Apply these proven principles:
- Clarity > Cleverness: CTAs should be obvious
- Reduce friction: Every field, click, decision is friction
- Build trust: Security, social proof, guarantees matter
- Value first: Clear value prop before asking for action
- Mobile-first: Assume touch targets, limited attention
- Error prevention: Inline validation, clear requirements
</cro_heuristics>
```

### Phase 3: CRO Tools (Week 3-4)

#### 3.1 CTA Analyzer Tool
```typescript
// src/tools/cro/cta_analyzer.ts
export async function analyzeCTAs(
  session: CROBrowserSession,
  domTree: DOMTree
): Promise<ToolResult> {
  const ctas = extractCTAs(domTree);
  const insights: CROInsight[] = [];

  for (const cta of ctas) {
    // Check CTA text
    const textIssues = assessCTAText(cta.text);
    if (textIssues.length > 0) {
      insights.push({
        type: 'cta_text',
        severity: 'medium',
        element: cta.xpath,
        issue: textIssues.join('; '),
        recommendation: generateCTATextRecommendation(cta.text),
        evidence: { originalText: cta.text }
      });
    }

    // Check visual prominence
    const page = await session.getPage();
    const element = await page.$(cta.selector);
    if (element) {
      const styles = await element.evaluate(getComputedStyles);
      const prominenceIssues = assessCTAProminence(styles);
      // ... add insights
    }

    // Check placement
    const placementIssues = assessCTAPlacement(cta.position);
    // ... add insights
  }

  return { insights, extracted: ctas };
}

function assessCTAText(text: string): string[] {
  const issues: string[] = [];
  
  // Vague text check
  const vaguePhrases = ['click here', 'submit', 'learn more', 'read more'];
  if (vaguePhrases.some(p => text.toLowerCase().includes(p))) {
    issues.push('Vague CTA text lacks action clarity');
  }
  
  // Length check
  if (text.length > 25) {
    issues.push('CTA text too long; ideal is 2-5 words');
  }
  
  // No verb check
  const actionVerbs = ['get', 'start', 'try', 'buy', 'shop', 'book', 'join'];
  if (!actionVerbs.some(v => text.toLowerCase().startsWith(v))) {
    issues.push('CTA should start with action verb');
  }

  return issues;
}
```

#### 3.2 Form Analyzer Tool
```typescript
// src/tools/cro/form_analyzer.ts
export async function analyzeForms(
  session: CROBrowserSession,
  domTree: DOMTree
): Promise<ToolResult> {
  const forms = extractForms(domTree);
  const insights: CROInsight[] = [];

  for (const form of forms) {
    // Field count
    if (form.fields.length > 5) {
      insights.push({
        type: 'form_length',
        severity: 'high',
        element: form.xpath,
        issue: `Form has ${form.fields.length} fields; high abandonment risk`,
        recommendation: 'Consider progressive disclosure or removing optional fields',
        evidence: { fieldCount: form.fields.length }
      });
    }

    // Required fields without indicators
    for (const field of form.fields) {
      if (field.required && !field.hasRequiredIndicator) {
        insights.push({
          type: 'form_required_indicator',
          severity: 'medium',
          element: field.xpath,
          issue: 'Required field lacks visual indicator',
          recommendation: 'Add asterisk or "required" label'
        });
      }

      // Inline validation
      if (!field.hasInlineValidation) {
        insights.push({
          type: 'form_validation',
          severity: 'medium',
          element: field.xpath,
          issue: 'Field lacks inline validation',
          recommendation: 'Add real-time validation feedback'
        });
      }
    }

    // Submit button assessment
    if (form.submitButton) {
      const buttonIssues = assessFormButton(form.submitButton);
      insights.push(...buttonIssues);
    }
  }

  return { insights, extracted: forms };
}
```

### Phase 4: Analysis Pipeline (Week 4-5)

#### 4.1 Multi-Page Journey Support
```typescript
// src/agent/journey_analyzer.ts
export class JourneyAnalyzer extends CROAgent {
  async analyzeJourney(entryUrl: string, journey: JourneyStep[]): Promise<JourneyAnalysis> {
    const pageAnalyses: PageAnalysis[] = [];
    const crossPageInsights: CROInsight[] = [];

    for (const step of journey) {
      // Navigate based on step type
      if (step.type === 'url') {
        await this.session.navigateTo(step.value);
      } else if (step.type === 'click') {
        await this.clickElement(step.selector);
      }

      // Analyze current page
      const analysis = await this.analyzePage();
      pageAnalyses.push(analysis);

      // Check journey-specific issues
      const journeyIssues = this.checkJourneyConsistency(
        pageAnalyses,
        step.expectedPageType
      );
      crossPageInsights.push(...journeyIssues);
    }

    return {
      journey: pageAnalyses,
      crossPageInsights,
      funnelAnalysis: this.analyzeFunnel(pageAnalyses)
    };
  }

  private checkJourneyConsistency(
    analyses: PageAnalysis[],
    expectedType: string
  ): CROInsight[] {
    const insights: CROInsight[] = [];
    
    if (analyses.length >= 2) {
      const prev = analyses[analyses.length - 2];
      const curr = analyses[analyses.length - 1];

      // Check CTA consistency
      if (this.hasInconsistentCTAStyle(prev, curr)) {
        insights.push({
          type: 'journey_inconsistency',
          severity: 'medium',
          issue: 'CTA styling inconsistent across journey',
          recommendation: 'Maintain visual consistency for CTAs'
        });
      }

      // Check navigation clarity
      if (!this.hasClearBackNavigation(curr)) {
        insights.push({
          type: 'journey_navigation',
          severity: 'high',
          issue: 'No clear back navigation in checkout flow',
          recommendation: 'Add breadcrumbs or back buttons'
        });
      }
    }

    return insights;
  }
}
```

### Phase 5: Output & Reporting (Week 5-6)

#### 5.1 CRO Report Generator
```typescript
// src/output/reporter.ts
export class CROReporter {
  generateMarkdownReport(analysis: PageAnalysis): string {
    const { url, insights, screenshots } = analysis;
    
    const grouped = this.groupInsightsBySeverity(insights);
    
    let report = `# CRO Analysis Report\n\n`;
    report += `**URL:** ${url}\n`;
    report += `**Date:** ${new Date().toISOString()}\n\n`;
    
    // Executive Summary
    report += `## Executive Summary\n\n`;
    report += `Found ${insights.length} optimization opportunities:\n`;
    report += `- 🔴 Critical: ${grouped.critical.length}\n`;
    report += `- 🟠 High: ${grouped.high.length}\n`;
    report += `- 🟡 Medium: ${grouped.medium.length}\n`;
    report += `- 🟢 Low: ${grouped.low.length}\n\n`;

    // Critical Issues
    if (grouped.critical.length > 0) {
      report += `## 🔴 Critical Issues\n\n`;
      for (const insight of grouped.critical) {
        report += this.formatInsight(insight);
      }
    }

    // High Priority
    if (grouped.high.length > 0) {
      report += `## 🟠 High Priority\n\n`;
      for (const insight of grouped.high) {
        report += this.formatInsight(insight);
      }
    }

    // ... continue for medium/low

    // A/B Test Hypotheses
    report += `## Recommended A/B Tests\n\n`;
    const hypotheses = this.generateHypotheses(insights);
    for (const hyp of hypotheses) {
      report += `### ${hyp.title}\n`;
      report += `**Hypothesis:** ${hyp.hypothesis}\n`;
      report += `**Primary Metric:** ${hyp.metric}\n`;
      report += `**Expected Impact:** ${hyp.expectedImpact}\n\n`;
    }

    return report;
  }

  private formatInsight(insight: CROInsight): string {
    return `### ${insight.type}\n` +
           `**Issue:** ${insight.issue}\n` +
           `**Location:** \`${insight.element}\`\n` +
           `**Recommendation:** ${insight.recommendation}\n\n`;
  }

  private generateHypotheses(insights: CROInsight[]): Hypothesis[] {
    return insights
      .filter(i => i.severity === 'critical' || i.severity === 'high')
      .map(insight => ({
        title: `Optimize ${insight.type}`,
        hypothesis: `If we ${insight.recommendation.toLowerCase()}, then conversion will increase because ${insight.issue.toLowerCase()} is currently causing friction`,
        metric: this.getMetricForType(insight.type),
        expectedImpact: this.estimateImpact(insight)
      }));
  }
}
```

### Phase 6: Integration & Testing (Week 6-7)

#### 6.1 Main Entry Point
```typescript
// src/index.ts
import { CROAgent } from './agent/cro_agent';
import { JourneyAnalyzer } from './agent/journey_analyzer';
import { CROReporter } from './output/reporter';

export async function analyzeUrl(url: string, options: CROOptions = {}) {
  const agent = new CROAgent({
    model: options.model ?? 'gpt-4o',
    maxSteps: options.maxSteps ?? 15
  });

  const analysis = await agent.analyze(url);
  
  const reporter = new CROReporter();
  const report = reporter.generateMarkdownReport(analysis);
  
  if (options.outputPath) {
    await fs.writeFile(options.outputPath, report);
  }

  return { analysis, report };
}

export async function analyzeJourney(
  entryUrl: string,
  journey: JourneyStep[],
  options: CROOptions = {}
) {
  const analyzer = new JourneyAnalyzer(options);
  return analyzer.analyzeJourney(entryUrl, journey);
}

// CLI usage
if (require.main === module) {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: npx cro-agent <url>');
    process.exit(1);
  }
  analyzeUrl(url, { outputPath: './cro-report.md' })
    .then(() => console.log('Analysis complete!'))
    .catch(console.error);
}
```

---

## Summary: What to Build vs What to Borrow

### Build New (CRO-Specific)
1. CRO taxonomy and heuristic rules
2. CRO-specific DOM classification (croType)
3. Analysis tools (CTA, form, trust, value prop)
4. Hypothesis generation logic
5. Report templates
6. Journey-level analysis

### Adapt from Browser Use
1. DOM extraction pattern (buildDomTree.js)
2. Agent loop structure (observe-reason-act)
3. Tool registry pattern (@tools.action)
4. Error handling and retry logic
5. Memory/context management approach
6. Element indexing and mapping

### Use As-Is (If Compatible)
1. Playwright for browser automation
2. LangChain for LLM integration
3. Pydantic patterns for data validation

This plan gives you a clear path from Browser Use's patterns to a specialized CRO analysis tool tailored to your work.
