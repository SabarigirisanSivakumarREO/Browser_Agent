# Browser Agent

A TypeScript-based browser automation agent with two modes: **CRO Analysis** (Conversion Rate Optimization auditing) and **Agent Mode** (goal-directed browser automation). Powered by Playwright + GPT-4o-mini.

## Overview

Browser Agent is a CLI tool with two distinct modes:

- **CRO Analysis** (default): Autonomously navigates web pages, extracts CRO-relevant DOM elements, and processes them through a vision-based LLM analysis pipeline to identify conversion optimization opportunities. Uses a three-phase approach: **Data Collection** (DOM + screenshots + AX tree) → **Category-Based Analysis** (parallel LLM evaluation against heuristic knowledge bases) → **Output Generation** (insights, hypotheses, reports).

- **Agent Mode** (`--agent-mode`): Goal-directed browser automation that can perform multi-step tasks like searching, form filling, and data extraction. Uses a **Perceive → Plan → Act → Verify** loop with LLM-powered planning, multimodal vision (screenshot + text), viewport-aware element scoring, and automatic new-tab handling.

## Features

### Agent Mode (Goal-Directed Browser Automation)
- **Perceive-Plan-Act-Verify Loop** - LLM-driven multi-step browser automation with goal verification
- **Multimodal Vision** - Planner receives viewport screenshots alongside text context (AX tree, page text, element list)
- **Viewport-Aware Element Scoring** - 50 interactive elements scored by relevance: main content (+8), viewport visibility (+10), search inputs (+15), form elements (+6)
- **Scoped CSS Selectors** - Unique selectors via id → aria-label → data-testid → scoped CSS path (replaces broken global XPath)
- **Element Grouping** - Related elements grouped by semantic container (search-bar, form, dialog)
- **Navigation Resilience** - Survives mid-navigation page state changes with retry logic and degraded state fallback
- **New Tab Auto-Switch** - Detects when clicks open new tabs (target="_blank") and automatically switches to them
- **Sub-Goal Decomposition** - Complex goals decomposed into 3-7 sequential sub-goals with progress tracking
- **Self-Critique** - Optional post-action LLM critique with 0-1 progress scoring
- **Multi-Candidate Planning** - Optional generation of 2-3 diverse candidate actions per step
- **6 Failure Types** - Element not found, action had no effect, wrong page, form error, redirect loop, page crashed
- **Budget & Confidence Control** - Step/time budgets with linear confidence decay and escalation threshold
- **26 Browser Tools** - 6 CRO analysis + 3 navigation + 2 collection + 2 control + 13 interaction tools

### CRO Analysis Mode (Default)
- **Vision-Based CRO Analysis** - Unified DOM + screenshot + accessibility tree analysis across CTAs, forms, trust signals, value props, navigation, and friction points
- **Three-Phase Pipeline** - Collection → Analysis → Output with deterministic data capture
- **Hybrid Page Type Detection** - Three-tier detection: Playwright DOM analysis → URL/selector heuristics → LLM fallback
- **Parallel LLM Analysis** - Category-based evaluation with p-limit concurrency control (3-4x speedup)
- **Accessibility Tree Context** - Captures ARIA roles, computed names, and element states for semantic understanding
- **Category-Aware Auto-Cropping** - Crops screenshots to CRO-relevant regions per category, reducing image tokens by 30-50%
- **Token-Aware Image Pipeline** - Compresses images to fit OpenAI's tile-based token budget (default: 300 tokens/image)
- **Evidence Capture** - Full-resolution screenshots with bounding box annotations and evidence JSON export
- **Page Type Knowledge Bases** - Heuristic rules per page type (PDP, PLP, with Homepage/Cart/Checkout planned)
- **Hypothesis Generation** - Creates testable A/B test hypotheses with expected impact

### Shared
- **Browser Automation** - Powered by Playwright (1280x800 viewport) with cookie consent handling and full-page coverage
- **DOM Extraction** - CRO-relevant elements with enhanced selectors (price, variant, stock, shipping, gallery)
- **Multiple Output Formats** - Console, Markdown reports, JSON export, and evidence packages
- **1399+ Tests** - Unit, integration, and E2E tests with Vitest

## Tech Stack

