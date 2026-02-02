# Quickstart: Browser Agent Core

**Feature**: `001-browser-agent-core`
**Last Updated**: 2026-01-30

---

## New Session Prompt (Copy-Paste This)

```
Read specs/001-browser-agent-core/quickstart.md to get the complete project context.
```

---

## Session Bootstrap (READ THIS FIRST)

**Status**: CR-001 Architecture Refactor ✅ | Phase 21h ✅ | Phase 21i ✅ | Phase 21j ⏳ IN PROGRESS (6/8)
- Completed: 431 tasks (Phases 1-19, 12b, 12c, 21a-21j core, CR-001 complete)
- **CR-001 COMPLETE** (2026-01-30):
  - ✅ Merged Vision Agent into CRO Agent (single agent loop)
  - ✅ Removed redundant vision modes (--vision, --full-page-vision, --full-page-screenshot)
  - ✅ Only `--vision-agent` remains as the ONE vision mode
  - ✅ Analysis happens AFTER data collection (category-based LLM calls)
  - Phase 20 (60 tasks) deferred to backlog
- **Phase 21h COMPLETE** (2026-01-30):
  - ✅ Evidence capture: viewportIndex, timestamp, screenshotRef, domElementRefs, boundingBox
  - ✅ Bounding box extraction via Playwright element.boundingBox()
  - ✅ CLI: --save-evidence, --evidence-dir flags
- **Phase 21j IN PROGRESS** (2026-02-02): CLI Vision Agent Fix
  - ✅ T383: Refactored processVisionAgentMode() to use CROAgent unified mode
  - ✅ T384: CROAgent now returns snapshots in result
  - ✅ T385: Console shows DOM-Screenshot mapping proof
  - ✅ T386: Evidence saving works with CROAgent result
  - ✅ T387: Verbose logging for collection phase
  - ✅ T388: Updated help text for --vision-agent
  - 📋 T389-T390: Integration tests (pending)

**Current Focus**:
- Phase 21k: Deterministic Full-Page Collection (7 tasks) 📋 **NEXT** - Replace LLM-guided collection
- Phase 21j: CLI Vision Agent Fix (6/8 tasks) ⏳ **IN PROGRESS** - Integration tests remaining
- Phase 22: New Page Type Knowledge Bases (~38 tasks) 📋 **PLANNED**

**Phase 21k Priority** (blocking issue):
- Current collection is LLM-guided → only 2-3 viewports captured
- Fix: Programmatic scrolling based on page height calculation
- See: `plan/phase-21k.md` and `tasks/phase-21k.md`

**Deferred**:
- Phase 20: Hybrid Extraction Pipeline (60 tasks) - moved to backlog

**Progress**:
- Phase 1-12: MVP infrastructure ✅
- **Phase 12b: Enhanced Cookie Detection** ✅ (Shopify/Alpine.js banners)
- **Phase 12c: Peregrine Cookie Banner Fix** ✅ (two-step dismiss: Accept + Close)
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
- Phase 19a: Coverage Tracking ✅ (CoverageTracker class, 16 tests)
- Phase 19b: DOM Changes ✅ (DOMMerger, absolute coords, dynamic tokens, 7 tests)
- Phase 19c: Agent Integration ✅ (full-page scan loop, coverage enforcement)
- Phase 19d: Prompt Updates ✅ (coverage awareness in system prompt)
- Phase 19e: CLI & Config ✅ (--scan-mode, --min-coverage flags)
- Phase 19f: Testing & Polish ✅ (11 integration + 4 E2E tests)
- **Phase 20: Hybrid Extraction Pipeline** 📋 (60 tasks, 108 tests planned)
- **Phase 21a: PageType Detection Foundation** ✅ (8 tasks, 20+ tests)
- **Phase 21b-d: PDP Heuristic Rules** 📋 (42 tasks, 70+ tests planned)

**Architecture**:

*Module Definition*: A module is a distinct `src/` subdirectory with an `index.ts` barrel export.

