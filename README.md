# Browser Agent

A TypeScript-based CRO (Conversion Rate Optimization) browser automation agent that analyzes web pages and generates AI-powered insights, hypotheses, and optimization recommendations.

## Overview

Browser Agent is a CLI tool that autonomously navigates web pages, extracts CRO-relevant DOM elements, and processes them through a heuristic engine and OpenAI's GPT-4o-mini model to identify conversion optimization opportunities. It generates prioritized insights, testable hypotheses, and actionable recommendations.

## Features

- **CRO Analysis** - Analyzes CTAs, forms, trust signals, value propositions, navigation, and friction points
- **Heuristic Engine** - Rule-based analysis with business type detection and severity scoring
- **Hypothesis Generation** - Creates testable A/B test hypotheses with expected impact
- **Browser Automation** - Powered by Playwright for reliable web page loading
- **DOM Extraction** - Extracts CRO-relevant elements with intelligent selectors
- **Cookie Consent Handling** - Automatic detection and dismissal of cookie banners
- **Multiple Output Formats** - Console, Markdown reports, and JSON export
- **AI Processing** - LangChain integration with OpenAI GPT-4o-mini for intelligent analysis
- **Batch Processing** - Process multiple URLs sequentially with aggregated results
- **Legacy Mode** - Original heading extraction mode available via `--legacy` flag

## Tech Stack

| Technology | Purpose |
|------------|---------|
| TypeScript | Type-safe development |
| Node.js 20+ | Runtime environment |
| Playwright | Browser automation |
| LangChain | AI orchestration |
| OpenAI | GPT-4o-mini model |
| Zod | Schema validation |
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
| `model` | `gpt-4` | OpenAI model |
| `maxTokens` | `1000` | Max response tokens |
| `temperature` | `0.3` | LLM temperature |

## Usage

### Basic Usage (CRO Analysis)

```bash
# Analyze a single URL for CRO opportunities
npm run start -- https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711

# Analyze multiple URLs
npm run start -- https://site1.com https://site2.com https://site3.com

# Generate markdown report
npm run start -- https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711 --output-format markdown --output-file report.md

# Generate JSON export
npm run start -- https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711 --output-format json --output-file analysis.json
```

### CLI Options

```bash
# Browser Options
--headless              Run browser in headless mode (default: visible)
--timeout <ms>          Page load timeout in milliseconds (default: 60000)
--wait-until <strategy> Page load wait strategy: load, domcontentloaded, networkidle (default: load)
--post-load-wait <ms>   Wait time for JS rendering after load (default: 5000)
--no-cookie-dismiss     Disable automatic cookie consent dismissal

# CRO Analysis Options
--output-format <fmt>   Output format: console, markdown, json (default: console)
--output-file <path>    Write report to file
--max-steps <n>         Maximum analysis steps (default: 10, max: 50)
--tool <name>           Execute specific CRO tool for debugging
                        Available: analyze_ctas, analyze_forms, detect_trust_signals,
                        assess_value_prop, check_navigation, find_friction,
                        scroll_page, go_to_url, done

# Mode Options
--legacy                Use legacy heading extraction mode (no CRO analysis)
--verbose, -v           Enable verbose logging
--help, -h              Show help message
```

### Examples

```bash
# Full CRO analysis with markdown report
npm run start -- https://www.example.com --output-format markdown --output-file report.md

# CRO analysis with limited steps
npm run start -- --max-steps 5 https://www.example.com

# Headless mode with JSON output
npm run start -- --headless --output-format json --output-file analysis.json https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711

# Execute specific tool for debugging
npm run start -- --tool analyze_ctas https://www.example.com

# Legacy heading extraction mode
npm run start -- --legacy https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711

# Custom wait strategy for dynamic sites
npm run start -- --wait-until networkidle --post-load-wait 10000 https://spa-site.com
```

### Programmatic Usage

