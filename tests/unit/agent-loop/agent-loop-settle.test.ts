/**
 * Phase 34B Tests — Post-Action Navigation Settlement
 *
 * T789: Tests for navigation detection in ToolExecutor and settle logic.
 */

import { describe, it, expect, vi } from 'vitest';
import { ToolExecutor } from '../../../src/agent/tools/tool-executor.js';
import type { ToolRegistry } from '../../../src/agent/tools/tool-registry.js';
import type { ExecutionContext } from '../../../src/agent/tools/types.js';
import type { ToolResult } from '../../../src/models/index.js';

function createMockRegistry(toolResult: ToolResult): ToolRegistry {
  return {
    get: vi.fn().mockReturnValue({
      name: 'test_tool',
      description: 'test',
      parameters: { safeParse: () => ({ success: true, data: {} }) },
      execute: vi.fn().mockResolvedValue(toolResult),
    }),
    register: vi.fn(),
    has: vi.fn().mockReturnValue(true),
    list: vi.fn().mockReturnValue(['test_tool']),
  } as unknown as ToolRegistry;
}

function createMockContext(opts: {
  urlSequence?: string[];
  waitForLoadState?: () => Promise<void>;
} = {}): ExecutionContext {
  const { urlSequence = ['https://page1.com'], waitForLoadState = () => Promise.resolve() } = opts;
  let urlIndex = 0;

  return {
    page: {
      url: () => urlSequence[Math.min(urlIndex++, urlSequence.length - 1)]!,
      waitForLoadState: vi.fn().mockImplementation(waitForLoadState),
    } as never,
    state: {
      url: 'https://page1.com',
      title: 'Test',
      domTree: { root: { tagName: 'html', xpath: '/html', text: '', isInteractive: false, isVisible: true, croType: null, children: [] }, interactiveCount: 0, croElementCount: 0, totalNodeCount: 1, extractedAt: Date.now() },
      viewport: { width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false },
      scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 0 },
      timestamp: Date.now(),
    },
    verbose: false,
  };
}

describe('ToolExecutor.executeWithNavDetection (Phase 34B)', () => {
  it('detects navigation when URL changes', async () => {
    const registry = createMockRegistry({ success: true, insights: [] });
    const executor = new ToolExecutor(registry);
    const ctx = createMockContext({ urlSequence: ['https://page1.com', 'https://page2.com'] });

    const { navigationMeta } = await executor.executeWithNavDetection('test_tool' as never, {}, ctx);

    expect(navigationMeta.navigated).toBe(true);
    expect(navigationMeta.previousUrl).toBe('https://page1.com');
    expect(navigationMeta.currentUrl).toBe('https://page2.com');
  });

  it('reports no navigation when URL stays the same', async () => {
    const registry = createMockRegistry({ success: true, insights: [] });
    const executor = new ToolExecutor(registry);
    const ctx = createMockContext({ urlSequence: ['https://page1.com', 'https://page1.com'] });

    const { navigationMeta } = await executor.executeWithNavDetection('test_tool' as never, {}, ctx);

    expect(navigationMeta.navigated).toBe(false);
  });

  it('calls waitForLoadState when navigation detected', async () => {
    const registry = createMockRegistry({ success: true, insights: [] });
    const executor = new ToolExecutor(registry);
    const waitFn = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext({
      urlSequence: ['https://page1.com', 'https://page2.com'],
      waitForLoadState: waitFn,
    });

    await executor.executeWithNavDetection('test_tool' as never, {}, ctx);

    expect(waitFn).toHaveBeenCalled();
  });

  it('returns tool result alongside navigation meta', async () => {
    const toolResult: ToolResult = { success: true, insights: [], extracted: { data: 42 } };
    const registry = createMockRegistry(toolResult);
    const executor = new ToolExecutor(registry);
    const ctx = createMockContext();

    const { toolResult: result } = await executor.executeWithNavDetection('test_tool' as never, {}, ctx);

    expect(result.success).toBe(true);
    expect(result.extracted).toEqual({ data: 42 });
  });

  it('handles waitForLoadState timeout gracefully', async () => {
    const registry = createMockRegistry({ success: true, insights: [] });
    const executor = new ToolExecutor(registry);
    const ctx = createMockContext({
      urlSequence: ['https://page1.com', 'https://page2.com'],
      waitForLoadState: () => Promise.reject(new Error('timeout')),
    });

    const { navigationMeta } = await executor.executeWithNavDetection('test_tool' as never, {}, ctx);

    // Should not throw, navigation still detected
    expect(navigationMeta.navigated).toBe(true);
  });
});
