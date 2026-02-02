/**
 * Vision Agent Integration Tests - Phase 21g (T351)
 *
 * Tests for the complete vision agent flow including:
 * - State management through analysis
 * - Tool execution with mocked page
 * - Heuristic evaluation tracking
 * - DOM + Vision cross-referencing
 * - Complete analysis workflow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Page } from 'playwright';

// Mock LangChain before imports
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    bindTools: vi.fn().mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        content: 'I will analyze the page.',
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
  VisionAgentState,
  ViewportSnapshot,
  HeuristicDefinition,
  BatchEvaluation,
  VisionToolContext,
} from '../../src/agent/vision/types.js';
import { DEFAULT_VISION_AGENT_OPTIONS } from '../../src/agent/vision/types.js';
import type { ViewportInfo } from '../../src/models/page-state.js';
import type { DOMTree, DOMNode } from '../../src/models/dom-tree.js';
import { loadHeuristics, getHeuristicIds } from '../../src/heuristics/knowledge/index.js';

// Import ViewportContext for Phase 21h tests
import type { ViewportContext } from '../../src/agent/vision/vision-state-manager.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Test Fixtures
// ═══════════════════════════════════════════════════════════════════════════════

const createMockViewport = (overrides?: Partial<ViewportInfo>): ViewportInfo => ({
  width: 1920,
  height: 1080,
  deviceScaleFactor: 1,
  isMobile: false,
  ...overrides,
});

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
        text: 'Add to Cart',
        isInteractive: true,
        isVisible: true,
        croType: 'cta',
        index: 0,
        children: [],
      },
      {
        tagName: 'span',
        xpath: '/body/span[1]',
        text: '$99.00',
        isInteractive: false,
        isVisible: true,
        croType: 'trust',
        index: 1,
        children: [],
      },
    ],
  },
  interactiveCount: 1,
  croElementCount: 2,
  totalNodeCount: 3,
  extractedAt: Date.now(),
});

const createMockSnapshot = (index = 0): ViewportSnapshot => ({
  scrollPosition: index * 1080,
  viewportIndex: index,
  screenshot: {
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    capturedAt: Date.now(),
  },
  dom: {
    tree: createMockDOMTree(),
    serialized: '[0] button "Add to Cart" [CTA]\n[1] span "$99.00" [TRUST]',
    elementCount: 2,
  },
  heuristicsEvaluated: [],
});

const createMockPage = (): Page => {
  const page = {
    url: vi.fn().mockReturnValue('https://example.com/products/polo-shirt'),
    evaluate: vi.fn().mockImplementation((script: string | (() => unknown)) => {
      if (typeof script === 'string' && script.includes('scrollHeight')) {
        return Promise.resolve({
          scrollHeight: 3000,
          clientHeight: 1080,
          clientWidth: 1920,
          deviceScaleFactor: 1,
        });
      }
      if (typeof script === 'string' && script.includes('scrollTo')) {
        return Promise.resolve(undefined);
      }
      return Promise.resolve({});
    }),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('mockimage')),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page;
  return page;
};

const createMockHeuristicDefinitions = (ids: string[]): Map<string, HeuristicDefinition> => {
  const definitions = new Map<string, HeuristicDefinition>();
  for (const id of ids) {
    const category = id.split('-')[1] || 'UNKNOWN';
    definitions.set(id, {
      id,
      principle: `Principle for ${id}`,
      severity: id.includes('CTA') || id.includes('PRICE') ? 'critical' : 'high',
      category,
    });
  }
  return definitions;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Complete Agent Flow Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Vision Agent Integration', () => {
  let mockPage: Page;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = createMockPage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Agent initializes correctly
  it('should initialize agent with correct configuration', () => {
    const agent = createVisionAgent({
      model: 'gpt-4o-mini',
      maxSteps: 15,
      verbose: true,
    });

    expect(agent).toBeDefined();
  });

  // Test 2: Knowledge base loads for PDP
  it('should load PDP heuristics from knowledge base', () => {
    const heuristics = loadHeuristics('pdp');

    expect(heuristics.pageType).toBe('pdp');
    expect(heuristics.totalCount).toBeGreaterThan(30);
    expect(heuristics.categories.length).toBeGreaterThan(5);
  });

  // Test 3: Heuristic IDs are extractable
  it('should extract heuristic IDs from knowledge base', () => {
    const ids = getHeuristicIds('pdp');

    expect(ids.length).toBeGreaterThan(30);
    expect(ids.some(id => id.startsWith('PDP-CTA'))).toBe(true);
    expect(ids.some(id => id.startsWith('PDP-PRICE'))).toBe(true);
    expect(ids.some(id => id.startsWith('PDP-IMAGE'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// State Management Integration
// ═══════════════════════════════════════════════════════════════════════════════

describe('Vision State Management Integration', () => {
  const heuristicIds = ['PDP-CTA-001', 'PDP-CTA-002', 'PDP-PRICE-001', 'PDP-IMAGE-001', 'PDP-LAYOUT-001'];
  let stateManager: VisionStateManager;
  let definitions: Map<string, HeuristicDefinition>;

  beforeEach(() => {
    definitions = createMockHeuristicDefinitions(heuristicIds);
    stateManager = new VisionStateManager(
      {
        heuristicIds,
        pageHeight: 3000,
        viewport: createMockViewport(),
      },
      { maxSteps: 20 }
    );
  });

  // Test 4: State tracks full analysis lifecycle
  it('should track complete analysis lifecycle', () => {
    // Step 1: Initial capture
    stateManager.incrementStep();
    const snapshot1 = createMockSnapshot(0);
    stateManager.recordSnapshot(snapshot1);

    expect(stateManager.getStep()).toBe(1);
    expect(stateManager.getSnapshots()).toHaveLength(1);
    expect(stateManager.getCoveragePercent()).toBe(0);

    // Step 2: First batch of evaluations
    stateManager.incrementStep();
    const batch1: BatchEvaluation[] = [
      { heuristicId: 'PDP-CTA-001', status: 'pass', observation: 'CTA visible', confidence: 0.95 },
      { heuristicId: 'PDP-PRICE-001', status: 'fail', observation: 'Price hidden', issue: 'Below fold', confidence: 0.90 },
    ];
    stateManager.addEvaluations(batch1, definitions);

    expect(stateManager.getCoveragePercent()).toBe(40); // 2/5
    expect(stateManager.getPendingHeuristicIds()).toHaveLength(3);

    // Step 3: Scroll and capture more
    stateManager.incrementStep();
    stateManager.updateScrollPosition(1080);
    const snapshot2 = createMockSnapshot(1);
    stateManager.recordSnapshot(snapshot2);

    expect(stateManager.getSnapshots()).toHaveLength(2);
    expect(stateManager.getScrollPercent()).toBeGreaterThan(0);

    // Step 4: Complete remaining evaluations
    stateManager.incrementStep();
    const batch2: BatchEvaluation[] = [
      { heuristicId: 'PDP-CTA-002', status: 'pass', observation: 'Secondary CTA OK', confidence: 0.85 },
      { heuristicId: 'PDP-IMAGE-001', status: 'partial', observation: 'Image quality mixed', issue: 'Some low res', confidence: 0.80 },
      { heuristicId: 'PDP-LAYOUT-001', status: 'not_applicable', observation: 'Single product view', confidence: 0.75 },
    ];
    stateManager.addEvaluations(batch2, definitions);

    expect(stateManager.getCoveragePercent()).toBe(100);
    expect(stateManager.shouldTerminate()).toBe(true);
    expect(stateManager.getTerminationReason()).toBe('all_heuristics_evaluated');

    // Verify summary
    const summary = stateManager.getSummary();
    expect(summary.passed).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.partial).toBe(1);
    expect(summary.notApplicable).toBe(1);
    expect(summary.bySeverity.critical).toBe(1); // PRICE-001 failed (critical)
  });

  // Test 5: State prevents duplicate evaluations
  it('should prevent duplicate heuristic evaluations', () => {
    const batch1: BatchEvaluation[] = [
      { heuristicId: 'PDP-CTA-001', status: 'pass', observation: 'First eval', confidence: 0.95 },
    ];
    const result1 = stateManager.addEvaluations(batch1, definitions);
    expect(result1.added).toEqual(['PDP-CTA-001']);

    // Try to evaluate same heuristic again
    const batch2: BatchEvaluation[] = [
      { heuristicId: 'PDP-CTA-001', status: 'fail', observation: 'Second eval attempt', confidence: 0.80 },
    ];
    const result2 = stateManager.addEvaluations(batch2, definitions);
    expect(result2.skipped).toEqual(['PDP-CTA-001']);
    expect(result2.added).toHaveLength(0);

    // Original evaluation preserved
    const evaluations = stateManager.getEvaluations();
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0].status).toBe('pass');
  });

  // Test 6: State handles failure tracking
  it('should track consecutive failures correctly', () => {
    stateManager.recordFailure();
    stateManager.recordFailure();
    expect(stateManager.getState().consecutiveFailures).toBe(2);

    // Success resets failures
    stateManager.resetFailures();
    expect(stateManager.getState().consecutiveFailures).toBe(0);
  });

  // Test 7: State terminates on max failures
  it('should terminate on max consecutive failures', () => {
    const limitedManager = new VisionStateManager(
      {
        heuristicIds: ['H1'],
        pageHeight: 1000,
        viewport: createMockViewport(),
      },
      { maxConsecutiveFailures: 2 }
    );

    limitedManager.recordFailure();
    expect(limitedManager.shouldTerminate()).toBe(false);

    limitedManager.recordFailure();
    expect(limitedManager.shouldTerminate()).toBe(true);
    expect(limitedManager.getTerminationReason()).toBe('consecutive_failures');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tool Execution Integration
// ═══════════════════════════════════════════════════════════════════════════════

describe('Vision Tool Execution Integration', () => {
  let mockPage: Page;
  let registry: ReturnType<typeof createVisionToolRegistry>;
  let definitions: Map<string, HeuristicDefinition>;

  beforeEach(() => {
    mockPage = createMockPage();
    registry = createVisionToolRegistry();
    definitions = createMockHeuristicDefinitions(['PDP-CTA-001', 'PDP-PRICE-001']);
  });

  // Test 8: scroll_page tool executes correctly
  it('should execute scroll_page tool', async () => {
    const scrollTool = registry.getTool('scroll_page')!;

    const state: VisionAgentState = {
      step: 1,
      snapshots: [],
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

    const context: VisionToolContext = {
      page: mockPage,
      state,
      options: DEFAULT_VISION_AGENT_OPTIONS,
      pageType: 'pdp',
      heuristicDefinitions: definitions,
    };

    const result = await scrollTool.execute({ direction: 'down', amount: 500 }, context);

    expect(result.success).toBe(true);
  });

  // Test 9: evaluate_batch validates heuristic IDs
  it('should validate heuristic IDs in evaluate_batch', async () => {
    const evalTool = registry.getTool('evaluate_batch')!;

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

    const context: VisionToolContext = {
      page: mockPage,
      state,
      options: DEFAULT_VISION_AGENT_OPTIONS,
      pageType: 'pdp',
      heuristicDefinitions: definitions,
    };

    // Test with valid evaluation
    const result = await evalTool.execute({
      evaluations: [
        {
          heuristicId: 'PDP-CTA-001',
          status: 'pass',
          observation: 'CTA is prominent and visible',
          confidence: 0.95,
        },
      ],
    }, context);

    expect(result.success).toBe(true);
    expect((result as any).evaluatedCount).toBe(1);
  });

  // Test 10: done tool requires coverage confirmation
  it('should allow done when coverage confirmed', async () => {
    const doneTool = registry.getTool('done')!;

    // Page requires 50% scroll coverage: maxScroll = 3000-1080 = 1920, 50% = 960px
    const state: VisionAgentState = {
      step: 1,
      snapshots: [],
      currentScrollY: 1000, // 52% scroll - satisfies minimum 50% requirement
      pageHeight: 3000,
      viewportHeight: 1080,
      viewport: createMockViewport(),
      allHeuristicIds: [],
      evaluatedHeuristicIds: new Set(),
      pendingHeuristicIds: [],
      evaluations: [],
      isDone: false,
      consecutiveFailures: 0,
    };

    const context: VisionToolContext = {
      page: mockPage,
      state,
      options: DEFAULT_VISION_AGENT_OPTIONS,
      pageType: 'pdp',
      heuristicDefinitions: definitions,
    };

    const result = await doneTool.execute({
      summary: 'All heuristics evaluated successfully',
      coverageConfirmation: true,
    }, context);

    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Message Management Integration
// ═══════════════════════════════════════════════════════════════════════════════

describe('Vision Message Management Integration', () => {
  let messageManager: VisionMessageManager;
  let promptBuilder: VisionPromptBuilder;

  beforeEach(() => {
    const registry = createVisionToolRegistry();
    messageManager = new VisionMessageManager();
    promptBuilder = new VisionPromptBuilder(registry);
  });

  // Test 11: Full message flow with images
  it('should handle complete message flow with images', () => {
    // Set system prompt
    const systemPrompt = promptBuilder.buildSystemPrompt();
    messageManager.setSystemPrompt(systemPrompt);

    // Add user message with image
    const snapshot = createMockSnapshot();
    messageManager.addUserMessageWithImage(
      'Analyze this viewport for CRO issues',
      snapshot.screenshot.base64
    );

    // Add assistant response
    messageManager.addAssistantMessage('I will analyze the visible elements...');

    // Add tool result
    messageManager.addToolResult('evaluate_batch', {
      success: true,
      evaluatedCount: 3,
    });

    // Verify API format
    const apiMessages = messageManager.getMessagesForAPI();
    expect(apiMessages[0].role).toBe('system');
    expect(apiMessages.length).toBeGreaterThan(1);

    // Verify summary
    const summary = messageManager.getSummary();
    expect(summary.hasImages).toBe(true);
    expect(summary.messageCount).toBe(3);
  });

  // Test 12: Prompt builder creates valid prompts
  it('should build prompts with DOM context', () => {
    const state: VisionAgentState = {
      step: 2,
      snapshots: [createMockSnapshot()],
      currentScrollY: 0,
      pageHeight: 3000,
      viewportHeight: 1080,
      viewport: createMockViewport(),
      allHeuristicIds: ['PDP-CTA-001', 'PDP-PRICE-001'],
      evaluatedHeuristicIds: new Set(['PDP-CTA-001']),
      pendingHeuristicIds: ['PDP-PRICE-001'],
      evaluations: [],
      isDone: false,
      consecutiveFailures: 0,
    };

    const definitions = createMockHeuristicDefinitions(['PDP-CTA-001', 'PDP-PRICE-001']);
    const snapshot = createMockSnapshot();

    const userPrompt = promptBuilder.buildUserPrompt(state, 'pdp', definitions, snapshot);

    expect(userPrompt).toContain('Step: 2');
    expect(userPrompt).toContain('PDP-PRICE-001');
    expect(userPrompt).toContain('dom_context');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DOM + Vision Cross-Reference Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('DOM + Vision Cross-Reference Integration', () => {
  // Test 13: Snapshot contains both DOM and screenshot
  it('should capture both DOM and screenshot in snapshot', () => {
    const snapshot = createMockSnapshot();

    // Verify DOM data
    expect(snapshot.dom.tree).toBeDefined();
    expect(snapshot.dom.serialized).toContain('[0]');
    expect(snapshot.dom.elementCount).toBeGreaterThan(0);

    // Verify screenshot data
    expect(snapshot.screenshot.base64).toBeDefined();
    expect(snapshot.screenshot.capturedAt).toBeDefined();
  });

  // Test 14: Prompt includes DOM element references
  it('should include DOM element references in prompts', () => {
    const registry = createVisionToolRegistry();
    const builder = new VisionPromptBuilder(registry);

    const state: VisionAgentState = {
      step: 1,
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

    const definitions = createMockHeuristicDefinitions(['PDP-CTA-001']);
    const snapshot = createMockSnapshot();

    const prompt = builder.buildUserPrompt(state, 'pdp', definitions, snapshot);

    // Should reference DOM elements by index
    expect(prompt).toContain('[0]');
    expect(prompt).toContain('Add to Cart');
  });

  // Test 15: State tracks heuristics per snapshot
  it('should track which heuristics evaluated at each snapshot', () => {
    const manager = new VisionStateManager(
      {
        heuristicIds: ['H1', 'H2', 'H3'],
        pageHeight: 3000,
        viewport: createMockViewport(),
      }
    );

    // Record first snapshot
    const snapshot1 = createMockSnapshot(0);
    manager.recordSnapshot(snapshot1);
    manager.markSnapshotHeuristics(0, ['H1', 'H2']);

    // Record second snapshot
    const snapshot2 = createMockSnapshot(1);
    manager.recordSnapshot(snapshot2);
    manager.markSnapshotHeuristics(1, ['H3']);

    const snapshots = manager.getSnapshots();
    expect(snapshots[0].heuristicsEvaluated).toEqual(['H1', 'H2']);
    expect(snapshots[1].heuristicsEvaluated).toEqual(['H3']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Edge Case Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Edge Case Integration', () => {
  // Test 16: Handles page that fits in single viewport
  it('should handle single-viewport page', () => {
    const manager = new VisionStateManager({
      heuristicIds: ['H1'],
      pageHeight: 800, // Smaller than viewport
      viewport: createMockViewport({ height: 1080 }),
    });

    expect(manager.getScrollPercent()).toBe(100);
    expect(manager.getState().pageHeight).toBe(800);
  });

  // Test 17: Handles mobile viewport
  it('should handle mobile viewport correctly', () => {
    const mobileViewport = createMockViewport({
      width: 375,
      height: 812,
      isMobile: true,
      deviceScaleFactor: 2,
    });

    const manager = new VisionStateManager({
      heuristicIds: ['PDP-MOBILE-001'],
      pageHeight: 4000,
      viewport: mobileViewport,
    });

    expect(manager.getState().viewport.isMobile).toBe(true);
    expect(manager.getState().viewportHeight).toBe(812);
  });

  // Test 18: Handles rapid state updates
  it('should handle rapid sequential state updates', () => {
    const manager = new VisionStateManager({
      heuristicIds: ['H1', 'H2', 'H3', 'H4', 'H5'],
      pageHeight: 5000,
      viewport: createMockViewport(),
    });

    // Rapid updates
    for (let i = 0; i < 10; i++) {
      manager.incrementStep();
      manager.updateScrollPosition(i * 500);
      manager.recordSnapshot(createMockSnapshot(i));
    }

    expect(manager.getStep()).toBe(10);
    expect(manager.getSnapshots()).toHaveLength(10);
  });

  // Test 19: Recovers from failures then succeeds
  it('should recover from failures and continue', () => {
    const manager = new VisionStateManager(
      {
        heuristicIds: ['H1', 'H2'],
        pageHeight: 2000,
        viewport: createMockViewport(),
      },
      { maxConsecutiveFailures: 3 }
    );

    // Record failures
    manager.recordFailure();
    manager.recordFailure();
    expect(manager.getState().consecutiveFailures).toBe(2);

    // Success resets failures
    manager.resetFailures();
    expect(manager.getState().consecutiveFailures).toBe(0);

    // Can continue
    expect(manager.shouldTerminate()).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Performance & Token Estimation Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Performance Integration', () => {
  // Test 20: Token estimation is reasonable
  it('should estimate tokens within expected range', () => {
    const messageManager = new VisionMessageManager();
    const registry = createVisionToolRegistry();
    const promptBuilder = new VisionPromptBuilder(registry);

    messageManager.setSystemPrompt(promptBuilder.buildSystemPrompt());
    messageManager.addUserMessage('Analyze the page with 35 heuristics...');
    messageManager.addUserMessageWithImage('Screenshot analysis', 'base64data');

    const tokens = messageManager.estimateTotalTokens();

    // Should be reasonable for a typical interaction
    expect(tokens).toBeGreaterThan(100);
    expect(tokens).toBeLessThan(50000); // Not unreasonably large
  });

  // Test 21: State summary generation is fast
  it('should generate summary quickly with many evaluations', () => {
    const ids = Array.from({ length: 35 }, (_, i) => `PDP-TEST-${String(i).padStart(3, '0')}`);
    const definitions = createMockHeuristicDefinitions(ids);

    const manager = new VisionStateManager({
      heuristicIds: ids,
      pageHeight: 5000,
      viewport: createMockViewport(),
    });

    // Add all evaluations
    const evaluations: BatchEvaluation[] = ids.map(id => ({
      heuristicId: id,
      status: Math.random() > 0.5 ? 'pass' : 'fail',
      observation: 'Test observation',
      confidence: 0.9,
    }));

    const startTime = Date.now();
    manager.addEvaluations(evaluations, definitions);
    const summary = manager.getSummary();
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100); // Should be fast
    expect(summary.evaluated).toBe(35);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 21h (T364): Evidence Capture Integration Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Evidence Capture Integration (Phase 21h)', () => {
  // Test 22: End-to-end evidence attachment flow
  it('should attach evidence fields through complete evaluation flow', () => {
    const heuristicIds = ['PDP-CTA-001', 'PDP-PRICE-001'];
    const definitions = createMockHeuristicDefinitions(heuristicIds);

    const manager = new VisionStateManager(
      {
        heuristicIds,
        pageHeight: 3000,
        viewport: createMockViewport(),
      },
      { maxSteps: 20 }
    );

    // Step 1: Record snapshot
    const snapshot = createMockSnapshot(0);
    manager.recordSnapshot(snapshot);

    // Step 2: Create viewport context with DOM tree and bounding boxes
    const mockDOMTree: DOMTree = {
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
            text: 'Add to Cart',
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
    };

    const elementBoundingBoxes = new Map<number, { x: number; y: number; width: number; height: number; viewportIndex: number }>();
    elementBoundingBoxes.set(0, { x: 100, y: 200, width: 150, height: 50, viewportIndex: 0 });

    const viewportContext = {
      viewportIndex: 0,
      domTree: mockDOMTree,
      elementBoundingBoxes,
    };

    // Step 3: Add evaluations with elementIndices
    const evaluations: BatchEvaluation[] = [
      {
        heuristicId: 'PDP-CTA-001',
        status: 'pass',
        observation: 'CTA button at [0] is prominent and visible',
        confidence: 0.95,
        elementIndices: [0],
      },
      {
        heuristicId: 'PDP-PRICE-001',
        status: 'fail',
        observation: 'Price not visible in viewport',
        issue: 'Price is below fold',
        confidence: 0.9,
      },
    ];

    manager.addEvaluations(evaluations, definitions, viewportContext);

    // Verify evidence fields
    const storedEvaluations = manager.getEvaluations();

    // First evaluation should have full evidence
    expect(storedEvaluations[0].viewportIndex).toBe(0);
    expect(storedEvaluations[0].timestamp).toBeDefined();
    expect(storedEvaluations[0].domElementRefs).toHaveLength(1);
    expect(storedEvaluations[0].domElementRefs![0].index).toBe(0);
    expect(storedEvaluations[0].domElementRefs![0].xpath).toBe('/body/button[1]');
    expect(storedEvaluations[0].boundingBox).toBeDefined();
    expect(storedEvaluations[0].boundingBox!.x).toBe(100);

    // Second evaluation should have viewportIndex and timestamp only
    expect(storedEvaluations[1].viewportIndex).toBe(0);
    expect(storedEvaluations[1].timestamp).toBeDefined();
    expect(storedEvaluations[1].domElementRefs).toBeUndefined();
    expect(storedEvaluations[1].boundingBox).toBeUndefined();
  });

  // Test 23: Evidence persists through multiple viewports
  it('should track evidence across multiple viewport snapshots', () => {
    const heuristicIds = ['PDP-CTA-001', 'PDP-LAYOUT-001'];
    const definitions = createMockHeuristicDefinitions(heuristicIds);

    const manager = new VisionStateManager({
      heuristicIds,
      pageHeight: 3000,
      viewport: createMockViewport(),
    });

    // Viewport 0
    manager.recordSnapshot(createMockSnapshot(0));
    manager.addEvaluations(
      [{ heuristicId: 'PDP-CTA-001', status: 'pass', observation: 'OK', confidence: 0.9, elementIndices: [0] }],
      definitions,
      { viewportIndex: 0 }
    );

    // Scroll and viewport 1
    manager.updateScrollPosition(1080);
    manager.recordSnapshot(createMockSnapshot(1));
    manager.addEvaluations(
      [{ heuristicId: 'PDP-LAYOUT-001', status: 'fail', observation: 'Layout issue', issue: 'Problem', confidence: 0.85, elementIndices: [5] }],
      definitions,
      { viewportIndex: 1 }
    );

    const evaluations = manager.getEvaluations();
    expect(evaluations[0].viewportIndex).toBe(0);
    expect(evaluations[1].viewportIndex).toBe(1);
  });

  // Test 24: Summary includes correct stats with evidence
  it('should calculate correct summary with evidence-enriched evaluations', () => {
    const heuristicIds = ['H1', 'H2', 'H3', 'H4'];
    const definitions = createMockHeuristicDefinitions(heuristicIds);

    const manager = new VisionStateManager({
      heuristicIds,
      pageHeight: 2000,
      viewport: createMockViewport(),
    });

    const evaluations: BatchEvaluation[] = [
      { heuristicId: 'H1', status: 'pass', observation: 'Good', confidence: 0.95, elementIndices: [0] },
      { heuristicId: 'H2', status: 'fail', observation: 'Bad', issue: 'Issue', confidence: 0.9, elementIndices: [1, 2] },
      { heuristicId: 'H3', status: 'partial', observation: 'Mixed', confidence: 0.8, elementIndices: [3] },
      { heuristicId: 'H4', status: 'not_applicable', observation: 'N/A', confidence: 0.75 },
    ];

    manager.addEvaluations(evaluations, definitions, { viewportIndex: 0 });

    const summary = manager.getSummary();
    expect(summary.totalHeuristics).toBe(4);
    expect(summary.evaluated).toBe(4);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.partial).toBe(1);
    expect(summary.notApplicable).toBe(1);
    expect(summary.coveragePercent).toBe(100);
  });

  // Test 25: Timestamp ordering is maintained
  it('should maintain timestamp ordering across evaluations', async () => {
    const heuristicIds = ['H1', 'H2'];
    const definitions = createMockHeuristicDefinitions(heuristicIds);

    const manager = new VisionStateManager({
      heuristicIds,
      pageHeight: 1000,
      viewport: createMockViewport(),
    });

    // First batch
    manager.addEvaluations(
      [{ heuristicId: 'H1', status: 'pass', observation: 'OK', confidence: 0.9 }],
      definitions,
      { viewportIndex: 0 }
    );

    // Wait a bit for timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    // Second batch
    manager.addEvaluations(
      [{ heuristicId: 'H2', status: 'pass', observation: 'OK', confidence: 0.9 }],
      definitions,
      { viewportIndex: 0 }
    );

    const evaluations = manager.getEvaluations();
    expect(evaluations[0].timestamp).toBeDefined();
    expect(evaluations[1].timestamp).toBeDefined();
    expect(evaluations[1].timestamp!).toBeGreaterThanOrEqual(evaluations[0].timestamp!);
  });

  // Test 26: Evidence fields serializable to JSON
  it('should produce JSON-serializable evidence fields', () => {
    const heuristicIds = ['PDP-CTA-001'];
    const definitions = createMockHeuristicDefinitions(heuristicIds);

    const manager = new VisionStateManager({
      heuristicIds,
      pageHeight: 1000,
      viewport: createMockViewport(),
    });

    const mockDOMTree: DOMTree = {
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
            xpath: '/body/button',
            text: 'Click Me',
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
    };

    const elementBoundingBoxes = new Map<number, { x: number; y: number; width: number; height: number; viewportIndex: number }>();
    elementBoundingBoxes.set(0, { x: 50, y: 100, width: 200, height: 60, viewportIndex: 0 });

    manager.addEvaluations(
      [{ heuristicId: 'PDP-CTA-001', status: 'pass', observation: 'Good CTA', confidence: 0.95, elementIndices: [0] }],
      definitions,
      { viewportIndex: 0, domTree: mockDOMTree, elementBoundingBoxes }
    );

    const evaluations = manager.getEvaluations();

    // Serialize to JSON and back
    const jsonString = JSON.stringify(evaluations);
    const parsed = JSON.parse(jsonString);

    expect(parsed[0].viewportIndex).toBe(0);
    expect(parsed[0].timestamp).toBeDefined();
    expect(parsed[0].domElementRefs).toHaveLength(1);
    expect(parsed[0].boundingBox.x).toBe(50);
  });

  // Test 27: Multiple element references in single evaluation
  it('should handle multiple element references in single evaluation', () => {
    const heuristicIds = ['PDP-CTA-001'];
    const definitions = createMockHeuristicDefinitions(heuristicIds);

    const manager = new VisionStateManager({
      heuristicIds,
      pageHeight: 1000,
      viewport: createMockViewport(),
    });

    const mockDOMTree: DOMTree = {
      root: {
        tagName: 'body',
        xpath: '/body',
        text: '',
        isInteractive: false,
        isVisible: true,
        croType: null,
        children: [
          { tagName: 'button', xpath: '/body/button[1]', text: 'Buy Now', isInteractive: true, isVisible: true, croType: 'cta', index: 0, children: [] },
          { tagName: 'button', xpath: '/body/button[2]', text: 'Add to Wishlist', isInteractive: true, isVisible: true, croType: 'cta', index: 1, children: [] },
          { tagName: 'span', xpath: '/body/span', text: '$49.99', isInteractive: false, isVisible: true, croType: 'trust', index: 2, children: [] },
        ],
      },
      interactiveCount: 2,
      croElementCount: 3,
      totalNodeCount: 4,
      extractedAt: Date.now(),
    };

    const elementBoundingBoxes = new Map<number, { x: number; y: number; width: number; height: number; viewportIndex: number }>();
    elementBoundingBoxes.set(0, { x: 100, y: 200, width: 150, height: 50, viewportIndex: 0 });
    elementBoundingBoxes.set(1, { x: 100, y: 260, width: 150, height: 40, viewportIndex: 0 });
    elementBoundingBoxes.set(2, { x: 300, y: 200, width: 80, height: 30, viewportIndex: 0 });

    manager.addEvaluations(
      [{
        heuristicId: 'PDP-CTA-001',
        status: 'partial',
        observation: 'Primary CTA [0] is good, but secondary [1] is unclear. Price [2] nearby.',
        issue: 'Secondary CTA needs better text',
        confidence: 0.88,
        elementIndices: [0, 1, 2],
      }],
      definitions,
      { viewportIndex: 0, domTree: mockDOMTree, elementBoundingBoxes }
    );

    const evaluations = manager.getEvaluations();
    expect(evaluations[0].domElementRefs).toHaveLength(3);
    expect(evaluations[0].domElementRefs![0].textContent).toBe('Buy Now');
    expect(evaluations[0].domElementRefs![1].textContent).toBe('Add to Wishlist');
    expect(evaluations[0].domElementRefs![2].textContent).toBe('$49.99');
    // Bounding box should be for first element
    expect(evaluations[0].boundingBox!.x).toBe(100);
    expect(evaluations[0].boundingBox!.y).toBe(200);
  });
});
