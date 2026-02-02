/**
 * Vision Agent - Phase 21g (T346)
 *
 * Main vision agent class that implements the observe-reason-act loop
 * with parallel DOM + Vision context for comprehensive heuristic analysis.
 *
 * @deprecated CR-001-B (T514): This standalone VisionAgent is deprecated.
 * Use CROAgent with `enableUnifiedMode: true` instead for integrated
 * collection + analysis workflows. The unified approach provides better
 * coordination between DOM extraction and screenshot capture.
 *
 * This file is kept for backwards compatibility and reference.
 * Will be removed in a future major version.
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import type { Page } from 'playwright';
import { v4 as uuid } from 'uuid';

import type { PageType } from '../../models/index.js';
import type { CROInsight } from '../../models/cro-insight.js';
import type { ViewportInfo } from '../../models/page-state.js';
import { loadHeuristics, getHeuristicIds } from '../../heuristics/knowledge/index.js';
import { getInsightCategory } from '../../heuristics/vision/types.js';
import { createLogger } from '../../utils/index.js';

import type {
  VisionAgentOptions,
  VisionAgentResult,
  VisionAgentState,
  VisionToolContext,
  VisionToolResult,
  HeuristicDefinition,
  BatchEvaluation,
  ViewportSnapshot,
} from './types.js';
import { DEFAULT_VISION_AGENT_OPTIONS } from './types.js';
import { VisionStateManager, type ViewportContext } from './vision-state-manager.js';
import { VisionPromptBuilder } from './vision-prompt-builder.js';
import { VisionMessageManager } from './vision-message-manager.js';
import { createVisionToolRegistry, type VisionToolRegistry } from './tools/index.js';

const logger = createLogger('VisionAgent');

/**
 * Vision Agent for comprehensive heuristic analysis
 *
 * Uses an observe-reason-act loop with parallel DOM + Vision context
 * to systematically evaluate all heuristics for a page.
 *
 * @deprecated CR-001-B (T514): Use CROAgent with `enableUnifiedMode: true` instead.
 * This standalone agent will be removed in a future major version.
 */
export class VisionAgent {
  private options: VisionAgentOptions;
  private toolRegistry: VisionToolRegistry;
  private promptBuilder: VisionPromptBuilder;
  private heuristicDefinitions: Map<string, HeuristicDefinition>;

  constructor(options: Partial<VisionAgentOptions> = {}) {
    this.options = { ...DEFAULT_VISION_AGENT_OPTIONS, ...options };
    this.toolRegistry = createVisionToolRegistry();
    this.promptBuilder = new VisionPromptBuilder(this.toolRegistry);
    this.heuristicDefinitions = new Map();

    logger.debug('VisionAgent initialized', {
      model: this.options.model,
      maxSteps: this.options.maxSteps,
      batchSize: this.options.batchSize,
    });
  }

  /**
   * Analyze a page against heuristics
   *
   * @param page - Playwright page instance
   * @param pageType - Type of page (e.g., 'pdp')
   * @returns Complete analysis result
   */
  async analyze(page: Page, pageType: PageType): Promise<VisionAgentResult> {
    const startedAt = Date.now();
    const url = page.url();

    logger.info('Starting vision agent analysis', { url, pageType });

    // Load heuristics
    this.loadHeuristicDefinitions(pageType);
    const heuristicIds = getHeuristicIds(pageType);

    // Get page dimensions
    const dimensions = await page.evaluate(`
      (() => ({
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        clientWidth: document.documentElement.clientWidth,
        deviceScaleFactor: window.devicePixelRatio || 1,
      }))()
    `) as { scrollHeight: number; clientHeight: number; clientWidth: number; deviceScaleFactor: number };

    const viewport: ViewportInfo = {
      width: dimensions.clientWidth,
      height: dimensions.clientHeight,
      deviceScaleFactor: dimensions.deviceScaleFactor,
      isMobile: dimensions.clientWidth < 768,
    };

    // Initialize state manager
    const stateManager = new VisionStateManager(
      {
        heuristicIds,
        pageHeight: dimensions.scrollHeight,
        viewport,
      },
      this.options
    );

    // Initialize message manager
    const messageManager = new VisionMessageManager();
    messageManager.setSystemPrompt(this.promptBuilder.buildSystemPrompt());

    // Run agent loop
    try {
      await this.runAgentLoop(page, pageType, stateManager, messageManager);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Agent loop failed', { error: message });
      stateManager.markDone('error', message);
    }

    // Build result
    const completedAt = Date.now();
    const state = stateManager.getState();
    const summary = stateManager.getSummary();

    // Transform evaluations to CROInsights
    const insights = this.transformToInsights(state.evaluations);

    const result: VisionAgentResult = {
      pageType,
      url,
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
      stepCount: state.step,
      viewportCount: state.snapshots.length,
      snapshots: state.snapshots,
      evaluations: state.evaluations,
      insights,
      summary,
      terminationReason: state.terminationReason ?? 'all_heuristics_evaluated',
      model: this.options.model,
      errorMessage: state.errorMessage,
    };

    logger.info('Vision agent analysis complete', {
      durationMs: result.durationMs,
      steps: result.stepCount,
      viewports: result.viewportCount,
      evaluated: summary.evaluated,
      total: summary.totalHeuristics,
      coverage: `${summary.coveragePercent.toFixed(1)}%`,
      terminationReason: result.terminationReason,
    });

    return result;
  }

