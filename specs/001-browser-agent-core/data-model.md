# Data Model: Browser Agent Core

**Feature**: `001-browser-agent-core`
**Last Updated**: 2025-12-16

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
  /** OpenAI model to use (default: 'gpt-4o') */
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
  model: 'gpt-4o',
  maxTokens: 1000,
  temperature: 0.3      // Low temperature for consistent categorization
};

const DEFAULT_AGENT_CONFIG: AgentConfig = {
  browser: DEFAULT_BROWSER_CONFIG,
  processing: DEFAULT_PROCESSING_CONFIG,
  verbose: false
};
```

## CRO Agent Types

### AnalyzeOptions

Options for the CROAgent.analyze() method.

```typescript
/**
 * Options for CROAgent.analyze() method
 */
interface AnalyzeOptions {
  /** Override browser config (headless, timeout, etc.) */
  browserConfig?: Partial<BrowserConfig>;

  /** Use a custom tool registry */
  registry?: ToolRegistry;

  /** Enable verbose logging */
  verbose?: boolean;

  /** Output format for reports (default: 'console' - no report generated) */
  outputFormat?: 'console' | 'markdown' | 'json' | 'all';

  /** Skip entire post-processing pipeline (default: false) */
  skipPostProcessing?: boolean;

  /** Skip only heuristic rules - keeps other post-processing (default: false) */
  skipHeuristics?: boolean;
}
```

### CROAnalysisResult

Result returned by CROAgent.analyze().

```typescript
/**
 * Result of CRO analysis
 */
interface CROAnalysisResult {
  /** URL that was analyzed */
  url: string;

  /** Whether analysis completed successfully */
  success: boolean;

  /** Insights from tool execution (agent loop) */
  insights: CROInsight[];

  /** Insights from heuristic rules */
  heuristicInsights: CROInsight[];

  /** Detected business type */
  businessType?: BusinessTypeResult;

  /** Generated A/B test hypotheses */
  hypotheses: Hypothesis[];

  /** CRO scores (overall and by category) */
  scores: CROScores;

  /** Generated reports (if requested) */
  report?: {
    markdown?: string;
    json?: string;
  };

  /** Number of agent loop steps executed */
  stepsExecuted: number;

  /** Total analysis time in milliseconds */
  totalTimeMs: number;

  /** Reason for termination */
  terminationReason: string;

  /** Errors encountered during analysis */
  errors: string[];

  /** Page title */
  pageTitle?: string;
}
```

### Post-Processing Options

The `skipPostProcessing` and `skipHeuristics` options control which parts of Phase 18 run:

| Option | Effect |
|--------|--------|
| `skipPostProcessing: true` | Skips ALL of Phase 18 (business detection, heuristics, dedup, hypotheses, reports) |
| `skipHeuristics: true` | Skips ONLY heuristic rules (H001-H010), keeps other post-processing |

**Usage Examples:**

```typescript
// Full analysis (default)
const result = await agent.analyze('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711');

// Skip only heuristics
const result = await agent.analyze('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711', {
  skipHeuristics: true
});

// Skip all post-processing
const result = await agent.analyze('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711', {
  skipPostProcessing: true
});

// Generate markdown report
const result = await agent.analyze('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711', {
  outputFormat: 'markdown'
});
```

---

## Coverage System Types (Phase 19)

### ScanMode

Controls how the agent scans the page for CRO analysis.

```typescript
/**
 * Analysis scan modes
 */
type ScanMode =
  | 'full_page'      // Deterministic: scan every segment (DEFAULT)
  | 'above_fold'     // Quick: only initial viewport
  | 'llm_guided';    // Original: LLM decides scrolling
```

### PageSegment

Represents a vertical segment of the page for coverage tracking.

```typescript
/**
 * Represents a vertical segment of the page
 */
interface PageSegment {
  /** Segment index (0-based) */
  index: number;

  /** Y position where segment starts (px) */
  startY: number;

  /** Y position where segment ends (px) */
  endY: number;

  /** Whether this segment has been scanned */
  scanned: boolean;

  /** Timestamp when segment was scanned */
  scannedAt?: number;

  /** Number of CRO elements found in this segment */
  elementsFound: number;

