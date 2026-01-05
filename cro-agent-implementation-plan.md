# CRO Browser Agent: Implementation Plan

**Document Type**: Session Context for AI-Assisted Development  
**Created**: 2025-12-02  
**Source**: Comparison of Browser Use (Python) with existing Browser Agent spec kit  
**Stack**: Node.js 20.x, TypeScript, Playwright, LangChain, OpenAI GPT-4o

---

## Executive Summary

This document provides a phased implementation plan to evolve the current Browser Agent (a single-pass heading extractor) into a full CRO analysis agent. The plan is based on analyzing the open-source Browser Use project and mapping its patterns to Node.js/Playwright/LangChain.

**Current state**: MVP complete (53 tasks). Can load URLs, dismiss cookies, extract h1-h6, process via LangChain.  
**Target state**: Autonomous CRO agent with iterative analysis, tool registry, and hypothesis generation.

---

## Part 1: Architecture Comparison

### Browser Use (Reference Project)

| Aspect | Details |
|--------|---------|
| **Purpose** | General-purpose LLM-powered browser automation |
| **Stack** | Python 3.11+, CDP (via cdp-use), Pydantic, bubus event bus |
| **Core Pattern** | Observe → Reason → Act → Repeat (agent loop) |
| **DOM Extraction** | `buildDomTree.js` injection with visibility/interactivity detection |
| **Tool System** | `@tools.action` decorator for extensible actions |
| **Memory** | Three-tier: short-term state, working memory, long-term history |
| **LLM Integration** | Multi-provider (OpenAI, Anthropic, Google, local) |

### My Browser Agent (Current)

| Aspect | Details |
|--------|---------|
| **Purpose** | CRO-focused site extraction and analysis |
| **Stack** | Node.js 20.x, TypeScript, Playwright, LangChain, OpenAI |
| **Core Pattern** | Single-pass: Load → Extract → Process → Output |
| **DOM Extraction** | Headings only (h1-h6 via Playwright locator) |
| **Tool System** | None (hardcoded extraction) |
| **Memory** | Stateless |
| **LLM Integration** | OpenAI GPT-4o-mini only |

### Critical Gaps to Address

1. **No agent loop** - Cannot iteratively decide which analysis to run
2. **Minimal DOM extraction** - Only headings, not CTAs/forms/trust signals
3. **No tool registry** - Cannot extend with new analysis capabilities
4. **No structured LLM output** - Freeform insights, not predictable JSON
5. **No CRO-specific prompts** - Generic heading analysis, not CRO expertise

---

## Part 2: Feature Mapping (Browser Use → My Agent)

### Core Features (Must Implement)

| # | Feature | Browser Use | My Implementation Approach |
|---|---------|-------------|---------------------------|
| 1 | **Agent Loop** | `Agent.step()` with max_steps | `CROAgent.analyze()` with while loop, step counter |
| 2 | **DOM Extraction** | `buildDomTree.js` with recursive traversal | `buildCroDomTree.js` with CRO element classification |
| 3 | **Interactive Detection** | `isInteractiveElement()` | Check tag/role/onclick, add CRO patterns |
| 4 | **Visibility Analysis** | `isElementVisible()` | CSS display/visibility/opacity + bounding rect |
| 5 | **Element Indexing** | `highlightIndex` assignment | Sequential index for visible CRO elements |
| 6 | **Tool Registry** | `@tools.action` decorator | `ToolRegistry` class with register/execute |
| 7 | **System Prompt** | XML-structured `system_prompt.md` | `prompts/system-cro.md` with CRO expertise |
| 8 | **Structured Output** | Pydantic `AgentOutput` model | Zod schema for `CROAgentOutput` |

### Important Features (Should Implement)

| # | Feature | Browser Use | My Implementation Approach |
|---|---------|-------------|---------------------------|
| 9 | **Self-Correction** | Consecutive failure counter, retry | Track failures, force `done` after 3 |
| 10 | **Message Manager** | Context assembly + history compression | `buildMessages()` with token budget |
| 11 | **Memory System** | Three-tier memory | `CROMemory` class for journey analysis |
| 12 | **Session Management** | Multi-tab support | Enhance `BrowserManager` for journeys |

### Nice-to-Have Features (Later)

| # | Feature | Decision |
|---|---------|----------|
| 13 | Vision support | Later - screenshots to multimodal LLM |
| 14 | Multi-model support | Later - abstract LLM interface |
| 15 | History replay | Later - serialize steps for debugging |
| 16 | Anti-bot/stealth | Later - Playwright stealth plugin |

### Not Relevant for CRO

| Feature | Reason |
|---------|--------|
| CDP direct access | Playwright sufficient, simpler API |
| EventBus/Watchdogs | Overkill for page analysis |
| Download detection | CRO doesn't need file tracking |
| CAPTCHA handling | Focus on analyzable public pages |
| Flash mode prompts | CRO needs depth, not speed |

