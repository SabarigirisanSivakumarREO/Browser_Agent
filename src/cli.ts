#!/usr/bin/env node
/**
 * Browser Agent CLI - Phase 18-CLI
 *
 * Command-line interface for the CRO browser automation agent.
 * Default mode: CRO analysis with heuristics and hypothesis generation.
 */

import { config } from 'dotenv';
import { BrowserManager, PageLoader } from './browser/index.js';
import { CookieConsentHandler } from './browser/cookie-handler.js';
import { DOMExtractor } from './browser/dom/index.js';
import {
  ToolResultFormatter,
  AgentProgressFormatter,
  FileWriter,
  MarkdownReporter,
  JSONExporter,
  ScreenshotWriter,
  ScreenshotAnnotator,
  type ToolExecutionResult,
} from './output/index.js';
import { createCRORegistry, ToolExecutor } from './agent/tools/index.js';
import { CROAgent, type CROAnalysisResult, type CROScores } from './agent/index.js';
// Note: createVisionAgent deprecated in Phase 21j - CROAgent unified mode is used instead
import type { CROActionName, PageState, ScanMode, CoverageConfig } from './models/index.js';
import { CROActionNames, DEFAULT_COVERAGE_CONFIG } from './models/index.js';
import type { WaitUntilStrategy } from './types/index.js';

// Load environment variables from .env file
config();

const VALID_WAIT_STRATEGIES: WaitUntilStrategy[] = ['load', 'domcontentloaded', 'networkidle'];
const VALID_TOOL_NAMES = CROActionNames;
const VALID_OUTPUT_FORMATS = ['console', 'markdown', 'json'] as const;
type OutputFormat = typeof VALID_OUTPUT_FORMATS[number];
const VALID_SCAN_MODES: ScanMode[] = ['full_page', 'above_fold', 'llm_guided'];
const VALID_VISION_MODELS = ['gpt-4o', 'gpt-4o-mini'] as const;
type VisionModel = typeof VALID_VISION_MODELS[number];

/**
 * Parses command-line arguments.
 */
