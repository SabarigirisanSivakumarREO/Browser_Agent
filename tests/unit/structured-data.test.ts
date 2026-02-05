/**
 * Unit tests for Structured Data Extraction (Phase 25c)
 * Tests JSON-LD Product schema parsing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Page } from 'playwright';

// We'll test the internal parsing functions by importing the module
// and mocking page.evaluate
import { extractStructuredData } from '../../src/browser/dom/structured-data.js';

describe('extractStructuredData', () => {
  let mockPage: Page;

  beforeEach(() => {
    mockPage = {
      evaluate: vi.fn(),
    } as unknown as Page;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should extract Product schema from JSON-LD', async () => {
    const jsonLdData = [{
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Test Product',
      offers: {
        '@type': 'Offer',
        price: 99.99,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: 4.5,
        reviewCount: 120,
      },
      brand: 'Test Brand',
      sku: 'SKU123',
      image: 'https://example.com/image.jpg',
    }];

    vi.mocked(mockPage.evaluate).mockResolvedValue(jsonLdData);

    const result = await extractStructuredData(mockPage);

    expect(result).not.toBeNull();
    expect(result?.name).toBe('Test Product');
    expect(result?.price).toBe(99.99);
    expect(result?.currency).toBe('USD');
    expect(result?.availability).toBe('InStock');
    expect(result?.rating).toBe(4.5);
    expect(result?.reviewCount).toBe(120);
    expect(result?.brand).toBe('Test Brand');
    expect(result?.sku).toBe('SKU123');
    expect(result?.image).toBe('https://example.com/image.jpg');
  });

  it('should handle @graph arrays containing Product', async () => {
    const jsonLdData = [{
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          name: 'Product Page',
        },
        {
          '@type': 'Product',
          name: 'Graph Product',
          offers: {
            price: 149.99,
            priceCurrency: 'EUR',
          },
          brand: {
            '@type': 'Brand',
            name: 'Graph Brand',
          },
        },
      ],
    }];

    vi.mocked(mockPage.evaluate).mockResolvedValue(jsonLdData);

    const result = await extractStructuredData(mockPage);

    expect(result).not.toBeNull();
    expect(result?.name).toBe('Graph Product');
    expect(result?.price).toBe(149.99);
    expect(result?.currency).toBe('EUR');
    expect(result?.brand).toBe('Graph Brand');
  });

  it('should return null for missing Product data', async () => {
    const jsonLdData = [{
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Some Page',
    }];

    vi.mocked(mockPage.evaluate).mockResolvedValue(jsonLdData);

    const result = await extractStructuredData(mockPage);

    expect(result).toBeNull();
  });

  it('should handle malformed JSON gracefully', async () => {
    // Simulating page.evaluate returning empty array (malformed JSON skipped)
    vi.mocked(mockPage.evaluate).mockResolvedValue([]);

    const result = await extractStructuredData(mockPage);

    expect(result).toBeNull();
  });

  it('should handle offers as array and pick first', async () => {
    const jsonLdData = [{
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Multi-Offer Product',
      offers: [
        { price: 79.99, priceCurrency: 'USD', availability: 'InStock' },
        { price: 89.99, priceCurrency: 'USD', availability: 'OutOfStock' },
      ],
    }];

    vi.mocked(mockPage.evaluate).mockResolvedValue(jsonLdData);

    const result = await extractStructuredData(mockPage);

    expect(result).not.toBeNull();
    expect(result?.price).toBe(79.99);
    expect(result?.availability).toBe('InStock');
  });

  it('should handle string prices', async () => {
    const jsonLdData = [{
      '@type': 'Product',
      name: 'String Price Product',
      offers: {
        price: '199.50',
        priceCurrency: 'GBP',
      },
    }];

    vi.mocked(mockPage.evaluate).mockResolvedValue(jsonLdData);

    const result = await extractStructuredData(mockPage);

    expect(result).not.toBeNull();
    expect(result?.price).toBe(199.50);
  });

  it('should normalize availability URLs', async () => {
    const jsonLdData = [{
      '@type': 'Product',
      name: 'Available Product',
      offers: {
        price: 50,
        availability: 'https://schema.org/OutOfStock',
      },
    }];

    vi.mocked(mockPage.evaluate).mockResolvedValue(jsonLdData);

    const result = await extractStructuredData(mockPage);

    expect(result?.availability).toBe('OutOfStock');
  });

  it('should handle image as array', async () => {
    const jsonLdData = [{
      '@type': 'Product',
      name: 'Multi-Image Product',
      image: [
        'https://example.com/img1.jpg',
        'https://example.com/img2.jpg',
      ],
    }];

    vi.mocked(mockPage.evaluate).mockResolvedValue(jsonLdData);

    const result = await extractStructuredData(mockPage);

    expect(result?.image).toBe('https://example.com/img1.jpg');
  });

  it('should handle image as object with url', async () => {
    const jsonLdData = [{
      '@type': 'Product',
      name: 'Object Image Product',
      image: {
        '@type': 'ImageObject',
        url: 'https://example.com/image-object.jpg',
      },
    }];

    vi.mocked(mockPage.evaluate).mockResolvedValue(jsonLdData);

    const result = await extractStructuredData(mockPage);

    expect(result?.image).toBe('https://example.com/image-object.jpg');
  });

  it('should handle page.evaluate errors', async () => {
    vi.mocked(mockPage.evaluate).mockRejectedValue(new Error('Page crashed'));

    const result = await extractStructuredData(mockPage);

    expect(result).toBeNull();
  });

  it('should handle ratingCount as fallback for reviewCount', async () => {
    const jsonLdData = [{
      '@type': 'Product',
      name: 'Rated Product',
      aggregateRating: {
        ratingValue: 4.0,
        ratingCount: 50, // No reviewCount, has ratingCount
      },
    }];

    vi.mocked(mockPage.evaluate).mockResolvedValue(jsonLdData);

    const result = await extractStructuredData(mockPage);

    expect(result?.reviewCount).toBe(50);
  });

  it('should handle Product type with namespace prefix', async () => {
    const jsonLdData = [{
      '@type': 'schema:Product',
      name: 'Namespaced Product',
    }];

    // This shouldn't match as it's not "Product" or ends with "/Product"
    vi.mocked(mockPage.evaluate).mockResolvedValue(jsonLdData);

    const result = await extractStructuredData(mockPage);

    // This won't match because "schema:Product" doesn't end with "/Product"
    expect(result).toBeNull();
  });

  it('should handle Product type in array', async () => {
    const jsonLdData = [{
      '@type': ['Product', 'IndividualProduct'],
      name: 'Array Type Product',
      offers: { price: 25 },
    }];

    vi.mocked(mockPage.evaluate).mockResolvedValue(jsonLdData);

    const result = await extractStructuredData(mockPage);

    expect(result?.name).toBe('Array Type Product');
    expect(result?.price).toBe(25);
  });

  it('should handle empty JSON-LD array', async () => {
    vi.mocked(mockPage.evaluate).mockResolvedValue([]);

    const result = await extractStructuredData(mockPage);

    expect(result).toBeNull();
  });

  it('should handle null/undefined fields gracefully', async () => {
    const jsonLdData = [{
      '@type': 'Product',
      name: 'Sparse Product',
      offers: {
        price: null,
        priceCurrency: undefined,
      },
      brand: null,
      sku: undefined,
    }];

    vi.mocked(mockPage.evaluate).mockResolvedValue(jsonLdData);

    const result = await extractStructuredData(mockPage);

    expect(result).not.toBeNull();
    expect(result?.name).toBe('Sparse Product');
    expect(result?.price).toBeUndefined();
    expect(result?.currency).toBeUndefined();
    expect(result?.brand).toBeUndefined();
    expect(result?.sku).toBeUndefined();
  });

  it('should handle multiple JSON-LD scripts and find Product', async () => {
    const jsonLdData = [
      { '@type': 'Organization', name: 'Company' },
      { '@type': 'BreadcrumbList', itemListElement: [] },
      { '@type': 'Product', name: 'Found Product', offers: { price: 100 } },
    ];

    vi.mocked(mockPage.evaluate).mockResolvedValue(jsonLdData);

    const result = await extractStructuredData(mockPage);

    expect(result?.name).toBe('Found Product');
    expect(result?.price).toBe(100);
  });

  it('should normalize various availability formats', async () => {
    // Test various availability format normalization
    const testCases = [
      { input: 'http://schema.org/InStock', expected: 'InStock' },
      { input: 'https://schema.org/OutOfStock', expected: 'OutOfStock' },
      { input: 'InStock', expected: 'InStock' },
      { input: 'out_of_stock', expected: 'OutOfStock' },
      { input: 'https://schema.org/PreOrder', expected: 'PreOrder' },
      { input: 'backorder', expected: 'BackOrder' },
      { input: 'LimitedAvailability', expected: 'LimitedAvailability' },
      { input: 'sold_out', expected: 'SoldOut' },
    ];

    for (const { input, expected } of testCases) {
      const jsonLdData = [{
        '@type': 'Product',
        name: 'Test',
        offers: { availability: input },
      }];

      vi.mocked(mockPage.evaluate).mockResolvedValue(jsonLdData);

      const result = await extractStructuredData(mockPage);
      expect(result?.availability).toBe(expected);
    }
  });
});
