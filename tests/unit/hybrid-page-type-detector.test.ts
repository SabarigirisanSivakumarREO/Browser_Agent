/**
 * Tests for HybridPageTypeDetector - Phase 24 (T469)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PageState } from '../../src/models/index.js';

// Mock Playwright Page
const mockPage = {
  evaluate: vi.fn(),
  evaluateHandle: vi.fn(),
  locator: vi.fn().mockReturnValue({
    count: vi.fn().mockResolvedValue(0),
    first: vi.fn().mockReturnValue({
      isVisible: vi.fn().mockResolvedValue(false),
      isDisabled: vi.fn().mockResolvedValue(false),
    }),
    nth: vi.fn().mockReturnValue({
      isVisible: vi.fn().mockResolvedValue(false),
      innerText: vi.fn().mockResolvedValue(''),
    }),
    getAttribute: vi.fn().mockResolvedValue(null),
  }),
  viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
  screenshot: vi.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
};

// Mock page state
const mockPageState: PageState = {
  url: 'https://example.com/product/123',
  title: 'Example Product',
  domTree: {
    root: {
      tagName: 'html',
      attributes: {},
      children: [],
    },
    elementCount: 10,
    tokenCount: 100,
  },
  viewport: {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    isMobile: false,
  },
  scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 0 },
  timestamp: Date.now(),
};

describe('HybridPageTypeDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset evaluate mock for JSON-LD
    mockPage.evaluate.mockResolvedValue([]);
    mockPage.evaluateHandle.mockResolvedValue({
      jsonValue: vi.fn().mockResolvedValue([]),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create detector with default config', async () => {
      const { createHybridPageTypeDetector } = await import(
        '../../src/heuristics/hybrid-page-type-detector.js'
      );

      const detector = createHybridPageTypeDetector();
      const config = detector.getConfig();

      expect(config.enablePlaywrightDetection).toBe(true);
      expect(config.playwrightConfidenceThreshold).toBe(0.7);
      expect(config.enableHeuristicDetection).toBe(true);
      expect(config.enableLLMFallback).toBe(true);
      expect(config.llmFallbackThreshold).toBe(0.5);
      expect(config.enableDomainCache).toBe(true);
      expect(config.forceLLMDetection).toBe(false);
    });

    it('should create detector with custom config', async () => {
      const { createHybridPageTypeDetector } = await import(
        '../../src/heuristics/hybrid-page-type-detector.js'
      );

      const detector = createHybridPageTypeDetector({
        playwrightConfidenceThreshold: 0.8,
        enableLLMFallback: false,
        llmFallbackThreshold: 0.6,
      });

      const config = detector.getConfig();
      expect(config.playwrightConfidenceThreshold).toBe(0.8);
      expect(config.enableLLMFallback).toBe(false);
      expect(config.llmFallbackThreshold).toBe(0.6);
    });
  });

  describe('setConfig', () => {
    it('should update configuration', async () => {
      const { createHybridPageTypeDetector } = await import(
        '../../src/heuristics/hybrid-page-type-detector.js'
      );

      const detector = createHybridPageTypeDetector();
      expect(detector.getConfig().enableLLMFallback).toBe(true);

      detector.setConfig({ enableLLMFallback: false });
      expect(detector.getConfig().enableLLMFallback).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear domain cache', async () => {
      const { createHybridPageTypeDetector } = await import(
        '../../src/heuristics/hybrid-page-type-detector.js'
      );

      const detector = createHybridPageTypeDetector();
      detector.clearCache();

      const stats = detector.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const { createHybridPageTypeDetector } = await import(
        '../../src/heuristics/hybrid-page-type-detector.js'
      );

      const detector = createHybridPageTypeDetector();
      const stats = detector.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('domains');
      expect(stats.size).toBe(0);
      expect(Array.isArray(stats.domains)).toBe(true);
    });
  });

  describe('HybridDetectionConfig', () => {
    it('should have all configuration options', async () => {
      type ConfigType = import('../../src/heuristics/hybrid-page-type-detector.js').HybridDetectionConfig;

      const config: ConfigType = {
        enablePlaywrightDetection: true,
        playwrightConfidenceThreshold: 0.7,
        enableHeuristicDetection: true,
        enableLLMFallback: true,
        llmFallbackThreshold: 0.5,
        llmDetectionTimeout: 10000,
        enableDomainCache: true,
        forceLLMDetection: false,
        llmModel: 'gpt-4o-mini',
      };

      expect(config.enablePlaywrightDetection).toBe(true);
      expect(config.llmModel).toBe('gpt-4o-mini');
    });
  });

  describe('HybridDetectionResult', () => {
    it('should have correct structure', async () => {
      type ResultType = import('../../src/heuristics/hybrid-page-type-detector.js').HybridDetectionResult;

      const result: ResultType = {
        pageType: 'pdp',
        confidence: 0.85,
        tier: 'playwright',
        signals: ['JSON-LD Product', 'Add to Cart CTA'],
        detectionTimeMs: 150,
        fromCache: false,
      };

      expect(result.pageType).toBe('pdp');
      expect(result.tier).toBe('playwright');
      expect(result.signals).toHaveLength(2);
      expect(result.fromCache).toBe(false);
    });

    it('should support optional Playwright result', async () => {
      type ResultType = import('../../src/heuristics/hybrid-page-type-detector.js').HybridDetectionResult;
      type PlaywrightResultType = import('../../src/heuristics/playwright-page-detector.js').PlaywrightDetectionResult;

      const playwrightResult: PlaywrightResultType = {
        pageType: 'pdp',
        confidence: 0.9,
        score: 75,
        signals: {
          addToCart: true,
          buyNow: false,
          schemaProduct: true,
          priceFound: true,
          variants: true,
          mediaGallery: true,
          plpGrid: false,
          cartPattern: false,
          checkoutPattern: false,
        },
        evidence: {
          title: 'Test Product',
          price: { amount: 99.99, currency: 'USD' },
        },
        tier: 'playwright',
      };

      const result: ResultType = {
        pageType: 'pdp',
        confidence: 0.9,
        tier: 'playwright',
        signals: ['Playwright: pdp (90%)'],
        detectionTimeMs: 100,
        fromCache: false,
        playwrightResult,
      };

      expect(result.playwrightResult).toBeDefined();
      expect(result.playwrightResult?.signals.addToCart).toBe(true);
    });

    it('should support cache result', async () => {
      type ResultType = import('../../src/heuristics/hybrid-page-type-detector.js').HybridDetectionResult;

      const result: ResultType = {
        pageType: 'pdp',
        confidence: 0.85,
        tier: 'cache',
        signals: ['Cache hit for domain'],
        detectionTimeMs: 1,
        fromCache: true,
      };

      expect(result.tier).toBe('cache');
      expect(result.fromCache).toBe(true);
    });
  });

  describe('tier values', () => {
    it('should support all tier types', async () => {
      type ResultType = import('../../src/heuristics/hybrid-page-type-detector.js').HybridDetectionResult;

      const tiers: ResultType['tier'][] = ['cache', 'playwright', 'heuristic', 'combined', 'llm'];

      for (const tier of tiers) {
        const result: ResultType = {
          pageType: 'pdp',
          confidence: 0.8,
          tier,
          signals: [],
          detectionTimeMs: 100,
          fromCache: tier === 'cache',
        };
        expect(result.tier).toBe(tier);
      }
    });
  });
});

describe('HybridPageTypeDetector Factory', () => {
  it('should export createHybridPageTypeDetector function', async () => {
    const { createHybridPageTypeDetector } = await import(
      '../../src/heuristics/hybrid-page-type-detector.js'
    );

    expect(createHybridPageTypeDetector).toBeDefined();
    expect(typeof createHybridPageTypeDetector).toBe('function');
  });

  it('should export HybridPageTypeDetector class', async () => {
    const { HybridPageTypeDetector } = await import(
      '../../src/heuristics/hybrid-page-type-detector.js'
    );

    expect(HybridPageTypeDetector).toBeDefined();
  });
});
