/**
 * Playwright Page Type Detector - Phase 24 (T450-T455)
 *
 * Primary tier for page type detection using Playwright's live DOM access.
 * Analyzes JSON-LD schemas, CTAs, variants, media galleries, and anti-signals.
 */

/// <reference lib="dom" />

import type { Page, Locator } from 'playwright';
import type { PageType } from '../models/page-type.js';
import { createLogger } from '../utils/index.js';

const logger = createLogger('PlaywrightPageDetector');

/**
 * Signals detected during PDP analysis
 */
export interface PdpSignals {
  addToCart: boolean;
  buyNow: boolean;
  primaryCtaText?: string;
  primaryCtaSelector?: string;
  ctaDisabled?: boolean;

  schemaProduct: boolean;
  schemaOffersPrice?: number;
  schemaCurrency?: string;

  title?: string;

  priceFound: boolean;
  price?: number;
  currency?: string;

  variants: boolean;
  variantCount?: number;
  variantNames?: string[];

  mediaGallery: boolean;
  mediaCount?: number;

  plpGrid: boolean;
  cartPattern: boolean;
  checkoutPattern: boolean;
}

/**
 * Evidence collected during detection for debugging
 */
export interface PlaywrightDetectionEvidence {
  title?: string;
  price?: { amount?: number; currency?: string };
  cta?: { text?: string; selector?: string; disabled?: boolean };
  variants?: { count?: number; names?: string[] };
  media?: { count?: number };
  schema?: { hasProduct: boolean; price?: number; currency?: string };
}

/**
 * Result of Playwright-based page type detection
 */
export interface PlaywrightDetectionResult {
  /** Detected page type */
  pageType: PageType;
  /** Confidence score 0-1 */
  confidence: number;
  /** Raw score before confidence mapping */
  score: number;
  /** All detected signals */
  signals: PdpSignals;
  /** Evidence for debugging */
  evidence: PlaywrightDetectionEvidence;
  /** Detection tier that produced this result */
  tier: 'playwright';
}

// ============================================================================
// Helper Functions
// ============================================================================

const normalizeText = (s: string): string =>
  s.replace(/\s+/g, ' ').trim().toLowerCase();

const parsePriceNumber = (s: string): number | undefined => {
  // Extract first plausible numeric value like 1,299.00 or 1299
  const m = s.replace(/,/g, '').match(/(\d{1,6})(\.\d{1,2})?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : undefined;
};

async function isVisibleEnabled(locator: Locator): Promise<{ visible: boolean; disabled: boolean | undefined }> {
  try {
    const visible = await locator.first().isVisible();
    if (!visible) return { visible: false, disabled: undefined };
    const disabled = await locator.first().isDisabled().catch(() => undefined);
    return { visible: true, disabled };
  } catch {
    return { visible: false, disabled: undefined };
  }
}

async function getFirstVisibleText(locator: Locator): Promise<string | undefined> {
  const count = await locator.count();
  for (let i = 0; i < Math.min(count, 10); i++) {
    const item = locator.nth(i);
    if (await item.isVisible().catch(() => false)) {
      const t = await item.innerText().catch(() => '');
      const nt = normalizeText(t);
      if (nt) return t.trim();
    }
  }
  return undefined;
}

// ============================================================================
// JSON-LD Parsing
// ============================================================================

async function extractJsonLd(page: Page): Promise<unknown[]> {
  return page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    const out: unknown[] = [];
    for (const s of scripts) {
      const text = s.textContent?.trim();
      if (!text) continue;
      try {
        const parsed = JSON.parse(text);
        out.push(parsed);
      } catch {
        // ignore malformed JSON
      }
    }
    return out;
  });
}

function flattenJsonLd(node: unknown): unknown[] {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(flattenJsonLd);
  // Some JSON-LD has @graph
  if (typeof node === 'object' && node !== null && '@graph' in node) {
    return flattenJsonLd((node as Record<string, unknown>)['@graph']);
  }
  return [node];
}

interface ProductSchemaResult {
  hasProduct: boolean;
  price?: number;
  currency?: string;
}

