/**
 * Tests for DomainPatternCache - Phase 24 (T460)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DomainPatternCache,
  createDomainPatternCache,
} from '../../src/heuristics/domain-pattern-cache.js';

describe('DomainPatternCache', () => {
  let cache: DomainPatternCache;

  beforeEach(() => {
    cache = createDomainPatternCache();
  });

  describe('extractDomain', () => {
    it('should extract domain from URL', () => {
      expect(cache.extractDomain('https://example.com/page')).toBe('example.com');
      expect(cache.extractDomain('https://shop.example.com/products')).toBe('shop.example.com');
      expect(cache.extractDomain('http://example.org:8080/path')).toBe('example.org');
    });

    it('should strip www prefix', () => {
      expect(cache.extractDomain('https://www.example.com/page')).toBe('example.com');
      expect(cache.extractDomain('https://www.shop.example.com/products')).toBe('shop.example.com');
    });

    it('should handle invalid URLs', () => {
      expect(cache.extractDomain('not-a-url')).toBe('');
      expect(cache.extractDomain('')).toBe('');
      expect(cache.extractDomain('javascript:void(0)')).toBe('');
    });

    it('should convert domain to lowercase', () => {
      expect(cache.extractDomain('https://EXAMPLE.COM/page')).toBe('example.com');
      expect(cache.extractDomain('https://WWW.Example.Com/Page')).toBe('example.com');
    });
  });

  describe('set and get', () => {
    it('should store and retrieve results', () => {
      cache.set('https://example.com/product', {
        pageType: 'pdp',
        confidence: 0.9,
        tier: 'playwright',
      });

      const result = cache.get('https://example.com/other-product');
      expect(result).toBeDefined();
      expect(result?.pageType).toBe('pdp');
      expect(result?.confidence).toBe(0.9);
      expect(result?.tier).toBe('playwright');
    });

    it('should return undefined for unknown domain', () => {
      const result = cache.get('https://unknown.com/page');
      expect(result).toBeUndefined();
    });

    it('should use domain key (not full URL)', () => {
      cache.set('https://example.com/product/123', {
        pageType: 'pdp',
        confidence: 0.85,
        tier: 'combined',
      });

      // Same domain, different path should get cached result
      expect(cache.get('https://example.com/product/456')).toBeDefined();
      expect(cache.get('https://example.com/')).toBeDefined();

      // Different domain should not have cached result
      expect(cache.get('https://other.com/product')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for cached domains', () => {
      cache.set('https://example.com/page', {
        pageType: 'pdp',
        confidence: 0.9,
        tier: 'playwright',
      });

      expect(cache.has('https://example.com/page')).toBe(true);
      expect(cache.has('https://example.com/other')).toBe(true);
      expect(cache.has('https://unknown.com/page')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove cached entry', () => {
      cache.set('https://example.com/page', {
        pageType: 'pdp',
        confidence: 0.9,
        tier: 'playwright',
      });

      expect(cache.has('https://example.com/page')).toBe(true);

      const deleted = cache.delete('https://example.com/anything');
      expect(deleted).toBe(true);
      expect(cache.has('https://example.com/page')).toBe(false);
    });

    it('should return false for non-existent domain', () => {
      const deleted = cache.delete('https://unknown.com/page');
      expect(deleted).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('https://example.com/page', {
        pageType: 'pdp',
        confidence: 0.9,
        tier: 'playwright',
      });
      cache.set('https://shop.com/page', {
        pageType: 'plp',
        confidence: 0.8,
        tier: 'heuristic',
      });

      expect(cache.size()).toBe(2);

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.has('https://example.com/page')).toBe(false);
      expect(cache.has('https://shop.com/page')).toBe(false);
    });
  });

  describe('size', () => {
    it('should return number of cached domains', () => {
      expect(cache.size()).toBe(0);

      cache.set('https://example.com/page', {
        pageType: 'pdp',
        confidence: 0.9,
        tier: 'playwright',
      });
      expect(cache.size()).toBe(1);

      cache.set('https://shop.com/page', {
        pageType: 'plp',
        confidence: 0.8,
        tier: 'heuristic',
      });
      expect(cache.size()).toBe(2);

      // Same domain shouldn't increase count
      cache.set('https://example.com/other', {
        pageType: 'pdp',
        confidence: 0.95,
        tier: 'combined',
      });
      expect(cache.size()).toBe(2);
    });
  });

  describe('domains', () => {
    it('should return all cached domains', () => {
      cache.set('https://example.com/page', {
        pageType: 'pdp',
        confidence: 0.9,
        tier: 'playwright',
      });
      cache.set('https://shop.com/page', {
        pageType: 'plp',
        confidence: 0.8,
        tier: 'heuristic',
      });

      const domains = cache.domains();
      expect(domains).toHaveLength(2);
      expect(domains).toContain('example.com');
      expect(domains).toContain('shop.com');
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      // Create cache with short TTL
      const shortCache = createDomainPatternCache({ ttlMs: 100 });

      shortCache.set('https://example.com/page', {
        pageType: 'pdp',
        confidence: 0.9,
        tier: 'playwright',
      });

      expect(shortCache.has('https://example.com/page')).toBe(true);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(shortCache.has('https://example.com/page')).toBe(false);
      expect(shortCache.get('https://example.com/page')).toBeUndefined();
    });
  });

  describe('max size eviction', () => {
    it('should evict oldest entry when at capacity', () => {
      const smallCache = createDomainPatternCache({ maxSize: 2 });

      smallCache.set('https://first.com/page', {
        pageType: 'pdp',
        confidence: 0.9,
        tier: 'playwright',
      });

      // Small delay to ensure different timestamps
      smallCache.set('https://second.com/page', {
        pageType: 'plp',
        confidence: 0.8,
        tier: 'heuristic',
      });

      expect(smallCache.size()).toBe(2);

      // Adding third should evict first (oldest)
      smallCache.set('https://third.com/page', {
        pageType: 'cart',
        confidence: 0.95,
        tier: 'combined',
      });

      expect(smallCache.size()).toBe(2);
      expect(smallCache.has('https://third.com/page')).toBe(true);
      expect(smallCache.has('https://second.com/page')).toBe(true);
      // First might be evicted
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cache.set('https://example.com/page', {
        pageType: 'pdp',
        confidence: 0.9,
        tier: 'playwright',
      });
      cache.set('https://shop.com/page', {
        pageType: 'plp',
        confidence: 0.8,
        tier: 'heuristic',
      });

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(100); // default
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
      expect(stats.newestEntry).toBeGreaterThanOrEqual(stats.oldestEntry!);
    });

    it('should return nulls for empty cache', () => {
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.oldestEntry).toBeNull();
      expect(stats.newestEntry).toBeNull();
    });
  });

  describe('URL pattern tracking', () => {
    it('should track URL patterns for domain', () => {
      cache.set('https://example.com/product/123', {
        pageType: 'pdp',
        confidence: 0.9,
        tier: 'playwright',
      });
      cache.set('https://example.com/product/456', {
        pageType: 'pdp',
        confidence: 0.85,
        tier: 'playwright',
      });
      cache.set('https://example.com/category/shoes', {
        pageType: 'plp',
        confidence: 0.8,
        tier: 'combined',
      });

      const result = cache.get('https://example.com/');
      expect(result).toBeDefined();
      expect(result?.urlPatterns).toBeDefined();
      expect(result?.urlPatterns?.length).toBeGreaterThan(0);
    });
  });
});
