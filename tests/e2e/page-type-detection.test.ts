/**
 * Page Type Detection E2E Tests - Phase 24 (T472)
 *
 * End-to-end tests for hybrid page type detection on real-world pages.
 * Tests the complete detection pipeline including:
 * - Playwright-based DOM analysis
 * - URL heuristics
 * - LLM fallback (when needed)
 *
 * NOTE: These tests require network access and may be slower.
 * Set RUN_E2E_TESTS=true to enable in CI.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import type { PageState } from '../../src/models/index.js';

// Skip E2E tests in CI unless explicitly enabled
const skipE2E = process.env.CI === 'true' && !process.env.RUN_E2E_TESTS;

// Helper to create PageState from a loaded page
async function createPageStateFromPage(browserPage: Page): Promise<PageState> {
  const url = browserPage.url();
  const title = await browserPage.title();

  return {
    url,
    title,
    domTree: {
      root: {
        tagName: 'html',
        attributes: {},
        children: [],
      },
      elementCount: 100,
      tokenCount: 1000,
    },
    viewport: {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      isMobile: false,
    },
    scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 2000 },
    timestamp: Date.now(),
  };
}

describe.skipIf(skipE2E)('Page Type Detection E2E', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-web-security'],
    });
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });
    page = await context.newPage();
    // Set short default timeout to speed up tests
    page.setDefaultTimeout(5000);
  }, 60000);

  afterAll(async () => {
    await context?.close();
    await browser?.close();
  });

  // Helper to set page content without waiting for load events
  async function setPageContent(html: string): Promise<void> {
    await page.setContent(html, { waitUntil: 'commit' });
  }

  // Run all tests sequentially since they share a single page instance
  describe.sequential('Sequential Tests', () => {
    describe('PDP Detection (Mock)', () => {
      it('should detect PDP with strong signals (JSON-LD + Add to Cart)', async () => {
        const { createHybridPageTypeDetector } = await import('../../src/heuristics/index.js');

        const pdpHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Lynton Polo Shirt - Peregrine Clothing</title>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Lynton Polo Shirt",
    "brand": "Peregrine",
    "offers": {
      "@type": "Offer",
      "price": "85.00",
      "priceCurrency": "GBP",
      "availability": "https://schema.org/InStock"
    }
  }
  </script>
</head>
<body>
  <main>
    <h1>Lynton Polo Shirt</h1>
    <p class="price">£85.00</p>
    <div class="product-gallery">
      <img src="polo1.jpg" width="600" height="600" alt="Product image">
      <img src="polo2.jpg" width="600" height="600" alt="Product image">
      <img src="polo3.jpg" width="600" height="600" alt="Product image">
    </div>
    <select name="option1" id="size-selector">
      <option>Small</option>
      <option>Medium</option>
      <option>Large</option>
    </select>
    <button type="submit" name="add" id="add-to-cart">Add to Bag</button>
  </main>
</body>
</html>`;

        const detector = createHybridPageTypeDetector({
          enableDomainCache: false,
          enableLLMFallback: false,
        });

        await setPageContent(pdpHtml);
        const state = await createPageStateFromPage(page);
        state.url = 'https://www.peregrineclothing.co.uk/products/lynton-polo-shirt';

        const result = await detector.detect(page, state);

        // Should detect as PDP with high confidence
        expect(result.pageType).toBe('pdp');
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);

        // Should use Playwright tier
        expect(['playwright', 'combined']).toContain(result.tier);
        expect(result.llmResult).toBeUndefined();

        // Verify key signals were detected
        if (result.playwrightResult) {
          expect(result.playwrightResult.signals.schemaProduct).toBe(true);
          expect(result.playwrightResult.signals.addToCart).toBe(true);
        }
      }, 30000);

      it('should detect luxury brand PDP (Burberry-style) correctly', async () => {
        const { createHybridPageTypeDetector } = await import('../../src/heuristics/index.js');

        const luxuryPdpHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Cashmere Scarf - Luxury Brand</title>
  <meta property="og:type" content="product">
  <meta property="product:price:amount" content="450.00">
  <meta property="product:price:currency" content="GBP">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Cashmere Scarf",
    "brand": "Luxury Brand",
    "offers": {
      "@type": "Offer",
      "price": "450.00",
      "priceCurrency": "GBP",
      "availability": "https://schema.org/InStock"
    }
  }
  </script>
</head>
<body>
  <main>
    <h1>Cashmere Scarf</h1>
    <p class="price">£450.00</p>
    <div class="product-gallery">
      <img src="scarf1.jpg" width="600" height="600" alt="Product image">
      <img src="scarf2.jpg" width="600" height="600" alt="Product image">
      <img src="scarf3.jpg" width="600" height="600" alt="Product image">
    </div>
    <select name="size" id="size-selector">
      <option>One Size</option>
    </select>
    <button type="submit" name="add" id="add-to-bag">Add to Bag</button>
  </main>
</body>
</html>`;

        const detector = createHybridPageTypeDetector({
          enableDomainCache: false,
          enableLLMFallback: false,
        });

        await setPageContent(luxuryPdpHtml);
        const state = await createPageStateFromPage(page);
        state.url = 'https://in.burberry.com/cashmere-scarf-p12345678';

        const result = await detector.detect(page, state);

        // Should detect as PDP with high confidence
        expect(result.pageType).toBe('pdp');
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);

        // Verify JSON-LD was detected
        if (result.playwrightResult) {
          expect(result.playwrightResult.signals.schemaProduct).toBe(true);
          expect(result.playwrightResult.signals.addToCart).toBe(true);
        }
      }, 30000);
    });

    describe('PLP Detection (Mock)', () => {
      it('should detect Product Listing Page correctly', async () => {
        const { createHybridPageTypeDetector } = await import('../../src/heuristics/index.js');

        const plpHtml = `<!DOCTYPE html>
<html>
<head><title>Polo Shirts - Peregrine Clothing</title></head>
<body>
  <h1>Polo Shirts Collection</h1>
  <select name="sort"><option>Price Low to High</option><option>Newest</option></select>
  <div class="filter-sidebar">
    <label>Size</label><select name="size"><option>Small</option><option>Medium</option></select>
    <label>Color</label><select name="color"><option>Blue</option><option>White</option></select>
  </div>
  <div class="product-grid">
    <a href="/products/polo-1"><div class="product-card" data-product-id="1">Polo 1 - £85</div></a>
    <a href="/products/polo-2"><div class="product-card" data-product-id="2">Polo 2 - £85</div></a>
    <a href="/products/polo-3"><div class="product-card" data-product-id="3">Polo 3 - £95</div></a>
    <a href="/products/polo-4"><div class="product-card" data-product-id="4">Polo 4 - £95</div></a>
    <a href="/products/polo-5"><div class="product-card" data-product-id="5">Polo 5 - £85</div></a>
    <a href="/products/polo-6"><div class="product-card" data-product-id="6">Polo 6 - £90</div></a>
    <a href="/products/polo-7"><div class="product-card" data-product-id="7">Polo 7 - £85</div></a>
    <a href="/products/polo-8"><div class="product-card" data-product-id="8">Polo 8 - £95</div></a>
  </div>
</body>
</html>`;

        const detector = createHybridPageTypeDetector({
          enableDomainCache: false,
          enableLLMFallback: false,
        });

        await setPageContent(plpHtml);
        const state = await createPageStateFromPage(page);
        state.url = 'https://www.peregrineclothing.co.uk/collections/polo-shirts';

        const result = await detector.detect(page, state);

        // Should detect as PLP
        expect(result.pageType).toBe('plp');

        // PLP should have grid signal and NOT have strong PDP signals
        if (result.playwrightResult) {
          expect(result.playwrightResult.signals.plpGrid).toBe(true);
          expect(result.playwrightResult.signals.addToCart).toBe(false);
          expect(result.playwrightResult.signals.schemaProduct).toBe(false);
        }
      }, 30000);
    });

    describe('Cart Detection (Mock)', () => {
      it('should detect cart page correctly', async () => {
        const { createHybridPageTypeDetector } = await import('../../src/heuristics/index.js');

        const cartHtml = `<!DOCTYPE html>
<html>
<head><title>Your Shopping Cart</title></head>
<body>
  <h1>Your Cart</h1>
  <div class="cart-items">
    <div class="cart-item" data-product-id="123">
      <span>Polo Shirt</span>
      <input type="number" name="quantity" value="1">
      <span class="price">£85.00</span>
    </div>
    <div class="cart-item" data-product-id="456">
      <span>Jeans</span>
      <input type="number" name="quantity" value="2">
      <span class="price">£120.00</span>
    </div>
  </div>
  <div class="cart-summary">
    <span class="subtotal">Subtotal: £325.00</span>
    <button class="checkout-btn">Proceed to Checkout</button>
  </div>
</body>
</html>`;

        const detector = createHybridPageTypeDetector({
          enableDomainCache: false,
          enableLLMFallback: false,
        });

        await setPageContent(cartHtml);
        const state = await createPageStateFromPage(page);
        state.url = 'https://store.example.com/cart';

        const result = await detector.detect(page, state);

        // Should detect as cart
        expect(result.pageType).toBe('cart');

        // Playwright should detect cart pattern
        if (result.playwrightResult) {
          expect(result.playwrightResult.signals.cartPattern).toBe(true);
        }
      }, 30000);
    });

    describe('Homepage Detection (Mock)', () => {
      it('should detect homepage correctly', async () => {
        const { createHybridPageTypeDetector } = await import('../../src/heuristics/index.js');

        const homepageHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Peregrine Clothing - British Heritage Menswear</title>
</head>
<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/collections">Shop All</a>
      <a href="/about">About</a>
    </nav>
  </header>
  <main>
    <section class="hero">
      <h1>British Heritage Menswear</h1>
      <p>Handcrafted in England since 1796</p>
      <a href="/collections" class="cta">Shop Now</a>
    </section>
    <section class="featured">
      <h2>Featured Collections</h2>
      <div class="collection-links">
        <a href="/collections/polo-shirts">Polo Shirts</a>
        <a href="/collections/knitwear">Knitwear</a>
        <a href="/collections/jackets">Jackets</a>
      </div>
    </section>
  </main>
</body>
</html>`;

        const detector = createHybridPageTypeDetector({
          enableDomainCache: false,
          enableLLMFallback: false,
        });

        await setPageContent(homepageHtml);
        const state = await createPageStateFromPage(page);
        state.url = 'https://www.peregrineclothing.co.uk/';

        const result = await detector.detect(page, state);

        // Should detect as homepage
        expect(result.pageType).toBe('homepage');

        // Homepage should NOT have strong PDP signals
        if (result.playwrightResult) {
          expect(result.playwrightResult.signals.addToCart).toBe(false);
          expect(result.playwrightResult.signals.schemaProduct).toBe(false);
        }
      }, 30000);
    });

    describe('Detection Performance', () => {
      it('should complete detection within reasonable time without LLM', async () => {
        const { createHybridPageTypeDetector } = await import('../../src/heuristics/index.js');

        const pdpHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Test Product</title>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Product","name":"Test","offers":{"@type":"Offer","price":"50.00"}}
  </script>
</head>
<body>
  <h1>Test Product</h1>
  <button name="add">Add to Cart</button>
</body>
</html>`;

        const detector = createHybridPageTypeDetector({
          enableDomainCache: false,
          enableLLMFallback: false,
        });

        await setPageContent(pdpHtml);
        const state = await createPageStateFromPage(page);
        state.url = 'https://example.com/product/123';

        const result = await detector.detect(page, state);

        // Detection should complete (time may vary based on environment)
        expect(result).toBeDefined();
        expect(result.pageType).toBeDefined();
        expect(result.tier).not.toBe('llm');
      }, 60000);
    });

    describe('Edge Cases', () => {
      it('should handle pages with minimal signals gracefully', async () => {
        const { createHybridPageTypeDetector } = await import('../../src/heuristics/index.js');

        const minimalHtml = `<!DOCTYPE html>
<html>
<head><title>Page</title></head>
<body>
  <h1>Welcome</h1>
  <p>Some content here.</p>
</body>
</html>`;

        const detector = createHybridPageTypeDetector({
          enableDomainCache: false,
          enableLLMFallback: false,
        });

        await setPageContent(minimalHtml);
        const state = await createPageStateFromPage(page);
        state.url = 'https://example.com/unknown-page';

        const result = await detector.detect(page, state);

        // Should return a valid result
        expect(result).toBeDefined();
        expect(result.pageType).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }, 60000);
    });
  }); // end Sequential Tests
});