  /**
   * Main agent loop: observe -> reason -> act -> repeat
   */
  private async runAgentLoop(
    page: Page,
    pageType: PageType,
    stateManager: VisionStateManager,
    messageManager: VisionMessageManager
  ): Promise<void> {
    while (!stateManager.shouldTerminate()) {
      const stepStart = Date.now();
      stateManager.incrementStep();

      const state = stateManager.getState();
      logger.debug(`Agent step ${state.step}`, { status: stateManager.getStatusString() });

      // Build tool context
      const toolContext: VisionToolContext = {
        page,
        state,
        options: this.options,
        pageType,
        heuristicDefinitions: this.heuristicDefinitions,
      };

      // OBSERVE: Build user prompt with current context
      const latestSnapshot = stateManager.getLatestSnapshot();
      const userPrompt = this.promptBuilder.buildUserPrompt(
        state,
        pageType,
        this.heuristicDefinitions,
        latestSnapshot
      );

      // Add message with image if we have a snapshot
      if (latestSnapshot) {
        messageManager.addUserMessageWithImage(userPrompt, latestSnapshot.screenshot.base64);
      } else {
        messageManager.addUserMessage(userPrompt);
      }

      // REASON: Call LLM with tools
      let toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
      try {
        toolCalls = await this.callLLMWithTools(messageManager);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('LLM call failed', { error: message });
        stateManager.recordFailure();
        continue;
      }

      if (toolCalls.length === 0) {
        logger.warn('LLM returned no tool calls');
        stateManager.recordFailure();
        continue;
      }

      // ACT: Execute tools
      let anySuccess = false;
      for (const toolCall of toolCalls) {
        const result = await this.executeTool(toolCall, toolContext, stateManager);

        if (result.success) {
          anySuccess = true;
          stateManager.resetFailures();
          // Handle tool-specific state updates
          await this.handleToolSuccess(toolCall.name, result, stateManager);
        }

        // Add tool result to message history
        messageManager.addToolResult(toolCall.name, result);
      }

      if (!anySuccess) {
        stateManager.recordFailure();
      }

      // Log step completion
      const stepDuration = Date.now() - stepStart;
      if (this.options.verbose) {
        logger.debug(`Step ${state.step} complete`, {
          duration: `${stepDuration}ms`,
          tools: toolCalls.map(t => t.name),
          status: stateManager.getStatusString(),
        });
      }
    }
  }

