#!/usr/bin/env node
/**
 * Browser Agent CLI - Phase 18-CLI
 *
 * Command-line interface for the CRO browser automation agent.
 * Default mode: CRO analysis with heuristics and hypothesis generation.
 */

import { config } from 'dotenv';
import { BrowserAgent } from './index.js';
import { BrowserManager, PageLoader } from './browser/index.js';
import { CookieConsentHandler } from './browser/cookie-handler.js';
import { DOMExtractor } from './browser/dom/index.js';
import {
  ToolResultFormatter,
  AgentProgressFormatter,
  FileWriter,
  MarkdownReporter,
  JSONExporter,
  type ToolExecutionResult,
} from './output/index.js';
import { createCRORegistry, ToolExecutor } from './agent/tools/index.js';
import { CROAgent, type CROAnalysisResult, type CROScores } from './agent/index.js';
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
  legacy: boolean;
  outputFormat: OutputFormat;
  outputFile: string | null;
  maxSteps: number;
  toolName: CROActionName | null;
  scanMode: ScanMode;
  minCoverage: number;
  useVision: boolean;
  visionModel: VisionModel;
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
  let legacy = false;
  let outputFormat: OutputFormat = 'console';
  let outputFile: string | null = null;
  let maxSteps = 10;
  let toolName: CROActionName | null = null;
  let scanMode: ScanMode = 'full_page';
  let minCoverage = 100;
  let useVision = true;  // Phase 21d: Vision enabled by default
  let visionModel: VisionModel = 'gpt-4o';  // Phase 21d: Default vision model
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
    } else if (arg === '--legacy') {
      legacy = true;
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
    } else if (arg === '--vision') {
      // Phase 21d: Enable vision analysis (explicit)
      useVision = true;
    } else if (arg === '--no-vision') {
      // Phase 21d: Disable vision analysis
      useVision = false;
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
    legacy,
    outputFormat,
    outputFile,
    maxSteps,
    toolName,
    scanMode,
    minCoverage,
    useVision,
    visionModel,
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

VISION ANALYSIS OPTIONS (Phase 21):
  --vision                Enable GPT-4o vision analysis (default: enabled)
  --no-vision             Disable GPT-4o vision analysis
  --vision-model <model>  Vision model to use (default: gpt-4o)
                          - gpt-4o: Best quality, slower and more expensive
                          - gpt-4o-mini: Faster and cheaper, slightly lower quality

MODES:
  --legacy                Use legacy heading extraction mode (no CRO analysis)
                          Original behavior: extract h1-h6 + LangChain processing
  --verbose, -v           Enable verbose logging
  --help, -h              Show this help message

ENVIRONMENT:
  OPENAI_API_KEY          Required for CRO analysis and legacy mode.
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

  # Legacy heading extraction mode
  npm run start -- --legacy https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy

  # Process multiple URLs
  npm run start -- https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy https://github.com

  # Headless mode with verbose logging
  npm run start -- --headless --verbose https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy

  # Execute specific tool for debugging
  npm run start -- --tool analyze_ctas https://www.carwale.com

  # Vision analysis (Phase 21) - enabled by default for PDP pages
  npm run start -- https://www.peregrineclothing.co.uk/products/lynton-polo-shirt

  # Disable vision analysis
  npm run start -- --no-vision https://www.peregrineclothing.co.uk/products/lynton-polo-shirt

  # Use gpt-4o-mini for faster/cheaper vision analysis
  npm run start -- --vision-model=gpt-4o-mini https://www.peregrineclothing.co.uk/products/lynton-polo-shirt
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
 * Process URL with CRO agent analysis (default mode)
 * Phase 21d (T317): Added vision options
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
    useVision: boolean;
    visionModel: VisionModel;
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
      // Phase 21d: Vision analysis options
      useVisionAnalysis: options.useVision,
      visionModel: options.visionModel,
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
    legacy,
    outputFormat,
    outputFile,
    maxSteps,
    toolName,
    scanMode,
    minCoverage,
    useVision,
    visionModel,
    verbose,
    help,
  } = parseArgs();

  // Show help if requested or no URLs provided
  if (help || urls.length === 0) {
    printHelp();
    process.exit(help ? 0 : 1);
  }

  const useColors = process.stdout.isTTY ?? false;

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

  // Legacy mode: BrowserAgent with LangChain heading extraction
  if (legacy) {
    const agent = new BrowserAgent({
      browser: {
        headless,
        timeout,
        waitUntil,
        postLoadWait,
        dismissCookieConsent,
        browserType: 'chromium',
      },
      verbose,
    });

    try {
      agent.validateEnvironment();

      if (urls.length === 1) {
        const url = urls[0];
        if (!url) {
          console.error('No URL provided');
          process.exit(1);
        }

        console.log(`Processing: ${url}\n`);
        const result = await agent.processUrl(url);
        console.log(agent.formatResult(result));

        process.exit(result.success ? 0 : 1);
      } else {
        console.log(`Processing ${urls.length} URLs...\n`);
        const batch = await agent.processBatch(urls);
        console.log(agent.formatBatch(batch));

        process.exit(batch.failureCount === 0 ? 0 : 1);
      }
    } catch (err) {
      const error = err as Error;
      console.error(`\nFATAL ERROR: ${error.message}`);

      if (verbose && error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }

      process.exit(1);
    } finally {
      await agent.close();
    }
    return;
  }

  // Default mode: CRO Agent Analysis
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
      useVision,
      visionModel,
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