function parseArgs(): {
  urls: string[];
  headless: boolean;
  timeout: number;
  waitUntil: WaitUntilStrategy;
  postLoadWait: number;
  dismissCookieConsent: boolean;
  outputFormat: OutputFormat;
  outputFile: string | null;
  maxSteps: number;
  toolName: CROActionName | null;
  scanMode: ScanMode;
  minCoverage: number;
  visionModel: VisionModel;
  visionAgent: boolean;  // Phase 21g: Iterative vision agent mode (THE ONE MODE)
  visionAgentMaxSteps: number;  // Phase 21g: Max steps for vision agent
  saveEvidence: boolean;  // Phase 21h: Save screenshots as evidence
  evidenceDir: string;  // Phase 21h: Directory for evidence files
  annotateScreenshots: boolean;  // Phase 21i: Annotate screenshots with bounding boxes
  verbose: boolean;
  help: boolean;
} {
  const args = process.argv.slice(2);
  const urls: string[] = [];
  let headless = false;
  let timeout = 60000;
  let waitUntil: WaitUntilStrategy = 'load';
  let postLoadWait = 5000;
  let dismissCookieConsent = true;
  let outputFormat: OutputFormat = 'console';
  let outputFile: string | null = null;
  let maxSteps = 10;
  let toolName: CROActionName | null = null;
  let scanMode: ScanMode = 'full_page';
  let minCoverage = 100;
  let visionModel: VisionModel = 'gpt-4o-mini';  // Default vision model (cost-optimized)
  let visionAgent = false;  // Vision agent mode (THE ONE MODE for vision analysis)
  let visionAgentMaxSteps = 20;  // Max steps for vision agent
  let saveEvidence = false;  // Phase 21h: Save screenshots as evidence
  let evidenceDir = './evidence';  // Phase 21h: Evidence output directory
  let annotateScreenshots = false;  // Phase 21i: Annotate screenshots with bounding boxes
  let verbose = false;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--headless') {
      headless = true;
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg === '--output-format' && args[i + 1]) {
      const format = args[i + 1] as OutputFormat;
      if (VALID_OUTPUT_FORMATS.includes(format)) {
        outputFormat = format;
      } else {
        console.error(`Invalid output format: ${format}`);
        console.error(`Valid formats: ${VALID_OUTPUT_FORMATS.join(', ')}`);
        process.exit(1);
      }
      i++;
    } else if (arg === '--output-file' && args[i + 1]) {
      outputFile = args[i + 1] ?? null;
      i++;
    } else if (arg === '--max-steps' && args[i + 1]) {
      maxSteps = parseInt(args[i + 1] ?? '10', 10);
      if (isNaN(maxSteps) || maxSteps < 1 || maxSteps > 50) {
        console.error('Invalid max-steps value. Must be between 1 and 50.');
        process.exit(1);
      }
      i++;
    } else if (arg === '--tool' && args[i + 1]) {
      const name = args[i + 1] as CROActionName;
      if (VALID_TOOL_NAMES.includes(name)) {
        toolName = name;
      } else {
        console.error(`Invalid tool name: ${name}`);
        console.error(`Valid tools: ${VALID_TOOL_NAMES.join(', ')}`);
        process.exit(1);
      }
      i++;
    } else if (arg === '--timeout' && args[i + 1]) {
      timeout = parseInt(args[i + 1] ?? '60000', 10);
      i++;
    } else if (arg === '--wait-until' && args[i + 1]) {
      const strategy = args[i + 1] as WaitUntilStrategy;
      if (VALID_WAIT_STRATEGIES.includes(strategy)) {
        waitUntil = strategy;
      } else {
        console.error(`Invalid wait strategy: ${strategy}`);
        console.error(`Valid options: ${VALID_WAIT_STRATEGIES.join(', ')}`);
        process.exit(1);
      }
      i++;
    } else if (arg === '--post-load-wait' && args[i + 1]) {
      postLoadWait = parseInt(args[i + 1] ?? '5000', 10);
      i++;
    } else if (arg === '--no-cookie-dismiss') {
      dismissCookieConsent = false;
    } else if (arg === '--scan-mode' && args[i + 1]) {
      const mode = args[i + 1] as ScanMode;
      if (VALID_SCAN_MODES.includes(mode)) {
        scanMode = mode;
      } else {
        console.error(`Invalid scan mode: ${mode}`);
        console.error(`Valid modes: ${VALID_SCAN_MODES.join(', ')}`);
        process.exit(1);
      }
      i++;
    } else if (arg?.startsWith('--scan-mode=')) {
      const mode = arg.split('=')[1] as ScanMode;
      if (VALID_SCAN_MODES.includes(mode)) {
        scanMode = mode;
      } else {
        console.error(`Invalid scan mode: ${mode}`);
        console.error(`Valid modes: ${VALID_SCAN_MODES.join(', ')}`);
        process.exit(1);
      }
    } else if (arg === '--min-coverage' && args[i + 1]) {
      minCoverage = parseInt(args[i + 1] ?? '100', 10);
      if (isNaN(minCoverage) || minCoverage < 0 || minCoverage > 100) {
        console.error('Invalid min-coverage value. Must be between 0 and 100.');
        process.exit(1);
      }
      i++;
    } else if (arg?.startsWith('--min-coverage=')) {
      minCoverage = parseInt(arg.split('=')[1] ?? '100', 10);
      if (isNaN(minCoverage) || minCoverage < 0 || minCoverage > 100) {
        console.error('Invalid min-coverage value. Must be between 0 and 100.');
        process.exit(1);
      }
    } else if (arg === '--vision-model' && args[i + 1]) {
      // Phase 21d: Set vision model
      const model = args[i + 1] as VisionModel;
      if (VALID_VISION_MODELS.includes(model)) {
        visionModel = model;
      } else {
        console.error(`Invalid vision model: ${model}`);
        console.error(`Valid models: ${VALID_VISION_MODELS.join(', ')}`);
        process.exit(1);
      }
      i++;
    } else if (arg?.startsWith('--vision-model=')) {
      // Phase 21d: Set vision model (= syntax)
      const model = arg.split('=')[1] as VisionModel;
      if (VALID_VISION_MODELS.includes(model)) {
        visionModel = model;
      } else {
        console.error(`Invalid vision model: ${model}`);
        console.error(`Valid models: ${VALID_VISION_MODELS.join(', ')}`);
        process.exit(1);
      }
    } else if (arg === '--vision-agent') {
      // Enable vision agent mode (THE ONE MODE for vision analysis)
      visionAgent = true;
    } else if (arg === '--vision-agent-max-steps' && args[i + 1]) {
      // Phase 21g: Set max steps for vision agent
      visionAgentMaxSteps = parseInt(args[i + 1] ?? '20', 10);
      if (isNaN(visionAgentMaxSteps) || visionAgentMaxSteps < 1 || visionAgentMaxSteps > 50) {
        console.error('Invalid vision-agent-max-steps value. Must be between 1 and 50.');
        process.exit(1);
      }
      i++;
    } else if (arg?.startsWith('--vision-agent-max-steps=')) {
      // Phase 21g: Set max steps (= syntax)
      visionAgentMaxSteps = parseInt(arg.split('=')[1] ?? '20', 10);
      if (isNaN(visionAgentMaxSteps) || visionAgentMaxSteps < 1 || visionAgentMaxSteps > 50) {
        console.error('Invalid vision-agent-max-steps value. Must be between 1 and 50.');
        process.exit(1);
      }
    } else if (arg === '--save-evidence') {
      // Phase 21h: Enable evidence saving
      saveEvidence = true;
    } else if (arg === '--annotate-screenshots') {
      // Phase 21i: Enable screenshot annotation
      annotateScreenshots = true;
    } else if (arg === '--evidence-dir' && args[i + 1]) {
      // Phase 21h: Set evidence output directory
      evidenceDir = args[i + 1] ?? './evidence';
      i++;
    } else if (arg?.startsWith('--evidence-dir=')) {
      // Phase 21h: Set evidence directory (= syntax)
      evidenceDir = arg.split('=')[1] ?? './evidence';
    } else if (arg && !arg.startsWith('-')) {
      urls.push(arg);
    }
  }

  return {
    urls,
    headless,
    timeout,
    waitUntil,
    postLoadWait,
    dismissCookieConsent,
    outputFormat,
    outputFile,
    maxSteps,
    toolName,
    scanMode,
    minCoverage,
    visionModel,
    visionAgent,
    visionAgentMaxSteps,
    saveEvidence,
    evidenceDir,
    annotateScreenshots,
    verbose,
    help,
  };
}

