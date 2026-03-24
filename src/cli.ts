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
  LLMInputWriter,
  buildEvidencePackage,
  writeEvidenceJson as writeEvidenceJsonFile,
  type ToolExecutionResult,
  type LLMInputData,
} from './output/index.js';
import { createCRORegistry, ToolExecutor } from './agent/tools/index.js';
import { CROAgent, type CROAnalysisResult, type CROScores } from './agent/index.js';
import { runAgentLoop, type AgentLoopConfig, type AgentLoopResult } from './agent/agent-loop/index.js';
import { QualityValidator } from './validation/index.js';
// NOTE: Vision Agent module removed in CR-001-D. Use CROAgent with vision: true
import type { CROActionName, PageState, ScanMode, CoverageConfig } from './models/index.js';
import { CROActionNames, DEFAULT_COVERAGE_CONFIG } from './models/index.js';
import type { WaitUntilStrategy, ScreenshotMode } from './types/index.js';
import { MODEL_DEFAULTS } from './heuristics/model-config.js';
import { parseElementRef } from './heuristics/category-analyzer.js';

// Load environment variables from .env file
config();

const VALID_WAIT_STRATEGIES: WaitUntilStrategy[] = ['load', 'domcontentloaded', 'networkidle'];
const VALID_TOOL_NAMES = CROActionNames;
const VALID_OUTPUT_FORMATS = ['console', 'markdown', 'json'] as const;
type OutputFormat = typeof VALID_OUTPUT_FORMATS[number];
const VALID_SCAN_MODES: ScanMode[] = ['full_page', 'above_fold', 'llm_guided'];
const VALID_VISION_MODELS = ['gpt-4o', 'gpt-4o-mini'] as const;
type VisionModel = typeof VALID_VISION_MODELS[number];
// Phase 25e: Screenshot modes for vision analysis
const VALID_SCREENSHOT_MODES: ScreenshotMode[] = ['viewport', 'tiled', 'hybrid'];

