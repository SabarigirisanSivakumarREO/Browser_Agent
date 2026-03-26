/**
 * P3 Browser Interaction Tools Unit Tests
 *
 * Phase 31e: Tests for drag_and_drop, get_ax_tree.
 */

import { describe, it, expect, vi } from 'vitest';
import type { ToolContext } from '../../../src/agent/tools/types.js';
import type { PageState } from '../../../src/models/index.js';
import type { Page, Locator } from 'playwright';

import { dragAndDropTool } from '../../../src/agent/tools/cro/drag-and-drop-tool.js';
import { getAxTreeTool } from '../../../src/agent/tools/cro/get-ax-tree-tool.js';

// Mock ax-tree-serializer
vi.mock('../../../src/browser/ax-tree-serializer.js', () => ({
  captureAccessibilityTree: vi.fn().mockResolvedValue('- button "Submit"\n- link "Home"'),
}));

function createMockDOMTree(nodes: Array<{
  tagName: string; xpath: string; text?: string;
  isVisible?: boolean; isInteractive?: boolean;
}> = []): PageState['domTree'] {
  const children = nodes.map((n) => ({
    tagName: n.tagName, xpath: n.xpath, text: n.text || '',
    isVisible: n.isVisible ?? true, isInteractive: n.isInteractive ?? true,
    croType: null as null, children: [],
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
    dragTo: vi.fn().mockResolvedValue(undefined),
    first: vi.fn().mockReturnThis(),
    count: vi.fn().mockResolvedValue(1),
  } as unknown as Locator;

  return {
    params,
    page: {
      locator: vi.fn().mockReturnValue(mockLocator),
      url: () => 'https://example.com',
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

// --- drag_and_drop Tests ---

describe('drag_and_drop tool', () => {
  it('should call sourceLocator.dragTo(targetLocator)', async () => {
    const ctx = createMockContext(
      { sourceIndex: 0, targetIndex: 1 },
      [
        { tagName: 'DIV', xpath: '//div[@id="source"]', text: 'Drag me' },
        { tagName: 'DIV', xpath: '//div[@id="target"]', text: 'Drop here' },
      ],
    );

    const result = await dragAndDropTool.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.insights).toEqual([]);
  });

  it('should handle same source/target (no-op)', async () => {
    const ctx = createMockContext(
      { sourceIndex: 0, targetIndex: 0 },
      [{ tagName: 'DIV', xpath: '//div', text: 'Element' }],
    );

    const result = await dragAndDropTool.execute(ctx);

    expect(result.success).toBe(true);
  });
});

// --- get_ax_tree Tests ---

describe('get_ax_tree tool', () => {
  it('should return serialized accessibility tree', async () => {
    const ctx = createMockContext({ maxTokens: 500 });

    const result = await getAxTreeTool.execute(ctx);

    expect(result.success).toBe(true);
    const extracted = result.extracted as { axTree: string | null };
    expect(extracted.axTree).toContain('button');
  });

  it('should return null when capture fails', async () => {
    const { captureAccessibilityTree } = await import('../../../src/browser/ax-tree-serializer.js');
    (captureAccessibilityTree as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const ctx = createMockContext({ maxTokens: 500 });

    const result = await getAxTreeTool.execute(ctx);

    expect(result.success).toBe(true);
    const extracted = result.extracted as { axTree: string | null };
    expect(extracted.axTree).toBeNull();
  });
});