| Technology | Purpose |
|------------|---------|
| TypeScript 5.x | Type-safe development |
| Node.js 20+ | Runtime environment |
| Playwright | Browser automation |
| LangChain | AI orchestration |
| OpenAI | GPT-4o-mini (analysis), GPT-4o (optional) |
| Zod | Schema validation |
| sharp | Image processing (screenshot resize, annotation) |
| p-limit | Concurrency control for parallel analysis |
| Vitest | Testing framework |

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd browser-agent

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=sk-your-api-key-here
```

### Default Configuration

| Setting | Default Value | Description |
|---------|---------------|-------------|
| `headless` | `false` | Run browser in visible mode |
| `timeout` | `60000` | Page load timeout (ms) |
| `browserType` | `chromium` | Browser engine |
| `model` | `gpt-4o-mini` | OpenAI model for analysis |
| `temperature` | `0` | LLM temperature |
| `scanMode` | `full_page` | Page scan mode |
| `parallelAnalysis` | `true` | Run categories in parallel |
| `saveEvidence` | `true` | Save screenshots as evidence |
| `annotateScreenshots` | `true` | Annotate screenshots with bounding boxes |
| `minConfidence` | `0.7` | Minimum confidence to display results |
| `captureAxTree` | `true` | Capture accessibility tree at each viewport |
| `autoCrop` | `true` | Category-aware auto-cropping for LLM images |
| `imageTokenBudget` | `300` | Max OpenAI vision tokens per image |
| `viewport` | `1280x800` | Browser viewport dimensions |

## Usage

### Basic Usage (CRO Analysis)

```bash
# Analyze a single URL for CRO opportunities
npm run start -- https://www.example.com/product-page

# Analyze multiple URLs
npm run start -- https://site1.com https://site2.com https://site3.com

# Generate markdown report
npm run start -- https://www.example.com --output-format markdown --output-file report.md

# Generate JSON export
npm run start -- https://www.example.com --output-format json --output-file analysis.json
```

### Agent Mode (Goal-Directed Automation)

```bash
# Basic agent mode — agent infers the URL from the goal
npm run start -- --agent-mode "Go to Amazon India, search for best rated mechanical keyboard, fetch its details"

# Agent mode with explicit start URL
npm run start -- --agent-mode "Search for TypeScript" https://wikipedia.org

# With sub-goal decomposition disabled
npm run start -- --agent-mode "Fill out the contact form" https://example.com --no-sub-goals

# With self-critique enabled (1.5x time budget)
npm run start -- --agent-mode "Find cheapest flight to London" --self-critique

# With multi-candidate planning
npm run start -- --agent-mode "Add item to cart" https://shop.example.com --multi-candidate --candidates 3

# Verbose output with step details
npm run start -- --agent-mode "Download the PDF report" https://example.com --verbose
```

### CLI Options

```bash
# Agent Mode Options
--agent-mode <goal>           Run goal-directed browser automation (URL optional)
--agent-max-steps <n>         Maximum steps for agent loop (default: 20)
--agent-max-time <ms>         Maximum time for agent loop in ms (default: 120000)
--no-sub-goals                Disable sub-goal decomposition (default: enabled)
--self-critique               Enable post-action self-critique (default: disabled)
--multi-candidate             Enable multi-candidate planning (default: disabled)
--candidates <n>              Number of candidate actions per step (default: 3)

# Browser Options
--headless                    Run browser in headless mode (default: visible)
--timeout <ms>                Page load timeout in milliseconds (default: 60000)
--wait-until <strategy>       Wait strategy: load, domcontentloaded, networkidle (default: load)
--post-load-wait <ms>         Wait time for JS rendering after load (default: 5000)
--no-cookie-dismiss           Disable automatic cookie consent dismissal

# Vision & Analysis Options
--vision                      Enable unified vision analysis (DOM + screenshots)
--vision-model <model>        Vision model: gpt-4o, gpt-4o-mini (default: gpt-4o-mini)
--vision-max-steps <n>        Max steps for vision collection (default: 20)
--fast-analysis               Use cheaper model for cost-sensitive runs
--min-confidence <n>          Minimum confidence threshold 0-1 (default: 0.7)
--no-ax-tree                  Disable accessibility tree capture (default: enabled)

# Screenshot & Evidence Options
--screenshot-mode <mode>      Screenshot mode: viewport, tiled, hybrid (default: viewport)
--no-save-evidence            Disable evidence screenshot saving
--no-annotate-screenshots     Disable bounding box annotations on screenshots
--evidence-dir <path>         Directory for evidence output
--no-evidence-json            Disable evidence.json output

# Collection Options
--scan-mode <mode>            Scan mode: full_page, above_fold, llm_guided (default: full_page)
--min-coverage <n>            Minimum page coverage percent (default: 100)
--llm-guided-collection       Use LLM-guided collection instead of deterministic (opt-in)
--skip-collection-qa          Skip LLM QA validation

# Page Type Detection Options
--no-llm-page-detection       Disable LLM fallback for page type detection
--force-llm-detection         Force LLM detection (skip Playwright/heuristic tiers)
--llm-detection-threshold <n> Confidence threshold for LLM fallback 0-1 (default: 0.5)

# Analysis Optimization Options
--sequential-analysis         Disable parallel analysis, run categories sequentially
--max-concurrent-categories <n>  Max concurrent category analyses (default: 5)
--category-batching           Enable category batching (opt-in, saves tokens)
--viewport-filtering          Enable viewport filtering (opt-in, sends relevant viewports only)
--validate-quality            Run quality validation comparing optimized vs baseline (CI use)
--no-auto-crop                Disable category-aware auto-cropping (default: enabled)
--image-token-budget <n>      Max OpenAI vision tokens per image 100-1000 (default: 300)

