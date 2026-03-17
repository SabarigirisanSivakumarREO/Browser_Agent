/**
 * CRO Agent
 *
 * Phase 16 (T081): Main CRO analysis agent with observe→reason→act loop.
 * Phase 18e (T117): Added post-processing pipeline integration.
 * Phase 19c (T135-T138): Added full-page coverage scan mode.
 * Phase 21d (T315-T316): Added GPT-4o Vision analysis integration.
 * Orchestrates browser automation, DOM extraction, LLM interaction, and tool execution.
 */

import { ChatOpenAI } from '@langchain/openai';
import type { Page } from 'playwright';
import sharp from 'sharp';
import type {
  CROAgentOptions,
  CROInsight,
  PageState,
  DOMTree,
  DOMNode,
  StepRecord,
  BusinessTypeResult,
  Hypothesis,
  ScanMode,
  CoverageConfig,
  PageType,
  ViewportSnapshot,
} from '../models/index.js';
import { DEFAULT_CRO_OPTIONS, parseAgentOutput, DEFAULT_COVERAGE_CONFIG } from '../models/index.js';
import type { CaptureViewportResult } from './tools/cro/capture-viewport-tool.js';
import { BrowserManager, PageLoader } from '../browser/index.js';
import {
  DOMExtractor,
  DOMMerger,
  DOMSerializer,
  mapElementsToScreenshot,
  filterVisibleElements,
} from '../browser/dom/index.js';
import { ToolRegistry, ToolExecutor } from './tools/index.js';
import { PromptBuilder } from './prompt-builder.js';
import { MessageManager } from './message-manager.js';
import { StateManager } from './state-manager.js';
import { CoverageTracker } from './coverage-tracker.js';
import { createCRORegistry } from './tools/create-cro-registry.js';
import { createLogger } from '../utils/index.js';
import type { DEFAULT_BROWSER_CONFIG, ScreenshotMode } from '../types/index.js';
import { DEFAULT_PHASE25_CONFIG } from '../types/index.js';

// Post-processing imports
import {
  BusinessTypeDetector,
  // Vision analysis imports
  isPageTypeSupported,
  type CROVisionAnalysisResult,
  type CROVisionAnalyzerConfig,
  // Analysis orchestrator for category-based evaluation
  createAnalysisOrchestrator,
  type AnalysisResult,
  // Phase 23: LLM input capture types
  type CapturedCategoryInputs,
  // Phase 24: Hybrid page type detection
  createHybridPageTypeDetector,
  type HybridDetectionConfig,
  type HybridDetectionResult,
  // Phase 27A: Centralized model defaults
  MODEL_DEFAULTS,
} from '../heuristics/index.js';

// Phase 25h (T521): runId generation for deterministic ordering
import { generateRunId } from '../types/evidence-schema.js';

// Phase 25h (T523-T524): UI noise suppression
import { suppressUINoiseElements, refreshSuppression } from '../browser/cleanup/index.js';

// Phase 25h (T525-T526): Media readiness checks
import { waitForMediaReadiness } from '../browser/media/index.js';

// Phase 25i (T536-T542): Cheap validator and LLM QA
import {
  runCheapValidator,
  shouldRunLLMQA,
  runLLMQA,
  collectViewportSignals,
  type ViewportSummary,
} from '../validation/index.js';
import type { ViewportValidatorSignals } from '../types/index.js';

// NOTE: Vision Agent module removed in CR-001-D
// Use unified collection + orchestrator mode instead
import {
  InsightDeduplicator,
  InsightPrioritizer,
  HypothesisGenerator,
  MarkdownReporter,
  JSONExporter,
  // Phase 25e: Tiled screenshot mode
  captureTiledScreenshots,
  type TiledScreenshotConfig,
} from '../output/index.js';
import { ScoreCalculator, type CROScores } from './score-calculator.js';

/**
 * ANSI color codes for console output
 */
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

/** Helper functions for colored output */
const c = {
  error: (text: string) => `${colors.red}${text}${colors.reset}`,
  warn: (text: string) => `${colors.yellow}${text}${colors.reset}`,
  success: (text: string) => `${colors.green}${text}${colors.reset}`,
  info: (text: string) => `${colors.cyan}${text}${colors.reset}`,
  bold: (text: string) => `${colors.bold}${text}${colors.reset}`,
  dim: (text: string) => `${colors.dim}${text}${colors.reset}`,
  severity: (severity: string) => {
    switch (severity) {
      case 'critical': return `${colors.bgRed}${colors.white}${colors.bold} ${severity.toUpperCase()} ${colors.reset}`;
      case 'high': return `${colors.red}${colors.bold}[${severity}]${colors.reset}`;
      case 'medium': return `${colors.yellow}[${severity}]${colors.reset}`;
      case 'low': return `${colors.dim}[${severity}]${colors.reset}`;
      default: return `[${severity}]`;
    }
  },
};

/**
 * Result of CRO analysis
 * Phase 18e (T117a): Extended with post-processing fields
 * Phase 21d (T315): Added vision analysis result
 * Phase 23 (T403): Added llmInputs for debugging
 * Phase 25h (T521): Added runId for deterministic tracking
 */
export interface CROAnalysisResult {
  /** URL that was analyzed */
  url: string;
  /** Unique run identifier (timestamp + hash) for reproducibility */
  runId: string;
  /** Whether analysis completed successfully */
  success: boolean;
  /** Insights from tool execution (agent loop) */
  insights: CROInsight[];
  /** Insights from heuristic rules */
  heuristicInsights: CROInsight[];
  /** Insights from vision analysis (Phase 21d) */
  visionInsights: CROInsight[];
  /** Detected business type */
  businessType?: BusinessTypeResult;
  /** Detected page type (Phase 21d) */
  pageType?: PageType;
  /** Vision analysis result */
  visionAnalysis?: CROVisionAnalysisResult;
  /** Unified analysis result from orchestrator */
  unifiedAnalysisResult?: AnalysisResult;
  /** Phase 21j: Viewport snapshots from unified collection phase */
  snapshots?: ViewportSnapshot[];
  /** Phase 23: Captured LLM inputs for debugging/auditing */
  llmInputs?: CapturedCategoryInputs[];
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

/** Output format options */
export type OutputFormat = 'console' | 'markdown' | 'json' | 'all';

/**
 * Options for CROAgent.analyze() method
 * Phase 19c: Added scanMode and coverageConfig
 * Phase 21d (T316): Added vision analysis options
 * CR-001-D: Simplified vision API - consolidated to single `vision` flag
 */
export interface AnalyzeOptions {
  /** Override browser config (headless, timeout, etc.) */
  browserConfig?: Partial<typeof DEFAULT_BROWSER_CONFIG>;
  /** Use a custom tool registry */
  registry?: ToolRegistry;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Output format for reports (default: console - no report generated) */
  outputFormat?: OutputFormat;
  /** Skip post-processing pipeline (default: false) */
  skipPostProcessing?: boolean;
  // NOTE: skipHeuristics option removed in CR-002 - rule-based heuristics superseded by vision
  /** Scan mode: 'full_page' (default), 'above_fold', or 'llm_guided' */
  scanMode?: ScanMode;
  /** Coverage configuration for full_page mode */
  coverageConfig?: Partial<CoverageConfig>;

  // ═══════════════════════════════════════════════════════════════════════════════
  // Vision Analysis Options (CR-001-D: Simplified API)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Enable unified vision analysis (default: false)
   * When true, uses collection + orchestrator for comprehensive analysis:
   * - Captures DOM + screenshots at each viewport
   * - Evaluates ALL heuristics via category-based analysis
   * - Enforces full-page coverage (scrolls entire page)
   */
  vision?: boolean;

  /** Vision model to use (default: MODEL_DEFAULTS.analysis = 'gpt-4o') */
  visionModel?: 'gpt-4o' | 'gpt-4o-mini';

  /** Maximum steps for vision collection phase (default: 20) */
  visionMaxSteps?: number;

  /** Filter analysis to specific heuristic categories */
  heuristicCategories?: string[];

  // ═══════════════════════════════════════════════════════════════════════════════
  // Phase 24: Hybrid Page Type Detection
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Configuration for hybrid page type detection
   * Uses three-tier detection: Playwright (primary), URL heuristics (secondary), LLM (fallback)
   */
  hybridDetectionConfig?: Partial<HybridDetectionConfig>;

  // ═══════════════════════════════════════════════════════════════════════════════
  // Phase 25e: Screenshot Mode Options
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Screenshot capture mode for vision analysis (default: 'viewport')
   * - viewport: Capture viewport-by-viewport as agent scrolls (original mode)
   * - tiled: Capture full page as overlapping tiles (consistent heights)
   * - hybrid: Viewport for first 2 captures + tiled for the rest
   */
  screenshotMode?: ScreenshotMode;

  /**
   * Tiled screenshot configuration (for 'tiled' and 'hybrid' modes)
   */
  tiledConfig?: Partial<TiledScreenshotConfig>;

  // ═══════════════════════════════════════════════════════════════════════════════
  // Phase 25f: Deterministic Collection Options
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Use LLM-guided collection instead of deterministic (default: false)
   * When false (default), collection uses a simple scroll + capture loop with no LLM calls.
   * When true, uses the original LLM-driven collection where the agent decides scrolling.
   * Deterministic mode is faster and cheaper (0 LLM calls during collection).
   */
  llmGuidedCollection?: boolean;

  // ═══════════════════════════════════════════════════════════════════════════════
  // Phase 25i: Collection QA Options
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Skip LLM QA validation even if cheap validator flags issues (default: false)
   * When false (default), collection runs cheap validator and escalates to LLM QA if needed.
   * When true, skips LLM QA entirely (faster, cheaper, but may miss quality issues).
   */
  skipCollectionQA?: boolean;

  // ═══════════════════════════════════════════════════════════════════════════════
  // Phase 26: Parallel Analysis Options
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Run category analyses in parallel (default: true)
   * When false, runs sequentially (opt-in via --sequential-analysis CLI flag).
   */
  parallelAnalysis?: boolean;

  /**
   * Max concurrent category analyses when parallel (default: 5)
   */
  maxConcurrentCategories?: number;

  /**
   * Enable category batching — multiple categories per LLM call (default: false)
   * Saves tokens but may reduce quality. Opt-in via --category-batching.
   */
  categoryBatching?: boolean;

  /**
   * Enable viewport filtering — send only relevant viewports per category (default: false)
   * Saves tokens but may miss context. Opt-in via --viewport-filtering.
   */
  enableViewportFiltering?: boolean;

  // ═══════════════════════════════════════════════════════════════════════════════
  // Deprecated Options (kept for backward compatibility)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * @deprecated Use `vision: true` instead. Will be removed in next major version.
   * Enable vision analysis for supported page types
   */
  useVisionAnalysis?: boolean;

  /**
   * @deprecated Use `vision: true` instead. Will be removed in next major version.
   * Enable Vision Agent mode with DOM + Vision parallel context
   */
  visionAgentMode?: boolean;