---

## Part 3: Target Project Structure

```
src/
├── agent/
│   ├── cro-agent.ts           # Main agent with step loop
│   ├── message-builder.ts     # LLM context assembly
│   ├── output-parser.ts       # Parse structured LLM response
│   └── journey-analyzer.ts    # Multi-page CRO analysis
├── browser/
│   ├── browser-manager.ts     # (existing)
│   ├── page-loader.ts         # (existing)
│   ├── cookie-handler.ts      # (existing)
│   └── dom/
│       ├── extractor.ts       # Inject and run DOM script
│       └── buildCroDomTree.js # DOM extraction with CRO classification
├── tools/
│   ├── registry.ts            # Tool registration and execution
│   ├── navigation.ts          # scroll_page, go_to_url
│   └── cro/
│       ├── cta-analyzer.ts    # CTA text, placement, prominence
│       ├── form-analyzer.ts   # Field count, validation, labels
│       ├── trust-detector.ts  # Security badges, reviews
│       ├── value-prop.ts      # Headlines, benefits, USPs
│       ├── navigation.ts      # Menu, breadcrumbs, search
│       └── friction-finder.ts # General friction detection
├── analysis/
│   ├── heuristics.ts          # Rule-based checks (Baymard-style)
│   ├── business-type.ts       # Detect e-commerce/banking/travel
│   └── scoring.ts             # Weighted severity scoring
├── models/
│   ├── page-state.ts          # DOM + meta state
│   ├── cro-insight.ts         # Finding with severity/evidence
│   ├── agent-output.ts        # Zod schema for LLM response
│   ├── hypothesis.ts          # A/B test hypothesis
│   └── cro-report.ts          # Full analysis report
├── output/
│   ├── hypothesis-generator.ts
│   ├── markdown-reporter.ts
│   └── json-exporter.ts
└── prompts/
    ├── system-cro.md          # Main CRO system prompt
    ├── cta-analysis.md        # CTA-specific prompt
    └── friction-detection.md  # Friction detection prompt
```

---

## Part 4: Phased Implementation Plan

### Phase 1: Robust Core Agent (Weeks 1-2)

**Goal**: Transform single-pass extractor into iterative agent loop

#### Tasks

```
[ ] P1-01: Create buildCroDomTree.js with CRO element classification
    - Recursive DOM traversal from document.body
    - isInteractiveElement() for buttons/links/inputs
    - isElementVisible() for visibility checks
    - classifyCROElement() returning: cta|form|trust|value_prop|navigation|null
    - Output: JSON with tagName, xpath, isInteractive, isVisible, croType, highlightIndex, children[]

[ ] P1-02: Create src/browser/dom/extractor.ts
    - DOMExtractor class
    - extract(page: Page): Promise<DOMTree>
    - Injects buildCroDomTree.js via page.evaluate()
    - Parses JSON result

[ ] P1-03: Create src/tools/registry.ts
    - ToolRegistry class
    - register(name: string, fn: ToolFunction): void
    - execute(name: string, params: object): Promise<ToolResult>
    - getAvailableTools(): string[]

[ ] P1-04: Create src/models/agent-output.ts
    - Zod schema for CROAgentOutput
    - Fields: thinking, findings_so_far, next_focus, action: { name, params }
    - Validation function

[ ] P1-05: Create prompts/system-cro.md
    - <identity>: CRO expert analyst
    - <expertise>: UX friction, CTAs, forms, trust signals, value props
    - <input_format>: page_url, page_title, cro_elements, memory
    - <output_format>: JSON schema matching agent-output.ts
    - <available_tools>: list with descriptions
    - <cro_heuristics>: key principles (clarity > cleverness, reduce friction, etc.)

[ ] P1-06: Create src/agent/cro-agent.ts
    - CROAgent class
    - constructor(options: CROAgentOptions)
    - analyze(url: string): Promise<PageAnalysis>
    - Agent loop: while (step < maxSteps) { observe → reason → act }
    - Track consecutiveFailures, force done after 3
    - registerCROTools() on init

[ ] P1-07: Create src/agent/message-builder.ts
    - buildMessages(state: PageState, memory: CROMemory): Message[]
    - Load system prompt from file
    - Format page state for LLM
    - Token budget tracking (warn at 60%)

[ ] P1-08: Create basic CRO tools
    - src/tools/cro/cta-analyzer.ts
    - src/tools/cro/friction-finder.ts
    - src/tools/navigation.ts (scroll_page)
    - done tool (complete analysis)

[ ] P1-09: Create src/models/cro-insight.ts
    - CROInsight interface
    - type, severity, element (xpath), issue, recommendation, evidence

[ ] P1-10: Create src/models/page-state.ts
    - PageState interface
    - url, title, domTree, interactiveElements, croElements

[ ] P1-11: Integration tests for agent loop
    - Test with example.com (simple)
    - Test with real e-commerce site
    - Verify step count, tool execution, insights collection
```

