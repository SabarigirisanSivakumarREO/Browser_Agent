# Quickstart: Browser Agent Core

**Feature**: `001-browser-agent-core`
**Last Updated**: 2025-11-24

---

## Claude Code Session Context

**Instructions**: Keep it concise. Compromise on grammar. Clear, to the point. No fluff.

**Excluded folders** (DO NOT analyze unless explicitly requested):
- `browser-use/` - Reference codebase only (545 files), not part of this project

**Context files to read** (in order):
1. `specs/001-browser-agent-core/spec.md` - Requirements & user stories
2. `specs/001-browser-agent-core/plan.md` - Architecture & modules
3. `specs/001-browser-agent-core/tasks.md` - Implementation status & bug fixes

**Quick command**: `Read specs/001-browser-agent-core/spec.md, plan.md, tasks.md`

### Change Workflow (MUST FOLLOW)

For any feature/bug fix request:

```
1. Update spec.md       → Add/modify requirements & user stories
2. Update plan.md       → Update architecture & design if needed
3. Update tasks.md      → Add new tasks with proper phase/ID
4. Update quickstart.md → Sync recent changes section
5. Get user approval    → Present changes, wait for confirmation
6. Implement            → Write code only after approval
7. Update design/       → Update ALL design diagrams to reflect changes
```

**Rules**:
- Spec kit is the source of truth - update BEFORE coding
- Never implement without approval
- quickstart.md must always reflect latest spec kit state
- **CRITICAL**: After implementation, update ALL files in `design/` folder:
  - `APPLICATION_FLOW.md` - ASCII flow diagrams
  - `architecture-overview.svg` - High-level architecture
  - `component-details.svg` - Component classes and methods
  - `configuration-types.svg` - Types, interfaces, config options
  - `data-flow-pipeline.svg` - Data processing stages
  - `sequence-diagram.svg` - Actor interactions and message flow
- Design folder provides complete visual context of the project

### What this app does
- Browser automation via Playwright (Chromium)
- Extracts h1-h6 headings from web pages
- Processes headings through LangChain/GPT-4o-mini for insights
- Outputs structured results to console

### Key files
| File | Purpose |
|------|---------|
| `src/cli.ts` | CLI entry point |
| `src/index.ts` | BrowserAgent orchestrator |
| `src/browser/browser-manager.ts` | Playwright lifecycle |
| `src/browser/page-loader.ts` | URL navigation, hybrid wait strategy |
| `src/extraction/heading-extractor.ts` | DOM h1-h6 extraction |
| `src/langchain/processor.ts` | GPT-4o-mini processing |
| `src/output/formatter.ts` | Console output formatting |
| `src/browser/cookie-handler.ts` | Cookie consent popup dismissal |
| `src/browser/cookie-patterns.ts` | CMP selector patterns |

### Design documentation
| File | Purpose |
|------|---------|
| `design/APPLICATION_FLOW.md` | ASCII diagrams of application flow |
| `design/architecture-overview.svg` | High-level architecture diagram |
| `design/component-details.svg` | Detailed component breakdown |
| `design/configuration-types.svg` | TypeScript types and config layers |
| `design/data-flow-pipeline.svg` | 6-stage data processing pipeline |
| `design/sequence-diagram.svg` | UML sequence diagram for URL processing |

### Recent changes (Design Documentation Update) - ✅ COMPLETE
- Updated all design folder SVG diagrams to reflect Phase 11-12 implementation:
  - `design/APPLICATION_FLOW.md` - Complete rewrite with cookie consent handling, hybrid wait strategy
  - `design/architecture-overview.svg` - Added cookie stage, updated browser module, new CLI flags
  - `design/component-details.svg` - Added CookieConsentHandler class, 8 CMP patterns
  - `design/configuration-types.svg` - Added WaitUntilStrategy, CookieConsentResult, CookieConsentPattern types
  - `design/data-flow-pipeline.svg` - Added Stage 3 Cookie Consent Dismissal
  - `design/sequence-diagram.svg` - Added CookieConsentHandler actor, Section 2B cookie handling flow

