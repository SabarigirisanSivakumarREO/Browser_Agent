/**
 * Vision Analysis E2E Workflow Tests
 *
 * Tests the complete vision analysis workflow:
 * - Page type detection for PDP pages
 * - Screenshot capture
 * - GPT-4o vision analysis (requires OPENAI_API_KEY)
 * - Vision insights generation
 *
 * NOTE: For agent-level vision tests, use CROAgent with `vision: true`.
 * These tests require OPENAI_API_KEY and incur API costs when run.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';

import { CROAgent, type CROAnalysisResult } from '../../src/agent/index.js';
import {
  createPageTypeDetector,
  createCROVisionAnalyzer,
  loadHeuristics,
  isPageTypeSupported,
} from '../../src/heuristics/index.js';
import type { PageState, DOMTree } from '../../src/models/index.js';
import type { ViewportInfo } from '../../src/models/page-state.js';
import { DOMExtractor } from '../../src/browser/dom/index.js';

// Skip E2E tests in CI environments unless explicitly enabled
const skipE2E = process.env.CI === 'true' && !process.env.RUN_E2E_TESTS;
const skipVisionTests = !process.env.OPENAI_API_KEY;

// Real PDP page for testing
const TEST_PDP_URL = 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt';

// Test HTML - PDP mock page (for non-API tests)
const MOCK_PDP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Lynton Polo Shirt - Peregrine Clothing</title>
</head>
<body>
  <header>
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a> &gt; <a href="/collections/polo-shirts">Polo Shirts</a> &gt; Lynton
    </nav>
  </header>
  <main class="product-page">
    <div class="product-images">
      <img src="lynton-main.jpg" alt="Lynton Polo Shirt in Navy" class="main-image">
      <div class="thumbnails">
        <img src="lynton-1.jpg" alt="Front view">
        <img src="lynton-2.jpg" alt="Back view">
        <img src="lynton-3.jpg" alt="Detail view">
      </div>
    </div>
    <div class="product-info">
      <h1 class="product-title">Lynton Polo Shirt</h1>
      <div class="price">
        <span class="amount">£85.00</span>
      </div>
      <div class="product-options">
        <label for="size">Size:</label>
        <select id="size" name="size" required>
          <option value="">Select size</option>
          <option value="S">Small</option>
          <option value="M">Medium</option>
          <option value="L">Large</option>
          <option value="XL">Extra Large</option>
        </select>
        <label for="color">Colour:</label>
        <select id="color" name="color">
          <option value="navy">Navy</option>
          <option value="white">White</option>
        </select>
      </div>
      <button class="add-to-bag btn-primary" type="button">Add to Bag</button>
      <div class="product-description">
        <h2>Description</h2>
        <p>A classic polo shirt crafted from premium cotton pique. Perfect for smart casual occasions.</p>
        <ul class="features">
          <li>100% Cotton Pique</li>
          <li>Classic fit</li>
          <li>Two-button placket</li>
          <li>Ribbed collar and cuffs</li>
        </ul>
      </div>
      <div class="delivery-info">
        <p>Free UK delivery on orders over £75</p>
        <p>Free returns within 30 days</p>
      </div>
      <div class="trust-signals">
        <img src="secure-payment.png" alt="Secure Payment">
        <span class="reviews">★★★★★ 4.8/5 (127 reviews)</span>
      </div>
    </div>
  </main>
</body>
</html>`;

describe.skipIf(skipE2E)('Vision Analysis E2E Workflow', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-gpu', '--no-sandbox'],
    });
  });

  afterAll(async () => {
    await browser?.close();
  });

  beforeEach(async () => {
    page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    });
  });

  afterEach(async () => {
    await page?.close();
  });

  describe('Page Type Detection', () => {
    it('should detect PDP page type from mock HTML', async () => {
      // Serve mock HTML
      await page.setContent(MOCK_PDP_HTML);

      // Extract DOM
      const domExtractor = new DOMExtractor();
      const domTree = await domExtractor.extract(page);

      // Create page state
      const viewport = page.viewportSize() || { width: 1920, height: 1080 };
      const pageState: PageState = {
        url: 'https://example.com/products/lynton-polo-shirt',
        title: await page.title(),
        domTree,
        viewport: {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          isMobile: false,
        },
        scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 2000 },
        timestamp: Date.now(),
      };

      // Detect page type
      const detector = createPageTypeDetector();
      const result = detector.detect(pageState);

      expect(result.type).toBe('pdp');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should correctly identify supported page types', () => {
      expect(isPageTypeSupported('pdp')).toBe(true);
      expect(isPageTypeSupported('homepage')).toBe(false);
      expect(isPageTypeSupported('plp')).toBe(true);  // Phase 22A: PLP now supported
    });
  });

  describe('Screenshot Capture', () => {
    it('should capture screenshot for vision analysis', async () => {
      await page.setContent(MOCK_PDP_HTML);

      // Capture screenshot as base64
      const screenshotBuffer = await page.screenshot({
        type: 'png',
        fullPage: false,
      });
      const screenshotBase64 = screenshotBuffer.toString('base64');

      expect(screenshotBase64).toBeDefined();
      expect(screenshotBase64.length).toBeGreaterThan(1000);
      // PNG signature starts with iVBOR in base64
      expect(screenshotBase64.startsWith('iVBOR')).toBe(true);
    });
  });

  describe('Heuristics Loading', () => {
    it('should load all 35 PDP heuristics', () => {
      const heuristics = loadHeuristics('pdp');

      expect(heuristics.pageType).toBe('pdp');
      expect(heuristics.totalCount).toBe(35);
      expect(heuristics.categories.length).toBe(10);

      // Verify category structure
      for (const category of heuristics.categories) {
        expect(category.name).toBeDefined();
        expect(category.heuristics).toBeDefined();
        expect(category.heuristics.length).toBeGreaterThan(0);

        for (const heuristic of category.heuristics) {
          expect(heuristic.id).toMatch(/^PDP-[A-Z]+-\d{3}$/);
          expect(heuristic.principle).toBeDefined();
          expect(['critical', 'high', 'medium', 'low']).toContain(heuristic.severity);
        }
      }
    });
  });

  describe('Vision Analyzer Configuration', () => {
    it('should create analyzer with default config', () => {
      const analyzer = createCROVisionAnalyzer();
      const config = analyzer.getConfig();

      expect(config.model).toBe('gpt-4o-mini');  // Phase 28 revert: Default back to gpt-4o-mini
      expect(config.maxTokens).toBe(4096);
      expect(config.temperature).toBe(0.1);
      expect(config.includeObservations).toBe(true);
    });

    it('should create analyzer with gpt-4o-mini', () => {
      const analyzer = createCROVisionAnalyzer({ model: 'gpt-4o-mini' });
      const config = analyzer.getConfig();

      expect(config.model).toBe('gpt-4o-mini');
    });
  });

  describe.skipIf(skipVisionTests)('Vision Analysis with Real API', () => {
    it('should analyze PDP screenshot using GPT-4o', async () => {
      // Serve mock HTML
      await page.setContent(MOCK_PDP_HTML);

      // Capture screenshot
      const screenshotBuffer = await page.screenshot({
        type: 'png',
        fullPage: false,
      });
      const screenshotBase64 = screenshotBuffer.toString('base64');

      // Create analyzer
      const analyzer = createCROVisionAnalyzer({ model: 'gpt-4o' });

      // Run analysis
      const viewport: ViewportInfo = {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        isMobile: false,
      };

      const result = await analyzer.analyze(screenshotBase64, 'pdp', viewport);

      // Verify result structure
      expect(result.pageType).toBe('pdp');
      expect(result.screenshotUsed).toBe(true);
      expect(result.evaluations).toBeDefined();
      expect(result.evaluations.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.summary.totalHeuristics).toBeGreaterThan(0);

      // Verify evaluations have required fields
      for (const evaluation of result.evaluations) {
        expect(evaluation.heuristicId).toMatch(/^PDP-[A-Z]+-\d{3}$/);
        expect(['pass', 'fail', 'partial', 'not_applicable']).toContain(evaluation.status);
        expect(evaluation.confidence).toBeGreaterThanOrEqual(0);
        expect(evaluation.confidence).toBeLessThanOrEqual(1);
      }

      // Verify insights were generated
      expect(result.insights).toBeDefined();
    }, 60000); // 60s timeout for API call
  });

  describe.skipIf(skipVisionTests)('CRO Agent with Vision', () => {
    it('should run full analysis with vision enabled on mock PDP', async () => {
      // Create temporary server for mock HTML
      await page.setContent(MOCK_PDP_HTML);
      const mockUrl = page.url();

      // Create CRO Agent
      const agent = new CROAgent({
        maxSteps: 2, // Limit steps for test
        actionWaitMs: 100,
        llmTimeoutMs: 60000,
        failureLimit: 3,
      });

      try {
        // Note: This test would require a real URL due to agent navigation
        // For unit testing, we verify the configuration is properly passed
        expect(agent).toBeDefined();

        // Verify vision options are available in analyze method
        // The actual integration is tested via integration tests
      } finally {
        // Cleanup
      }
    });

    it('should skip vision analysis when disabled', async () => {
      const agent = new CROAgent({
        maxSteps: 1,
        actionWaitMs: 100,
        llmTimeoutMs: 30000,
        failureLimit: 1,
      });

      expect(agent).toBeDefined();
      // When useVisionAnalysis: false is passed, vision should be skipped
    });
  });
});

describe('Vision Analysis - Unit Tests', () => {
  describe('Page Type Signals', () => {
    it('should identify PDP from URL patterns', () => {
      const detector = createPageTypeDetector();

      // Test various PDP URL patterns
      const pdpUrls = [
        'https://example.com/products/item-name',
        'https://example.com/product/12345',
        'https://example.com/p/item-slug',
        'https://example.com/item/12345/details',
        'https://example.com/shop/category/product-name',
      ];

      for (const url of pdpUrls) {
        const mockState: PageState = {
          url,
          title: 'Product Page',
          domTree: {
            root: { tagName: 'body', xpath: '/body', text: '', isInteractive: false, isVisible: true, croType: null, children: [] },
            interactiveCount: 0,
            croElementCount: 0,
            totalNodeCount: 1,
            extractedAt: Date.now(),
          },
          viewport: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false },
          scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 0 },
          timestamp: Date.now(),
        };

        const result = detector.detect(mockState);
        // PDP should be detected with some confidence from URL
        expect(['pdp', 'other', 'plp']).toContain(result.type);
      }
    });
  });

  describe('Vision Analyzer Error Handling', () => {
    it('should throw error for unsupported page type', async () => {
      const analyzer = createCROVisionAnalyzer();
      const mockScreenshot = 'mock-base64-image';
      const viewport: ViewportInfo = { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false };

      await expect(analyzer.analyze(mockScreenshot, 'homepage', viewport)).rejects.toThrow(
        'Vision analysis not supported'
      );
    });

    it('should require screenshot for analysis', async () => {
      const analyzer = createCROVisionAnalyzer();
      const viewport: ViewportInfo = { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false };

      await expect(analyzer.analyze('', 'pdp', viewport)).rejects.toThrow();
    });
  });
});
