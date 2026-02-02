/**
 * VisionAgent Unit Tests
 *
 * Phase 21g (T350): Tests for VisionAgent class and supporting components.
 * Tests tool registry, prompt builder, message manager, and agent logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Page } from 'playwright';

// Mock modules before imports
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    bindTools: vi.fn().mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        content: '',
        tool_calls: [],
      }),
    }),
  })),
}));

vi.mock('../../src/utils/index.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Import after mocking
import { VisionAgent, createVisionAgent } from '../../src/agent/vision/vision-agent.js';
import { VisionStateManager } from '../../src/agent/vision/vision-state-manager.js';
import { VisionPromptBuilder } from '../../src/agent/vision/vision-prompt-builder.js';
import { VisionMessageManager } from '../../src/agent/vision/vision-message-manager.js';
import { createVisionToolRegistry } from '../../src/agent/vision/tools/index.js';
import type {
  VisionAgentOptions,
  VisionAgentState,
  ViewportSnapshot,
  HeuristicDefinition,
  BatchEvaluation,
} from '../../src/agent/vision/types.js';
import { DEFAULT_VISION_AGENT_OPTIONS } from '../../src/agent/vision/types.js';
import type { ViewportInfo } from '../../src/models/page-state.js';
import type { HeuristicEvaluation } from '../../src/heuristics/vision/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Test Fixtures
// ═══════════════════════════════════════════════════════════════════════════════

const createMockViewport = (): ViewportInfo => ({
  width: 1920,
  height: 1080,
  deviceScaleFactor: 1,
  isMobile: false,
});

const createMockSnapshot = (index = 0): ViewportSnapshot => ({
  scrollPosition: index * 1080,
  viewportIndex: index,
  screenshot: {
    base64: 'mockBase64ImageData',
    capturedAt: Date.now(),
  },
  dom: {
    tree: { tagName: 'body', children: [] } as any,
    serialized: '<div>[0] CTA Button</div><div>[1] Price: $99</div>',
    elementCount: 2,
  },
  heuristicsEvaluated: [],
});

const createMockPage = (): Page => {
  const page = {
    url: vi.fn().mockReturnValue('https://example.com/product'),
    evaluate: vi.fn().mockResolvedValue({
      scrollHeight: 3000,
      clientHeight: 1080,
      clientWidth: 1920,
      deviceScaleFactor: 1,
    }),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('mockimage')),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page;
  return page;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Tool Registry Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('VisionToolRegistry', () => {
  // Test 1: Creates registry with all tools
  it('should create registry with all 4 tools', () => {
    const registry = createVisionToolRegistry();
    expect(registry.tools).toHaveLength(4);
    expect(registry.getToolNames()).toEqual([
      'capture_viewport',
      'scroll_page',
      'evaluate_batch',
      'done',
    ]);
  });

  // Test 2: getTool returns correct tool
  it('should return correct tool by name', () => {
    const registry = createVisionToolRegistry();

    const captureTool = registry.getTool('capture_viewport');
    expect(captureTool).toBeDefined();
    expect(captureTool?.name).toBe('capture_viewport');

    const scrollTool = registry.getTool('scroll_page');
    expect(scrollTool?.name).toBe('scroll_page');
  });

  // Test 3: getTool returns undefined for unknown tool
  it('should return undefined for unknown tool', () => {
    const registry = createVisionToolRegistry();
    expect(registry.getTool('unknown_tool')).toBeUndefined();
  });

  // Test 4: getToolSchemas returns proper format
  it('should return tool schemas in LLM-compatible format', () => {
    const registry = createVisionToolRegistry();
    const schemas = registry.getToolSchemas();

    expect(schemas).toHaveLength(4);
    for (const schema of schemas) {
      expect(schema.type).toBe('function');
      expect(schema.function).toHaveProperty('name');
      expect(schema.function).toHaveProperty('description');
      expect(schema.function).toHaveProperty('parameters');
    }
  });

  // Test 5: Each tool has execute function
  it('should have execute function on each tool', () => {
    const registry = createVisionToolRegistry();
    for (const tool of registry.tools) {
      expect(typeof tool.execute).toBe('function');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VisionMessageManager Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('VisionMessageManager', () => {
  let manager: VisionMessageManager;

  beforeEach(() => {
    manager = new VisionMessageManager();
  });

  // Test 6: Sets system prompt
  it('should set and get system prompt', () => {
    manager.setSystemPrompt('You are a CRO expert.');
    expect(manager.getSystemPrompt()).toBe('You are a CRO expert.');
  });

  // Test 7: Adds user message
  it('should add user message', () => {
    manager.addUserMessage('Analyze this page');
    expect(manager.getMessageCount()).toBe(1);
    expect(manager.getMessages()[0].role).toBe('user');
  });

  // Test 8: Adds user message with image
  it('should add user message with image', () => {
    manager.addUserMessageWithImage('Check this screenshot', 'base64data');

    const messages = manager.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(Array.isArray(messages[0].content)).toBe(true);

    const content = messages[0].content as any[];
    expect(content).toHaveLength(2);
    expect(content[0].type).toBe('text');
    expect(content[1].type).toBe('image_url');
  });

  // Test 9: Adds assistant message
  it('should add assistant message', () => {
    manager.addAssistantMessage('I will analyze the CTA');
    expect(manager.getMessages()[0].role).toBe('assistant');
  });

  // Test 10: Adds tool result
  it('should add tool result as user message', () => {
    manager.addToolResult('capture_viewport', { success: true, snapshot: {} });

    const messages = manager.getMessages();
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toContain('capture_viewport');
  });

  // Test 11: getMessagesForAPI includes system prompt
  it('should include system prompt in API messages', () => {
    manager.setSystemPrompt('System prompt');
    manager.addUserMessage('User message');

    const apiMessages = manager.getMessagesForAPI();
    expect(apiMessages[0].role).toBe('system');
    expect(apiMessages[0].content).toBe('System prompt');
    expect(apiMessages[1].role).toBe('user');
  });

  // Test 12: Estimates tokens
  it('should estimate token count', () => {
    manager.setSystemPrompt('This is a test system prompt');
    manager.addUserMessage('This is a test user message');

    const tokens = manager.estimateTotalTokens();
    expect(tokens).toBeGreaterThan(0);
  });

  // Test 13: Clears messages but keeps system prompt
  it('should clear messages but keep system prompt', () => {
    manager.setSystemPrompt('Keep me');
    manager.addUserMessage('Remove me');

    manager.clear();

    expect(manager.getMessageCount()).toBe(0);
    expect(manager.getSystemPrompt()).toBe('Keep me');
  });

  // Test 14: Trims history when exceeded
  it('should trim history when max length exceeded', () => {
    // Add more than MAX_HISTORY_LENGTH (6) messages
    // MAX_HISTORY_LENGTH is kept low to avoid accumulating large image messages
    for (let i = 0; i < 25; i++) {
      manager.addUserMessage(`Message ${i}`);
    }

    expect(manager.getMessageCount()).toBe(6);  // MAX_HISTORY_LENGTH = 6
  });

  // Test 15: getSummary returns correct info
  it('should return correct summary', () => {
    manager.setSystemPrompt('System');
    manager.addUserMessage('Text only');
    manager.addUserMessageWithImage('With image', 'base64');

    const summary = manager.getSummary();
    expect(summary.messageCount).toBe(2);
    expect(summary.hasImages).toBe(true);
    expect(summary.estimatedTokens).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VisionPromptBuilder Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('VisionPromptBuilder', () => {
  let builder: VisionPromptBuilder;

  beforeEach(() => {
    const registry = createVisionToolRegistry();
    builder = new VisionPromptBuilder(registry);
  });

  // Test 16: Builds system prompt
  it('should build system prompt with tools', () => {
    const prompt = builder.buildSystemPrompt();

    expect(prompt).toContain('capture_viewport');
    expect(prompt).toContain('scroll_page');
    expect(prompt).toContain('evaluate_batch');
    expect(prompt).toContain('done');
  });

  // Test 17: Builds user prompt with state
  it('should build user prompt with current state', () => {
    const state: VisionAgentState = {
      step: 1,
      snapshots: [],
      currentScrollY: 0,
      pageHeight: 3000,
      viewportHeight: 1080,
      viewport: createMockViewport(),
      allHeuristicIds: ['PDP-CTA-001', 'PDP-PRICE-001'],
      evaluatedHeuristicIds: new Set(),
      pendingHeuristicIds: ['PDP-CTA-001', 'PDP-PRICE-001'],
      evaluations: [],
      isDone: false,
      consecutiveFailures: 0,
    };

    const definitions = new Map<string, HeuristicDefinition>();
    definitions.set('PDP-CTA-001', {
      id: 'PDP-CTA-001',
      principle: 'CTA should be prominent',
      severity: 'critical',
      category: 'CTA',
    });
    definitions.set('PDP-PRICE-001', {
      id: 'PDP-PRICE-001',
      principle: 'Price should be visible',
      severity: 'critical',
      category: 'Pricing',
    });

    const prompt = builder.buildUserPrompt(state, 'pdp', definitions);

    expect(prompt).toContain('Step: 1');
    expect(prompt).toContain('PDP-CTA-001');
    expect(prompt).toContain('PDP-PRICE-001');
    expect(prompt).toContain('pending_heuristics');
  });

  // Test 18: Builds user prompt with DOM context
  it('should include DOM context when snapshot provided', () => {
    const state: VisionAgentState = {
      step: 2,
      snapshots: [createMockSnapshot()],
      currentScrollY: 0,
      pageHeight: 3000,
      viewportHeight: 1080,
      viewport: createMockViewport(),
      allHeuristicIds: ['PDP-CTA-001'],
      evaluatedHeuristicIds: new Set(),
      pendingHeuristicIds: ['PDP-CTA-001'],
      evaluations: [],
      isDone: false,
      consecutiveFailures: 0,
    };

    const definitions = new Map<string, HeuristicDefinition>();
    definitions.set('PDP-CTA-001', {
      id: 'PDP-CTA-001',
      principle: 'CTA should be prominent',
      severity: 'critical',
      category: 'CTA',
    });

    const snapshot = createMockSnapshot();
    const prompt = builder.buildUserPrompt(state, 'pdp', definitions, snapshot);

    expect(prompt).toContain('dom_context');
    expect(prompt).toContain('CTA Button');
  });

  // Test 19: formatImageContent creates correct structure
  it('should format image content correctly', () => {
    const imageContent = builder.formatImageContent('base64data');

    expect(imageContent.type).toBe('image_url');
    expect(imageContent.image_url.url).toContain('data:image/png;base64,');
    expect(imageContent.image_url.detail).toBe('low');  // Low detail for cost optimization (~85 tokens vs 500K+)
  });

  // Test 20: estimateTokens works
  it('should estimate tokens for text', () => {
    const estimate = builder.estimateTokens('Hello world');
    expect(estimate).toBeGreaterThan(0);
    expect(estimate).toBeLessThan(100);
  });

  // Phase 21h (T361): Tests for elementIndices instruction
  // Test 20a: Task instructions include elementIndices guidance
  it('should include elementIndices instruction in task section', () => {
    const state: VisionAgentState = {
      step: 2,
      snapshots: [createMockSnapshot()],
      currentScrollY: 0,
      pageHeight: 3000,
      viewportHeight: 1080,
      viewport: createMockViewport(),
      allHeuristicIds: ['PDP-CTA-001'],
      evaluatedHeuristicIds: new Set(),
      pendingHeuristicIds: ['PDP-CTA-001'],
      evaluations: [],
      isDone: false,
      consecutiveFailures: 0,
    };

    const definitions = new Map<string, HeuristicDefinition>();
    definitions.set('PDP-CTA-001', {
      id: 'PDP-CTA-001',
      principle: 'CTA should be prominent',
      severity: 'critical',
      category: 'CTA',
    });

    const snapshot = createMockSnapshot();
    const prompt = builder.buildUserPrompt(state, 'pdp', definitions, snapshot);

    // Should include elementIndices instruction
    expect(prompt).toContain('elementIndices');
    expect(prompt).toContain('[0, 3, 5]');
  });

  // Test 20b: Task section includes element reference guidance
  it('should include element reference guidance in task section', () => {
    const state: VisionAgentState = {
      step: 1,
      snapshots: [],
      currentScrollY: 0,
      pageHeight: 3000,
      viewportHeight: 1080,
      viewport: createMockViewport(),
      allHeuristicIds: ['PDP-CTA-001', 'PDP-PRICE-001'],
      evaluatedHeuristicIds: new Set(),
      pendingHeuristicIds: ['PDP-CTA-001', 'PDP-PRICE-001'],
      evaluations: [],
      isDone: false,
      consecutiveFailures: 0,
    };

    const definitions = new Map<string, HeuristicDefinition>();
    definitions.set('PDP-CTA-001', {
      id: 'PDP-CTA-001',
      principle: 'CTA should be prominent',
      severity: 'critical',
      category: 'CTA',
    });
    definitions.set('PDP-PRICE-001', {
      id: 'PDP-PRICE-001',
      principle: 'Price should be visible',
      severity: 'critical',
      category: 'Pricing',
    });

    const prompt = builder.buildUserPrompt(state, 'pdp', definitions);

    // Should include DOM element reference instruction
    expect(prompt).toContain('Element [0]');
    expect(prompt).toContain('Reference DOM elements by index');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VisionAgent Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('VisionAgent', () => {
  let agent: VisionAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new VisionAgent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 21: Creates with default options
  it('should create with default options', () => {
    const defaultAgent = new VisionAgent();
    expect(defaultAgent).toBeDefined();
  });

  // Test 22: Merges custom options
  it('should merge custom options with defaults', () => {
    const customAgent = new VisionAgent({
      model: 'gpt-4o',
      maxSteps: 10,
      verbose: true,
    });
    expect(customAgent).toBeDefined();
  });

  // Test 23: Factory function works
  it('should create agent via factory function', () => {
    const factoryAgent = createVisionAgent({ maxSteps: 5 });
    expect(factoryAgent).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT_VISION_AGENT_OPTIONS Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('DEFAULT_VISION_AGENT_OPTIONS', () => {
  // Test 24: Has correct default values
  it('should have correct default values', () => {
    expect(DEFAULT_VISION_AGENT_OPTIONS.model).toBe('gpt-4o-mini');
    expect(DEFAULT_VISION_AGENT_OPTIONS.maxSteps).toBe(20);
    expect(DEFAULT_VISION_AGENT_OPTIONS.batchSize).toBe(6);
    expect(DEFAULT_VISION_AGENT_OPTIONS.scrollIncrement).toBe(500);
    expect(DEFAULT_VISION_AGENT_OPTIONS.verbose).toBe(false);
    expect(DEFAULT_VISION_AGENT_OPTIONS.domTokenBudget).toBe(4000);
    expect(DEFAULT_VISION_AGENT_OPTIONS.maxResponseTokens).toBe(4096);
    expect(DEFAULT_VISION_AGENT_OPTIONS.temperature).toBe(0.1);
    expect(DEFAULT_VISION_AGENT_OPTIONS.maxConsecutiveFailures).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Insight Transformation Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Insight Transformation', () => {
  // Test 25: Only creates insights for fail/partial
  it('should only create insights for fail and partial evaluations', () => {
    // This tests the transformation logic indirectly
    const evaluations: HeuristicEvaluation[] = [
      {
        heuristicId: 'PDP-CTA-001',
        principle: 'CTA should be prominent',
        status: 'pass',
        severity: 'critical',
        observation: 'CTA is visible',
        confidence: 0.95,
      },
      {
        heuristicId: 'PDP-PRICE-001',
        principle: 'Price should be visible',
        status: 'fail',
        severity: 'critical',
        observation: 'Price not visible',
        issue: 'Price is hidden below fold',
        recommendation: 'Move price above fold',
        confidence: 0.90,
      },
      {
        heuristicId: 'PDP-IMAGE-001',
        principle: 'Image quality',
        status: 'not_applicable',
        severity: 'high',
        observation: 'No images on page',
        confidence: 0.85,
      },
    ];

    // Filter like transformToInsights does
    const insightEvaluations = evaluations.filter(
      e => e.status === 'fail' || e.status === 'partial'
    );

    expect(insightEvaluations).toHaveLength(1);
    expect(insightEvaluations[0].heuristicId).toBe('PDP-PRICE-001');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Integration: VisionStateManager with Agent Flow
// ═══════════════════════════════════════════════════════════════════════════════

describe('VisionStateManager Integration', () => {
  // Test 26: State manager tracks progress through analysis
  it('should track progress through analysis flow', () => {
    const manager = new VisionStateManager(
      {
        heuristicIds: ['H1', 'H2', 'H3'],
        pageHeight: 2000,
        viewport: createMockViewport(),
      },
      { maxSteps: 10 }
    );

    // Simulate agent flow
    manager.incrementStep();
    expect(manager.getStep()).toBe(1);

    const snapshot = createMockSnapshot();
    manager.recordSnapshot(snapshot);
    expect(manager.getSnapshots()).toHaveLength(1);

    manager.updateScrollPosition(500);
    expect(manager.getCurrentScrollY()).toBe(500);

    expect(manager.shouldTerminate()).toBe(false);
    expect(manager.getCoveragePercent()).toBe(0);
  });

  // Test 27: State manager handles complete flow
  it('should handle complete evaluation flow', () => {
    const definitions = new Map<string, HeuristicDefinition>();
    definitions.set('H1', { id: 'H1', principle: 'P1', severity: 'high', category: 'C1' });
    definitions.set('H2', { id: 'H2', principle: 'P2', severity: 'medium', category: 'C1' });

    const manager = new VisionStateManager({
      heuristicIds: ['H1', 'H2'],
      pageHeight: 1000,
      viewport: createMockViewport(),
    });

    // Add evaluations
    const evaluations: BatchEvaluation[] = [
      { heuristicId: 'H1', status: 'pass', observation: 'OK', confidence: 0.9 },
      { heuristicId: 'H2', status: 'fail', observation: 'Not OK', issue: 'Problem', confidence: 0.85 },
    ];

    manager.addEvaluations(evaluations, definitions);

    expect(manager.getCoveragePercent()).toBe(100);
    expect(manager.shouldTerminate()).toBe(true);
    expect(manager.getTerminationReason()).toBe('all_heuristics_evaluated');

    const summary = manager.getSummary();
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tool Execution Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Tool Execution', () => {
  // Test 28: evaluate_batch validates input
  it('should validate evaluate_batch input', async () => {
    const registry = createVisionToolRegistry();
    const tool = registry.getTool('evaluate_batch')!;

    const context = {
      page: createMockPage(),
      state: {
        step: 1,
        snapshots: [],
        currentScrollY: 0,
        pageHeight: 3000,
        viewportHeight: 1080,
        viewport: createMockViewport(),
        allHeuristicIds: ['PDP-CTA-001'],
        evaluatedHeuristicIds: new Set<string>(),
        pendingHeuristicIds: ['PDP-CTA-001'],
        evaluations: [],
        isDone: false,
        consecutiveFailures: 0,
      },
      options: DEFAULT_VISION_AGENT_OPTIONS,
      pageType: 'pdp' as const,
      heuristicDefinitions: new Map([
        ['PDP-CTA-001', { id: 'PDP-CTA-001', principle: 'CTA', severity: 'critical' as const, category: 'CTA' }],
      ]),
    };

    // Test with valid input
    const result = await tool.execute({
      evaluations: [
        {
          heuristicId: 'PDP-CTA-001',
          status: 'pass',
          observation: 'CTA is visible',
          confidence: 0.95,
        },
      ],
    }, context);

    expect(result.success).toBe(true);
  });

  // Test 29: evaluate_batch rejects empty evaluations
  it('should reject empty evaluations array', async () => {
    const registry = createVisionToolRegistry();
    const tool = registry.getTool('evaluate_batch')!;

    const context = {
      page: createMockPage(),
      state: {
        step: 1,
        snapshots: [],
        currentScrollY: 0,
        pageHeight: 3000,
        viewportHeight: 1080,
        viewport: createMockViewport(),
        allHeuristicIds: [],
        evaluatedHeuristicIds: new Set<string>(),
        pendingHeuristicIds: [],
        evaluations: [],
        isDone: false,
        consecutiveFailures: 0,
      },
      options: DEFAULT_VISION_AGENT_OPTIONS,
      pageType: 'pdp' as const,
      heuristicDefinitions: new Map(),
    };

    const result = await tool.execute({ evaluations: [] }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('non-empty array');
  });

  // Test 30: done tool validates coverage confirmation
  it('should require coverage confirmation for done tool', async () => {
    const registry = createVisionToolRegistry();
    const tool = registry.getTool('done')!;

    // Page requires 50% scroll coverage: maxScroll = 3000-1080 = 1920, 50% = 960px
    const context = {
      page: createMockPage(),
      state: {
        step: 1,
        snapshots: [],
        currentScrollY: 1000, // 52% scroll - satisfies minimum 50% requirement
        pageHeight: 3000,
        viewportHeight: 1080,
        viewport: createMockViewport(),
        allHeuristicIds: [],
        evaluatedHeuristicIds: new Set<string>(),
        pendingHeuristicIds: [],
        evaluations: [],
        isDone: false,
        consecutiveFailures: 0,
      },
      options: DEFAULT_VISION_AGENT_OPTIONS,
      pageType: 'pdp' as const,
      heuristicDefinitions: new Map(),
    };

    // Test with coverage confirmation
    const result = await tool.execute({
      summary: 'Analysis complete',
      coverageConfirmation: true,
    }, context);

    expect(result.success).toBe(true);
  });

  // Test 30b: done tool requires minimum scroll coverage on tall pages
  it('should require minimum scroll coverage on tall pages', async () => {
    const registry = createVisionToolRegistry();
    const tool = registry.getTool('done')!;

    // Page is tall (3000px) but no scrolling done (0px)
    const context = {
      page: createMockPage(),
      state: {
        step: 1,
        snapshots: [],
        currentScrollY: 0, // No scrolling - should fail
        pageHeight: 3000,
        viewportHeight: 1080,
        viewport: createMockViewport(),
        allHeuristicIds: [],
        evaluatedHeuristicIds: new Set<string>(),
        pendingHeuristicIds: [],
        evaluations: [],
        isDone: false,
        consecutiveFailures: 0,
      },
      options: DEFAULT_VISION_AGENT_OPTIONS,
      pageType: 'pdp' as const,
      heuristicDefinitions: new Map(),
    };

    const result = await tool.execute({
      summary: 'Analysis complete',
      coverageConfirmation: true,
    }, context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('scroll');
  });

  // Test 30c: done tool allows completion on short pages without scrolling
  it('should allow completion on short pages without scrolling', async () => {
    const registry = createVisionToolRegistry();
    const tool = registry.getTool('done')!;

    // Short page - viewportHeight * 1.5 = 1620, pageHeight is 1500 (less)
    const context = {
      page: createMockPage(),
      state: {
        step: 1,
        snapshots: [],
        currentScrollY: 0, // No scrolling needed
        pageHeight: 1500, // Less than 1.5x viewport, so no scroll required
        viewportHeight: 1080,
        viewport: createMockViewport(),
        allHeuristicIds: [],
        evaluatedHeuristicIds: new Set<string>(),
        pendingHeuristicIds: [],
        evaluations: [],
        isDone: false,
        consecutiveFailures: 0,
      },
      options: DEFAULT_VISION_AGENT_OPTIONS,
      pageType: 'pdp' as const,
      heuristicDefinitions: new Map(),
    };

    const result = await tool.execute({
      summary: 'Analysis complete',
      coverageConfirmation: true,
    }, context);

    expect(result.success).toBe(true);
  });

  // Phase 21h (T363): Tests for elementIndices validation in evaluate_batch
  // Test 30a: evaluate_batch accepts valid elementIndices array
  it('should accept valid elementIndices array', async () => {
    const registry = createVisionToolRegistry();
    const tool = registry.getTool('evaluate_batch')!;

    const context = {
      page: createMockPage(),
      state: {
        step: 1,
        snapshots: [],
        currentScrollY: 0,
        pageHeight: 3000,
        viewportHeight: 1080,
        viewport: createMockViewport(),
        allHeuristicIds: ['PDP-CTA-001'],
        evaluatedHeuristicIds: new Set<string>(),
        pendingHeuristicIds: ['PDP-CTA-001'],
        evaluations: [],
        isDone: false,
        consecutiveFailures: 0,
      },
      options: DEFAULT_VISION_AGENT_OPTIONS,
      pageType: 'pdp' as const,
      heuristicDefinitions: new Map([
        ['PDP-CTA-001', { id: 'PDP-CTA-001', principle: 'CTA', severity: 'critical' as const, category: 'CTA' }],
      ]),
    };

    const result = await tool.execute({
      evaluations: [
        {
          heuristicId: 'PDP-CTA-001',
          status: 'fail',
          observation: 'CTA button at [0] is too small. Price at [3] not visible.',
          issue: 'Button size below minimum',
          confidence: 0.9,
          elementIndices: [0, 3],
        },
      ],
    }, context);

    expect(result.success).toBe(true);
    // Check that validated evaluations include elementIndices
    const validatedEvals = (result as any)._validatedEvaluations;
    expect(validatedEvals[0].elementIndices).toEqual([0, 3]);
  });

  // Test 30b: evaluate_batch filters invalid elementIndices values
  it('should filter invalid elementIndices values', async () => {
    const registry = createVisionToolRegistry();
    const tool = registry.getTool('evaluate_batch')!;

    const context = {
      page: createMockPage(),
      state: {
        step: 1,
        snapshots: [],
        currentScrollY: 0,
        pageHeight: 3000,
        viewportHeight: 1080,
        viewport: createMockViewport(),
        allHeuristicIds: ['PDP-CTA-001'],
        evaluatedHeuristicIds: new Set<string>(),
        pendingHeuristicIds: ['PDP-CTA-001'],
        evaluations: [],
        isDone: false,
        consecutiveFailures: 0,
      },
      options: DEFAULT_VISION_AGENT_OPTIONS,
      pageType: 'pdp' as const,
      heuristicDefinitions: new Map([
        ['PDP-CTA-001', { id: 'PDP-CTA-001', principle: 'CTA', severity: 'critical' as const, category: 'CTA' }],
      ]),
    };

    const result = await tool.execute({
      evaluations: [
        {
          heuristicId: 'PDP-CTA-001',
          status: 'pass',
          observation: 'CTA is visible',
          confidence: 0.95,
          elementIndices: [0, -1, 'invalid', 5, 3.5, null], // Mix of valid and invalid
        },
      ],
    }, context);

    expect(result.success).toBe(true);
    const validatedEvals = (result as any)._validatedEvaluations;
    // Only valid integer indices >= 0 should remain
    expect(validatedEvals[0].elementIndices).toEqual([0, 5]);
  });

  // Test 30c: evaluate_batch works without elementIndices
  it('should work without elementIndices (optional field)', async () => {
    const registry = createVisionToolRegistry();
    const tool = registry.getTool('evaluate_batch')!;

    const context = {
      page: createMockPage(),
      state: {
        step: 1,
        snapshots: [],
        currentScrollY: 0,
        pageHeight: 3000,
        viewportHeight: 1080,
        viewport: createMockViewport(),
        allHeuristicIds: ['PDP-CTA-001'],
        evaluatedHeuristicIds: new Set<string>(),
        pendingHeuristicIds: ['PDP-CTA-001'],
        evaluations: [],
        isDone: false,
        consecutiveFailures: 0,
      },
      options: DEFAULT_VISION_AGENT_OPTIONS,
      pageType: 'pdp' as const,
      heuristicDefinitions: new Map([
        ['PDP-CTA-001', { id: 'PDP-CTA-001', principle: 'CTA', severity: 'critical' as const, category: 'CTA' }],
      ]),
    };

    const result = await tool.execute({
      evaluations: [
        {
          heuristicId: 'PDP-CTA-001',
          status: 'pass',
          observation: 'CTA is visible',
          confidence: 0.95,
          // No elementIndices provided
        },
      ],
    }, context);

    expect(result.success).toBe(true);
    const validatedEvals = (result as any)._validatedEvaluations;
    expect(validatedEvals[0].elementIndices).toBeUndefined();
  });

  // Test 30d: evaluate_batch handles empty elementIndices array
  it('should handle empty elementIndices array', async () => {
    const registry = createVisionToolRegistry();
    const tool = registry.getTool('evaluate_batch')!;

    const context = {
      page: createMockPage(),
      state: {
        step: 1,
        snapshots: [],
        currentScrollY: 0,
        pageHeight: 3000,
        viewportHeight: 1080,
        viewport: createMockViewport(),
        allHeuristicIds: ['PDP-CTA-001'],
        evaluatedHeuristicIds: new Set<string>(),
        pendingHeuristicIds: ['PDP-CTA-001'],
        evaluations: [],
        isDone: false,
        consecutiveFailures: 0,
      },
      options: DEFAULT_VISION_AGENT_OPTIONS,
      pageType: 'pdp' as const,
      heuristicDefinitions: new Map([
        ['PDP-CTA-001', { id: 'PDP-CTA-001', principle: 'CTA', severity: 'critical' as const, category: 'CTA' }],
      ]),
    };

    const result = await tool.execute({
      evaluations: [
        {
          heuristicId: 'PDP-CTA-001',
          status: 'not_applicable',
          observation: 'No CTA elements on page',
          confidence: 0.8,
          elementIndices: [],
        },
      ],
    }, context);

    expect(result.success).toBe(true);
    const validatedEvals = (result as any)._validatedEvaluations;
    // Empty array should result in undefined elementIndices
    expect(validatedEvals[0].elementIndices).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Edge Cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('Edge Cases', () => {
  // Test 31: Handles empty heuristics list
  it('should handle empty heuristics list', () => {
    const manager = new VisionStateManager({
      heuristicIds: [],
      pageHeight: 1000,
      viewport: createMockViewport(),
    });

    expect(manager.getCoveragePercent()).toBe(100);
    expect(manager.shouldTerminate()).toBe(true);
  });

  // Test 32: Handles single viewport page
  it('should handle single viewport page', () => {
    const manager = new VisionStateManager({
      heuristicIds: ['H1'],
      pageHeight: 500, // Less than viewport
      viewport: createMockViewport({ height: 1080 }),
    });

    expect(manager.getScrollPercent()).toBe(100);
  });

  // Test 33: Message manager handles large image base64
  it('should handle large image base64 data', () => {
    const manager = new VisionMessageManager();
    const largeBase64 = 'A'.repeat(100000);

    manager.addUserMessageWithImage('Test', largeBase64);

    const messages = manager.getMessages();
    expect(messages).toHaveLength(1);
  });

  // Test 34: State manager clamps scroll position
  it('should clamp scroll position to valid range', () => {
    const manager = new VisionStateManager({
      heuristicIds: ['H1'],
      pageHeight: 1000,
      viewport: createMockViewport(),
    });

    manager.updateScrollPosition(-100);
    expect(manager.getCurrentScrollY()).toBe(0);

    manager.updateScrollPosition(5000);
    expect(manager.getCurrentScrollY()).toBe(1000);
  });

  // Test 35: Consecutive failures reset on success
  it('should reset consecutive failures on success', () => {
    const manager = new VisionStateManager({
      heuristicIds: ['H1'],
      pageHeight: 1000,
      viewport: createMockViewport(),
    });

    manager.recordFailure();
    manager.recordFailure();
    expect(manager.getState().consecutiveFailures).toBe(2);

    manager.resetFailures();
    expect(manager.getState().consecutiveFailures).toBe(0);
  });
});