```typescript
import { CROAgent, BrowserAgent } from './src';

// CRO Analysis (Primary Mode)
const croAgent = new CROAgent({
  maxSteps: 10,
  actionWaitMs: 500,
  llmTimeoutMs: 60000,
  failureLimit: 3,
});

const result = await croAgent.analyze('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711', {
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

console.log(result.insights);      // CRO insights found
console.log(result.hypotheses);    // Testable hypotheses
console.log(result.scores);        // CRO scores by category

// Legacy Mode (Heading Extraction)
const legacyAgent = new BrowserAgent({
  browser: { headless: true, timeout: 60000 },
  verbose: true,
});

legacyAgent.validateEnvironment();
const legacyResult = await legacyAgent.processUrl('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711');
console.log(legacyAgent.formatResult(legacyResult));
await legacyAgent.close();
```

## Architecture

### System Overview

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   CLI       │────▶│    CROAgent     │────▶│  Output Layer   │
│   Input     │     │  (Orchestrator) │     │ (Console/MD/JSON)│
└─────────────┘     └─────────────────┘     └─────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
  ┌─────────────┐   ┌─────────────┐   ┌─────────────────┐
  │   Browser   │   │  Heuristic  │   │   LangChain     │
  │   Module    │   │   Engine    │   │   + Tools       │
  └─────────────┘   └─────────────┘   └─────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
  ┌─────────────┐   ┌─────────────┐   ┌─────────────────┐
  │  Playwright │   │ CRO Rules   │   │   OpenAI API    │
  │  + DOM Ext. │   │ + Scoring   │   │   + Tool Exec   │
  └─────────────┘   └─────────────┘   └─────────────────┘
