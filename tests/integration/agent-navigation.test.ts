/**
 * Phase 34D Integration Test — Agent Navigation Flow
 *
 * T795: Verifies the agent loop survives navigation-triggering actions.
 * Mocks a two-page flow: search form → results page.
 */

import { describe, it, expect, vi } from 'vitest';
import { NAVIGATION_PENDING_HASH } from '../../src/agent/agent-loop/perceiver.js';
import { ToolExecutor } from '../../src/agent/tools/tool-executor.js';
import type { ToolRegistry } from '../../src/agent/tools/tool-registry.js';

describe('Agent navigation integration (Phase 34D)', () => {
  it('ToolExecutor.executeWithNavDetection handles page navigation end-to-end', async () => {
    // Simulate a tool that triggers navigation (e.g. press_key Enter)
    const mockTool = {
      name: 'press_key',
      description: 'press key',
      parameters: { safeParse: () => ({ success: true, data: { key: 'Enter' } }) },
      execute: vi.fn().mockResolvedValue({ success: true, insights: [] }),
    };

    const registry: ToolRegistry = {
      get: vi.fn().mockReturnValue(mockTool),
      register: vi.fn(),
      has: vi.fn().mockReturnValue(true),
      list: vi.fn().mockReturnValue(['press_key']),
    } as unknown as ToolRegistry;

    const executor = new ToolExecutor(registry);

    // Mock page: URL changes after tool execution (simulating navigation)
    let urlCallCount = 0;
    const page = {
      url: () => {
        urlCallCount++;
        // First call (before) returns page1, subsequent (after) return page2
        return urlCallCount <= 1 ? 'https://amazon.in' : 'https://amazon.in/s?k=keyboard';
      },
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
    };

    const context = {
      page: page as never,
      state: {
        url: 'https://amazon.in',
        title: 'Amazon',
        domTree: { root: { tagName: 'html', xpath: '/html', text: '', isInteractive: false, isVisible: true, croType: null, children: [] }, interactiveCount: 0, croElementCount: 0, totalNodeCount: 1, extractedAt: Date.now() },
        viewport: { width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false },
        scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 0 },
        timestamp: Date.now(),
      },
      verbose: false,
    };

    const { toolResult, navigationMeta } = await executor.executeWithNavDetection(
      'press_key' as never,
      { key: 'Enter' },
      context
    );

    expect(toolResult.success).toBe(true);
    expect(navigationMeta.navigated).toBe(true);
    expect(navigationMeta.previousUrl).toBe('https://amazon.in');
    expect(navigationMeta.currentUrl).toBe('https://amazon.in/s?k=keyboard');
    expect(page.waitForLoadState).toHaveBeenCalledWith('load', { timeout: 10000 });
  });

  it('NAVIGATION_PENDING_HASH sentinel is consistent', () => {
    // Verify the sentinel value hasn't drifted between modules
    expect(NAVIGATION_PENDING_HASH).toBe('navigation-pending');
    expect(NAVIGATION_PENDING_HASH.length).toBe(18);
  });
});