| Module | Path | Files | Purpose |
|--------|------|-------|---------|
| agent | `src/agent/` | 8+ | CRO Agent core (state, messages, prompts) |
| agent/vision | `src/agent/vision/` | 6+ | Vision Agent (@deprecated, merged) |
| agent/tools | `src/agent/tools/` | 10+ | Agent tool implementations |
| browser | `src/browser/` | 5+ | Playwright browser lifecycle |
| browser/dom | `src/browser/dom/` | 4+ | DOM extraction and serialization |
| detection | `src/detection/` | 2+ | Framework detection utilities |
| heuristics | `src/heuristics/` | 8+ | Heuristic engine core |
| heuristics/knowledge | `src/heuristics/knowledge/` | 12+ | PDP knowledge base JSONs |
| heuristics/rules | `src/heuristics/rules/` | 11+ | H001-H010 rule implementations |
| heuristics/vision | `src/heuristics/vision/` | 6+ | Vision analyzer components |
| models | `src/models/` | 10+ | Zod schemas and types |
| output | `src/output/` | 6+ | Report generation, JSON export |
| prompts | `src/prompts/` | 3+ | Prompt templates (markdown) |
| types | `src/types/` | 2+ | Shared TypeScript types |
| utils | `src/utils/` | 2+ | Shared utilities |

**Total**: 14 modules with index.ts exports (17 including submodules)

**Key insight**: The unified CRO Agent (CR-001) uses a three-phase approach: (1) Data Collection captures DOM + screenshots across the full page, (2) Analysis runs category-based LLM calls against heuristics knowledge base, (3) Output generates insights, hypotheses, and A/B test ideas. Vision analysis provides UX-level insights. Phase 21i's DOM-Screenshot mapping will enable verification of LLM observations against actual element positions.

**Current milestone**: CR-001 ✅ Complete | Phase 21h 📋 Next - Evidence Capture | Phase 21i 📋 Planned - DOM-Screenshot Mapping

**Instructions**: Keep it concise. Compromise on grammar. Clear, to the point. No fluff.

**Context Window Management** (CRITICAL):
- **Task limit**: 1-5 tasks per session (optimal context usage)
- Monitor context usage throughout session
- Optimal range: 40%-60% utilization
- At 60%: Update SESSION-HANDOFF.md with current progress and request new session
- Never exceed 70%: LLM performance degrades significantly
- Always include handoff details before ending session

**Session Chunking** (see SESSION-HANDOFF.md for full breakdown):
- Session 1: T500-T504 (CR-001-A: Remove vision modes)
- Session 2: T505-T509 (CR-001-B Part 1)
- Session 3: T510-T514 (CR-001-B Part 2)
- Session 4-5: T515-T522 (CR-001-C: Analysis refactor)
- Session 6-7: T353-T365 (Phase 21h: Evidence)
- Session 8-10: T366-T382 (Phase 21i: Mapping)
- Session 11-14: T400-T437 (Phase 22: Knowledge bases)

**Excluded folders** (DO NOT analyze unless explicitly requested):
- `browser-use/` - Reference codebase only (545 files), not part of this project

### Spec Kit Structure

```
specs/001-browser-agent-core/
├── spec/                    # Requirements (split from spec.md)
│   ├── index.md             # Overview + navigation
│   ├── user-stories.md      # US1-US14
│   ├── requirements-foundation.md
│   ├── requirements-cro.md
│   ├── requirements-phase19-20.md
│   └── requirements-phase21.md
├── plan/                    # Implementation plan (split from plan.md)
│   ├── index.md             # Overview + navigation
│   ├── overview.md, architecture.md, dependencies.md
│   └── phase-13-15.md ... phase-21.md
├── tasks/                   # Tasks (split from tasks.md)
│   ├── index.md             # Overview + summary
│   └── phases-01-09.md ... phase-21.md
├── quickstart.md            # THIS FILE - start here
├── data-model.md            # TypeScript interfaces
├── SESSION-HANDOFF.md       # Technical deep-dive for handoffs
└── code-walkthrough.md      # Code structure explanation
```

### What to Read (Priority Order)

| Priority | File | Purpose |
|----------|------|---------|
| 1 | `quickstart.md` | Project overview, status, usage (this file) |
| 2 | `tasks/index.md` | Task summary, what's done/pending |
| 3 | `plan/index.md` | Architecture overview |
| 4 | `spec/index.md` | Requirements overview |
| 5 | Phase-specific files | Only when working on specific phase |

### What to Read by Task

| Need | Read |
|------|------|
| Add new feature | spec/index.md → plan/index.md → tasks/index.md (follow Change Workflow) |
| Fix a bug | tasks/index.md (add to current phase, follow Change Workflow) |
| Understand architecture | plan/architecture.md (Module Architecture section) |
| Check requirements | spec/user-stories.md, spec/requirements-*.md |
| See implementation details | tasks/phase-*.md (full task history with checkpoints) |
| Technical deep-dive | SESSION-HANDOFF.md (types, components, architecture) |