#### Checkpoint
- Agent can analyze a URL with 2-3 tool invocations
- Produces structured CROInsight[] array
- Respects max_steps limit
- Handles tool failures gracefully

---

### Phase 2: CRO-Aware Analysis (Weeks 3-4)

**Goal**: Implement full CRO toolkit with heuristic checks

#### Tasks

```
[ ] P2-01: Complete CRO tool suite
    - form-analyzer.ts: field count, labels, validation, required indicators
    - trust-detector.ts: security badges, reviews, guarantees, certifications
    - value-prop.ts: headlines, benefits, USPs, clarity assessment
    - navigation.ts: menu structure, breadcrumbs, search, back navigation

[ ] P2-02: Create src/analysis/heuristics.ts
    - HeuristicEngine class
    - Rule interface: { id, check: (state) => CROInsight | null }
    - 20+ rules based on Baymard/NN-g best practices
    - Examples:
      - CTA text vague → medium severity
      - Form >5 fields → high severity
      - No trust signals above fold → medium
      - No breadcrumbs on category → low

[ ] P2-03: Create src/analysis/business-type.ts
    - BusinessTypeDetector class
    - detect(domTree: DOMTree): BusinessType
    - Types: ecommerce, saas, banking, insurance, travel, media, other
    - Detection via URL patterns, DOM elements, meta tags

[ ] P2-04: Create src/analysis/scoring.ts
    - SeverityScorer class
    - score(insights: CROInsight[]): ScoreResult
    - Weighted by business type (e.g., cart issues more severe for e-commerce)
    - Output: overall score, breakdown by category

[ ] P2-05: Update system prompt with business type context
    - Add <business_type> section
    - Type-specific heuristics
    - Industry benchmarks

[ ] P2-06: Enhanced CROInsight model
    - Add: businessType, category, confidence, evidenceScreenshot
    - Zod schema with validation

[ ] P2-07: Test suite for heuristics
    - Unit tests for each rule
    - Integration tests with real sites per business type
```

#### Checkpoint
- Full CRO toolkit (6+ tools)
- 20+ heuristic rules firing correctly
- Business type detection working
- Severity scoring producing meaningful output

---

### Phase 3: Hypothesis Generation & Output (Weeks 5-6)

**Goal**: Transform insights into actionable A/B test specs

#### Tasks

```
[ ] P3-01: Create src/models/hypothesis.ts
    - Hypothesis interface
    - title, hypothesis (If X then Y because Z)
    - controlDescription, treatmentDescription
    - primaryMetric, expectedImpact, priority

[ ] P3-02: Create src/output/hypothesis-generator.ts
    - HypothesisGenerator class
    - generate(insights: CROInsight[]): Hypothesis[]
    - Filter to high/critical severity
    - Template: "If we {recommendation}, then {metric} will improve because {issue}"

[ ] P3-03: Create src/output/markdown-reporter.ts
    - CROReporter class
    - generateReport(analysis: PageAnalysis): string
    - Sections: Executive Summary, Critical Issues, High Priority, Medium, Low
    - Recommended A/B Tests section
    - Evidence links (XPath, screenshots)

[ ] P3-04: Create src/output/json-exporter.ts
    - Export full analysis as structured JSON
    - Schema documented for API consumers

[ ] P3-05: Create src/agent/journey-analyzer.ts
    - JourneyAnalyzer class extends CROAgent
    - analyzeJourney(entryUrl, steps[]): JourneyAnalysis
    - Cross-page consistency checks
    - Funnel analysis (drop-off points)

[ ] P3-06: Create src/agent/memory.ts
    - CROMemory class
    - currentState, stepHistory[], findings[]
    - add(action, result): void
    - getContext(): string (for LLM)
    - serialize/deserialize for persistence

[ ] P3-07: CLI enhancements
    - --max-steps flag
    - --output-format (json|markdown)
    - --output-file path
    - --business-type override

[ ] P3-08: End-to-end test suite
    - 5+ sites across business types
    - Verify hypothesis generation
    - Verify report output
    - Verify journey analysis
```

#### Checkpoint
- Hypotheses generated from insights
- Markdown reports with all sections
- Journey analysis working for 3-page flows
- CLI supports all output formats

---

## Part 5: Key Technical Decisions

### DOM Extraction Strategy