function findProductInJsonLd(jsonLd: unknown[]): ProductSchemaResult {
  const all = jsonLd.flatMap(flattenJsonLd);
  const products = all.filter((x) => {
    if (typeof x !== 'object' || x === null) return false;
    const t = (x as Record<string, unknown>)['@type'];
    if (!t) return false;
    if (Array.isArray(t)) return t.map(String).includes('Product');
    return String(t) === 'Product';
  });

  if (!products.length) return { hasProduct: false };

  // Pick the first product
  const p = products[0] as Record<string, unknown>;
  const offers = p.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
  const offer = Array.isArray(offers) ? offers[0] : offers;

  const price = offer?.price ?? offer?.lowPrice;
  const currency = offer?.priceCurrency;

  const priceNum =
    typeof price === 'number'
      ? price
      : typeof price === 'string'
        ? parsePriceNumber(price)
        : undefined;

  return {
    hasProduct: true,
    price: priceNum,
    currency: typeof currency === 'string' ? currency : undefined,
  };
}

// ============================================================================
// CTA Detection
// ============================================================================

interface CtaCandidate {
  text: string;
  selectorHint: string;
  score: number;
}

interface CtaDetectionResult {
  addToCart: boolean;
  buyNow: boolean;
  primaryCtaText?: string;
  primaryCtaSelector?: string;
  ctaDisabled?: boolean;
}

async function detectPrimaryCTA(page: Page): Promise<CtaDetectionResult> {
  // Common CTA selectors + text match
  const candidateSelectors = [
    // attribute / id / testid patterns
    'button[name="add"]',
    'button[id*="add" i]',
    'button[id*="cart" i]',
    'button[data-testid*="add" i]',
    'button[data-test*="add" i]',
    'button[type="submit"]',
    'input[type="submit"]',

    // Shopify-ish / commerce-ish
    'form[action*="cart" i] button',
    'button[name*="add" i]',
  ];

  const ctaTextMatchers = ['add to cart', 'add to bag', 'add to basket', 'buy now', 'add'];

  // Find buttons/inputs and rank them by match
  const handle = await page.evaluateHandle(
    ({ candidateSelectors, ctaTextMatchers }) => {
      const matches: { text: string; selectorHint: string; score: number }[] = [];

      const getSelectorHint = (el: Element): string => {
        const id = (el as HTMLElement).id;
        if (id) return `#${id}`;
        const testid = el.getAttribute('data-testid') || el.getAttribute('data-test');
        if (testid) return `[data-testid="${testid}"]`;
        const name = el.getAttribute('name');
        if (name) return `[name="${name}"]`;
        const cls = (el as HTMLElement).className;
        if (typeof cls === 'string' && cls.trim()) {
          const first = cls.trim().split(/\s+/)[0];
          return `.${first}`;
        }
        return el.tagName.toLowerCase();
      };

      const isVisible = (el: Element): boolean => {
        const r = (el as HTMLElement).getBoundingClientRect();
        const style = window.getComputedStyle(el as HTMLElement);
        return (
          r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
        );
      };

      const seen = new Set<Element>();
      for (const sel of candidateSelectors) {
        document.querySelectorAll(sel).forEach((el) => {
          if (seen.has(el)) return;
          seen.add(el);

          if (!isVisible(el)) return;

          const text =
            (el instanceof HTMLInputElement ? el.value : (el as HTMLElement).innerText) || '';
          const t = text.trim().toLowerCase();
          if (!t) return;

          let score = 0;
          for (const m of ctaTextMatchers) {
            if (t.includes(m)) score += m.length >= 6 ? 20 : 10;
          }

          // Bonus if it's inside a form (purchase flow)
          if (el.closest('form')) score += 5;

          matches.push({
            text: text.trim(),
            selectorHint: getSelectorHint(el),
            score,
          });
        });
      }

      matches.sort((a, b) => b.score - a.score);
      return matches.slice(0, 5);
    },
    { candidateSelectors, ctaTextMatchers }
  );

  const candidates = (await handle.jsonValue()) as CtaCandidate[];

  if (!candidates.length || !candidates[0]) {
    return { addToCart: false, buyNow: false };
  }

  const best = candidates[0];
  const bestText = normalizeText(best.text);
  const addToCart =
    bestText.includes('add to cart') ||
    bestText.includes('add to bag') ||
    bestText.includes('add to basket') ||
    bestText === 'add';
  const buyNow = bestText.includes('buy now');

  // Try to locate that element again for disabled check (best-effort)
  const locator = page.locator(best.selectorHint);
  const { visible, disabled } = await isVisibleEnabled(locator);

  return {
    addToCart: addToCart && visible,
    buyNow: buyNow && visible,
    primaryCtaText: best.text,
    primaryCtaSelector: best.selectorHint,
    ctaDisabled: disabled,
  };
}

