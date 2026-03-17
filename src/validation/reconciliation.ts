/**
 * Structured Data ↔ DOM Reconciliation - Phase 25h (T529)
 *
 * Compares structured data (JSON-LD) against DOM-extracted values
 * and produces warnings for mismatches. This helps identify:
 * - Price discrepancies between JSON-LD and visible DOM
 * - Missing structured data that is present in DOM
 * - Potential SEO/schema issues
 */

import { createLogger } from '../utils/index.js';
import type { StructuredProductData } from '../browser/dom/structured-data.js';

const logger = createLogger('Reconciliation');

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * DOM-extracted price value
 */
export interface DOMPrice {
  /** Viewport-prefixed reference [v0-0], [v1-5] */
  viewportRef: string;
  /** Raw text value from DOM */
  value: string;
  /** Parsed numeric value (if parseable) */
  numericValue?: number;
  /** Currency symbol found */
  currency?: string;
}

/**
 * Data source priority for conflict resolution
 * Higher priority sources are preferred when values conflict.
 */
export type DataSource = 'json-ld' | 'dom' | 'unknown';

/**
 * Result of reconciliation check
 */
export interface ReconciliationResult {
  /** Whether reconciliation passed (no critical mismatches) */
  passed: boolean;
  /** Data source used for final values (precedence) */
  preferredSource: DataSource;
  /** Warnings generated during reconciliation */
  warnings: string[];
  /** Specific mismatches found */
  mismatches: ReconciliationMismatch[];
  /** Price reconciliation details */
  priceReconciliation?: {
    jsonLdPrice?: number;
    domPrices: DOMPrice[];
    matched: boolean;
    selectedPrice?: number;
  };
  /** Availability reconciliation details */
  availabilityReconciliation?: {
    jsonLdAvailability?: string;
    domAvailability?: string;
    matched: boolean;
  };
}

/**
 * A specific mismatch between structured data and DOM
 */
export interface ReconciliationMismatch {
  /** Field that mismatched */
  field: string;
  /** Value from JSON-LD structured data */
  structuredValue?: string | number;
  /** Value from DOM */
  domValue?: string | number;
  /** Severity of the mismatch */
  severity: 'critical' | 'warning' | 'info';
  /** Human-readable description */
  description: string;
}

/**
 * Configuration for reconciliation
 */