```javascript
// buildCroDomTree.js - Core classification logic
const CRO_ELEMENTS = {
  cta: ['button', '[role="button"]', 'a.cta', '.buy-now', '.add-to-cart', 
        '[class*="cta"]', '[class*="button"]'],
  form: ['form', 'input', 'select', 'textarea', '[role="form"]'],
  trust: ['.trust-badge', '.security-seal', '.reviews', '.guarantee',
          '[class*="trust"]', '[class*="secure"]', 'img[alt*="ssl"]'],
  value_prop: ['h1', '.hero-text', '.value-proposition', '.headline',
               '[class*="hero"]', '[class*="headline"]'],
  navigation: ['nav', '.breadcrumb', '.menu', '.search', '[role="navigation"]']
};
```

### Structured LLM Output Schema

```typescript
// Zod schema for CROAgentOutput
const CROAgentOutputSchema = z.object({
  thinking: z.string().describe('Your analysis reasoning'),
  findings_so_far: z.string().describe('Brief summary of collected findings'),
  next_focus: z.string().describe('What CRO aspect to analyze next'),
  action: z.object({
    name: z.enum(['analyze_ctas', 'analyze_forms', 'detect_trust_signals',
                  'assess_value_prop', 'check_navigation', 'find_friction',
                  'scroll_page', 'done']),
    params: z.record(z.any()).optional()
  })
});
```

### Tool Result Interface

```typescript
interface ToolResult {
  success: boolean;
  insights: CROInsight[];
  extracted?: unknown;  // Raw data for debugging
  error?: string;
}

interface CROInsight {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  element: string;  // XPath
  issue: string;
  recommendation: string;
  evidence?: {
    text?: string;
    screenshot?: string;  // base64 or file path
    styles?: Record<string, string>;
  };
}
```

### Agent Loop Pattern

```typescript
async analyze(url: string): Promise<PageAnalysis> {
  await this.session.start();
  await this.session.navigateTo(url);

  const insights: CROInsight[] = [];
  let step = 0;
  let consecutiveFailures = 0;

  while (step < this.maxSteps) {
    // 1. Observe
    const pageState = await this.getPageState();
    
    // 2. Reason
    const messages = this.messageBuilder.build(pageState, this.memory);
    const response = await this.llm.invoke(messages);
    const output = this.parseOutput(response);
    
    // 3. Act
    try {
      const result = await this.tools.execute(output.action.name, output.action.params);
      insights.push(...result.insights);
      this.memory.add(output.action, result);
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        break;  // Force exit
      }
    }
    
    // 4. Check completion
    if (output.action.name === 'done') break;
    step++;
  }

  await this.session.close();
  return { url, insights, summary: this.generateSummary(insights) };
}
```

---

## Part 6: Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| DOM too large for LLM context | High | High | Selective extraction: only CRO elements, truncate text >100 chars |
| Invalid tool calls from LLM | Medium | Medium | Strict Zod validation, retry with error, fallback to `done` |
| Agent loops forever | Medium | High | Enforce max_steps (10-15), force `done` after 3 failures |
| Flaky XPath selectors | Medium | Low | Prefer ID-based when available, log failed selectors |
| Anti-bot blocks | Low | High | Playwright stealth plugin, rate limiting, respect robots.txt |
| CRO heuristics outdated | Low | Medium | Store rules in config, update quarterly |

---

## Part 7: Success Criteria

### Phase 1 Complete When:
- [ ] Agent analyzes example.com with 3+ tool invocations
- [ ] DOM extraction captures CTAs, forms, trust signals
- [ ] Structured output validates against Zod schema
- [ ] Tool failures handled gracefully

### Phase 2 Complete When:
- [ ] All 6 CRO tools implemented and tested
- [ ] 20+ heuristic rules firing correctly
- [ ] Business type detected on 80%+ of test sites
- [ ] Severity scoring produces actionable prioritization

### Phase 3 Complete When:
- [ ] Hypotheses generated for all high/critical issues
- [ ] Markdown reports include all required sections
- [ ] Journey analysis works for 3-page e-commerce flow
- [ ] CLI supports json/markdown output formats

---

## Part 8: Quick Reference

### Commands

```bash
# Current MVP (heading extraction)
npm run start -- https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy

# After Phase 1 (agent analysis)
npm run analyze -- https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy --max-steps 10

# After Phase 3 (full output)
npm run analyze -- https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy --output-format markdown --output-file report.md
```

### Key Files to Read First

```
specs/001-browser-agent-core/spec.md      # Current requirements
specs/001-browser-agent-core/plan.md      # Current architecture
specs/001-browser-agent-core/tasks.md     # Implementation status
```

### External References

- Browser Use repo: https://github.com/browser-use/browser-use
- Baymard UX guidelines: https://baymard.com/ux-benchmark
- LangChain structured output: https://js.langchain.com/docs/modules/model_io/output_parsers/

---

*This document serves as context for AI-assisted development sessions. Update after each phase completion.*
