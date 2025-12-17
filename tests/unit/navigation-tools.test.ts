/**
 * Navigation Tools Unit Tests
 *
 * Phase 17a (T093a): Tests for scroll_page, click, go_to_url tools.
 * Total: 18 tests (6 scroll + 7 click + 5 go_to_url)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import {
  scrollPageTool,
  ScrollPageParamsSchema,
  clickTool,
  ClickParamsSchema,
  goToUrlTool,
  GoToUrlParamsSchema,
} from '../../src/agent/tools/cro/index.js';
import type { ToolContext } from '../../src/agent/tools/types.js';
import type { PageState, DOMNode, DOMTree } from '../../src/models/index.js';
import type { Page } from 'playwright';
import { createLogger } from '../../src/utils/logger.js';

// Helper to create mock DOMNode
function createMockDOMNode(overrides: Partial<DOMNode> = {}): DOMNode {
  return {
    tagName: 'button',
    xpath: '//button[1]',
    text: 'Click Me',
    attributes: {},
    children: [],
    isVisible: true,
    isInteractive: true,
    croType: 'cta',
    boundingBox: { x: 100, y: 100, width: 100, height: 40 },
    ...overrides,
  };
}

// Helper to create mock DOMTree with indexed elements
function createMockDOMTree(nodes: DOMNode[] = []): DOMTree {
  const root: DOMNode = {
    tagName: 'body',
    xpath: '//body',
    text: '',
    attributes: {},
    children: nodes,
    isVisible: true,
    isInteractive: false,
    croType: null,
  };

  return {
    root,
    interactiveCount: nodes.filter((n) => n.isInteractive).length,
    croElementCount: nodes.filter((n) => n.croType !== null).length,
    totalNodeCount: nodes.length + 1,
    extractedAt: Date.now(),
  };
}

// Helper to create mock PageState
function createMockPageState(overrides: Partial<PageState> = {}): PageState {
  return {
    url: 'https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711',
    title: 'Test Page',
    domTree: createMockDOMTree(),
    viewport: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false },
    scrollPosition: { x: 0, y: 500, maxX: 0, maxY: 2000 },
    timestamp: Date.now(),
    ...overrides,
  };
}

// Helper to create mock Playwright Page
function createMockPage(overrides: Partial<Record<string, unknown>> = {}): Page {
  return {
    url: vi.fn().mockReturnValue('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711'),
    evaluate: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    locator: vi.fn().mockReturnValue({
      count: vi.fn().mockResolvedValue(1),
      click: vi.fn().mockResolvedValue(undefined),
    }),
    waitForNavigation: vi.fn().mockResolvedValue(undefined),
    goto: vi.fn().mockResolvedValue({
      status: vi.fn().mockReturnValue(200),
    }),
    ...overrides,
  } as unknown as Page;
}

// Helper to create mock ToolContext
function createMockContext(
  pageOverrides: Partial<Record<string, unknown>> = {},
  stateOverrides: Partial<PageState> = {}
): ToolContext {
  return {
    params: {},
    page: createMockPage(pageOverrides),
    state: createMockPageState(stateOverrides),
    logger: createLogger({ verbose: false }),
  };
}

// ============================================================================
// SCROLL TOOL TESTS (6)
// ============================================================================

describe('scrollPageTool', () => {
  // Test 1: scroll down from top
  it('should scroll down by specified amount', async () => {
    const context = createMockContext(
      {
        evaluate: vi.fn().mockResolvedValue(1000), // New scrollY
      },
      {
        scrollPosition: { x: 0, y: 500, maxX: 0, maxY: 2000 },
      }
    );
    context.params = { direction: 'down', amount: 500 };

    const result = await scrollPageTool.execute(context);

    expect(result.success).toBe(true);
    expect(result.insights).toEqual([]);
    expect(result.extracted).toMatchObject({
      previousY: 500,
      newY: 1000,
      scrolledBy: 500,
    });
  });

  // Test 2: scroll up from middle
  it('should scroll up by specified amount', async () => {
    const context = createMockContext(
      {
        evaluate: vi.fn().mockResolvedValue(0), // New scrollY
      },
      {
        scrollPosition: { x: 0, y: 500, maxX: 0, maxY: 2000 },
      }
    );
    context.params = { direction: 'up', amount: 500 };

    const result = await scrollPageTool.execute(context);

    expect(result.success).toBe(true);
    expect(result.insights).toEqual([]);
    expect(result.extracted).toMatchObject({
      previousY: 500,
      newY: 0,
      atTop: true,
    });
  });

  // Test 3: scroll to top
  it('should scroll to top of page', async () => {
    const context = createMockContext(
      {
        evaluate: vi.fn().mockResolvedValue(0),
      },
      {
        scrollPosition: { x: 0, y: 1000, maxX: 0, maxY: 2000 },
      }
    );
    context.params = { direction: 'top' };

    const result = await scrollPageTool.execute(context);

    expect(result.success).toBe(true);
    expect(result.extracted).toMatchObject({
      newY: 0,
      atTop: true,
    });
  });

  // Test 4: scroll to bottom
  it('should scroll to bottom of page', async () => {
    const context = createMockContext(
      {
        evaluate: vi.fn().mockResolvedValue(2000),
      },
      {
        scrollPosition: { x: 0, y: 500, maxX: 0, maxY: 2000 },
      }
    );
    context.params = { direction: 'bottom' };

    const result = await scrollPageTool.execute(context);

    expect(result.success).toBe(true);
    expect(result.extracted).toMatchObject({
      newY: 2000,
      atBottom: true,
    });
  });

  // Test 5: scroll at boundary (no movement possible)
  it('should handle scroll at boundary with no movement', async () => {
    const context = createMockContext(
      {
        evaluate: vi.fn().mockResolvedValue(2000), // Already at bottom
      },
      {
        scrollPosition: { x: 0, y: 2000, maxX: 0, maxY: 2000 },
      }
    );
    context.params = { direction: 'down', amount: 500 };

    const result = await scrollPageTool.execute(context);

    expect(result.success).toBe(true);
    expect(result.extracted).toMatchObject({
      previousY: 2000,
      newY: 2000,
      atBottom: true,
      scrolledBy: 0,
    });
  });

  // Test 6: invalid direction rejected by Zod
  it('should reject invalid direction via Zod validation', () => {
    const result = ScrollPageParamsSchema.safeParse({ direction: 'sideways' });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// CLICK TOOL TESTS (7)
// ============================================================================

describe('clickTool', () => {
  // Test 7: click valid visible element
  it('should click a valid visible element by index', async () => {
    const mockLocator = {
      count: vi.fn().mockResolvedValue(1),
      click: vi.fn().mockResolvedValue(undefined),
    };

    const context = createMockContext(
      {
        locator: vi.fn().mockReturnValue(mockLocator),
        url: vi.fn().mockReturnValue('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711'),
      },
      {
        domTree: createMockDOMTree([
          createMockDOMNode({
            xpath: '//button[1]',
            text: 'Buy Now',
            isVisible: true,
            isInteractive: true,
          }),
        ]),
      }
    );
    context.params = { elementIndex: 0, waitForNavigation: false };

    const result = await clickTool.execute(context);

    expect(result.success).toBe(true);
    expect(result.insights).toEqual([]);
    expect(result.extracted).toMatchObject({
      clickedXpath: '//button[1]',
      elementText: 'Buy Now',
      navigationOccurred: false,
    });
  });

  // Test 8: click invalid index (not found)
  it('should return error for invalid element index', async () => {
    const context = createMockContext(
      {},
      {
        domTree: createMockDOMTree([]), // Empty tree
      }
    );
    context.params = { elementIndex: 99, waitForNavigation: false };

    const result = await clickTool.execute(context);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Element with index 99 not found');
  });

  // Test 9: click hidden element - element is found by index but not visible
  // Note: The findElementByIndex only counts visible+interactive elements
  // So a hidden element will result in "not found" because hidden elements are skipped
  it('should return error for hidden element (not found in traversal)', async () => {
    const context = createMockContext(
      {},
      {
        domTree: createMockDOMTree([
          createMockDOMNode({
            isVisible: false,
            isInteractive: true,
          }),
        ]),
      }
    );
    context.params = { elementIndex: 0, waitForNavigation: false };

    const result = await clickTool.execute(context);

    // Hidden elements are skipped during traversal, so element won't be found
    expect(result.success).toBe(false);
    expect(result.error).toBe('Element with index 0 not found');
  });

  // Test 10: click with navigation wait (mock)
  it('should wait for navigation when waitForNavigation is true', async () => {
    const mockWaitForNavigation = vi.fn().mockResolvedValue(undefined);
    const mockLocator = {
      count: vi.fn().mockResolvedValue(1),
      click: vi.fn().mockResolvedValue(undefined),
    };

    const context = createMockContext(
      {
        locator: vi.fn().mockReturnValue(mockLocator),
        waitForNavigation: mockWaitForNavigation,
        url: vi.fn().mockReturnValue('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711'),
      },
      {
        domTree: createMockDOMTree([
          createMockDOMNode({ isVisible: true, isInteractive: true }),
        ]),
      }
    );
    context.params = { elementIndex: 0, waitForNavigation: true };

    const result = await clickTool.execute(context);

    expect(result.success).toBe(true);
    expect(mockWaitForNavigation).toHaveBeenCalledWith({ timeout: 5000 });
  });

  // Test 11: navigation detection
  it('should detect navigation when URL changes', async () => {
    let urlCallCount = 0;
    const mockLocator = {
      count: vi.fn().mockResolvedValue(1),
      click: vi.fn().mockResolvedValue(undefined),
    };

    const context = createMockContext(
      {
        locator: vi.fn().mockReturnValue(mockLocator),
        url: vi.fn().mockImplementation(() => {
          urlCallCount++;
          return urlCallCount === 1
            ? 'https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711'
            : 'https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711/new-page';
        }),
      },
      {
        domTree: createMockDOMTree([
          createMockDOMNode({ isVisible: true, isInteractive: true }),
        ]),
      }
    );
    context.params = { elementIndex: 0, waitForNavigation: false };

    const result = await clickTool.execute(context);

    expect(result.success).toBe(true);
    expect(result.extracted).toMatchObject({
      navigationOccurred: true,
    });
  });

  // Test 12: element xpath captured
  it('should capture element xpath in extracted data', async () => {
    const mockLocator = {
      count: vi.fn().mockResolvedValue(1),
      click: vi.fn().mockResolvedValue(undefined),
    };

    const context = createMockContext(
      {
        locator: vi.fn().mockReturnValue(mockLocator),
        url: vi.fn().mockReturnValue('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711'),
      },
      {
        domTree: createMockDOMTree([
          createMockDOMNode({
            xpath: '//div[@class="cta"]/button[1]',
            text: 'Submit',
            isVisible: true,
            isInteractive: true,
          }),
        ]),
      }
    );
    context.params = { elementIndex: 0 };

    const result = await clickTool.execute(context);

    expect(result.success).toBe(true);
    expect(result.extracted).toMatchObject({
      clickedXpath: '//div[@class="cta"]/button[1]',
      elementText: 'Submit',
    });
  });

  // Test 13: negative index rejected by Zod
  it('should reject negative index via Zod validation', () => {
    const result = ClickParamsSchema.safeParse({ elementIndex: -1 });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// GO TO URL TOOL TESTS (5)
// ============================================================================

describe('goToUrlTool', () => {
  // Test 14: navigate to valid URL
  it('should navigate to a valid URL', async () => {
    const context = createMockContext({
      url: vi.fn().mockReturnValue('https://new-site.com'),
      goto: vi.fn().mockResolvedValue({
        status: vi.fn().mockReturnValue(200),
      }),
    });
    context.params = { url: 'https://new-site.com', waitUntil: 'load' };

    const result = await goToUrlTool.execute(context);

    expect(result.success).toBe(true);
    expect(result.insights).toEqual([]);
    expect(result.extracted).toMatchObject({
      previousUrl: 'https://new-site.com',
      newUrl: 'https://new-site.com',
    });
    expect((result.extracted as { loadTimeMs: number }).loadTimeMs).toBeGreaterThanOrEqual(0);
  });

  // Test 15: invalid URL rejected by Zod
  it('should reject invalid URL via Zod validation', () => {
    const result = GoToUrlParamsSchema.safeParse({ url: 'not-a-valid-url' });
    expect(result.success).toBe(false);
  });

  // Test 16: load time tracked
  it('should track load time in milliseconds', async () => {
    const context = createMockContext({
      url: vi.fn().mockReturnValue('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711'),
      goto: vi.fn().mockImplementation(async () => {
        // Simulate some load time
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { status: vi.fn().mockReturnValue(200) };
      }),
    });
    context.params = { url: 'https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711' };

    const result = await goToUrlTool.execute(context);

    expect(result.success).toBe(true);
    expect((result.extracted as { loadTimeMs: number }).loadTimeMs).toBeGreaterThanOrEqual(10);
  });

  // Test 17: previous URL captured
  it('should capture previous URL in extracted data', async () => {
    let callCount = 0;
    const context = createMockContext({
      url: vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 'https://old-page.com' : 'https://new-page.com';
      }),
      goto: vi.fn().mockResolvedValue({
        status: vi.fn().mockReturnValue(200),
      }),
    });
    context.params = { url: 'https://new-page.com' };

    const result = await goToUrlTool.execute(context);

    expect(result.success).toBe(true);
    expect(result.extracted).toMatchObject({
      previousUrl: 'https://old-page.com',
      newUrl: 'https://new-page.com',
    });
  });

  // Test 18: waitUntil parameter respected
  it('should pass waitUntil parameter to page.goto', async () => {
    const mockGoto = vi.fn().mockResolvedValue({
      status: vi.fn().mockReturnValue(200),
    });

    const context = createMockContext({
      url: vi.fn().mockReturnValue('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711'),
      goto: mockGoto,
    });
    context.params = { url: 'https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711', waitUntil: 'networkidle' };

    await goToUrlTool.execute(context);

    expect(mockGoto).toHaveBeenCalledWith('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
  });
});

// ============================================================================
// SCHEMA TESTS
// ============================================================================

describe('Parameter Schema Validation', () => {
  it('ScrollPageParamsSchema should apply default amount', () => {
    const result = ScrollPageParamsSchema.parse({ direction: 'down' });
    expect(result.amount).toBe(500);
  });

  it('ClickParamsSchema should apply default waitForNavigation', () => {
    const result = ClickParamsSchema.parse({ elementIndex: 0 });
    expect(result.waitForNavigation).toBe(false);
  });

  it('GoToUrlParamsSchema should apply default waitUntil', () => {
    const result = GoToUrlParamsSchema.parse({ url: 'https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711' });
    expect(result.waitUntil).toBe('load');
  });
});