/**
 * Parses command-line arguments.
 * CR-001-D: Simplified vision flags - `--vision` is now the primary flag
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
  vision: boolean;  // CR-001-D: Primary vision flag
  visionMaxSteps: number;  // CR-001-D: Max steps for vision collection
  saveEvidence: boolean;  // Save screenshots as evidence
  evidenceDir: string;  // Directory for evidence files
  annotateScreenshots: boolean;  // Annotate screenshots with bounding boxes
  // Phase 24: Hybrid page type detection options
  enableLLMPageDetection: boolean;  // Enable LLM fallback for page detection
  forceLLMDetection: boolean;  // Force LLM detection (skip Playwright/heuristic)
  llmDetectionThreshold: number;  // Confidence threshold to trigger LLM fallback
  // Phase 25e: Screenshot mode for vision analysis
  screenshotMode: ScreenshotMode;  // viewport | tiled | hybrid
  // Phase 25f: Deterministic collection
  llmGuidedCollection: boolean;  // Use LLM-guided collection (opt-in, default: false)
  // Phase 25g: Evidence JSON output (T513)
  writeEvidenceJson: boolean;  // Write evidence.json file (default: true)
  // Phase 25i: Collection QA (T543)
  skipCollectionQA: boolean;  // Skip LLM QA validation (default: false)
  // Phase 26: Parallel analysis options
  sequentialAnalysis: boolean;  // Disable parallel analysis (default: false)
  maxConcurrentCategories: number;  // Max concurrent category analyses (default: 5)
  // Phase 26b: Category batching (opt-in)
  categoryBatching: boolean;  // Enable category batching (default: false)
  // Phase 26c: Viewport filtering (opt-in)
  viewportFiltering: boolean;  // Enable viewport filtering (default: false)
  // Phase 26e: Quality validation (CI-only)
  validateQuality: boolean;  // Run quality validation comparing optimized vs baseline
  // Phase 27D: Confidence filtering
  minConfidence: number;  // Minimum confidence threshold for display (default: 0.7)
  // Phase 29: AX tree capture
  captureAxTree: boolean;  // Capture accessibility tree (default: true)
  // Phase 30: Vision optimization
  autoCrop: boolean;  // Category-aware auto-cropping (default: true)
  imageTokenBudget: number;  // Max tokens per image (default: 300)
  // Phase 32: Agent mode
  agentMode: string | null;  // Goal string for agent mode (null = CRO mode)
  agentMaxSteps: number;  // Max steps for agent loop (default: 20)
  agentMaxTimeMs: number;  // Max time for agent loop (default: 120000)
  agentNoSubGoals: boolean;  // Phase 33b: Disable sub-goal decomposition
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
  let visionModel: VisionModel = MODEL_DEFAULTS.analysis;  // Phase 27A: Default to gpt-4o for quality
  let vision = false;  // CR-001-D: Primary vision flag
  let visionMaxSteps = 20;  // Max steps for vision collection
  let saveEvidence = true;  // Save screenshots as evidence (default: on)
  let evidenceDir = '';  // Evidence output directory (empty = auto-generate with timestamp)
  let annotateScreenshots = true;  // Annotate screenshots with bounding boxes (default: on)
  // Phase 24: Hybrid page type detection
  let enableLLMPageDetection = true;  // Enable LLM fallback for page detection (default: on)
  let forceLLMDetection = false;  // Force LLM detection (skip Playwright/heuristic)
  let llmDetectionThreshold = 0.5;  // Confidence threshold to trigger LLM fallback
  // Phase 25e: Screenshot mode
  let screenshotMode: ScreenshotMode = 'viewport';  // Default: viewport mode
  // Phase 25f: Deterministic collection
  let llmGuidedCollection = false;  // Default: deterministic (no LLM calls during collection)
  // Phase 25g: Evidence JSON output (T513)
  let writeEvidenceJson = true;  // Default: write evidence.json (opt-out with --no-evidence-json)
  // Phase 25i: Collection QA (T543)
  let skipCollectionQA = false;  // Default: run cheap validator + LLM QA if needed
  // Phase 26: Parallel analysis options
  let sequentialAnalysis = false;  // Default: parallel analysis enabled
  let maxConcurrentCategories = 5;  // Default: 5 concurrent categories
  // Phase 26b: Category batching (opt-in)
  let categoryBatching = false;  // Default: batching disabled (opt-in via --category-batching)
  // Phase 26c: Viewport filtering (opt-in)
  let viewportFiltering = false;  // Default: viewport filtering disabled (opt-in via --viewport-filtering)
  // Phase 26e: Quality validation (CI-only)
  let validateQuality = false;  // Default: no quality validation
  // Phase 27D: Confidence filtering
  let minConfidence = 0.7;  // Default: hide evaluations below 70% confidence
  // Phase 29: AX tree capture
  let captureAxTree = true;  // Default: capture accessibility tree
  // Phase 30: Vision optimization
  let autoCrop = true;  // Default: category-aware auto-cropping enabled
  let imageTokenBudget = 300;  // Default: 300 tokens per image
  // Phase 32: Agent mode
  let agentMode: string | null = null;  // Goal string for agent mode
  let agentMaxSteps = 20;  // Max steps for agent loop
  let agentMaxTimeMs = 120000;  // Max time for agent loop (2 minutes)
  let agentNoSubGoals = false;
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
    } else if (arg === '--vision') {
      // CR-001-D: Primary vision flag
      vision = true;
    } else if (arg === '--vision-agent') {
      // Deprecated alias for --vision (kept for backward compatibility)
      vision = true;
    } else if (arg === '--vision-max-steps' && args[i + 1]) {
      // CR-001-D: Set max steps for vision collection
      visionMaxSteps = parseInt(args[i + 1] ?? '20', 10);
      if (isNaN(visionMaxSteps) || visionMaxSteps < 1 || visionMaxSteps > 50) {
        console.error('Invalid vision-max-steps value. Must be between 1 and 50.');
        process.exit(1);
      }
      i++;
    } else if (arg?.startsWith('--vision-max-steps=')) {
      // CR-001-D: Set max steps (= syntax)
      visionMaxSteps = parseInt(arg.split('=')[1] ?? '20', 10);
      if (isNaN(visionMaxSteps) || visionMaxSteps < 1 || visionMaxSteps > 50) {
        console.error('Invalid vision-max-steps value. Must be between 1 and 50.');
        process.exit(1);
      }
    } else if (arg === '--vision-agent-max-steps' && args[i + 1]) {
      // Deprecated alias for --vision-max-steps
      visionMaxSteps = parseInt(args[i + 1] ?? '20', 10);
      if (isNaN(visionMaxSteps) || visionMaxSteps < 1 || visionMaxSteps > 50) {
        console.error('Invalid vision-agent-max-steps value. Must be between 1 and 50.');
        process.exit(1);
      }
      i++;
    } else if (arg?.startsWith('--vision-agent-max-steps=')) {
      // Deprecated alias for --vision-max-steps (= syntax)
      visionMaxSteps = parseInt(arg.split('=')[1] ?? '20', 10);
      if (isNaN(visionMaxSteps) || visionMaxSteps < 1 || visionMaxSteps > 50) {
        console.error('Invalid vision-agent-max-steps value. Must be between 1 and 50.');
        process.exit(1);
      }
    } else if (arg === '--agent-mode' && args[i + 1]) {
      // Phase 32: Agent mode - goal-directed browser automation
      agentMode = args[i + 1] ?? null;
      i++;
    } else if (arg?.startsWith('--agent-mode=')) {
      agentMode = arg.split('=').slice(1).join('=') || null;
    } else if (arg === '--agent-max-steps' && args[i + 1]) {
      agentMaxSteps = parseInt(args[i + 1] ?? '20', 10);
      if (isNaN(agentMaxSteps) || agentMaxSteps < 1 || agentMaxSteps > 100) {
        console.error('Invalid agent-max-steps value. Must be between 1 and 100.');
        process.exit(1);
      }
      i++;
    } else if (arg === '--agent-max-time' && args[i + 1]) {
      agentMaxTimeMs = parseInt(args[i + 1] ?? '120000', 10);
      if (isNaN(agentMaxTimeMs) || agentMaxTimeMs < 5000) {
        console.error('Invalid agent-max-time value. Must be at least 5000ms.');
        process.exit(1);
      }
      i++;
    } else if (arg === '--no-sub-goals') {
      // Phase 33b: Disable sub-goal decomposition
      agentNoSubGoals = true;
    } else if (arg === '--save-evidence') {
      // Phase 21h: Enable evidence saving (now default, kept for backward compatibility)
      saveEvidence = true;
    } else if (arg === '--no-save-evidence') {
      // Phase 21l: Opt-out of evidence saving
      saveEvidence = false;
    } else if (arg === '--annotate-screenshots') {
      // Phase 21i: Enable screenshot annotation (now default, kept for backward compatibility)
      annotateScreenshots = true;
    } else if (arg === '--no-annotate-screenshots') {
      // Phase 21l: Opt-out of screenshot annotation
      annotateScreenshots = false;
    } else if (arg === '--evidence-dir' && args[i + 1]) {
      // Phase 21h: Set evidence output directory
      evidenceDir = args[i + 1] ?? './evidence';
      i++;
    } else if (arg?.startsWith('--evidence-dir=')) {
      // Phase 21h: Set evidence directory (= syntax)
      evidenceDir = arg.split('=')[1] ?? './evidence';
    } else if (arg === '--no-llm-page-detection') {
      // Phase 24: Disable LLM fallback for page type detection
      enableLLMPageDetection = false;
    } else if (arg === '--force-llm-detection') {
      // Phase 24: Force LLM detection (skip Playwright/heuristic tiers)
      forceLLMDetection = true;
    } else if (arg === '--llm-detection-threshold' && args[i + 1]) {
      // Phase 24: Set LLM fallback threshold
      llmDetectionThreshold = parseFloat(args[i + 1] ?? '0.5');
      if (isNaN(llmDetectionThreshold) || llmDetectionThreshold < 0 || llmDetectionThreshold > 1) {
        console.error('Invalid llm-detection-threshold value. Must be between 0 and 1.');
        process.exit(1);
      }
      i++;
    } else if (arg?.startsWith('--llm-detection-threshold=')) {
      // Phase 24: Set LLM fallback threshold (= syntax)
      llmDetectionThreshold = parseFloat(arg.split('=')[1] ?? '0.5');
      if (isNaN(llmDetectionThreshold) || llmDetectionThreshold < 0 || llmDetectionThreshold > 1) {
        console.error('Invalid llm-detection-threshold value. Must be between 0 and 1.');
        process.exit(1);
      }
    } else if (arg === '--screenshot-mode' && args[i + 1]) {
      // Phase 25e: Screenshot capture mode
      const mode = args[i + 1] as ScreenshotMode;
      if (VALID_SCREENSHOT_MODES.includes(mode)) {
        screenshotMode = mode;
      } else {
        console.error(`Invalid screenshot mode: ${mode}`);
        console.error(`Valid modes: ${VALID_SCREENSHOT_MODES.join(', ')}`);
        process.exit(1);
      }
      i++;
    } else if (arg?.startsWith('--screenshot-mode=')) {
      // Phase 25e: Screenshot capture mode (= syntax)
      const mode = arg.split('=')[1] as ScreenshotMode;
      if (VALID_SCREENSHOT_MODES.includes(mode)) {
        screenshotMode = mode;
      } else {
        console.error(`Invalid screenshot mode: ${mode}`);
        console.error(`Valid modes: ${VALID_SCREENSHOT_MODES.join(', ')}`);
        process.exit(1);
      }
    } else if (arg === '--llm-guided-collection') {
      // Phase 25f: Opt-in to LLM-guided collection (old behavior)
      llmGuidedCollection = true;
    } else if (arg === '--skip-collection-qa') {
      // Phase 25i: Skip LLM QA even if cheap validator flags issues (T543)
      skipCollectionQA = true;
    } else if (arg === '--no-evidence-json') {
      // Phase 25g: Opt-out of evidence.json output (T513)
      writeEvidenceJson = false;
    } else if (arg === '--sequential-analysis') {
      // Phase 26: Disable parallel analysis, run categories sequentially
      sequentialAnalysis = true;
    } else if (arg === '--max-concurrent-categories' && args[i + 1]) {
      // Phase 26: Max concurrent category analyses
      maxConcurrentCategories = parseInt(args[i + 1] ?? '5', 10);
      if (isNaN(maxConcurrentCategories) || maxConcurrentCategories < 1 || maxConcurrentCategories > 20) {
        console.error('Invalid max-concurrent-categories value. Must be between 1 and 20.');
        process.exit(1);
      }
      i++;
    } else if (arg?.startsWith('--max-concurrent-categories=')) {
      // Phase 26: Max concurrent category analyses (= syntax)
      maxConcurrentCategories = parseInt(arg.split('=')[1] ?? '5', 10);
      if (isNaN(maxConcurrentCategories) || maxConcurrentCategories < 1 || maxConcurrentCategories > 20) {
        console.error('Invalid max-concurrent-categories value. Must be between 1 and 20.');
        process.exit(1);
      }
    } else if (arg === '--category-batching') {
      // Phase 26b: Opt-in to category batching (multiple categories per LLM call)
      categoryBatching = true;
    } else if (arg === '--viewport-filtering') {
      // Phase 26c: Opt-in to viewport filtering (send only relevant viewports per category)
      viewportFiltering = true;
    } else if (arg === '--fast-analysis') {
      // Phase 27A: Use cheaper model (gpt-4o-mini) for cost-sensitive runs
      visionModel = MODEL_DEFAULTS.fast;
    } else if (arg === '--min-confidence' && args[i + 1]) {
      const value = parseFloat(args[i + 1]!);
      if (!isNaN(value) && value >= 0 && value <= 1) {
        minConfidence = value;
        i++;
      } else {
        console.error('Invalid --min-confidence value. Must be between 0 and 1.');
        process.exit(1);
      }
    } else if (arg === '--validate-quality') {
      // Phase 26e: Run quality validation comparing optimized vs baseline (CI use)
      validateQuality = true;
    } else if (arg === '--no-ax-tree') {
      // Phase 29: Disable accessibility tree capture
      captureAxTree = false;
    } else if (arg === '--no-auto-crop') {
      // Phase 30: Disable category-aware auto-cropping
      autoCrop = false;
    } else if (arg === '--image-token-budget' && args[i + 1]) {
      // Phase 30: Set max tokens per image
      imageTokenBudget = parseInt(args[i + 1] ?? '300', 10);
      if (isNaN(imageTokenBudget) || imageTokenBudget < 100 || imageTokenBudget > 1000) {
        console.error('Invalid image-token-budget value. Must be between 100 and 1000.');
        process.exit(1);
      }
      i++;
    } else if (arg?.startsWith('--image-token-budget=')) {
      imageTokenBudget = parseInt(arg.split('=')[1] ?? '300', 10);
      if (isNaN(imageTokenBudget) || imageTokenBudget < 100 || imageTokenBudget > 1000) {
        console.error('Invalid image-token-budget value. Must be between 100 and 1000.');
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
    outputFormat,
    outputFile,
    maxSteps,
    toolName,
    scanMode,
    minCoverage,
    visionModel,
    vision,
    visionMaxSteps,
    saveEvidence,
    evidenceDir,
    annotateScreenshots,
    // Phase 24: Hybrid page type detection
    enableLLMPageDetection,
    forceLLMDetection,
    llmDetectionThreshold,
    // Phase 25e: Screenshot mode
    screenshotMode,
    // Phase 25f: Deterministic collection
    llmGuidedCollection,
    // Phase 25g: Evidence JSON output
    writeEvidenceJson,
    // Phase 25i: Collection QA
    skipCollectionQA,
    // Phase 26: Parallel analysis
    sequentialAnalysis,
    maxConcurrentCategories,
    // Phase 26b: Category batching (opt-in)
    categoryBatching,
    // Phase 26c: Viewport filtering (opt-in)
    viewportFiltering,
    // Phase 26e: Quality validation
    validateQuality,
    // Phase 27D: Confidence filtering
    minConfidence,
    // Phase 29: AX tree capture
    captureAxTree,
    // Phase 30: Vision optimization
    autoCrop,
    imageTokenBudget,
    // Phase 32: Agent mode
    agentMode,
    agentMaxSteps,
    agentMaxTimeMs,
    agentNoSubGoals,
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
  --vision                Enable unified CRO analysis with vision
                          - Enforces full-page coverage (scrolls entire page)
                          - Captures DOM + screenshots at each viewport
                          - Maps DOM elements to screenshot coordinates
                          - Evaluates ALL heuristics systematically
                          - Uses category-based analysis for thoroughness
                          - Uses gpt-4o by default (~$0.30-0.50/page)
  --vision-model <model>  Vision model to use (default: gpt-4o)
                          - gpt-4o: High quality analysis (default)
                          - gpt-4o-mini: Fast and cost-effective
  --fast-analysis         Use gpt-4o-mini for analysis (cheaper, lower quality)
  --vision-max-steps <N>  Maximum vision collection steps (default: 20, max: 50)

  Deprecated aliases (kept for backward compatibility):
  --vision-agent          Alias for --vision
  --vision-agent-max-steps  Alias for --vision-max-steps

EVIDENCE CAPTURE OPTIONS (enabled by default with --vision):
  --no-save-evidence      Disable saving evidence and LLM inputs
  --no-annotate-screenshots  Disable bounding box annotations on screenshots
  --no-evidence-json      Disable evidence.json output file (Phase 25g)
  --evidence-dir <path>   Directory for evidence files (default: ./evidence/{timestamp})
                          Created automatically if it doesn't exist

PAGE TYPE DETECTION OPTIONS (Phase 24):
  --no-llm-page-detection   Disable LLM fallback for page type detection
                            Uses Playwright + URL heuristics only
  --force-llm-detection     Force LLM page detection (skip Playwright/heuristic tiers)
  --llm-detection-threshold <n>  Confidence threshold to trigger LLM fallback (default: 0.5)
                            Lower values = more LLM calls, higher accuracy

SCREENSHOT MODE OPTIONS (Phase 25e):
  --screenshot-mode <mode>  Screenshot capture mode for vision analysis (default: viewport)
                            - viewport: Capture viewport-by-viewport as agent scrolls
                            - tiled: Capture full page as overlapping tiles (1800px each)
                            - hybrid: Viewport for first 2 captures + tiled for rest

COLLECTION MODE OPTIONS (Phase 25f-25i):
  --llm-guided-collection   Use LLM-guided collection instead of deterministic (opt-in)
                            By default, collection uses a simple scroll + capture loop
                            with NO LLM calls (faster and cheaper).
                            When enabled, the agent uses LLM to decide scrolling (original behavior).

  --skip-collection-qa      Skip LLM QA validation even if cheap validator flags issues
                            By default, collection runs a cheap validator (0 LLM calls) and
                            escalates to LLM QA only if quality issues are detected.
                            When enabled, skips LLM QA entirely (faster, but may miss issues).

AGENT MODE OPTIONS (Phase 32):
  --agent-mode <goal>       Run goal-directed browser automation instead of CRO analysis
                            Example: --agent-mode "Search Wikipedia for TypeScript"
  --agent-max-steps <N>     Max steps for agent loop (default: 20, max: 100)
  --agent-max-time <ms>     Max time in ms for agent loop (default: 120000)
  --no-sub-goals            Disable sub-goal decomposition (default: on)

ANALYSIS OPTIMIZATION OPTIONS (Phase 26):
  --sequential-analysis     Disable parallel analysis, run categories sequentially
                            By default, categories are analyzed in parallel (3-4x faster).
  --max-concurrent-categories <n>  Max concurrent category analyses (default: 5, max: 20)
  --category-batching       Enable category batching, multiple categories per LLM call (opt-in)
                            Saves ~56% tokens but may reduce quality. Off by default.
  --viewport-filtering      Enable viewport filtering, send only relevant viewports per category (opt-in)
                            Saves ~15-30% tokens but may miss context. Off by default.
  --min-confidence <0-1>    Filter evaluations below confidence threshold (default: 0.7)
                            Low-confidence fail/partial evaluations hidden from display
                            but preserved in evidence output for review.
  --validate-quality        Run quality validation comparing optimized vs baseline (CI use)
                            Runs analysis twice (baseline + optimized), compares results,
                            fails if match rate < 80% or any critical discrepancy found.

  When evidence saving is enabled (default with --vision), the following are saved:
  • Annotated screenshots    → ./evidence/{timestamp}/
  • LLM inputs for debugging → ./llm-inputs/{timestamp}/
    - DOM snapshots (JSON)   → ./llm-inputs/{timestamp}/DOM-snapshots/viewport-N.json
    - Raw screenshots (PNG)  → ./llm-inputs/{timestamp}/Screenshots/viewport-N.png
    - System prompt          → ./llm-inputs/{timestamp}/Prompts/system-prompt.txt
    - User prompts           → ./llm-inputs/{timestamp}/Prompts/viewport-N-prompt.txt

  Legacy flags (still accepted for backward compatibility):
  --save-evidence         Explicitly enable evidence saving (now default)
  --annotate-screenshots  Explicitly enable screenshot annotation (now default)

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

  # Vision mode - comprehensive CRO analysis with DOM + Vision
  npm run start -- --vision https://www.peregrineclothing.co.uk/products/lynton-polo-shirt

  # Vision with custom max steps
  npm run start -- --vision --vision-max-steps 30 https://example.com/product

  # Vision with gpt-4o for higher quality analysis
  npm run start -- --vision --vision-model gpt-4o https://example.com/product

  # Vision mode saves evidence + annotates screenshots by default
  npm run start -- --vision https://example.com/product
  # Output: ./evidence/2026-02-03T10-30-00/ with annotated screenshots

  # Opt-out: No evidence saving
  npm run start -- --vision --no-save-evidence https://example.com/product

  # Opt-out: No annotations (plain screenshots)
  npm run start -- --vision --no-annotate-screenshots https://example.com/product

  # Custom evidence directory
  npm run start -- --vision --evidence-dir ./reports/evidence https://example.com/product
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

    const viewportSize = page.viewportSize() || { width: 1280, height: 800 };
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
 * Process URL with Vision mode
 * CR-001-D: Uses CROAgent unified mode for full-page coverage
 * Unified collection + category-based analysis
 */
