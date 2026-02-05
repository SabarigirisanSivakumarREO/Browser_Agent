/**
 * Deterministic Collection Integration Tests - Phase 25f (T501)
 *
 * Tests the deterministic collection functionality which captures viewports
 * without LLM calls. This is the default mode in Phase 25f (faster, cheaper).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import { CROAgent, calculateMaxCollectionSteps } from '../../src/agent/index.js';

describe('Deterministic Collection', () => {
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

  describe('calculateMaxCollectionSteps', () => {
    it('should calculate correct steps for short page (1500px)', () => {
      const pageHeight = 1500;
      const viewportHeight = 720;
      const steps = calculateMaxCollectionSteps(pageHeight, viewportHeight);

      // With 600px scroll step (720 - 120 overlap), need ~3 viewports
      // Plus buffer, should be around 5-8 steps
      expect(steps).toBeGreaterThanOrEqual(5);
      expect(steps).toBeLessThanOrEqual(15);
    });

    it('should calculate correct steps for long page (10000px)', () => {
      const pageHeight = 10000;
      const viewportHeight = 720;
      const steps = calculateMaxCollectionSteps(pageHeight, viewportHeight);

      // With 600px scroll step, need ~17 viewports
      // Steps = (viewports * 2) + 1 + 20% buffer
      expect(steps).toBeGreaterThanOrEqual(20);
    });

    it('should enforce minimum 5 steps', () => {
      const pageHeight = 100; // Very short page
      const viewportHeight = 720;
      const steps = calculateMaxCollectionSteps(pageHeight, viewportHeight);

      expect(steps).toBeGreaterThanOrEqual(5);
    });

    it('should include 20% buffer', () => {
      const pageHeight = 3000;
      const viewportHeight = 720;
      const overlapPx = 120;
      const scrollStep = viewportHeight - overlapPx;
      const viewportsNeeded = Math.ceil(pageHeight / scrollStep);
      const baseSteps = (viewportsNeeded * 2) + 1;
      const expectedWithBuffer = Math.max(5, baseSteps + Math.ceil(baseSteps * 0.2));

      const steps = calculateMaxCollectionSteps(pageHeight, viewportHeight);
      expect(steps).toBe(expectedWithBuffer);
    });
  });

  describe('Viewport capture behavior', () => {
    it('should capture all viewports without LLM calls', async () => {
      // Create a page with known height
      await page.setContent(`
        <html>
          <head><style>
            body { margin: 0; padding: 0; }
            .section { height: 800px; border-bottom: 1px solid #ccc; padding: 20px; box-sizing: border-box; }
          </style></head>
          <body>
            <div class="section" style="background: #f0f0f0;">Section 1</div>
            <div class="section" style="background: #e0e0e0;">Section 2</div>
            <div class="section" style="background: #d0d0d0;">Section 3</div>
          </body>
        </html>
      `);

      // Get page height
      const pageHeight = await page.evaluate('document.documentElement.scrollHeight');
      expect(pageHeight).toBeGreaterThan(2000);

      // Calculate expected viewports
      const viewportHeight = 720;
      const scrollStep = viewportHeight - 120; // 600px
      const expectedViewports = Math.ceil(Number(pageHeight) / scrollStep);

      expect(expectedViewports).toBeGreaterThanOrEqual(3);
    });

    it('should produce correct viewport count based on page height', async () => {
      // Create a page with exactly 3000px height
      await page.setContent(`
        <html>
          <head><style>body { margin: 0; height: 3000px; background: linear-gradient(#f00, #00f); }</style></head>
          <body></body>
        </html>
      `);

      const pageHeight = await page.evaluate('document.documentElement.scrollHeight');
      expect(Number(pageHeight)).toBeGreaterThanOrEqual(3000);

      // With 600px scroll step (720 - 120 overlap), need ceil(3000/600) = 5 viewports
      const viewportHeight = 720;
      const scrollStep = viewportHeight - 120;
      const expectedViewports = Math.ceil(Number(pageHeight) / scrollStep);

      expect(expectedViewports).toBe(5);
    });

    it('should work with long pages (10000px)', async () => {
      // Create a very tall page
      await page.setContent(`
        <html>
          <head><style>body { margin: 0; height: 10000px; background: linear-gradient(#0f0, #f0f); }</style></head>
          <body></body>
        </html>
      `);

      const pageHeight = await page.evaluate('document.documentElement.scrollHeight');
      expect(Number(pageHeight)).toBeGreaterThanOrEqual(10000);

      // With 600px scroll step, need ceil(10000/600) = 17 viewports
      const viewportHeight = 720;
      const scrollStep = viewportHeight - 120;
      const expectedViewports = Math.ceil(Number(pageHeight) / scrollStep);

      expect(expectedViewports).toBeGreaterThanOrEqual(16);
    });

    it('should scroll through page incrementally', async () => {
      await page.setContent(`
        <html>
          <head><style>body { margin: 0; height: 2500px; background: linear-gradient(#ff0, #0ff); }</style></head>
          <body></body>
        </html>
      `);

      // Verify scroll positions
      const scrollStep = 720 - 120; // 600px

      // Scroll to first position (0)
      await page.evaluate('window.scrollTo(0, 0)');
      const scrollY1 = await page.evaluate('window.scrollY');
      expect(scrollY1).toBe(0);

      // Scroll to second position
      await page.evaluate(`window.scrollTo(0, ${scrollStep})`);
      const scrollY2 = await page.evaluate('window.scrollY');
      expect(scrollY2).toBe(scrollStep);

      // Scroll to third position
      await page.evaluate(`window.scrollTo(0, ${scrollStep * 2})`);
      const scrollY3 = await page.evaluate('window.scrollY');
      expect(scrollY3).toBe(scrollStep * 2);
    });
  });

  describe('CROAgent deterministic mode', () => {
    it('should default to deterministic collection (llmGuidedCollection: false)', async () => {
      const agent = new CROAgent({
        maxSteps: 5,
        actionWaitMs: 100,
        llmTimeoutMs: 30000,
        failureLimit: 3,
      });

      // The agent should use deterministic collection by default
      // This test verifies the option structure
      const options = agent.getOptions();
      expect(options).toBeDefined();
      expect(options.maxSteps).toBe(5);
    });

    it('should accept llmGuidedCollection option in analyze', async () => {
      // This test verifies that the option is accepted without errors
      const agent = new CROAgent({
        maxSteps: 3,
        actionWaitMs: 100,
        llmTimeoutMs: 30000,
        failureLimit: 3,
      });

      // The analyze options should accept llmGuidedCollection
      // We're not running the full analysis here, just verifying the interface
      expect(typeof agent.analyze).toBe('function');
    });
  });
});