// ============================================================================
// Title Extraction
// ============================================================================

async function extractTitle(page: Page): Promise<string | undefined> {
  // Prefer first visible h1
  const h1 = page.locator('h1');
  const h1Text = await getFirstVisibleText(h1);
  if (h1Text) return h1Text;

  // Fallback og:title
  const og = await page
    .locator('meta[property="og:title"]')
    .getAttribute('content')
    .catch(() => null);
  return og || undefined;
}

// ============================================================================
// Variant Detection
// ============================================================================

interface VariantDetectionResult {
  variants: boolean;
  variantCount?: number;
  variantNames?: string[];
}

async function detectVariants(page: Page): Promise<VariantDetectionResult> {
  // Selects commonly used for variants
  const selects = page.locator(
    'select[name*="option" i], select[id*="option" i], select[name*="variant" i], select[id*="variant" i]'
  );
  const radios = page.locator(
    'input[type="radio"][name*="option" i], input[type="radio"][name*="variant" i]'
  );
  const swatches = page.locator('[class*="swatch" i], [data-testid*="swatch" i]');

  const selectCount = await selects.count();
  const radioCount = await radios.count();
  const swatchCount = await swatches.count();

  const hasVariants = selectCount > 0 || radioCount > 3 || swatchCount > 0;

  // Try to extract variant names from labels near selects (best-effort)
  const variantNames = await page.evaluate(() => {
    const names: string[] = [];
    const selects = Array.from(
      document.querySelectorAll(
        'select[name*="option" i], select[id*="option" i], select[name*="variant" i], select[id*="variant" i]'
      )
    );
    for (const sel of selects) {
      const label =
        (sel.id && document.querySelector(`label[for="${sel.id}"]`)?.textContent) ||
        sel.closest('label')?.textContent ||
        sel.closest("[class*='option' i]")?.querySelector('label')?.textContent ||
        '';
      const n = label.replace(/\s+/g, ' ').trim();
      if (n) names.push(n);
    }
    return Array.from(new Set(names)).slice(0, 5);
  });

  return {
    variants: hasVariants,
    variantCount: selectCount + radioCount,
    variantNames: variantNames.length ? variantNames : undefined,
  };
}

// ============================================================================
// Media Gallery Detection
// ============================================================================

interface MediaDetectionResult {
  mediaGallery: boolean;
  mediaCount: number;
}

async function detectMediaGallery(page: Page): Promise<MediaDetectionResult> {
  // Count distinct visible images - rough heuristic
  const imgs = await page.evaluate(() => {
    const all = Array.from(document.images || []);
    const visible = all.filter((img) => {
      const r = img.getBoundingClientRect();
      return r.width > 40 && r.height > 40;
    });
    const srcs = visible.map((i) => i.currentSrc || i.src).filter(Boolean);
    const uniq = Array.from(new Set(srcs));
    return uniq.slice(0, 30);
  });

  const mediaCount = imgs.length;
  return {
    mediaGallery: mediaCount >= 3,
    mediaCount,
  };
}

// ============================================================================
// Anti-Signal Detection (PLP, Cart, Checkout)
// ============================================================================

async function detectPLPGrid(page: Page): Promise<{ plpGrid: boolean }> {
  // Heuristic: many links to product URLs OR many repeated "Add to cart" inside cards
  const productLinkCount = await page
    .locator('a[href*="/product" i], a[href*="/products/" i], a[href*="/p/" i]')
    .count();

  const hasFilters =
    (await page
      .locator(
        'select[name*="sort" i], [class*="filter" i], [data-testid*="filter" i], [aria-label*="filter" i]'
      )
      .count()) > 0;

  // Detect many "card-like" repeating elements
  const productCardLike = await page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll(
        '[data-product-id], [data-testid*="product" i], [class*="product-card" i], [class*="product-tile" i]'
      )
    );
    return candidates.length;
  });

  const likelyGrid = productLinkCount >= 8 || productCardLike >= 8;
  return { plpGrid: likelyGrid && hasFilters };
}

