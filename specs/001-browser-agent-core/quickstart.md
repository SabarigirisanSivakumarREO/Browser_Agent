# Quickstart: Browser Agent Core

**Feature**: `001-browser-agent-core`
**Last Updated**: 2025-12-05

---

## Session Bootstrap (READ THIS FIRST)

**Status**: CRO Agent Implementation In Progress
- Infrastructure: 74 tasks across 14b phases ✅
- Remaining: 46 tasks across 9 phases ⏳

**Progress**:
- Phase 1-12: MVP infrastructure ✅
- Phase 13a-13b: Data models ✅
- Phase 14: DOM extraction ✅
- Phase 14b: CLI `--cro-extract` flag ✅
- Phase 15-18b: CRO agent + incremental CLI ⏳

**Architecture**:
- MVP: 5 modules (browser, extraction, langchain, output, orchestrator)
- CRO Agent: +6 modules (agent, dom, tools, heuristics, models, output extensions)

**Key insight**: Restructured for incremental CLI integration - test each phase on real sites immediately

**Next milestone**: Phase 15 - Tool system (BaseTool, ToolRegistry, ToolExecutor)

**Instructions**: Keep it concise. Compromise on grammar. Clear, to the point. No fluff.

**Context Window Management** (CRITICAL):
- Monitor context usage throughout session
- Optimal range: 40%-60% utilization
- At 60%: Update SESSION-HANDOFF.md with current progress and request new session
- Never exceed 70%: LLM performance degrades significantly
- Always include handoff details before ending session

**Excluded folders** (DO NOT analyze unless explicitly requested):
- `browser-use/` - Reference codebase only (545 files), not part of this project

### What to Read Next

| Need | Read |
|------|------|
| Add new feature | spec.md → plan.md → tasks.md (follow Change Workflow) |
| Fix a bug | tasks.md (add to current phase, follow Change Workflow) |
| Understand architecture | plan.md (Module Architecture section) |
| Check requirements | spec.md (User Stories, Requirements) |
| See implementation details | tasks.md (full task history with checkpoints) |
| Investigate past decisions | tasks.md (specific phase) + this file (Change History) |

### Change Workflow (MUST FOLLOW)

For any feature/bug fix request:

