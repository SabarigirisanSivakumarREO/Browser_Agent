# Code Walkthrough: Browser Agent

**Last Updated**: 2025-12-16

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
│   ├── index.ts               # BrowserAgent - orchestrates everything
│   ├── browser/
│   │   ├── browser-manager.ts # Launches/closes Chromium
│   │   └── page-loader.ts     # Navigates to URLs, waits for load
│   ├── extraction/
│   │   └── heading-extractor.ts # Extracts h1-h6 from page
│   ├── langchain/
│   │   └── processor.ts       # Sends to GPT-4o-mini, parses response
│   ├── output/
│   │   └── formatter.ts       # Formats results for console
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
// User runs: npm run start -- https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy --headless

// cli.ts does:
1. Parse URLs from arguments
2. Parse options (--headless, --timeout, --verbose)
3. Create BrowserAgent instance
4. Call agent.processUrl() for each URL
5. Print formatted results
6. Clean up and exit
```

**Key code**:
```typescript
const agent = new BrowserAgent({ browser: { headless, timeout } });
const result = await agent.processUrl(url);
console.log(agent.formatResult(result));
await agent.close();
```

---

### 2. Orchestrator: `src/index.ts`

**What it does**: Coordinates all modules. Main brain of the app.

**Flow**:
```typescript
async processUrl(url: string) {
  // Step 1: Launch browser (if not already running)
  await this.browserManager.launch();

  // Step 2: Load the page
  const pageLoad = await this.pageLoader.load(url);
  if (!pageLoad.success) return error;

  // Step 3: Extract headings
  const extraction = await this.headingExtractor.extract(page);

  // Step 4: Process with AI
  const processing = await this.langchainProcessor.analyze(extraction);

  // Step 5: Return combined result
  return { success: true, pageLoad, extraction, processing };
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

### 4. Extraction Module: `src/extraction/heading-extractor.ts`

**What it does**: Finds all h1-h6 elements, extracts text and level.

```typescript
class HeadingExtractor {
  async extract(page: Page) {
    // Find all heading elements
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();

    const results = [];
    for (const element of headings) {
      const tagName = await element.evaluate(el => el.tagName); // "H1", "H2", etc.
      const text = await element.textContent();

      results.push({
        level: parseInt(tagName[1]),  // 1, 2, 3, 4, 5, or 6
        text: text.trim(),
        index: results.length
      });
    }

    return {
      headings: results,
      totalCount: results.length,
      countByLevel: { 1: X, 2: Y, ... }  // Summary
    };
  }
}
```

---

### 5. LangChain Module: `src/langchain/processor.ts`

**What it does**: Sends headings to GPT-4o-mini, gets structured insights.

```typescript
class LangChainProcessor {
  async analyze(extraction: ExtractionResult) {
    // Create prompt with heading data
    const prompt = `Analyze these headings from a webpage:
      Total: ${extraction.totalCount}
      Headings: ${JSON.stringify(extraction.headings)}

      Provide:
      1. Brief summary
      2. Content categories
      3. 3-5 insights about structure`;

    // Send to OpenAI
    const model = new ChatOpenAI({ model: 'gpt-4o-mini' });
    const response = await model.invoke(prompt);

    // Parse and return structured result
    return {
      summary: "...",
      categories: ["...", "..."],
      insights: ["...", "...", "..."]
    };
  }
}
```

---

### 6. Output Module: `src/output/formatter.ts`

**What it does**: Formats results into readable console output.

```typescript
class ResultFormatter {
  formatResult(result: AgentResult): string {
    // Creates box-drawing output like:
    // ┌──────────────────────────────────┐
    // │     BROWSER AGENT RESULTS        │
    // ├──────────────────────────────────┤
    // │ URL: https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy         │
    // │ Status: SUCCESS                  │
    // │ Headings: 39                     │
    // └──────────────────────────────────┘
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
