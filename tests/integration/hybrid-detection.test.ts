/**
 * Integration Tests for HybridPageTypeDetector - Phase 24 (T469)
 *
 * Tests the three-tier hybrid detection strategy:
 * 1. Cache check
 * 2. Tier 1: Playwright detection (PRIMARY)
 * 3. Tier 2: URL/selector heuristics (SECONDARY)
 * 4. Tier 3: LLM fallback (only when uncertain)
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { Page } from 'playwright';
import { BrowserManager } from '../../src/browser/index.js';
import { DEFAULT_BROWSER_CONFIG } from '../../src/types/index.js';
import type { PageState } from '../../src/models/index.js';
import type { LLMDetectionResult } from '../../src/heuristics/llm-page-type-detector.js';

// Import all dependencies at the top to avoid dynamic import issues
import {
  HybridPageTypeDetector,
  createHybridPageTypeDetector,
  createPlaywrightPageTypeDetector,
  createDomainPatternCache,
} from '../../src/heuristics/index.js';
import { createPageTypeDetector } from '../../src/heuristics/page-type-detector.js';
import { createLLMPageTypeDetector } from '../../src/heuristics/llm-page-type-detector.js';

// Skip integration tests in CI unless explicitly enabled
const skipIntegration = process.env.CI === 'true' && !process.env.RUN_INTEGRATION_TESTS;

// PDP HTML with strong signals (JSON-LD + Add to Cart)
const PDP_HTML_STRONG = `<!DOCTYPE html>
<html>
<head>
  <title>Lynton Polo Shirt - Peregrine Clothing</title>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Lynton Polo Shirt",
    "offers": {
      "@type": "Offer",
      "price": "85.00",
      "priceCurrency": "GBP"
    }
  }
  </script>
</head>
<body>
  <h1>Lynton Polo Shirt</h1>
  <span class="price">£85.00</span>
  <select name="option1">
    <option>Small</option>
    <option>Medium</option>
    <option>Large</option>
  </select>
  <button id="add-to-cart">Add to Bag</button>
</body>
</html>`;

// PDP HTML with weak signals (no JSON-LD, ambiguous CTA)
const PDP_HTML_WEAK = `<!DOCTYPE html>
<html>
<head><title>Some Product - Store</title></head>
<body>
  <h1>Some Product</h1>
  <span>Price: $50</span>
  <button>Learn More</button>
</body>
</html>`;

// PLP HTML (product listing)
const PLP_HTML = `<!DOCTYPE html>
<html>
<head><title>All Products - Store</title></head>
<body>
  <h1>Shop All Products</h1>
  <select name="sort"><option>Price Low to High</option></select>
  <div class="filter-sidebar"><label>Category</label><select><option>Shirts</option></select></div>
  <a href="/products/1"><div class="product-card">Product 1</div></a>
  <a href="/products/2"><div class="product-card">Product 2</div></a>
  <a href="/products/3"><div class="product-card">Product 3</div></a>
  <a href="/products/4"><div class="product-card">Product 4</div></a>
  <a href="/products/5"><div class="product-card">Product 5</div></a>
  <a href="/products/6"><div class="product-card">Product 6</div></a>
  <a href="/products/7"><div class="product-card">Product 7</div></a>
  <a href="/products/8"><div class="product-card">Product 8</div></a>
</body>
</html>`;

// Cart HTML
const CART_HTML = `<!DOCTYPE html>
<html>
<head><title>Your Cart</title></head>
<body>
  <h1>Shopping Cart</h1>
  <div class="cart-item">Item 1 - $50</div>
  <div class="cart-item">Item 2 - $30</div>
  <input type="number" name="quantity" value="1">
  <span>Subtotal: $80</span>
  <button>Proceed to Checkout</button>
</body>
</html>`;

// Mock PageState factory
function createMockPageState(url: string, title: string): PageState {
  return {
    url,
    title,
    domTree: {
      root: { tagName: 'html', attributes: {}, children: [] },
      elementCount: 10,
      tokenCount: 100,
    },
    viewport: { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false },
    scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 0 },
    timestamp: Date.now(),
  };
}

describe.skipIf(skipIntegration)('HybridPageTypeDetector Integration', () => {
  let browserManager: BrowserManager;
  let page: Page;

  beforeAll(async () => {
    browserManager = new BrowserManager({
      ...DEFAULT_BROWSER_CONFIG,
      headless: true,
    });
    await browserManager.launch();
    page = browserManager.getPage();
    // Set short default timeout to catch hanging operations quickly
    page.setDefaultTimeout(5000);
  });

  afterAll(async () => {
    await browserManager?.close();
  });

  // Run all tests sequentially since they share a single page instance
  // Helper to set page content without waiting for load events
  async function setPageContent(html: string): Promise<void> {
    await page.setContent(html, { waitUntil: 'commit' });
  }

  describe.sequential('Sequential Tests', () => {
    describe('Cache Behavior', () => {
    it('should use cache when available', async () => {
      const cache = createDomainPatternCache();
      cache.set('https://example.com/product/123', {
        pageType: 'pdp',
        confidence: 0.95,
        tier: 'playwright',
      });

      const detector = new HybridPageTypeDetector(
        { enableDomainCache: true },
        createPlaywrightPageTypeDetector(),
        createPageTypeDetector(),
        createLLMPageTypeDetector(),
        cache
      );

      await setPageContent(PDP_HTML_STRONG);
      const state = createMockPageState('https://example.com/product/456', 'Another Product');

      const result = await detector.detect(page, state);

      expect(result.fromCache).toBe(true);
      expect(result.tier).toBe('cache');
      expect(result.pageType).toBe('pdp');
      expect(result.confidence).toBe(0.95);
    });

    it('should prevent repeat detection for same domain', async () => {
      const detector = createHybridPageTypeDetector({
        enableDomainCache: true,
        enableLLMFallback: false,
      });

      await setPageContent(PDP_HTML_STRONG);
      const state1 = createMockPageState(
        'https://www.testdomain.co.uk/products/polo-1',
        'Polo Shirt 1'
      );
      const result1 = await detector.detect(page, state1);

      expect(result1.fromCache).toBe(false);

      const state2 = createMockPageState(
        'https://www.testdomain.co.uk/products/polo-2',
        'Polo Shirt 2'
      );
      const result2 = await detector.detect(page, state2);

      expect(result2.fromCache).toBe(true);
      expect(result2.tier).toBe('cache');
    });
  });

  describe('Tier 1: Playwright Detection', () => {
    it('should skip other tiers when Playwright is confident', async () => {
      const detector = createHybridPageTypeDetector({
        enableDomainCache: false,
        playwrightConfidenceThreshold: 0.7,
        enableLLMFallback: false,
      });

      await setPageContent(PDP_HTML_STRONG);
      const state = createMockPageState(
        'https://test-store.com/products/lynton-polo',
        'Lynton Polo Shirt'
      );

      const result = await detector.detect(page, state);

      expect(result.pageType).toBe('pdp');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.tier).toBe('playwright');
      expect(result.playwrightResult).toBeDefined();
      expect(result.llmResult).toBeUndefined();
    });

    it('should detect Peregrine PDP correctly without LLM', async () => {
      const detector = createHybridPageTypeDetector({
        enableDomainCache: false,
        enableLLMFallback: false,
      });

      await setPageContent(PDP_HTML_STRONG);
      const state = createMockPageState(
        'https://www.peregrineclothing.co.uk/products/lynton-polo-shirt',
        'Lynton Polo Shirt'
      );

      const result = await detector.detect(page, state);

      expect(result.pageType).toBe('pdp');
      expect(['playwright', 'combined']).toContain(result.tier);
      expect(result.llmResult).toBeUndefined();

      if (result.playwrightResult) {
        expect(result.playwrightResult.signals.schemaProduct).toBe(true);
        expect(result.playwrightResult.signals.addToCart).toBe(true);
      }
    });
  });

  describe('Tier 2: Combined Detection', () => {
    it('should combine Tier 1 and Tier 2 when Playwright is uncertain', async () => {
      const detector = createHybridPageTypeDetector({
        enableDomainCache: false,
        playwrightConfidenceThreshold: 0.95,
        enableLLMFallback: false,
      });

      await setPageContent(PDP_HTML_WEAK);
      const state = createMockPageState(
        'https://store.com/products/some-product',
        'Some Product - Store'
      );

      const result = await detector.detect(page, state);

      expect(['combined', 'playwright', 'heuristic']).toContain(result.tier);
      expect(result.playwrightResult).toBeDefined();
      expect(result.heuristicResult).toBeDefined();
    });
  });

  describe('Tier 3: LLM Fallback', () => {
    it('should invoke LLM only when both tiers are uncertain', async () => {
      const mockLLMDetect = vi.fn().mockResolvedValue({
        pageType: 'pdp',
        confidence: 0.85,
        reasoning: 'Detected product page',
        tier: 'llm' as const,
        detectionTimeMs: 500,
      } as LLMDetectionResult);

      const mockLLMDetector = {
        detect: mockLLMDetect,
        getConfig: () => ({ model: 'gpt-4o-mini', timeout: 10000, maxTokens: 200, imageMaxWidth: 512, temperature: 0.1 }),
      };

      const detector = new HybridPageTypeDetector(
        {
          enableDomainCache: false,
          playwrightConfidenceThreshold: 0.95,
          llmFallbackThreshold: 0.7,
          enableLLMFallback: true,
        },
        createPlaywrightPageTypeDetector(),
        createPageTypeDetector(),
        mockLLMDetector as any,
        createDomainPatternCache()
      );

      await setPageContent(PDP_HTML_WEAK);
      const state = createMockPageState(
        'https://ambiguous-store.com/item/12345',
        'Some Page'
      );

      const result = await detector.detect(page, state);

      expect(mockLLMDetect).toHaveBeenCalled();
      expect(result.tier).toBe('llm');
      expect(result.llmResult).toBeDefined();
    });

    it('should fall back gracefully when LLM fails', async () => {
      const mockLLMDetect = vi.fn().mockRejectedValue(new Error('API timeout'));

      const mockLLMDetector = {
        detect: mockLLMDetect,
        getConfig: () => ({ model: 'gpt-4o-mini', timeout: 10000, maxTokens: 200, imageMaxWidth: 512, temperature: 0.1 }),
      };

      const detector = new HybridPageTypeDetector(
        {
          enableDomainCache: false,
          playwrightConfidenceThreshold: 0.95,
          llmFallbackThreshold: 0.7,
          enableLLMFallback: true,
        },
        createPlaywrightPageTypeDetector(),
        createPageTypeDetector(),
        mockLLMDetector as any,
        createDomainPatternCache()
      );

      await setPageContent(PDP_HTML_WEAK);
      const state = createMockPageState(
        'https://ambiguous-store2.com/item/12345',
        'Some Page'
      );

      const result = await detector.detect(page, state);

      expect(result).toBeDefined();
      expect(result.tier).toBe('combined');
      expect(result.signals).toContain('LLM: failed');
    });
  });

  describe('Page Type Detection Accuracy', () => {
    it('should detect PLP page correctly', async () => {
      const detector = createHybridPageTypeDetector({
        enableDomainCache: false,
        enableLLMFallback: false,
      });

      await setPageContent(PLP_HTML);
      const state = createMockPageState(
        'https://store.com/collections/shirts',
        'All Products - Store'
      );

      const result = await detector.detect(page, state);

      expect(result.pageType).toBe('plp');
    });

    it('should detect cart page correctly', async () => {
      const detector = createHybridPageTypeDetector({
        enableDomainCache: false,
        enableLLMFallback: false,
      });

      await setPageContent(CART_HTML);
      const state = createMockPageState(
        'https://store.com/cart',
        'Your Cart'
      );

      const result = await detector.detect(page, state);

      expect(result.pageType).toBe('cart');
    });
  });
  }); // end Sequential Tests
});
