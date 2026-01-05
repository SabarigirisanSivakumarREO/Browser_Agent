/**
 * Business Type Detector Tests - Phase 18b (T106b)
 *
 * Tests for BusinessTypeDetector class (8 tests as per spec)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BusinessTypeDetector,
  createBusinessTypeDetector,
} from '../../src/heuristics/index.js';
import type { PageState, DOMNode } from '../../src/models/index.js';

// Helper to create a mock DOMNode
function createMockDOMNode(overrides: Partial<DOMNode> = {}): DOMNode {
  return {
    tagName: 'div',
    xpath: '/html/body/div',
    text: '',
    isInteractive: false,
    isVisible: true,
    croType: null,
    children: [],
    ...overrides,
  };
}

// Helper to create a mock PageState
function createMockPageState(options: {
  url?: string;
  title?: string;
  nodes?: Partial<DOMNode>[];
} = {}): PageState {
  const { url = 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy', title = 'Test Page', nodes = [] } = options;

  const childNodes = nodes.map((n) => createMockDOMNode(n));

  return {
    url,
    title,
    domTree: {
      root: {
        tagName: 'body',
        xpath: '/html/body',
        text: '',
        isInteractive: false,
        isVisible: true,
        croType: null,
        children: childNodes,
      },
      interactiveCount: 0,
      croElementCount: 0,
      totalNodeCount: 1 + childNodes.length,
      extractedAt: Date.now(),
    },
    viewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      isMobile: false,
    },
    scrollPosition: {
      x: 0,
      y: 0,
      maxX: 0,
      maxY: 1000,
    },
    timestamp: Date.now(),
  };
}

describe('BusinessTypeDetector', () => {
  let detector: BusinessTypeDetector;

  beforeEach(() => {
    // Use lower threshold for testing to validate detection logic works
    detector = createBusinessTypeDetector({ confidenceThreshold: 0.1 });
  });

  describe('detect ecommerce', () => {
    it('should detect ecommerce from URL patterns', () => {
      const state = createMockPageState({
        url: 'https://shop.example.com/cart/checkout/product/store',
        title: 'Checkout - Complete Purchase',
        nodes: [
          { text: 'Complete your purchase' },
          { text: 'Add to cart' },
          { text: 'Buy now' },
        ],
      });

      const result = detector.detect(state);

      expect(result.type).toBe('ecommerce');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.signals.length).toBeGreaterThan(0);
    });

    it('should detect ecommerce from element selectors', () => {
      const state = createMockPageState({
        url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy/page',
        title: 'Products',
        nodes: [
          { tagName: 'button', attributes: { class: 'add-to-cart-button cart-btn' }, text: 'Add to Cart' },
          { tagName: 'span', attributes: { class: 'product-price price' }, text: '$99.99' },
          { tagName: 'div', attributes: { class: 'basket-items cart-summary' }, text: 'Your cart' },
        ],
      });

      const result = detector.detect(state);

      expect(result.type).toBe('ecommerce');
      expect(result.signals.some((s) => s.includes('Element'))).toBe(true);
    });

    it('should detect ecommerce from keywords', () => {
      const state = createMockPageState({
        url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
        title: 'Shop Now - Best Deals',
        nodes: [
          { text: 'Add to cart now' },
          { text: 'Free shipping on all orders' },
          { text: 'Buy now and save 20%' },
          { text: 'Shopping cart summary' },
          { text: 'Check product price and discount' },
          { text: 'In stock - ready to ship' },
        ],
      });

      const result = detector.detect(state);

      expect(result.type).toBe('ecommerce');
      expect(result.signals.some((s) => s.includes('Keyword'))).toBe(true);
    });
  });

  describe('detect saas', () => {
    it('should detect SaaS from URL and keywords', () => {
      const state = createMockPageState({
        url: 'https://app.example.com/pricing/features/signup',
        title: 'Pricing Plans - Get Started',
        nodes: [
          { text: 'Start your free trial today' },
          { text: '$19 per month per user' },
          { text: 'Enterprise pricing available' },
          { text: 'Request demo now' },
          { tagName: 'div', attributes: { class: 'pricing-table tier-plan' } },
        ],
      });

      const result = detector.detect(state);

      expect(result.type).toBe('saas');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('low confidence fallback', () => {
    it('should return "other" when confidence below threshold', () => {
      // Use a higher threshold for this specific test
      const strictDetector = createBusinessTypeDetector({ confidenceThreshold: 0.9 });

      const state = createMockPageState({
        url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
        title: 'Welcome',
        nodes: [{ text: 'Hello World' }],
      });

      const result = strictDetector.detect(state);

      expect(result.type).toBe('other');
      expect(result.confidence).toBeLessThan(0.9);
    });
  });

  describe('configuration', () => {
    it('should respect custom confidence threshold', () => {
      // Create detector with very high threshold
      const strictDetector = createBusinessTypeDetector({
        confidenceThreshold: 0.95,
      });

      const state = createMockPageState({
        url: 'https://shop.example.com/cart',
        title: 'Cart',
        nodes: [{ text: 'Add to cart' }],
      });

      const result = strictDetector.detect(state);

      // Even with ecommerce signals, very high threshold returns 'other'
      expect(result.type).toBe('other');
    });

    it('should allow updating config via setConfig', () => {
      detector.setConfig({ confidenceThreshold: 0.1 });

      const config = detector.getConfig();

      expect(config.confidenceThreshold).toBe(0.1);
    });
  });

  describe('signal capture', () => {
    it('should capture signals that led to detection', () => {
      const state = createMockPageState({
        url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy/checkout',
        title: 'Checkout',
        nodes: [
          { text: 'Complete your purchase' },
          { tagName: 'div', attributes: { class: 'cart-items' } },
        ],
      });

      const result = detector.detect(state);

      expect(result.signals).toBeDefined();
      expect(result.signals.length).toBeGreaterThan(0);
      // Should have URL and/or element signals
      expect(
        result.signals.some((s) => s.includes('URL') || s.includes('Element') || s.includes('Keyword'))
      ).toBe(true);
    });
  });
});