/**
 * Prints help message.
 */
function printHelp(): void {
  console.log(`
CRO Browser Agent - Conversion Rate Optimization Analysis Tool

USAGE:
  npm run start -- [OPTIONS] <urls...>

ARGUMENTS:
  <urls...>               One or more URLs to analyze

OPTIONS:
  --headless              Run browser in headless mode (default: visible)
  --timeout <ms>          Page load timeout in milliseconds (default: 60000)
  --wait-until <str>      Page load wait strategy (default: load)
                          - load: Wait for load event (balanced, recommended)
                          - domcontentloaded: Wait for DOM ready (fastest)
                          - networkidle: Wait for no network activity (may timeout)
  --post-load-wait <ms>   Wait time for JS rendering after load (default: 5000)
                          Set to 0 to disable hybrid waiting
  --no-cookie-dismiss     Disable automatic cookie consent dismissal

CRO ANALYSIS OPTIONS:
  --output-format <fmt>   Output format: console, markdown, json (default: console)
  --output-file <path>    Write report to file (markdown/json based on format)
  --max-steps <n>         Maximum analysis steps (default: 10, max: 50)
  --scan-mode <mode>      Page scanning mode (default: full_page)
                          - full_page: Deterministic scan of every segment (100% coverage)
                          - above_fold: Quick scan of initial viewport only
                          - llm_guided: LLM decides scrolling (original behavior)
  --min-coverage <n>      Minimum coverage percentage required, 0-100 (default: 100)
                          Only applies to full_page mode
  --tool <name>           Execute specific CRO tool (for debugging)
                          Available: analyze_ctas, analyze_forms, detect_trust_signals,
                          assess_value_prop, check_navigation, find_friction,
                          scroll_page, go_to_url, done

VISION ANALYSIS OPTIONS:
  --vision-agent          Enable unified CRO analysis with vision (Phase 21j)
                          - Enforces full-page coverage (scrolls entire page)
                          - Captures DOM + screenshots at each viewport
                          - Maps DOM elements to screenshot coordinates
                          - Evaluates ALL heuristics systematically
                          - Uses category-based analysis for thoroughness
                          - Uses gpt-4o-mini by default (~$0.01-0.02/page)
  --vision-model <model>  Vision model to use (default: gpt-4o-mini)
                          - gpt-4o-mini: Fast and cost-effective (default)
                          - gpt-4o: Higher quality, slower and more expensive
  --vision-agent-max-steps <N>  Maximum agent loop iterations (default: 20, max: 50)

EVIDENCE CAPTURE OPTIONS (Phase 21h-21i):
  --save-evidence         Save viewport screenshots as evidence files
                          Screenshots are saved to the evidence directory
                          Useful for audit trails and manual review
  --evidence-dir <path>   Directory for evidence files (default: ./evidence)
                          Created automatically if it doesn't exist
  --annotate-screenshots  Annotate saved screenshots with bounding boxes
                          Red boxes for failed heuristics, green for passed
                          Element index labels shown near each element
                          Requires --save-evidence to take effect

MODES:
  --verbose, -v           Enable verbose logging
  --help, -h              Show this help message

ENVIRONMENT:
  OPENAI_API_KEY          Required for CRO analysis.
                          Your OpenAI API key for LLM processing.

EXAMPLES:
  # Full CRO analysis (default mode)
  npm run start -- https://www.carwale.com

  # CRO analysis with markdown report to file
  npm run start -- https://www.carwale.com --output-format markdown --output-file report.md

  # CRO analysis with JSON output
  npm run start -- https://www.carwale.com --output-format json --output-file analysis.json

  # CRO analysis with limited steps
  npm run start -- --max-steps 5 https://www.carwale.com

  # Full-page coverage mode (default)
  npm run start -- --scan-mode=full_page https://www.carwale.com

  # Above-fold only mode (faster)
  npm run start -- --scan-mode=above_fold https://www.carwale.com

  # LLM-guided mode (original behavior)
  npm run start -- --scan-mode=llm_guided https://www.carwale.com

  # Process multiple URLs
  npm run start -- https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy https://github.com

  # Headless mode with verbose logging
  npm run start -- --headless --verbose https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy

  # Execute specific tool for debugging
  npm run start -- --tool analyze_ctas https://www.carwale.com

  # Vision Agent mode - comprehensive CRO analysis with DOM + Vision
  npm run start -- --vision-agent https://www.peregrineclothing.co.uk/products/lynton-polo-shirt

  # Vision Agent with custom max steps
  npm run start -- --vision-agent --vision-agent-max-steps 30 https://example.com/product

  # Vision Agent with gpt-4o for higher quality analysis
  npm run start -- --vision-agent --vision-model gpt-4o https://example.com/product

  # Save screenshots as evidence (Phase 21h)
  npm run start -- --vision-agent --save-evidence https://example.com/product

  # Save evidence to custom directory
  npm run start -- --vision-agent --save-evidence --evidence-dir ./reports/evidence https://example.com/product

  # Save annotated screenshots (Phase 21i) - shows element boxes and labels
  npm run start -- --vision-agent --save-evidence --annotate-screenshots https://example.com/product
`);
}

