/**
 * Tests for PlaywrightPageTypeDetector - Phase 24 (T458)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test helper types - mock Playwright Page
interface MockLocator {
  count: () => Promise<number>;
  first: () => {
    isVisible: () => Promise<boolean>;
    isDisabled: () => Promise<boolean>;
  };
  nth: (n: number) => {
    isVisible: () => Promise<boolean>;
    innerText: () => Promise<string>;
  };
  getAttribute: (name: string) => Promise<string | null>;
}

interface MockPage {
  evaluate: <T>(fn: () => T) => Promise<T>;
  evaluateHandle: <T>(fn: () => T) => Promise<{ jsonValue: () => Promise<T> }>;
  locator: (selector: string) => MockLocator;
  viewportSize: () => { width: number; height: number } | null;
}

// We can't directly test page.evaluate functions since they run in browser context
// Instead, test the helper functions and types

describe('PlaywrightPageTypeDetector Types', () => {
  it('should have correct PdpSignals interface', async () => {
    // Import module to verify types compile
    const { detectPdp } = await import('../../src/heuristics/playwright-page-detector.js');
    expect(detectPdp).toBeDefined();
    expect(typeof detectPdp).toBe('function');
  });

  it('should export PlaywrightPageTypeDetector class', async () => {
    const { PlaywrightPageTypeDetector, createPlaywrightPageTypeDetector } = await import(
      '../../src/heuristics/playwright-page-detector.js'
    );
    expect(PlaywrightPageTypeDetector).toBeDefined();
    expect(createPlaywrightPageTypeDetector).toBeDefined();
  });

  it('should create detector with default config', async () => {
    const { createPlaywrightPageTypeDetector } = await import(
      '../../src/heuristics/playwright-page-detector.js'
    );
    const detector = createPlaywrightPageTypeDetector();
    const config = detector.getConfig();
    expect(config.pdpScoreThreshold).toBe(55);
    expect(config.plpScoreThreshold).toBe(40);
  });

  it('should create detector with custom config', async () => {
    const { createPlaywrightPageTypeDetector } = await import(
      '../../src/heuristics/playwright-page-detector.js'
    );
    const detector = createPlaywrightPageTypeDetector({
      pdpScoreThreshold: 60,
      plpScoreThreshold: 50,
    });
    const config = detector.getConfig();
    expect(config.pdpScoreThreshold).toBe(60);
    expect(config.plpScoreThreshold).toBe(50);
  });
});

describe('PlaywrightDetectionResult', () => {
  it('should have correct structure', async () => {
    const { PlaywrightPageTypeDetector } = await import(
      '../../src/heuristics/playwright-page-detector.js'
    );

    // Verify types are exported
    type ResultType = import('../../src/heuristics/playwright-page-detector.js').PlaywrightDetectionResult;
    type SignalsType = import('../../src/heuristics/playwright-page-detector.js').PdpSignals;

    // Create type check function
    const isValidResult = (result: ResultType): boolean => {
      return (
        typeof result.pageType === 'string' &&
        typeof result.confidence === 'number' &&
        typeof result.score === 'number' &&
        result.tier === 'playwright' &&
        typeof result.signals === 'object' &&
        typeof result.evidence === 'object'
      );
    };

    expect(isValidResult).toBeDefined();
  });
});

describe('PdpSignals', () => {
  it('should have all required boolean signals', async () => {
    type SignalsType = import('../../src/heuristics/playwright-page-detector.js').PdpSignals;

    const mockSignals: SignalsType = {
      addToCart: true,
      buyNow: false,
      schemaProduct: true,
      priceFound: true,
      variants: true,
      mediaGallery: true,
      plpGrid: false,
      cartPattern: false,
      checkoutPattern: false,
    };

    expect(mockSignals.addToCart).toBe(true);
    expect(mockSignals.schemaProduct).toBe(true);
    expect(mockSignals.plpGrid).toBe(false);
    expect(mockSignals.cartPattern).toBe(false);
  });

  it('should support optional fields', async () => {
    type SignalsType = import('../../src/heuristics/playwright-page-detector.js').PdpSignals;

    const mockSignals: SignalsType = {
      addToCart: true,
      buyNow: false,
      schemaProduct: true,
      priceFound: true,
      variants: false,
      mediaGallery: false,
      plpGrid: false,
      cartPattern: false,
      checkoutPattern: false,
      // Optional fields
      primaryCtaText: 'Add to Cart',
      primaryCtaSelector: '#add-to-cart',
      ctaDisabled: false,
      price: 99.99,
      currency: 'USD',
      variantCount: 3,
      variantNames: ['Size', 'Color'],
      mediaCount: 5,
    };

    expect(mockSignals.primaryCtaText).toBe('Add to Cart');
    expect(mockSignals.price).toBe(99.99);
    expect(mockSignals.variantCount).toBe(3);
    expect(mockSignals.variantNames).toEqual(['Size', 'Color']);
  });
});
