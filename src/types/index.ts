/**
 * Browser Agent Core Types
 * TypeScript interfaces and types for the CRO browser automation agent.
 */

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

// ============================================================================
// Coverage Types (Phase 19)
// ============================================================================

/**
 * Analysis scan modes for CRO agent
 * - full_page: Deterministic scan of every segment (100% coverage)
 * - above_fold: Quick scan of initial viewport only
 * - llm_guided: Original behavior where LLM decides scrolling
 */
export type { ScanMode, CoverageConfig } from '../models/coverage.js';
export { DEFAULT_COVERAGE_CONFIG } from '../models/coverage.js';

// ============================================================================
// Screenshot Mode Types (Phase 25e)
// ============================================================================

/**
 * Screenshot capture modes for vision analysis (T495)
 * - viewport: Capture viewport-by-viewport as agent scrolls (original mode)
 * - tiled: Capture full page as overlapping tiles (consistent heights)
 * - hybrid: Viewport for first 2 captures + tiled for the rest
 */
export type ScreenshotMode = 'viewport' | 'tiled' | 'hybrid';

/**
 * Configuration for Phase 25 enhanced extraction features (T495)
 */
export interface Phase25Config {
  /** Screenshot capture mode (default: viewport) */
  screenshotMode: ScreenshotMode;
  /** Maximum height of each tile in pixels - tiled mode (default: 1800) */
  maxTileHeight: number;
  /** Overlap between tiles in pixels - tiled mode (default: 100) */
  tileOverlapPx: number;
  /** Maximum number of tiles to capture - tiled mode (default: 5) */
  maxTiles: number;
  /** Annotate screenshots with fold line (default: true) */
  annotateFoldLine: boolean;
  /** Viewport height for fold line annotation (default: 800) */
  viewportHeight: number;
}

/**
 * Default Phase 25 configuration
 */
export const DEFAULT_PHASE25_CONFIG: Phase25Config = {
  screenshotMode: 'viewport',
  maxTileHeight: 1800,
  tileOverlapPx: 100,
  maxTiles: 5,
  annotateFoldLine: true,
  viewportHeight: 800,
};

// ============================================================================
// Evidence Schema Types (Phase 25g - T509)
// ============================================================================

export {
  type EvidencePackage,
  type EvidenceElement,
  type EvidenceScreenshot,
  type ExtractionMetrics,
  createEmptyMetrics,
  generateRunId,
  generateViewportRef,
  generateScreenshotId,
} from './evidence-schema.js';

// ============================================================================
// Viewport Validator Signals (Phase 25i - T535)
// ============================================================================

/**
 * Signals collected during viewport capture for cheap validation.
 * These signals enable 0-LLM-call validation to detect extraction issues.
 *
 * @example
 * ```typescript
 * const signals: ViewportValidatorSignals = {
 *   viewportIndex: 0,
 *   blankImageCount: 0,
 *   placeholderImageCount: 1,
 *   lazyPendingCount: 0,
 *   spinnerDetected: false,
 *   skeletonDetected: false,
 *   textPlaceholders: [],
 *   overlayStillVisible: false,
 *   mediaReadinessTimedOut: false,
 * };
 * ```
 */
export interface ViewportValidatorSignals {
  /** Viewport index (0-based) */
  viewportIndex: number;

  /** Count of images with blank/white src or data URI placeholders */
  blankImageCount: number;

  /** Count of images using placeholder patterns (e.g., loading.gif, placeholder.png) */
  placeholderImageCount: number;

  /** Count of lazy-load elements still pending (data-src not yet swapped to src) */
  lazyPendingCount: number;

  /** Whether a loading spinner was detected in viewport */
  spinnerDetected: boolean;

  /** Whether skeleton/shimmer loading UI was detected */
  skeletonDetected: boolean;

  /** Text content matching placeholder patterns (e.g., "Loading...", "---") */
  textPlaceholders: string[];

  /** Whether cookie/promo overlay is still visible after suppression */
  overlayStillVisible: boolean;

  /** Whether media readiness check timed out */
  mediaReadinessTimedOut: boolean;

  /** Total images in viewport */
  totalImages: number;

  /** Images that loaded successfully */
  loadedImages: number;

  /** Images that failed to load (broken) */
  failedImages: number;

  /** Scroll position was verified to match target */
  scrollPositionVerified: boolean;
}

/**
 * Default validator signals (clean state)
 */
export const createEmptyValidatorSignals = (viewportIndex: number): ViewportValidatorSignals => ({
  viewportIndex,
  blankImageCount: 0,
  placeholderImageCount: 0,
  lazyPendingCount: 0,
  spinnerDetected: false,
  skeletonDetected: false,
  textPlaceholders: [],
  overlayStillVisible: false,
  mediaReadinessTimedOut: false,
  totalImages: 0,
  loadedImages: 0,
  failedImages: 0,
  scrollPositionVerified: true,
});

// ============================================================================
// Phase 29: AX Tree Types
// ============================================================================

/**
 * Configuration for accessibility tree capture and serialization.
 */
export interface AXTreeSerializerConfig {
  /** Token budget for serialized output (default: 500) */
  maxTokens: number;
  /** Use Playwright's interesting-only filter (default: true) */
  interestingOnly: boolean;
  /** State properties to include in output */
  includeStates: string[];
  /** Spaces per indentation level (default: 2) */
  indentSize: number;
}

/** Default AX tree serializer configuration */
export const DEFAULT_AX_TREE_CONFIG: AXTreeSerializerConfig = {
  maxTokens: 500,
  interestingOnly: true,
  includeStates: [
    'disabled', 'checked', 'expanded', 'required',
    'selected', 'invalid', 'pressed',
  ],
  indentSize: 2,
};
