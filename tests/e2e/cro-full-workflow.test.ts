/**
 * CRO Full Workflow E2E Tests - Phase 18-CLI (T121)
 *
 * Tests the complete CRO analysis workflow including:
 * - Full analysis with report generation
 * - Markdown output format
 * - JSON output format
 * - File writing functionality
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { CROAgent, type CROAnalysisResult } from '../../src/agent/index.js';
import { MarkdownReporter } from '../../src/output/markdown-reporter.js';
import { JSONExporter } from '../../src/output/json-exporter.js';
import { FileWriter } from '../../src/output/file-writer.js';
import { BusinessTypeDetector } from '../../src/heuristics/business-type-detector.js';
import { ScoreCalculator } from '../../src/agent/score-calculator.js';
import type { PageState, CROInsight } from '../../src/models/index.js';

// Skip E2E tests in CI environments unless explicitly enabled
const skipE2E = process.env.CI === 'true' && !process.env.RUN_E2E_TESTS;

// Test HTML - well-optimized ecommerce page
const GOOD_ECOMMERCE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Premium Electronics Store - Best Deals Online</title>
</head>
<body>
  <header>
    <nav role="navigation" aria-label="Main navigation">
      <a href="/">Home</a>
      <a href="/products">Products</a>
      <a href="/cart">Cart</a>
      <input type="search" placeholder="Search products..." aria-label="Search">
    </nav>
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a> &gt; <a href="/electronics">Electronics</a> &gt; Phones
    </nav>
  </header>
  <main>
    <section class="hero">
      <h1>Save 50% on Premium Smartphones</h1>
      <p class="subheadline">Limited time offer on top-rated devices</p>
      <button class="btn-primary cta">Shop Now - Free Shipping</button>
    </section>
    <section class="trust-signals">
      <img src="ssl-badge.png" alt="SSL Secure" class="security-badge">
      <div class="rating">★★★★★ 4.9/5 (2,847 reviews)</div>
      <p class="guarantee">30-Day Money Back Guarantee</p>
    </section>
    <section class="products">
      <div class="product">
        <h2>iPhone 15 Pro</h2>
        <button class="add-to-cart cta">Add to Cart - $999</button>
      </div>
    </section>
    <form class="newsletter" aria-label="Newsletter signup">
      <label for="email">Get exclusive deals:</label>
      <input type="email" id="email" placeholder="your@email.com" required>
      <button type="submit" class="cta">Subscribe</button>
    </form>
  </main>
</body>
</html>`;

// Test HTML - poorly optimized page
const BAD_ECOMMERCE_HTML = `<!DOCTYPE html>
<html>
<head><title>Page</title></head>
<body>
  <h1>Welcome</h1>
  <p>Scroll down to see our products.</p>
  <div style="height: 2000px;"></div>
  <form>
    <input type="text">
    <input type="text">
    <input type="text">
    <input type="text">
    <input type="text">
    <input type="text">
    <input type="text">
    <button>Submit</button>
  </form>
  <button>Click Here</button>
  <button>Learn More</button>
</body>
</html>`;

describe.skipIf(skipE2E)('CRO Full Workflow E2E', () => {
  let browser: Browser;
  let page: Page;
  let tempDir: string;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    // Create temp directory for test files
    tempDir = join(tmpdir(), `cro-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    await browser?.close();
    // Clean up temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Full Analysis with Report', () => {
    it('should complete analysis and generate all output formats', async () => {
      // Setup page with test content
      const context = await browser.newContext();
      page = await context.newPage();
      await page.setContent(GOOD_ECOMMERCE_HTML);

      // Create mock PageState from DOM
      const mockPageState: PageState = {
        url: 'https://example-store.com/electronics/phones',
        title: 'Premium Electronics Store - Best Deals Online',
        domTree: {
          root: {
            tagName: 'body',
            xpath: '/html/body',
            text: '',
            isInteractive: false,
            isVisible: true,
            croType: null,
            children: [
              {
                tagName: 'nav',
                xpath: '/html/body/header/nav',
                text: '',
                isInteractive: false,
                isVisible: true,
                croType: 'navigation',
                attributes: { role: 'navigation' },
                children: [],
              },
              {
                tagName: 'button',
                xpath: '/html/body/main/section[1]/button',
                text: 'Shop Now - Free Shipping',
                isInteractive: true,
                isVisible: true,
                croType: 'cta',
                boundingBox: { x: 100, y: 200, width: 200, height: 40 },
                children: [],
              },
              {
                tagName: 'h1',
                xpath: '/html/body/main/section[1]/h1',
                text: 'Save 50% on Premium Smartphones',
                isInteractive: false,
                isVisible: true,
                croType: 'value_prop',
                children: [],
              },
              {
                tagName: 'img',
                xpath: '/html/body/main/section[2]/img',
                text: 'SSL Secure',
                isInteractive: false,
                isVisible: true,
                croType: 'trust',
                boundingBox: { x: 50, y: 300, width: 100, height: 50 },
                attributes: { class: 'security-badge' },
                children: [],
              },
              {
                tagName: 'input',
                xpath: '/html/body/header/nav/input',
                text: '',
                isInteractive: true,
                isVisible: true,
                croType: 'navigation',
                attributes: { type: 'search' },
                children: [],
              },
            ],
          },
          interactiveCount: 5,
          croElementCount: 5,
        },
        viewport: { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false },
        scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 1000 },
        timestamp: Date.now(),
      };

      // Run business type detection
      const businessTypeDetector = new BusinessTypeDetector();
      const businessType = businessTypeDetector.detect(mockPageState);

      expect(businessType.type).toBe('ecommerce');
      expect(businessType.confidence).toBeGreaterThan(0.5);

      // NOTE: Heuristic rules removed in CR-002, using mock insights for test
      const mockInsights: CROInsight[] = [];

      // Calculate scores
      const scoreCalculator = new ScoreCalculator();
      const scores = scoreCalculator.calculateScores(mockInsights);

      expect(scores.overall).toBeGreaterThanOrEqual(0);
      expect(scores.overall).toBeLessThanOrEqual(100);

      // Generate markdown report
      const reporter = new MarkdownReporter();
      const markdown = reporter.generate({
        url: mockPageState.url,
        pageTitle: mockPageState.title,
        insights: mockInsights,
        heuristicInsights: [],
        businessType,
        hypotheses: [],
        scores,
      });

      expect(markdown).toContain('# CRO Analysis Report');
      expect(markdown).toContain('## Executive Summary');
      expect(markdown).toContain('## Recommended A/B Tests');
      expect(markdown).toContain(mockPageState.url);

      // Generate JSON export
      const exporter = new JSONExporter();
      const json = exporter.export({
        url: mockPageState.url,
        pageTitle: mockPageState.title,
        insights: mockInsights,
        heuristicInsights: [],
        businessType,
        hypotheses: [],
        scores,
      });

      const parsed = JSON.parse(json);
      expect(parsed.url).toBe(mockPageState.url);
      expect(parsed.scores).toBeDefined();
      expect(parsed.businessType).toBeDefined();

      await context.close();
    }, 30000);
  });

  describe('Markdown Output', () => {
    it('should generate valid markdown report with all sections', async () => {
      const reporter = new MarkdownReporter();
      const result = {
        url: 'https://test.com',
        pageTitle: 'Test Page',
        insights: [
          {
            id: 'test-1',
            type: 'vague_cta_text',
            severity: 'medium' as const,
            category: 'cta' as const,
            element: '/button',
            issue: 'Button uses vague text "Click Here"',
            recommendation: 'Use specific action-oriented text',
          },
        ],
        heuristicInsights: [],
        businessType: { type: 'ecommerce' as const, confidence: 0.8, signals: [] },
        hypotheses: [
          {
            id: 'hyp-1',
            title: 'Improve CTA Text',
            hypothesis: 'Specific CTA text will increase clicks',
            controlDescription: 'Current "Click Here" button',
            treatmentDescription: 'New "Shop Now" button',
            primaryMetric: 'CTR',
            expectedImpact: 'high' as const,
            priority: 8,
            relatedInsights: ['test-1'],
          },
        ],
        scores: {
          overall: 85,
          byCategory: { cta: 85 },
          criticalCount: 0,
          highCount: 0,
          mediumCount: 1,
          lowCount: 0,
        },
      };

      const markdown = reporter.generate(result);

      // Check all sections present
      expect(markdown).toContain('# CRO Analysis Report');
      expect(markdown).toContain('## Executive Summary');
      expect(markdown).toContain('## Critical Issues');
      expect(markdown).toContain('## High Priority Issues');
      expect(markdown).toContain('## Medium Priority Issues');
      expect(markdown).toContain('## Low Priority Issues');
      expect(markdown).toContain('## Recommended A/B Tests');

      // Check content
      expect(markdown).toContain('https://test.com');
      expect(markdown).toContain('85/100');
      expect(markdown).toContain('vague');
    });
  });

  describe('JSON Output', () => {
    it('should generate valid parseable JSON with all fields', () => {
      const exporter = new JSONExporter();
      const result = {
        url: 'https://json-test.com',
        pageTitle: 'JSON Test',
        insights: [
          {
            id: 'json-insight-1',
            type: 'no_trust_above_fold',
            severity: 'high' as const,
            category: 'trust' as const,
            element: null,
            issue: 'No trust signals visible',
            recommendation: 'Add trust badges above the fold',
          },
        ],
        heuristicInsights: [],
        scores: {
          overall: 70,
          byCategory: { trust: 70 },
          criticalCount: 0,
          highCount: 1,
          mediumCount: 0,
          lowCount: 0,
        },
      };

      const json = exporter.export(result);

      // Verify parseable
      const parsed = JSON.parse(json);

      expect(parsed.url).toBe('https://json-test.com');
      expect(parsed.pageTitle).toBe('JSON Test');
      expect(parsed.insights).toHaveLength(1);
      expect(parsed.insights[0].type).toBe('no_trust_above_fold');
      expect(parsed.scores.overall).toBe(70);
      expect(parsed.scores.highCount).toBe(1);
    });
  });

  describe('File Writing', () => {
    it('should write markdown report to file', async () => {
      const writer = new FileWriter();
      const testContent = '# Test Report\n\nThis is a test.';
      const testPath = join(tempDir, 'test-report.md');

      const result = await writer.write(testContent, testPath);

      expect(result.success).toBe(true);
      expect(result.path).toBe(testPath);
      expect(result.overwrote).toBe(false);

      // Verify file content
      const content = await readFile(testPath, 'utf-8');
      expect(content).toBe(testContent);
    });

    it('should create directories if needed', async () => {
      const writer = new FileWriter();
      const testContent = '{"test": true}';
      const nestedPath = join(tempDir, 'nested', 'deep', 'test.json');

      const result = await writer.write(testContent, nestedPath);

      expect(result.success).toBe(true);

      const content = await readFile(nestedPath, 'utf-8');
      expect(content).toBe(testContent);
    });

    it('should handle overwrite with warning', async () => {
      const writer = new FileWriter({ warnOnOverwrite: true });
      const testPath = join(tempDir, 'overwrite-test.txt');

      // Write first time
      await writer.write('First content', testPath);

      // Write second time (overwrite)
      const result = await writer.write('Second content', testPath);

      expect(result.success).toBe(true);
      expect(result.overwrote).toBe(true);

      const content = await readFile(testPath, 'utf-8');
      expect(content).toBe('Second content');
    });

    it('should handle write errors gracefully', async () => {
      const writer = new FileWriter({ createDirectories: false });
      // Try to write to non-existent directory without creating it
      const invalidPath = join(tempDir, 'nonexistent-dir-xyz', 'file.txt');

      const result = await writer.write('test', invalidPath);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