export interface ReconciliationConfig {
  /** Price difference threshold for warning (percentage, default: 5) */
  priceTolerancePercent: number;
  /** Prefer JSON-LD over DOM when both present (default: true) */
  preferJsonLd: boolean;
  /** Include info-level mismatches (default: false) */
  includeInfoLevel: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Default Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: ReconciliationConfig = {
  priceTolerancePercent: 5,
  preferJsonLd: true,
  includeInfoLevel: false,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse a price string to a numeric value
 */
function parsePrice(value: string): number | undefined {
  if (!value) return undefined;

  // Remove currency symbols, spaces, and common separators
  const cleaned = value
    .replace(/[£$€¥₹]/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();

  // Try to parse as float
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Extract currency from price string
 */
function extractCurrency(value: string): string | undefined {
  const match = value.match(/[£$€¥₹]|USD|GBP|EUR|INR|JPY/i);
  return match ? match[0] : undefined;
}

/**
 * Check if two prices are approximately equal within tolerance
 */
function pricesMatch(
  price1: number,
  price2: number,
  tolerancePercent: number
): boolean {
  if (price1 === 0 && price2 === 0) return true;
  if (price1 === 0 || price2 === 0) return false;

  const diff = Math.abs(price1 - price2);
  const avgPrice = (price1 + price2) / 2;
  const percentDiff = (diff / avgPrice) * 100;

  return percentDiff <= tolerancePercent;
}

/**
 * Normalize availability string for comparison
 */
function normalizeAvailability(value: string): string {
  const lower = value.toLowerCase().trim();

  // Map common variations
  if (lower.includes('in stock') || lower.includes('instock') || lower === 'available') {
    return 'InStock';
  }
  if (lower.includes('out of stock') || lower.includes('outofstock') || lower === 'sold out') {
    return 'OutOfStock';
  }
  if (lower.includes('preorder') || lower.includes('pre-order')) {
    return 'PreOrder';
  }
  if (lower.includes('backorder') || lower.includes('back-order')) {
    return 'BackOrder';
  }
  if (lower.includes('limited')) {
    return 'LimitedAvailability';
  }

  return value;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Reconciliation Function
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reconcile structured data against DOM-extracted values
 *
 * Precedence rules:
 * 1. JSON-LD is preferred when both present (more reliable for SEO/schema)
 * 2. DOM is used as fallback when JSON-LD is missing
 * 3. Warnings are generated for significant mismatches
 *
 * @param structured - JSON-LD structured product data (can be null)
 * @param domPrices - Prices extracted from DOM
 * @param domAvailability - Availability text from DOM (optional)
 * @param config - Reconciliation configuration
 * @returns Reconciliation result with warnings
 */
export function reconcileStructuredVsDOM(
  structured: StructuredProductData | null,
  domPrices: DOMPrice[],
  domAvailability?: string,
  config: Partial<ReconciliationConfig> = {}
): ReconciliationResult {
  const fullConfig: ReconciliationConfig = { ...DEFAULT_CONFIG, ...config };
  const warnings: string[] = [];
  const mismatches: ReconciliationMismatch[] = [];
  let passed = true;

  logger.debug('Starting reconciliation', {
    hasStructured: structured !== null,
    domPriceCount: domPrices.length,
    hasdomAvailability: !!domAvailability,
  });

  // Determine preferred source
  const preferredSource: DataSource = structured && fullConfig.preferJsonLd
    ? 'json-ld'
    : domPrices.length > 0
      ? 'dom'
      : 'unknown';

  // ─────────────────────────────────────────────────────────────────────────────
  // Price Reconciliation
  // ─────────────────────────────────────────────────────────────────────────────

  const jsonLdPrice = structured?.price;
  const domPriceValues = domPrices
    .map(p => ({
      ...p,
      numericValue: p.numericValue ?? parsePrice(p.value),
      currency: p.currency ?? extractCurrency(p.value),
    }))
    .filter(p => p.numericValue !== undefined);

  let priceMatched = true;
  let selectedPrice: number | undefined;

  // Check for price presence
  if (jsonLdPrice === undefined && domPriceValues.length === 0) {
    warnings.push('No price found in JSON-LD or DOM');
    if (fullConfig.includeInfoLevel) {
      mismatches.push({
        field: 'price',
        severity: 'info',
        description: 'No price found in any data source',
      });
    }
    priceMatched = false;
  } else if (jsonLdPrice !== undefined && domPriceValues.length === 0) {
    // JSON-LD has price but DOM doesn't
    warnings.push('Price in JSON-LD but not detected in visible DOM elements');
    mismatches.push({
      field: 'price',
      structuredValue: jsonLdPrice,
      severity: 'warning',
      description: `Price ${jsonLdPrice} found in JSON-LD but no matching DOM element`,
    });
    selectedPrice = jsonLdPrice;
  } else if (jsonLdPrice === undefined && domPriceValues.length > 0) {
    // DOM has price but JSON-LD doesn't
    warnings.push('Price found in DOM but not in JSON-LD structured data');
    mismatches.push({
      field: 'price',
      domValue: domPriceValues[0]?.numericValue,
      severity: 'warning',
      description: 'Price visible on page but missing from JSON-LD schema',
    });
    selectedPrice = domPriceValues[0]?.numericValue;
  } else if (jsonLdPrice !== undefined && domPriceValues.length > 0) {
    // Both have prices - check for match
    const matchingDomPrice = domPriceValues.find(p =>
      p.numericValue !== undefined && pricesMatch(jsonLdPrice, p.numericValue, fullConfig.priceTolerancePercent)
    );

    if (matchingDomPrice) {
      // Prices match
      logger.debug('Price match found', {
        jsonLd: jsonLdPrice,
        dom: matchingDomPrice.numericValue,
      });
      selectedPrice = fullConfig.preferJsonLd ? jsonLdPrice : matchingDomPrice.numericValue;
    } else {
      // Prices don't match - critical mismatch
      const primaryDomPrice = domPriceValues[0]?.numericValue;
      warnings.push(
        `Price mismatch: JSON-LD (${jsonLdPrice}) vs DOM (${primaryDomPrice})`
      );
      mismatches.push({
        field: 'price',
        structuredValue: jsonLdPrice,
        domValue: primaryDomPrice,
        severity: 'critical',
        description: `Significant price difference: JSON-LD shows ${jsonLdPrice}, DOM shows ${primaryDomPrice}`,
      });
      priceMatched = false;
      passed = false;
      // Still select based on preference
      selectedPrice = fullConfig.preferJsonLd ? jsonLdPrice : primaryDomPrice;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Availability Reconciliation
  // ─────────────────────────────────────────────────────────────────────────────

  const jsonLdAvailability = structured?.availability;
  const normalizedJsonLd = jsonLdAvailability ? normalizeAvailability(jsonLdAvailability) : undefined;
  const normalizedDom = domAvailability ? normalizeAvailability(domAvailability) : undefined;
  let availabilityMatched = true;

  if (normalizedJsonLd && normalizedDom) {
    if (normalizedJsonLd !== normalizedDom) {
      warnings.push(
        `Availability mismatch: JSON-LD (${normalizedJsonLd}) vs DOM (${normalizedDom})`
      );
      mismatches.push({
        field: 'availability',
        structuredValue: normalizedJsonLd,
        domValue: normalizedDom,
        severity: 'warning',
        description: 'Stock/availability differs between schema and visible page',
      });
      availabilityMatched = false;
    }
  } else if (normalizedJsonLd && !normalizedDom) {
    if (fullConfig.includeInfoLevel) {
      mismatches.push({
        field: 'availability',
        structuredValue: normalizedJsonLd,
        severity: 'info',
        description: 'Availability in JSON-LD but not detected in DOM',
      });
    }
  } else if (!normalizedJsonLd && normalizedDom) {
    if (fullConfig.includeInfoLevel) {
      mismatches.push({
        field: 'availability',
        domValue: normalizedDom,
        severity: 'info',
        description: 'Availability visible on page but missing from JSON-LD',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Build Result
  // ─────────────────────────────────────────────────────────────────────────────

  const result: ReconciliationResult = {
    passed,
    preferredSource,
    warnings,
    mismatches,
    priceReconciliation: {
      jsonLdPrice,
      domPrices: domPriceValues,
      matched: priceMatched,
      selectedPrice,
    },
    availabilityReconciliation: {
      jsonLdAvailability: normalizedJsonLd,
      domAvailability: normalizedDom,
      matched: availabilityMatched,
    },
  };

  logger.debug('Reconciliation complete', {
    passed,
    warningCount: warnings.length,
    mismatchCount: mismatches.length,
    preferredSource,
  });

  return result;
}

/**
 * Extract DOM prices from element boxes or DOM tree
 * Helper function to build DOMPrice array from extraction results
 */
export function extractDOMPrices(
  elements: Array<{ viewportRef: string; text: string; croType: string }>
): DOMPrice[] {
  return elements
    .filter(e => e.croType === 'price' && e.text)
    .map(e => ({
      viewportRef: e.viewportRef,
      value: e.text,
      numericValue: parsePrice(e.text),
      currency: extractCurrency(e.text),
    }));
}
