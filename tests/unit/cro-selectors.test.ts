/**
 * Unit tests for Phase 25b: Enhanced CRO Selectors
 * Tests the 5 new selector categories: price, variant, stock, shipping, gallery
 */

import { describe, it, expect } from 'vitest';
import { CRO_SELECTORS, type CROSelectorConfig } from '../../src/browser/dom/index.js';

describe('CRO Selectors - Phase 25b New Categories', () => {
  // =============================================================================
  // Price Selectors (T477)
  // =============================================================================
  describe('price selectors', () => {
    it('should have price category defined', () => {
      expect(CRO_SELECTORS.price).toBeDefined();
      expect(Array.isArray(CRO_SELECTORS.price)).toBe(true);
    });

    it('should match class="price"', () => {
      const hasPriceClass = CRO_SELECTORS.price.some(
        p => p.type === 'class' && p.pattern === 'price'
      );
      expect(hasPriceClass).toBe(true);
    });

    it('should match data-price attribute', () => {
      const hasDataPrice = CRO_SELECTORS.price.some(
        p => p.type === 'attr' && p.pattern === 'data-price'
      );
      expect(hasDataPrice).toBe(true);
    });

    it('should match itemprop="price" attribute', () => {
      const hasItemprop = CRO_SELECTORS.price.some(
        p => p.type === 'attr' && p.pattern.includes('itemprop')
      );
      expect(hasItemprop).toBe(true);
    });

    it('should match currency symbols via text pattern', () => {
      const hasCurrencyPattern = CRO_SELECTORS.price.some(
        p => p.type === 'text' && (
          p.pattern.includes('$') ||
          p.pattern.includes('€') ||
          p.pattern.includes('£') ||
          p.pattern.includes('₹')
        )
      );
      expect(hasCurrencyPattern).toBe(true);
    });

    it('should have correct number of patterns (9)', () => {
      expect(CRO_SELECTORS.price).toHaveLength(9);
    });

    it('should have weights in valid range (0.6-0.95)', () => {
      for (const pattern of CRO_SELECTORS.price) {
        expect(pattern.weight).toBeGreaterThanOrEqual(0.6);
        expect(pattern.weight).toBeLessThanOrEqual(0.95);
      }
    });
  });

  // =============================================================================
  // Variant Selectors (T478)
  // =============================================================================
  describe('variant selectors', () => {
    it('should have variant category defined', () => {
      expect(CRO_SELECTORS.variant).toBeDefined();
      expect(Array.isArray(CRO_SELECTORS.variant)).toBe(true);
    });

    it('should match class="swatch"', () => {
      const hasSwatchClass = CRO_SELECTORS.variant.some(
        p => p.type === 'class' && p.pattern === 'swatch'
      );
      expect(hasSwatchClass).toBe(true);
    });

    it('should match size-selector class', () => {
      const hasSizeSelector = CRO_SELECTORS.variant.some(
        p => p.type === 'class' && p.pattern === 'size-selector'
      );
      expect(hasSizeSelector).toBe(true);
    });

    it('should match color-selector class', () => {
      const hasColorSelector = CRO_SELECTORS.variant.some(
        p => p.type === 'class' && p.pattern === 'color-selector'
      );
      expect(hasColorSelector).toBe(true);
    });

    it('should match role="radiogroup" for ARIA', () => {
      const hasRadiogroup = CRO_SELECTORS.variant.some(
        p => p.type === 'role' && p.pattern === 'radiogroup'
      );
      expect(hasRadiogroup).toBe(true);
    });

    it('should match role="listbox" for ARIA', () => {
      const hasListbox = CRO_SELECTORS.variant.some(
        p => p.type === 'role' && p.pattern === 'listbox'
      );
      expect(hasListbox).toBe(true);
    });

    it('should have correct number of patterns (8)', () => {
      expect(CRO_SELECTORS.variant).toHaveLength(8);
    });

    it('should have weights in valid range (0.6-0.95)', () => {
      for (const pattern of CRO_SELECTORS.variant) {
        expect(pattern.weight).toBeGreaterThanOrEqual(0.6);
        expect(pattern.weight).toBeLessThanOrEqual(0.95);
      }
    });
  });

  // =============================================================================
  // Stock Selectors (T479)
  // =============================================================================
  describe('stock selectors', () => {
    it('should have stock category defined', () => {
      expect(CRO_SELECTORS.stock).toBeDefined();
      expect(Array.isArray(CRO_SELECTORS.stock)).toBe(true);
    });

    it('should match class="stock"', () => {
      const hasStockClass = CRO_SELECTORS.stock.some(
        p => p.type === 'class' && p.pattern === 'stock'
      );
      expect(hasStockClass).toBe(true);
    });

    it('should match class="in-stock"', () => {
      const hasInStock = CRO_SELECTORS.stock.some(
        p => p.type === 'class' && p.pattern === 'in-stock'
      );
      expect(hasInStock).toBe(true);
    });

    it('should match class="out-of-stock"', () => {
      const hasOutOfStock = CRO_SELECTORS.stock.some(
        p => p.type === 'class' && p.pattern === 'out-of-stock'
      );
      expect(hasOutOfStock).toBe(true);
    });

    it('should match class="sold-out"', () => {
      const hasSoldOut = CRO_SELECTORS.stock.some(
        p => p.type === 'class' && p.pattern === 'sold-out'
      );
      expect(hasSoldOut).toBe(true);
    });

    it('should match "in stock" text pattern', () => {
      const hasInStockText = CRO_SELECTORS.stock.some(
        p => p.type === 'text' && p.pattern.includes('in stock')
      );
      expect(hasInStockText).toBe(true);
    });

    it('should have correct number of patterns (7)', () => {
      expect(CRO_SELECTORS.stock).toHaveLength(7);
    });

    it('should have weights in valid range (0.6-0.95)', () => {
      for (const pattern of CRO_SELECTORS.stock) {
        expect(pattern.weight).toBeGreaterThanOrEqual(0.6);
        expect(pattern.weight).toBeLessThanOrEqual(0.95);
      }
    });
  });

  // =============================================================================
  // Shipping Selectors (T480)
  // =============================================================================
  describe('shipping selectors', () => {
    it('should have shipping category defined', () => {
      expect(CRO_SELECTORS.shipping).toBeDefined();
      expect(Array.isArray(CRO_SELECTORS.shipping)).toBe(true);
    });

    it('should match class="shipping"', () => {
      const hasShippingClass = CRO_SELECTORS.shipping.some(
        p => p.type === 'class' && p.pattern === 'shipping'
      );
      expect(hasShippingClass).toBe(true);
    });

    it('should match class="delivery"', () => {
      const hasDeliveryClass = CRO_SELECTORS.shipping.some(
        p => p.type === 'class' && p.pattern === 'delivery'
      );
      expect(hasDeliveryClass).toBe(true);
    });

    it('should match "free shipping" text pattern', () => {
      const hasFreeShipping = CRO_SELECTORS.shipping.some(
        p => p.type === 'text' && p.pattern.includes('free shipping')
      );
      expect(hasFreeShipping).toBe(true);
    });

    it('should match "free delivery" text pattern', () => {
      const hasFreeDelivery = CRO_SELECTORS.shipping.some(
        p => p.type === 'text' && p.pattern.includes('free delivery')
      );
      expect(hasFreeDelivery).toBe(true);
    });

    it('should have correct number of patterns (6)', () => {
      expect(CRO_SELECTORS.shipping).toHaveLength(6);
    });

    it('should have weights in valid range (0.6-0.95)', () => {
      for (const pattern of CRO_SELECTORS.shipping) {
        expect(pattern.weight).toBeGreaterThanOrEqual(0.6);
        expect(pattern.weight).toBeLessThanOrEqual(0.95);
      }
    });
  });

  // =============================================================================
  // Gallery Selectors (T481)
  // =============================================================================
  describe('gallery selectors', () => {
    it('should have gallery category defined', () => {
      expect(CRO_SELECTORS.gallery).toBeDefined();
      expect(Array.isArray(CRO_SELECTORS.gallery)).toBe(true);
    });

    it('should match class="gallery"', () => {
      const hasGalleryClass = CRO_SELECTORS.gallery.some(
        p => p.type === 'class' && p.pattern === 'gallery'
      );
      expect(hasGalleryClass).toBe(true);
    });

    it('should match class="product-gallery"', () => {
      const hasProductGallery = CRO_SELECTORS.gallery.some(
        p => p.type === 'class' && p.pattern === 'product-gallery'
      );
      expect(hasProductGallery).toBe(true);
    });

    it('should match class="carousel"', () => {
      const hasCarousel = CRO_SELECTORS.gallery.some(
        p => p.type === 'class' && p.pattern === 'carousel'
      );
      expect(hasCarousel).toBe(true);
    });

    it('should match class="thumbnail"', () => {
      const hasThumbnail = CRO_SELECTORS.gallery.some(
        p => p.type === 'class' && p.pattern === 'thumbnail'
      );
      expect(hasThumbnail).toBe(true);
    });

    it('should have correct number of patterns (7)', () => {
      expect(CRO_SELECTORS.gallery).toHaveLength(7);
    });

    it('should have weights in valid range (0.6-0.95)', () => {
      for (const pattern of CRO_SELECTORS.gallery) {
        expect(pattern.weight).toBeGreaterThanOrEqual(0.6);
        expect(pattern.weight).toBeLessThanOrEqual(0.95);
      }
    });
  });

  // =============================================================================
  // Interface Verification (T482)
  // =============================================================================
  describe('CROSelectorConfig interface', () => {
    it('should have all 10 CRO categories defined', () => {
      const categories = Object.keys(CRO_SELECTORS);
      expect(categories).toContain('cta');
      expect(categories).toContain('form');
      expect(categories).toContain('trust');
      expect(categories).toContain('value_prop');
      expect(categories).toContain('navigation');
      // Phase 25b new categories
      expect(categories).toContain('price');
      expect(categories).toContain('variant');
      expect(categories).toContain('stock');
      expect(categories).toContain('shipping');
      expect(categories).toContain('gallery');
      expect(categories).toHaveLength(10);
    });

    it('should have valid pattern types for all selectors', () => {
      const validTypes = ['tag', 'class', 'id', 'attr', 'role', 'text'];
      for (const [category, patterns] of Object.entries(CRO_SELECTORS)) {
        for (const pattern of patterns) {
          expect(validTypes).toContain(pattern.type);
        }
      }
    });

    it('should have all weights between 0 and 1', () => {
      for (const [category, patterns] of Object.entries(CRO_SELECTORS)) {
        for (const pattern of patterns) {
          expect(pattern.weight).toBeGreaterThanOrEqual(0);
          expect(pattern.weight).toBeLessThanOrEqual(1);
        }
      }
    });

    it('should have non-empty patterns for all selectors', () => {
      for (const [category, patterns] of Object.entries(CRO_SELECTORS)) {
        expect(patterns.length).toBeGreaterThan(0);
        for (const pattern of patterns) {
          expect(pattern.pattern).toBeTruthy();
          expect(pattern.type).toBeTruthy();
        }
      }
    });
  });
});
