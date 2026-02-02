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
import { DOMExtractor, DOMMerger } from '../browser/dom/index.js';
import { ToolRegistry, ToolExecutor } from './tools/index.js';
import { PromptBuilder } from './prompt-builder.js';
import { MessageManager } from './message-manager.js';
import { StateManager } from './state-manager.js';
import { CoverageTracker } from './coverage-tracker.js';
import { createCRORegistry } from './tools/create-cro-registry.js';
import { createLogger } from '../utils/index.js';
import type { DEFAULT_BROWSER_CONFIG } from '../types/index.js';

// Phase 18e: Post-processing imports
import {
  BusinessTypeDetector,
  createHeuristicEngine,
  // Phase 21d: Vision analysis imports (used internally, not exposed to CLI)
  createPageTypeDetector,
  createCROVisionAnalyzer,
  isPageTypeSupported,
  type CROVisionAnalysisResult,
  type CROVisionAnalyzerConfig,
  // CR-001-C: Analysis orchestrator for category-based evaluation
  createAnalysisOrchestrator,
  type AnalysisResult,
  // NOTE: Multi-viewport vision has been removed per CR-001
  // Use --vision-agent mode for all vision analysis
} from '../heuristics/index.js';

// Phase 21g: Vision Agent imports
import {
  createVisionAgent,
  type VisionAgentResult,
} from './vision/index.js';
import {
  InsightDeduplicator,
  InsightPrioritizer,
  HypothesisGenerator,
  MarkdownReporter,
  JSONExporter,
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
 */
export interface CROAnalysisResult {
  /** URL that was analyzed */
  url: string;
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
  /** Vision analysis result (Phase 21d) */
  visionAnalysis?: CROVisionAnalysisResult;
  /** Vision Agent result (Phase 21g) */
  visionAgentResult?: VisionAgentResult;
  /** CR-001-C: Unified analysis result from orchestrator */
  unifiedAnalysisResult?: AnalysisResult;
  /** Phase 21j: Viewport snapshots from unified collection phase */
  snapshots?: ViewportSnapshot[];
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
 * Phase 21e (T325): Added full-page vision options
 * CR-001-B: Added unified mode options
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
  /** Skip only heuristic rules - keeps other post-processing (default: false) */
  skipHeuristics?: boolean;
  /** Scan mode: 'full_page' (default), 'above_fold', or 'llm_guided' */
  scanMode?: ScanMode;
  /** Coverage configuration for full_page mode */
  coverageConfig?: Partial<CoverageConfig>;
  /** Phase 21d: Enable vision analysis for supported page types (default: true) */
  useVisionAnalysis?: boolean;
  /** Vision model to use */
  visionModel?: 'gpt-4o' | 'gpt-4o-mini';
  /** Custom vision analyzer config */
  visionConfig?: Partial<CROVisionAnalyzerConfig>;
  // NOTE: fullPageVision, visionMaxViewports, parallelVision have been removed per CR-001
  // Use --vision-agent mode for all vision analysis
  /** Enable Vision Agent mode with DOM + Vision parallel context (default: false) */
  visionAgentMode?: boolean;
  /** Maximum steps for Vision Agent (default: 20) */
  visionAgentMaxSteps?: number;
  // CR-001-B: Unified collection + analysis mode
  /** Enable unified collection→analysis mode (default: false, uses legacy Vision Agent) */
  enableUnifiedMode?: boolean;
  /** Enable vision capture during collection (default: true when visionAgentMode is true) */
  enableVision?: boolean;
  /** Filter analysis to specific heuristic categories */
  heuristicCategories?: string[];
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

    if (verbose) {
      this.logger.setVerbose(true);
    }

    this.logger.info('Starting CRO analysis', { url, options: this.options });

    try {
      // ═══════════════════════════════════════════════════════════════════════════
      // PHASE 3: Browser Initialization & Page Loading
      // ═══════════════════════════════════════════════════════════════════════════
      console.log('\n' + '═'.repeat(80));
      console.log('  PHASE 3: BROWSER INITIALIZATION & PAGE LOADING');
      console.log('═'.repeat(80));
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
      // PHASE 21: VISION ANALYSIS (T315, T325, T349)
      // ═══════════════════════════════════════════════════════════════════════════
      const useVision = analyzeOptions?.useVisionAnalysis ?? true;
      const useVisionAgentMode = analyzeOptions?.visionAgentMode ?? false;
      let detectedPageType: PageType | undefined;
      let visionAnalysis: CROVisionAnalysisResult | undefined;
      let visionAgentResult: VisionAgentResult | undefined;
      let visionInsights: CROInsight[] = [];
      let screenshotBase64: string | undefined;
      // CR-001-C: Flag to skip agent loop when unified analysis completes
      let unifiedAnalysisComplete = false;
      // CR-001-C: Store unified analysis result for report metadata
      let unifiedAnalysisResult: AnalysisResult | undefined;
      // Phase 21j: Store collected snapshots for return
      let collectedViewportSnapshots: ViewportSnapshot[] = [];

      if (useVision) {
        const visionModeLabel = useVisionAgentMode ? 'VISION AGENT (DOM + VISION)' : 'SINGLE VIEWPORT';
        console.log('═'.repeat(80));
        console.log(`  PHASE 21: VISION ANALYSIS (${visionModeLabel})`);
        console.log('═'.repeat(80));

        // 21a. Detect page type
        console.log('\n  ┌─ PHASE 21a: Page Type Detection ──────────────────────────────');
        const pageTypeDetector = createPageTypeDetector();
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
        const pageTypeResult = pageTypeDetector.detect(pageTypeState);
        detectedPageType = pageTypeResult.type;
        console.log(`  │ ${c.success('✓')} Detected: ${pageTypeResult.type} (confidence: ${(pageTypeResult.confidence * 100).toFixed(0)}%)`);
        console.log(`  │ → Signals: ${pageTypeResult.signals.slice(0, 3).join(', ')}${pageTypeResult.signals.length > 3 ? '...' : ''}`);
        console.log(`  └${'─'.repeat(60)}`);

        // 21b. Check if vision analysis is supported for this page type
        if (isPageTypeSupported(detectedPageType)) {
          const viewport = {
            width: viewportSize.width,
            height: viewportSize.height,
            deviceScaleFactor: 1,
            isMobile: false,
          };

          // Phase 21g / CR-001-B: Vision Agent mode (DOM + Vision parallel context)
          // CR-001-B: Use unified collection + analysis flow when enableUnifiedMode is true
          const useUnifiedMode = analyzeOptions?.enableUnifiedMode ?? false;

          if (useVisionAgentMode) {
            // CR-001-B: Unified collection + analysis flow
            if (useUnifiedMode && isPageTypeSupported(detectedPageType)) {
              console.log('\n  ┌─ CR-001-B: UNIFIED COLLECTION + ANALYSIS ─────────────────');
              console.log(`  │ → Page Type: ${detectedPageType.toUpperCase()}`);

              // Initialize components for collection
              const registry = analyzeOptions?.registry ?? createCRORegistry();
              const collectionStateManager = new StateManager(this.options, scanMode);
              collectionStateManager.setPageHeight(pageHeight);

              // Run collection phase
              const collectedSnapshots = await this.runCollectionPhase(
                page,
                domTree,
                url,
                pageTitle,
                collectionStateManager,
                registry,
                verbose
              );

              console.log(`  │ ${c.success('✓')} Collection complete: ${collectedSnapshots.length} snapshots`);

              // Phase 21j: Store snapshots for return
              collectedViewportSnapshots = collectedSnapshots;

              // CR-001-C: Run category-based analysis on collected snapshots using orchestrator
              if (collectedSnapshots.length > 0) {
                console.log(`  │ → Running category-based analysis on collected snapshots...`);
                const visionModel = analyzeOptions?.visionModel ?? 'gpt-4o-mini';

                try {
                  // Create analysis orchestrator with category filtering if specified
                  const orchestrator = createAnalysisOrchestrator({
                    analyzerConfig: { model: visionModel },
                    includeCategories: analyzeOptions?.heuristicCategories,
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

                  // CR-001-C: Mark unified analysis as complete - skip agent loop
                  unifiedAnalysisComplete = true;
                  // CR-001-C: Store result for report metadata
                  unifiedAnalysisResult = analysisResult;
                } catch (analysisError) {
                  const errMsg = analysisError instanceof Error ? analysisError.message : 'Analysis failed';
                  console.log(`  │ ${c.error('✗ Analysis failed:')} ${errMsg}`);
                  errors.push(`UnifiedAnalysis: ${errMsg}`);
                }
              }
              console.log(`  └${'─'.repeat(60)}`);
            } else {
              // Original Vision Agent mode
              console.log('\n  ┌─ PHASE 21g: Vision Agent (DOM + Vision) ───────────────────');
              const visionModel = analyzeOptions?.visionModel ?? 'gpt-4o-mini';
              const maxSteps = analyzeOptions?.visionAgentMaxSteps ?? 20;

              console.log(`  │ → Model: ${visionModel}, Max Steps: ${maxSteps}`);
              console.log(`  │ → Page Type: ${detectedPageType.toUpperCase()}`);

              try {
                const visionAgent = createVisionAgent({
                  model: visionModel,
                  maxSteps,
                  verbose,
                });

                console.log(`  │ → Starting observe-reason-act loop...`);
                visionAgentResult = await visionAgent.analyze(page, detectedPageType);
                visionInsights = visionAgentResult.insights;

              const { summary } = visionAgentResult;
              console.log(`  │ ${c.success('✓')} Vision Agent complete (${visionAgentResult.durationMs}ms)`);
              console.log(`  │ → Steps: ${visionAgentResult.stepCount}, Viewports: ${visionAgentResult.viewportCount}`);
              console.log(`  │ → Coverage: ${summary.coveragePercent.toFixed(0)}% (${summary.evaluated}/${summary.totalHeuristics} heuristics)`);
              console.log(`  │ → Heuristics: ${summary.passed} passed, ${summary.failed} failed, ${summary.partial} partial`);
              console.log(`  │ → Issues by severity: Critical ${summary.bySeverity.critical}, High ${summary.bySeverity.high}, Medium ${summary.bySeverity.medium}, Low ${summary.bySeverity.low}`);
              console.log(`  │ → Termination: ${visionAgentResult.terminationReason}`);

              if (visionInsights.length > 0) {
                console.log(`  │ → Vision insights:`);
                for (const insight of visionInsights.slice(0, 3)) {
                  console.log(`  │   • ${c.severity(insight.severity)} [${insight.heuristicId}] ${insight.issue?.slice(0, 40)}...`);
                }
                if (visionInsights.length > 3) {
                  console.log(`  │   ... and ${visionInsights.length - 3} more`);
                }
              }
              } catch (visionError) {
                const errMsg = visionError instanceof Error ? visionError.message : 'Vision Agent failed';
                console.log(`  │ ${c.error('✗ Vision Agent failed:')} ${errMsg}`);
                errors.push(`VisionAgent: ${errMsg}`);
                this.logger.warn('Vision Agent failed', { error: errMsg });
              }
              console.log(`  └${'─'.repeat(60)}`);
            }
          } else {
            // Single viewport vision (original behavior)
            // NOTE: Full-page multi-viewport mode has been removed per CR-001
            // Use --vision-agent for comprehensive analysis
            console.log('\n  ┌─ PHASE 21b: Screenshot Capture ─────────────────────────────');
            // Scroll to top for screenshot
            await page.evaluate('window.scrollTo(0, 0)');
            await this.sleep(300);

            // Capture screenshot as base64
            const screenshotBuffer = await page.screenshot({
              type: 'png',
              fullPage: false, // Capture viewport only for vision analysis
            });
            screenshotBase64 = screenshotBuffer.toString('base64');
            console.log(`  │ ${c.success('✓')} Screenshot captured (${(screenshotBuffer.length / 1024).toFixed(1)}KB)`);
            console.log(`  └${'─'.repeat(60)}`);

            // 21c. Run vision analysis
            console.log('\n  ┌─ PHASE 21c: Vision Analysis ────────────────────────────────');
            const visionModel = analyzeOptions?.visionModel ?? 'gpt-4o-mini';
            const visionConfig = {
              model: visionModel,
              ...analyzeOptions?.visionConfig,
            };

            try {
              const visionAnalyzer = createCROVisionAnalyzer(visionConfig);

              console.log(`  │ → Analyzing against ${detectedPageType.toUpperCase()} heuristics using ${visionModel}...`);
              visionAnalysis = await visionAnalyzer.analyze(screenshotBase64, detectedPageType, viewport);
              visionInsights = visionAnalysis.insights;

              const { summary } = visionAnalysis;
              console.log(`  │ ${c.success('✓')} Vision analysis complete`);
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
            } catch (visionError) {
              const errMsg = visionError instanceof Error ? visionError.message : 'Vision analysis failed';
              console.log(`  │ ${c.error('✗ Vision analysis failed:')} ${errMsg}`);
              errors.push(`Vision: ${errMsg}`);
              this.logger.warn('Vision analysis failed', { error: errMsg });
            }
            console.log(`  └${'─'.repeat(60)}`);
          }
        } else {
          console.log(`\n  ┌─ PHASE 21b-c: Vision Analysis ─────────────────────────────`);
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

        // 3b. Run heuristic rules (optional)
        if (!analyzeOptions?.skipHeuristics) {
          console.log('\n  ┌─ PHASE 18b-c: Heuristic Rules Engine ────────────────────────');
          const heuristicEngine = createHeuristicEngine();
          const heuristicResult = heuristicEngine.run(finalPageState, businessType.type);
          heuristicInsights = heuristicResult.insights;
          console.log(`  │ ${c.success('✓')} Rules executed: ${heuristicResult.rulesExecuted}`);
          console.log(`  │ → Heuristic insights found: ${heuristicInsights.length}`);
          if (heuristicInsights.length > 0) {
            for (const insight of heuristicInsights.slice(0, 3)) {
              console.log(`  │   • ${c.severity(insight.severity)} ${insight.type}: ${insight.issue.slice(0, 40)}...`);
            }
          }
          console.log(`  └${'─'.repeat(60)}`);
          this.logger.debug('Heuristics executed', {
            rulesExecuted: heuristicResult.rulesExecuted,
            insightsFound: heuristicInsights.length,
          });
        } else {
          console.log('\n  ┌─ PHASE 18b-c: Heuristic Rules Engine ────────────────────────');
          console.log(`  │ ${c.warn('⏭ SKIPPED')} (skipHeuristics: true)`);
          console.log(`  └${'─'.repeat(60)}`);
          this.logger.info('Heuristics skipped by user option');
        }

        // 3c. Combine and deduplicate insights (include vision insights)
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
          const reportInput = {
            url,
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
        success: true,
        insights: toolInsights,
        heuristicInsights,
        visionInsights,
        businessType,
        pageType: detectedPageType,
        visionAnalysis,
        visionAgentResult,
        unifiedAnalysisResult,
        // Phase 21j: Include collected viewport snapshots
        snapshots: collectedViewportSnapshots.length > 0 ? collectedViewportSnapshots : visionAgentResult?.snapshots,
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
      console.log('║    Phase 18b (Heuristic) → ' + `${result.heuristicInsights.length} rule-based insights`.padEnd(49) + '║');
      console.log('║    Phase 18d (Output)    → ' + `${result.hypotheses.length} hypotheses, score ${result.scores.overall}`.padEnd(49) + '║');
      console.log('╚' + '═'.repeat(78) + '╝\n');

      this.logger.info('Analysis complete', {
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
        success: false,
        insights: [],
        heuristicInsights: [],
        visionInsights: [],
        businessType: undefined,
        pageType: undefined,
        visionAnalysis: undefined,
        visionAgentResult: undefined,
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
    const maxCollectionSteps = 10; // Limit collection phase steps
    const snapshots: ViewportSnapshot[] = [];

    console.log('\n' + '═'.repeat(80));
    console.log('  CR-001-B: COLLECTION PHASE (VISION DATA CAPTURE)');
    console.log('═'.repeat(80));
    console.log('  → Capturing viewport snapshots as agent scrolls through page');
    console.log(`  → Max steps: ${maxCollectionSteps}`);

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
}