### Change Workflow (MUST FOLLOW)

For any feature/bug fix request:

```
1. Update spec/         → Add/modify requirements in appropriate file
2. Update plan/         → Update architecture & design if needed
3. Update tasks/        → Add new tasks in appropriate phase file
4. Update quickstart.md → Sync recent changes section
5. Get user approval    → Present changes, wait for confirmation
6. Implement            → Write code only after approval
7. Run tests            → Verify all tests pass (unit, integration, e2e)
8. Update design/       → Update ALL design diagrams to reflect changes
```

**Important Rules**:
1. **Spec kit is source of truth** - Update BEFORE coding
2. **Never implement without approval** - Present plan first
3. **Use split files** - Don't look for monolithic spec.md/plan.md/tasks.md
4. **Read phase-specific files** - When working on specific phase, read that phase's plan and tasks file
5. **Check tasks/index.md** - For task summary and current status
6. **quickstart.md must always reflect latest spec kit state**
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
| `src/index.ts` | Main exports |
| `src/agent/cro-agent.ts` | CRO Agent orchestrator |
| `src/browser/browser-manager.ts` | Playwright lifecycle |
| `src/browser/page-loader.ts` | URL navigation, hybrid wait strategy |
| `src/browser/dom/extractor.ts` | CRO DOM extraction |
| `src/browser/dom/serializer.ts` | DOM to LLM format with token budget |
| `src/models/` | Zod schemas for agent state, insights, output |
| `src/output/agent-progress-formatter.ts` | Console output formatting |
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

**0. Phase 21j: CLI Vision Agent Fix** - ⏳ IN PROGRESS (2026-02-02)
- **Purpose**: Fix CLI --vision-agent to use unified CROAgent instead of deprecated VisionAgent
- **Bug Fixed**: CLI now uses CROAgent with unified mode:
  - ✅ Enforces full-page coverage (scrolls entire page)
  - ✅ Captures DOM + screenshots at each viewport
  - ✅ Shows DOM-Screenshot mapping proof in console
  - ✅ Evidence saving works correctly
- **Key Changes**:
  - `src/cli.ts` - processVisionAgentMode() now uses CROAgent
  - `src/agent/cro-agent.ts` - Added snapshots to CROAnalysisResult
  - `src/heuristics/vision/types.ts` - Added coveragePercent to summary
- **Tasks**: T383-T388 complete (6/8), T389-T390 integration tests pending

**1. Phase 21h: Evidence Capture** - ✅ COMPLETE (2026-01-30)
- **Purpose**: Capture and store evidence for each heuristic evaluation
- **5 Evidence Fields**: viewportIndex, screenshotRef, domElementRefs, boundingBox, timestamp
- **CLI Flags**: `--save-evidence`, `--evidence-dir <path>`
- **Key Files Modified**:
  - `src/output/agent-progress-formatter.ts` - Display evidence fields
  - `src/agent/vision/vision-prompt-builder.ts` - elementIndices instruction
  - `src/agent/vision/tools/capture-viewport-tool.ts` - Bounding box extraction
  - `src/agent/vision/vision-state-manager.ts` - Evidence attachment
- **Tasks**: 14 tasks, ~49 tests

**2. Phase 21i: DOM-Screenshot Mapping** - ✅ COMPLETE (2026-02-02)
- **Purpose**: Coordinate mapping between DOM elements and screenshot positions
- **Key Features**: Coordinate transformation, element visibility, screenshot annotation
- **CLI Flags**: `--annotate-screenshots`
- **Key Files Created**:
  - `src/output/screenshot-annotator.ts` - SVG overlay annotation with sharp
  - `src/browser/dom/coordinate-mapper.ts` - Page to screenshot coordinate transform
  - `tests/unit/screenshot-annotator.test.ts` - 27 unit tests
  - `tests/integration/dom-screenshot-mapping.test.ts` - 19 integration tests
- **Tasks**: 17 tasks, ~158 tests

---

### Change History (trimmed entries - cross-reference)

