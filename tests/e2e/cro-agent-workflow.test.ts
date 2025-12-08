/**
 * CROAgent E2E Workflow Tests
 *
 * Phase 16 (T087): End-to-end tests for CROAgent workflow.
 * Tests real browser interaction with mock LLM responses.
 * These tests require Playwright and launch actual browsers.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { chromium, type Browser, type Page } from 'playwright';
import { ToolRegistry, ToolExecutor } from '../../src/agent/tools/index.js';
import { PromptBuilder } from '../../src/agent/prompt-builder.js';
import { MessageManager } from '../../src/agent/message-manager.js';
import { StateManager } from '../../src/agent/state-manager.js';
import { DOMExtractor, DOMSerializer } from '../../src/browser/dom/index.js';
import type { Tool } from '../../src/agent/tools/index.js';
import type { PageState, CROAgentOutput } from '../../src/models/index.js';

// Skip E2E tests in CI environments unless explicitly enabled
const skipE2E = process.env.CI === 'true' && !process.env.RUN_E2E_TESTS;

// Test HTML page
const TEST_HTML = `<!DOCTYPE html>
<html>
<head><title>Test E-commerce Page</title></head>
<body>
  <header>
    <nav>
      <a href="/" id="home">Home</a>
      <a href="/products" id="products">Products</a>
      <a href="/cart" id="cart">Cart (0)</a>
    </nav>
  </header>
  <main>
    <section id="hero">
      <h1>Welcome to Our Store</h1>
      <p>Find the best products at great prices.</p>
      <button id="cta-primary" class="btn-primary">Shop Now</button>
    </section>
    <section id="products">
      <h2>Featured Products</h2>
      <div class="product-grid">
        <div class="product">
          <h3>Product 1</h3>
          <button class="add-to-cart">Add to Cart</button>
        </div>
        <div class="product">
          <h3>Product 2</h3>
          <button class="add-to-cart">Add to Cart</button>
        </div>
      </div>
    </section>
    <section id="trust">
      <img src="ssl-badge.png" alt="Secure SSL" class="trust-badge">
      <p>30-Day Money Back Guarantee</p>
    </section>
    <form id="newsletter">
      <label for="email">Subscribe to Newsletter</label>
      <input type="email" id="email" name="email" placeholder="your@email.com">
      <button type="submit">Subscribe</button>
    </form>
  </main>
  <footer>
    <p>&copy; 2024 Test Store</p>
  </footer>
</body>
</html>`;

describe.skipIf(skipE2E)('CROAgent E2E Workflow', () => {
  let browser: Browser;
  let page: Page;
  let domExtractor: DOMExtractor;
  let serializer: DOMSerializer;
  let registry: ToolRegistry;
  let executor: ToolExecutor;
  let stateManager: StateManager;

  // Create test tools
  const createTestTools = () => {
    const analyzeCTAs: Tool = {
      name: 'analyze_ctas',
      description: 'Analyze CTA buttons on page',
      parameters: z.object({}),
      execute: async (ctx) => {
        // Find CTA elements in page state
        const ctaNodes: string[] = [];
        const findCTAs = (node: any) => {
          if (node.croType === 'cta' && node.isVisible) {
            ctaNodes.push(node.text || node.xpath);
          }
          node.children?.forEach(findCTAs);
        };
        findCTAs(ctx.state.domTree.root);

        return {
          success: true,
          insights: ctaNodes.length > 0 ? [
            {
              id: 'cta-analysis-1',
              category: 'cta' as const,
              type: 'cta_found',
              severity: 'low' as const,
              element: '//button',
              issue: `Found ${ctaNodes.length} CTA buttons`,
              recommendation: 'Review CTA text for clarity',
            },
          ] : [],
          extracted: { ctaCount: ctaNodes.length },
        };
      },
    };

    const scrollPage: Tool = {
      name: 'scroll_page',
      description: 'Scroll the page',
      parameters: z.object({ direction: z.enum(['up', 'down']).optional() }),
      execute: async (ctx) => {
        const direction = (ctx.params as { direction?: string })?.direction || 'down';
        const scrollAmount = direction === 'down' ? 500 : -500;
        await ctx.page.evaluate((amount) => window.scrollBy(0, amount), scrollAmount);
        return { success: true, insights: [] };
      },
    };

    const done: Tool = {
      name: 'done',
      description: 'Complete analysis',
      parameters: z.object({ summary: z.string().optional() }),
      execute: async () => ({ success: true, insights: [] }),
    };

    return { analyzeCTAs, scrollPage, done };
  };

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser?.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setContent(TEST_HTML);

    domExtractor = new DOMExtractor();
    serializer = new DOMSerializer();
    registry = new ToolRegistry();
    stateManager = new StateManager({ maxSteps: 5 });

    const tools = createTestTools();
    registry.register(tools.analyzeCTAs);
    registry.register(tools.scrollPage);
    registry.register(tools.done);

    executor = new ToolExecutor(registry);
  });

  afterEach(async () => {
    await page?.close();
  });

  // Test 1: Extract DOM tree from real page
  it('should extract DOM tree from real page', async () => {
    const domTree = await domExtractor.extract(page);

    expect(domTree.totalNodeCount).toBeGreaterThan(0);
    expect(domTree.croElementCount).toBeGreaterThan(0);
    expect(domTree.extractedAt).toBeDefined();
  });

  // Test 2: Serialize DOM for LLM consumption
  it('should serialize DOM tree for LLM', async () => {
    const domTree = await domExtractor.extract(page);
    const result = serializer.serialize(domTree);

    expect(result.text.length).toBeGreaterThan(0);
    expect(result.elementCount).toBeGreaterThan(0);
    expect(result.estimatedTokens).toBeGreaterThan(0);
  });

  // Test 3: Build complete PageState
  it('should build complete PageState from real page', async () => {
    const domTree = await domExtractor.extract(page);
    const viewportSize = page.viewportSize() || { width: 1280, height: 720 };

    const scroll = await page.evaluate(`(() => ({
      x: window.scrollX,
      y: window.scrollY,
      maxX: document.documentElement.scrollWidth - window.innerWidth,
      maxY: document.documentElement.scrollHeight - window.innerHeight,
    }))()`);

    const pageState: PageState = {
      url: page.url(),
      title: await page.title(),
      domTree,
      viewport: {
        width: viewportSize.width,
        height: viewportSize.height,
        deviceScaleFactor: 1,
        isMobile: false,
      },
      scrollPosition: scroll as any,
      timestamp: Date.now(),
    };

    expect(pageState.title).toBe('Test E-commerce Page');
    expect(pageState.domTree.croElementCount).toBeGreaterThan(0);
  });

  // Test 4: Execute tool on real page
  it('should execute analyze_ctas tool on real page', async () => {
    const domTree = await domExtractor.extract(page);
    const pageState: PageState = {
      url: page.url(),
      title: await page.title(),
      domTree,
      viewport: { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false },
      scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 1000 },
      timestamp: Date.now(),
    };

    const result = await executor.execute('analyze_ctas', {}, {
      page,
      state: pageState,
    });

    expect(result.success).toBe(true);
    expect(result.executionTimeMs).toBeGreaterThan(0);
  });

  // Test 5: Scroll tool modifies page state
  it('should scroll page and detect position change', async () => {
    // Make page taller to enable scrolling
    await page.evaluate(() => {
      document.body.style.height = '3000px';
    });

    const getScrollY = () =>
      page.evaluate('window.scrollY');

    const initialY = await getScrollY();

    // Build minimal state for scroll
    const domTree = await domExtractor.extract(page);
    const pageState: PageState = {
      url: page.url(),
      title: await page.title(),
      domTree,
      viewport: { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false },
      scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 2000 },
      timestamp: Date.now(),
    };

    await executor.execute('scroll_page', { direction: 'down' }, {
      page,
      state: pageState,
    });

    const afterY = await getScrollY();
    expect(afterY).toBeGreaterThan(initialY);
  });

  // Test 6: Full workflow simulation
  it('should complete full observe-reason-act workflow', async () => {
    const builder = new PromptBuilder(registry);
    const messageManager = new MessageManager(builder.buildSystemPrompt());

    // Simulate agent loop
    const mockResponses: CROAgentOutput[] = [
      {
        thinking: 'Starting analysis',
        evaluation_previous_goal: 'N/A',
        memory: 'Starting CRO analysis',
        next_goal: 'Analyze CTAs',
        action: { name: 'analyze_ctas', params: {} },
      },
      {
        thinking: 'CTAs analyzed, scrolling for more content',
        evaluation_previous_goal: 'Found CTAs',
        memory: 'CTAs analyzed',
        next_goal: 'Scroll to see more',
        action: { name: 'scroll_page', params: { direction: 'down' } },
      },
      {
        thinking: 'Analysis complete',
        evaluation_previous_goal: 'Scrolled successfully',
        memory: 'Full page analyzed',
        next_goal: 'Complete',
        action: { name: 'done', params: { summary: 'Complete' } },
      },
    ];

    let stepIndex = 0;
    while (!stateManager.shouldTerminate() && stepIndex < mockResponses.length) {
      // OBSERVE
      const domTree = await domExtractor.extract(page);
      const pageState: PageState = {
        url: page.url(),
        title: await page.title(),
        domTree,
        viewport: { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false },
        scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 1000 },
        timestamp: Date.now(),
      };

      // REASON (mock)
      const output = mockResponses[stepIndex];
      const userMsg = builder.buildUserMessage(pageState, stateManager.getMemory());
      messageManager.addUserMessage(userMsg);
      messageManager.addAssistantMessage(output);

      // ACT
      const result = await executor.execute(output.action.name, output.action.params || {}, {
        page,
        state: pageState,
      });

      if (result.success) {
        stateManager.resetFailures();
        stateManager.addInsights(result.insights);
      }

      if (output.action.name === 'done') {
        stateManager.setDone('Complete');
      }

      stateManager.incrementStep();
      stepIndex++;
    }

    expect(stateManager.isDone()).toBe(true);
    expect(stateManager.getStep()).toBe(3);
  });

  // Test 7: System prompt includes real tool definitions
  it('should build system prompt with real tools', () => {
    const builder = new PromptBuilder(registry);
    const systemPrompt = builder.buildSystemPrompt();

    expect(systemPrompt).toContain('analyze_ctas');
    expect(systemPrompt).toContain('scroll_page');
    expect(systemPrompt).toContain('done');
    expect(systemPrompt).toContain('<available_tools>');
  });

  // Test 8: User message includes serialized DOM
  it('should build user message with serialized DOM', async () => {
    const builder = new PromptBuilder(registry);
    const domTree = await domExtractor.extract(page);

    const pageState: PageState = {
      url: 'about:blank',
      title: 'Test E-commerce Page',
      domTree,
      viewport: { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false },
      scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 1000 },
      timestamp: Date.now(),
    };

    const userMsg = builder.buildUserMessage(pageState, stateManager.getMemory());

    expect(userMsg).toContain('<page_title>Test E-commerce Page</page_title>');
    expect(userMsg).toContain('<cro_elements');
    expect(userMsg).toContain('<memory>');
  });
});