```

### Data Flow Pipeline

1. **Input** - Accept URL(s) from CLI with analysis options
2. **Validation** - Validate URL format and environment (API key)
3. **Load** - Navigate to URL using Playwright with cookie consent handling
4. **Extract** - Extract CRO-relevant DOM elements (CTAs, forms, trust signals, etc.)
5. **Analyze** - Run heuristic rules and LLM-powered CRO tools
6. **Score** - Calculate severity scores and prioritize insights
7. **Generate** - Create hypotheses from insights
8. **Output** - Format and display/export results

### Module Structure

| Module | Responsibility |
|--------|----------------|
| `CROAgent` | Main orchestrator for CRO analysis workflow |
| `StateManager` | Manages agent state across analysis steps |
| `MessageManager` | Handles LLM conversation history |
| `PromptBuilder` | Constructs prompts for LLM analysis |
| `ToolRegistry` | Registers and manages CRO analysis tools |
| `ToolExecutor` | Executes CRO tools with page context |
| `HeuristicEngine` | Runs rule-based CRO analysis |
| `BusinessTypeDetector` | Detects website business type |
| `SeverityScorer` | Calculates insight severity scores |
| `BrowserManager` | Playwright browser lifecycle management |
| `PageLoader` | URL navigation with wait strategies |
| `DOMExtractor` | Extracts CRO-relevant DOM elements |
| `CookieConsentHandler` | Detects and dismisses cookie banners |
| `HypothesisGenerator` | Generates testable A/B hypotheses |
| `InsightDeduplicator` | Removes duplicate insights |
| `InsightPrioritizer` | Prioritizes insights by impact |
| `MarkdownReporter` | Generates markdown reports |
| `JSONExporter` | Exports analysis to JSON |
| `LangChainProcessor` | AI analysis with OpenAI (legacy mode) |
| `HeadingExtractor` | H1-H6 extraction (legacy mode) |

## Project Structure

```
browser-agent/
├── src/
│   ├── index.ts              # Main exports and BrowserAgent class
│   ├── cli.ts                # CLI entry point
│   ├── agent/                # CRO Agent (primary)
│   │   ├── cro-agent.ts      # Main CRO analysis orchestrator
│   │   ├── state-manager.ts  # Agent state management
│   │   ├── message-manager.ts # LLM conversation handling
│   │   ├── prompt-builder.ts # LLM prompt construction
│   │   ├── score-calculator.ts # CRO score calculation
│   │   └── tools/            # CRO analysis tools
│   │       ├── tool-registry.ts
│   │       ├── tool-executor.ts
│   │       └── cro/          # Individual CRO tools
│   │           ├── analyze-ctas.ts
│   │           ├── analyze-forms-tool.ts
│   │           ├── analyze-trust-tool.ts
│   │           ├── analyze-value-prop-tool.ts
│   │           ├── check-navigation-tool.ts
│   │           ├── find-friction-tool.ts
│   │           ├── scroll-tool.ts
│   │           ├── go-to-url-tool.ts
│   │           ├── click-tool.ts
│   │           ├── record-insight-tool.ts
│   │           └── done-tool.ts
│   ├── browser/              # Browser automation
│   │   ├── browser-manager.ts
│   │   ├── page-loader.ts
│   │   ├── cookie-handler.ts # Cookie consent handling
│   │   ├── cookie-patterns.ts
│   │   └── dom/              # DOM extraction
│   │       ├── extractor.ts
│   │       ├── build-dom-tree.ts
│   │       ├── serializer.ts
│   │       └── cro-selectors.ts
│   ├── heuristics/           # Heuristic analysis engine
│   │   ├── heuristic-engine.ts
│   │   ├── business-type-detector.ts
│   │   ├── severity-scorer.ts
│   │   └── rules/            # CRO heuristic rules
│   │       ├── cta-rules.ts
│   │       ├── form-rules.ts
│   │       ├── trust-rules.ts
│   │       ├── navigation-rules.ts
│   │       └── value-prop-rules.ts
│   ├── models/               # Data models
│   │   ├── dom-tree.ts
│   │   ├── cro-insight.ts
│   │   ├── hypothesis.ts
│   │   ├── page-state.ts
│   │   ├── agent-state.ts
│   │   ├── agent-output.ts
│   │   ├── cro-memory.ts
│   │   ├── business-type.ts
│   │   └── tool-definition.ts
│   ├── output/               # Output formatters
│   │   ├── formatter.ts      # Legacy result formatter
│   │   ├── cro-element-formatter.ts
│   │   ├── tool-result-formatter.ts
│   │   ├── agent-progress-formatter.ts
│   │   ├── hypothesis-generator.ts
│   │   ├── insight-deduplicator.ts
│   │   ├── insight-prioritizer.ts
│   │   ├── markdown-reporter.ts
│   │   ├── json-exporter.ts
│   │   └── file-writer.ts
│   ├── extraction/           # Legacy heading extraction
│   │   └── heading-extractor.ts
│   ├── langchain/            # LangChain integration
│   │   └── processor.ts
│   ├── types/                # TypeScript types
│   │   └── index.ts
│   └── utils/                # Utilities
│       ├── logger.ts
│       └── validator.ts
├── tests/
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── e2e/                  # End-to-end tests
├── design/                   # Architecture diagrams (SVG)
│   ├── architecture-overview.svg
│   ├── component-details.svg
│   ├── configuration-types.svg
│   ├── data-flow-pipeline.svg
│   ├── sequence-diagram.svg
│   └── APPLICATION_FLOW.md
├── specs/                    # Specification documents
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .env                      # Environment variables
```

## Output Example

### CRO Analysis Output (Default)

```
╔══════════════════════════════════════════════════════════════════════════╗
║                        CRO ANALYSIS RESULTS                              ║
╠══════════════════════════════════════════════════════════════════════════╣
║ URL: https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711                                                 ║
║ Status: SUCCESS                                                          ║
║ Steps Executed: 8                                                        ║
║ Total Time: 45.2s                                                        ║
╠══════════════════════════════════════════════════════════════════════════╣
║ CRO SCORES                                                               ║
║   Overall: 72/100                                                        ║
║   CTAs: 65  |  Forms: 80  |  Trust: 75  |  Value Prop: 70                ║
║   Critical: 1  |  High: 3  |  Medium: 5  |  Low: 2                       ║
╠══════════════════════════════════════════════════════════════════════════╣
║ TOP INSIGHTS                                                             ║
║                                                                          ║
║ [CRITICAL] Primary CTA below the fold                                    ║
║   Category: CTA | Element: #signup-btn                                   ║
║   The main call-to-action is not visible without scrolling               ║
║                                                                          ║
║ [HIGH] Missing trust signals near checkout                               ║
║   Category: Trust | Element: .checkout-form                              ║
║   No security badges or guarantees visible in checkout area              ║
║                                                                          ║
║ [HIGH] Form has too many required fields                                 ║
║   Category: Forms | Element: #contact-form                               ║
║   12 required fields may cause form abandonment                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║ HYPOTHESES                                                               ║
║                                                                          ║
║ 1. Move primary CTA above the fold                                       ║
║    Expected Impact: +15-25% conversion rate                              ║
║    Test: A/B test CTA position                                           ║
║                                                                          ║
║ 2. Add trust badges near checkout button                                 ║
║    Expected Impact: +5-10% checkout completion                           ║
║    Test: Add SSL/security badges, money-back guarantee                   ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### Legacy Mode Output (--legacy)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       BROWSER AGENT RESULTS                              │
├──────────────────────────────────────────────────────────────────────────┤
│ URL: https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711                                                 │
│ Status: SUCCESS                                                          │
│ Load Time: 2.34s                                                         │
├──────────────────────────────────────────────────────────────────────────┤
│ HEADINGS FOUND: 5                                                        │
│   h1: 1  |  h2: 3  |  h3: 1                                              │
├──────────────────────────────────────────────────────────────────────────┤
│ EXTRACTED HEADINGS:                                                      │
│   [h1] Welcome to Example                                                │
│   [h2] Getting Started                                                   │
│   [h2] Features                                                          │
│   [h3] Advanced Usage                                                    │
│   [h2] Documentation                                                     │
├──────────────────────────────────────────────────────────────────────────┤
│ AI INSIGHTS:                                                             │
│                                                                          │
│ Summary: Well-structured documentation page with clear hierarchy...      │
│                                                                          │
│ Categories: [Documentation, Tutorial, Getting Started]                   │
│                                                                          │
│ Insights:                                                                │
│   - Clear navigation structure with logical progression                  │
│   - Good use of heading hierarchy for SEO                                │
│   - Content organized by topic areas                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