```
1. Update spec.md       → Add/modify requirements & user stories
2. Update plan.md       → Update architecture & design if needed
3. Update tasks.md      → Add new tasks with proper phase/ID
4. Update quickstart.md → Sync recent changes section
5. Get user approval    → Present changes, wait for confirmation
6. Implement            → Write code only after approval
7. Run tests            → Verify all tests pass (unit, integration, e2e)
8. Update design/       → Update ALL design diagrams to reflect changes
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

### What this app does (Target State)
- Browser automation via Playwright (Chromium)
- Extracts CRO elements: CTAs, forms, trust signals, value props, navigation
- Iterative agent loop: observe → reason → act → repeat
- Generates CRO insights with severity ratings
- Outputs A/B test hypotheses and structured reports

### Key files
| File | Purpose |
|------|---------|
| `src/cli.ts` | CLI entry point |
| `src/index.ts` | BrowserAgent orchestrator |
| `src/browser/browser-manager.ts` | Playwright lifecycle |
| `src/browser/page-loader.ts` | URL navigation, hybrid wait strategy |
| `src/browser/dom/extractor.ts` | CRO DOM extraction |
| `src/browser/dom/serializer.ts` | DOM to LLM format with token budget |
| `src/models/` | Zod schemas for agent state, insights, output |
| `src/langchain/processor.ts` | GPT-4o-mini processing |
| `src/output/formatter.ts` | Console output formatting |
| `src/browser/cookie-handler.ts` | Cookie consent popup dismissal |

### Design documentation
| File | Purpose |
|------|---------|
| `design/APPLICATION_FLOW.md` | ASCII diagrams of application flow |
| `design/architecture-overview.svg` | High-level architecture diagram |
| `design/component-details.svg` | Detailed component breakdown |
| `design/configuration-types.svg` | TypeScript types and config layers |
| `design/data-flow-pipeline.svg` | 6-stage data processing pipeline |
| `design/sequence-diagram.svg` | UML sequence diagram for URL processing |

### Recent Changes (keep last 3)

**1. Phase 14b: CLI DOM Extraction** - ✅ COMPLETE (2025-12-05)
- Added `--cro-extract` CLI flag for DOM extraction without LangChain
- Created CROElementFormatter for CRO element display
- Tested on carwale.com - extracts CTAs, forms, trust, value props, navigation
- See: src/cli.ts, src/output/cro-element-formatter.ts

**2. Incremental CLI Integration Restructure** - ✅ COMPLETE (2025-12-05)
- Restructured Phases 14-18 for incremental CLI integration
- Added Phase 14b, 15b, 16b, 18b with CLI milestones
- Each phase now has testable CLI output
- See: tasks.md Phase 14b-18b

**3. Phase 13-14: Models & DOM Extraction** - ✅ COMPLETE (2025-12-05)
- Phase 13a: Core models (DOMTree, CROInsight, PageState, ToolDefinition)
- Phase 13b: Agent models (CROMemory, AgentState, AgentOutput)
- Phase 14: DOM extraction pipeline with CRO classification
- 111 unit tests, 14 integration tests passing
- See: tasks.md Phase 13-14, src/models/, src/browser/dom/

---

### Change History (trimmed entries - cross-reference)

| Change | Phase | Tasks | CLI Milestone | Status |
|--------|-------|-------|---------------|--------|
| **CLI: Final integration** | 18b | T109-T112 | `npm run start -- <url>` (CRO default) | ⏳ |
| Heuristics & Output | 18 | T061-T108 | - | ⏳ |
| CRO Analysis Tools | 17 | T088-T097 | - | ⏳ |
| **CLI: Agent loop** | 16b | T087a-T087b | `--analyze --max-steps N` | ⏳ |
| Agent Core | 16 | T078-T087 | - | ⏳ |
| **CLI: Tool execution** | 15b | T077a-T077b | `--tool <name>` | ⏳ |
| **Tool System** | 15 | T073-T077 | - | ⏳ **NEXT** |
| CLI: DOM extraction | 14b | T072a-T072c | `--cro-extract` | ✅ |
| DOM Extraction | 14 | T065-T071 | - | ✅ |
| Agent Models | 13b | T057-T059, T063b, T064b | - | ✅ |
| Core Models | 13a | T054-T056, T060, T063a, T064a | - | ✅ |
| Cookie consent | 12 | T045-T053 | `--no-cookie-dismiss` | ✅ |
| Hybrid wait | 11 | T040-T044 | `--post-load-wait` | ✅ |
| Bug fixes | 10 | T036-T039 | - | ✅ |
| Polish | 9 | T030-T035 | - | ✅ |
| E2E tests | 8 | T029 | - | ✅ |
| Orchestrator & CLI | 7 | T026-T028 | `npm run start -- <url>` | ✅ |
| Output (US4) | 6 | T023-T025 | - | ✅ |
| LangChain (US3) | 5 | T020-T022 | - | ✅ |
| Extraction (US2) | 4 | T017-T019 | - | ✅ |
| URL loading (US1) | 3 | T012-T016 | - | ✅ |
| Utilities | 2 | T009-T011 | - | ✅ |
| Setup | 1 | T001-T008 | - | ✅ |

**Incremental CLI Milestones**:
```
Phase 14b: npm run start -- --cro-extract https://carwale.com
Phase 15b: npm run start -- --cro-extract --tool analyze_ctas https://carwale.com
Phase 16b: npm run start -- --analyze --max-steps 5 https://carwale.com
Phase 18b: npm run start -- https://carwale.com  (CRO analysis as default)
```

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
