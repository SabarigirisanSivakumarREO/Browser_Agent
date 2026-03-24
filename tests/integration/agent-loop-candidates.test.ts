import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/browser/ax-tree-serializer.js', () => ({
  captureAccessibilityTree: vi.fn().mockResolvedValue(
    'button "Submit" input "Search" link "Home"\n'.repeat(30)
  ),
}));

import { runAgentLoop } from '../../src/agent/agent-loop/index.js';
import type { AgentLoopConfig, AgentLoopDeps } from '../../src/agent/agent-loop/index.js';

let pageContentCounter = 0;

function createMockPage() {
  return {
    url: vi.fn().mockReturnValue('https://example.com'),
    title: vi.fn().mockResolvedValue('Test Page'),
    content: vi.fn().mockImplementation(() => {
      pageContentCounter++;
      return Promise.resolve(`<html><body>${pageContentCounter}</body></html>`);
    }),
    evaluate: vi.fn().mockResolvedValue([
      { index: 0, tag: 'input', text: 'Search', role: 'textbox', type: 'text' },
      { index: 1, tag: 'button', text: 'Go', role: 'button' },
    ]),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake')),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(1) }),
  };
}

describe('Agent Loop with Multi-Candidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pageContentCounter = 0;
  });

  it('multi-candidate mode generates candidates and executes top-scored', async () => {
    const page = createMockPage();
    const toolExecutor = { execute: vi.fn().mockResolvedValue({ success: true, insights: [] }) };

    let callCount = 0;
    const llm = {
      invoke: () => {
        callCount++;
        if (callCount === 1) {
          // Candidate generation
          return Promise.resolve({
            content: JSON.stringify({
              candidates: [
                { reasoning: 'Type search', toolName: 'type_text', toolParams: { elementIndex: 0, text: 'test' }, expectedOutcome: 'Text typed', selfScore: 0.9, risk: 'element missing' },
                { reasoning: 'Click go', toolName: 'click', toolParams: { elementIndex: 1 }, expectedOutcome: 'Button clicked', selfScore: 0.6, risk: 'nothing happens' },
              ],
            }),
          });
        }
        // Verifier — goal satisfied
        return Promise.resolve({
          content: JSON.stringify({ goalSatisfied: true, confidence: 0.95, reasoning: 'Done' }),
        });
      },
    };

    const config: AgentLoopConfig = {
      goal: 'Search',
      maxSteps: 5,
      maxTimeMs: 30000,
      enableMultiCandidate: true,
      verifyEveryNSteps: 1,
    };

    const deps: AgentLoopDeps = {
      llm: llm as unknown as AgentLoopDeps['llm'],
      page: page as unknown as AgentLoopDeps['page'],
      toolExecutor: toolExecutor as unknown as AgentLoopDeps['toolExecutor'],
    };

    const result = await runAgentLoop(config, deps);

    expect(result.status).toBe('SUCCESS');
    expect(result.actionHistory.length).toBeGreaterThanOrEqual(1);
    // Should have executed the top-scored candidate (type_text, score 0.9)
    expect(result.actionHistory[0]!.toolName).toBe('type_text');
    expect(result.actionHistory[0]!.candidateScore).toBe(0.9);
    expect(result.actionHistory[0]!.candidateRank).toBe(1);
  });

  it('falls back to single plan when candidate generation fails', async () => {
    const page = createMockPage();
    const toolExecutor = { execute: vi.fn().mockResolvedValue({ success: true, insights: [] }) };

    let callCount = 0;
    const llm = {
      invoke: () => {
        callCount++;
        if (callCount <= 2) {
          // First call: candidate gen fails, second call: planNextAction fallback
          if (callCount === 1) {
            return Promise.resolve({ content: 'invalid json garbage' });
          }
          // planNextAction fallback
          return Promise.resolve({
            content: JSON.stringify({
              reasoning: 'Fallback scroll',
              toolName: 'scroll_page',
              toolParams: { direction: 'down' },
              expectedOutcome: 'Scrolls',
            }),
          });
        }
        // Budget will be exceeded
        return Promise.resolve({
          content: JSON.stringify({
            reasoning: 'Scroll',
            toolName: 'scroll_page',
            toolParams: { direction: 'down' },
            expectedOutcome: 'Scrolls',
          }),
        });
      },
    };

    const config: AgentLoopConfig = {
      goal: 'Do something',
      maxSteps: 2,
      maxTimeMs: 30000,
      enableMultiCandidate: true,
      verifyEveryNSteps: 100,
    };

    const deps: AgentLoopDeps = {
      llm: llm as unknown as AgentLoopDeps['llm'],
      page: page as unknown as AgentLoopDeps['page'],
      toolExecutor: toolExecutor as unknown as AgentLoopDeps['toolExecutor'],
    };

    const result = await runAgentLoop(config, deps);

    // Should have used fallback (scroll_page from planNextAction)
    expect(result.actionHistory.length).toBeGreaterThanOrEqual(1);
    // candidateScore should be 0.5 (fallback default)
    expect(result.actionHistory[0]!.candidateScore).toBe(0.5);
  });
});