async function processVisionMode(
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
    // Phase 24: Hybrid page type detection
    enableLLMPageDetection: boolean;
    forceLLMDetection: boolean;
    llmDetectionThreshold: number;
    // Phase 25e: Screenshot mode
    screenshotMode: ScreenshotMode;
    // Phase 25f: Deterministic collection
    llmGuidedCollection: boolean;
    // Phase 25g: Evidence JSON output (T513)
    writeEvidenceJson: boolean;
    // Phase 25i: Collection QA
    skipCollectionQA: boolean;
    // Phase 26: Parallel analysis
    sequentialAnalysis?: boolean;
    maxConcurrentCategories?: number;
    // Phase 26b: Category batching (opt-in)
    categoryBatching?: boolean;
    // Phase 26c: Viewport filtering (opt-in)
    viewportFiltering?: boolean;
    // Phase 26e: Quality validation
    validateQuality?: boolean;
    // Phase 27D: Confidence filtering
    minConfidence: number;
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
  console.log('  VISION ANALYSIS MODE (Unified Collection + Analysis)');
  console.log('═'.repeat(80));
  console.log(`  URL: ${url}`);
  console.log(`  Model: ${options.visionModel}`);
  console.log(`  Max Steps: ${options.maxSteps}`);
  console.log(`  Scan Mode: full_page (enforced 100% coverage)`);
  console.log(`  Screenshot Mode: ${options.screenshotMode}`);
  console.log(`  Collection Mode: ${options.llmGuidedCollection ? 'LLM-guided (opt-in)' : 'deterministic (default, no LLM)'}`);
  console.log(`  Features: DOM + Vision context, category-based analysis`);
  console.log('═'.repeat(80) + '\n');

  if (options.verbose) {
    console.log(`  ${CYAN}Collection Phase:${RESET}`);
    console.log(`  • Scan mode: full_page`);
    console.log(`  • Target coverage: 100%`);
  }

  try {
    // CR-001-D: Use CROAgent with unified vision mode
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
      // CR-001-D: Use new simplified `vision` flag
      vision: true,
      visionMaxSteps: options.maxSteps,
      scanMode: 'full_page',
      coverageConfig: { minCoveragePercent: 100 },
      visionModel: options.visionModel,
      // NOTE: skipHeuristics removed in CR-002 - heuristic rules superseded by vision analysis
      // Phase 24: Hybrid page type detection options
      hybridDetectionConfig: {
        enableLLMFallback: options.enableLLMPageDetection,
        forceLLMDetection: options.forceLLMDetection,
        llmFallbackThreshold: options.llmDetectionThreshold,
      },
      // Phase 25e: Screenshot mode
      screenshotMode: options.screenshotMode,
      // Phase 25f: Deterministic collection (default) vs LLM-guided (opt-in)
      llmGuidedCollection: options.llmGuidedCollection,
      // Phase 25i: Skip collection QA if requested
      skipCollectionQA: options.skipCollectionQA,
      // Phase 26: Parallel analysis options
      parallelAnalysis: !options.sequentialAnalysis,
      maxConcurrentCategories: options.maxConcurrentCategories,
      // Phase 26b: Category batching (opt-in)
      categoryBatching: options.categoryBatching ?? false,
      // Phase 26c: Viewport filtering (opt-in)
      enableViewportFiltering: options.viewportFiltering ?? false,
      // Phase 29: AX tree capture
      captureAxTree: options.captureAxTree,
      // Phase 30: Vision optimization
      autoCrop: options.autoCrop,
      imageTokenBudget: options.imageTokenBudget,
    });

    // Show collection complete summary
    const snapshotCount = result.snapshots?.length ?? 0;
    if (options.verbose) {
      console.log(`  ${GREEN}✓ Collected ${snapshotCount} viewports${RESET}\n`);
    }

    // Get evaluations from vision analysis
    const evaluations = result.visionAnalysis?.evaluations ?? [];

    // Display results
    console.log('\n' + '═'.repeat(80));
    console.log(`  VISION ANALYSIS RESULTS (${result.pageType?.toUpperCase() ?? 'UNKNOWN'})`);
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

    // DOM-Screenshot Mapping Summary
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
    const failed = evaluations.filter(e => e.status === 'fail' && e.confidence >= options.minConfidence);
    const partial = evaluations.filter(e => e.status === 'partial' && e.confidence >= options.minConfidence);
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
        if (evaluation.reasoning) {
          console.log(`  ${RED}│${RESET}   ${DIM}Reasoning:${RESET} ${evaluation.reasoning}`);
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
        if (evaluation.reasoning) {
          console.log(`  ${YELLOW}│${RESET}   ${DIM}Reasoning:${RESET} ${evaluation.reasoning}`);
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

    // Phase 27D: Confidence filtering summary
    const totalFailPartial = evaluations.filter(e => e.status === 'fail' || e.status === 'partial').length;
    const filteredCount = totalFailPartial - failed.length - partial.length;
    if (filteredCount > 0) {
      console.log(`\n  ${DIM}Filtered ${filteredCount}/${totalFailPartial} evaluations below ${(options.minConfidence * 100).toFixed(0)}% confidence (preserved in evidence)${RESET}`);
    }

    // Error messages if any
    if (result.errors.length > 0) {
      console.log(`\n  ${RED}Errors encountered:${RESET}`);
      for (const error of result.errors) {
        console.log(`  ${RED}  • ${error}${RESET}`);
      }
    }

    // Save evidence if requested
    if (options.saveEvidence && result.snapshots && result.snapshots.length > 0) {
      // Phase 21l: Generate default evidence directory with timestamp if not specified
      let outputDir = options.evidenceDir;
      if (!outputDir) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        outputDir = `./evidence/${timestamp}`;
      }

      console.log(`\n  ${CYAN}Saving evidence screenshots...${RESET}`);

      const writer = new ScreenshotWriter({
        outputDir,
        prefix: 'viewport',
        format: 'png',
        includeTimestamp: true,
      });

      // Phase 25-fix: Use full resolution screenshots for evidence (fallback to compressed)
      let screenshotData = result.snapshots.map((snapshot) => ({
        base64: snapshot.fullResolutionBase64 ?? snapshot.screenshot.base64,
        viewportIndex: snapshot.viewportIndex,
        scrollPosition: snapshot.scrollPosition,
      }));

      if (options.annotateScreenshots) {
        console.log(`  ${CYAN}Annotating screenshots with element highlights...${RESET}`);
        const annotator = new ScreenshotAnnotator({
          highlightIssues: true,
          showElementIndexes: false,
          showCoordinates: false,
        });

        // Annotate each snapshot (on full resolution images)
        const matchedEvalIds = new Set<string>();
        let viewportsWithAnnotations = 0;

        for (let i = 0; i < screenshotData.length; i++) {
          const snapshot = result.snapshots[i];
          if (!snapshot) continue;

          const visibleElements = snapshot.visibleElements ?? [];

          // Get evaluations for this viewport (match by viewportIndex or domElementRefs)
          const viewportEvaluations = evaluations.filter(
            (e) => e.viewportIndex === snapshot.viewportIndex ||
              e.domElementRefs?.some(ref => {
                const parsed = parseElementRef(ref.viewportRef ?? '');
                return parsed && parsed.viewportIndex === snapshot.viewportIndex;
              })
          );

          for (const e of viewportEvaluations) {
            matchedEvalIds.add(e.heuristicId);
          }

          const currentScreenshot = screenshotData[i];
          if (visibleElements.length > 0 && currentScreenshot) {
            const annotationResult = await annotator.annotate(
              currentScreenshot.base64,
              visibleElements,
              viewportEvaluations
            );

            if (annotationResult.success && annotationResult.annotatedBase64) {
              currentScreenshot.base64 = annotationResult.annotatedBase64;
              viewportsWithAnnotations++;
            }
          }
        }

        const withElementRefs = evaluations.filter(e => e.domElementRefs && e.domElementRefs.length > 0).length;
        console.log(`  ${GREEN}Annotated ${matchedEvalIds.size}/${evaluations.length} evaluations across ${viewportsWithAnnotations} viewports (${withElementRefs} with element refs)${RESET}`);
      }

      const sessionId = Date.now().toString(36);
      const writeResult = await writer.saveAllViewportScreenshots(screenshotData, sessionId);

      if (writeResult.successful > 0) {
        console.log(`  ${GREEN}Saved ${writeResult.successful} screenshots to ${writeResult.outputDir}${RESET}`);
      }

      if (writeResult.failed > 0) {
        console.log(`  ${YELLOW}Warning: ${writeResult.failed} screenshots failed to save${RESET}`);
      }

      // Phase 23 (T404): Save LLM inputs for debugging
      if (result.llmInputs && result.llmInputs.length > 0) {
        const llmInputTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const llmInputDir = `./llm-inputs/${llmInputTimestamp}`;

        console.log(`\n  ${CYAN}Saving LLM inputs for debugging...${RESET}`);

        // Convert CapturedCategoryInputs to LLMInputData format
        // Since LLM is called per-category with all viewports, we flatten to per-viewport structure
        const llmInputData: LLMInputData[] = [];
        const systemPrompt = result.llmInputs[0]?.systemPrompt ?? '';
        const viewportsProcessed = new Set<number>();

        for (const categoryInput of result.llmInputs) {
          for (let i = 0; i < categoryInput.screenshots.length; i++) {
            const screenshot = categoryInput.screenshots[i];
            const domSnapshot = categoryInput.domSnapshots[i];
            if (!screenshot || !domSnapshot) continue;

            // Only add unique viewports (avoid duplicates across categories)
            if (viewportsProcessed.has(screenshot.viewportIndex)) continue;
            viewportsProcessed.add(screenshot.viewportIndex);

            llmInputData.push({
              viewportIndex: screenshot.viewportIndex,
              scrollPosition: screenshot.scrollPosition,
              domSnapshot: {
                serialized: domSnapshot.serialized,
                elementCount: domSnapshot.elementCount,
              },
              screenshotBase64: screenshot.base64,
              systemPrompt,
              userPrompt: categoryInput.userPrompt, // Use category's user prompt
              timestamp: categoryInput.timestamp,
            });
          }
        }

        const llmInputWriter = new LLMInputWriter({ outputDir: llmInputDir });
        const llmWriteResult = await llmInputWriter.saveAll(llmInputData, '');

        if (llmWriteResult.success) {
          console.log(`  ${GREEN}Saved ${llmWriteResult.filesWritten} LLM input files to ${llmWriteResult.outputDir}${RESET}`);
        } else {
          console.log(`  ${YELLOW}Warning: Some LLM inputs failed to save${RESET}`);
          for (const error of llmWriteResult.errors.slice(0, 3)) {
            console.log(`    ${RED}• ${error}${RESET}`);
          }
        }
      }

      // Phase 25g (T513): Write evidence.json package
      if (options.writeEvidenceJson) {
        console.log(`\n  ${CYAN}Building evidence package...${RESET}`);

        // Collect all layout boxes from snapshots
        const allLayoutBoxes = result.snapshots.flatMap(
          (s) => s.layoutBoxes ?? []
        );

        // Calculate page height from the highest scroll position + viewport height
        const lastSnapshot = result.snapshots[result.snapshots.length - 1];
        const estimatedPageHeight = lastSnapshot
          ? lastSnapshot.scrollPosition + 800
          : null;

        const evidencePackage = buildEvidencePackage({
          url,
          mode: options.screenshotMode,
          viewportWidth: 1280,
          viewportHeight: 800,
          pageHeight: estimatedPageHeight,
          snapshots: result.snapshots,
          structuredData: null, // TODO: Add structuredData to CROAnalysisResult
          elementBoxes: allLayoutBoxes,
        });

        const evidenceJsonPath = `${outputDir}/evidence.json`;
        await writeEvidenceJsonFile(evidencePackage, evidenceJsonPath);
        console.log(`  ${GREEN}Evidence package saved to ${evidenceJsonPath}${RESET}`);

        // Log warnings if any
        if (evidencePackage.warnings.length > 0) {
          console.log(`  ${YELLOW}Warnings:${RESET}`);
          for (const warning of evidencePackage.warnings.slice(0, 5)) {
            console.log(`    ${YELLOW}• ${warning}${RESET}`);
          }
        }
      }
    }

    // Phase 26e: Quality validation (CI-only, --validate-quality)
    if (options.validateQuality && result.snapshots && result.pageType) {
      console.log('\n' + '─'.repeat(80));
      console.log(`  ${CYAN}QUALITY VALIDATION (comparing optimized vs baseline)${RESET}`);
      console.log('─'.repeat(80));

      const validator = new QualityValidator({ verbose: options.verbose });
      const validationResult = await validator.validate(
        result.snapshots,
        result.pageType,
        {
          analyzerConfig: { model: options.visionModel },
        }
      );

      console.log(`\n  Effective Match Rate: ${(validationResult.effectiveMatchRate * 100).toFixed(1)}% (only critical+major count as mismatches)`);
      console.log(`  Raw Match Rate: ${(validationResult.matchRate * 100).toFixed(1)}% (${validationResult.matchingResults}/${validationResult.totalHeuristics})`);
      console.log(`  Result: ${validationResult.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`}`);

      if (validationResult.discrepancies.length > 0) {
        const criticals = validationResult.discrepancies.filter(d => d.severity === 'critical');
        const majors = validationResult.discrepancies.filter(d => d.severity === 'major');
        const minors = validationResult.discrepancies.filter(d => d.severity === 'minor');

        console.log(`  Discrepancies: ${RED}${criticals.length} critical${RESET}, ${YELLOW}${majors.length} major${RESET}, ${DIM}${minors.length} minor${RESET}`);

        for (const d of criticals) {
          console.log(`    ${RED}✗ CRITICAL: ${d.heuristicId} — ${d.baselineStatus} → ${d.optimizedStatus} (${d.likelyCause})${RESET}`);
        }
        for (const d of majors) {
          console.log(`    ${YELLOW}! MAJOR: ${d.heuristicId} — ${d.baselineStatus} → ${d.optimizedStatus} (${d.likelyCause})${RESET}`);
        }
      }

      if (validationResult.failureReasons.length > 0) {
        console.log(`\n  ${RED}Failure Reasons:${RESET}`);
        for (const reason of validationResult.failureReasons) {
          console.log(`    ${RED}• ${reason}${RESET}`);
        }
      }

      console.log(`\n  Recommendations:`);
      for (const rec of validationResult.recommendations) {
        console.log(`    • ${rec}`);
      }

      if (!validationResult.passed) {
        console.log(`\n  ${RED}Quality validation FAILED — optimizations may degrade analysis quality${RESET}`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('  VISION ANALYSIS COMPLETE');
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
      runId: 'error-no-api-key',
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
      // NOTE: skipHeuristics removed in CR-002 - heuristic rules superseded by vision analysis
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
      runId: `error-${Date.now()}`,
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
    vision,
    visionMaxSteps,
    saveEvidence,
    evidenceDir,
    annotateScreenshots,
    // Phase 24: Hybrid page type detection
    enableLLMPageDetection,
    forceLLMDetection,
    llmDetectionThreshold,
    // Phase 25e: Screenshot mode
    screenshotMode,
    // Phase 25f: Deterministic collection
    llmGuidedCollection,
    // Phase 25g: Evidence JSON output
    writeEvidenceJson,
    // Phase 25i: Collection QA
    skipCollectionQA,
    // Phase 26: Parallel analysis
    sequentialAnalysis,
    maxConcurrentCategories,
    // Phase 26b: Category batching (opt-in)
    categoryBatching,
    // Phase 26c: Viewport filtering (opt-in)
    viewportFiltering,
    // Phase 26e: Quality validation
    validateQuality,
    // Phase 27D: Confidence filtering
    minConfidence,
    // Phase 29: AX tree capture
    captureAxTree,
    // Phase 30: Vision optimization
    autoCrop,
    imageTokenBudget,
    // Phase 32: Agent mode
    agentMode,
    agentMaxSteps,
    agentMaxTimeMs,
    agentNoSubGoals,
    verbose,
    help,
  } = parseArgs();

  // Show help if requested or no URLs provided
  if (help || urls.length === 0) {
    printHelp();
    process.exit(help ? 0 : 1);
  }

  const useColors = process.stdout.isTTY ?? false;

  // Phase 32: Agent mode — goal-directed browser automation
  if (agentMode) {
    const url = urls[0];
    console.log(`\n🤖 Agent Mode: "${agentMode}"`);
    console.log(`   Starting URL: ${url}`);
    console.log(`   Budget: ${agentMaxSteps} steps / ${agentMaxTimeMs}ms\n`);

    const browserManager = new BrowserManager({
      headless,
      browserType: 'chromium',
      timeout,
      waitUntil,
      postLoadWait,
    });
    await browserManager.launch();
    const page = browserManager.getPage();

    try {
      const { ChatOpenAI } = await import('@langchain/openai');
      const llm = new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        temperature: 0,
      });

      const registry = createCRORegistry();
      const toolExecutor = new ToolExecutor(registry);

      const agentConfig: AgentLoopConfig = {
        goal: agentMode,
        startUrl: url,
        maxSteps: agentMaxSteps,
        maxTimeMs: agentMaxTimeMs,
        verbose,
        enableSubGoals: !agentNoSubGoals,
      };

      const result: AgentLoopResult = await runAgentLoop(agentConfig, {
        llm,
        page,
        toolExecutor,
      });

      // Print result summary
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`Status: ${result.status}`);
      console.log(`Goal satisfied: ${result.goalSatisfied ? 'YES' : 'NO'}`);
      console.log(`Steps: ${result.stepsUsed} | Time: ${result.totalTimeMs}ms`);
      console.log(`Reason: ${result.terminationReason}`);
      console.log(`Final URL: ${result.finalUrl}`);
      if (result.errors.length > 0) {
        console.log(`Errors: ${result.errors.join(', ')}`);
      }
      console.log(`${'─'.repeat(60)}\n`);

      if (verbose && result.actionHistory.length > 0) {
        console.log('Action History:');
        for (const action of result.actionHistory) {
          const symbol = action.success ? '✓' : '✗';
          console.log(`  [${action.step}] ${symbol} ${action.toolName}(${JSON.stringify(action.toolParams)}) — ${action.durationMs}ms`);
        }
        console.log('');
      }

      process.exit(result.goalSatisfied ? 0 : 1);
    } finally {
      await browserManager.close();
    }
  }

  // Vision mode: unified collection + analysis (CR-001-D)
  if (vision) {
    for (const url of urls) {
      await processVisionMode(url, {
        headless,
        timeout,
        waitUntil,
        postLoadWait,
        dismissCookieConsent,
        visionModel,  // Phase 27A: Uses MODEL_DEFAULTS.analysis (gpt-4o) by default
        maxSteps: visionMaxSteps,
        saveEvidence,
        evidenceDir,
        annotateScreenshots,
        // Phase 24: Hybrid page type detection
        enableLLMPageDetection,
        forceLLMDetection,
        llmDetectionThreshold,
        // Phase 25e: Screenshot mode
        screenshotMode,
        // Phase 25f: Deterministic collection
        llmGuidedCollection,
        // Phase 25g: Evidence JSON output (T513)
        writeEvidenceJson,
        // Phase 25i: Collection QA
        skipCollectionQA,
        // Phase 26: Parallel analysis
        sequentialAnalysis,
        maxConcurrentCategories,
        // Phase 26b: Category batching (opt-in)
        categoryBatching,
        // Phase 26c: Viewport filtering (opt-in)
        viewportFiltering,
        // Phase 26e: Quality validation
        validateQuality,
        // Phase 27D: Confidence filtering
        minConfidence,
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
