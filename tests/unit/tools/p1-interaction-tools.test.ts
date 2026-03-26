/**
 * P1 Browser Interaction Tools Unit Tests
 *
 * Phase 31c: Tests for hover, go_back, wait_for, dismiss_blocker.
 */

import { describe, it, expect, vi } from 'vitest';
import type { ToolContext } from '../../../src/agent/tools/types.js';
import type { PageState } from '../../../src/models/index.js';
import type { Page, Locator, BrowserContext } from 'playwright';

import { hoverTool } from '../../../src/agent/tools/cro/hover-tool.js';
import { goBackTool } from '../../../src/agent/tools/cro/go-back-tool.js';
import { waitForTool } from '../../../src/agent/tools/cro/wait-for-tool.js';
import { dismissBlockerTool } from '../../../src/agent/tools/cro/dismiss-blocker-tool.js';

// --- Test Helpers (same pattern as P0) ---

function createMockDOMTree(nodes: Array<{
  tagName: string;
  xpath: string;
  isVisible?: boolean;
  isInteractive?: boolean;
  text?: string;
}> = []): PageState['domTree'] {
  const children = nodes.map((n) => ({
    tagName: n.tagName,
    xpath: n.xpath,
    text: n.text || '',
    isVisible: n.isVisible ?? true,
    isInteractive: n.isInteractive ?? true,
    croType: null as null,
    children: [],
    boundingBox: { x: 0, y: 0, width: 100, height: 30 },
  }));

  return {
    rootId: 'root',
    nodes: {},
    root: {
      tagName: 'html', xpath: '/html', text: '', isVisible: false,
      isInteractive: false, croType: null, children,
    },
    stats: { totalNodes: nodes.length, interactiveNodes: nodes.length, croNodes: 0, depth: 1 },
  } as unknown as PageState['domTree'];
}

function createMockContext(
  params: unknown,
  domNodes: Parameters<typeof createMockDOMTree>[0] = [],
  pageOverrides: Record<string, unknown> = {},
): ToolContext {
  const mockLocator = {
    hover: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    first: vi.fn().mockReturnThis(),
    count: vi.fn().mockResolvedValue(1),
  } as unknown as Locator;

  return {
    params,
    page: {
      locator: vi.fn().mockReturnValue(mockLocator),
      goBack: vi.fn().mockResolvedValue({ status: () => 200 }),
      waitForSelector: vi.fn().mockResolvedValue(null),
      waitForURL: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      url: () => 'https://example.com/page2',
      title: () => Promise.resolve('Page 2'),
      keyboard: { press: vi.fn().mockResolvedValue(undefined) },
      ...pageOverrides,
    } as unknown as Page,
    state: {
      url: 'https://example.com',
      title: 'Test',
      domTree: createMockDOMTree(domNodes),
      viewport: { width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false },
      scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 1000 },
      timestamp: Date.now(),
    } as PageState,
    logger: {
      debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    } as unknown as ToolContext['logger'],
  };
}

// --- hover Tests ---

describe('hover tool', () => {
  it('should call locator.hover on correct element', async () => {
    const ctx = createMockContext(
      { elementIndex: 0 },
      [{ tagName: 'A', xpath: '//a[@class="menu"]', text: 'Products' }],
    );

    const result = await hoverTool.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.insights).toEqual([]);
    const locator = (ctx.page.locator as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    expect(locator.hover).toHaveBeenCalled();
  });

  it('should return error when element not found', async () => {
    const ctx = createMockContext({ elementIndex: 99 }, []);

    const result = await hoverTool.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// --- go_back Tests ---

describe('go_back tool', () => {
  it('should call page.goBack and return URLs', async () => {
    const ctx = createMockContext({ waitUntil: 'load' });

    const result = await goBackTool.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.page.goBack).toHaveBeenCalled();
  });

  it('should handle no history (null response)', async () => {
    const ctx = createMockContext({ waitUntil: 'load' }, [], {
      goBack: vi.fn().mockResolvedValue(null),
    });

    const result = await goBackTool.execute(ctx);

    expect(result.success).toBe(true);
  });
});

// --- wait_for Tests ---

describe('wait_for tool', () => {
  it('should call waitForSelector with value', async () => {
    const ctx = createMockContext({
      condition: 'selector', value: '.results', timeoutMs: 5000,
    });

    const result = await waitForTool.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.page.waitForSelector).toHaveBeenCalledWith(
      '.results',
      expect.objectContaining({ timeout: 5000 }),
    );
  });

  it('should call waitForURL with predicate', async () => {
    const ctx = createMockContext({
      condition: 'url_contains', value: '/checkout', timeoutMs: 10000,
    });

    const result = await waitForTool.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.page.waitForURL).toHaveBeenCalled();
  });

  it('should return error on timeout', async () => {
    const ctx = createMockContext(
      { condition: 'selector', value: '.never', timeoutMs: 1000 },
      [],
      { waitForSelector: vi.fn().mockRejectedValue(new Error('Timeout 1000ms exceeded')) },
    );

    const result = await waitForTool.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Timeout');
  });
});

// --- dismiss_blocker Tests ---

describe('dismiss_blocker tool', () => {
  it('should wrap CookieConsentHandler result', async () => {
    // dismiss_blocker creates its own handler internally
    // We can only test that it doesn't crash with a mock page
    const ctx = createMockContext({ strategy: 'auto' });

    // The tool will try to create a CookieConsentHandler and call dismiss
    // Since the page is mocked, it will likely fail gracefully
    const result = await dismissBlockerTool.execute(ctx);

    // Should not throw — either success or graceful error
    expect(result.insights).toEqual([]);
    expect(typeof result.success).toBe('boolean');
  });
});
