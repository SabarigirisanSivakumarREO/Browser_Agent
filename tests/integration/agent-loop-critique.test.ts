/**
 * Agent Loop Self-Critique Integration Tests — Phase 33c (T764)
 *
 * Tests the self-critique path: confidence adjusted from progressScore,
 * and critique skipped when the deterministic failure router fires.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ax-tree-serializer
vi.mock('../../src/browser/ax-tree-serializer.js', () => ({
  captureAccessibilityTree: vi.fn().mockResolvedValue(
    'button "Submit" input "Search" link "Home"\n'.repeat(30)
  ),
}));

import { runAgentLoop } from '../../src/agent/agent-loop/index.js';
import type { AgentLoopConfig, AgentLoopDeps } from '../../src/agent/agent-loop/index.js';

let pageContentCounter = 0;

function createMockPage(url = 'https://example.com') {
  return {
    url: vi.fn().mockReturnValue(url),
    title: vi.fn().mockResolvedValue('Test Page'),
    content: vi.fn().mockImplementation(() => {
      pageContentCounter++;
      return Promise.resolve(`<html><body>content-${pageContentCounter}</body></html>`);
    }),
    evaluate: vi.fn().mockResolvedValue([
      { index: 0, tag: 'input', text: 'Search', role: 'textbox', type: 'text' },
      { index: 1, tag: 'button', text: 'Submit', role: 'button' },
    ]),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake')),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(1) }),
  };
}

function createMockToolExecutor(result = { success: true, insights: [] }) {
  return { execute: vi.fn().mockResolvedValue(result) };
}

describe('Agent Loop with Self-Critique', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pageContentCounter = 0;
  });

  it('critique adjusts confidence based on progress score', async () => {
    const page = createMockPage();
    const toolExecutor = createMockToolExecutor();

    let callCount = 0;
    const llm = {
      invoke: () => {
        callCount++;
        // Calls alternate: planner, critique, planner, critique, ...
        // Odd calls = planner, even calls = critique
        if (callCount % 2 === 1) {
          // Planner
          return Promise.resolve({
            content: JSON.stringify({
              reasoning: 'Scroll down',
              toolName: 'scroll_page',
              toolParams: { direction: 'down' },
              expectedOutcome: 'Page scrolls',
            }),
          });
        }
        // Critique — low progress score
        return Promise.resolve({
          content: JSON.stringify({
            actionWasUseful: false,
            progressScore: 0.1,
            reasoning: 'No observable progress',
            suggestion: 'Try clicking instead',
          }),
        });
      },
    };

    const config: AgentLoopConfig = {
      goal: 'Find something',
      maxSteps: 5,
      maxTimeMs: 30000,
      enableCritique: true,
      verifyEveryNSteps: 100, // don't verify
      decayFactor: 0.1,
      escalationThreshold: 0.3,
    };

    const deps: AgentLoopDeps = {
      llm: llm as unknown as AgentLoopDeps['llm'],
      page: page as unknown as AgentLoopDeps['page'],
      toolExecutor: toolExecutor as unknown as AgentLoopDeps['toolExecutor'],
    };

    const result = await runAgentLoop(config, deps);

    // With low critique scores (0.1), confidence decays at 2x rate (0.2 per step)
    // After ~4 steps: 1.0 - 4*0.2 = 0.2 < 0.3 threshold → CONFIDENCE_LOW
    expect(result.status).toBe('CONFIDENCE_LOW');
    // Verify critique was actually called (even call numbers)
    expect(callCount).toBeGreaterThanOrEqual(4); // at least 2 plan + 2 critique calls
  });

  it('critique skipped when deterministic router fires', async () => {
    const page = createMockPage();
    const toolExecutor = createMockToolExecutor({
      success: false,
      insights: [],
      error: 'Element not found at index 99',
    });

    let invokeCount = 0;
    const llm = {
      invoke: () => {
        invokeCount++;
        // Always planner — critique should be skipped because router fires
        return Promise.resolve({
          content: JSON.stringify({
            reasoning: 'Click element',
            toolName: 'click',
            toolParams: { elementIndex: 99 },
            expectedOutcome: 'Element clicked',
          }),
        });
      },
    };

    const config: AgentLoopConfig = {
      goal: 'Click something',
      maxSteps: 10,
      maxTimeMs: 30000,
      enableCritique: true,
      verifyEveryNSteps: 100,
    };

    const deps: AgentLoopDeps = {
      llm: llm as unknown as AgentLoopDeps['llm'],
      page: page as unknown as AgentLoopDeps['page'],
      toolExecutor: toolExecutor as unknown as AgentLoopDeps['toolExecutor'],
    };

    const result = await runAgentLoop(config, deps);

    expect(result.status).toBe('UNRECOVERABLE_FAILURE');
    // Only planner calls — no critique calls because router fired each step
    // Each step: 1 planner call (critique skipped due to element not found → router fires)
    // The invoke count should be roughly equal to steps taken (only planner, no critique)
    expect(invokeCount).toBeLessThanOrEqual(result.actionHistory.length + 2);
  });
});