  /**
   * Call LLM with tools and get tool calls
   */
  private async callLLMWithTools(
    messageManager: VisionMessageManager
  ): Promise<Array<{ name: string; arguments: Record<string, unknown> }>> {
    const messages = messageManager.getMessagesForAPI();

    // Debug: Log message sizes
    let totalChars = 0;
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length;
      } else {
        for (const c of msg.content) {
          if ('text' in c && c.text) {
            totalChars += c.text.length;
          } else if ('image_url' in c && c.image_url) {
            totalChars += c.image_url.url.length;
          }
        }
      }
    }
    logger.info('LLM request size', {
      messageCount: messages.length,
      totalChars,
      estimatedTokens: Math.ceil(totalChars / 4),
    });

    // Convert to LangChain message format
    const langChainMessages = messages.map(msg => {
      if (msg.role === 'system') {
        return new SystemMessage(msg.content as string);
      } else if (msg.role === 'assistant') {
        return new AIMessage(msg.content as string);
      } else {
        // User message - could be string or array
        if (typeof msg.content === 'string') {
          return new HumanMessage(msg.content);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return new HumanMessage({ content: msg.content as any });
        }
      }
    });

    // Create model with tools bound
    const modelWithTools = new ChatOpenAI({
      modelName: this.options.model,
      maxTokens: this.options.maxResponseTokens,
      temperature: this.options.temperature,
    }).bindTools(this.toolRegistry.getToolSchemas());

    // Call model
    const response = await modelWithTools.invoke(langChainMessages);

    // Extract tool calls
    const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    if (response.tool_calls && response.tool_calls.length > 0) {
      for (const call of response.tool_calls) {
        toolCalls.push({
          name: call.name,
          arguments: call.args as Record<string, unknown>,
        });
      }
    }

    // Also add assistant message to history
    if (typeof response.content === 'string' && response.content.trim()) {
      messageManager.addAssistantMessage(response.content);
    }

    return toolCalls;
  }

  /**
   * Execute a tool and update state
   */
  private async executeTool(
    toolCall: { name: string; arguments: Record<string, unknown> },
    context: VisionToolContext,
    _stateManager: VisionStateManager
  ): Promise<VisionToolResult> {
    const tool = this.toolRegistry.getTool(toolCall.name);

    if (!tool) {
      logger.warn('Unknown tool called', { name: toolCall.name });
      return { success: false, error: `Unknown tool: ${toolCall.name}` };
    }

    logger.debug('Executing tool', { name: toolCall.name, args: toolCall.arguments });

    try {
      const result = await tool.execute(toolCall.arguments, context);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Tool execution failed', { tool: toolCall.name, error: message });
      return { success: false, error: message };
    }
  }

  /**
   * Handle successful tool execution and update state
   */
  private async handleToolSuccess(
    toolName: string,
    result: VisionToolResult,
    stateManager: VisionStateManager
  ): Promise<void> {
    // Cast to any to access tool-specific properties
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result as any;
    switch (toolName) {
      case 'capture_viewport': {
        const snapshot = r.snapshot as ViewportSnapshot | undefined;
        if (snapshot) {
          stateManager.recordSnapshot(snapshot);
        }
        break;
      }

      case 'scroll_page': {
        const newScrollY = r.newScrollY as number | undefined;
        if (newScrollY !== undefined) {
          stateManager.updateScrollPosition(newScrollY);
        }
        break;
      }

      case 'evaluate_batch': {
        const validatedEvaluations = r._validatedEvaluations as BatchEvaluation[] | undefined;
        if (validatedEvaluations) {
          // Phase 21h (T357): Build viewport context for evidence capture
          const latestSnapshot = stateManager.getLatestSnapshot();
          const viewportContext: ViewportContext | undefined = latestSnapshot
            ? {
                viewportIndex: latestSnapshot.viewportIndex,
                domTree: latestSnapshot.dom.tree,
                elementBoundingBoxes: latestSnapshot.elementBoundingBoxes,
              }
            : undefined;

          const { added } = stateManager.addEvaluations(
            validatedEvaluations,
            this.heuristicDefinitions,
            viewportContext
          );
          logger.debug('Batch evaluations added', { count: added.length });
        }
        break;
      }

      case 'done': {
        stateManager.markDone('explicit_done');
        break;
      }
    }
  }

  /**
   * Load heuristic definitions from knowledge base
   */
  private loadHeuristicDefinitions(pageType: PageType): void {
    const heuristics = loadHeuristics(pageType);

    for (const category of heuristics.categories) {
      for (const heuristic of category.heuristics) {
        this.heuristicDefinitions.set(heuristic.id, {
          id: heuristic.id,
          principle: heuristic.principle,
          severity: heuristic.severity as 'critical' | 'high' | 'medium' | 'low',
          category: category.name,
        });
      }
    }

    logger.debug('Heuristic definitions loaded', {
      pageType,
      count: this.heuristicDefinitions.size,
    });
  }

  /**
   * Transform evaluations to CROInsights
   */
  private transformToInsights(evaluations: VisionAgentState['evaluations']): CROInsight[] {
    const insights: CROInsight[] = [];

    for (const evaluation of evaluations) {
      // Only create insights for failed/partial evaluations
      if (evaluation.status === 'pass' || evaluation.status === 'not_applicable') {
        continue;
      }

      const category = getInsightCategory(evaluation.heuristicId);

      insights.push({
        id: uuid(),
        category,
        type: evaluation.status === 'fail' ? 'issue' : 'partial',
        severity: evaluation.severity,
        element: 'vision-analysis', // Vision analysis doesn't track specific element xpath
        issue: evaluation.issue ?? evaluation.observation,
        recommendation: evaluation.recommendation ?? 'Review the heuristic and apply best practices.',
        heuristicId: evaluation.heuristicId,
        confidence: evaluation.confidence,
      });
    }

    return insights;
  }
}

/**
 * Factory function to create a VisionAgent
 *
 * @deprecated CR-001-B (T514): Use CROAgent with `enableUnifiedMode: true` instead.
 * This factory function will be removed in a future major version.
 */
export function createVisionAgent(options?: Partial<VisionAgentOptions>): VisionAgent {
  return new VisionAgent(options);
}
