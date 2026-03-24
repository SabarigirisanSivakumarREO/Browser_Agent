/**
 * Agent Loop Integration Tests — Phase 32f (T735)
 *
 * Tests the full perceive→plan→act→verify loop with mocked LLM and
 * mock Page object. Validates end-to-end behavior of the agent loop.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ax-tree-serializer before importing agent-loop modules
vi.mock('../../src/browser/ax-tree-serializer.js', () => ({
  captureAccessibilityTree: vi.fn().mockResolvedValue(
    'button "Search" role=button\ninput "Search input" role=textbox\nlink "Home" role=link\n'.repeat(30)
  ),
}));

// Note: @langchain/core/messages is NOT mocked — real SystemMessage/HumanMessage used

import { runAgentLoop } from '../../src/agent/agent-loop/index.js';
import type { AgentLoopConfig, AgentLoopDeps } from '../../src/agent/agent-loop/index.js';

// --- Mock Page factory ---
let pageContentCounter = 0;

function createMockPage(url = 'https://example.com'): Record<string, unknown> {
  return {
    url: vi.fn().mockReturnValue(url),
    title: vi.fn().mockResolvedValue('Example Page'),
    content: vi.fn().mockImplementation(() => {
      pageContentCounter++;
      return Promise.resolve(`<html><body>content-${pageContentCounter}</body></html>`);
    }),
    evaluate: vi.fn().mockResolvedValue([
      { index: 0, tag: 'input', text: 'Search', role: 'textbox', type: 'text' },
      { index: 1, tag: 'button', text: 'Submit', role: 'button', type: undefined },
    ]),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
  };
}

// --- Mock ToolExecutor factory ---
function createMockToolExecutor(overrides?: {
  executeResult?: { success: boolean; insights: never[]; error?: string };
}): Record<string, unknown> {
  const result = overrides?.executeResult ?? { success: true, insights: [] };
  return {
    execute: vi.fn().mockResolvedValue(result),
  };
}

// --- Mock LLM factory ---
function createMockLLM(invokeFn: (...args: unknown[]) => Promise<{ content: string }>): unknown {
  return { invoke: invokeFn };
}

describe('Agent Loop Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pageContentCounter = 0;
  });

  it('simple navigation task succeeds when verifier confirms goal', async () => {
    const page = createMockPage();
    const toolExecutor = createMockToolExecutor();

    let callCount = 0;
    const llm = createMockLLM(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          content: JSON.stringify({
            reasoning: 'Navigate to the target page',
            toolName: 'go_to_url',
            toolParams: { url: 'https://en.wikipedia.org' },
            expectedOutcome: 'Page loads Wikipedia',
          }),
        });
      }
      // Verifier + subsequent calls → goal satisfied
      return Promise.resolve({
        content: JSON.stringify({
          goalSatisfied: true,
          confidence: 0.95,
          reasoning: 'URL shows Wikipedia, goal achieved',
        }),
      });
    });

    const config: AgentLoopConfig = {
      goal: 'Navigate to Wikipedia',
      maxSteps: 10,
      maxTimeMs: 30000,
      verifyEveryNSteps: 1,
    };

    const deps: AgentLoopDeps = {
      llm: llm as AgentLoopDeps['llm'],
      page: page as unknown as AgentLoopDeps['page'],
      toolExecutor: toolExecutor as unknown as AgentLoopDeps['toolExecutor'],
    };

    const result = await runAgentLoop(config, deps);

    expect(result.status).toBe('SUCCESS');
    expect(result.goalSatisfied).toBe(true);
    expect(result.actionHistory.length).toBeGreaterThanOrEqual(1);
    expect(result.actionHistory[0]!.toolName).toBe('go_to_url');
  });

  it('budget exceeded terminates cleanly', async () => {
    const page = createMockPage();
    const toolExecutor = createMockToolExecutor();

    const llm = createMockLLM(() =>
      Promise.resolve({
        content: JSON.stringify({
          reasoning: 'Scroll to find content',
          toolName: 'scroll_page',
          toolParams: { direction: 'down' },
          expectedOutcome: 'Page scrolls down',
        }),
      })
    );

    const config: AgentLoopConfig = {
      goal: 'Find something that does not exist',
      maxSteps: 2,
      maxTimeMs: 30000,
      verifyEveryNSteps: 100,
    };

    const deps: AgentLoopDeps = {
      llm: llm as AgentLoopDeps['llm'],
      page: page as unknown as AgentLoopDeps['page'],
      toolExecutor: toolExecutor as unknown as AgentLoopDeps['toolExecutor'],
    };

    const result = await runAgentLoop(config, deps);

    expect(result.status).toBe('BUDGET_EXCEEDED');
    expect(result.goalSatisfied).toBe(false);
    expect(result.stepsUsed).toBe(2);
    expect(result.terminationReason).toContain('budget');
  });

  it('failure routing detects element not found and terminates after retries', async () => {
    const page = createMockPage();
    const toolExecutor = createMockToolExecutor({
      executeResult: { success: false, insights: [], error: 'Element not found at index 99' },
    });

    const llm = createMockLLM(() =>
      Promise.resolve({
        content: JSON.stringify({
          reasoning: 'Click the target element',
          toolName: 'click',
          toolParams: { elementIndex: 99 },
          expectedOutcome: 'Element clicked',
        }),
      })
    );

    const config: AgentLoopConfig = {
      goal: 'Click a non-existent element',
      maxSteps: 10,
      maxTimeMs: 30000,
      verifyEveryNSteps: 100,
    };

    const deps: AgentLoopDeps = {
      llm: llm as AgentLoopDeps['llm'],
      page: page as unknown as AgentLoopDeps['page'],
      toolExecutor: toolExecutor as unknown as AgentLoopDeps['toolExecutor'],
    };

    const result = await runAgentLoop(config, deps);

    expect(result.status).toBe('UNRECOVERABLE_FAILURE');
    expect(result.goalSatisfied).toBe(false);
    expect(result.terminationReason).toContain('ELEMENT_NOT_FOUND');
    expect(result.actionHistory.length).toBeGreaterThanOrEqual(2);
  });
});
