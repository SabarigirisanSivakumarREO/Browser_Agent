# Code Walkthrough: Browser Agent

**Last Updated**: 2026-01-30 (Reviewed - no changes needed for CR-001)

---

## What Does This Application Do?

A CLI-based CRO (Conversion Rate Optimization) analysis tool that:
1. Opens a website in a browser (Chromium)
2. Extracts and classifies DOM elements (CTAs, forms, trust signals, value propositions)
3. Uses AI (GPT-4o) to perform multi-step CRO analysis
4. Generates insights, hypotheses, and optimization recommendations
5. Outputs reports in console, markdown, or JSON format

**Default Mode (CRO Analysis)**:
```bash
npm run start -- https://www.conversion.com/
```
**Output**: CRO score, actionable insights, A/B test hypotheses, severity-prioritized recommendations.

**Scan Modes (Phase 19)**:
```bash
npm run start -- --scan-mode=full_page https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy # 100% page coverage (default)
npm run start -- --scan-mode=above_fold https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy# Only initial viewport
npm run start -- --scan-mode=llm_guided https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy# LLM decides scrolling
```

---

## How It Works (Simple Flow)

```
User provides URL
       ↓
┌─────────────────┐
│  Browser opens  │  ← Playwright launches Chromium
│  page loads     │  ← Waits for network idle (all content loaded)
└────────┬────────┘
         ↓
┌─────────────────┐
│ Extract h1-h6   │  ← Finds all heading elements in DOM
│ headings        │  ← Gets text content and level (1-6)
└────────┬────────┘
         ↓
┌─────────────────┐
│ Send to AI      │  ← LangChain + OpenAI GPT-4o-mini
│ for analysis    │  ← Returns summary, categories, insights
└────────┬────────┘
         ↓
┌─────────────────┐
│ Display results │  ← Formatted console output
│ in console      │  ← Box-drawing characters for structure
└─────────────────┘
```

---

## Project Structure

```
browser-agent/
├── src/
│   ├── cli.ts                 # Entry point - parses CLI args
│   ├── index.ts               # Main exports
│   ├── agent/
│   │   ├── cro-agent.ts       # CRO Agent - orchestrates analysis
│   │   ├── state-manager.ts   # Agent state management
│   │   ├── message-manager.ts # LLM conversation handling
│   │   └── tools/             # CRO analysis tools
│   ├── browser/
│   │   ├── browser-manager.ts # Launches/closes Chromium
│   │   ├── page-loader.ts     # Navigates to URLs, waits for load
│   │   └── dom/               # DOM extraction
│   ├── heuristics/
│   │   ├── business-type-detector.ts # Business type detection
│   │   ├── knowledge/         # PDP heuristics knowledge base (JSON)
│   │   └── vision/            # Vision-based CRO analysis (CR-002: rules removed)
│   ├── output/
│   │   ├── agent-progress-formatter.ts # Formats results for console
│   │   ├── markdown-reporter.ts # Markdown report generation
│   │   └── json-exporter.ts   # JSON export
│   ├── types/
│   │   └── index.ts           # TypeScript interfaces
│   └── utils/
│       ├── logger.ts          # JSON structured logging
│       └── validator.ts       # URL validation
├── tests/
│   ├── unit/                  # Fast tests, no network
│   ├── integration/           # Tests with real browser
│   └── e2e/                   # Full workflow tests
├── specs/                     # Documentation (you are here)
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript config
└── .env                       # API keys (not in git)
```

---

## Code Walkthrough by File

### 1. Entry Point: `src/cli.ts`

**What it does**: Parses command line arguments, runs the agent.

```typescript
// User runs: npm run start -- https://www.example.com --headless

// cli.ts does:
1. Parse URLs from arguments
2. Parse options (--headless, --timeout, --verbose, --vision)
3. Create CROAgent instance
4. Call agent.analyze() for each URL
5. Print formatted results
6. Exit
```

**Key code**:
```typescript
const agent = new CROAgent({ maxSteps: 10 });
const result = await agent.analyze(url, { browserConfig, verbose });
console.log(formatter.formatAnalysisResult(result));
```

---

### 2. CRO Agent: `src/agent/cro-agent.ts`

**What it does**: Orchestrates CRO analysis with iterative agent loop.

**Flow**:
```typescript
async analyze(url: string, options) {
  // Step 1: Launch browser
  await this.browserManager.launch();

  // Step 2: Load the page
  const pageLoad = await this.pageLoader.load(url);
  if (!pageLoad.success) return error;

  // Step 3: Extract CRO DOM elements
  const domTree = await this.domExtractor.extract(page);

  // Step 4: Run vision analysis (if --vision flag enabled)
  // NOTE: Heuristic rules (H001-H010) removed in CR-002, use --vision

  // Step 5: LLM-guided tool execution loop
  while (step < maxSteps && !done) {
    const toolCall = await this.llm.invoke(messages);
    const result = await this.toolExecutor.execute(toolCall);
  }

  // Step 6: Generate hypotheses and scores
  return { insights, hypotheses, scores };
}
```

---

### 3. Browser Module: `src/browser/`