  /**
   * @deprecated Use `visionMaxSteps` instead. Will be removed in next major version.
   * Maximum steps for Vision Agent
   */
  visionAgentMaxSteps?: number;

  /**
   * @deprecated Use `vision: true` instead. Will be removed in next major version.
   * Enable unified collection→analysis mode
   */
  enableUnifiedMode?: boolean;

  /**
   * @deprecated No longer used. Will be removed in next major version.
   * Enable vision capture during collection
   */
  enableVision?: boolean;

  /**
   * @deprecated No longer used. Will be removed in next major version.
   * Custom vision analyzer config
   */
  visionConfig?: Partial<CROVisionAnalyzerConfig>;
}

/**
 * Normalize vision options for backward compatibility (CR-001-D)
 * Maps deprecated flags to the new simplified `vision` flag
 */
function normalizeVisionOptions(options?: AnalyzeOptions): {
  visionEnabled: boolean;
  visionModel: 'gpt-4o' | 'gpt-4o-mini';
  visionMaxSteps: number;
} {
  // Check new flag first, then deprecated flags
  const visionEnabled =
    options?.vision ??
    options?.visionAgentMode ??
    options?.enableUnifiedMode ??
    (options?.useVisionAnalysis && options?.visionAgentMode) ??
    false;

  const visionModel = options?.visionModel ?? MODEL_DEFAULTS.analysis;

  const visionMaxSteps =
    options?.visionMaxSteps ??
    options?.visionAgentMaxSteps ??
    20;

  return { visionEnabled, visionModel, visionMaxSteps };
}

/**
 * Calculate required steps for full page coverage (T138)
 * Formula: segments + analysisToolCount(6) + synthesisSteps(2)
 */
function calculateRequiredSteps(pageHeight: number, viewportHeight: number, config: CoverageConfig): number {
  const effectiveHeight = Math.max(
    viewportHeight - config.segmentOverlapPx,
    viewportHeight / 2
  );
  const segmentCount = Math.ceil(pageHeight / effectiveHeight);
  const analysisToolCount = 6; // analyze_ctas, analyze_forms, detect_trust, assess_value, check_nav, find_friction
  const synthesisSteps = 2;    // record_insight, done
  return segmentCount + analysisToolCount + synthesisSteps;
}

/**
 * Phase 25a (T473): Calculate max collection steps based on page dimensions
 *
 * Formula:
 * - scrollStep = viewportHeight - overlapPx (effective scroll per step)
 * - viewportsNeeded = ceil(pageHeight / scrollStep)
 * - stepsNeeded = (viewportsNeeded * 2) + 1 (capture + scroll for each viewport, plus final capture)
 * - buffer = ceil(stepsNeeded * 0.2) (20% buffer for navigation/retry)
 * - result = max(5, stepsNeeded + buffer) (minimum 5 steps enforced)
 *
 * @param pageHeight - Total page height in pixels
 * @param viewportHeight - Viewport height in pixels
 * @param overlapPx - Overlap between viewports (default: 120px)
 * @returns Calculated max collection steps
 */
export function calculateMaxCollectionSteps(
  pageHeight: number,
  viewportHeight: number,
  overlapPx: number = 120
): number {
  // Handle edge cases
  if (pageHeight <= 0 || viewportHeight <= 0) {
    return 5; // Minimum steps
  }

  // Calculate effective scroll step (viewport minus overlap)
  const scrollStep = Math.max(viewportHeight - overlapPx, viewportHeight / 2);

  // Calculate number of viewports needed to cover the page
  const viewportsNeeded = Math.ceil(pageHeight / scrollStep);

  // Each viewport needs: 1 capture + 1 scroll, plus 1 final capture/done
  const stepsNeeded = (viewportsNeeded * 2) + 1;

  // Add 20% buffer for retries, navigation delays, etc.
  const buffer = Math.ceil(stepsNeeded * 0.2);

  // Return with minimum of 5 steps enforced
  return Math.max(5, stepsNeeded + buffer);
}

/**
 * CROAgent - Autonomous CRO analysis agent
 *
 * Implements observe→reason→act loop:
 * 1. OBSERVE: Extract DOM tree and build page state
 * 2. REASON: Send state to LLM, get analysis and next action
 * 3. ACT: Execute tool, collect insights
 * 4. REPEAT until done or max steps reached
 */
export class CROAgent {
  private readonly options: CROAgentOptions;
  private readonly logger;
  private browserManager?: BrowserManager;

  /**
   * Create a CROAgent with optional custom options
   * @param options - Partial options to override defaults
   */
  constructor(options?: Partial<CROAgentOptions>) {
    this.options = { ...DEFAULT_CRO_OPTIONS, ...options };
    this.logger = createLogger('CROAgent', false);
  }

  /**
   * Analyze a URL for CRO issues
   *
   * @param url - URL to analyze
   * @param analyzeOptions - Optional analysis configuration
   * @returns CRO analysis result with insights
   */
  async analyze(url: string, analyzeOptions?: AnalyzeOptions): Promise<CROAnalysisResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const verbose = analyzeOptions?.verbose ?? false;

    // Phase 25h (T521): Generate deterministic runId at start of analysis
    // Uses timestamp + URL hash for reproducibility with same inputs
    const runId = generateRunId(new Date(startTime), url);

    if (verbose) {
      this.logger.setVerbose(true);
    }

    this.logger.info('Starting CRO analysis', { url, runId, options: this.options });

    try {
      // ═══════════════════════════════════════════════════════════════════════════
      // PHASE 3: Browser Initialization & Page Loading
      // ═══════════════════════════════════════════════════════════════════════════
      console.log('\n' + '═'.repeat(80));
      console.log('  PHASE 3: BROWSER INITIALIZATION & PAGE LOADING');
      console.log('═'.repeat(80));
      console.log(`  → Run ID: ${runId}`);
      console.log(`  → Launching Playwright browser (chromium)`);
      console.log(`  → Target URL: ${url}`);

      const { page, pageTitle } = await this.initializeBrowser(url, analyzeOptions);

      console.log(`  ${c.success('✓')} Browser launched successfully`);
      console.log(`  ${c.success('✓')} Page loaded: "${pageTitle}"`);
      console.log(`  ${c.success('✓')} Viewport: ${page.viewportSize()?.width}x${page.viewportSize()?.height}`);
      console.log('  OUTPUT → Page object, pageTitle passed to Phase 14/19');
      console.log('═'.repeat(80) + '\n');

      // ═══════════════════════════════════════════════════════════════════════════
      // PHASE 19: Coverage Tracking Setup (T135, T138)
      // ═══════════════════════════════════════════════════════════════════════════
      const scanMode: ScanMode = analyzeOptions?.scanMode ?? 'full_page';
      const coverageConfig: CoverageConfig = {
        ...DEFAULT_COVERAGE_CONFIG,
        ...analyzeOptions?.coverageConfig,
      };

      // Get page dimensions for coverage tracking
      const pageDimensions = await page.evaluate(`(() => ({
        pageHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
      }))()`);
      const { pageHeight, viewportHeight } = pageDimensions as { pageHeight: number; viewportHeight: number };

      // Initialize coverage tracker
      let coverageTracker: CoverageTracker | undefined;
      if (scanMode === 'full_page') {
        console.log('═'.repeat(80));
        console.log('  PHASE 19: COVERAGE TRACKING SETUP (full_page mode)');
        console.log('═'.repeat(80));
        coverageTracker = new CoverageTracker(coverageConfig);
        coverageTracker.initialize(pageHeight, viewportHeight);
        const segments = coverageTracker.getState().segmentsTotal;
        console.log(`  ${c.success('✓')} Page height: ${pageHeight}px, Viewport: ${viewportHeight}px`);
        console.log(`  ${c.success('✓')} Segments to scan: ${segments}`);
        console.log(`  ${c.success('✓')} Target coverage: ${coverageConfig.minCoveragePercent}%`);
        console.log('═'.repeat(80) + '\n');
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // PHASE 14: DOM Extraction & CRO Classification
      // ═══════════════════════════════════════════════════════════════════════════
      console.log('═'.repeat(80));
      console.log('  PHASE 14: DOM EXTRACTION & CRO CLASSIFICATION');
      console.log('═'.repeat(80));
      console.log('  → Injecting DOM tree extraction script');
      console.log('  → Classifying elements (cta, form, trust, value_prop, navigation)');

      const domExtractor = new DOMExtractor();
      let domTree: DOMTree;

      // Full-page scan: extract DOM from all segments and merge (T135)
      if (scanMode === 'full_page' && coverageTracker) {
        console.log(`  → Full-page scan mode: extracting DOM from all segments...`);
        const domMerger = new DOMMerger();
        const snapshots: DOMTree[] = [];

        // Scroll to top first
        await page.evaluate('window.scrollTo(0, 0)');
        await this.sleep(200);

        // Extract DOM at each segment
        const segments = coverageTracker.getState().segments;
        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i]!;
          // Scroll to segment start
          await page.evaluate(`window.scrollTo(0, ${segment.startY})`);
          await this.sleep(300); // Wait for content to render

          // Extract DOM
          const snapshot = await domExtractor.extract(page);
          snapshots.push(snapshot);

          // Mark segment as scanned
          coverageTracker.markSegmentScanned(segment.startY, snapshot.croElementCount);
          console.log(`    [${i + 1}/${segments.length}] Segment ${segment.startY}-${segment.endY}px: ${snapshot.croElementCount} CRO elements`);
        }

        // Merge all snapshots
        domTree = domMerger.merge(snapshots);
        console.log(`  ${c.success('✓')} Merged ${snapshots.length} segments into complete DOM`);

        // Scroll back to top for analysis
        await page.evaluate('window.scrollTo(0, 0)');
      } else {
        // Standard single extraction (above_fold or llm_guided)
        domTree = await domExtractor.extract(page);
        if (scanMode === 'above_fold' && coverageTracker) {
          coverageTracker.markSegmentScanned(0, domTree.croElementCount);
        }
      }

      console.log(`  ${c.success('✓')} Total nodes extracted: ${domTree.totalNodeCount}`);
      console.log(`  ${c.success('✓')} Interactive elements: ${domTree.interactiveCount}`);
      console.log(`  ${c.success('✓')} CRO-classified elements: ${domTree.croElementCount}`);
      if (coverageTracker) {
        console.log(`  ${c.success('✓')} Coverage: ${coverageTracker.getCoveragePercent()}%`);
      }
      console.log('  OUTPUT → DOMTree with classified nodes passed to Phase 15, 16');
      console.log('═'.repeat(80) + '\n');

      // Log extracted DOM information
      this.logExtractedElements(domTree, verbose);

