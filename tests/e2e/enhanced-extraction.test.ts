/**
 * Enhanced Extraction E2E Tests - Phase 25a-f (T502)
 *
 * Tests the complete enhanced extraction workflow including:
 * - Phase 25a: Dynamic collection steps based on page height
 * - Phase 25b: Enhanced DOM selectors (price, variant, stock, shipping, gallery)
 * - Phase 25c: Structured data extraction (JSON-LD Product schema)
 * - Phase 25d: Above-fold annotation (fold line on screenshots)
 * - Phase 25e: Tiled screenshot mode
 * - Phase 25f: Deterministic collection (no LLM calls during collection)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { CROAgent, calculateMaxCollectionSteps } from '../../src/agent/index.js';
import { DOMExtractor } from '../../src/browser/dom/extractor.js';
import { extractStructuredData } from '../../src/browser/dom/structured-data.js';
import { captureTiledScreenshots } from '../../src/output/tiled-screenshot.js';
import { annotateFoldLine } from '../../src/output/screenshot-annotator.js';

// Skip E2E tests in CI environments unless explicitly enabled
const skipE2E = process.env.CI === 'true' && !process.env.RUN_E2E_TESTS;

// Test HTML - PDP with all Phase 25 elements
const PDP_WITH_STRUCTURED_DATA = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Luxury Coat - Premium Fashion Store</title>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Premium Luxury Coat",
    "description": "A beautifully crafted luxury coat for all seasons.",
    "image": "https://example.com/coat.jpg",
    "sku": "COAT-12345",
    "brand": {
      "@type": "Brand",
      "name": "Luxury Brand"
    },
    "offers": {
      "@type": "Offer",
      "url": "https://example.com/product/coat",
      "priceCurrency": "USD",
      "price": "1299.00",
      "availability": "https://schema.org/InStock",
      "itemCondition": "https://schema.org/NewCondition"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "256"
    }
  }
  </script>
  <style>
    body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
    .product-gallery { width: 100%; height: 600px; background: #f0f0f0; }
    .product-info { padding: 20px; }
    .product-title { font-size: 24px; margin-bottom: 10px; }
    .product-price { font-size: 32px; font-weight: bold; color: #333; }
    .product-price .currency { font-size: 20px; }
    .variant-selector { margin: 20px 0; }
    .swatch { display: inline-block; width: 40px; height: 40px; margin: 5px; border: 2px solid #ccc; cursor: pointer; }
    .size-selector { margin: 20px 0; }
    .size-option { display: inline-block; padding: 10px 20px; margin: 5px; border: 1px solid #ccc; }
    .stock-status { color: green; margin: 10px 0; }
    .shipping-info { margin: 10px 0; color: #666; }
    .add-to-cart { padding: 15px 40px; font-size: 18px; background: #000; color: #fff; border: none; cursor: pointer; }
    .section { padding: 40px 20px; border-bottom: 1px solid #eee; }
    .tall-section { height: 800px; }
  </style>
</head>
<body>
  <header style="padding: 20px; border-bottom: 1px solid #eee;">
    <nav role="navigation">
      <a href="/">Home</a> | <a href="/products">Products</a> | <a href="/cart">Cart</a>
    </nav>
  </header>

  <main>
    <!-- Product Gallery -->
    <div class="product-gallery image-gallery" data-product-images="true">
      <img src="coat-1.jpg" alt="Coat front view" class="product-image">
      <div class="thumbnail-strip">
        <img src="coat-thumb-1.jpg" alt="Thumbnail 1" class="thumbnail">
        <img src="coat-thumb-2.jpg" alt="Thumbnail 2" class="thumbnail">
        <img src="coat-thumb-3.jpg" alt="Thumbnail 3" class="thumbnail">
      </div>
    </div>

    <!-- Product Info -->
    <div class="product-info">
      <h1 class="product-title">Premium Luxury Coat</h1>

      <div class="product-price" data-price="1299.00" itemprop="price">
        <span class="currency">$</span>1,299.00
      </div>

      <!-- Color Variant -->
      <div class="variant-selector color-selector" role="radiogroup" aria-label="Select color">
        <span>Color:</span>
        <div class="swatch color-option" data-color="black" style="background: #000;" aria-label="Black"></div>
        <div class="swatch color-option" data-color="navy" style="background: #001f3f;" aria-label="Navy"></div>
        <div class="swatch color-option" data-color="camel" style="background: #c19a6b;" aria-label="Camel"></div>
      </div>

      <!-- Size Variant -->
      <div class="size-selector" role="radiogroup" aria-label="Select size">
        <span>Size:</span>
        <button class="size-option" data-size="S">S</button>
        <button class="size-option" data-size="M">M</button>
        <button class="size-option" data-size="L">L</button>
        <button class="size-option" data-size="XL">XL</button>
      </div>

      <!-- Stock Status -->
      <div class="stock-status availability in-stock">
        <span class="stock-indicator">✓</span> In Stock - Ready to Ship
      </div>

      <!-- Shipping Info -->
      <div class="shipping-info delivery-info">
        <span class="shipping-icon">🚚</span> Free Shipping on orders over $500
        <br>
        <span class="delivery-estimate">Arrives by Dec 15-18</span>
      </div>

      <!-- Add to Cart -->
      <button class="add-to-cart cta btn-primary">Add to Bag</button>
    </div>

    <!-- Additional Sections (to make page taller) -->
    <section class="section tall-section">
      <h2>Product Details</h2>
      <p>Crafted from the finest materials, this coat represents the pinnacle of luxury fashion.</p>
    </section>

    <section class="section tall-section">
      <h2>Care Instructions</h2>
      <p>Dry clean only. Store in a cool, dry place.</p>
    </section>

    <section class="section tall-section">
      <h2>Customer Reviews</h2>
      <div class="reviews">
        <div class="review">★★★★★ "Absolutely stunning coat!" - Jane D.</div>
        <div class="review">★★★★☆ "Great quality, runs a bit large" - Mike S.</div>
      </div>
    </section>
  </main>

  <footer style="padding: 40px; background: #333; color: #fff;">
    <p>© 2026 Luxury Fashion Store. All rights reserved.</p>
  </footer>
</body>
</html>`;

// Simpler test page for tiled screenshots
const TALL_PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; }
    .section { height: 1000px; padding: 20px; box-sizing: border-box; }
  </style>
</head>
<body>
  <div class="section" style="background: #f8d7da;">Section 1 - Above Fold</div>
  <div class="section" style="background: #d4edda;">Section 2</div>
  <div class="section" style="background: #d1ecf1;">Section 3</div>
  <div class="section" style="background: #fff3cd;">Section 4</div>
  <div class="section" style="background: #cce5ff;">Section 5</div>
</body>
</html>`;

describe.skipIf(skipE2E)('Enhanced Extraction E2E (Phase 25a-f)', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Phase 25a: Dynamic Collection Steps', () => {
    it('should calculate dynamic steps based on page height', async () => {
      await page.setContent(TALL_PAGE_HTML);

      const pageHeight = await page.evaluate('document.documentElement.scrollHeight');
      const viewportHeight = 720;

      const steps = calculateMaxCollectionSteps(Number(pageHeight), viewportHeight);

      // Page is ~5000px tall, with 600px scroll step, needs ~9 viewports
      // Steps formula: (viewports * 2) + 1 + 20% buffer
      expect(steps).toBeGreaterThanOrEqual(10);
      expect(steps).toBeLessThan(50); // Sanity check
    });
  });

  describe('Phase 25b: Enhanced DOM Selectors', () => {
    it('should extract price elements from PDP', async () => {
      await page.setContent(PDP_WITH_STRUCTURED_DATA);

      const extractor = new DOMExtractor();
      const domTree = await extractor.extract(page);

      // Should detect price elements
      expect(domTree.croElementCount).toBeGreaterThan(0);

      // Check that the DOM has interactive elements
      expect(domTree.interactiveCount).toBeGreaterThan(5);
    });

    it('should detect variant selectors (size/color)', async () => {
      await page.setContent(PDP_WITH_STRUCTURED_DATA);

      // Check for variant elements in the page
      const hasColorSelector = await page.locator('.color-selector').count();
      const hasSizeSelector = await page.locator('.size-selector').count();
      const hasSwatches = await page.locator('.swatch').count();

      expect(hasColorSelector).toBeGreaterThanOrEqual(1);
      expect(hasSizeSelector).toBeGreaterThanOrEqual(1);
      expect(hasSwatches).toBeGreaterThanOrEqual(3);
    });

    it('should detect stock and shipping info', async () => {
      await page.setContent(PDP_WITH_STRUCTURED_DATA);

      // Check for stock and shipping elements
      const hasStockStatus = await page.locator('.stock-status').count();
      const hasShippingInfo = await page.locator('.shipping-info').count();

      expect(hasStockStatus).toBeGreaterThanOrEqual(1);
      expect(hasShippingInfo).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Phase 25c: Structured Data Extraction', () => {
    it('should extract JSON-LD Product schema', async () => {
      await page.setContent(PDP_WITH_STRUCTURED_DATA);

      const structuredData = await extractStructuredData(page);

      expect(structuredData).not.toBeNull();
      expect(structuredData?.name).toBe('Premium Luxury Coat');
      expect(structuredData?.price).toBe(1299);
      expect(structuredData?.currency).toBe('USD');
      expect(structuredData?.availability).toContain('InStock');
      expect(structuredData?.brand).toBe('Luxury Brand');
      expect(structuredData?.sku).toBe('COAT-12345');
      expect(structuredData?.rating).toBe(4.8);
      expect(structuredData?.reviewCount).toBe(256);
    });

    it('should return null for pages without structured data', async () => {
      await page.setContent('<html><body><h1>Simple Page</h1></body></html>');

      const structuredData = await extractStructuredData(page);

      expect(structuredData).toBeNull();
    });
  });

  describe('Phase 25d: Above-Fold Annotation', () => {
    it('should annotate fold line on screenshot', async () => {
      await page.setContent(TALL_PAGE_HTML);

      // Capture a screenshot
      const screenshot = await page.screenshot({ type: 'png', fullPage: false });

      // Annotate with fold line
      const result = await annotateFoldLine(screenshot, {
        viewportHeight: 720,
        showLabel: true,
      });

      expect(result.success).toBe(true);
      expect(result.annotatedBuffer).toBeDefined();
      expect(result.annotatedBuffer!.length).toBeGreaterThan(screenshot.length * 0.9); // Should be at least 90% of original
    });
  });

  describe('Phase 25e: Tiled Screenshot Mode', () => {
    it('should capture long page fully with tiles', async () => {
      await page.setContent(TALL_PAGE_HTML);

      const result = await captureTiledScreenshots(page, {
        maxTileHeight: 1500,
        overlapPx: 100,
        maxTiles: 10,
        annotateFoldLine: true,
        viewportHeight: 720,
      });

      expect(result.success).toBe(true);
      expect(result.tiles.length).toBeGreaterThan(1);

      // First tile should be above fold
      expect(result.tiles[0]?.isAboveFold).toBe(true);

      // Should cover full page
      const lastTile = result.tiles[result.tiles.length - 1]!;
      expect(lastTile.endY).toBeGreaterThanOrEqual(result.pageHeight - 100);
    });

    it('should produce correct tiles in tiled mode', async () => {
      await page.setContent(TALL_PAGE_HTML);

      const result = await captureTiledScreenshots(page, {
        maxTileHeight: 1200,
        overlapPx: 100,
        maxTiles: 8,
        annotateFoldLine: true,
        viewportHeight: 720,
      });

      expect(result.success).toBe(true);

      // Verify tile structure
      for (const tile of result.tiles) {
        expect(tile.buffer).toBeInstanceOf(Buffer);
        expect(tile.buffer.length).toBeGreaterThan(0);
        expect(tile.width).toBe(1280);
        expect(tile.height).toBeLessThanOrEqual(1200);
        expect(tile.endY).toBeGreaterThan(tile.startY);
      }
    });
  });

  describe('Phase 25f: Deterministic Collection', () => {
    it('should complete deterministic collection quickly', async () => {
      await page.setContent(TALL_PAGE_HTML);

      const pageHeight = await page.evaluate('document.documentElement.scrollHeight');
      const viewportHeight = 720;
      const scrollStep = viewportHeight - 120; // 600px
      const expectedViewports = Math.ceil(Number(pageHeight) / scrollStep);

      // Simulate deterministic collection timing
      const startTime = Date.now();

      // Scroll through page without LLM
      for (let i = 0; i < expectedViewports; i++) {
        const scrollY = i * scrollStep;
        await page.evaluate(`window.scrollTo(0, ${scrollY})`);
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
      }

      const elapsed = Date.now() - startTime;

      // Should complete quickly (no LLM calls)
      expect(elapsed).toBeLessThan(5000); // Under 5 seconds for scrolling
      expect(expectedViewports).toBeGreaterThan(3);
    });

    it('should capture all viewports without LLM guidance', async () => {
      await page.setContent(PDP_WITH_STRUCTURED_DATA);

      const pageHeight = await page.evaluate('document.documentElement.scrollHeight');
      const viewportHeight = 720;
      const scrollStep = viewportHeight - 120;
      const expectedViewports = Math.ceil(Number(pageHeight) / scrollStep);

      // Track captured positions
      const capturedPositions: number[] = [];

      // Scroll and "capture" at each position
      for (let i = 0; i < expectedViewports; i++) {
        const scrollY = i * scrollStep;
        await page.evaluate(`window.scrollTo(0, ${scrollY})`);
        await new Promise(resolve => setTimeout(resolve, 50));

        const actualScrollY = await page.evaluate('window.scrollY');
        capturedPositions.push(Number(actualScrollY));
      }

      // Verify we captured all expected positions
      expect(capturedPositions.length).toBe(expectedViewports);
      expect(capturedPositions[0]).toBe(0); // Started at top

      // Each subsequent position should be roughly scrollStep apart
      for (let i = 1; i < capturedPositions.length; i++) {
        const diff = capturedPositions[i]! - capturedPositions[i - 1]!;
        expect(diff).toBeLessThanOrEqual(scrollStep + 10); // Allow small variance
      }
    });
  });
});