#### `browser-manager.ts`
**What it does**: Manages Playwright browser lifecycle.

```typescript
class BrowserManager {
  async launch() {
    // Launch Chromium browser
    this.browser = await chromium.launch({ headless: false });

    // Create context with settings
    this.context = await this.browser.newContext({
      ignoreHTTPSErrors: true,  // Fixes SSL cert errors
      viewport: { width: 1280, height: 720 }
    });

    // Create page
    this.page = await this.context.newPage();
  }

  async close() {
    await this.page?.close();
    await this.context?.close();
    await this.browser?.close();
  }
}
```

#### `page-loader.ts`
**What it does**: Navigates to URL, waits for page to fully load.

```typescript
class PageLoader {
  async load(url: string) {
    // Validate URL first
    const validation = validateUrl(url);
    if (!validation.valid) return error;

    // Navigate and wait for network idle
    // networkidle = no network requests for 500ms
    await this.page.goto(url, {
      timeout: 60000,
      waitUntil: 'networkidle'
    });

    return { success: true, title: await this.page.title() };
  }
}
```

**Why networkidle?** Modern sites load content dynamically via JavaScript. `networkidle` ensures all AJAX requests complete before extraction.

---

### 4. DOM Extraction: `src/browser/dom/extractor.ts`

**What it does**: Extracts CRO-relevant DOM elements (CTAs, forms, trust signals, etc.)

```typescript
class DOMExtractor {
  async extract(page: Page) {
    // Extract CRO-relevant elements
    const elements = await page.evaluate(() => {
      // Find CTAs, forms, trust signals, value props, navigation
      return buildDOMTree(document.body);
    });

    return {
      elements,
      totalCount: elements.length,
      byCategory: { ctas: X, forms: Y, ... }
    };
  }
}
```

---

### 5. Output Module: `src/output/agent-progress-formatter.ts`

**What it does**: Formats CRO analysis results into readable console output.

```typescript
class AgentProgressFormatter {
  formatAnalysisResult(result: CROAnalysisResult): string {
    // Creates formatted output with:
    // - CRO scores by category
    // - Top insights with severity
    // - A/B test hypotheses
    // - Recommendations
  }
}
```

---

## Key Configuration

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT-4o-mini |

### CLI Options
| Option | Default | Description |
|--------|---------|-------------|
| `--headless` | false | Run browser without visible window |
| `--timeout` | 60000 | Page load timeout in ms |
| `--verbose` | false | Enable debug logging |

---

## Error Handling

Errors tracked by stage:

| Stage | Error Example | Handling |
|-------|---------------|----------|
| `load` | Timeout, SSL error, 404 | Returns failed result with error message |
| `extract` | No headings found | Returns empty array, continues |
| `process` | API key invalid, rate limit | Returns null processing, partial result |

---

## Testing

```bash
npm test              # All tests
npm run test:unit     # Fast, no network
npm run test:e2e      # Full workflow with real sites
```

**E2E test URLs**:
- https://www.conversion.com/
- https://www.invespcro.com/
- https://www.npdigital.com/
- https://www.roihunt.in/conversion-rate-optimization-agency-in-india/
- https://www.wearetenet.com/in/growth/conversion-rate-optimization-services

---

## How to Update Spec Kit

When making changes, update these files:

### 1. Adding New Feature

```bash
# Update tasks/ - add new phase/tasks in appropriate phase file
specs/001-browser-agent-core/tasks/phase-*.md

# Example:
## Phase 21: New Feature Name
- [ ] T205 Description of task
- [ ] T206 Another task
```

### 2. Bug Fixes

```bash
# Add to appropriate phase in tasks/
- [x] T205 Fix description - what it fixes
```

### 3. Architecture Changes

```bash
# Update plan/ - module architecture section
specs/001-browser-agent-core/plan/architecture.md
```

### 4. New Requirements

```bash
# Update spec/ - add to appropriate requirements file
specs/001-browser-agent-core/spec/requirements-*.md

# Example:
- **FR-142**: System MUST support new capability
```

### 5. Usage Changes

```bash
# Update quickstart.md - examples and CLI options
specs/001-browser-agent-core/quickstart.md
```

### Spec Kit Update Checklist

When making changes:
- [ ] Update `tasks/` with new/completed tasks in appropriate phase file
- [ ] Update `quickstart.md` if usage changes
- [ ] Update `plan/` if architecture changes
- [ ] Update `spec/` if requirements change
- [ ] Mark tasks as `[x]` when complete
- [ ] Add bug fixes to appropriate phase

---

## Quick Reference

> **Note**: spec, plan, and tasks are split into subdirectories. Use index.md files for navigation.

| I want to... | Read this file |
|--------------|----------------|
| Understand what app does | `quickstart.md` |
| See all requirements | `spec/index.md` → `spec/requirements-*.md` |
| Understand architecture | `plan/index.md` → `plan/architecture.md` |
| See task status | `tasks/index.md` → `tasks/phase-*.md` |
| Technical deep-dive (types, components) | `SESSION-HANDOFF.md` |
| Learn the code | `code-walkthrough.md` (this file) |

---

## Contact / Support

For issues: Check `Troubleshooting` section in `quickstart.md`