  /** Number of elements analyzed by tools */
  elementsAnalyzed: number;
}
```

### ElementCoverage

Tracks which elements have been discovered and analyzed.

```typescript
/**
 * Tracks element discovery and analysis
 */
interface ElementCoverage {
  /** Element XPath */
  xpath: string;

  /** CRO classification (cta, form, trust, value_prop, navigation, null) */
  croType: string | null;

  /** Timestamp when element was first discovered */
  firstSeenAt: number;

  /** Segment index where element was first seen */
  firstSeenSegment: number;

  /** List of tool names that analyzed this element */
  analyzedBy: string[];

  /** Number of insights generated for this element */
  insightsGenerated: number;
}
```

### CoverageState

Main coverage tracking state.

```typescript
/**
 * Main coverage tracking state
 */
interface CoverageState {
  /** Total page height in pixels */
  pageHeight: number;

  /** Viewport height in pixels */
  viewportHeight: number;

  /** Array of page segments */
  segments: PageSegment[];

  /** Map of xpath → ElementCoverage */
  elementsDiscovered: Map<string, ElementCoverage>;

  /** Total CRO elements discovered */
  totalCROElements: number;

  /** Number of CRO elements analyzed by at least one tool */
  analyzedCROElements: number;

  /** Number of segments scanned */
  segmentsCovered: number;

  /** Total number of segments */
  segmentsTotal: number;

  /** Coverage percentage (0-100) */
  coveragePercent: number;

  /** List of scroll Y positions visited */
  scrollPositionsVisited: number[];

  /** Current scroll Y position */
  currentScrollY: number;

  /** Maximum scroll Y position */
  maxScrollY: number;
}
```

### CoverageConfig

Configuration for coverage tracking.

```typescript
/**
 * Coverage configuration
 */
interface CoverageConfig {
  /** Minimum coverage percent required to call 'done' (default: 100) */
  minCoveragePercent: number;

  /** Overlap between segments in pixels (default: 100) */
  segmentOverlapPx: number;

  /** Require all segments to be scanned (default: true) */
  requireAllSegments: boolean;

  /** Require all elements to be analyzed (default: true) */
  requireElementAnalysis: boolean;
}
```

### Default Coverage Configuration

```typescript
const DEFAULT_COVERAGE_CONFIG: CoverageConfig = {
  minCoveragePercent: 100,
  segmentOverlapPx: 100,
  requireAllSegments: true,
  requireElementAnalysis: true,
};
```

### Updated AnalyzeOptions (Phase 19)

```typescript
/**
 * Options for CROAgent.analyze() method (Phase 19 additions)
 */
interface AnalyzeOptions {
  /** Override browser config (headless, timeout, etc.) */
  browserConfig?: Partial<BrowserConfig>;

  /** Use a custom tool registry */
  registry?: ToolRegistry;

  /** Enable verbose logging */
  verbose?: boolean;

  /** Output format for reports (default: 'console' - no report generated) */
  outputFormat?: 'console' | 'markdown' | 'json' | 'all';

  /** Skip entire post-processing pipeline (default: false) */
  skipPostProcessing?: boolean;

  /** Skip only heuristic rules - keeps other post-processing (default: false) */
  skipHeuristics?: boolean;

  // ─── Phase 19 Additions ─────────────────────────────────────────

  /** Scan mode for page coverage (default: 'full_page') */
  scanMode?: ScanMode;

  /** Coverage configuration (only used when scanMode is 'full_page') */
  coverageConfig?: Partial<CoverageConfig>;
}
```

### Usage Examples (Phase 19)

```typescript
// Full page scan (default) - guarantees 100% coverage
const result = await agent.analyze('https://example.com');

// Quick above-fold scan only
const result = await agent.analyze('https://example.com', {
  scanMode: 'above_fold'
});

// Original LLM-guided behavior
const result = await agent.analyze('https://example.com', {
  scanMode: 'llm_guided'
});

// Custom coverage threshold (80%)
const result = await agent.analyze('https://example.com', {
  scanMode: 'full_page',
  coverageConfig: {
    minCoveragePercent: 80
  }
});

// Combine options
const result = await agent.analyze('https://example.com', {
  scanMode: 'full_page',
  coverageConfig: { minCoveragePercent: 95 },
  outputFormat: 'markdown',
  verbose: true
});
```
