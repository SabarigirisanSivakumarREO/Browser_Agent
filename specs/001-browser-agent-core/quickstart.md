# Quickstart: Browser Agent Core

**Feature**: `001-browser-agent-core`
**Last Updated**: 2025-12-16

---

## Session Bootstrap (READ THIS FIRST)

**Status**: Phase 19 Complete ✅
- Completed: 174/174 tasks (Phase 19: 21/21)
- Phase 19: 100% Page Coverage System ✅

**Progress**:
- Phase 1-12: MVP infrastructure ✅
- Phase 13a-13b: Data models ✅
- Phase 14: DOM extraction ✅
- Phase 14b: CLI `--cro-extract` flag ✅
- Phase 15: Tool system ✅
- Phase 15b: CLI `--tool <name>` flag ✅
- Phase 16: Agent core ✅
- Phase 16-CLI: `--analyze` flag ✅
- Phase 17a: Navigation tools (scroll, click, go_to_url) ✅
- Phase 17b: Analysis tools (forms, trust, value_prop, navigation, friction) ✅
- Phase 17c: Control tools (record_insight, done) + Integration ✅
- Phase 18a: Models & Types (BusinessType, Hypothesis) ✅
- Phase 18b: Heuristic Engine Core (26 tests) ✅
- Phase 18c: 10 Heuristic Rules (H001-H010, 22 tests) ✅
- Phase 18d: Output Generation (21 tests) ✅
- Phase 18e: Agent Integration (21 tests) ✅
- Phase 18f: Test Fixtures (5 HTML + expected-results.json) ✅
- Phase 18-CLI: Final CLI Integration ✅ (default CRO mode, report output)
- **Phase 19a: Coverage Tracking** ✅ (CoverageTracker class, 16 tests)
- **Phase 19b: DOM Changes** ✅ (DOMMerger, absolute coords, dynamic tokens, 7 tests)
- **Phase 19c: Agent Integration** ✅ (full-page scan loop, coverage enforcement)
- **Phase 19d: Prompt Updates** ✅ (coverage awareness in system prompt)
- **Phase 19e: CLI & Config** ✅ (--scan-mode, --min-coverage flags)
- **Phase 19f: Testing & Polish** ✅ (11 integration + 4 E2E tests)

**Architecture**:
- MVP: 5 modules (browser, extraction, langchain, output, orchestrator)
- CRO Agent: +7 modules (agent, dom, tools, heuristics, models, output extensions, score-calculator)
- Phase 19: +1 module (coverage-tracker for 100% page coverage)

**Key insight**: Phase 19 adds deterministic full-page scanning to achieve 100% coverage on long pages

**Current milestone**: Phase 19 Complete - CLI ready with scan modes

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
| Investigate past decisions | research.md (tech decisions) + tasks.md (specific phase) |

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

**1. Phase 19c-f: Full Page Coverage System** - ✅ COMPLETE (2025-12-16)
- **Phase 19c - Agent Integration**:
  - Modified src/agent/cro-agent.ts: Full-page scan loop with DOMMerger integration
  - Modified src/agent/state-manager.ts: Coverage tracking integration, scanMode support
  - Coverage enforcement: Blocks 'done' until 100% coverage achieved
  - Dynamic maxSteps calculation based on page segments
- **Phase 19d - Prompt Updates**:
  - Updated src/prompts/system-cro.md: Added coverage awareness rules
  - Modified src/agent/prompt-builder.ts: Coverage report injection into user messages
- **Phase 19e - CLI & Config**:
  - Updated src/cli.ts: Added --scan-mode and --min-coverage flags
  - Added scanMode to DEFAULT_CRO_OPTIONS (default: 'full_page')
- **Phase 19f - Testing & Polish**:
  - Created tests/integration/coverage-enforcement.test.ts: 11 tests
  - Created tests/e2e/coverage-workflow.test.ts: 4 tests
  - Updated quickstart.md with scan mode CLI documentation
- See: src/agent/cro-agent.ts, src/agent/state-manager.ts, src/cli.ts

**2. Phase 19a-b: Coverage Tracking Foundation** - ✅ COMPLETE (2025-12-15)
- Created src/models/coverage.ts: PageSegment, ElementCoverage, CoverageState, CoverageConfig, ScanMode interfaces
- Created src/agent/coverage-tracker.ts: CoverageTracker class (16 tests)
- Created src/browser/dom/dom-merger.ts: DOMMerger class for multi-segment merging (7 tests)
- Updated src/browser/dom/build-dom-tree.ts: Absolute page coordinates
- Updated src/browser/dom/serializer.ts: Dynamic token budget by scan mode
- See: src/agent/coverage-tracker.ts, src/browser/dom/dom-merger.ts

**3. Phase 18-CLI: Final CLI Integration** - ✅ COMPLETE (2025-12-09)
- CRO analysis is now the default mode (no flags needed)
- New CLI flags:
  - `--output-format <fmt>`: console, markdown, json (default: console)
  - `--output-file <path>`: Write report to file
  - `--legacy`: Use old heading extraction mode (for backwards compatibility)
- See: src/cli.ts, src/output/file-writer.ts

---

### Change History (trimmed entries - cross-reference)