### Previous changes (Phase 12) - ✅ COMPLETE
- T045-T053: Cookie consent popup auto-dismissal before extraction
  - Supports 8 common CMPs: OneTrust, Cookiebot, Usercentrics, TrustArc, Quantcast, Didomi, Osano, Consent Manager
  - Fallback text-based heuristic for custom banners (accept, allow, agree, ok, got it, continue)
  - iframe support for CMPs rendered in iframes
  - Enabled by default, disable with `--no-cookie-dismiss`
  - Best-effort approach: never fails page load if popup cannot be dismissed
  - Max 3-second timeout (1s per selector attempt) per CR-009

### Previous changes (Phase 11)
- T040: Changed default wait strategy from `networkidle` to `load` - prevents timeouts
- T041: Added `--wait-until` CLI flag - user can override wait strategy
- T042: Implemented hybrid wait: `load` + short `networkidle` for JS rendering
- T043: Added `--post-load-wait` CLI flag - configurable JS wait time (default: 5s)

### Previous bug fixes (Phase 10)
- T036: Added `@playwright/browser-chromium` - auto-installs browser with npm
- T037: Added `ignoreHTTPSErrors: true` - fixes SSL cert errors
- T038: Added dotenv to vitest.config.ts - loads .env in tests
- T039: Updated e2e tests with 5 real CRO agency URLs

---

## Prerequisites

- Node.js 20.x LTS or later
- OpenAI API key with access to GPT-4o-mini

## Installation

```bash
# Clone and install dependencies (Playwright browsers install automatically)
cd browser-agent
npm install
```

**Note**: `npm install` automatically installs the Chromium browser via the `@playwright/browser-chromium` package. No separate `npx playwright install` command is needed.

## Environment Setup

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=sk-your-api-key-here
```

Or export directly:

```bash
export OPENAI_API_KEY=sk-your-api-key-here
```

## Basic Usage

### Single URL Processing

```bash
# Run the agent on a single URL
npm run start -- https://example.com
```

**Expected Output**:

```
================================================================================
BROWSER AGENT RESULTS
================================================================================
URL: https://example.com
Status: SUCCESS
Load Time: 1.2s

HEADINGS FOUND: 1
├─ h1: 1
└─ h2-h6: 0

EXTRACTED HEADINGS:
  [h1] Example Domain

LANGCHAIN INSIGHTS:
Summary: Simple landing page with a single main heading.
Categories: [Landing Page, Minimal Content]
Insights:
  - Page has minimal structure with only one heading
  - Content appears to be placeholder/example content
================================================================================
```

### Multiple URLs

```bash
# Process multiple URLs sequentially
npm run start -- https://example.com https://developer.mozilla.org
```

### Programmatic Usage

```typescript
import { BrowserAgent } from './src';

async function main(): Promise<void> {
  const agent = new BrowserAgent({
    browser: {
      headless: false,      // Visible browser
      timeout: 60000,       // 60 second timeout
      browserType: 'chromium',
      waitUntil: 'load',    // Wait strategy: 'load' | 'domcontentloaded' | 'networkidle'
      postLoadWait: 5000,   // Wait up to 5s for JS to render after load
      dismissCookieConsent: true  // Auto-dismiss cookie popups (default: true)
    },
    processing: {
      model: 'gpt-4o-mini',
      maxTokens: 1000,
      temperature: 0.3
    },
    verbose: true
  });

  try {
    const result = await agent.processUrl('https://example.com');

    if (result.success) {
      console.log('Headings:', result.extraction?.headings);
      console.log('Insights:', result.processing?.insights);
    } else {
      console.error('Failed:', result.error);
    }
  } finally {
    await agent.close();
  }
}

main();
```

## Module Usage Examples

### Browser Module Only

```typescript
import { BrowserManager, PageLoader } from './src/browser';

