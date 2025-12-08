/**
 * CRO Agent
 *
 * Phase 16 (T081): Main CRO analysis agent with observe→reason→act loop.
 * Orchestrates browser automation, DOM extraction, LLM interaction, and tool execution.
 */

import { ChatOpenAI } from '@langchain/openai';
import type { Page } from 'playwright';
import type {
  CROAgentOptions,
  CROInsight,
  PageState,
  DOMTree,
  StepRecord,
} from '../models/index.js';
import { DEFAULT_CRO_OPTIONS, parseAgentOutput } from '../models/index.js';
import { BrowserManager, PageLoader } from '../browser/index.js';
import { DOMExtractor } from '../browser/dom/index.js';
import { ToolRegistry, ToolExecutor } from './tools/index.js';
import { PromptBuilder } from './prompt-builder.js';
import { MessageManager } from './message-manager.js';
import { StateManager } from './state-manager.js';
import { createCRORegistry } from './tools/create-cro-registry.js';
import { createLogger } from '../utils/index.js';
import type { DEFAULT_BROWSER_CONFIG } from '../types/index.js';

/**
 * Result of CRO analysis
 */
export interface CROAnalysisResult {
  url: string;
  success: boolean;
  insights: CROInsight[];
  stepsExecuted: number;
  totalTimeMs: number;
  terminationReason: string;
  errors: string[];
  pageTitle?: string;
}

/**
 * Options for CROAgent.analyze() method
 */
export interface AnalyzeOptions {
  /** Override browser config (headless, timeout, etc.) */
  browserConfig?: Partial<typeof DEFAULT_BROWSER_CONFIG>;
  /** Use a custom tool registry */
  registry?: ToolRegistry;
  /** Enable verbose logging */
  verbose?: boolean;
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
      // ─── 1. INITIALIZE ─────────────────────────────────────────
      const { page, pageTitle } = await this.initializeBrowser(url, analyzeOptions);

      const domExtractor = new DOMExtractor();
      let domTree = await domExtractor.extract(page);

      const registry = analyzeOptions?.registry ?? createCRORegistry();
      const toolExecutor = new ToolExecutor(registry);
      const stateManager = new StateManager(this.options);
      const promptBuilder = new PromptBuilder(registry);
      const messageManager = new MessageManager(promptBuilder.buildSystemPrompt());

      const llm = new ChatOpenAI({
        model: 'gpt-4o-mini',
        temperature: 0,
        timeout: this.options.llmTimeoutMs,
      });

      stateManager.addPageSeen(url);

      this.logger.info('Initialization complete', {
        toolCount: registry.size,
        elementCount: domTree.croElementCount,
      });

      // ─── 2. AGENT LOOP ─────────────────────────────────────────
      while (!stateManager.shouldTerminate()) {
        const step = stateManager.getStep();
        this.logger.info(`Step ${step + 1}/${this.options.maxSteps}`, {
          focus: stateManager.getMemory().currentFocus,
        });

        // a. OBSERVE: Build PageState
        const pageState = await this.buildPageState(page, domTree, url, pageTitle);

        // b. REASON: Call LLM
        const userMsg = promptBuilder.buildUserMessage(pageState, stateManager.getMemory());
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

        this.logger.info('LLM decision', {
          action: output.action.name,
          nextGoal: output.next_goal,
        });

        // c. ACT: Execute tool
        const toolResult = await toolExecutor.execute(
          output.action.name,
          output.action.params || {},
          { page, state: pageState, verbose }
        );

        if (toolResult.success) {
          stateManager.resetFailures();
          stateManager.addInsights(toolResult.insights);
          this.logger.info('Tool success', {
            tool: output.action.name,
            insights: toolResult.insights.length,
            durationMs: toolResult.executionTimeMs,
          });
        } else {
          stateManager.recordFailure(toolResult.error || 'Tool failed');
          errors.push(`Tool error: ${toolResult.error}`);
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

        // d. CHECK: Done action?
        if (output.action.name === 'done') {
          stateManager.setDone('Agent completed analysis');
          this.logger.info('Agent signaled completion');
        }

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

      // ─── 3. CLEANUP & RETURN ───────────────────────────────────
      const result: CROAnalysisResult = {
        url,
        success: true,
        insights: stateManager.getInsights(),
        stepsExecuted: stateManager.getStep(),
        totalTimeMs: Date.now() - startTime,
        terminationReason: stateManager.getTerminationReason(),
        errors,
        pageTitle,
      };

      this.logger.info('Analysis complete', {
        success: true,
        stepsExecuted: result.stepsExecuted,
        insightCount: result.insights.length,
        terminationReason: result.terminationReason,
        totalTimeMs: result.totalTimeMs,
      });

      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Analysis failed', { error: errMsg });

      return {
        url,
        success: false,
        insights: [],
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
}
