# Data Model: Browser Agent Core

**Feature**: `001-browser-agent-core`
**Last Updated**: 2025-11-24

## Core Types

### Heading

Represents a single heading element extracted from a web page.

```typescript
/**
 * Represents an extracted heading element from a web page.
 */
interface Heading {
  /** Heading level (1-6 corresponding to h1-h6) */
  level: 1 | 2 | 3 | 4 | 5 | 6;

  /** Text content of the heading, decoded and trimmed */
  text: string;

  /** Zero-based index representing document order */
  index: number;
}
```

### ExtractionResult

Contains all headings extracted from a page with summary statistics.

```typescript
/**
 * Result of heading extraction from a single page.
 */
interface ExtractionResult {
  /** Array of all extracted headings in document order */
  headings: Heading[];

  /** Total number of headings found */
  totalCount: number;

  /** Count of headings by level (e.g., { 1: 2, 2: 5, 3: 3 }) */
  countByLevel: Record<number, number>;
}
```

## Browser Types

### BrowserConfig

Configuration for Playwright browser instance.

```typescript
/**
 * Wait strategy for page loading.
 * - 'load': Wait for load event (balanced, default)
 * - 'domcontentloaded': Wait for DOM ready (fastest)
 * - 'networkidle': Wait for no network activity (most complete, may timeout)
 */
type WaitUntilStrategy = 'load' | 'domcontentloaded' | 'networkidle';

/**
 * Configuration options for browser initialization.
 */
interface BrowserConfig {
  /** Run browser in headless mode (default: false per CR-001) */
  headless: boolean;

  /** Navigation timeout in milliseconds (default: 60000 per CR-002) */
  timeout: number;

  /** Browser type to use */
  browserType: 'chromium' | 'firefox' | 'webkit';

  /** Wait strategy for page loading (default: 'load' per CR-005) */
  waitUntil: WaitUntilStrategy;

  /** Post-load wait for JS rendering in ms (default: 5000). Set to 0 to disable. */
  postLoadWait: number;
}
```

### PageLoadResult

Result of attempting to load a URL.

```typescript
/**
 * Result of a page load operation.
 */
interface PageLoadResult {
  /** Whether the page loaded successfully */
  success: boolean;

  /** Page title if load succeeded */
  title?: string;

  /** The URL that was loaded (may differ from input due to redirects) */
  url: string;

  /** Error message if load failed */
  error?: string;

  /** Time taken to load in milliseconds */
  loadTimeMs?: number;
}
```

## LangChain Types

### ProcessingConfig

Configuration for LangChain processing.

```typescript
/**
 * Configuration for LangChain/OpenAI processing.
 */
interface ProcessingConfig {
  /** OpenAI model to use (default: 'gpt-4o-mini' per CR-003) */
  model: string;

  /** Maximum tokens for response */
  maxTokens: number;

  /** Temperature for generation (0-1) */
  temperature: number;
}
```

### ProcessingResult

Result from LangChain analysis.

```typescript
/**
 * Result of LangChain processing of extracted data.
 */
interface ProcessingResult {
  /** Human-readable summary of the page structure */
  summary: string;

  /** Identified topic categories from headings */
  categories: string[];

  /** Key insights about the content */
  insights: string[];

  /** Raw LLM response for debugging */
  rawResponse?: string;
}
```

## Orchestrator Types

### AgentConfig

Top-level configuration for the browser agent.

```typescript
/**
 * Main configuration for the browser agent.
 */
interface AgentConfig {
  /** Browser configuration */
  browser: BrowserConfig;

  /** LangChain processing configuration */
  processing: ProcessingConfig;

  /** Enable verbose logging */
  verbose: boolean;
}
```

### AgentResult

Complete result from processing a single URL.

```typescript
/**
 * Complete result from processing a single URL.
 */
interface AgentResult {
  /** The URL that was processed */
  url: string;

  /** Page load result */
  pageLoad: PageLoadResult;

  /** Extraction result (null if page load failed) */
  extraction: ExtractionResult | null;

  /** LangChain processing result (null if extraction failed or empty) */
  processing: ProcessingResult | null;

  /** Overall success status */
  success: boolean;

  /** Error message if any stage failed */
  error?: string;

  /** Stage where error occurred */
  errorStage?: 'load' | 'extract' | 'process' | 'output';

  /** Total processing time in milliseconds */
  totalTimeMs: number;
}
```

### BatchResult

Result from processing multiple URLs.

```typescript
/**
 * Result from processing multiple URLs sequentially.
 */
interface BatchResult {
  /** Results for each URL in order */
  results: AgentResult[];

  /** Number of successful URL processes */
  successCount: number;

  /** Number of failed URL processes */
  failureCount: number;

  /** Total time for all URLs in milliseconds */
  totalTimeMs: number;
}
```

## Utility Types

### LogEntry

Structure for JSON logging.

```typescript
/**
 * Structured log entry for machine-parseable output.
 */
interface LogEntry {
  /** ISO timestamp */
  timestamp: string;

  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error';

  /** Log message */
  message: string;

  /** Additional context */
  context?: Record<string, unknown>;
}
```

### ValidationResult

Result of URL validation.

```typescript
/**
 * Result of URL validation.
 */
interface ValidationResult {
  /** Whether the URL is valid */
  valid: boolean;

  /** Normalized URL if valid */
  normalizedUrl?: string;

  /** Error message if invalid */
  error?: string;
}
```

## Type Guards

```typescript
/**
 * Type guard to check if a value is a valid heading level.
 */
function isHeadingLevel(value: number): value is 1 | 2 | 3 | 4 | 5 | 6 {
  return value >= 1 && value <= 6 && Number.isInteger(value);
}

/**
 * Type guard to check if an AgentResult represents a successful operation.
 */
function isSuccessfulResult(result: AgentResult): result is AgentResult & {
  pageLoad: PageLoadResult & { success: true };
  extraction: ExtractionResult;
  processing: ProcessingResult;
} {
  return result.success && result.extraction !== null && result.processing !== null;
}
```

## Default Values

```typescript
const DEFAULT_BROWSER_CONFIG: BrowserConfig = {
  headless: false,      // CR-001: Visible mode
  timeout: 60000,       // CR-002: 60 second timeout
  browserType: 'chromium',
  waitUntil: 'load',    // CR-005: Balanced default - works for most sites
  postLoadWait: 5000    // Wait up to 5s for JS to render dynamic content
};

const DEFAULT_PROCESSING_CONFIG: ProcessingConfig = {
  model: 'gpt-4o-mini', // CR-003: GPT-4o-mini
  maxTokens: 1000,
  temperature: 0.3      // Low temperature for consistent categorization
};

const DEFAULT_AGENT_CONFIG: AgentConfig = {
  browser: DEFAULT_BROWSER_CONFIG,
  processing: DEFAULT_PROCESSING_CONFIG,
  verbose: false
};
```
