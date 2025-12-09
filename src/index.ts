/**
 * Browser Agent
 * Main orchestrator coordinating all modules per FR-007 through FR-010.
 */

import type {
  AgentConfig,
  AgentResult,
  BatchResult,
} from './types/index.js';
import {
  DEFAULT_BROWSER_CONFIG,
  DEFAULT_PROCESSING_CONFIG,
  DEFAULT_AGENT_CONFIG,
} from './types/index.js';
import { BrowserManager, PageLoader } from './browser/index.js';
import { HeadingExtractor } from './extraction/index.js';
import { LangChainProcessor } from './langchain/index.js';
import { ResultFormatter } from './output/index.js';
import { createLogger, validateUrl, validateEnvironment } from './utils/index.js';

const logger = createLogger('BrowserAgent');

/**
 * Main Browser Agent class.
 * Orchestrates browser automation, data extraction, and LangChain processing.
 */
export class BrowserAgent {
  private readonly config: AgentConfig;
  private browserManager: BrowserManager | null = null;
  private readonly langchainProcessor: LangChainProcessor;
  private readonly headingExtractor: HeadingExtractor;
  private readonly formatter: ResultFormatter;

  /**
   * Creates a new BrowserAgent instance.
   * @param config - Partial agent configuration (merged with defaults)
   */
  constructor(config?: Partial<AgentConfig>) {
    this.config = {
      browser: { ...DEFAULT_BROWSER_CONFIG, ...config?.browser },
      processing: { ...DEFAULT_PROCESSING_CONFIG, ...config?.processing },
      verbose: config?.verbose ?? DEFAULT_AGENT_CONFIG.verbose,
    };

    // Initialize components
    this.langchainProcessor = new LangChainProcessor(this.config.processing);
    this.headingExtractor = new HeadingExtractor();
    this.formatter = new ResultFormatter();

    logger.setVerbose(this.config.verbose);
    logger.info('BrowserAgent initialized', {
      browserConfig: this.config.browser,
      processingConfig: { model: this.config.processing.model },
    });
  }

  /**
   * Validates that the environment is properly configured.
   * @throws Error if OPENAI_API_KEY is not set
   */
  validateEnvironment(): void {
    const result = validateEnvironment();
    if (!result.valid) {
      logger.error('Environment validation failed', { error: result.error });
      throw new Error(result.error);
    }
    logger.info('Environment validation passed');
  }

  /**
   * Processes a single URL through the complete workflow.
   * @param url - The URL to process
   * @returns AgentResult with all processing results
   */
  async processUrl(url: string): Promise<AgentResult> {
    const startTime = Date.now();

    // Validate URL first
    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      return {
        url,
        pageLoad: { success: false, url, error: urlValidation.error },
        extraction: null,
        processing: null,
        success: false,
        error: urlValidation.error,
        errorStage: 'load',
        totalTimeMs: Date.now() - startTime,
      };
    }

    const normalizedUrl = urlValidation.normalizedUrl ?? url;

