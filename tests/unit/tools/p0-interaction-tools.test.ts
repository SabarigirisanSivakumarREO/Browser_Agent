/**
 * P0 Browser Interaction Tools Unit Tests
 *
 * Phase 31b: Tests for type_text, press_key, select_option, extract_text.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import type { Tool, ToolContext } from '../../../src/agent/tools/types.js';
import type { ToolResult, PageState, CROActionName } from '../../../src/models/index.js';
import type { Page, Locator, Keyboard } from 'playwright';

// Import tools under test
import { typeTextTool, TypeTextParamsSchema } from '../../../src/agent/tools/cro/type-text-tool.js';
import { pressKeyTool, PressKeyParamsSchema } from '../../../src/agent/tools/cro/press-key-tool.js';
import { selectOptionTool, SelectOptionParamsSchema } from '../../../src/agent/tools/cro/select-option-tool.js';
import { extractTextTool, ExtractTextParamsSchema } from '../../../src/agent/tools/cro/extract-text-tool.js';

// --- Test Helpers ---

function createMockDOMTree(nodes: Array<{
  tagName: string;
  xpath: string;
  isVisible?: boolean;
  isInteractive?: boolean;
  text?: string;
  attributes?: Record<string, string>;
}>): PageState['domTree'] {
  // Build a flat tree: root with all nodes as children
  const children = nodes.map((n, i) => ({
    tagName: n.tagName,
    xpath: n.xpath,
    index: i,
    text: n.text || '',
    isVisible: n.isVisible ?? true,
    isInteractive: n.isInteractive ?? true,
    croType: null as null,
    children: [],
    boundingBox: { x: 0, y: 0, width: 100, height: 30 },
    attributes: n.attributes,
  }));

  return {
    rootId: 'root',
    nodes: {},
    root: {
      tagName: 'html',
      xpath: '/html',
      text: '',
      isVisible: false,
      isInteractive: false,
      croType: null,
      children,
    },
    stats: { totalNodes: nodes.length, interactiveNodes: nodes.length, croNodes: 0, depth: 1 },
  } as unknown as PageState['domTree'];
}

function createMockLocator(overrides: Partial<Locator> = {}): Locator {
  return {
    fill: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    hover: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(['blue']),
    innerText: vi.fn().mockResolvedValue('Hello World'),
    setInputFiles: vi.fn().mockResolvedValue(undefined),
    dragTo: vi.fn().mockResolvedValue(undefined),
    first: vi.fn().mockReturnThis(),
    ...overrides,
  } as unknown as Locator;
}

function createMockPage(overrides: Partial<Page> = {}): Page {
  const mockLocator = createMockLocator();
  return {
    locator: vi.fn().mockReturnValue(mockLocator),
    keyboard: {
      press: vi.fn().mockResolvedValue(undefined),
    } as unknown as Keyboard,
    innerText: vi.fn().mockResolvedValue('Page body text'),
    url: () => 'https://example.com',
    title: () => Promise.resolve('Test Page'),
    ...overrides,
  } as unknown as Page;
}

function createMockContext(
  params: unknown,
  domNodes: Parameters<typeof createMockDOMTree>[0] = [],
  pageOverrides: Partial<Page> = {},
): ToolContext {
  return {
    params,
    page: createMockPage(pageOverrides),
    state: {
      url: 'https://example.com',
      title: 'Test Page',
      domTree: createMockDOMTree(domNodes),
      viewport: { width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false },
      scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 1000 },
      timestamp: Date.now(),
    } as PageState,
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ToolContext['logger'],
  };
}

// --- type_text Tests ---

describe('type_text tool', () => {
  it('should fill input field with text', async () => {
    const ctx = createMockContext(
      { elementIndex: 0, text: 'hello', clearFirst: true },
      [{ tagName: 'INPUT', xpath: '//input[@id="search"]' }],
    );

    const result = await typeTextTool.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.insights).toEqual([]);
    const locator = (ctx.page.locator as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    expect(locator.clear).toHaveBeenCalled();
    expect(locator.fill).toHaveBeenCalledWith('hello', expect.any(Object));
  });

  it('should clear before typing when clearFirst is true', async () => {
    const ctx = createMockContext(
      { elementIndex: 0, text: 'world', clearFirst: true },
      [{ tagName: 'TEXTAREA', xpath: '//textarea' }],
    );

    const result = await typeTextTool.execute(ctx);

    expect(result.success).toBe(true);
    const locator = (ctx.page.locator as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    expect(locator.clear).toHaveBeenCalled();
  });

  it('should return error when element not found', async () => {
    const ctx = createMockContext(
      { elementIndex: 99, text: 'hello', clearFirst: true },
      [{ tagName: 'INPUT', xpath: '//input' }],
    );

    const result = await typeTextTool.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should return error when element is not an input', async () => {
    const ctx = createMockContext(
      { elementIndex: 0, text: 'hello', clearFirst: true },
      [{ tagName: 'DIV', xpath: '//div' }],
    );

    const result = await typeTextTool.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not an input');
  });
});

// --- press_key Tests ---

describe('press_key tool', () => {
  it('should call page.keyboard.press with correct key', async () => {
    const ctx = createMockContext({ key: 'Enter' });

    const result = await pressKeyTool.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.page.keyboard.press).toHaveBeenCalledWith('Enter');
  });

  it('should handle modifier combos', async () => {
    const ctx = createMockContext({ key: 'Control+a' });

    const result = await pressKeyTool.execute(ctx);

    expect(result.success).toBe(true);
    expect(ctx.page.keyboard.press).toHaveBeenCalledWith('Control+a');
  });

  it('should return error on invalid key', async () => {
    const mockPress = vi.fn().mockRejectedValue(new Error('Unknown key: "InvalidKey"'));
    const ctx = createMockContext({ key: 'InvalidKey' }, [], {
      keyboard: { press: mockPress } as unknown as Keyboard,
    });

    const result = await pressKeyTool.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown key');
  });
});

// --- select_option Tests ---

describe('select_option tool', () => {
  it('should select by value', async () => {
    const ctx = createMockContext(
      { elementIndex: 0, value: 'blue' },
      [{ tagName: 'SELECT', xpath: '//select[@id="color"]' }],
    );

    const result = await selectOptionTool.execute(ctx);

    expect(result.success).toBe(true);
    const locator = (ctx.page.locator as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    expect(locator.selectOption).toHaveBeenCalledWith({ value: 'blue' }, expect.any(Object));
  });

  it('should select by label', async () => {
    const mockLocator = createMockLocator({ selectOption: vi.fn().mockResolvedValue(['lg']) });
    const ctx = createMockContext(
      { elementIndex: 0, label: 'Large' },
      [{ tagName: 'SELECT', xpath: '//select[@id="size"]' }],
      { locator: vi.fn().mockReturnValue(mockLocator) },
    );

    const result = await selectOptionTool.execute(ctx);

    expect(result.success).toBe(true);
    expect(mockLocator.selectOption).toHaveBeenCalledWith({ label: 'Large' }, expect.any(Object));
  });
});

// --- extract_text Tests ---

describe('extract_text tool', () => {
  it('should return truncated body text', async () => {
    const longText = 'A'.repeat(10000);
    const mockLocator = createMockLocator({
      innerText: vi.fn().mockResolvedValue(longText),
      first: vi.fn().mockReturnThis(),
    });
    const ctx = createMockContext(
      { maxLength: 8000 },
      [],
      { locator: vi.fn().mockReturnValue(mockLocator) },
    );

    const result = await extractTextTool.execute(ctx);

    expect(result.success).toBe(true);
    const extracted = result.extracted as { text: string; truncated: boolean; length: number };
    expect(extracted.truncated).toBe(true);
    expect(extracted.length).toBe(10000);
    expect(extracted.text.length).toBeLessThan(10000);
  });
});
