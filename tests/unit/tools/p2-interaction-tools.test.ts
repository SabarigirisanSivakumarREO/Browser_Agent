/**
 * P2 Browser Interaction Tools Unit Tests
 *
 * Phase 31d: Tests for switch_tab, upload_file, execute_js.
 */

import { describe, it, expect, vi } from 'vitest';
import type { ToolContext } from '../../../src/agent/tools/types.js';
import type { PageState } from '../../../src/models/index.js';
import type { Page, Locator, BrowserContext } from 'playwright';

import { switchTabTool } from '../../../src/agent/tools/cro/switch-tab-tool.js';
import { uploadFileTool } from '../../../src/agent/tools/cro/upload-file-tool.js';
import { executeJsTool } from '../../../src/agent/tools/cro/execute-js-tool.js';

function createMockDOMTree(nodes: Array<{
  tagName: string; xpath: string; attributes?: Record<string, string>;
  isVisible?: boolean; isInteractive?: boolean;
}> = []): PageState['domTree'] {
  const children = nodes.map((n) => ({
    tagName: n.tagName, xpath: n.xpath, text: '',
    isVisible: n.isVisible ?? true, isInteractive: n.isInteractive ?? true,
    croType: null as null, children: [], attributes: n.attributes,
    boundingBox: { x: 0, y: 0, width: 100, height: 30 },
  }));
  return {
    rootId: 'root', nodes: {},
    root: { tagName: 'html', xpath: '/html', text: '', isVisible: false, isInteractive: false, croType: null, children },
    stats: { totalNodes: nodes.length, interactiveNodes: nodes.length, croNodes: 0, depth: 1 },
  } as unknown as PageState['domTree'];
}

function createMockContext(
  params: unknown,
  domNodes: Parameters<typeof createMockDOMTree>[0] = [],
  pageOverrides: Record<string, unknown> = {},
): ToolContext {
  const mockLocator = {
    setInputFiles: vi.fn().mockResolvedValue(undefined),
    first: vi.fn().mockReturnThis(),
  } as unknown as Locator;

  const mockPage2 = {
    bringToFront: vi.fn().mockResolvedValue(undefined),
    url: () => 'https://example.com/tab2',
    title: () => Promise.resolve('Tab 2'),
  };

  return {
    params,
    page: {
      locator: vi.fn().mockReturnValue(mockLocator),
      evaluate: vi.fn().mockResolvedValue('evaluated result'),
      url: () => 'https://example.com',
      title: () => Promise.resolve('Tab 1'),
      context: () => ({
        pages: () => [
          { url: () => 'https://example.com', title: () => Promise.resolve('Tab 1'), bringToFront: vi.fn() },
          mockPage2,
        ],
      }),
      ...pageOverrides,
    } as unknown as Page,
    state: {
      url: 'https://example.com', title: 'Test',
      domTree: createMockDOMTree(domNodes),
      viewport: { width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false },
      scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 1000 },
      timestamp: Date.now(),
    } as PageState,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as ToolContext['logger'],
  };
}

// --- switch_tab Tests ---

describe('switch_tab tool', () => {
  it('should bring correct tab to front', async () => {
    const ctx = createMockContext({ tabIndex: 1 });

    const result = await switchTabTool.execute(ctx);

    expect(result.success).toBe(true);
    const extracted = result.extracted as { tabIndex: number; totalTabs: number };
    expect(extracted.tabIndex).toBe(1);
    expect(extracted.totalTabs).toBe(2);
  });

  it('should return error for invalid tabIndex', async () => {
    const ctx = createMockContext({ tabIndex: 5 });

    const result = await switchTabTool.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('2'); // available tabs count
  });
});

// --- upload_file Tests ---

describe('upload_file tool', () => {
  it('should call setInputFiles with paths', async () => {
    const ctx = createMockContext(
      { elementIndex: 0, filePaths: ['/tmp/test.pdf'] },
      [{ tagName: 'INPUT', xpath: '//input[@type="file"]', attributes: { type: 'file' } }],
    );

    const result = await uploadFileTool.execute(ctx);

    expect(result.success).toBe(true);
    const locator = (ctx.page.locator as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    expect(locator.setInputFiles).toHaveBeenCalledWith(['/tmp/test.pdf'], expect.any(Object));
  });

  it('should return error for non-file-input element', async () => {
    const ctx = createMockContext(
      { elementIndex: 0, filePaths: ['/tmp/test.pdf'] },
      [{ tagName: 'INPUT', xpath: '//input[@type="text"]', attributes: { type: 'text' } }],
    );

    const result = await uploadFileTool.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('file input');
  });
});

// --- execute_js Tests ---

describe('execute_js tool', () => {
  it('should evaluate expression and return result', async () => {
    const ctx = createMockContext({ expression: 'document.title' }, [], {
      evaluate: vi.fn().mockResolvedValue('My Page Title'),
    });

    const result = await executeJsTool.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.page.evaluate).toHaveBeenCalled();
    const extracted = result.extracted as { result: string };
    expect(extracted.result).toContain('My Page Title');
  });

  it('should return error on syntax error', async () => {
    const ctx = createMockContext({ expression: '{invalid' }, [], {
      evaluate: vi.fn().mockRejectedValue(new Error('SyntaxError: Unexpected token')),
    });

    const result = await executeJsTool.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('SyntaxError');
  });
});