# Output Options
--output-format <fmt>         Output format: console, markdown, json (default: console)
--output-file <path>          Write report to file
--max-steps <n>               Maximum analysis steps (default: 10, max: 50)
--tool <name>                 Execute specific CRO tool for debugging

# General
--verbose, -v                 Enable verbose logging
--help, -h                    Show help message
```

### Examples

```bash
# Full vision analysis with evidence capture
npm run start -- --vision https://www.example.com/product

# Vision analysis with markdown report
npm run start -- --vision --output-format markdown --output-file report.md https://www.example.com

# Headless mode with JSON output
npm run start -- --headless --vision --output-format json --output-file analysis.json https://www.example.com

# Tiled screenshot mode for long pages
npm run start -- --vision --screenshot-mode tiled https://www.example.com

# Cost-optimized analysis with lower confidence threshold
npm run start -- --vision --fast-analysis --min-confidence 0.5 https://www.example.com

# Execute specific tool for debugging
npm run start -- --tool analyze_ctas https://www.example.com

# Custom wait strategy for dynamic sites
npm run start -- --wait-until networkidle --post-load-wait 10000 https://spa-site.com
```

### Programmatic Usage

```typescript
import { CROAgent } from './src';

// Basic CRO Analysis
const croAgent = new CROAgent({
  maxSteps: 10,
  actionWaitMs: 500,
  llmTimeoutMs: 60000,
  failureLimit: 3,
});

const result = await croAgent.analyze('https://www.example.com/product', {
  browserConfig: {
    headless: true,
    timeout: 60000,
    waitUntil: 'load',
    postLoadWait: 5000,
    dismissCookieConsent: true,
    browserType: 'chromium',
  },
  verbose: false,
});

console.log(result.insights);      // CRO insights from tool execution
console.log(result.hypotheses);    // Testable A/B test hypotheses
console.log(result.scores);        // CRO scores by category

// Vision Mode (unified DOM + screenshot analysis)
const visionResult = await croAgent.analyze('https://www.example.com/product', {
  vision: true,
  visionModel: 'gpt-4o-mini',
  scanMode: 'full_page',
  screenshotMode: 'viewport',
  parallelAnalysis: true,
  browserConfig: {
    headless: true,
    timeout: 60000,
    waitUntil: 'load',
    postLoadWait: 5000,
    dismissCookieConsent: true,
    browserType: 'chromium',
  },
});

console.log(visionResult.visionInsights);       // Vision-based CRO insights
console.log(visionResult.visionAnalysis);       // Full analysis with evaluations
console.log(visionResult.pageType);             // Detected page type (pdp, plp, etc.)
console.log(visionResult.snapshots);            // Collected viewport snapshots
console.log(visionResult.runId);                // Deterministic run ID
```

## Architecture

### System Overview

```
                              ┌─────────────┐
                              │    CLI      │
                              │   Input     │
                              └──────┬──────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │ --agent-mode   │   default      │
                    ▼                ▼                 │
          ┌─────────────────┐  ┌──────────────────┐   │
          │   Agent Loop    │  │    CROAgent      │   │
          │ Perceive→Plan   │  │  Collection →    │   │
          │ →Act→Verify     │  │  Analysis →      │   │
          │                 │  │  Output          │   │
          └────────┬────────┘  └────────┬─────────┘   │
                   │                    │              │
          ┌────────▼────────────────────▼──────────┐  │
          │         Shared Infrastructure           │  │
          │  Browser (Playwright) | Tool System (26)│  │
          │  AX Tree | DOM Extraction | Evidence    │  │
          └─────────────────────────────────────────┘  │
```

### Agent Mode Architecture (11 Layers)

```
┌─────────────────────────────────────────────────────────────┐
│ L10: ORCHESTRATION — runAgentLoop() perceive→plan→act→verify │
├────────────┬────────────┬──────────────┬────────────────────┤
│ L3: PERCEI │ L4: PLANNI │ L7: VERIFY   │ L6: FAILURE DETECT │
│ perceivePa │ planNextAc │ verifyGoal() │ detectFailure()    │
│ element-co │ sub-goal   │ shouldVerify │ routeFailure()     │
│ AX tree    │ candidates │              │ 6 types→3 strats   │
│ screenshot │ multimodal │              │                    │
│ page text  │ vision     │              │                    │
├────────────┴────────────┴──────────────┴────────────────────┤
│ L5: RELIABILITY          │ L8: BUDGET & CONFIDENCE          │
│ self-critic (critique)   │ BudgetController (steps/time)    │
│ pre-validator (5ms)      │ ConfidenceDecay (linear decay)   │
├──────────────────────────┴──────────────────────────────────┤
│ L9: STATE TRACKING — VisitedStateTracker (URL dedup)         │
├──────────────────────────────────────────────────────────────┤
│ L2: TOOL SYSTEM — 26 tools, Zod validation, nav detection    │
├──────────────────────────────────────────────────────────────┤
│ L1: BROWSER — Playwright, AX Tree, DOM, Cookie Handler       │
└──────────────────────────────────────────────────────────────┘
```

### Agent Loop Step-by-Step

```
1. PERCEIVE    → URL, title, DOM hash, AX tree (16K), 50 scored elements,
                 screenshot (JPEG), page text (2K), blocker detection
