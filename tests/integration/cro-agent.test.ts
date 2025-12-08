/**
 * CROAgent Integration Tests
 *
 * Phase 16 (T086): Integration tests for CROAgent with mock LLM.
 * Tests agent loop completion, state management, and failure handling.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { PromptBuilder } from '../../src/agent/prompt-builder.js';
import { MessageManager } from '../../src/agent/message-manager.js';
import { StateManager } from '../../src/agent/state-manager.js';
import { ToolRegistry, ToolExecutor } from '../../src/agent/tools/index.js';
import type { Tool } from '../../src/agent/tools/index.js';
import type { PageState, CROMemory, DOMTree, CROAgentOutput } from '../../src/models/index.js';
import { parseAgentOutput } from '../../src/models/index.js';

// Mock DOM tree
const createMockDOMTree = (): DOMTree => ({
  root: {
    tagName: 'body',
    xpath: '/body',
    text: '',
    isInteractive: false,
    isVisible: true,
    croType: null,
    children: [
      {
        tagName: 'button',
        xpath: '/body/button[1]',
        text: 'Shop Now',
        isInteractive: true,
        isVisible: true,
        croType: 'cta',
        index: 0,
        children: [],
      },
    ],
  },
  interactiveCount: 1,
  croElementCount: 1,
  totalNodeCount: 2,
  extractedAt: Date.now(),
});

// Mock PageState
const createMockPageState = (): PageState => ({
  url: 'https://example.com',
  title: 'Example Store',
  domTree: createMockDOMTree(),
  viewport: { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false },
  scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 1000 },
  timestamp: Date.now(),
});

// Mock CROMemory
const createMockMemory = (overrides?: Partial<CROMemory>): CROMemory => ({
  stepHistory: [],
  findings: [],
  pagesSeen: ['https://example.com'],
  currentFocus: 'initial_scan',
  errors: [],
  ...overrides,
});

// Mock LLM output
const createMockLLMOutput = (overrides?: Partial<CROAgentOutput>): CROAgentOutput => ({
  thinking: 'Analyzing page for CRO issues',
  evaluation_previous_goal: 'N/A - first step',
  memory: 'Found 1 CTA button',
  next_goal: 'Analyze CTA effectiveness',
  action: {
    name: 'analyze_ctas',
    params: {},
  },
  ...overrides,
});

// Create test tools
const createAnalyzeCTAsTool = (): Tool => ({
  name: 'analyze_ctas',
  description: 'Analyze CTA buttons',
  parameters: z.object({}),
  execute: async () => ({
    success: true,
    insights: [
      {
        id: 'cta-1',
        category: 'cta',
        type: 'weak_text',
        severity: 'medium',
        element: '/body/button[1]',
        issue: 'CTA text could be more action-oriented',
        recommendation: 'Use specific action verbs',
      },
    ],
  }),
});

const createDoneTool = (): Tool => ({
  name: 'done',
  description: 'Mark analysis complete',
  parameters: z.object({ summary: z.string().optional() }),
  execute: async () => ({ success: true, insights: [] }),
});

const createScrollTool = (): Tool => ({
  name: 'scroll_page',
  description: 'Scroll the page',
  parameters: z.object({ direction: z.string().optional() }),
  execute: async () => ({ success: true, insights: [] }),
});

describe('CROAgent Integration', () => {
  describe('Component Integration', () => {
    // Test 1: PromptBuilder + ToolRegistry integration
    it('should inject tools into system prompt', () => {
      const registry = new ToolRegistry();
      registry.register(createAnalyzeCTAsTool());
      registry.register(createDoneTool());

      const builder = new PromptBuilder(registry);
      const systemPrompt = builder.buildSystemPrompt();

      expect(systemPrompt).toContain('analyze_ctas');
      expect(systemPrompt).toContain('done');
      expect(systemPrompt).toContain('Analyze CTA buttons');
    });

    // Test 2: PromptBuilder + MessageManager integration
    it('should build and manage conversation messages', () => {
      const registry = new ToolRegistry();
      registry.register(createAnalyzeCTAsTool());

      const builder = new PromptBuilder(registry);
      const manager = new MessageManager(builder.buildSystemPrompt());

      const state = createMockPageState();
      const memory = createMockMemory();
      const userMsg = builder.buildUserMessage(state, memory);

      manager.addUserMessage(userMsg);
      expect(manager.getMessageCount()).toBe(1);

      const output = createMockLLMOutput();
      manager.addAssistantMessage(output);
      expect(manager.getMessageCount()).toBe(2);

      const messages = manager.getMessages();
      expect(messages.length).toBe(3); // system + user + assistant
    });

    // Test 3: StateManager + ToolExecutor integration
    it('should update state based on tool results', async () => {
      const registry = new ToolRegistry();
      registry.register(createAnalyzeCTAsTool());

      const executor = new ToolExecutor(registry);
      const stateManager = new StateManager();

      const mockPage = {
        url: () => 'https://example.com',
      } as any;

      const result = await executor.execute('analyze_ctas', {}, {
        page: mockPage,
        state: createMockPageState(),
      });

      expect(result.success).toBe(true);
      expect(result.insights.length).toBe(1);

      stateManager.addInsights(result.insights);
      expect(stateManager.getInsights()).toHaveLength(1);
    });
  });

  describe('Agent Loop Simulation', () => {
    let registry: ToolRegistry;
    let executor: ToolExecutor;
    let stateManager: StateManager;
    let builder: PromptBuilder;
    let messageManager: MessageManager;

    beforeEach(() => {
      registry = new ToolRegistry();
      registry.register(createAnalyzeCTAsTool());
      registry.register(createDoneTool());
      registry.register(createScrollTool());

      executor = new ToolExecutor(registry);
      stateManager = new StateManager({ maxSteps: 5 });
      builder = new PromptBuilder(registry);
      messageManager = new MessageManager(builder.buildSystemPrompt());
    });

    // Test 4: Simulate complete agent loop with done action
    it('should complete loop when agent calls done', async () => {
      const mockPage = { url: () => 'https://example.com' } as any;
      const pageState = createMockPageState();

      // Simulate 2 steps then done
      const llmResponses = [
        createMockLLMOutput({ action: { name: 'analyze_ctas', params: {} } }),
        createMockLLMOutput({ action: { name: 'done', params: { summary: 'Analysis complete' } } }),
      ];

      let responseIndex = 0;
      while (!stateManager.shouldTerminate() && responseIndex < llmResponses.length) {
        const step = stateManager.getStep();
        const output = llmResponses[responseIndex];

        // Execute tool
        const result = await executor.execute(output.action.name, output.action.params || {}, {
          page: mockPage,
          state: pageState,
        });

        if (result.success) {
          stateManager.resetFailures();
          stateManager.addInsights(result.insights);
        }

        // Check for done
        if (output.action.name === 'done') {
          stateManager.setDone('Agent completed');
        }

        stateManager.incrementStep();
        responseIndex++;
      }

      expect(stateManager.isDone()).toBe(true);
      expect(stateManager.getStep()).toBe(2);
      expect(stateManager.getInsights()).toHaveLength(1);
    });

    // Test 5: Terminate on max steps
    it('should terminate when max steps reached (SC-022)', async () => {
      const mgr = new StateManager({ maxSteps: 3 });

      for (let i = 0; i < 10; i++) {
        if (mgr.shouldTerminate()) break;
        mgr.incrementStep();
      }

      expect(mgr.shouldTerminate()).toBe(true);
      expect(mgr.getStep()).toBe(3);
      expect(mgr.getTerminationReason()).toContain('Max steps');
    });

    // Test 6: Terminate on consecutive failures
    it('should terminate on too many failures (CR-014)', () => {
      const mgr = new StateManager({ failureLimit: 3 });

      mgr.recordFailure('Error 1');
      mgr.recordFailure('Error 2');
      expect(mgr.shouldTerminate()).toBe(false);

      mgr.recordFailure('Error 3');
      expect(mgr.shouldTerminate()).toBe(true);
      expect(mgr.getTerminationReason()).toContain('failures');
    });

    // Test 7: Reset failures on success
    it('should reset consecutive failures on successful action', async () => {
      const mockPage = { url: () => 'https://example.com' } as any;

      stateManager.recordFailure('Error 1');
      stateManager.recordFailure('Error 2');
      expect(stateManager.getConsecutiveFailures()).toBe(2);

      const result = await executor.execute('analyze_ctas', {}, {
        page: mockPage,
        state: createMockPageState(),
      });

      if (result.success) {
        stateManager.resetFailures();
      }

      expect(stateManager.getConsecutiveFailures()).toBe(0);
      expect(stateManager.getTotalFailures()).toBe(2); // Total preserved
    });

    // Test 8: State accumulation across steps
    it('should accumulate insights across steps (SC-024)', async () => {
      const mockPage = { url: () => 'https://example.com' } as any;
      const pageState = createMockPageState();

      // Simulate 3 analyze_ctas calls
      for (let i = 0; i < 3; i++) {
        const result = await executor.execute('analyze_ctas', {}, {
          page: mockPage,
          state: pageState,
        });
        stateManager.addInsights(result.insights);
        stateManager.incrementStep();
      }

      expect(stateManager.getInsights()).toHaveLength(3);
      expect(stateManager.getStep()).toBe(3);
    });

    // Test 9: Memory tracking across steps
    it('should track step history in memory', async () => {
      const mockPage = { url: () => 'https://example.com' } as any;

      for (let i = 0; i < 3; i++) {
        const action = i < 2 ? 'analyze_ctas' : 'done';
        const result = await executor.execute(action, {}, {
          page: mockPage,
          state: createMockPageState(),
        });

        stateManager.recordStep({
          step: i,
          action,
          result,
          timestamp: Date.now(),
        });
        stateManager.incrementStep();
      }

      const memory = stateManager.getMemory();
      expect(memory.stepHistory).toHaveLength(3);
      expect(memory.stepHistory[0].action).toBe('analyze_ctas');
      expect(memory.stepHistory[2].action).toBe('done');
    });

    // Test 10: Message trimming on long conversations
    it('should trim messages when conversation gets long', () => {
      // Add many messages
      for (let i = 0; i < 30; i++) {
        messageManager.addUserMessage(`User message ${i}`);
        messageManager.addAssistantMessage(createMockLLMOutput());
      }

      expect(messageManager.getMessageCount()).toBe(60);

      // Trim to last 10
      messageManager.trimToLimit(10);
      expect(messageManager.getMessageCount()).toBe(10);

      // Verify oldest messages removed
      const messages = messageManager.getConversationMessages();
      expect(messages[0].content).toContain('25'); // Should start from message 25
    });
  });

  describe('Output Parsing', () => {
    // Test 11: Parse valid LLM output
    it('should parse valid JSON output', () => {
      const json = JSON.stringify(createMockLLMOutput());
      const result = parseAgentOutput(json);

      expect(result.success).toBe(true);
      expect(result.output?.action.name).toBe('analyze_ctas');
    });

    // Test 12: Parse output from markdown code block
    it('should extract JSON from markdown code block', () => {
      const output = createMockLLMOutput({ action: { name: 'done', params: {} } });
      const wrapped = '```json\n' + JSON.stringify(output) + '\n```';

      const result = parseAgentOutput(wrapped);
      expect(result.success).toBe(true);
      expect(result.output?.action.name).toBe('done');
    });

    // Test 13: Handle invalid JSON
    it('should return error for invalid JSON', () => {
      const result = parseAgentOutput('not valid json');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    // Test 14: Handle missing required fields
    it('should return error for missing required fields', () => {
      const incomplete = JSON.stringify({ thinking: 'Test' });
      const result = parseAgentOutput(incomplete);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    // Test 15: Handle invalid action name
    it('should return error for invalid action name', () => {
      const invalid = JSON.stringify({
        thinking: 'Test',
        evaluation_previous_goal: 'N/A',
        memory: 'Test',
        next_goal: 'Test',
        action: { name: 'invalid_action' },
      });

      const result = parseAgentOutput(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Error Recovery', () => {
    let registry: ToolRegistry;
    let executor: ToolExecutor;
    let stateManager: StateManager;

    beforeEach(() => {
      registry = new ToolRegistry();
      registry.register(createAnalyzeCTAsTool());
      executor = new ToolExecutor(registry);
      stateManager = new StateManager();
    });

    // Test 16: Unknown tool returns error
    it('should handle unknown tool gracefully', async () => {
      const mockPage = { url: () => 'https://example.com' } as any;

      const result = await executor.execute('unknown_tool' as any, {}, {
        page: mockPage,
        state: createMockPageState(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');

      stateManager.recordFailure(result.error!);
      expect(stateManager.getConsecutiveFailures()).toBe(1);
    });

    // Test 17: Invalid params returns error
    it('should handle invalid params gracefully', async () => {
      const strictTool: Tool = {
        name: 'analyze_forms',
        description: 'Analyze forms',
        parameters: z.object({
          formIndex: z.number(),
        }),
        execute: async () => ({ success: true, insights: [] }),
      };
      registry.register(strictTool);

      const mockPage = { url: () => 'https://example.com' } as any;
      const result = await executor.execute('analyze_forms', { formIndex: 'not a number' }, {
        page: mockPage,
        state: createMockPageState(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid parameters');
    });

    // Test 18: Tool execution error handled
    it('should handle tool execution errors', async () => {
      const errorTool: Tool = {
        name: 'detect_trust_signals',
        description: 'Detect trust signals',
        parameters: z.object({}),
        execute: async () => {
          throw new Error('DOM extraction failed');
        },
      };
      registry.register(errorTool);

      const mockPage = { url: () => 'https://example.com' } as any;
      const result = await executor.execute('detect_trust_signals', {}, {
        page: mockPage,
        state: createMockPageState(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool execution failed');
    });
  });
});
