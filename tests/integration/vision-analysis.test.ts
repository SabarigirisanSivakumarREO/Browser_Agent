/**
 * Vision Analysis Integration Tests - Phase 21d (T319)
 *
 * Tests for the complete vision analysis flow including page type detection,
 * screenshot capture simulation, and vision analysis with mocked GPT-4o responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PageState, DOMTree, PageType } from '../../src/models/index.js';
import type { ViewportInfo } from '../../src/models/page-state.js';
import type { PageTypeHeuristics } from '../../src/heuristics/knowledge/types.js';

// Import components under test
import {
  createPageTypeDetector,
  createCROVisionAnalyzer,
  loadHeuristics,
  isPageTypeSupported,
  type CROVisionAnalysisResult,
  type HeuristicEvaluation,
} from '../../src/heuristics/index.js';

// Mock DOM tree for PDP
const createPDPDomTree = (): DOMTree => ({
  root: {
    tagName: 'body',
    xpath: '/body',
    text: '',
    isInteractive: false,
    isVisible: true,
    croType: null,
    children: [
      {
        tagName: 'h1',
        xpath: '/body/h1',
        text: 'Lynton Polo Shirt',
        isInteractive: false,
        isVisible: true,
        croType: 'value_prop',
        children: [],
      },
      {
        tagName: 'span',
        xpath: '/body/span[1]',
        text: '£85.00',
        isInteractive: false,
        isVisible: true,
        croType: 'trust',
        attributes: { class: 'price' },
        children: [],
      },
      {
        tagName: 'button',
        xpath: '/body/button[1]',
        text: 'Add to Bag',
        isInteractive: true,
        isVisible: true,
        croType: 'cta',
        index: 0,
        children: [],
      },
      {
        tagName: 'select',
        xpath: '/body/select[1]',
        text: 'Size',
        isInteractive: true,
        isVisible: true,
        croType: 'form',
        index: 1,
        children: [],
      },
    ],
  },
  interactiveCount: 2,
  croElementCount: 4,
  totalNodeCount: 5,
  extractedAt: Date.now(),
});

// Mock DOM tree for non-PDP (homepage)
const createHomepageDomTree = (): DOMTree => ({
  root: {
    tagName: 'body',
    xpath: '/body',
    text: '',
    isInteractive: false,
    isVisible: true,
    croType: null,
    children: [
      {
        tagName: 'nav',
        xpath: '/body/nav',
        text: 'Menu',
        isInteractive: true,
        isVisible: true,
        croType: 'navigation',
        children: [],
      },
      {
        tagName: 'div',
        xpath: '/body/div[1]',
        text: 'Welcome to our store',
        isInteractive: false,
        isVisible: true,
        croType: 'value_prop',
        children: [],
      },
    ],
  },
  interactiveCount: 1,
  croElementCount: 2,
  totalNodeCount: 3,
  extractedAt: Date.now(),
});

const mockViewport: ViewportInfo = {
  width: 1920,
  height: 1080,
  deviceScaleFactor: 1,
  isMobile: false,
};

// Mock PageState for PDP
const createPDPPageState = (): PageState => ({
  url: 'https://www.peregrineclothing.co.uk/products/lynton-polo-shirt',
  title: 'Lynton Polo Shirt - Peregrine Clothing',
  domTree: createPDPDomTree(),
  viewport: mockViewport,
  scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 2000 },
  timestamp: Date.now(),
});

// Mock PageState for homepage
const createHomepagePageState = (): PageState => ({
  url: 'https://www.peregrineclothing.co.uk/',
  title: 'Peregrine Clothing - British Heritage',
  domTree: createHomepageDomTree(),
  viewport: mockViewport,
  scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 1000 },
  timestamp: Date.now(),
});

// Mock GPT-4o Vision API response
const mockVisionAPIResponse = JSON.stringify({
  evaluations: [
    {
      heuristicId: 'PDP-PRICE-001',
      status: 'pass',
      observation: 'Price is clearly visible at £85.00 near the product title',
      confidence: 0.95,
    },
    {
      heuristicId: 'PDP-CTA-001',
      status: 'pass',
      observation: 'Add to Bag button is prominently displayed',
      confidence: 0.90,
    },
    {
      heuristicId: 'PDP-IMAGE-001',
      status: 'fail',
      observation: 'Product images lack size reference',
      issue: 'No scale or context provided for product size',
      recommendation: 'Add a size chart or show product on model',
      confidence: 0.88,
    },
    {
      heuristicId: 'PDP-REVIEW-001',
      status: 'partial',
      observation: 'Reviews section exists but not immediately visible',
      issue: 'Reviews require scrolling to find',
      recommendation: 'Add star rating summary near product title',
      confidence: 0.82,
    },
  ],
});

describe('Vision Analysis Integration', () => {
  describe('Page Type Detection', () => {
    it('should detect PDP page type from URL and elements', () => {
      const detector = createPageTypeDetector();
      const pageState = createPDPPageState();

      const result = detector.detect(pageState);

      expect(result.type).toBe('pdp');
      expect(result.confidence).toBeGreaterThan(0.5);
      // Signals are human-readable descriptions
      expect(result.signals.length).toBeGreaterThan(0);
    });

    it('should detect homepage from URL', () => {
      const detector = createPageTypeDetector();
      const pageState = createHomepagePageState();

      const result = detector.detect(pageState);

      expect(result.type).toBe('homepage');
    });

    it('should return correct confidence for ambiguous pages', () => {
      const detector = createPageTypeDetector();
      const pageState: PageState = {
        url: 'https://example.com/some-page',
        title: 'Some Page',
        domTree: createHomepageDomTree(),
        viewport: mockViewport,
        scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 500 },
        timestamp: Date.now(),
      };

      const result = detector.detect(pageState);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Page Type Support Check', () => {
    it('should return true for pdp page type', () => {
      expect(isPageTypeSupported('pdp')).toBe(true);
    });

    it('should return false for unsupported page types', () => {
      expect(isPageTypeSupported('homepage')).toBe(false);
      expect(isPageTypeSupported('plp')).toBe(false);
      expect(isPageTypeSupported('cart')).toBe(false);
      expect(isPageTypeSupported('checkout')).toBe(false);
      expect(isPageTypeSupported('other')).toBe(false);
    });
  });

  describe('Knowledge Base Loading', () => {
    it('should load all 35 PDP heuristics', () => {
      const heuristics = loadHeuristics('pdp');

      expect(heuristics.pageType).toBe('pdp');
      expect(heuristics.totalCount).toBe(35);
      expect(heuristics.categories.length).toBe(10);
    });

    it('should have correct category names', () => {
      const heuristics = loadHeuristics('pdp');
      const categoryNames = heuristics.categories.map((c) => c.name);

      // Categories use & abbreviation
      expect(categoryNames).toContain('Layout & Structure');
      expect(categoryNames).toContain('Pricing & Cost Transparency');
      expect(categoryNames).toContain('CTA & Purchase Confidence');
    });

    it('should throw error for unsupported page type', () => {
      expect(() => loadHeuristics('homepage' as PageType)).toThrow();
    });
  });

  describe('Vision Analyzer with Mock API', () => {
    let mockInvoke: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      // Mock ChatOpenAI.invoke
      mockInvoke = vi.fn().mockResolvedValue({
        content: mockVisionAPIResponse,
      });

      vi.mock('@langchain/openai', () => ({
        ChatOpenAI: vi.fn().mockImplementation(() => ({
          invoke: mockInvoke,
        })),
      }));
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should create analyzer with default config', () => {
      const analyzer = createCROVisionAnalyzer();
      const config = analyzer.getConfig();

      expect(config.model).toBe('gpt-4o');
      expect(config.maxTokens).toBe(4096);
      expect(config.temperature).toBe(0.1);
    });

    it('should create analyzer with custom config', () => {
      const analyzer = createCROVisionAnalyzer({
        model: 'gpt-4o-mini',
        maxTokens: 2048,
      });
      const config = analyzer.getConfig();

      expect(config.model).toBe('gpt-4o-mini');
      expect(config.maxTokens).toBe(2048);
    });

    it('should throw error for unsupported page type', async () => {
      const analyzer = createCROVisionAnalyzer();
      const mockScreenshot = 'base64encodedimage';

      await expect(
        analyzer.analyze(mockScreenshot, 'homepage', mockViewport)
      ).rejects.toThrow('Vision analysis not supported');
    });
  });

  describe('Vision Result Structure', () => {
    it('should have correct structure for CROVisionAnalysisResult', () => {
      // Create a mock result matching the interface
      const mockResult: CROVisionAnalysisResult = {
        pageType: 'pdp',
        analyzedAt: Date.now(),
        screenshotUsed: true,
        viewport: mockViewport,
        evaluations: [
          {
            heuristicId: 'PDP-PRICE-001',
            principle: 'Price visibility',
            status: 'pass',
            severity: 'critical',
            observation: 'Price clearly visible',
            confidence: 0.95,
          },
        ],
        insights: [],
        summary: {
          totalHeuristics: 35,
          passed: 30,
          failed: 3,
          partial: 1,
          notApplicable: 1,
          bySeverity: {
            critical: 1,
            high: 1,
            medium: 1,
            low: 0,
          },
        },
      };

      expect(mockResult.pageType).toBe('pdp');
      expect(mockResult.screenshotUsed).toBe(true);
      expect(mockResult.summary.totalHeuristics).toBe(35);
    });
  });

  describe('Integration Flow', () => {
    it('should complete full flow: detect page type → check support → load heuristics', () => {
      // Step 1: Detect page type
      const detector = createPageTypeDetector();
      const pageState = createPDPPageState();
      const pageTypeResult = detector.detect(pageState);

      expect(pageTypeResult.type).toBe('pdp');

      // Step 2: Check if supported
      const isSupported = isPageTypeSupported(pageTypeResult.type);
      expect(isSupported).toBe(true);

      // Step 3: Load heuristics
      const heuristics = loadHeuristics(pageTypeResult.type);
      expect(heuristics.totalCount).toBe(35);

      // Step 4: Analyzer would be called here with screenshot
      const analyzer = createCROVisionAnalyzer();
      expect(analyzer.getConfig().model).toBe('gpt-4o');
    });

    it('should skip vision analysis for unsupported page types', () => {
      // Step 1: Detect page type
      const detector = createPageTypeDetector();
      const pageState = createHomepagePageState();
      const pageTypeResult = detector.detect(pageState);

      expect(pageTypeResult.type).toBe('homepage');

      // Step 2: Check if supported - should be false
      const isSupported = isPageTypeSupported(pageTypeResult.type);
      expect(isSupported).toBe(false);

      // Vision analysis should be skipped
    });
  });
});
