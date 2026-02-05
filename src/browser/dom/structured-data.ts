/**
 * Structured Data Extraction - Parses JSON-LD Product schema from pages
 * Phase 25c: T485-T486
 */

import type { Page } from 'playwright';
import { createLogger } from '../../utils/index.js';

const logger = createLogger('StructuredData');

/**
 * Structured product data extracted from JSON-LD Product schema
 */
export interface StructuredProductData {
  name?: string;
  price?: number;
  currency?: string;
  availability?: string;
  rating?: number;
  reviewCount?: number;
  brand?: string;
  sku?: string;
  image?: string;
}

/**
 * Raw JSON-LD data shape (before normalization)
 */
interface JsonLdData {
  '@context'?: string | object;
  '@type'?: string | string[];
  '@graph'?: JsonLdData[];
  name?: string;
  offers?: {
    '@type'?: string;
    price?: number | string;
    priceCurrency?: string;
    availability?: string;
    url?: string;
  } | Array<{
    '@type'?: string;
    price?: number | string;
    priceCurrency?: string;
    availability?: string;
    url?: string;
  }>;
  aggregateRating?: {
    '@type'?: string;
    ratingValue?: number | string;
    reviewCount?: number | string;
    ratingCount?: number | string;
  };
  brand?: string | { '@type'?: string; name?: string };
  sku?: string;
  image?: string | string[] | { '@type'?: string; url?: string };
  [key: string]: unknown;
}

/**
 * Extract structured product data from JSON-LD scripts on the page
 *
 * Handles:
 * - Direct Product schema
 * - @graph arrays containing Product
 * - Nested offers and aggregateRating
 * - Various data formats (string vs object, arrays vs single values)
 *
 * @param page - Playwright page instance
 * @returns StructuredProductData or null if no Product schema found
 */
export async function extractStructuredData(page: Page): Promise<StructuredProductData | null> {
  try {
    const result = await page.evaluate(() => {
      // Find all JSON-LD scripts
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      const jsonLdItems: unknown[] = [];

      scripts.forEach(script => {
        try {
          const content = script.textContent;
          if (content) {
            const parsed = JSON.parse(content);
            jsonLdItems.push(parsed);
          }
        } catch {
          // Skip malformed JSON
        }
      });

      return jsonLdItems;
    });

    // Process collected JSON-LD items
    for (const item of result) {
      const product = findProductSchema(item as JsonLdData);
      if (product) {
        const extracted = parseProductData(product);
        if (extracted && Object.keys(extracted).length > 0) {
          logger.debug('Extracted structured product data', {
            fields: Object.keys(extracted).length
          });
          return extracted;
        }
      }
    }

    logger.debug('No Product schema found in JSON-LD');
    return null;

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('Failed to extract structured data', { error: message });
    return null;
  }
}

/**
 * Find Product schema in JSON-LD data
 * Handles direct Product type or @graph arrays
 */
function findProductSchema(data: JsonLdData): JsonLdData | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  // Check if this is directly a Product
  const type = data['@type'];
  if (isProductType(type)) {
    return data;
  }

  // Check @graph array
  if (Array.isArray(data['@graph'])) {
    for (const item of data['@graph']) {
      if (item && typeof item === 'object' && isProductType(item['@type'])) {
        return item;
      }
    }
  }

  return null;
}

/**
 * Check if @type indicates a Product schema
 */
function isProductType(type: unknown): boolean {
  if (typeof type === 'string') {
    return type === 'Product' || type.endsWith('/Product');
  }
  if (Array.isArray(type)) {
    return type.some(t => t === 'Product' || (typeof t === 'string' && t.endsWith('/Product')));
  }
  return false;
}

/**
 * Parse Product JSON-LD into StructuredProductData
 */
function parseProductData(data: JsonLdData): StructuredProductData {
  const result: StructuredProductData = {};

  // Name
  if (typeof data.name === 'string') {
    result.name = data.name;
  }

  // Price and currency from offers
  const offers = data.offers;
  if (offers) {
    const offer = Array.isArray(offers) ? offers[0] : offers;
    if (offer) {
      // Price
      if (offer.price !== undefined) {
        const price = parseFloat(String(offer.price));
        if (!isNaN(price)) {
          result.price = price;
        }
      }
      // Currency
      if (typeof offer.priceCurrency === 'string') {
        result.currency = offer.priceCurrency;
      }
      // Availability
      if (typeof offer.availability === 'string') {
        result.availability = normalizeAvailability(offer.availability);
      }
    }
  }

  // Rating and reviews from aggregateRating
  const rating = data.aggregateRating;
  if (rating) {
    // Rating value
    if (rating.ratingValue !== undefined) {
      const ratingValue = parseFloat(String(rating.ratingValue));
      if (!isNaN(ratingValue)) {
        result.rating = ratingValue;
      }
    }
    // Review count
    const reviewCount = rating.reviewCount ?? rating.ratingCount;
    if (reviewCount !== undefined) {
      const count = parseInt(String(reviewCount), 10);
      if (!isNaN(count)) {
        result.reviewCount = count;
      }
    }
  }

  // Brand
  if (data.brand) {
    if (typeof data.brand === 'string') {
      result.brand = data.brand;
    } else if (typeof data.brand === 'object' && data.brand.name) {
      result.brand = data.brand.name;
    }
  }

  // SKU
  if (typeof data.sku === 'string') {
    result.sku = data.sku;
  }

  // Image (take first if array)
  if (data.image) {
    if (typeof data.image === 'string') {
      result.image = data.image;
    } else if (Array.isArray(data.image) && data.image.length > 0) {
      const first = data.image[0];
      if (typeof first === 'string') {
        result.image = first;
      } else if (first && typeof first === 'object') {
        result.image = (first as { url?: string }).url;
      }
    } else if (typeof data.image === 'object' && (data.image as { url?: string }).url) {
      result.image = (data.image as { url?: string }).url;
    }
  }

  return result;
}

/**
 * Normalize availability URL to human-readable status
 */
function normalizeAvailability(availability: string): string {
  const lower = availability.toLowerCase();
  if (lower.includes('instock') || lower.includes('in_stock')) {
    return 'InStock';
  }
  if (lower.includes('outofstock') || lower.includes('out_of_stock')) {
    return 'OutOfStock';
  }
  if (lower.includes('preorder')) {
    return 'PreOrder';
  }
  if (lower.includes('backorder')) {
    return 'BackOrder';
  }
  if (lower.includes('limited')) {
    return 'LimitedAvailability';
  }
  if (lower.includes('soldout') || lower.includes('sold_out')) {
    return 'SoldOut';
  }
  // Return last segment of URL or full string
  const segments = availability.split('/');
  return segments[segments.length - 1] || availability;
}