      // ═══════════════════════════════════════════════════════════════════════════
      // PHASE 21: VISION ANALYSIS (CR-001-D: Unified mode only)
      // ═══════════════════════════════════════════════════════════════════════════
      const { visionEnabled, visionModel, visionMaxSteps } = normalizeVisionOptions(analyzeOptions);
      let detectedPageType: PageType | undefined;
      let visionAnalysis: CROVisionAnalysisResult | undefined;
      let visionInsights: CROInsight[] = [];
      // CR-001-C: Flag to skip agent loop when unified analysis completes
      let unifiedAnalysisComplete = false;
      // CR-001-C: Store unified analysis result for report metadata
      let unifiedAnalysisResult: AnalysisResult | undefined;
      // Phase 21j: Store collected snapshots for return
      let collectedViewportSnapshots: ViewportSnapshot[] = [];

      if (visionEnabled) {
        console.log('═'.repeat(80));
        console.log('  PHASE 21: VISION ANALYSIS (UNIFIED MODE)');
        console.log('═'.repeat(80));

        // 21a. Detect page type (Phase 24: Hybrid detection)
        console.log('\n  ┌─ PHASE 24/21a: Hybrid Page Type Detection ────────────────────');
        const hybridDetector = createHybridPageTypeDetector({
          ...analyzeOptions?.hybridDetectionConfig,
          llmModel: normalizeVisionOptions(analyzeOptions).visionModel,
        });
        const viewportSize = page.viewportSize() || { width: 1280, height: 720 };
        const pageTypeState: PageState = {
          url,
          title: pageTitle,
          domTree,
          viewport: {
            width: viewportSize.width,
            height: viewportSize.height,
            deviceScaleFactor: 1,
            isMobile: false,
          },
          scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 0 },
          timestamp: Date.now(),
        };
        // Phase 24: Use hybrid detector with Playwright page access
        const hybridResult: HybridDetectionResult = await hybridDetector.detect(page, pageTypeState);
        detectedPageType = hybridResult.pageType;
        const tierLabel = hybridResult.fromCache ? 'cache' : hybridResult.tier;
        console.log(`  │ ${c.success('✓')} Detected: ${hybridResult.pageType} (confidence: ${(hybridResult.confidence * 100).toFixed(0)}%, tier: ${tierLabel})`);
        console.log(`  │ → Signals: ${hybridResult.signals.slice(0, 3).join(', ')}${hybridResult.signals.length > 3 ? '...' : ''}`);
        if (hybridResult.playwrightResult?.signals) {
          const signals = hybridResult.playwrightResult.signals;
          const positives: string[] = [];
          if (signals.addToCart) positives.push('Add to Cart CTA');
          if (signals.schemaProduct) positives.push('JSON-LD Product');
          if (signals.priceFound) positives.push('Price found');
          if (signals.variants) positives.push(`${signals.variantCount ?? 0} variants`);
          if (positives.length > 0) {
            console.log(`  │ → Playwright signals: ${positives.join(', ')}`);
          }
        }
        console.log(`  │ → Detection time: ${hybridResult.detectionTimeMs}ms`);
        console.log(`  └${'─'.repeat(60)}`);

        // 21b. Check if vision analysis is supported for this page type
        if (isPageTypeSupported(detectedPageType)) {
          const viewport = {
            width: viewportSize.width,
            height: viewportSize.height,
            deviceScaleFactor: 1,
            isMobile: false,
          };

          // CR-001-D: Unified collection + analysis flow (single code path)
          // Phase 25e: Screenshot mode determines collection strategy
          const screenshotMode = analyzeOptions?.screenshotMode ?? 'viewport';
          console.log('\n  ┌─ UNIFIED COLLECTION + ANALYSIS ───────────────────────────');
          console.log(`  │ → Page Type: ${detectedPageType.toUpperCase()}`);
          console.log(`  │ → Model: ${visionModel}, Max Steps: ${visionMaxSteps}`);
          console.log(`  │ → Screenshot Mode: ${screenshotMode}`);

          // Initialize components for collection
          const registry = analyzeOptions?.registry ?? createCRORegistry();
          const collectionStateManager = new StateManager(this.options, scanMode);
          collectionStateManager.setPageHeight(pageHeight);

          // Phase 25e: Choose collection strategy based on screenshot mode
          let collectedSnapshots: ViewportSnapshot[];

          if (screenshotMode === 'tiled') {
            // Tiled mode: capture full page as overlapping tiles
            console.log(`  │ → Capturing full page as tiled screenshots...`);
            const tiledConfig: Partial<TiledScreenshotConfig> = {
              maxTileHeight: analyzeOptions?.tiledConfig?.maxTileHeight ?? DEFAULT_PHASE25_CONFIG.maxTileHeight,
              overlapPx: analyzeOptions?.tiledConfig?.overlapPx ?? DEFAULT_PHASE25_CONFIG.tileOverlapPx,
              maxTiles: analyzeOptions?.tiledConfig?.maxTiles ?? DEFAULT_PHASE25_CONFIG.maxTiles,
              annotateFoldLine: analyzeOptions?.tiledConfig?.annotateFoldLine ?? DEFAULT_PHASE25_CONFIG.annotateFoldLine,
              viewportHeight: viewportHeight,
            };

            const tiledResult = await captureTiledScreenshots(page, tiledConfig);

            if (tiledResult.success && tiledResult.tiles.length > 0) {
              // Extract DOM once for all tiles
              const domExtractor = new DOMExtractor();
              const currentDom = await domExtractor.extract(page);

              // Convert tiles to ViewportSnapshot format
              collectedSnapshots = tiledResult.tiles.map((tile) => ({
                viewportIndex: tile.index,
                scrollPosition: tile.startY,
                screenshot: {
                  base64: tile.base64 || tile.buffer.toString('base64'),
                  capturedAt: Date.now(),
                },
                dom: {
                  serialized: currentDom.root ? JSON.stringify(currentDom.root) : '',
                  elementCount: currentDom.croElementCount,
                },
                timestamp: Date.now(),
              }));

              console.log(`  │ ${c.success('✓')} Tiled capture: ${tiledResult.tiles.length} tiles in ${tiledResult.captureTimeMs}ms`);
            } else {
              console.log(`  │ ${c.warn('⚠')} Tiled capture failed: ${tiledResult.error}, falling back to viewport mode`);
              // Fallback to viewport mode
              collectedSnapshots = await this.runCollectionPhase(
                page,
                domTree,
                url,
                pageTitle,
                collectionStateManager,
                registry,
                verbose
              );
            }
          } else if (screenshotMode === 'hybrid') {
            // Phase 25h (T528): Hybrid mode = viewport for first 2 + tiled for rest
            // This combines the benefits of both modes:
            // - Viewport mode for above-fold content (high accuracy for visible area)
            // - Tiled mode for below-fold content (efficient full-page coverage)
            console.log(`  │ → Hybrid mode: 2 viewports + tiled for remaining...`);

            // Step 1: Capture first 2 viewports using deterministic collection
            const maxViewportCaptures = 2;
            const overlapPx = 120;
            const scrollStep = viewportHeight - overlapPx;
            const viewportSnapshots: ViewportSnapshot[] = [];

            for (let i = 0; i < maxViewportCaptures && (i * scrollStep) < pageHeight; i++) {
              const targetScrollY = i * scrollStep;
              await this.scrollToPositionWithVerification(page, targetScrollY);

              // Wait for media readiness
              await waitForMediaReadiness(page, { timeoutMs: 2000 });

              // Capture screenshot
              const rawScreenshotBuffer = await page.screenshot({ type: 'png', fullPage: false });

              // Annotate fold line on first viewport
              let screenshotBuffer = rawScreenshotBuffer;
              if (i === 0) {
                try {
                  const { annotateFoldLine } = await import('../output/screenshot-annotator.js');
                  const foldResult = await annotateFoldLine(rawScreenshotBuffer, {
                    viewportHeight: viewportHeight,
                    showLabel: true,
                  });
                  if (foldResult.success && foldResult.annotatedBuffer) {
                    screenshotBuffer = foldResult.annotatedBuffer;
                  }
                } catch { /* Continue without annotation */ }
              }

              // Compress for LLM
              const compressedBuffer = await sharp(screenshotBuffer)
                .resize(384, null, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 50 })
                .toBuffer();

              // Extract DOM
              const domExtractor = new DOMExtractor();
              const extractedDom = await domExtractor.extract(page);
              const serializer = new DOMSerializer({ maxTokens: 2000 });
              const serialized = serializer.serialize(extractedDom);

              viewportSnapshots.push({
                scrollPosition: targetScrollY,
                viewportIndex: i,
                screenshot: {
                  base64: compressedBuffer.toString('base64'),
                  capturedAt: Date.now(),
                },
                dom: {
                  serialized: serialized.text,
                  elementCount: serialized.elementCount,
                },
                fullResolutionBase64: rawScreenshotBuffer.toString('base64'),
              });
            }

            console.log(`  │ → ${c.success('✓')} Captured ${viewportSnapshots.length} viewport snapshots`);

            // Step 2: Calculate if we need tiled captures for remaining content
            const lastViewportY = viewportSnapshots.length > 0
              ? viewportSnapshots[viewportSnapshots.length - 1]!.scrollPosition + viewportHeight
              : 0;
            const remainingHeight = pageHeight - lastViewportY;

            if (remainingHeight > viewportHeight / 2) {
              // Need tiled captures for remaining content
              console.log(`  │ → Adding tiled captures for remaining ${Math.round(remainingHeight)}px...`);
              const tiledConfig: Partial<TiledScreenshotConfig> = {
                maxTileHeight: DEFAULT_PHASE25_CONFIG.maxTileHeight,
                overlapPx: DEFAULT_PHASE25_CONFIG.tileOverlapPx,
                maxTiles: 3, // Limit tiles in hybrid mode
                annotateFoldLine: false, // Already annotated in viewport mode
                viewportHeight: viewportHeight,
              };

              const tiledResult = await captureTiledScreenshots(page, tiledConfig);

              if (tiledResult.success && tiledResult.tiles.length > 0) {
                // Only add tiles that cover content beyond viewport captures
                const additionalSnapshots: ViewportSnapshot[] = tiledResult.tiles
                  .filter((tile) => tile.startY >= lastViewportY - 100) // Allow small overlap
                  .map((tile, idx) => ({
                    viewportIndex: viewportSnapshots.length + idx,
                    scrollPosition: tile.startY,
                    screenshot: {
                      base64: tile.base64 || tile.buffer.toString('base64'),
                      capturedAt: Date.now(),
                    },
                    dom: {
                      serialized: '', // DOM already captured
                      elementCount: 0,
                    },
                  }));

                collectedSnapshots = [...viewportSnapshots, ...additionalSnapshots];
                console.log(`  │ ${c.success('✓')} Hybrid complete: ${viewportSnapshots.length} viewport + ${additionalSnapshots.length} tiled`);
              } else {
                collectedSnapshots = viewportSnapshots;
                console.log(`  │ → Tiled capture skipped (no additional content)`);
              }
            } else {
              // Page is short enough - viewports cover it
              collectedSnapshots = viewportSnapshots;
              console.log(`  │ ${c.success('✓')} Short page - viewports cover all content`);
            }
          } else {
            // Default viewport mode
            // Phase 25f: Use deterministic collection by default (no LLM calls)
            const useLLMGuided = analyzeOptions?.llmGuidedCollection ?? false;

            if (useLLMGuided) {
              // LLM-guided collection (original behavior, opt-in)
              console.log(`  │ → LLM-guided collection mode (--llm-guided-collection)`);
              collectedSnapshots = await this.runCollectionPhase(
                page,
                domTree,
                url,
                pageTitle,
                collectionStateManager,
                registry,
                verbose
              );
            } else {
              // Deterministic collection (default - faster, cheaper)
              console.log(`  │ → Deterministic collection mode (default, no LLM calls)`);
              collectedSnapshots = await this.runDeterministicCollection(
                page,
                pageHeight,
                viewportHeight,
                analyzeOptions?.skipCollectionQA ?? false
              );
            }
          }