/**
 * Process URL with CRO tool execution
 */
async function processToolExecution(
  url: string,
  toolName: CROActionName,
  options: {
    headless: boolean;
    timeout: number;
    waitUntil: WaitUntilStrategy;
    postLoadWait: number;
    dismissCookieConsent: boolean;
    verbose: boolean;
  }
): Promise<ToolExecutionResult> {
  const browserManager = new BrowserManager({
    headless: options.headless,
    timeout: options.timeout,
    browserType: 'chromium',
    waitUntil: options.waitUntil,
    postLoadWait: options.postLoadWait,
    dismissCookieConsent: options.dismissCookieConsent,
  });

  const startTime = Date.now();

  try {
    await browserManager.launch();
    const page = browserManager.getPage();

    const loader = new PageLoader(page, {
      timeout: options.timeout,
      waitUntil: options.waitUntil,
      postLoadWait: options.postLoadWait,
    });

    if (options.verbose) {
      console.log(`Loading: ${url}`);
    }

    const loadResult = await loader.load(url);

    if (!loadResult.success) {
      return {
        url,
        toolName,
        success: false,
        error: loadResult.error || 'Failed to load page',
        loadTimeMs: loadResult.loadTimeMs,
      };
    }

    if (options.dismissCookieConsent) {
      const cookieHandler = new CookieConsentHandler();
      await cookieHandler.dismiss(page);
    }

    if (options.verbose) {
      console.log('Extracting CRO elements...');
    }

    const extractor = new DOMExtractor();
    const domTree = await extractor.extract(page);

    const viewportSize = page.viewportSize() || { width: 1280, height: 720 };
    const viewport = {
      width: viewportSize.width,
      height: viewportSize.height,
      deviceScaleFactor: 1,
      isMobile: false,
    };

    const scrollPositionScript = `
      (() => ({
        x: window.scrollX,
        y: window.scrollY,
        maxX: document.documentElement.scrollWidth - window.innerWidth,
        maxY: document.documentElement.scrollHeight - window.innerHeight
      }))()
    `;
    const scrollPosition = await page.evaluate(scrollPositionScript) as {
      x: number;
      y: number;
      maxX: number;
      maxY: number;
    };

    const pageState: PageState = {
      url,
      title: await page.title(),
      domTree,
      viewport,
      scrollPosition,
      timestamp: Date.now(),
    };

    const registry = createCRORegistry();
    const executor = new ToolExecutor(registry);

    if (!registry.has(toolName)) {
      return {
        url,
        toolName,
        success: false,
        error: `Tool '${toolName}' not implemented. Available: ${registry.getAll().map(t => t.name).join(', ')}`,
        loadTimeMs: Date.now() - startTime,
      };
    }

    if (options.verbose) {
      console.log(`Executing tool: ${toolName}`);
    }

    const toolResult = await executor.execute(
      toolName,
      {},
      { page, state: pageState, verbose: options.verbose }
    );

    return {
      url,
      toolName,
      success: toolResult.success,
      error: toolResult.error,
      result: toolResult,
      loadTimeMs: Date.now() - startTime,
    };

  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return {
      url,
      toolName,
      success: false,
      error,
      loadTimeMs: Date.now() - startTime,
    };

  } finally {
    await browserManager.close();
  }
}