async function detectCartPattern(page: Page): Promise<{ cartPattern: boolean }> {
  const hasSubtotal = (await page.locator('text=/subtotal/i').count()) > 0;
  const hasCheckout = (await page.locator('text=/checkout/i').count()) > 0;
  const qtyInputs = await page
    .locator('input[type="number"], select[name*="quantity" i], input[name*="quantity" i]')
    .count();
  const lineItems = await page.evaluate(() => {
    const els = document.querySelectorAll(
      '[class*="cart-item" i], [data-testid*="cart-item" i], [id*="cart" i] [class*="item" i]'
    );
    return els.length;
  });

  return { cartPattern: (hasSubtotal && hasCheckout) || (lineItems >= 2 && qtyInputs >= 1) };
}

async function detectCheckoutPattern(page: Page): Promise<{ checkoutPattern: boolean }> {
  const hasAddress =
    (await page.locator('input[name*="address" i], input[id*="address" i]').count()) > 0;
  const hasPayment = (await page.locator('text=/payment/i').count()) > 0;
  const hasShipping = (await page.locator('text=/shipping/i').count()) > 0;
  return { checkoutPattern: hasAddress && (hasPayment || hasShipping) };
}

// ============================================================================
// Score to Confidence Mapping
// ============================================================================

function scoreToConfidence(score: number): number {
  // Smooth mapping
  if (score >= 80) return 0.95;
  if (score >= 70) return 0.9;
  if (score >= 55) return 0.8;
  if (score >= 40) return 0.65;
  if (score >= 30) return 0.55;
  return 0.4;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect if page is a PDP using Playwright's live DOM access.
 * This is the primary tier for page type detection.
 *
 * @param page - Playwright Page object
 * @returns Detection result with page type, confidence, signals, and evidence
 */
export async function detectPdp(page: Page): Promise<PlaywrightDetectionResult> {
  logger.debug('Starting Playwright PDP detection');

  const jsonLd = await extractJsonLd(page);
  const schema = findProductInJsonLd(jsonLd);

  const cta = await detectPrimaryCTA(page);
  const title = await extractTitle(page);
  const variants = await detectVariants(page);
  const media = await detectMediaGallery(page);

  const plp = await detectPLPGrid(page);
  const cart = await detectCartPattern(page);
  const checkout = await detectCheckoutPattern(page);

  // Price strategy:
  // 1) schema
  let price = schema.hasProduct ? schema.price : undefined;
  let currency = schema.hasProduct ? schema.currency : undefined;

  // 2) meta fallback
  if (price == null) {
    const metaAmount =
      (await page
        .locator('meta[property="product:price:amount"]')
        .getAttribute('content')
        .catch(() => null)) ||
      (await page
        .locator('meta[property="og:price:amount"]')
        .getAttribute('content')
        .catch(() => null));

    const metaCurrency =
      (await page
        .locator('meta[property="product:price:currency"]')
        .getAttribute('content')
        .catch(() => null)) ||
      (await page
        .locator('meta[property="og:price:currency"]')
        .getAttribute('content')
        .catch(() => null));

    if (metaAmount) price = parsePriceNumber(metaAmount);
    if (metaCurrency) currency = metaCurrency;
  }

  const priceFound = price != null;

  // Scoring
  let score = 0;

  // Tier A - positive signals
  if (cta.addToCart) score += 30;
  if (cta.buyNow) score += 20;
  if (schema.hasProduct) score += 25;
  if (priceFound) score += 15;
  if (variants.variants) score += 15;
  if (media.mediaGallery) score += 10;

  // Small bonuses
  if (title) score += 5;
  if (cta.ctaDisabled === true) score -= 5; // could be sold out; minor penalty

  // Anti-signals
  if (plp.plpGrid) score -= 25;
  if (cart.cartPattern) score -= 20;
  if (checkout.checkoutPattern) score -= 20;

  // Cap score range
  score = Math.max(0, Math.min(100, score));

  const confidence = scoreToConfidence(score);

  // Determine page type based on signals
  let pageType: PageType = 'other';

  if (cart.cartPattern) {
    pageType = 'cart';
  } else if (checkout.checkoutPattern) {
    pageType = 'checkout';
  } else if (plp.plpGrid && score < 40) {
    pageType = 'plp';
  } else if (score >= 55) {
    pageType = 'pdp';
  }

  const signals: PdpSignals = {
    addToCart: cta.addToCart,
    buyNow: cta.buyNow,
    primaryCtaText: cta.primaryCtaText,
    primaryCtaSelector: cta.primaryCtaSelector,
    ctaDisabled: cta.ctaDisabled,

    schemaProduct: schema.hasProduct,
    schemaOffersPrice: schema.hasProduct ? schema.price : undefined,
    schemaCurrency: schema.hasProduct ? schema.currency : undefined,

    title,
    priceFound,
    price,
    currency,

    variants: variants.variants,
    variantCount: variants.variantCount,
    variantNames: variants.variantNames,

    mediaGallery: media.mediaGallery,
    mediaCount: media.mediaCount,

    plpGrid: plp.plpGrid,
    cartPattern: cart.cartPattern,
    checkoutPattern: checkout.checkoutPattern,
  };

  logger.info(`Playwright detection: ${pageType} (confidence: ${confidence.toFixed(2)}, score: ${score})`);
  logger.debug('Signals:', { ...signals } as Record<string, unknown>);

  return {
    pageType,
    confidence,
    score,
    signals,
    evidence: {
      title,
      price: { amount: price, currency },
      cta: { text: cta.primaryCtaText, selector: cta.primaryCtaSelector, disabled: cta.ctaDisabled },
      variants: { count: variants.variantCount, names: variants.variantNames },
      media: { count: media.mediaCount },
      schema: {
        hasProduct: schema.hasProduct,
        price: schema.hasProduct ? schema.price : undefined,
        currency: schema.hasProduct ? schema.currency : undefined,
      },
    },
    tier: 'playwright',
  };
}

// ============================================================================
// Class Wrapper (T456)
// ============================================================================

/**
 * Configuration for Playwright page type detection
 */
export interface PlaywrightPageTypeDetectorConfig {
  /** Minimum score to classify as PDP (default: 55) */
  pdpScoreThreshold: number;
  /** Minimum score to classify as PLP when grid detected (default: 40) */
  plpScoreThreshold: number;
}

const DEFAULT_PLAYWRIGHT_CONFIG: PlaywrightPageTypeDetectorConfig = {
  pdpScoreThreshold: 55,
  plpScoreThreshold: 40,
};

/**
 * Playwright-based page type detector class.
 * Wraps detectPdp() and handles multi-page-type detection.
 */
export class PlaywrightPageTypeDetector {
  private config: PlaywrightPageTypeDetectorConfig;

  constructor(config: Partial<PlaywrightPageTypeDetectorConfig> = {}) {
    this.config = { ...DEFAULT_PLAYWRIGHT_CONFIG, ...config };
  }

  /**
   * Detect page type using Playwright's live DOM access
   * @param page - Playwright Page object
   * @param url - URL of the page (for homepage detection)
   */
  async detect(page: Page, url?: string): Promise<PlaywrightDetectionResult> {
    // Check for homepage first (root path with low PDP signals)
    if (url && this.isHomepagePath(url)) {
      const result = await detectPdp(page);

      // If on root path and low PDP signals, classify as homepage
      if (result.score < 30) {
        logger.info('Detected homepage (root path with low PDP signals)');
        return {
          ...result,
          pageType: 'homepage',
          confidence: 0.85,
        };
      }
    }

    return detectPdp(page);
  }

  /**
   * Check if URL is a homepage path
   */
  private isHomepagePath(url: string): boolean {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname;
      return (
        path === '/' ||
        path === '' ||
        path === '/index.html' ||
        path === '/index.htm' ||
        path === '/home' ||
        path === '/home/'
      );
    } catch {
      return false;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PlaywrightPageTypeDetectorConfig {
    return { ...this.config };
  }
}

/**
 * Create a new Playwright page type detector
 */
export function createPlaywrightPageTypeDetector(
  config?: Partial<PlaywrightPageTypeDetectorConfig>
): PlaywrightPageTypeDetector {
  return new PlaywrightPageTypeDetector(config);
}