          console.log(`  │ ${c.success('✓')} Collection complete: ${collectedSnapshots.length} snapshots`);

          // Store snapshots for return
          collectedViewportSnapshots = collectedSnapshots;

          // Run category-based analysis on collected snapshots using orchestrator
          if (collectedSnapshots.length > 0) {
            console.log(`  │ → Running category-based analysis on collected snapshots...`);

            try {
              // Create analysis orchestrator with category filtering if specified
              const orchestrator = createAnalysisOrchestrator({
                analyzerConfig: { model: visionModel },
                includeCategories: analyzeOptions?.heuristicCategories,
                parallelAnalysis: analyzeOptions?.parallelAnalysis ?? true,
                maxConcurrentCategories: analyzeOptions?.maxConcurrentCategories ?? 5,
                categoryBatching: analyzeOptions?.categoryBatching ?? false,
                enableViewportFiltering: analyzeOptions?.enableViewportFiltering ?? false,
                verbose,
              });

              // Run analysis across all categories
              const analysisResult = await orchestrator.runAnalysis(
                collectedSnapshots,
                detectedPageType
              );

              // Store results for return value
              visionInsights = analysisResult.insights;

              // Convert to CROVisionAnalysisResult format for compatibility
              visionAnalysis = {
                pageType: detectedPageType,
                analyzedAt: analysisResult.analyzedAt,
                screenshotUsed: true,
                viewport,
                evaluations: analysisResult.evaluations,
                insights: analysisResult.insights,
                summary: analysisResult.summary,
              };

              const { summary } = analysisResult;
              console.log(`  │ ${c.success('✓')} Analysis complete (${analysisResult.totalTimeMs}ms)`);
              console.log(`  │ → Categories: ${analysisResult.categoriesAnalyzed.length} (${analysisResult.categoriesAnalyzed.join(', ')})`);
              console.log(`  │ → Heuristics: ${summary.passed} passed, ${summary.failed} failed, ${summary.partial} partial`);
              console.log(`  │ → Issues by severity: Critical ${summary.bySeverity.critical}, High ${summary.bySeverity.high}, Medium ${summary.bySeverity.medium}, Low ${summary.bySeverity.low}`);

              if (visionInsights.length > 0) {
                console.log(`  │ → Vision insights:`);
                for (const insight of visionInsights.slice(0, 3)) {
                  console.log(`  │   • ${c.severity(insight.severity)} [${insight.heuristicId}] ${insight.issue?.slice(0, 40)}...`);
                }
                if (visionInsights.length > 3) {
                  console.log(`  │   ... and ${visionInsights.length - 3} more`);
                }
              }

              // Mark unified analysis as complete - skip agent loop
              unifiedAnalysisComplete = true;
              // Store result for report metadata
              unifiedAnalysisResult = analysisResult;
            } catch (analysisError) {
              const errMsg = analysisError instanceof Error ? analysisError.message : 'Analysis failed';
              console.log(`  │ ${c.error('✗ Analysis failed:')} ${errMsg}`);
              errors.push(`VisionAnalysis: ${errMsg}`);
            }
          }
          console.log(`  └${'─'.repeat(60)}`);
        } else {
          console.log(`\n  ┌─ Vision Analysis ─────────────────────────────────────────`);
          console.log(`  │ ${c.warn('⏭ SKIPPED')} - Page type '${detectedPageType}' not supported`);
          console.log(`  │ → Supported types: pdp`);
          console.log(`  └${'─'.repeat(60)}`);
        }

        console.log('\n' + '═'.repeat(80));
        console.log('  PHASE 21: VISION ANALYSIS COMPLETE');
        console.log('═'.repeat(80) + '\n');
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // PHASE 15: Tool System Initialization
      // ═══════════════════════════════════════════════════════════════════════════
      console.log('═'.repeat(80));
      console.log('  PHASE 15: TOOL SYSTEM INITIALIZATION');
      console.log('═'.repeat(80));

      const registry = analyzeOptions?.registry ?? createCRORegistry();
      const toolExecutor = new ToolExecutor(registry);

      console.log(`  ${c.success('✓')} Tool Registry created with ${registry.size} tools:`);
      console.log(`    - Analysis: analyze_ctas, analyze_forms, detect_trust_signals,`);
      console.log(`                assess_value_prop, check_navigation, find_friction`);
      console.log(`    - Navigation: scroll_page, click, go_to_url`);
      console.log(`    - Control: record_insight, done`);
      console.log(`  ${c.success('✓')} Tool Executor ready with Zod validation`);
      console.log('  OUTPUT → ToolRegistry, ToolExecutor passed to Phase 16');
      console.log('═'.repeat(80) + '\n');

      // ═══════════════════════════════════════════════════════════════════════════
      // PHASE 16: Agent Core Setup (State, Messages, LLM)
      // ═══════════════════════════════════════════════════════════════════════════
      console.log('═'.repeat(80));
      console.log('  PHASE 16: AGENT CORE SETUP');
      console.log('═'.repeat(80));

      // Calculate dynamic maxSteps for full_page mode (T138)
      let effectiveMaxSteps = this.options.maxSteps;
      if (scanMode === 'full_page') {
        const requiredSteps = calculateRequiredSteps(pageHeight, viewportHeight, coverageConfig);
        effectiveMaxSteps = Math.max(this.options.maxSteps, requiredSteps);
        if (effectiveMaxSteps > this.options.maxSteps) {
          console.log(`  ${c.info('ℹ')} Dynamic maxSteps: ${this.options.maxSteps} → ${effectiveMaxSteps} (page requires ${requiredSteps})`);
        }
      }

      const stateManager = new StateManager({ ...this.options, maxSteps: effectiveMaxSteps }, scanMode);
      const promptBuilder = new PromptBuilder(registry);
      const messageManager = new MessageManager(promptBuilder.buildSystemPrompt());

      // Set coverage tracker on state manager
      if (coverageTracker) {
        stateManager.setCoverageTracker(coverageTracker);
      }

      const llm = new ChatOpenAI({
        model: 'gpt-4o-mini',
        temperature: 0,
        timeout: this.options.llmTimeoutMs,
      });

      stateManager.addPageSeen(url);

      console.log(`  ${c.success('✓')} StateManager initialized (maxSteps: ${effectiveMaxSteps}, scanMode: ${scanMode})`);
      console.log(`  ${c.success('✓')} PromptBuilder created with CRO expert system prompt`);
      console.log(`  ${c.success('✓')} MessageManager ready for conversation history`);
      console.log(`  ${c.success('✓')} LLM initialized: GPT-4o (temperature: 0)`);
      if (coverageTracker) {
        console.log(`  ${c.success('✓')} CoverageTracker attached to StateManager`);
      }
      console.log('  OUTPUT → Agent components ready for observe→reason→act loop');
      console.log('═'.repeat(80) + '\n');

      this.logger.info('Initialization complete', {
        toolCount: registry.size,
        elementCount: domTree.croElementCount,
      });

      // ═══════════════════════════════════════════════════════════════════════════
      // PHASE 16-17: AGENT LOOP (Observe → Reason → Act)
      // CR-001-C: Skip agent loop when unified analysis is complete
      // ═══════════════════════════════════════════════════════════════════════════
      if (unifiedAnalysisComplete) {
        console.log('═'.repeat(80));
        console.log('  PHASE 16-17: AGENT LOOP (SKIPPED - UNIFIED ANALYSIS COMPLETE)');
        console.log('═'.repeat(80));
        console.log(`  ${c.info('ℹ')} Analysis completed via unified collection + category-based orchestrator`);
        console.log(`  ${c.info('ℹ')} Skipping tool-based agent loop (analysis already done)`);
        console.log('═'.repeat(80) + '\n');
      } else {
        console.log('═'.repeat(80));
        console.log('  PHASE 16-17: AGENT LOOP (OBSERVE → REASON → ACT)');
        console.log('═'.repeat(80));
        console.log(`  Max steps: ${this.options.maxSteps}`);
        console.log('─'.repeat(80));
      }