2. BLOCKER     → Auto-dismiss cookie banners / modals
3. PLAN        → LLM picks single action from 16 tools (with vision)
4. PRE-VALID   → Check element exists in DOM (5ms vs 10s timeout)
5. ACT         → Execute tool with navigation detection
6. TAB DETECT  → Auto-switch to new tab if opened
7. SETTLE      → Wait for navigation or DOM re-render
8. RE-PERCEIVE → Capture post-action state (with retry on navigation-pending)
9. FAILURE     → Detect 6 failure types → replan or terminate
10. CRITIQUE   → Optional LLM critique (progress score 0-1)
11. VERIFY     → LLM goal check every N steps → SUCCESS if confidence > 0.7
12. BUDGET     → Check step/time limits → BUDGET_EXCEEDED if over
```

### CRO Mode Data Flow

1. **Collection Phase** - Browser loads page (1280x800 viewport), deterministic scroll + capture loop collects DOM, full-resolution screenshots, and accessibility tree at each viewport position. Cookie consent auto-dismissed, UI noise suppressed. Cheap validator checks data quality, LLM QA escalates if needed.
2. **Analysis Phase** - Hybrid page type detection (Playwright → heuristics → LLM fallback). Category-based LLM analysis runs in parallel. Per-category auto-cropping extracts relevant regions from screenshots, then token-aware compression fits images within budget. LLM receives cropped images + DOM + AX tree + element positions for each category.
3. **Output Phase** - Insights deduplicated, prioritized by severity + business type. A/B test hypotheses generated. CRO scores calculated. Reports exported. Evidence screenshots (full-resolution) annotated with bounding boxes.

### Module Structure

#### Agent Loop Modules (Agent Mode)

| Module | File | Responsibility |
|--------|------|----------------|
| `runAgentLoop` | `agent-loop/agent-loop.ts` | Main perceive-plan-act-verify orchestrator |
| `perceivePage` | `agent-loop/perceiver.ts` | Page state extraction (URL, AX tree, elements, screenshot, text) |
| `collectInteractiveElements` | `agent-loop/element-collector.ts` | Viewport-aware scored element collection with region detection |
| `planNextAction` | `agent-loop/planner.ts` | LLM single-action planning with multimodal vision |
| `decomposeGoal` | `agent-loop/sub-goal-planner.ts` | Goal decomposition into sub-goals |
| `generateCandidates` | `agent-loop/candidate-generator.ts` | Multi-candidate action generation |
| `verifyGoal` | `agent-loop/verifier.ts` | LLM goal verification |
| `detectFailure` | `agent-loop/failure-router.ts` | 6 failure types → 3 recovery strategies |
| `critiqueAction` | `agent-loop/self-critic.ts` | Post-action LLM critique |
| `preValidateElement` | `agent-loop/element-pre-validator.ts` | Element existence check (5ms) |
| `BudgetController` | `agent-loop/budget-controller.ts` | Step/time budget tracking |
| `ConfidenceDecay` | `agent-loop/confidence-decay.ts` | Linear confidence decay with escalation |
| `VisitedStateTracker` | `agent-loop/visited-state-tracker.ts` | URL visit tracking |

#### CRO Analysis Modules

| Module | Responsibility |
|--------|----------------|
| `CROAgent` | Main orchestrator — collection, analysis, post-processing |
| `AnalysisOrchestrator` | Coordinates parallel/batched category-based LLM analysis |
| `CategoryAnalyzer` | Single-category LLM evaluation with auto-crop + AX tree context |
| `AXTreeSerializer` | Captures and serializes browser accessibility tree (roles, names, states) |
| `ImageCropPipeline` | Category-aware auto-cropping + token-aware compression |
| `ImageTokenCalculator` | Calculates OpenAI vision token costs (tile-based model) |
| `CategoryCropMapper` | Maps categories to CRO element types, computes union bounding boxes |
| `HybridPageTypeDetector` | Three-tier page type detection (Playwright → heuristics → LLM) |
| `PlaywrightPageDetector` | DOM-based page type signals (JSON-LD, CTAs, variants) |
| `StateManager` | Manages agent state across analysis steps |
| `MessageManager` | Handles LLM conversation history |
| `PromptBuilder` | Constructs prompts for LLM analysis |
| `CoverageTracker` | Tracks page segment scanning for full-page coverage |
| `ToolRegistry` | Registers and manages 26 tools |
| `ToolExecutor` | Executes CRO tools with page context |
| `BusinessTypeDetector` | Detects website business type |
| `SeverityScorer` | Calculates insight severity scores |
| `BrowserManager` | Playwright browser lifecycle management |
| `PageLoader` | URL navigation with wait strategies |
| `DOMExtractor` | Extracts CRO-relevant DOM elements with enhanced selectors |
| `DOMMerger` | Merges DOM snapshots from multiple scroll positions |
| `ScreenshotAnnotator` | Annotates screenshots with color-coded bounding boxes |
| `EvidencePackager` | Packages evidence with element refs and coordinates |
| `QualityValidator` | Compares optimized vs baseline analysis (CI use) |
| `CookieConsentHandler` | Detects and dismisses cookie banners |
| `HypothesisGenerator` | Generates testable A/B hypotheses |
| `InsightDeduplicator` | Removes duplicate insights (heuristicId-based) |
| `InsightPrioritizer` | Prioritizes insights by severity and business type |
| `MarkdownReporter` | Generates markdown reports |
| `JSONExporter` | Exports analysis to JSON |

## Project Structure

```
browser-agent/
├── src/
│   ├── index.ts                  # Main exports
│   ├── cli.ts                    # CLI entry point
│   ├── agent/                    # Agent core
│   │   ├── cro-agent.ts          # CRO pipeline orchestrator (collection + analysis + output)
│   │   ├── state-manager.ts      # CRO phase state management
│   │   ├── message-manager.ts    # LLM conversation handling
│   │   ├── prompt-builder.ts     # CRO prompt construction
│   │   ├── score-calculator.ts   # CRO score calculation
│   │   ├── coverage-tracker.ts   # Page coverage tracking
│   │   ├── agent-loop/           # Goal-directed agent loop (Phase 32-35)
│   │   │   ├── agent-loop.ts     # Main perceive→plan→act→verify orchestrator
│   │   │   ├── perceiver.ts      # Page state extraction (7 data sources)
│   │   │   ├── element-collector.ts  # Viewport-aware scored element collection
│   │   │   ├── planner.ts        # LLM single-action planning with vision
│   │   │   ├── verifier.ts       # LLM goal verification
│   │   │   ├── failure-router.ts # 6 failure types → 3 recovery strategies
│   │   │   ├── budget-controller.ts  # Step/time budget tracking
│   │   │   ├── confidence-decay.ts   # Linear confidence decay
│   │   │   ├── sub-goal-planner.ts   # Goal decomposition
│   │   │   ├── self-critic.ts    # Post-action LLM critique
│   │   │   ├── candidate-generator.ts # Multi-candidate planning
│   │   │   ├── element-pre-validator.ts # DOM element pre-check (5ms)
│   │   │   ├── visited-state-tracker.ts # URL visit tracking
│   │   │   ├── json-utils.ts     # LLM JSON extraction
│   │   │   └── types.ts          # All agent-loop interfaces
│   │   └── tools/                # Tool system
│   │       ├── tool-registry.ts
│   │       ├── tool-executor.ts
│   │       ├── create-cro-registry.ts
│   │       └── cro/              # 26 tool implementations
│   │           ├── analyze-ctas.ts
│   │           ├── analyze-forms-tool.ts
│   │           ├── analyze-trust-tool.ts
│   │           ├── analyze-value-prop-tool.ts
│   │           ├── check-navigation-tool.ts
│   │           ├── find-friction-tool.ts
│   │           ├── scroll-tool.ts
│   │           ├── go-to-url-tool.ts
│   │           ├── click-tool.ts
│   │           ├── capture-viewport-tool.ts
│   │           ├── record-insight-tool.ts
│   │           ├── collection-done-tool.ts
│   │           └── done-tool.ts
│   ├── browser/                  # Browser automation
│   │   ├── browser-manager.ts    # Playwright lifecycle
│   │   ├── page-loader.ts        # URL navigation, hybrid wait strategy
│   │   ├── cookie-handler.ts     # Cookie consent detection + dismissal
│   │   ├── cookie-patterns.ts    # Cookie banner patterns (Shopify, Alpine.js, etc.)
│   │   ├── ax-tree-serializer.ts  # Accessibility tree capture + serialize
│   │   ├── cleanup/              # UI noise suppression
│   │   │   └── ui-noise.ts
│   │   ├── media/                # Media readiness checks
│   │   │   └── media-readiness.ts
│   │   └── dom/                  # DOM extraction
│   │       ├── extractor.ts      # CRO DOM extraction
│   │       ├── build-dom-tree.ts # DOM tree builder
│   │       ├── serializer.ts     # DOM to LLM format with token budget
│   │       ├── dom-merger.ts     # Multi-viewport DOM merging
│   │       ├── coordinate-mapper.ts # DOM ↔ screenshot coordinate mapping
│   │       ├── cro-selectors.ts  # Enhanced selectors (price, variant, stock, etc.)
│   │       └── structured-data.ts # JSON-LD Product schema extraction
│   ├── detection/                # Element detection
│   │   ├── page-analyzer.ts      # Page analysis utilities
│   │   └── semantic-matcher.ts   # Semantic element matching
│   ├── heuristics/               # Analysis engine
│   │   ├── analysis-orchestrator.ts  # Parallel/batched category coordination
│   │   ├── category-analyzer.ts      # Single-category LLM evaluation
│   │   ├── category-batcher.ts       # Category batching (opt-in)
│   │   ├── category-grouper.ts       # Category grouping logic
│   │   ├── batch-prompt-builder.ts   # Batched prompt construction
│   │   ├── batch-response-parser.ts  # Batched response parsing
│   │   ├── viewport-selector.ts      # Viewport filtering per category (opt-in)
│   │   ├── cross-validator.ts        # DOM cross-validation
│   │   ├── model-config.ts           # Centralized model defaults
│   │   ├── business-type-detector.ts # Business type detection
│   │   ├── severity-scorer.ts        # Severity scoring
│   │   ├── page-type-detector.ts     # URL/selector page type detection
│   │   ├── playwright-page-detector.ts # Playwright-based page type detection
│   │   ├── llm-page-type-detector.ts  # LLM fallback page type detection
│   │   ├── hybrid-page-type-detector.ts # Three-tier detection orchestrator
│   │   ├── domain-pattern-cache.ts   # In-memory domain pattern cache
│   │   ├── knowledge/               # Page type knowledge bases
│   │   │   ├── pdp/                  # PDP heuristics (25 rules)
│   │   │   ├── plp/                  # PLP heuristics (25 rules)
│   │   │   └── types.ts             # Knowledge base types
│   │   └── vision/                   # Vision analysis + optimization
│   │       ├── analyzer.ts           # CROVisionAnalyzer
│   │       ├── image-token-calculator.ts  # OpenAI vision token cost (tile model)
│   │       ├── category-crop-mapper.ts    # Category → element type mapping + union bbox
│   │       ├── image-crop-pipeline.ts     # Auto-crop + token-aware compression
│   │       ├── prompt-builder.ts     # Vision prompt construction
│   │       ├── response-parser.ts    # Vision response parsing
│   │       ├── result-merger.ts      # Multi-viewport result merging
│   │       └── image-resizer.ts      # Legacy screenshot compression
│   ├── models/                   # Data models (Zod schemas)
│   │   ├── dom-tree.ts           # DOM tree + node structures
│   │   ├── cro-insight.ts        # CRO insights with evidence fields
│   │   ├── hypothesis.ts         # A/B test hypotheses
│   │   ├── page-state.ts         # Viewport + scroll state
│   │   ├── page-type.ts          # Page type definitions
│   │   ├── agent-state.ts        # Agent state + ViewportSnapshot
│   │   ├── agent-output.ts       # LLM output parsing
│   │   ├── cro-memory.ts         # Step records
│   │   ├── business-type.ts      # Business type classification
│   │   ├── coverage.ts           # Coverage tracking models
│   │   └── tool-definition.ts    # Tool schemas
│   ├── output/                   # Output generation
│   │   ├── cro-element-formatter.ts
│   │   ├── tool-result-formatter.ts
│   │   ├── agent-progress-formatter.ts
│   │   ├── hypothesis-generator.ts
│   │   ├── insight-deduplicator.ts
│   │   ├── insight-prioritizer.ts
│   │   ├── markdown-reporter.ts
│   │   ├── json-exporter.ts
│   │   ├── file-writer.ts
│   │   ├── screenshot-writer.ts      # Evidence screenshot saving
│   │   ├── screenshot-annotator.ts   # Bounding box + fold line annotation
│   │   ├── tiled-screenshot.ts       # Tiled screenshot capture
│   │   ├── llm-input-writer.ts       # LLM input capture for debugging
│   │   ├── evidence-packager.ts      # Evidence JSON packaging
│   │   └── extraction-metrics.ts     # Extraction quality metrics
│   ├── types/                    # TypeScript types
│   │   ├── index.ts              # Browser config, screenshot modes, evidence types
│   │   └── evidence-schema.ts    # Evidence schema + runId generation
│   ├── utils/                    # Utilities
│   │   ├── logger.ts
│   │   └── validator.ts
│   └── validation/               # Data validation
│       ├── cheap-validator.ts        # Zero-LLM-call validation
│       ├── collection-qa.ts          # LLM QA for collection quality
│       ├── signal-collector.ts       # Viewport validator signals
│       ├── reconciliation.ts         # DOM vs structured data comparison
│       ├── result-comparator.ts      # Quality comparison (optimized vs baseline)
│       ├── discrepancy-classifier.ts # Discrepancy severity classification
│       └── quality-validator.ts      # Quality validation orchestrator (CI use)
├── tests/
│   ├── unit/                     # 55+ unit test files
│   │   ├── agent-loop/           # Agent loop tests (perceiver, planner, verifier, etc.)
│   │   └── tools/                # Tool tests (interaction, navigation)
│   ├── integration/              # 23+ integration test files
│   └── e2e/                      # 9 E2E test files (gated behind RUN_E2E_TESTS)
├── design/                       # Architecture diagrams
│   ├── architecture-overview.svg
│   ├── component-details.svg
│   ├── configuration-types.svg
│   ├── data-flow-pipeline.svg
│   ├── sequence-diagram.svg
│   └── APPLICATION_FLOW.md
├── specs/                        # Specification documents
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .env                          # Environment variables
```

## Output Example

### CRO Analysis Output (Default)

```
╔══════════════════════════════════════════════════════════════════════════╗
║                        ANALYSIS COMPLETE - SUMMARY                      ║
╠══════════════════════════════════════════════════════════════════════════╣
║  Run ID: 20260215-143022-a1b2c3                                        ║
║  URL: https://www.example.com/product                                  ║
║  Time: 85.2s | Steps: 0 | Score: 68/100                               ║
╠══════════════════════════════════════════════════════════════════════════╣
║  PHASE OUTPUTS FLOW:                                                    ║
║    Phase 3  (Browser)    → Page loaded                                  ║
║    Phase 14 (DOM)        → 47 CRO elements extracted                    ║
║    Phase 21 (Vision)     → pdp, 12 vision insights                      ║
║    Phase 15 (Tools)      → 11 tools registered                          ║
║    Phase 16 (Agent)      → 0 steps executed (unified analysis)          ║
║    Phase 18a (Business)  → ecommerce detected                           ║
║    Phase 18d (Output)    → 5 hypotheses, score 68                       ║
╠══════════════════════════════════════════════════════════════════════════╣
║  TOP INSIGHTS                                                           ║
║                                                                         ║
║  [CRITICAL] [PDP-CTA-001] Primary CTA below the fold                   ║
║    Category: CTA | Element: [v0-12]                                     ║
║    Confidence: 0.92                                                     ║
║                                                                         ║
║  [HIGH] [PDP-TRUST-003] Missing trust signals near checkout             ║
║    Category: Trust | Element: [v1-5]                                    ║
║    Confidence: 0.85                                                     ║
╠══════════════════════════════════════════════════════════════════════════╣
║  HYPOTHESES                                                             ║
║                                                                         ║
║  1. Move primary CTA above the fold                                     ║
║     Expected Impact: +15-25% conversion rate                            ║
║     Test: A/B test CTA position                                         ║
╚══════════════════════════════════════════════════════════════════════════╝
```

## Scripts

```bash
npm run start             # Run the CLI
npm run dev               # Development mode with watch
npm run build             # Build TypeScript
npm run test              # Run all tests
npm run test:unit         # Run unit tests only
npm run test:integration  # Run integration tests only
npm run test:e2e          # Run E2E tests only
npm run test:coverage     # Run tests with coverage
npm run lint              # Lint code
npm run lint:fix          # Lint and auto-fix
npm run format            # Format code
npm run format:check      # Check formatting
npm run typecheck         # TypeScript type checking
```

## Error Handling

The agent implements stage-aware error handling:

| Stage | Error Types | Recovery |
|-------|-------------|----------|
| Load | Timeout, Network, DNS | Return error result, continue batch |
| Extract | No elements found | Return empty result (valid) |
| Collection | Screenshot failure, DOM extraction error | Retry with fallback mode |
| Analysis | API error, Parse failure, Category timeout | Per-category error isolation, fallback to sequential |
| Output | Format error | Show partial output |

## Type Definitions

### Core Types (CRO Analysis)

```typescript
// CRO Analysis Result
interface CROAnalysisResult {
  url: string;
  runId: string;                              // Deterministic run ID
  success: boolean;
  insights: CROInsight[];                     // Tool execution insights
  heuristicInsights: CROInsight[];            // (legacy, empty — superseded by vision)
  visionInsights: CROInsight[];               // Vision-based insights
  businessType?: BusinessTypeResult;
  pageType?: PageType;                        // Detected page type
  visionAnalysis?: CROVisionAnalysisResult;   // Full vision analysis
  unifiedAnalysisResult?: AnalysisResult;     // Orchestrator result
  snapshots?: ViewportSnapshot[];             // Collected viewport snapshots
  llmInputs?: CapturedCategoryInputs[];       // LLM inputs for debugging
  hypotheses: Hypothesis[];
  scores: CROScores;
  report?: { markdown?: string; json?: string };
  stepsExecuted: number;
  totalTimeMs: number;
  terminationReason: string;
  errors: string[];
  pageTitle?: string;
}