    try {
      // Ensure browser is running
      if (!this.browserManager) {
        this.browserManager = new BrowserManager(this.config.browser);
        await this.browserManager.launch();
      }

      const page = this.browserManager.getPage();
      const pageLoader = new PageLoader(page, {
        timeout: this.config.browser.timeout,
        waitUntil: this.config.browser.waitUntil,
        postLoadWait: this.config.browser.postLoadWait,
        dismissCookieConsent: this.config.browser.dismissCookieConsent,
      });

      // Step 1: Load page
      logger.info('Step 1: Loading page', { url: normalizedUrl });
      const pageLoadResult = await pageLoader.load(normalizedUrl);

      if (!pageLoadResult.success) {
        return {
          url: normalizedUrl,
          pageLoad: pageLoadResult,
          extraction: null,
          processing: null,
          success: false,
          error: pageLoadResult.error,
          errorStage: 'load',
          totalTimeMs: Date.now() - startTime,
        };
      }

      // Step 2: Extract headings
      logger.info('Step 2: Extracting headings');
      let extractionResult;
      try {
        extractionResult = await this.headingExtractor.extract(page);
      } catch (err) {
        const error = err as Error;
        return {
          url: normalizedUrl,
          pageLoad: pageLoadResult,
          extraction: null,
          processing: null,
          success: false,
          error: error.message,
          errorStage: 'extract',
          totalTimeMs: Date.now() - startTime,
        };
      }

      // Step 3: Process with LangChain
      logger.info('Step 3: Processing with LangChain');
      let processingResult;
      try {
        processingResult = await this.langchainProcessor.analyze(extractionResult);
      } catch (err) {
        const error = err as Error;
        return {
          url: normalizedUrl,
          pageLoad: pageLoadResult,
          extraction: extractionResult,
          processing: null,
          success: false,
          error: error.message,
          errorStage: 'process',
          totalTimeMs: Date.now() - startTime,
        };
      }

      // Success!
      const totalTimeMs = Date.now() - startTime;
      logger.info('Processing complete', { url: normalizedUrl, totalTimeMs });

      return {
        url: normalizedUrl,
        pageLoad: pageLoadResult,
        extraction: extractionResult,
        processing: processingResult,
        success: true,
        totalTimeMs,
      };
    } catch (err) {
      const error = err as Error;
      logger.errorWithStack('Unexpected error during processing', error, { url: normalizedUrl });

      return {
        url: normalizedUrl,
        pageLoad: { success: false, url: normalizedUrl, error: error.message },
        extraction: null,
        processing: null,
        success: false,
        error: error.message,
        errorStage: 'load',
        totalTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Processes multiple URLs sequentially.
   * @param urls - Array of URLs to process
   * @returns BatchResult with all results
   */
  async processBatch(urls: string[]): Promise<BatchResult> {
    const startTime = Date.now();
    const results: AgentResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    logger.info('Starting batch processing', { urlCount: urls.length });

    for (const url of urls) {
      const result = await this.processUrl(url);
      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    const totalTimeMs = Date.now() - startTime;
    logger.info('Batch processing complete', {
      urlCount: urls.length,
      successCount,
      failureCount,
      totalTimeMs,
    });

    return {
      results,
      successCount,
      failureCount,
      totalTimeMs,
    };
  }

  /**
   * Formats a single result for console output.
   * @param result - The AgentResult to format
   * @returns Formatted string
   */
  formatResult(result: AgentResult): string {
    return this.formatter.formatResult(result);
  }

  /**
   * Formats batch results for console output.
   * @param batch - The BatchResult to format
   * @returns Formatted string
   */
  formatBatch(batch: BatchResult): string {
    return this.formatter.formatBatch(batch);
  }

  /**
   * Closes the browser and releases all resources.
   */
  async close(): Promise<void> {
    logger.info('Closing BrowserAgent');

    if (this.browserManager) {
      await this.browserManager.close();
      this.browserManager = null;
    }
  }
}

// Re-export types and utilities for external use
export * from './types/index.js';
export { BrowserManager, PageLoader } from './browser/index.js';
export { HeadingExtractor } from './extraction/index.js';
export { LangChainProcessor } from './langchain/index.js';
export {
  ResultFormatter,
  CROElementFormatter,
  ToolResultFormatter,
  AgentProgressFormatter,
  HypothesisGenerator,
  InsightDeduplicator,
  InsightPrioritizer,
  MarkdownReporter,
  JSONExporter,
  FileWriter,
} from './output/index.js';
export { createLogger, validateUrl, validateEnvironment } from './utils/index.js';

// Phase 18: CRO Agent exports (primary)
export { CROAgent, type CROAnalysisResult, type CROScores } from './agent/index.js';
export {
  createCRORegistry,
  ToolRegistry,
  ToolExecutor,
} from './agent/tools/index.js';
export {
  createHeuristicEngine,
  HeuristicEngine,
  BusinessTypeDetector,
  SeverityScorer,
} from './heuristics/index.js';
export * from './models/index.js';
