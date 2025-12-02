/**
 * Browser Agent Core Types
 * All TypeScript interfaces and types for the browser automation agent.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Represents an extracted heading element from a web page.
 */
export interface Heading {
  /** Heading level (1-6 corresponding to h1-h6) */
  level: 1 | 2 | 3 | 4 | 5 | 6;

  /** Text content of the heading, decoded and trimmed */
  text: string;

  /** Zero-based index representing document order */
  index: number;
}

/**
 * Result of heading extraction from a single page.
 */
export interface ExtractionResult {
  /** Array of all extracted headings in document order */
  headings: Heading[];

  /** Total number of headings found */
  totalCount: number;

  /** Count of headings by level (e.g., { 1: 2, 2: 5, 3: 3 }) */
  countByLevel: Record<number, number>;
}

// ============================================================================
// Browser Types
// ============================================================================

/**
 * Wait strategy for page loading.
 * - 'load': Wait for load event (balanced, default)
 * - 'domcontentloaded': Wait for DOM ready (fastest)
 * - 'networkidle': Wait for no network activity (most complete, may timeout)
 */
export type WaitUntilStrategy = 'load' | 'domcontentloaded' | 'networkidle';

/**
 * Configuration options for browser initialization.
 */
export interface BrowserConfig {
  /** Run browser in headless mode (default: false per CR-001) */
  headless: boolean;

  /** Navigation timeout in milliseconds (default: 60000 per CR-002) */
  timeout: number;

  /** Browser type to use */
  browserType: 'chromium' | 'firefox' | 'webkit';

  /** Wait strategy for page loading (default: 'load') */
  waitUntil: WaitUntilStrategy;

  /** Post-load wait for JS rendering in ms (default: 5000). Set to 0 to disable. */
  postLoadWait: number;

  /** Auto-dismiss cookie consent popups (default: true per CR-007) */
  dismissCookieConsent: boolean;
}

/**
 * Cookie consent management pattern for known CMPs.
 */
export interface CookieConsentPattern {
  /** Unique identifier (e.g., "onetrust", "cookiebot") */
  id: string;

  /** Selector to detect CMP presence */
  detectSelector: string;

  /** Selector for accept button */
  acceptSelector: string;

  /** Optional iframe src pattern if CMP uses iframe */
  frameHint?: string;
}

/**
 * Result of cookie consent dismissal attempt.
 */
export interface CookieConsentResult {
  /** Whether cookie popup was dismissed */
  dismissed: boolean;

  /** Method used: 'cmp' (known pattern), 'heuristic' (text-based), or 'none' (no popup found) */
  mode: 'cmp' | 'heuristic' | 'none';

  /** CMP identifier if known pattern was used */
  cmpId?: string;

  /** Button text if found via heuristic */
  buttonText?: string;
}

/**
 * Result of a page load operation.
 */
export interface PageLoadResult {
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

  /** Cookie consent dismissal result if attempted */
  cookieConsent?: CookieConsentResult;
}

// ============================================================================
// LangChain Types
// ============================================================================

/**
 * Configuration for LangChain/OpenAI processing.
 */
export interface ProcessingConfig {
  /** OpenAI model to use (default: 'gpt-4o-mini' per CR-003) */
  model: string;

  /** Maximum tokens for response */
  maxTokens: number;

  /** Temperature for generation (0-1) */
  temperature: number;
}

/**
 * Result of LangChain processing of extracted data.
 */
export interface ProcessingResult {
  /** Human-readable summary of the page structure */
  summary: string;

  /** Identified topic categories from headings */
  categories: string[];

  /** Key insights about the content */
  insights: string[];

  /** Raw LLM response for debugging */
  rawResponse?: string;
}

// ============================================================================
// Orchestrator Types
// ============================================================================

/**
 * Main configuration for the browser agent.
 */
export interface AgentConfig {
  /** Browser configuration */
  browser: BrowserConfig;

  /** LangChain processing configuration */
  processing: ProcessingConfig;

  /** Enable verbose logging */
  verbose: boolean;
}

/**
 * Complete result from processing a single URL.
 */
export interface AgentResult {
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

/**
 * Result from processing multiple URLs sequentially.
 */
export interface BatchResult {
  /** Results for each URL in order */
  results: AgentResult[];

  /** Number of successful URL processes */
  successCount: number;

  /** Number of failed URL processes */
  failureCount: number;

  /** Total time for all URLs in milliseconds */
  totalTimeMs: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Log levels for structured logging.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured log entry for machine-parseable output.
 */
export interface LogEntry {
  /** ISO timestamp */
  timestamp: string;

  /** Log level */
  level: LogLevel;

  /** Log message */
  message: string;

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Result of URL validation.
 */
export interface ValidationResult {
  /** Whether the URL is valid */
  valid: boolean;

  /** Normalized URL if valid */
  normalizedUrl?: string;

  /** Error message if invalid */
  error?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid heading level.
 */
export function isHeadingLevel(value: number): value is 1 | 2 | 3 | 4 | 5 | 6 {
  return value >= 1 && value <= 6 && Number.isInteger(value);
}

/**
 * Type guard to check if an AgentResult represents a successful operation.
 */
export function isSuccessfulResult(
  result: AgentResult
): result is AgentResult & {
  pageLoad: PageLoadResult & { success: true };
  extraction: ExtractionResult;
  processing: ProcessingResult;
} {
  return result.success && result.extraction !== null && result.processing !== null;
}

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_BROWSER_CONFIG: BrowserConfig = {
  headless: false, // CR-001: Visible mode
  timeout: 60000, // CR-002: 60 second timeout
  browserType: 'chromium',
  waitUntil: 'load', // Balanced default - works for most sites
  postLoadWait: 5000, // Wait up to 5s for JS to render dynamic content
  dismissCookieConsent: true, // CR-007: Auto-dismiss cookie popups by default
};

export const DEFAULT_PROCESSING_CONFIG: ProcessingConfig = {
  model: 'gpt-4o-mini', // CR-003: GPT-4o-mini
  maxTokens: 1000,
  temperature: 0.3, // Low temperature for consistent categorization
};

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  browser: DEFAULT_BROWSER_CONFIG,
  processing: DEFAULT_PROCESSING_CONFIG,
  verbose: false,
};