// CRO Insight (with evidence fields)
interface CROInsight {
  id: string;
  heuristicId?: string;                       // Knowledge base heuristic ID
  category: CROCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  element?: string;
  recommendation: string;
  impact: string;
  confidence?: number;                        // 0-1 confidence score
  viewportIndex?: number;                     // Viewport where found
  screenshotRef?: string;                     // Screenshot reference
  domElementRefs?: DOMElementRef[];           // Element positions
  boundingBox?: { x: number; y: number; width: number; height: number };
  timestamp?: number;
}

// CRO Scores
interface CROScores {
  overall: number;
  byCategory: Record<CROCategory, number>;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

// Hypothesis for A/B Testing
interface Hypothesis {
  id: string;
  title: string;
  description: string;
  expectedImpact: string;
  testSuggestion: string;
  relatedInsights: string[];
  priority: 'high' | 'medium' | 'low';
}

type CROCategory = 'cta' | 'forms' | 'trust' | 'value_prop' | 'navigation' | 'friction';
```

### Core Types (Agent Mode)

```typescript
// Agent Loop Configuration
interface AgentLoopConfig {
  goal: string;                    // Natural language goal
  startUrl?: string;               // Optional start URL (agent can infer from goal)
  maxSteps?: number;               // Step budget (default: 20)
  maxTimeMs?: number;              // Time budget in ms (default: 120000)
  enableSubGoals?: boolean;        // Sub-goal decomposition (default: true)
  enableCritique?: boolean;        // Post-action self-critique (default: false)
  enableMultiCandidate?: boolean;  // Multi-candidate planning (default: false)
  candidateCount?: number;         // Candidates per step (default: 3)
  verbose?: boolean;
}

// Agent Loop Result
interface AgentLoopResult {
  status: 'SUCCESS' | 'BUDGET_EXCEEDED' | 'CONFIDENCE_LOW' | 'UNRECOVERABLE_FAILURE' | 'RUNNER_ERROR';
  goalSatisfied: boolean;
  stepsUsed: number;
  totalTimeMs: number;
  actionHistory: ActionRecord[];
  terminationReason: string;
  errors: string[];
  finalUrl: string;
  finalTitle: string;
}

// Perceived Page State (what the planner sees)
interface PerceivedState {
  url: string;
  title: string;
  domHash: string;                          // 16-char SHA-256 hash
  axTreeText: string | null;                // Accessibility tree (8K/16K chars)
  interactiveElements: InteractiveElement[]; // Scored elements (20/50)
  hasBlocker: boolean;                      // Cookie banner / captcha
  screenshotBase64?: string;                // JPEG viewport screenshot
  pageText?: string;                        // Main content text (2K chars)
  contentRegion?: ContentRegion;            // Element counts by region
}

// Interactive Element (scored, with region and group)
interface InteractiveElement {
  index: number;           // Sequential index for planner
  tag: string;             // HTML tag (a, button, input, etc.)
  text: string;            // Visible text
  type?: string;           // Input type (text, submit, etc.)
  role?: string;           // ARIA role
  selector?: string;       // Unique CSS/XPath selector
  region?: string;         // 'header' | 'main' | 'footer' | 'unknown'
  score?: number;          // Relevance score (higher = more relevant)
  accessibleName?: string; // Full accessible name
  placeholder?: string;    // Input placeholder text
  group?: string;          // Semantic group (search-bar, form, dialog)
}
```

### Programmatic Agent Mode Usage

```typescript
import { runAgentLoop } from './src/agent/agent-loop';
import { ToolExecutor } from './src/agent/tools/tool-executor';
import { createCRORegistry } from './src/agent/tools/create-cro-registry';
import { BrowserManager } from './src/browser';
import { ChatOpenAI } from '@langchain/openai';

const browser = new BrowserManager({ headless: false, timeout: 60000 });
await browser.launch();

const result = await runAgentLoop(
  {
    goal: 'Go to Amazon India, search for mechanical keyboard, fetch its details',
    maxSteps: 20,
    maxTimeMs: 120000,
    enableSubGoals: true,
  },
  {
    llm: new ChatOpenAI({ modelName: 'gpt-4o-mini', temperature: 0 }),
    page: browser.getPage(),
    toolExecutor: new ToolExecutor(createCRORegistry()),
  }
);

console.log(result.status);          // 'SUCCESS'
console.log(result.goalSatisfied);   // true
console.log(result.stepsUsed);       // 4
console.log(result.finalUrl);        // https://www.amazon.in/product/...
console.log(result.actionHistory);   // Step-by-step action log

await browser.close();
```

## Design Documentation

Visual architecture diagrams are available in the `design/` directory:

- `architecture-overview.svg` - High-level system architecture
- `data-flow-pipeline.svg` - Detailed data flow with stages
- `component-details.svg` - Classes, methods, and dependencies
- `configuration-types.svg` - Configuration hierarchy and types
- `sequence-diagram.svg` - UML sequence diagram
- `APPLICATION_FLOW.md` - Detailed ASCII flow diagrams

## Requirements

- Node.js 20.0.0 or higher
- OpenAI API key with access to GPT-4o-mini

## License

MIT