/**
 * Process URL with Vision Agent mode
 * Phase 21j: Uses CROAgent unified mode for full-page coverage
 * Iterative observe-reason-act loop with DOM + Vision context
 */
async function processVisionAgentMode(
  url: string,
  options: {
    headless: boolean;
    timeout: number;
    waitUntil: WaitUntilStrategy;
    postLoadWait: number;
    dismissCookieConsent: boolean;
    visionModel: VisionModel;
    maxSteps: number;
    saveEvidence: boolean;
    evidenceDir: string;
    annotateScreenshots: boolean;
    verbose: boolean;
  }
): Promise<void> {
  const useColors = process.stdout.isTTY ?? false;

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is not set');
    process.exit(1);
  }

  // ANSI color codes
  const GREEN = useColors ? '\x1b[32m' : '';
  const RED = useColors ? '\x1b[31m' : '';
  const YELLOW = useColors ? '\x1b[33m' : '';
  const CYAN = useColors ? '\x1b[36m' : '';
  const DIM = useColors ? '\x1b[2m' : '';
  const RESET = useColors ? '\x1b[0m' : '';

  console.log('\n' + '═'.repeat(80));
  console.log('  VISION AGENT ANALYSIS MODE (Phase 21j - Unified CROAgent)');
  console.log('═'.repeat(80));
  console.log(`  URL: ${url}`);
  console.log(`  Model: ${options.visionModel}`);
  console.log(`  Max Steps: ${options.maxSteps}`);
  console.log(`  Scan Mode: full_page (enforced 100% coverage)`);
  console.log(`  Features: DOM + Vision parallel context, category-based analysis`);
  console.log('═'.repeat(80) + '\n');

  // Phase 21j: Show collection phase progress
  if (options.verbose) {
    console.log(`  ${CYAN}Collection Phase:${RESET}`);
    console.log(`  • Scan mode: full_page`);
    console.log(`  • Target coverage: 100%`);
  }

  try {
    // Phase 21j: Use CROAgent with unified mode instead of deprecated VisionAgent
    const croAgent = new CROAgent({
      maxSteps: options.maxSteps,
      actionWaitMs: 500,
      llmTimeoutMs: 60000,
      failureLimit: 3,
    });

    const result = await croAgent.analyze(url, {
      browserConfig: {
        headless: options.headless,
        timeout: options.timeout,
        waitUntil: options.waitUntil,
        postLoadWait: options.postLoadWait,
        dismissCookieConsent: options.dismissCookieConsent,
        browserType: 'chromium',
      },
      verbose: options.verbose,
      // Phase 21j: Enable unified mode for full-page coverage
      enableUnifiedMode: true,
      visionAgentMode: true,
      scanMode: 'full_page',
      coverageConfig: { minCoveragePercent: 100 },
      visionModel: options.visionModel,
      // Skip heuristic rules - use vision-based analysis only
      skipHeuristics: true,
    });

    // Phase 21j: Show collection complete summary
    const snapshotCount = result.snapshots?.length ?? 0;
    if (options.verbose) {
      console.log(`  ${GREEN}✓ Collected ${snapshotCount} viewports${RESET}\n`);
    }

    // Get evaluations from vision analysis
    const evaluations = result.visionAnalysis?.evaluations ?? [];

    // Display results
    console.log('\n' + '═'.repeat(80));
    console.log(`  VISION AGENT RESULTS (${result.pageType?.toUpperCase() ?? 'UNKNOWN'})`);
    console.log('═'.repeat(80));

    // Summary
    const summary = result.visionAnalysis?.summary ?? {
      totalHeuristics: 0,
      passed: 0,
      failed: 0,
      partial: 0,
      notApplicable: 0,
      coveragePercent: 0,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    };

    console.log(`\n  Analysis Summary:`);
    console.log(`  • Viewports: ${snapshotCount} | Duration: ${(result.totalTimeMs / 1000).toFixed(1)}s`);
    console.log(`  • Termination: ${result.terminationReason}`);

    console.log(`\n  ${summary.totalHeuristics} heuristics evaluated (${summary.coveragePercent.toFixed(0)}% coverage):`);
    console.log(`  ${GREEN}✓ Passed: ${summary.passed}${RESET} | ${RED}✗ Failed: ${summary.failed}${RESET} | ${YELLOW}~ Partial: ${summary.partial}${RESET} | N/A: ${summary.notApplicable}`);

    if (summary.failed + summary.partial > 0) {
      const severityParts: string[] = [];
      if (summary.bySeverity.critical > 0) severityParts.push(`${RED}${summary.bySeverity.critical} critical${RESET}`);
      if (summary.bySeverity.high > 0) severityParts.push(`${YELLOW}${summary.bySeverity.high} high${RESET}`);
      if (summary.bySeverity.medium > 0) severityParts.push(`${summary.bySeverity.medium} medium`);
      if (summary.bySeverity.low > 0) severityParts.push(`${summary.bySeverity.low} low`);
      console.log(`  Issues by severity: ${severityParts.join(', ')}`);
    }

    // Phase 21j: DOM-Screenshot Mapping Summary (T385)
    if (result.snapshots && result.snapshots.length > 0) {
      console.log(`\n  ${CYAN}DOM-Screenshot Mapping:${RESET}`);
      for (const snapshot of result.snapshots) {
        const mappedCount = snapshot.elementMappings?.length ?? 0;
        const visibleCount = snapshot.visibleElements?.length ?? 0;
        console.log(`  • Viewport ${snapshot.viewportIndex} (scroll: ${snapshot.scrollPosition}px): ${mappedCount} mapped, ${visibleCount} visible`);
      }
      const totalMapped = result.snapshots.reduce((sum, s) => sum + (s.elementMappings?.length ?? 0), 0);
      const totalVisible = result.snapshots.reduce((sum, s) => sum + (s.visibleElements?.length ?? 0), 0);
      console.log(`  ${GREEN}Total: ${totalMapped} element mappings, ${totalVisible} visible across ${result.snapshots.length} viewports${RESET}`);
    }

    // Detailed evaluations
    const failed = evaluations.filter(e => e.status === 'fail');
    const partial = evaluations.filter(e => e.status === 'partial');
    const passed = evaluations.filter(e => e.status === 'pass');

    // Failed heuristics (full details)
    if (failed.length > 0) {
      console.log(`\n  ${RED}┌─ FAILED HEURISTICS ──────────────────────────────────────────────────${RESET}`);
      for (const evaluation of failed) {
        const icon = evaluation.severity === 'critical' ? '🔴' : evaluation.severity === 'high' ? '🟠' : '🟡';
        console.log(`  ${RED}│${RESET}`);
        console.log(`  ${RED}│ ${icon} [${evaluation.heuristicId}] ${evaluation.severity.toUpperCase()} (${(evaluation.confidence * 100).toFixed(0)}% confidence)${RESET}`);
        console.log(`  ${RED}│${RESET}   ${DIM}Principle: ${evaluation.principle}${RESET}`);
        console.log(`  ${RED}│${RESET}   ${CYAN}Observation:${RESET} ${evaluation.observation}`);
        if (evaluation.issue) {
          console.log(`  ${RED}│   Issue: ${evaluation.issue}${RESET}`);
        }
        if (evaluation.recommendation) {
          console.log(`  ${RED}│${RESET}   ${GREEN}Recommendation:${RESET} ${evaluation.recommendation}`);
        }
      }
      console.log(`  ${RED}└${'─'.repeat(75)}${RESET}`);
    }

    // Partial heuristics (full details)
    if (partial.length > 0) {
      console.log(`\n  ${YELLOW}┌─ PARTIAL COMPLIANCE ─────────────────────────────────────────────────${RESET}`);
      for (const evaluation of partial) {
        console.log(`  ${YELLOW}│${RESET}`);
        console.log(`  ${YELLOW}│ 🟡 [${evaluation.heuristicId}] ${evaluation.severity.toUpperCase()} (${(evaluation.confidence * 100).toFixed(0)}% confidence)${RESET}`);
        console.log(`  ${YELLOW}│${RESET}   ${DIM}Principle: ${evaluation.principle}${RESET}`);
        console.log(`  ${YELLOW}│${RESET}   ${CYAN}Observation:${RESET} ${evaluation.observation}`);
        if (evaluation.issue) {
          console.log(`  ${YELLOW}│   Issue: ${evaluation.issue}${RESET}`);
        }
        if (evaluation.recommendation) {
          console.log(`  ${YELLOW}│${RESET}   ${GREEN}Recommendation:${RESET} ${evaluation.recommendation}`);
        }
      }
      console.log(`  ${YELLOW}└${'─'.repeat(75)}${RESET}`);
    }

    // Passed heuristics (condensed)
    if (passed.length > 0) {
      console.log(`\n  ${GREEN}┌─ PASSED HEURISTICS ──────────────────────────────────────────────────${RESET}`);
      for (const evaluation of passed) {
        const principle = evaluation.principle.length > 60 ? evaluation.principle.slice(0, 60) + '...' : evaluation.principle;
        console.log(`  ${GREEN}│ ✓ [${evaluation.heuristicId}] ${principle}${RESET}`);
      }
      console.log(`  ${GREEN}└${'─'.repeat(75)}${RESET}`);
    }

    // Error messages if any
    if (result.errors.length > 0) {
      console.log(`\n  ${RED}Errors encountered:${RESET}`);
      for (const error of result.errors) {
        console.log(`  ${RED}  • ${error}${RESET}`);
      }
    }

    // Phase 21h/21i: Save evidence if requested (T386)
    if (options.saveEvidence && result.snapshots && result.snapshots.length > 0) {
      console.log(`\n  ${CYAN}Saving evidence screenshots...${RESET}`);

      const writer = new ScreenshotWriter({
        outputDir: options.evidenceDir,
        prefix: 'viewport',
        format: 'png',
        includeTimestamp: true,
      });

      // Phase 21i: Annotate screenshots if requested
      let screenshotData = result.snapshots.map((snapshot) => ({
        base64: snapshot.screenshot.base64,
        viewportIndex: snapshot.viewportIndex,
        scrollPosition: snapshot.scrollPosition,
      }));

      if (options.annotateScreenshots) {
        console.log(`  ${CYAN}Annotating screenshots with element highlights...${RESET}`);
        const annotator = new ScreenshotAnnotator({
          highlightIssues: true,
          showElementIndexes: true,
          showCoordinates: false,
        });

        // Annotate each snapshot
        for (let i = 0; i < screenshotData.length; i++) {
          const snapshot = result.snapshots[i];
          if (!snapshot) continue;

          const visibleElements = snapshot.visibleElements ?? [];

          // Get evaluations for this viewport
          const viewportEvaluations = evaluations.filter(
            (e) => e.viewportIndex === snapshot.viewportIndex
          );

          const currentScreenshot = screenshotData[i];
          if (visibleElements.length > 0 && currentScreenshot) {
            const annotationResult = await annotator.annotate(
              currentScreenshot.base64,
              visibleElements,
              viewportEvaluations
            );

            if (annotationResult.success && annotationResult.annotatedBase64) {
              currentScreenshot.base64 = annotationResult.annotatedBase64;
            }
          }
        }
        console.log(`  ${GREEN}Annotated ${screenshotData.length} screenshots${RESET}`);
      }

      const sessionId = Date.now().toString(36);
      const writeResult = await writer.saveAllViewportScreenshots(screenshotData, sessionId);

      if (writeResult.successful > 0) {
        console.log(`  ${GREEN}Saved ${writeResult.successful} screenshots to ${writeResult.outputDir}${RESET}`);
      }

      if (writeResult.failed > 0) {
        console.log(`  ${YELLOW}Warning: ${writeResult.failed} screenshots failed to save${RESET}`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('  VISION AGENT ANALYSIS COMPLETE');
    console.log('═'.repeat(80) + '\n');

  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error(`\nError: ${error}`);
    process.exit(1);
  }
}

/**
 * Process URL with CRO agent analysis (default mode - non-vision)
 * NOTE: Use --vision-agent for vision analysis (THE ONE MODE)
 */
async function processAnalysis(
  url: string,
  options: {
    headless: boolean;
    timeout: number;
    waitUntil: WaitUntilStrategy;
    postLoadWait: number;
    dismissCookieConsent: boolean;
    maxSteps: number;
    scanMode: ScanMode;
    minCoverage: number;
    verbose: boolean;
  }
): Promise<CROAnalysisResult> {
  const formatter = new AgentProgressFormatter({ useColors: process.stdout.isTTY ?? false });

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
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
      hypotheses: [],
      scores: emptyScores,
      stepsExecuted: 0,
      totalTimeMs: 0,
      terminationReason: 'OPENAI_API_KEY environment variable is not set',
      errors: ['OPENAI_API_KEY environment variable is not set'],
    };
  }

  // Show analysis start
  console.log(formatter.formatAnalysisStart(url, options.maxSteps));

  const agent = new CROAgent({
    maxSteps: options.maxSteps,
    actionWaitMs: 500,
    llmTimeoutMs: 60000,
    failureLimit: 3,
  });

  try {
    // Build coverage config based on CLI options
    const coverageConfig: CoverageConfig = {
      ...DEFAULT_COVERAGE_CONFIG,
      minCoveragePercent: options.minCoverage,
    };

    const result = await agent.analyze(url, {
      browserConfig: {
        headless: options.headless,
        timeout: options.timeout,
        waitUntil: options.waitUntil,
        postLoadWait: options.postLoadWait,
        dismissCookieConsent: options.dismissCookieConsent,
        browserType: 'chromium',
      },
      verbose: options.verbose,
      skipHeuristics: true,
      scanMode: options.scanMode,
      coverageConfig,
      // Vision analysis disabled in default mode - use --vision-agent instead
      useVisionAnalysis: false,
    });

    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
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
      hypotheses: [],
      scores: emptyScores,
      stepsExecuted: 0,
      totalTimeMs: 0,
      terminationReason: `Error: ${error}`,
      errors: [error],
    };
  }
}