| Change | Phase | Tasks | CLI Milestone | Status |
|--------|-------|-------|---------------|--------|
| **Testing & Polish** | 19f | T143-T146 | - | ✅ |
| **CLI & Config** | 19e | T141-T142 | `--scan-mode=full_page|above_fold|llm_guided` | ✅ |
| **Prompt Updates** | 19d | T139-T140 | - | ✅ |
| **Agent Integration** | 19c | T134-T138 | - | ✅ |
| **DOM Changes** | 19b | T130-T133 | - | ✅ |
| **Coverage Tracking** | 19a | T126-T129 | - | ✅ |
| **CLI: Final integration** | 18-CLI | T119-T122 | `npm run start -- <url>` (CRO default) | ✅ |
| Test Fixtures | 18f | T118a-T118b | - | ✅ |
| Agent Integration | 18e | T117-T118 | - | ✅ |
| Output Generation | 18d | T112-T116a | - | ✅ |
| 10 Heuristic Rules | 18c | T107a-T111c | - | ✅ |
| Heuristic Engine Core | 18b | T106-T106d | - | ✅ |
| Models & Types | 18a | T104-T105a | - | ✅ |
| Control + Integration | 17c | T099-T103 | - | ✅ |
| Analysis Tools (5) | 17b | T094-T098a | - | ✅ |
| Navigation Tools (3) | 17a | T091-T093a | - | ✅ |
| **CLI: Agent loop** | 16-CLI | T088-T090 | `--analyze --max-steps N` | ✅ |
| Agent Core | 16 | T078-T087 | - | ✅ |
| **CLI: Tool execution** | 15b | T077a-T077e | `--tool <name>` | ✅ |
| **Tool System** | 15 | T073-T077 | - | ✅ |
| CLI: DOM extraction | 14b | T072a-T072c | `--cro-extract` | ✅ |
| DOM Extraction | 14 | T065-T071 | - | ✅ |
| Cookie consent | 12 | T045-T053 | `--no-cookie-dismiss` | ✅ |
| Phases 1-13b | - | T001-T064 | - | ✅ |

**Incremental CLI Milestones**:
```
Phase 14b: npm run start -- --cro-extract https://carwale.com           ✅
Phase 15b: npm run start -- --cro-extract --tool analyze_ctas https://carwale.com  ✅
Phase 16-CLI: npm run start -- --analyze --max-steps 5 https://carwale.com  ✅
Phase 18-CLI: npm run start -- https://carwale.com  (CRO analysis as default)  ✅
            npm run start -- https://carwale.com --output-format markdown --output-file report.md  ✅
            npm run start -- --legacy https://carwale.com  (old heading mode)  ✅
Phase 19-CLI: npm run start -- --scan-mode=full_page https://carwale.com  ✅ (100% coverage)
            npm run start -- --scan-mode=above_fold https://carwale.com  ✅ (faster)
            npm run start -- --scan-mode=llm_guided https://carwale.com  ✅ (original)
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
npm run start -- https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711
```

**Expected Output**:

```
================================================================================
BROWSER AGENT RESULTS
================================================================================
URL: https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711
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
npm run start -- https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711 https://developer.mozilla.org
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
      model: 'gpt-4o',
      maxTokens: 1000,
      temperature: 0.3
    },
    verbose: true
  });

  try {
    const result = await agent.processUrl('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711');

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
  const result = await loader.load('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711');

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
    model: 'gpt-4o',
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
  --scan-mode <mode>    Page coverage scan mode (default: full_page)
                        - full_page: Scroll through entire page for 100% coverage
                        - above_fold: Only analyze initial viewport (faster)
                        - llm_guided: Let LLM decide scrolling (original behavior)
  --min-coverage <N>    Minimum coverage percentage required (default: 100)
                        Only applies to full_page mode
  --verbose, -v         Enable verbose logging
  --help, -h            Show help
```

### Wait Strategy Examples

```bash
# Default - balanced for most sites (load + 5s JS wait)
npm run start -- https://www.mrandmrssmith.com/

# Fast mode for static sites (no JS wait)
npm run start -- --post-load-wait 0 https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711

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

### Scan Mode Examples (Phase 19)

```bash
# Default - full_page mode for 100% page coverage
npm run start -- https://www.example.com
# Scrolls through entire page, extracts DOM at each segment
# Merges all DOM snapshots into complete tree
# Blocks 'done' until 100% coverage achieved

# Above fold mode - faster, only initial viewport
npm run start -- --scan-mode=above_fold https://www.example.com
# Best for quick analysis of hero section and above-fold CTAs
# No scrolling, single DOM extraction

# LLM-guided mode - original behavior, LLM decides scrolling
npm run start -- --scan-mode=llm_guided https://www.example.com
# LLM can choose to scroll or not based on analysis
# No coverage enforcement

# Custom coverage threshold (full_page mode)
npm run start -- --scan-mode=full_page --min-coverage=80 https://www.example.com
# Allows completion at 80% coverage instead of 100%

# Combine with other options
npm run start -- --scan-mode=full_page --headless --verbose https://www.example.com
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
URL: https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711/empty-page
```

**Solution**: This is expected for pages without h1-h6 elements. The agent will return empty results.

### Browser Launch Failed

```
Error: Failed to launch browser
Details: Executable doesn't exist at /path/to/chromium
```

**Solution**: Run `npx playwright install chromium` to install the browser.
