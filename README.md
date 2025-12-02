# Browser Agent

A TypeScript-based browser automation agent that extracts web page data and generates AI-powered insights using LangChain and OpenAI.

## Overview

Browser Agent is a CLI tool that autonomously navigates web pages, extracts structured data (heading hierarchy), and processes it through OpenAI's GPT-4o-mini model to generate intelligent summaries, categorizations, and insights.

## Features

- **Browser Automation** - Powered by Playwright for reliable web page loading
- **Heading Extraction** - Extracts H1-H6 elements with document structure analysis
- **AI Processing** - LangChain integration with OpenAI GPT-4o-mini for intelligent analysis
- **Batch Processing** - Process multiple URLs sequentially with aggregated results
- **Formatted Output** - Beautiful console output with Unicode box drawing
- **Configurable** - Flexible CLI options for headless mode, timeouts, and verbosity

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
| `model` | `gpt-4o-mini` | OpenAI model |
| `maxTokens` | `1000` | Max response tokens |
| `temperature` | `0.3` | LLM temperature |

## Usage

### Basic Usage

```bash
# Process a single URL
npm run start -- https://example.com

# Process multiple URLs
npm run start -- https://site1.com https://site2.com https://site3.com
```

### CLI Options

```bash
# Run in headless mode (no browser window)
npm run start -- --headless https://example.com
npm run start -- -h https://example.com

# Set custom timeout (in milliseconds)
npm run start -- --timeout 120000 https://example.com

# Enable verbose logging
npm run start -- --verbose https://example.com
npm run start -- -v https://example.com

# Combine options
npm run start -- -h -v --timeout 30000 https://example.com

# Show help
npm run start -- --help
```

### Programmatic Usage

```typescript
import { BrowserAgent } from './src';

const agent = new BrowserAgent({
  browser: {
    headless: true,
    timeout: 60000,
  },
  verbose: true,
});

// Validate environment
agent.validateEnvironment();

// Process single URL
const result = await agent.processUrl('https://example.com');
console.log(agent.formatResult(result));

// Process batch
const batch = await agent.processBatch([
  'https://site1.com',
  'https://site2.com',
]);
console.log(agent.formatBatch(batch));

// Cleanup
await agent.close();
```

## Architecture

### System Overview

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   CLI       │────▶│  BrowserAgent   │────▶│   Console   │
│   Input     │     │  (Orchestrator) │     │   Output    │
└─────────────┘     └─────────────────┘     └─────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
  │   Browser   │   │  Extraction │   │  LangChain  │
  │   Module    │   │   Module    │   │   Module    │
  └─────────────┘   └─────────────┘   └─────────────┘
         │                                    │
         ▼                                    ▼
  ┌─────────────┐                     ┌─────────────┐
  │  Playwright │                     │ OpenAI API  │
  └─────────────┘                     └─────────────┘
```

### Data Flow Pipeline

1. **Input** - Accept URL(s) from CLI
2. **Validation** - Validate URL format and environment
3. **Load** - Navigate to URL using Playwright
4. **Extract** - Query H1-H6 heading elements
5. **Process** - Analyze with LangChain + OpenAI
6. **Output** - Format and display results

### Module Structure

| Module | Responsibility |
|--------|----------------|
| `BrowserAgent` | Main orchestrator, coordinates all modules |
| `BrowserManager` | Playwright browser lifecycle management |
| `PageLoader` | URL navigation and page loading |
| `HeadingExtractor` | DOM querying for heading elements |
| `LangChainProcessor` | AI analysis with OpenAI integration |
| `ResultFormatter` | Console output formatting |
| `Logger` | Structured JSON logging |
| `Validator` | URL and environment validation |

## Project Structure

```
browser-agent/
├── src/
│   ├── index.ts              # Main BrowserAgent class
│   ├── cli.ts                # CLI entry point
│   ├── browser/
│   │   ├── browser-manager.ts
│   │   └── page-loader.ts
│   ├── extraction/
│   │   └── heading-extractor.ts
│   ├── langchain/
│   │   └── processor.ts
│   ├── output/
│   │   └── formatter.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       ├── logger.ts
│       └── validator.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
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

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       BROWSER AGENT RESULTS                              │
├──────────────────────────────────────────────────────────────────────────┤
│ URL: https://example.com                                                 │
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

### Core Types

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

interface ProcessingResult {
  summary: string;
  categories: string[];
  insights: string[];
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