/**
 * Format and output analysis result based on output format
 */
async function outputResult(
  result: CROAnalysisResult,
  outputFormat: OutputFormat,
  outputFile: string | null,
  useColors: boolean
): Promise<boolean> {
  let content: string;

  switch (outputFormat) {
    case 'markdown': {
      const reporter = new MarkdownReporter();
      content = reporter.generate(result);
      break;
    }
    case 'json': {
      const exporter = new JSONExporter();
      content = exporter.export(result);
      break;
    }
    case 'console':
    default: {
      const formatter = new AgentProgressFormatter({ useColors });
      content = formatter.formatAnalysisResult(result);
      break;
    }
  }

  // Write to file if specified
  if (outputFile) {
    const writer = new FileWriter();
    const writeResult = await writer.write(content, outputFile);

    if (!writeResult.success) {
      console.error(`Failed to write output file: ${writeResult.error}`);
      return false;
    }

    console.log(`\nReport written to: ${outputFile}`);

    // Also show console summary when writing to file
    if (outputFormat !== 'console') {
      const consoleFormatter = new AgentProgressFormatter({ useColors });
      console.log(consoleFormatter.formatAnalysisResult(result));
    }
  } else {
    // Output to console
    console.log(content);
  }

  return true;
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const {
    urls,
    headless,
    timeout,
    waitUntil,
    postLoadWait,
    dismissCookieConsent,
    outputFormat,
    outputFile,
    maxSteps,
    toolName,
    scanMode,
    minCoverage,
    visionModel,
    visionAgent,
    visionAgentMaxSteps,
    saveEvidence,
    evidenceDir,
    annotateScreenshots,
    verbose,
    help,
  } = parseArgs();

  // Show help if requested or no URLs provided
  if (help || urls.length === 0) {
    printHelp();
    process.exit(help ? 0 : 1);
  }

  const useColors = process.stdout.isTTY ?? false;

  // Vision Agent mode: iterative analysis with DOM + Vision (THE ONE MODE)
  if (visionAgent) {
    for (const url of urls) {
      await processVisionAgentMode(url, {
        headless,
        timeout,
        waitUntil,
        postLoadWait,
        dismissCookieConsent,
        visionModel: visionModel === 'gpt-4o' ? visionModel : 'gpt-4o-mini',  // Default to gpt-4o-mini for cost
        maxSteps: visionAgentMaxSteps,
        saveEvidence,
        evidenceDir,
        annotateScreenshots,
        verbose,
      });
    }
    process.exit(0);
  }

  // Tool execution mode (for debugging)
  if (toolName) {
    const formatter = new ToolResultFormatter();

    for (const url of urls) {
      console.log(`\nProcessing: ${url}\n`);

      const result = await processToolExecution(url, toolName, {
        headless,
        timeout,
        waitUntil,
        postLoadWait,
        dismissCookieConsent,
        verbose,
      });

      console.log(formatter.format(result));

      if (!result.success) {
        process.exit(1);
      }
    }

    process.exit(0);
  }

  // Default mode: CRO Agent Analysis (non-vision)
  // Use --vision-agent for vision analysis
  for (const url of urls) {
    const result = await processAnalysis(url, {
      headless,
      timeout,
      waitUntil,
      postLoadWait,
      dismissCookieConsent,
      maxSteps,
      scanMode,
      minCoverage,
      verbose,
    });

    const outputSuccess = await outputResult(result, outputFormat, outputFile, useColors);

    if (!result.success || !outputSuccess) {
      process.exit(1);
    }
  }

  process.exit(0);
}

// Run main function
main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