      while (!unifiedAnalysisComplete && !stateManager.shouldTerminate()) {
        const step = stateManager.getStep();
        console.log(`\n  ┌─ STEP ${step + 1}/${this.options.maxSteps} ${'─'.repeat(60)}`);
        this.logger.info(`Step ${step + 1}/${this.options.maxSteps}`, {
          focus: stateManager.getMemory().currentFocus,
        });

        // a. OBSERVE: Build PageState
        console.log(`  │ OBSERVE: Building PageState from DOM...`);
        const pageState = await this.buildPageState(page, domTree, url, pageTitle);
        console.log(`  │   → ${pageState.domTree.croElementCount} CRO elements, scroll: ${pageState.scrollPosition.y}px`);

        // b. REASON: Call LLM (Phase 19d: pass coverageTracker for coverage-aware prompts)
        console.log(`  │ REASON: Sending state to GPT-4...`);
        const userMsg = promptBuilder.buildUserMessage(
          pageState,
          stateManager.getMemory(),
          coverageTracker
        );
        messageManager.addUserMessage(userMsg);

        let llmResponse: string;
        try {
          const result = await llm.invoke(messageManager.getMessages());
          llmResponse = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
          this.logger.debug('LLM response received', { length: llmResponse.length });
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : 'LLM call failed';
          this.logger.error('LLM timeout/error', { error: errMsg });
          stateManager.recordFailure(errMsg);
          errors.push(errMsg);
          stateManager.incrementStep();
          continue;
        }

        // Parse LLM output
        const parseResult = parseAgentOutput(llmResponse);
        if (!parseResult.success) {
          this.logger.warn('Invalid LLM output', { error: parseResult.error });
          stateManager.recordFailure(parseResult.error!);
          errors.push(`Parse error: ${parseResult.error}`);
          stateManager.incrementStep();
          continue;
        }

        const output = parseResult.output!;
        messageManager.addAssistantMessage(output);
        stateManager.updateFocus(output.next_goal);

        console.log(`  │   → LLM thinking: "${output.thinking.slice(0, 80)}..."`);
        console.log(`  │   → Next goal: "${output.next_goal}"`);

        this.logger.info('LLM decision', {
          action: output.action.name,
          nextGoal: output.next_goal,
        });

        // c. ACT: Execute tool
        console.log(`  │ ACT: Executing tool "${output.action.name}"...`);
        const toolResult = await toolExecutor.execute(
          output.action.name,
          output.action.params || {},
          { page, state: pageState, verbose }
        );

        if (toolResult.success) {
          stateManager.resetFailures();
          stateManager.addInsights(toolResult.insights);
          console.log(`  │   ${c.success('✓')} Tool succeeded (${toolResult.executionTimeMs}ms)`);
          console.log(`  │   → Insights found: ${toolResult.insights.length}`);
          if (toolResult.insights.length > 0) {
            for (const insight of toolResult.insights.slice(0, 3)) {
              console.log(`  │     • ${c.severity(insight.severity)} ${insight.issue.slice(0, 50)}...`);
            }
            if (toolResult.insights.length > 3) {
              console.log(`  │     ... and ${toolResult.insights.length - 3} more`);
            }
          }
          this.logger.info('Tool success', {
            tool: output.action.name,
            insights: toolResult.insights.length,
            durationMs: toolResult.executionTimeMs,
          });
        } else {
          stateManager.recordFailure(toolResult.error || 'Tool failed');
          errors.push(`Tool error: ${toolResult.error}`);
          console.log(`  │   ${c.error('✗ Tool failed:')} ${c.error(toolResult.error || 'Unknown error')}`);
          this.logger.warn('Tool failed', {
            tool: output.action.name,
            error: toolResult.error,
          });
        }

        // Record step in memory
        const stepRecord: StepRecord = {
          step,
          action: output.action.name,
          params: output.action.params as Record<string, unknown> | undefined,
          result: toolResult,
          thinking: output.thinking,
          timestamp: Date.now(),
        };
        stateManager.recordStep(stepRecord);

        // d. CHECK: Done action? (T136: Coverage enforcement)
        if (output.action.name === 'done') {
          // In full_page mode, check coverage before allowing done
          if (stateManager.isFullPageMode() && !stateManager.isFullyCovered()) {
            const coveragePercent = stateManager.getCoveragePercent();
            console.log(`  │ ${c.warn('⚠ COVERAGE ENFORCEMENT:')} Cannot complete - only ${coveragePercent}% covered`);
            console.log(`  │ ${c.info('→')} Agent will continue with remaining analysis`);
            this.logger.warn('Done blocked by coverage enforcement', {
              coverage: coveragePercent,
              required: 100,
            });
            // Don't set done - agent will continue
          } else {
            stateManager.setDone('Agent completed analysis');
            console.log(`  │ ${c.success('✓ Agent signaled DONE')} - analysis complete`);
            if (coverageTracker) {
              console.log(`  │   Coverage: ${coverageTracker.getCoveragePercent()}%`);
            }
            this.logger.info('Agent signaled completion');
          }
        }
        console.log(`  └${'─'.repeat(75)}`);

        // e. WAIT (CR-011)
        await this.sleep(this.options.actionWaitMs);

        // f. INCREMENT
        stateManager.incrementStep();

        // Re-extract DOM if scroll or navigation changed page
        if (['scroll_page', 'go_to_url'].includes(output.action.name)) {
          this.logger.debug('Re-extracting DOM after page change');
          domTree = await domExtractor.extract(page);
        }

        // Trim messages if getting too long (keep last 10 exchanges)
        if (messageManager.getMessageCount() > 20) {
          messageManager.trimToLimit(10);
          this.logger.debug('Trimmed message history', {
            newCount: messageManager.getMessageCount(),
          });
        }
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // PHASE 16-17: AGENT LOOP COMPLETE
      // ═══════════════════════════════════════════════════════════════════════════
      if (!unifiedAnalysisComplete) {
        console.log('\n' + '─'.repeat(80));
        console.log(`  Agent loop completed after ${stateManager.getStep()} steps`);
        console.log(`  Total insights from tools: ${stateManager.getInsights().length}`);
        console.log('  OUTPUT → Tool insights passed to Phase 18 (Post-Processing)');
        console.log('═'.repeat(80) + '\n');
      }

      // ─── 3. POST-PROCESSING PIPELINE ─────────────────────────────
      // Phase 18e (T117): Integrate post-processing after agent loop
      const toolInsights = stateManager.getInsights();
      let heuristicInsights: CROInsight[] = [];
      let businessType: BusinessTypeResult | undefined;
      let hypotheses: Hypothesis[] = [];
      let scores: CROScores;
      let report: { markdown?: string; json?: string } | undefined;

      // Get final page state for heuristics
      const finalPageState = await this.buildPageState(page, domTree, url, pageTitle);

      if (!analyzeOptions?.skipPostProcessing) {
        // ═══════════════════════════════════════════════════════════════════════════
        // PHASE 18: POST-PROCESSING PIPELINE
        // ═══════════════════════════════════════════════════════════════════════════
        console.log('═'.repeat(80));
        console.log('  PHASE 18: POST-PROCESSING PIPELINE');
        console.log('═'.repeat(80));
        this.logger.info('Starting post-processing pipeline');

        // 3a. Detect business type
        console.log('\n  ┌─ PHASE 18a: Business Type Detection ─────────────────────────');
        const businessTypeDetector = new BusinessTypeDetector();
        businessType = businessTypeDetector.detect(finalPageState);
        console.log(`  │ ${c.success('✓')} Detected: ${businessType.type} (confidence: ${(businessType.confidence * 100).toFixed(0)}%)`);
        console.log(`  │ → Signals: ${businessType.signals.slice(0, 3).join(', ')}${businessType.signals.length > 3 ? '...' : ''}`);
        console.log(`  └${'─'.repeat(60)}`);
        this.logger.debug('Business type detected', {
          type: businessType.type,
          confidence: businessType.confidence,
        });

        // NOTE: Phase 18b-c (Heuristic Rules Engine) removed in CR-002
        // Vision-based analysis (Phase 21) supersedes rule-based heuristics
        // heuristicInsights remains empty array for backward compatibility

        // 3b. Combine and deduplicate insights (include vision insights)
        console.log('\n  ┌─ PHASE 18d: Insight Processing ──────────────────────────────');
        const allInsights = [...toolInsights, ...heuristicInsights, ...visionInsights];
        console.log(`  │ → Combined insights: ${allInsights.length} (${toolInsights.length} tool + ${heuristicInsights.length} heuristic + ${visionInsights.length} vision)`);
        const deduplicator = new InsightDeduplicator();
        const uniqueInsights = deduplicator.deduplicate(allInsights);
        console.log(`  │ ${c.success('✓')} After deduplication: ${uniqueInsights.length} unique insights`);

        // 3d. Prioritize insights by severity and business type
        const prioritizer = new InsightPrioritizer();
        const prioritizedInsights = prioritizer.prioritize(uniqueInsights, businessType.type);
        console.log(`  │ ${c.success('✓')} Prioritized by severity + business type`);
        console.log(`  └${'─'.repeat(60)}`);

        // Update heuristicInsights to be the prioritized heuristic-only insights
        heuristicInsights = prioritizedInsights.filter(i =>
          heuristicInsights.some(h => h.id === i.id)
        );

        // 3e. Generate hypotheses from high/critical insights
        console.log('\n  ┌─ PHASE 18d: Hypothesis Generation ──────────────────────────');
        const hypothesisGenerator = new HypothesisGenerator({ minSeverity: 'high' });
        hypotheses = hypothesisGenerator.generate(prioritizedInsights);
        console.log(`  │ ${c.success('✓')} Generated ${hypotheses.length} A/B test hypotheses`);
        if (hypotheses.length > 0) {
          for (const h of hypotheses.slice(0, 2)) {
            console.log(`  │   • ${h.title.slice(0, 50)}...`);
          }
        }
        console.log(`  └${'─'.repeat(60)}`);
        this.logger.debug('Hypotheses generated', { count: hypotheses.length });

        // 3f. Calculate scores
        console.log('\n  ┌─ PHASE 18d: Score Calculation ───────────────────────────────');
        const scoreCalculator = new ScoreCalculator();
        scores = scoreCalculator.calculate(prioritizedInsights);
        console.log(`  │ ${c.success('✓')} Overall CRO Score: ${c.bold(String(scores.overall))}/100`);
        const criticalStr = scores.criticalCount > 0 ? c.error(`Critical: ${scores.criticalCount}`) : `Critical: ${scores.criticalCount}`;
        const highStr = scores.highCount > 0 ? c.error(`High: ${scores.highCount}`) : `High: ${scores.highCount}`;
        const mediumStr = scores.mediumCount > 0 ? c.warn(`Medium: ${scores.mediumCount}`) : `Medium: ${scores.mediumCount}`;
        console.log(`  │ → ${criticalStr}, ${highStr}, ${mediumStr}, Low: ${scores.lowCount}`);
        console.log(`  └${'─'.repeat(60)}`);
        this.logger.debug('Scores calculated', { overall: scores.overall });

        // 3g. Generate reports if requested
        if (analyzeOptions?.outputFormat && analyzeOptions.outputFormat !== 'console') {
          console.log('\n  ┌─ PHASE 18d: Report Generation ──────────────────────────────');
          report = {};
          // CR-001-C: Include vision insights and unified analysis metadata in report
          // Phase 25h (T521): Include runId for reproducibility tracking
          const reportInput = {
            url,
            runId,
            pageTitle,
            insights: toolInsights,
            heuristicInsights,
            visionInsights,
            businessType,
            pageType: detectedPageType,
            hypotheses,
            scores,
            stepsExecuted: stateManager.getStep(),
            totalTimeMs: Date.now() - startTime,
            unifiedAnalysis: unifiedAnalysisComplete,
            categoriesAnalyzed: unifiedAnalysisResult?.categoriesAnalyzed,
          };

          if (
            analyzeOptions.outputFormat === 'markdown' ||
            analyzeOptions.outputFormat === 'all'
          ) {
            const markdownReporter = new MarkdownReporter();
            report.markdown = markdownReporter.generate(reportInput);
            console.log(`  │ ${c.success('✓')} Markdown report generated`);
            this.logger.debug('Markdown report generated');
          }

          if (
            analyzeOptions.outputFormat === 'json' ||
            analyzeOptions.outputFormat === 'all'
          ) {
            const jsonExporter = new JSONExporter();
            report.json = jsonExporter.export(reportInput);
            console.log(`  │ ${c.success('✓')} JSON report generated`);
            this.logger.debug('JSON report generated');
          }
          console.log(`  └${'─'.repeat(60)}`);
        }

        console.log('\n' + '═'.repeat(80));
        console.log('  PHASE 18: POST-PROCESSING COMPLETE');
        console.log('═'.repeat(80) + '\n');
        this.logger.info('Post-processing pipeline complete');
      } else {
        // Skip post-processing - just calculate basic scores
        const scoreCalculator = new ScoreCalculator();
        scores = scoreCalculator.calculate(toolInsights);
      }

      // ─── 4. CLEANUP & RETURN ───────────────────────────────────
      const result: CROAnalysisResult = {
        url,
        runId,
        success: true,
        insights: toolInsights,
        heuristicInsights,
        visionInsights,
        businessType,
        pageType: detectedPageType,
        visionAnalysis,
        unifiedAnalysisResult,
        snapshots: collectedViewportSnapshots.length > 0 ? collectedViewportSnapshots : undefined,
        // Phase 23 (T403): Pass through captured LLM inputs for debugging
        llmInputs: unifiedAnalysisResult?.capturedInputs,
        hypotheses,
        scores,
        report,
        stepsExecuted: stateManager.getStep(),
        totalTimeMs: Date.now() - startTime,
        terminationReason: stateManager.getTerminationReason(),
        errors,
        pageTitle,
      };

      // ═══════════════════════════════════════════════════════════════════════════
      // FINAL SUMMARY: All Phases Complete
      // ═══════════════════════════════════════════════════════════════════════════
      console.log('╔' + '═'.repeat(78) + '╗');
      console.log('║' + '                        ANALYSIS COMPLETE - SUMMARY                          '.slice(0, 78) + '║');
      console.log('╠' + '═'.repeat(78) + '╣');
      console.log(`║  Run ID: ${runId.slice(0, 66).padEnd(68)} ║`);
      console.log(`║  URL: ${url.slice(0, 68).padEnd(70)} ║`);
      console.log(`║  Time: ${(result.totalTimeMs / 1000).toFixed(1)}s | Steps: ${result.stepsExecuted} | Score: ${result.scores.overall}/100`.padEnd(79) + '║');
      console.log('╠' + '═'.repeat(78) + '╣');
      console.log('║  PHASE OUTPUTS FLOW:                                                        ║');
      console.log('║    Phase 3  (Browser)    → Page loaded                                      ║');
      console.log('║    Phase 14 (DOM)        → ' + `${domTree.croElementCount} CRO elements extracted`.padEnd(49) + '║');
      console.log('║    Phase 21 (Vision)     → ' + `${result.pageType || 'n/a'}, ${result.visionInsights.length} vision insights`.padEnd(49) + '║');
      console.log('║    Phase 15 (Tools)      → 11 tools registered                              ║');
      console.log('║    Phase 16 (Agent)      → ' + `${result.stepsExecuted} steps executed`.padEnd(49) + '║');
      console.log('║    Phase 17 (Execution)  → ' + `${result.insights.length} tool insights`.padEnd(49) + '║');
      console.log('║    Phase 18a (Business)  → ' + `${result.businessType?.type || 'unknown'} detected`.padEnd(49) + '║');
      console.log('║    Phase 18b (Heuristic) → ' + `REMOVED (CR-002) - use vision analysis`.padEnd(49) + '║');
      console.log('║    Phase 18d (Output)    → ' + `${result.hypotheses.length} hypotheses, score ${result.scores.overall}`.padEnd(49) + '║');
      console.log('╚' + '═'.repeat(78) + '╝\n');

      this.logger.info('Analysis complete', {
        runId,
        success: true,
        stepsExecuted: result.stepsExecuted,
        toolInsightCount: result.insights.length,
        heuristicInsightCount: result.heuristicInsights.length,
        visionInsightCount: result.visionInsights.length,
        pageType: result.pageType,
        hypothesesCount: result.hypotheses.length,
        overallScore: result.scores.overall,
        terminationReason: result.terminationReason,
        totalTimeMs: result.totalTimeMs,
      });

      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Analysis failed', { error: errMsg });

      // Return error result with empty post-processing fields
      const emptyScores: CROScores = {
        overall: 0,
        byCategory: {},
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      };

      return {
        url,
        runId,
        success: false,
        insights: [],
        heuristicInsights: [],
        visionInsights: [],
        businessType: undefined,
        pageType: undefined,
        visionAnalysis: undefined,
        snapshots: undefined,
        hypotheses: [],
        scores: emptyScores,
        report: undefined,
        stepsExecuted: 0,
        totalTimeMs: Date.now() - startTime,
        terminationReason: `Error: ${errMsg}`,
        errors: [errMsg],
      };
    } finally {
      await this.close();
    }
  }

  /**
   * Initialize browser and load page
   */
  private async initializeBrowser(
    url: string,
    analyzeOptions?: AnalyzeOptions
  ): Promise<{ page: Page; pageTitle: string }> {
    const browserConfig = {
      headless: false,
      timeout: 60000,
      browserType: 'chromium' as const,
      waitUntil: 'load' as const,
      postLoadWait: 5000,
      dismissCookieConsent: true,
      ...analyzeOptions?.browserConfig,
    };

    this.browserManager = new BrowserManager(browserConfig);
    await this.browserManager.launch();
    const page = this.browserManager.getPage();

    const pageLoader = new PageLoader(page, {
      timeout: browserConfig.timeout,
      waitUntil: browserConfig.waitUntil,
      postLoadWait: browserConfig.postLoadWait,
      dismissCookieConsent: browserConfig.dismissCookieConsent,
    });

    const loadResult = await pageLoader.load(url);
    if (!loadResult.success) {
      throw new Error(`Failed to load page: ${loadResult.error}`);
    }

    return {
      page,
      pageTitle: loadResult.title || '',
    };
  }

  /**
   * Build PageState from current page
   */
  private async buildPageState(
    page: Page,
    domTree: DOMTree,
    url: string,
    title: string
  ): Promise<PageState> {
    const viewportSize = page.viewportSize() || { width: 1280, height: 720 };
    // Use string function to avoid TypeScript DOM type issues
    const scroll = await page.evaluate(`(() => ({
      x: window.scrollX,
      y: window.scrollY,
      maxX: document.documentElement.scrollWidth - window.innerWidth,
      maxY: document.documentElement.scrollHeight - window.innerHeight,
    }))()`);

    const scrollPosition = scroll as { x: number; y: number; maxX: number; maxY: number };

    return {
      url,
      title,
      domTree,
      viewport: {
        width: viewportSize.width,
        height: viewportSize.height,
        deviceScaleFactor: 1,
        isMobile: false,
      },
      scrollPosition,
      timestamp: Date.now(),
    };
  }

  /**
   * Close browser and cleanup resources
   */
  async close(): Promise<void> {
    if (this.browserManager) {
      await this.browserManager.close();
      this.browserManager = undefined;
    }
  }

  /**
   * Log extracted DOM elements to console
   */
  private logExtractedElements(domTree: DOMTree, verbose: boolean): void {
    console.log('\n' + '='.repeat(80));
    console.log('                         EXTRACTED DOM ELEMENTS');
    console.log('='.repeat(80));
    console.log(`Total Nodes: ${domTree.totalNodeCount}`);
    console.log(`Interactive Elements: ${domTree.interactiveCount}`);
    console.log(`CRO Elements: ${domTree.croElementCount}`);
    console.log('-'.repeat(80));

    // Count elements by CRO type
    const typeCounts: Record<string, number> = {
      cta: 0,
      form: 0,
      trust: 0,
      value_prop: 0,
      navigation: 0,
    };

    // Collect elements for display
    const elements: Array<{
      index: number;
      type: string;
      tag: string;
      text: string;
      xpath: string;
    }> = [];

    const collectElements = (node: DOMNode): void => {
      if (node.index !== undefined && node.isVisible) {
        if (node.croType) {
          typeCounts[node.croType] = (typeCounts[node.croType] || 0) + 1;
        }
        elements.push({
          index: node.index,
          type: node.croType || 'interactive',
          tag: node.tagName,
          text: node.text?.slice(0, 50) || '',
          xpath: node.xpath,
        });
      }
      for (const child of node.children) {
        collectElements(child);
      }
    };

    collectElements(domTree.root);

    // Print type summary
    console.log('CRO Element Types:');
    for (const [type, count] of Object.entries(typeCounts)) {
      if (count > 0) {
        console.log(`  ${type}: ${count}`);
      }
    }
    console.log('-'.repeat(80));

    // Print elements (limit to first 30 for readability, or all if verbose)
    const displayLimit = verbose ? elements.length : 30;
    const displayElements = elements.slice(0, displayLimit);

    console.log(`Indexed Elements (showing ${displayElements.length}/${elements.length}):\n`);

    for (const el of displayElements) {
      const typeTag = el.type ? `[${el.type}]` : '';
      const textPreview = el.text ? ` "${el.text}"` : '';
      console.log(`  [${el.index}] <${el.tag}>${textPreview} ${typeTag}`);
      if (verbose) {
        console.log(`       xpath: ${el.xpath}`);
      }
    }

    if (elements.length > displayLimit) {
      console.log(`\n  ... and ${elements.length - displayLimit} more elements (use --verbose to see all)`);
    }

    console.log('='.repeat(80) + '\n');
  }

  /**
   * Check if browser is running
   */
  isRunning(): boolean {
    return this.browserManager?.isRunning() ?? false;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current options
   */
  getOptions(): CROAgentOptions {
    return { ...this.options };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CR-001-B: Collection Phase
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * CR-001-B: Run the collection phase to capture viewport snapshots
   *
   * Uses an agent loop with collection-specific tools:
   * - capture_viewport: Capture DOM + screenshot at current position
   * - scroll_page: Scroll to reveal more content
   * - collection_done: Signal collection is complete
   *
   * @param page - Playwright page instance
   * @param domTree - Initial DOM tree
   * @param url - Page URL
   * @param pageTitle - Page title
   * @param stateManager - State manager
   * @param registry - Tool registry
   * @param verbose - Enable verbose logging
   * @returns Array of collected viewport snapshots
   */
  private async runCollectionPhase(
    page: Page,
    domTree: DOMTree,
    url: string,
    pageTitle: string,
    stateManager: StateManager,
    registry: ToolRegistry,
    verbose: boolean
  ): Promise<ViewportSnapshot[]> {
    // Phase 25a (T474): Dynamic collection steps based on page dimensions
    const pageHeight = stateManager.getPageHeight();
    const viewportHeight = 720; // Standard viewport height
    const maxCollectionSteps = calculateMaxCollectionSteps(pageHeight, viewportHeight);
    const expectedViewports = Math.ceil(pageHeight / (viewportHeight - 120));
    const snapshots: ViewportSnapshot[] = [];

    console.log('\n' + '═'.repeat(80));
    console.log('  CR-001-B: COLLECTION PHASE (VISION DATA CAPTURE)');
    console.log('═'.repeat(80));
    console.log('  → Capturing viewport snapshots as agent scrolls through page');
    // Phase 25a (T475): Enhanced console output
    console.log(`  → Page height: ${pageHeight}px`);
    console.log(`  → Max steps: ${maxCollectionSteps} (dynamic)`);
    console.log(`  → Expected viewports: ${expectedViewports}`);

    // Initialize LLM for collection phase
    const llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0,
      timeout: this.options.llmTimeoutMs,
    });

    // Initialize prompt builder and message manager for collection
    const promptBuilder = new PromptBuilder(registry);
    const collectionSystemPrompt = promptBuilder.buildCollectionSystemPrompt();
    const messageManager = new MessageManager(collectionSystemPrompt);
    const toolExecutor = new ToolExecutor(registry);

    // Track collection state
    let collectionComplete = false;
    let collectionStep = 0;

    // Scroll to top first
    await page.evaluate('window.scrollTo(0, 0)');
    await this.sleep(200);

    while (!collectionComplete && collectionStep < maxCollectionSteps) {
      collectionStep++;
      console.log(`\n  ┌─ COLLECTION STEP ${collectionStep}/${maxCollectionSteps} ${'─'.repeat(50)}`);

      // Build page state
      const pageState = await this.buildPageState(page, domTree, url, pageTitle);

      // Build collection user message
      const userMsg = promptBuilder.buildCollectionUserMessage(
        pageState,
        stateManager.getMemory(),
        snapshots
      );
      messageManager.addUserMessage(userMsg);

      // Call LLM
      let llmResponse: string;
      try {
        const result = await llm.invoke(messageManager.getMessages());
        llmResponse = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
        this.logger.debug('Collection LLM response', { length: llmResponse.length });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'LLM call failed';
        this.logger.error('Collection LLM error', { error: errMsg });
        console.log(`  │ ${c.error('✗ LLM error:')} ${errMsg}`);
        stateManager.recordFailure(errMsg);
        continue;
      }

      // Parse response
      const parseResult = parseAgentOutput(llmResponse);
      if (!parseResult.success) {
        this.logger.warn('Invalid collection output', { error: parseResult.error });
        console.log(`  │ ${c.warn('⚠ Parse error:')} ${parseResult.error}`);
        stateManager.recordFailure(parseResult.error!);
        continue;
      }

      const output = parseResult.output!;
      messageManager.addAssistantMessage(output);
      stateManager.updateFocus(output.next_goal);

      console.log(`  │ Thinking: "${output.thinking.slice(0, 60)}..."`);
      console.log(`  │ Action: ${output.action.name}`);

      // Execute tool
      const toolResult = await toolExecutor.execute(
        output.action.name,
        output.action.params || {},
        { page, state: pageState, verbose }
      ) as CaptureViewportResult;

      if (toolResult.success) {
        stateManager.resetFailures();
        console.log(`  │ ${c.success('✓')} Tool succeeded`);

        // Handle capture_viewport result
        if (output.action.name === 'capture_viewport' && toolResult.snapshot) {
          const snapshot = {
            ...toolResult.snapshot,
            viewportIndex: snapshots.length,
          };
          snapshots.push(snapshot);
          stateManager.addViewportSnapshot(snapshot);
          console.log(`  │ → Snapshot ${snapshots.length} captured at ${snapshot.scrollPosition}px`);
          console.log(`  │ → DOM elements: ${snapshot.dom.elementCount}`);
        }

        // Handle scroll_page result
        if (output.action.name === 'scroll_page') {
          const extracted = toolResult.extracted as { newScrollY?: number } | undefined;
          if (extracted?.newScrollY !== undefined) {
            stateManager.updateScrollPosition(extracted.newScrollY);
            console.log(`  │ → Scrolled to ${extracted.newScrollY}px`);
          }
        }

        // Handle collection_done
        if (output.action.name === 'collection_done') {
          collectionComplete = true;
          stateManager.transitionToAnalysis();
          console.log(`  │ ${c.success('✓')} Collection complete - transitioning to analysis`);
        }

        this.logger.info('Collection tool success', { tool: output.action.name });
      } else {
        stateManager.recordFailure(toolResult.error || 'Tool failed');
        console.log(`  │ ${c.error('✗ Tool failed:')} ${toolResult.error}`);
        this.logger.warn('Collection tool failed', { error: toolResult.error });
      }

      console.log(`  └${'─'.repeat(70)}`);

      // Record step
      const stepRecord: StepRecord = {
        step: collectionStep,
        action: output.action.name,
        params: output.action.params as Record<string, unknown> | undefined,
        result: toolResult,
        thinking: output.thinking,
        timestamp: Date.now(),
      };
      stateManager.recordStep(stepRecord);

      // Small delay between steps
      await this.sleep(this.options.actionWaitMs);
    }

    // Log collection summary
    console.log('\n' + '─'.repeat(80));
    console.log(`  Collection complete: ${snapshots.length} viewport snapshots captured`);
    console.log(`  Steps taken: ${collectionStep}/${maxCollectionSteps}`);
    console.log('═'.repeat(80) + '\n');

    return snapshots;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Phase 25f: Deterministic Collection (T499)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Phase 25f (T499): Deterministic collection without LLM calls
   * Phase 25i (T541-T542): Integrated with cheap validator and LLM QA
   *
   * Scrolls through the page and captures viewport snapshots without any LLM guidance.
   * After collection, runs cheap validator to detect quality issues.
   * If issues found, optionally escalates to LLM QA for detailed analysis.
   *
   * @param page - Playwright page instance
   * @param pageHeight - Total page height
   * @param viewportHeight - Viewport height (default: 720)
   * @param skipCollectionQA - Skip LLM QA even if cheap validator flags issues (default: false)
   * @returns Array of collected viewport snapshots
   */
  private async runDeterministicCollection(
    page: Page,
    pageHeight: number,
    viewportHeight: number = 720,
    skipCollectionQA: boolean = false
  ): Promise<ViewportSnapshot[]> {
    const snapshots: ViewportSnapshot[] = [];
    const collectedSignals: ViewportValidatorSignals[] = [];
    const overlapPx = 120; // Overlap between viewports
    const scrollStep = viewportHeight - overlapPx;
    const viewportCount = Math.ceil(pageHeight / scrollStep);

    console.log('\n' + '═'.repeat(80));
    console.log('  Phase 25f: DETERMINISTIC COLLECTION (NO LLM)');
    console.log('═'.repeat(80));
    console.log(`  → Page height: ${pageHeight}px`);
    console.log(`  → Viewport height: ${viewportHeight}px`);
    console.log(`  → Scroll step: ${scrollStep}px (with ${overlapPx}px overlap)`);
    console.log(`  → Expected viewports: ${viewportCount}`);

    // Phase 25h (T524): Suppress UI noise before collection
    const suppressionResult = await suppressUINoiseElements(page);
    if (suppressionResult.suppressedCount > 0) {
      console.log(`  → ${c.success('✓')} UI noise suppressed: ${suppressionResult.suppressedCount} elements`);
      if (suppressionResult.suppressedCategories.length > 0) {
        console.log(`  → Categories: ${suppressionResult.suppressedCategories.join(', ')}`);
      }
    }

    // DOM serializer config (same as capture-viewport-tool)
    const DOM_TOKEN_BUDGET = 2000;
    const COMPRESSED_IMAGE_WIDTH = 384;
    const JPEG_QUALITY = 50;

    // Phase 25-fix: Reliable scroll to top with verification
    await this.scrollToPositionWithVerification(page, 0);

    for (let i = 0; i < viewportCount; i++) {
      const targetScrollY = i * scrollStep;
      const isFirstViewport = i === 0;

      console.log(`\n  ┌─ VIEWPORT ${i + 1}/${viewportCount} ${'─'.repeat(50)}`);
      console.log(`  │ Target scroll: ${targetScrollY}px`);

      // Phase 25-fix: Reliable scroll with verification
      const actualScrollY = await this.scrollToPositionWithVerification(page, targetScrollY);

      // Phase 25h (T524): Refresh UI noise suppression after scroll (overlays may reappear)
      if (!isFirstViewport) {
        const refreshResult = await refreshSuppression(page);
        if (refreshResult.count > 0) {
          console.log(`  │ → Refreshed suppression: ${refreshResult.count} elements hidden`);
        }
      }

      // Phase 25h (T526): Wait for media readiness before capture
      const readinessResult = await waitForMediaReadiness(page, {
        timeoutMs: 2000, // Don't wait too long per viewport
        minImageSize: 50,
      });
      if (readinessResult.waitTimeMs > 100) {
        console.log(`  │ → Media readiness: ${readinessResult.imagesLoaded}/${readinessResult.imagesChecked} images loaded (${readinessResult.waitTimeMs}ms)`);
      }
      if (readinessResult.timedOut && readinessResult.imagesPending > 0) {
        console.log(`  │ → ${c.warn('⚠')} ${readinessResult.imagesPending} images still loading (timeout)`);
      }

      // Get viewport info
      const viewportInfo = await page.evaluate(`(() => ({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
      }))()`);
      const { viewportWidth, viewportHeight: actualViewportHeight, devicePixelRatio } =
        viewportInfo as {
          viewportWidth: number;
          viewportHeight: number;
          devicePixelRatio: number;
        };

      const viewport = {
        width: viewportWidth,
        height: actualViewportHeight,
        deviceScaleFactor: devicePixelRatio,
        isMobile: viewportWidth < 768,
      };

      // Capture screenshot (full resolution PNG)
      const rawScreenshotBuffer = await page.screenshot({
        type: 'png',
        fullPage: false,
      });

      // Phase 25-fix: Store full resolution for evidence
      const fullResolutionBase64 = rawScreenshotBuffer.toString('base64');

      // Annotate fold line on first viewport (only if actually at top)
      let screenshotBuffer = rawScreenshotBuffer;
      if (isFirstViewport && actualScrollY === 0) {
        try {
          const { annotateFoldLine } = await import('../output/screenshot-annotator.js');
          const foldResult = await annotateFoldLine(rawScreenshotBuffer, {
            viewportHeight: actualViewportHeight,
            showLabel: true,
          });
          if (foldResult.success && foldResult.annotatedBuffer) {
            screenshotBuffer = foldResult.annotatedBuffer;
            console.log(`  │ ${c.success('✓')} Fold line annotated at ${actualViewportHeight}px`);
          }
        } catch {
          // Continue without annotation
        }
      }

      // Compress screenshot for LLM (smaller = fewer tokens = lower cost)
      const compressedBuffer = await sharp(screenshotBuffer)
        .resize(COMPRESSED_IMAGE_WIDTH, null, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();

      const screenshotBase64 = compressedBuffer.toString('base64');

      // Extract and serialize DOM
      const extractor = new DOMExtractor();
      const serializer = new DOMSerializer({ maxTokens: DOM_TOKEN_BUDGET });
      const domTree = await extractor.extract(page);
      const serialized = serializer.serialize(domTree);

      // Map elements to screenshot coordinates (with viewportId like V0-0, V1-0, etc.)
      const elementMappings = mapElementsToScreenshot(domTree, actualScrollY, viewport, i);
      const visibleElements = filterVisibleElements(elementMappings);

      // Create snapshot with both compressed and full resolution screenshots
      const snapshot: ViewportSnapshot = {
        scrollPosition: actualScrollY,
        viewportIndex: i,
        screenshot: {
          base64: screenshotBase64,
          capturedAt: Date.now(),
        },
        dom: {
          serialized: serialized.text,
          elementCount: serialized.elementCount,
        },
        elementMappings,
        visibleElements,
        // Phase 25-fix: Full resolution for evidence files
        fullResolutionBase64,
      };

      snapshots.push(snapshot);

      // Phase 25i (T536): Collect validator signals for this viewport
      const scrollVerified = Math.abs(actualScrollY - targetScrollY) <= 5;
      const signals = await collectViewportSignals(
        page,
        i,
        readinessResult.timedOut,
        scrollVerified
      );
      collectedSignals.push(signals);

      console.log(`  │ ${c.success('✓')} Captured at ${actualScrollY}px`);
      console.log(`  │ → DOM elements: ${snapshot.dom.elementCount}`);
      console.log(`  │ → Visible elements: ${visibleElements.length}`);
      console.log(`  │ → Screenshot: ${(compressedBuffer.length / 1024).toFixed(1)}KB (LLM), ${(rawScreenshotBuffer.length / 1024).toFixed(1)}KB (evidence)`);

      // Log signal summary if issues detected
      if (signals.spinnerDetected || signals.skeletonDetected || signals.blankImageCount > 0) {
        const issues: string[] = [];
        if (signals.spinnerDetected) issues.push('spinner');
        if (signals.skeletonDetected) issues.push('skeleton');
        if (signals.blankImageCount > 0) issues.push(`${signals.blankImageCount} blank imgs`);
        console.log(`  │ → ${c.warn('⚠')} Signals: ${issues.join(', ')}`);
      }

      console.log(`  └${'─'.repeat(70)}`);

      // Small delay between captures
      await this.sleep(100);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // Phase 25i (T541-T542): Run cheap validator and optional LLM QA
    // ═══════════════════════════════════════════════════════════════════════════════
    console.log('\n' + '─'.repeat(80));
    console.log('  Phase 25i: COLLECTION QUALITY VALIDATION');
    console.log('─'.repeat(80));

    // Run cheap validator (0 LLM calls)
    const validationResult = runCheapValidator(collectedSignals);
    console.log(`  → Cheap validator: ${validationResult.passed ? c.success('PASSED') : c.warn('FLAGGED')}`);
    console.log(`  → Quality score: ${validationResult.qualityScore}/100`);

    if (validationResult.flags.length > 0) {
      for (const flag of validationResult.flags.slice(0, 3)) {
        console.log(`  → ${c.warn('⚠')} ${flag}`);
      }
    }

    // Run LLM QA if needed (unless skipped)
    if (!validationResult.passed && shouldRunLLMQA(validationResult) && !skipCollectionQA) {
      console.log(`  → Running LLM QA on ${validationResult.recheckIndices.length} flagged viewport(s)...`);

      try {
        // Prepare summaries and screenshots for LLM
        const summaries: ViewportSummary[] = collectedSignals.map((signal, idx) => ({
          index: signal.viewportIndex,
          scrollY: snapshots[idx]?.scrollPosition || 0,
          elementCount: snapshots[idx]?.dom.elementCount || 0,
          issues: validationResult.viewportResults[idx]?.issues || [],
          imageStats: {
            total: signal.totalImages,
            loaded: signal.loadedImages,
            pending: signal.lazyPendingCount,
            failed: signal.failedImages,
          },
        }));

        // Get full-res screenshots for flagged viewports
        const flaggedScreenshots: Buffer[] = [];
        for (const idx of validationResult.recheckIndices) {
          const snapshot = snapshots[idx];
          if (snapshot?.fullResolutionBase64) {
            flaggedScreenshots.push(Buffer.from(snapshot.fullResolutionBase64, 'base64'));
          }
        }

        // Run LLM QA
        const qaResult = await runLLMQA(
          summaries.filter((_, i) => validationResult.recheckIndices.includes(i)),
          validationResult.flags,
          flaggedScreenshots
        );

        console.log(`  → LLM QA: ${qaResult.valid ? c.success('VALID') : c.warn('NEEDS RECHECK')}`);
        console.log(`  → Analysis time: ${qaResult.analysisTimeMs}ms`);

        if (qaResult.notes) {
          console.log(`  → Notes: ${qaResult.notes}`);
        }

        // Recheck viewports if needed
        if (qaResult.recheck.length > 0 && !skipCollectionQA) {
          console.log(`  → Rechecking ${qaResult.recheck.length} viewport(s)...`);
          const recheckedSnapshots = await this.recheckViewports(
            page,
            qaResult.recheck,
            viewportHeight
          );

          // Merge rechecked snapshots into original array
          for (const rechecked of recheckedSnapshots) {
            const idx = rechecked.viewportIndex;
            if (idx >= 0 && idx < snapshots.length) {
              snapshots[idx] = rechecked;
              console.log(`  → ${c.success('✓')} Viewport ${idx} recaptured`);
            }
          }
        }
      } catch (qaError) {
        const errMsg = qaError instanceof Error ? qaError.message : 'Unknown error';
        console.log(`  → ${c.error('✗')} LLM QA failed: ${errMsg}`);
        // Continue with original snapshots
      }
    } else if (skipCollectionQA && !validationResult.passed) {
      console.log(`  → ${c.dim('LLM QA skipped (--skip-collection-qa)')} `);
    }

    // Log collection summary
    console.log('\n' + '─'.repeat(80));
    console.log(`  ${c.success('✓')} Deterministic collection complete`);
    console.log(`  → ${snapshots.length} viewport snapshots captured`);
    console.log(`  → No LLM calls used (faster, cheaper)`);
    console.log('═'.repeat(80) + '\n');

    return snapshots;
  }

  /**
   * Phase 25-fix: Reliable scroll with verification and retry
   *
   * Scrolls to target position and verifies it was reached.
   * Retries with different methods if initial scroll fails.
   *
   * @param page - Playwright page
   * @param targetY - Target scroll Y position
   * @param maxRetries - Maximum retry attempts (default: 3)
   * @returns Actual scroll position achieved
   */
  private async scrollToPositionWithVerification(
    page: Page,
    targetY: number,
    maxRetries: number = 3
  ): Promise<number> {
    const tolerance = 5; // Allow 5px tolerance

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Try different scroll methods based on attempt number
      if (attempt === 0) {
        // Method 1: Standard scrollTo with instant behavior
        await page.evaluate(`window.scrollTo({ top: ${targetY}, behavior: 'instant' })`);
      } else if (attempt === 1) {
        // Method 2: Direct assignment to scrollY
        await page.evaluate(`document.documentElement.scrollTop = ${targetY}`);
        await page.evaluate(`document.body.scrollTop = ${targetY}`);
      } else {
        // Method 3: scrollIntoView for first element at target position
        await page.evaluate(`
          const el = document.elementFromPoint(window.innerWidth / 2, 10);
          if (el) {
            window.scrollTo({ top: ${targetY}, behavior: 'instant' });
          }
        `);
      }

      // Wait for scroll to complete
      await this.sleep(150);

      // Verify scroll position
      const actualY = await page.evaluate('window.scrollY') as number;

      if (Math.abs(actualY - targetY) <= tolerance) {
        return actualY;
      }

      // Log retry if not first attempt
      if (attempt > 0) {
        this.logger.debug(`Scroll retry ${attempt + 1}: target=${targetY}, actual=${actualY}`);
      }
    }

    // Return whatever position we ended up at
    const finalY = await page.evaluate('window.scrollY') as number;
    this.logger.warn(`Scroll verification failed: target=${targetY}, actual=${finalY}`);
    return finalY;
  }

  /**
   * Phase 25i (T541): Recheck viewports that failed validation
   *
   * Recaptures specific viewports with extended timeouts and additional
   * waiting based on hints from LLM QA analysis.
   *
   * @param page - Playwright page instance
   * @param rechecks - Array of recheck instructions from LLM QA
   * @param viewportHeight - Viewport height for scroll calculation
   * @returns Array of recaptured viewport snapshots
   */
  private async recheckViewports(
    page: Page,
    rechecks: Array<{ index: number; reason: string; hint: string }>,
    viewportHeight: number
  ): Promise<ViewportSnapshot[]> {
    const recheckedSnapshots: ViewportSnapshot[] = [];
    const overlapPx = 120;
    const scrollStep = viewportHeight - overlapPx;

    // DOM serializer config
    const DOM_TOKEN_BUDGET = 2000;
    const COMPRESSED_IMAGE_WIDTH = 384;
    const JPEG_QUALITY = 50;

    for (const recheck of rechecks) {
      const { index, hint } = recheck;
      const targetScrollY = index * scrollStep;

      this.logger.debug('Rechecking viewport', { index, hint, targetScrollY });

      // Scroll to viewport
      const actualScrollY = await this.scrollToPositionWithVerification(page, targetScrollY);

      // Apply hint-based actions
      if (hint === 'wait_longer' || hint === 'extended_timeout') {
        // Extended wait for lazy content
        await waitForMediaReadiness(page, {
          timeoutMs: 5000, // Extended timeout
          minImageSize: 30,
        });
        await this.sleep(1000); // Additional settle time
      } else if (hint === 'scroll_adjust') {
        // Small scroll adjustment to trigger lazy loading
        await page.evaluate(`window.scrollBy(0, 50)`);
        await this.sleep(200);
        await page.evaluate(`window.scrollBy(0, -50)`);
        await this.sleep(500);
      } else if (hint === 'refresh') {
        // Refresh suppression in case overlays returned
        await refreshSuppression(page);
        await this.sleep(300);
      }

      // Get viewport info
      const viewportInfo = await page.evaluate(`(() => ({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
      }))()`);
      const { viewportWidth, viewportHeight: actualViewportHeight, devicePixelRatio } =
        viewportInfo as {
          viewportWidth: number;
          viewportHeight: number;
          devicePixelRatio: number;
        };

      const viewport = {
        width: viewportWidth,
        height: actualViewportHeight,
        deviceScaleFactor: devicePixelRatio,
        isMobile: viewportWidth < 768,
      };

      // Capture screenshot
      const rawScreenshotBuffer = await page.screenshot({
        type: 'png',
        fullPage: false,
      });

      const fullResolutionBase64 = rawScreenshotBuffer.toString('base64');

      // Compress for LLM
      const compressedBuffer = await sharp(rawScreenshotBuffer)
        .resize(COMPRESSED_IMAGE_WIDTH, null, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();

      const screenshotBase64 = compressedBuffer.toString('base64');

      // Extract DOM
      const extractor = new DOMExtractor();
      const serializer = new DOMSerializer({ maxTokens: DOM_TOKEN_BUDGET });
      const domTree = await extractor.extract(page);
      const serialized = serializer.serialize(domTree);

      // Map elements
      const elementMappings = mapElementsToScreenshot(domTree, actualScrollY, viewport, index);
      const visibleElements = filterVisibleElements(elementMappings);

      // Create snapshot
      const snapshot: ViewportSnapshot = {
        scrollPosition: actualScrollY,
        viewportIndex: index,
        screenshot: {
          base64: screenshotBase64,
          capturedAt: Date.now(),
        },
        dom: {
          serialized: serialized.text,
          elementCount: serialized.elementCount,
        },
        elementMappings,
        visibleElements,
        fullResolutionBase64,
      };

      recheckedSnapshots.push(snapshot);
    }

    return recheckedSnapshots;
  }
}