## Scripts

```bash
# Run the CLI
npm run start

# Development mode with watch
npm run dev

# Build TypeScript
npm run build

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

## Error Handling

The agent implements stage-aware error handling:

| Stage | Error Types | Recovery |
|-------|-------------|----------|
| Load | Timeout, Network, DNS | Return error result, continue batch |
| Extract | No elements found | Return empty result (valid) |
| Process | API error, Parse failure | Graceful fallback with raw stats |
| Output | Format error | Show partial output |

## Type Definitions

### Core Types (CRO Analysis)

```typescript
// CRO Analysis Result
interface CROAnalysisResult {
  url: string;
  success: boolean;
  insights: CROInsight[];
  heuristicInsights: CROInsight[];
  hypotheses: Hypothesis[];
  scores: CROScores;
  stepsExecuted: number;
  totalTimeMs: number;
  terminationReason: string;
  errors: string[];
}

// CRO Insight
interface CROInsight {
  id: string;
  category: CROCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  element?: string;
  recommendation: string;
  impact: string;
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

### Legacy Types (Heading Extraction)

```typescript
interface Heading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  index: number;
}

interface ExtractionResult {
  headings: Heading[];
  totalCount: number;
  countByLevel: Record<number, number>;
}

interface AgentResult {
  url: string;
  pageLoad: PageLoadResult;
  extraction: ExtractionResult | null;
  processing: ProcessingResult | null;
  success: boolean;
  error?: string;
  totalTimeMs: number;
}
```

## Design Documentation

Visual architecture diagrams are available in the `design/` directory:

- `architecture-overview.svg` - High-level system architecture
- `data-flow-pipeline.svg` - Detailed data flow with stages
- `component-details.svg` - Classes, methods, and dependencies
- `configuration-types.svg` - Configuration hierarchy and types
- `sequence-diagram.svg` - UML sequence diagram

## Requirements

- Node.js 20.0.0 or higher
- OpenAI API key with access to GPT-4o-mini

## License

MIT
