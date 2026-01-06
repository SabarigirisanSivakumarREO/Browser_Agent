/**
 * Page Type Detector Tests - Phase 21 (T288)
 *
 * Tests for PageTypeDetector class (20+ tests as per spec)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PageTypeDetector,
  createPageTypeDetector,
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
  const { url = 'https://example.com', title = 'Test Page', nodes = [] } = options;

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

describe('PageTypeDetector', () => {
  let detector: PageTypeDetector;

  beforeEach(() => {
    // Use lower threshold for testing to validate detection logic works
    detector = createPageTypeDetector({ confidenceThreshold: 0.1 });
  });

  describe('createPageTypeDetector', () => {
    it('should create detector with default config', () => {
      const defaultDetector = createPageTypeDetector();
      const config = defaultDetector.getConfig();

      expect(config.confidenceThreshold).toBe(0.5);
      expect(config.urlWeight).toBe(0.45);
      expect(config.elementWeight).toBe(0.35);
      expect(config.keywordWeight).toBe(0.20);
    });

    it('should create detector with custom config', () => {
      const customDetector = createPageTypeDetector({
        confidenceThreshold: 0.3,
        urlWeight: 0.5,
      });
      const config = customDetector.getConfig();

      expect(config.confidenceThreshold).toBe(0.3);
      expect(config.urlWeight).toBe(0.5);
      expect(config.elementWeight).toBe(0.35);
    });
  });

  describe('homepage detection', () => {
    it('should detect homepage from root path /', () => {
      const state = createMockPageState({ url: 'https://example.com/' });
      const result = detector.detect(state);

      expect(result.type).toBe('homepage');
      expect(result.confidence).toBe(0.9);
      expect(result.signals).toContain('Root URL path detected');
    });

    it('should detect homepage from empty path', () => {
      const state = createMockPageState({ url: 'https://example.com' });
      const result = detector.detect(state);

      expect(result.type).toBe('homepage');
      expect(result.confidence).toBe(0.9);
    });

    it('should detect homepage from /index.html', () => {
      const state = createMockPageState({ url: 'https://example.com/index.html' });
      const result = detector.detect(state);

      expect(result.type).toBe('homepage');
      expect(result.confidence).toBe(0.9);
    });
  });

  describe('PDP detection', () => {
    it('should detect PDP from /product/ URL pattern', () => {
      const state = createMockPageState({
        url: 'https://example.com/product/blue-shirt',
        title: 'Blue Shirt - Product Details',
        nodes: [
          { text: 'Add to cart' },
          { text: 'Buy now' },
        ],
      });

      const result = detector.detect(state);

      expect(result.type).toBe('pdp');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.signals.length).toBeGreaterThan(0);
    });

    it('should detect PDP from /products/ URL pattern', () => {
      const state = createMockPageState({
        url: 'https://example.com/products/polo-shirt',
      });

      const result = detector.detect(state);
      expect(result.type).toBe('pdp');
    });

    it('should detect PDP from /item/ URL pattern', () => {
      const state = createMockPageState({
        url: 'https://example.com/item/12345',
      });

      const result = detector.detect(state);
      expect(result.type).toBe('pdp');
    });

    it('should detect PDP from /dp/ URL pattern (Amazon style)', () => {
      const state = createMockPageState({
        url: 'https://example.com/dp/B08XYZ123',
      });

      const result = detector.detect(state);
      expect(result.type).toBe('pdp');
    });

    it('should detect PDP from product-detail class', () => {
      const state = createMockPageState({
        url: 'https://example.com/some-page',
        nodes: [
          { attributes: { class: 'product-detail-container' } },
          { attributes: { class: 'add-to-cart-button' } },
        ],
      });

      const result = detector.detect(state);
      expect(result.type).toBe('pdp');
    });

    it('should detect PDP from data-product-id attribute', () => {
      const state = createMockPageState({
        url: 'https://example.com/some-page',
        nodes: [
          { attributes: { 'data-product-id': '12345' } },
        ],
      });

      const result = detector.detect(state);
      expect(result.type).toBe('pdp');
    });

    it('should detect PDP from "add to cart" keyword', () => {
      const state = createMockPageState({
        url: 'https://example.com/some-page',
        nodes: [
          { text: 'Add to cart' },
          { text: 'Size guide available' },
          { text: 'In stock' },
        ],
      });

      const result = detector.detect(state);
      expect(result.type).toBe('pdp');
    });

    it('should detect PDP from Schema.org Product markup', () => {
      const state = createMockPageState({
        url: 'https://example.com/some-page',
        nodes: [
          { attributes: { itemtype: 'https://schema.org/Product' } },
        ],
      });

      const result = detector.detect(state);
      expect(result.type).toBe('pdp');
    });
  });

  describe('PLP detection', () => {
    it('should detect PLP from /category/ URL pattern', () => {
      const state = createMockPageState({
        url: 'https://example.com/category/mens-shirts',
        nodes: [
          { text: 'Filter by size' },
          { text: 'Sort by price' },
        ],
      });

      const result = detector.detect(state);
      expect(result.type).toBe('plp');
    });

    it('should detect PLP from /collection/ URL pattern', () => {
      const state = createMockPageState({
        url: 'https://example.com/collection/summer-2024',
      });

      const result = detector.detect(state);
      expect(result.type).toBe('plp');
    });

    it('should detect PLP from product-grid class', () => {
      const state = createMockPageState({
        url: 'https://example.com/shop',
        nodes: [
          { attributes: { class: 'product-grid' } },
          { attributes: { class: 'filter-options' } },
        ],
      });

      const result = detector.detect(state);
      expect(result.type).toBe('plp');
    });
  });

  describe('cart detection', () => {
    it('should detect cart from /cart URL', () => {
      const state = createMockPageState({
        url: 'https://example.com/cart',
        nodes: [
          { text: 'Your cart' },
          { text: 'Proceed to checkout' },
        ],
      });

      const result = detector.detect(state);
      expect(result.type).toBe('cart');
    });

    it('should detect cart from /basket URL', () => {
      const state = createMockPageState({
        url: 'https://example.com/basket',
      });

      const result = detector.detect(state);
      expect(result.type).toBe('cart');
    });
  });

  describe('checkout detection', () => {
    it('should detect checkout from /checkout URL', () => {
      const state = createMockPageState({
        url: 'https://example.com/checkout',
        nodes: [
          { text: 'Billing address' },
          { text: 'Payment method' },
        ],
      });

      const result = detector.detect(state);
      expect(result.type).toBe('checkout');
    });

    it('should detect checkout from /payment URL', () => {
      const state = createMockPageState({
        url: 'https://example.com/payment',
      });

      const result = detector.detect(state);
      expect(result.type).toBe('checkout');
    });
  });

  describe('account detection', () => {
    it('should detect account from /login URL', () => {
      const state = createMockPageState({
        url: 'https://example.com/login',
        nodes: [
          { text: 'Sign in' },
          { text: 'Create account' },
        ],
      });

      const result = detector.detect(state);
      expect(result.type).toBe('account');
    });

    it('should detect account from /account URL', () => {
      const state = createMockPageState({
        url: 'https://example.com/account',
      });

      const result = detector.detect(state);
      expect(result.type).toBe('account');
    });
  });

  describe('other/unknown detection', () => {
    it('should return other for unknown pages', () => {
      const detectorWithHighThreshold = createPageTypeDetector({
        confidenceThreshold: 0.9,
      });

      const state = createMockPageState({
        url: 'https://example.com/about-us',
        nodes: [
          { text: 'About our company' },
        ],
      });

      const result = detectorWithHighThreshold.detect(state);
      expect(result.type).toBe('other');
    });

    it('should return other when confidence is below threshold', () => {
      const detectorWithHighThreshold = createPageTypeDetector({
        confidenceThreshold: 0.99,
      });

      const state = createMockPageState({
        url: 'https://example.com/blog/article',
        nodes: [
          { text: 'Read more articles' },
        ],
      });

      const result = detectorWithHighThreshold.detect(state);
      expect(result.type).toBe('other');
    });
  });

  describe('signal combination', () => {
    it('should combine signals for higher confidence', () => {
      const state = createMockPageState({
        url: 'https://example.com/product/blue-shirt',
        title: 'Blue Shirt - Buy Now',
        nodes: [
          { attributes: { class: 'product-detail-container' } },
          { attributes: { class: 'add-to-cart' } },
          { attributes: { 'data-product-id': '12345' } },
          { text: 'Add to cart' },
          { text: 'Size guide' },
          { text: 'In stock' },
        ],
      });

      const result = detector.detect(state);

      expect(result.type).toBe('pdp');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.signals.length).toBeGreaterThan(1);
    });
  });

  describe('config management', () => {
    it('should update config with setConfig', () => {
      detector.setConfig({ confidenceThreshold: 0.7 });
      const config = detector.getConfig();

      expect(config.confidenceThreshold).toBe(0.7);
    });

    it('should preserve other config values when updating', () => {
      const originalConfig = detector.getConfig();
      detector.setConfig({ confidenceThreshold: 0.8 });
      const newConfig = detector.getConfig();

      expect(newConfig.urlWeight).toBe(originalConfig.urlWeight);
      expect(newConfig.elementWeight).toBe(originalConfig.elementWeight);
    });
  });
});