| Change | Phase | Tasks | CLI Milestone | Status |
|--------|-------|-------|---------------|--------|
| **Architecture Simplification** | CR-001 | 23 | Merge agents, remove modes | ✅ COMPLETE |
| **Page Type Knowledge Bases** | 22 | ~38 | PLP, Homepage, Cart, Checkout, Generic | 📋 PLANNED |
| **DOM-Screenshot Mapping** | 21i | 17 | `--annotate-screenshots` | 📋 PLANNED |
| **Evidence Capture** | 21h | 14 | `--save-evidence` | ✅ COMPLETE |
| ~~Vision Agent Loop (standalone)~~ | ~~21g~~ | ~~18~~ | - | ✅ MERGED (CR-001) |
| ~~Full-Page Screenshot Mode~~ | ~~21f~~ | ~~6~~ | ~~`--full-page-screenshot`~~ | ✅ REMOVED (CR-001) |
| ~~Multi-Viewport Full-Page Vision~~ | ~~21e~~ | ~~8~~ | ~~`--full-page-vision`~~ | ✅ REMOVED (CR-001) |
| ~~Single Viewport Vision~~ | ~~21d~~ | ~~7~~ | ~~`--vision`~~ | ✅ REMOVED (CR-001) |
| **Hybrid Extraction Pipeline** | 20 | 60 | - | 📋 DEFERRED |
| **PageType Detection** | 21a | T285-T292 | - | ✅ |
| **Heuristics Knowledge Base** | 21b | T293-T306 | - | ✅ |
| **CRO Vision Analyzer** | 21c | T307-T313 | - | ✅ |
| **Vision Integration** | 21d | T314-T320 | `--vision-model` | ✅ |
| **Peregrine Cookie Banner Fix** | 12c | T282-T284 | - | ✅ |
| **Enhanced Cookie Detection** | 12b | T275-T281 | - | ✅ |
| **Hybrid Extraction Pipeline** | 20 | T147-T206 | `--no-llm-classification` | 📋 Planned |
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
Phase 19-CLI: npm run start -- --scan-mode=full_page https://carwale.com  ✅ (100% coverage)

# SIMPLIFIED VISION CLI (after CR-001 implementation):
Phase 21g-CLI: npm run start -- --vision-agent https://example.com/product  ✅ (THE ONE MODE)
            npm run start -- --vision-agent --vision-model gpt-4o https://example.com  ✅
Phase 21h-CLI: npm run start -- --vision-agent --save-evidence https://example.com  📋 (NOT YET IMPLEMENTED)
            npm run start -- --vision-agent --evidence-dir ./reports https://example.com  📋 (NOT YET IMPLEMENTED)
Phase 21i-CLI: npm run start -- --vision-agent --save-evidence --annotate-screenshots https://example.com  ✅

# REMOVED FLAGS (after CR-001):
# --vision, --vision-only, --full-page-vision, --full-page-screenshot
# --vision-max-viewports, --no-parallel-vision
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
npm run start -- https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy
```

**Expected Output**:

```
================================================================================
BROWSER AGENT RESULTS
================================================================================
URL: https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy
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
npm run start -- https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy https://developer.mozilla.org
```

### Programmatic Usage

```typescript
import { CROAgent } from './src/agent';

async function main(): Promise<void> {
  const agent = new CROAgent({
    maxSteps: 10,
    actionWaitMs: 500,
    llmTimeoutMs: 60000,
    failureLimit: 3,
  });

  const result = await agent.analyze('https://www.example.com/product', {
    browserConfig: {
      headless: false,      // Visible browser
      timeout: 60000,       // 60 second timeout
      browserType: 'chromium',
      waitUntil: 'load',    // Wait strategy: 'load' | 'domcontentloaded' | 'networkidle'
      postLoadWait: 5000,   // Wait up to 5s for JS to render after load
      dismissCookieConsent: true  // Auto-dismiss cookie popups (default: true)
    },
    verbose: true
  });

  if (result.success) {
    console.log('Insights:', result.insights);
    console.log('Hypotheses:', result.hypotheses);
    console.log('Scores:', result.scores);
  } else {
    console.error('Failed:', result.errors);
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
  const result = await loader.load('https://www.example.com');

  console.log('Title:', result.title);
  console.log('Success:', result.success);

  await browser.close();
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
npm run start -- --post-load-wait 0 https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy

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
URL: https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy/empty-page
```

**Solution**: This is expected for pages without h1-h6 elements. The agent will return empty results.

### Browser Launch Failed

```
Error: Failed to launch browser
Details: Executable doesn't exist at /path/to/chromium
```

**Solution**: Run `npx playwright install chromium` to install the browser.