async function loadPage(): Promise<void> {
  const browser = new BrowserManager({ headless: false, timeout: 60000 });
  await browser.launch();

  const loader = new PageLoader(browser.getPage(), { timeout: 60000 });
  const result = await loader.load('https://example.com');

  console.log('Title:', result.title);
  console.log('Success:', result.success);

  await browser.close();
}
```

### Extraction Module Only

```typescript
import { HeadingExtractor } from './src/extraction';
import { Page } from 'playwright';

async function extractHeadings(page: Page): Promise<void> {
  const extractor = new HeadingExtractor();
  const result = await extractor.extract(page);

  console.log('Total headings:', result.totalCount);
  console.log('By level:', result.countByLevel);

  result.headings.forEach(h => {
    console.log(`  [h${h.level}] ${h.text}`);
  });
}
```

### LangChain Module Only

```typescript
import { LangChainProcessor } from './src/langchain';
import { ExtractionResult } from './src/types';

async function processWithAI(extraction: ExtractionResult): Promise<void> {
  const processor = new LangChainProcessor({
    model: 'gpt-4o-mini',
    maxTokens: 1000,
    temperature: 0.3
  });

  const result = await processor.analyze(extraction);

  console.log('Summary:', result.summary);
  console.log('Categories:', result.categories);
  console.log('Insights:', result.insights);
}
```

## CLI Options

```bash
npm run start -- [options] <urls...>

Options:
  --headless            Run browser in headless mode (default: false)
  --timeout <ms>        Page load timeout in ms (default: 60000)
  --wait-until <str>    Page load wait strategy (default: load)
                        - load: Wait for load event (balanced, recommended)
                        - domcontentloaded: Wait for DOM ready (fastest)
                        - networkidle: Wait for no network activity (may timeout)
  --post-load-wait <ms> Wait time for JS rendering after load (default: 5000)
                        Set to 0 to disable hybrid waiting
  --no-cookie-dismiss   Disable automatic cookie consent dismissal (default: enabled)
  --verbose, -v         Enable verbose logging
  --help, -h            Show help
```

### Wait Strategy Examples

```bash
# Default - balanced for most sites (load + 5s JS wait)
npm run start -- https://www.mrandmrssmith.com/

# Fast mode for static sites (no JS wait)
npm run start -- --post-load-wait 0 https://example.com

# Heavy JS sites - increase JS wait time
npm run start -- --post-load-wait 10000 https://heavy-spa-site.com

# Full networkidle (may timeout on some sites)
npm run start -- --wait-until networkidle https://simple-site.com
```

### Cookie Consent Examples

```bash
# Default - auto-dismiss cookie popups (enabled)
npm run start -- https://www.example-with-cookies.com

# Disable cookie consent dismissal
npm run start -- --no-cookie-dismiss https://www.example.com
```

## Error Handling

The agent provides clear error messages for each failure stage:

```typescript
const result = await agent.processUrl('https://invalid-url');

if (!result.success) {
  switch (result.errorStage) {
    case 'load':
      console.error('Page failed to load:', result.error);
      break;
    case 'extract':
      console.error('Extraction failed:', result.error);
      break;
    case 'process':
      console.error('LangChain processing failed:', result.error);
      break;
  }
}
```

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests (requires browser)
npm run test:e2e         # End-to-end workflow test

# Run with coverage
npm run test:coverage
```

## Troubleshooting

### Missing API Key

```
Error: OPENAI_API_KEY environment variable is not set.
Please set your OpenAI API key before running the agent.
```

**Solution**: Set the `OPENAI_API_KEY` environment variable.

### Page Load Timeout

```
Error: Page load timed out after 60000ms
URL: https://slow-site.example.com
```

**Solution**: The page may be slow or blocked. Try a different URL or increase timeout.

### No Headings Found

```
Warning: No headings found on page
URL: https://example.com/empty-page
```

**Solution**: This is expected for pages without h1-h6 elements. The agent will return empty results.

### Browser Launch Failed

```
Error: Failed to launch browser
Details: Executable doesn't exist at /path/to/chromium
```

**Solution**: Run `npx playwright install chromium` to install the browser.
