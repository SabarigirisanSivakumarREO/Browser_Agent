/**
 * Domain Pattern Cache - Phase 24 (T459-T460)
 *
 * Caches page type detection results by domain to avoid redundant detection.
 * Useful when analyzing multiple pages from the same site.
 */

import type { PageType } from '../models/page-type.js';
import { createLogger } from '../utils/index.js';

const logger = createLogger('DomainPatternCache');

/**
 * Cached detection result for a domain
 */
export interface CachedDetectionResult {
  /** Detected page type */
  pageType: PageType;
  /** Confidence score 0-1 */
  confidence: number;
  /** Detection tier that produced this result */
  tier: 'playwright' | 'heuristic' | 'llm' | 'combined';
  /** Timestamp when cached */
  timestamp: number;
  /** URL patterns seen for this domain */
  urlPatterns?: string[];
}

/**
 * Configuration for DomainPatternCache
 */
export interface DomainPatternCacheConfig {
  /** Maximum cache size (default: 100) */
  maxSize: number;
  /** Cache TTL in milliseconds (default: 30 minutes) */
  ttlMs: number;
}

const DEFAULT_CACHE_CONFIG: DomainPatternCacheConfig = {
  maxSize: 100,
  ttlMs: 30 * 60 * 1000, // 30 minutes
};

/**
 * Domain-based cache for page type detection results.
 * Caches by domain (not full URL) to enable pattern learning.
 */
export class DomainPatternCache {
  private cache = new Map<string, CachedDetectionResult>();
  private config: DomainPatternCacheConfig;

  constructor(config: Partial<DomainPatternCacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
  }

  /**
   * Extract domain from URL (strips www prefix)
   * @param url - Full URL
   * @returns Domain string or empty string if invalid
   */
  extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      let hostname = parsed.hostname.toLowerCase();

      // Strip www prefix for consistency
      if (hostname.startsWith('www.')) {
        hostname = hostname.slice(4);
      }

      return hostname;
    } catch {
      logger.warn(`Failed to parse URL: ${url}`);
      return '';
    }
  }

  /**
   * Store detection result for a URL
   * @param url - Full URL
   * @param result - Detection result to cache
   */
  set(url: string, result: Omit<CachedDetectionResult, 'timestamp'>): void {
    const domain = this.extractDomain(url);
    if (!domain) return;

    // Evict oldest entries if at capacity
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    const existing = this.cache.get(domain);
    const urlPatterns = existing?.urlPatterns ?? [];

    // Track URL patterns for this domain
    try {
      const pattern = new URL(url).pathname;
      if (!urlPatterns.includes(pattern)) {
        urlPatterns.push(pattern);
        // Keep only last 10 patterns
        if (urlPatterns.length > 10) {
          urlPatterns.shift();
        }
      }
    } catch {
      // ignore
    }

    this.cache.set(domain, {
      ...result,
      timestamp: Date.now(),
      urlPatterns,
    });

    logger.debug(`Cached result for domain: ${domain} (${result.pageType}, confidence: ${result.confidence})`);
  }

  /**
   * Get cached detection result for a URL
   * @param url - Full URL
   * @returns Cached result or undefined if not found/expired
   */
  get(url: string): CachedDetectionResult | undefined {
    const domain = this.extractDomain(url);
    if (!domain) return undefined;

    const cached = this.cache.get(domain);
    if (!cached) return undefined;

    // Check TTL
    if (Date.now() - cached.timestamp > this.config.ttlMs) {
      logger.debug(`Cache expired for domain: ${domain}`);
      this.cache.delete(domain);
      return undefined;
    }

    logger.debug(`Cache hit for domain: ${domain}`);
    return cached;
  }

  /**
   * Check if URL's domain has a cached result
   * @param url - Full URL
   * @returns true if domain has valid cached result
   */
  has(url: string): boolean {
    return this.get(url) !== undefined;
  }

  /**
   * Delete cached result for a URL's domain
   * @param url - Full URL
   * @returns true if entry was deleted
   */
  delete(url: string): boolean {
    const domain = this.extractDomain(url);
    if (!domain) return false;
    return this.cache.delete(domain);
  }

  /**
   * Clear all cached results
   */
  clear(): void {
    this.cache.clear();
    logger.debug('Cache cleared');
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all cached domains
   */
  domains(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Evict oldest entries to make room
   */
  private evictOldest(): void {
    // Find oldest entry
    let oldestDomain: string | null = null;
    let oldestTime = Infinity;

    for (const [domain, result] of this.cache) {
      if (result.timestamp < oldestTime) {
        oldestTime = result.timestamp;
        oldestDomain = domain;
      }
    }

    if (oldestDomain) {
      this.cache.delete(oldestDomain);
      logger.debug(`Evicted oldest cache entry: ${oldestDomain}`);
    }
  }

  /**
   * Get statistics about cache usage
   */
  getStats(): {
    size: number;
    maxSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    let oldest: number | null = null;
    let newest: number | null = null;

    for (const result of this.cache.values()) {
      if (oldest === null || result.timestamp < oldest) {
        oldest = result.timestamp;
      }
      if (newest === null || result.timestamp > newest) {
        newest = result.timestamp;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      oldestEntry: oldest,
      newestEntry: newest,
    };
  }
}

/**
 * Create a new domain pattern cache
 */
export function createDomainPatternCache(
  config?: Partial<DomainPatternCacheConfig>
): DomainPatternCache {
  return new DomainPatternCache(config);
}
