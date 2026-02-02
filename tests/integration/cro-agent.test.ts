/**
 * CROAgent Integration Tests
 *
 * Phase 16 (T086): Integration tests for CROAgent with mock LLM.
 * T513: Added tests for CR-001-B unified collection/analysis mode.
 * Tests agent loop completion, state management, and failure handling.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { PromptBuilder } from '../../src/agent/prompt-builder.js';
import { MessageManager } from '../../src/agent/message-manager.js';
import { StateManager } from '../../src/agent/state-manager.js';
import { ToolRegistry, ToolExecutor } from '../../src/agent/tools/index.js';
import type { Tool } from '../../src/agent/tools/index.js';
import type { PageState, CROMemory, DOMTree, CROAgentOutput, ViewportSnapshot } from '../../src/models/index.js';
import { parseAgentOutput } from '../../src/models/index.js';
import type { HeuristicCategory } from '../../src/heuristics/knowledge/index.js';

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
  url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
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
  pagesSeen: ['https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy'],
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
        url: () => 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
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
      const mockPage = { url: () => 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy' } as any;
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
      const mockPage = { url: () => 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy' } as any;

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
      const mockPage = { url: () => 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy' } as any;
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
      const mockPage = { url: () => 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy' } as any;

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
      const mockPage = { url: () => 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy' } as any;

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

      const mockPage = { url: () => 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy' } as any;
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

      const mockPage = { url: () => 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy' } as any;
      const result = await executor.execute('detect_trust_signals', {}, {
        page: mockPage,
        state: createMockPageState(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool execution failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CR-001-B: Unified Collection + Analysis Mode Tests (T513)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('CR-001-B: Unified Collection/Analysis Mode', () => {
    // Create mock viewport snapshot
    const createMockSnapshot = (index: number, scrollY: number): ViewportSnapshot => ({
      viewportIndex: index,
      scrollPosition: scrollY,
      screenshot: {
        base64: 'mockBase64ImageData',
        capturedAt: Date.now(),
      },
      dom: {
        serialized: `[${index}] <button> "Shop Now" [cta]`,
        elementCount: 5,
      },
    });

    // Create mock heuristic category
    const createMockCategory = (): HeuristicCategory => ({
      name: 'Imagery',
      description: 'Product imagery best practices',
      heuristics: [
        {
          id: 'PDP-IMAGERY-001',
          principle: 'Primary product image should be large and high quality',
          checkpoints: ['Check image size', 'Check image quality'],
          severity: 'high',
          category: 'Imagery',
        },
        {
          id: 'PDP-IMAGERY-002',
          principle: 'Multiple product angles should be available',
          checkpoints: ['Check for multiple images'],
          severity: 'medium',
          category: 'Imagery',
        },
      ],
    });

    // Test 19: StateManager tracks viewport snapshots
    it('should track viewport snapshots in state manager (T513)', () => {
      const stateManager = new StateManager();

      const snapshot1 = createMockSnapshot(0, 0);
      const snapshot2 = createMockSnapshot(1, 720);
      const snapshot3 = createMockSnapshot(2, 1440);

      stateManager.addViewportSnapshot(snapshot1);
      stateManager.addViewportSnapshot(snapshot2);
      stateManager.addViewportSnapshot(snapshot3);

      const snapshots = stateManager.getViewportSnapshots();
      expect(snapshots).toHaveLength(3);
      expect(snapshots[0].scrollPosition).toBe(0);
      expect(snapshots[1].scrollPosition).toBe(720);
      expect(snapshots[2].scrollPosition).toBe(1440);
    });

    // Test 20: StateManager tracks agent phase transitions
    it('should track agent phase transitions (T513)', () => {
      const stateManager = new StateManager();

      // Should start in collection phase by default (after enabling unified mode)
      expect(stateManager.getPhase()).toBe('collection');

      // Transition to analysis phase
      stateManager.transitionToAnalysis();
      expect(stateManager.getPhase()).toBe('analysis');

      // Transition to output phase
      stateManager.transitionToOutput();
      expect(stateManager.getPhase()).toBe('output');
    });

    // Test 21: PromptBuilder builds collection phase prompts
    it('should build collection phase system prompt (T513)', () => {
      const registry = new ToolRegistry();
      registry.register(createScrollTool());

      // Register capture_viewport mock tool
      const captureViewportTool: Tool = {
        name: 'capture_viewport',
        description: 'Capture viewport screenshot and DOM',
        parameters: z.object({ reason: z.string() }),
        execute: async () => ({ success: true, insights: [] }),
      };
      registry.register(captureViewportTool);

      // Register collection_done mock tool
      const collectionDoneTool: Tool = {
        name: 'collection_done',
        description: 'Signal collection is complete',
        parameters: z.object({
          summary: z.string(),
          viewportCount: z.number(),
          scrollCoverage: z.number(),
        }),
        execute: async () => ({ success: true, insights: [] }),
      };
      registry.register(collectionDoneTool);

      const builder = new PromptBuilder(registry);
      const collectionPrompt = builder.buildCollectionSystemPrompt();

      expect(collectionPrompt).toContain('capture_viewport');
      expect(collectionPrompt).toContain('collection_done');
      expect(collectionPrompt).toContain('scroll_page');
    });

    // Test 22: PromptBuilder builds analysis phase prompts
    it('should build analysis phase prompts with category (T513)', () => {
      const registry = new ToolRegistry();
      const builder = new PromptBuilder(registry);

      const snapshots = [
        createMockSnapshot(0, 0),
        createMockSnapshot(1, 720),
      ];
      const category = createMockCategory();

      const systemPrompt = builder.buildAnalysisSystemPrompt('pdp');
      const userMessage = builder.buildAnalysisUserMessage(snapshots, category, 'pdp');

      // System prompt should have analysis format
      expect(systemPrompt).toContain('heuristic');
      expect(systemPrompt).toContain('evaluation_format');

      // User message should have DOM context, screenshots, and heuristics
      expect(userMessage).toContain('dom_context');
      expect(userMessage).toContain('screenshots');
      expect(userMessage).toContain('heuristics');
      expect(userMessage).toContain('PDP-IMAGERY-001');
      expect(userMessage).toContain('PDP-IMAGERY-002');
      expect(userMessage).toContain('Imagery');
    });

    // Test 23: MessageManager supports image content
    it('should support image content in messages (T513)', () => {
      const manager = new MessageManager('Test system prompt');

      // Add text-only message
      manager.addUserMessage('Text only message');
      expect(manager.hasImages()).toBe(false);
      expect(manager.getImageCount()).toBe(0);

      // Add message with single image
      manager.addUserMessageWithImage('Message with image', 'base64ImageData1');
      expect(manager.hasImages()).toBe(true);
      expect(manager.getImageCount()).toBe(1);

      // Add message with multiple images
      manager.addUserMessageWithImages('Message with multiple images', [
        'base64ImageData2',
        'base64ImageData3',
      ]);
      expect(manager.getImageCount()).toBe(3);

      // Check token estimation includes images
      const tokens = manager.estimateTokenCount();
      expect(tokens).toBeGreaterThan(0);

      // Check summary
      const summary = manager.getMessageTypeSummary();
      expect(summary.images).toBe(3);
    });

    // Test 24: MessageManager snapshot shows image info
    it('should include image info in snapshot (T513)', () => {
      const manager = new MessageManager('Test system prompt');
      manager.addUserMessageWithImage('Test', 'imageData');

      const snapshot = manager.snapshot();
      expect(snapshot.imageCount).toBe(1);
      expect(snapshot.messages[0].hasImage).toBe(true);
    });

    // Test 25: Collection user message includes snapshot progress
    it('should include snapshot progress in collection message (T513)', () => {
      const registry = new ToolRegistry();
      const builder = new PromptBuilder(registry);

      const state = createMockPageState();
      const memory = createMockMemory();
      const snapshots = [
        createMockSnapshot(0, 0),
        createMockSnapshot(1, 720),
      ];

      const message = builder.buildCollectionUserMessage(state, memory, snapshots);

      expect(message).toContain('collection_status');
      expect(message).toContain('Snapshots captured: 2');
      expect(message).toContain('[0]');
      expect(message).toContain('[1]');
    });

    // Test 26: Collection done transitions to analysis
    it('should transition to analysis after collection done (T513)', async () => {
      const registry = new ToolRegistry();
      const stateManager = new StateManager();

      const collectionDoneTool: Tool = {
        name: 'collection_done',
        description: 'Signal collection is complete',
        parameters: z.object({
          summary: z.string(),
          viewportCount: z.number(),
          scrollCoverage: z.number(),
        }),
        execute: async () => ({
          success: true,
          insights: [],
          extracted: {
            message: 'Collection complete',
          },
        }),
      };
      registry.register(collectionDoneTool);

      const executor = new ToolExecutor(registry);
      const mockPage = { url: () => 'https://example.com' } as any;

      // Execute collection_done
      const result = await executor.execute('collection_done', {
        summary: 'Captured 3 viewports',
        viewportCount: 3,
        scrollCoverage: 100,
      }, {
        page: mockPage,
        state: createMockPageState(),
      });

      expect(result.success).toBe(true);

      // Simulate state transition
      stateManager.transitionToAnalysis();
      expect(stateManager.getPhase()).toBe('analysis');
    });
  });
});
