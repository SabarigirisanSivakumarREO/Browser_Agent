/**
 * Page Analyzer - Understands page purpose and conversion goal
 *
 * Instead of pattern matching all elements, this module:
 * 1. Identifies what TYPE of page this is
 * 2. Determines the BUSINESS GOAL
 * 3. Finds the PRIMARY ACTION
 * 4. Maps the CONVERSION FUNNEL
 */

import type { Page } from 'playwright';
import { createLogger } from '../utils/index.js';

const logger = createLogger('PageAnalyzer');

// ============================================================================
// Types
// ============================================================================

export type PageType = 'pdp' | 'plp' | 'homepage' | 'lead_gen' | 'saas_landing' | 'checkout' | 'cart' | 'category' | 'search_results' | 'unknown';

export type BusinessGoal = 'purchase' | 'signup' | 'lead_capture' | 'engagement' | 'information' | 'unknown';

export interface PageSignals {
  // URL signals
  urlPatterns: string[];

  // Content signals
  hasProductTitle: boolean;
  hasPrice: boolean;
  hasPriceRange: boolean;
  hasAddToCart: boolean;
  hasProductImages: boolean;
  hasVariantSelectors: boolean;
  hasProductGrid: boolean;
  hasLeadForm: boolean;
  hasSignupForm: boolean;
  hasPricingTable: boolean;
  hasHeroSection: boolean;
  hasCheckoutForm: boolean;
  hasCartItems: boolean;

  // Structural signals
  productCount: number;
  formCount: number;
  ctaCount: number;
}

export interface PageAnalysis {
  pageType: PageType;
  pageTypeConfidence: number;
  businessGoal: BusinessGoal;
  signals: PageSignals;
  reasoning: string[];
}

// ============================================================================
// Signal Detection
// ============================================================================

/**
 * Detect page signals from URL
 */
function detectURLSignals(url: string): string[] {
  const signals: string[] = [];
  const urlLower = url.toLowerCase();

  // PDP patterns
  if (/\/(product|item|p|pd|goods)\//.test(urlLower)) signals.push('url_product_path');
  if (/\/products?\/[a-z0-9-]+$/i.test(urlLower)) signals.push('url_product_slug');
  if (/[?&](sku|variant|size|color)=/i.test(urlLower)) signals.push('url_variant_params');

  // PLP patterns
  if (/\/(category|collection|shop|catalog|c)\//.test(urlLower)) signals.push('url_category_path');
  if (/[?&](page|sort|filter)=/i.test(urlLower)) signals.push('url_listing_params');

  // Checkout patterns
  if (/\/(checkout|payment|order)/.test(urlLower)) signals.push('url_checkout_path');

  // Cart patterns
  if (/\/(cart|basket|bag)/.test(urlLower)) signals.push('url_cart_path');

  // Lead gen / landing
  if (/\/(landing|lp|offer|promo|get|try|demo)/.test(urlLower)) signals.push('url_landing_path');

  // Pricing
  if (/\/(pricing|plans|packages)/.test(urlLower)) signals.push('url_pricing_path');

  // Homepage
  if (urlLower.match(/^https?:\/\/[^\/]+\/?$/)) signals.push('url_homepage');

  return signals;
}

/**
 * Browser script to detect content signals
 */
const SIGNAL_DETECTION_SCRIPT = `
(function() {
  const signals = {
    hasProductTitle: false,
    hasPrice: false,
    hasPriceRange: false,
    hasAddToCart: false,
    hasProductImages: false,
    hasVariantSelectors: false,
    hasProductGrid: false,
    hasLeadForm: false,
    hasSignupForm: false,
    hasPricingTable: false,
    hasHeroSection: false,
    hasCheckoutForm: false,
    hasCartItems: false,
    productCount: 0,
    formCount: 0,
    ctaCount: 0,
  };

  // Helper: check text content
  function textContains(el, patterns) {
    const text = (el.textContent || '').toLowerCase();
    return patterns.some(p => text.includes(p));
  }

  // Helper: check class/id contains
  function hasClassOrId(el, patterns) {
    const classId = ((el.className || '') + ' ' + (el.id || '')).toLowerCase();
    return patterns.some(p => classId.includes(p));
  }

  // Detect price (currency symbols, price patterns)
  const priceRegex = /[\\$\\£\\€\\¥]\\s*\\d+([.,]\\d{2})?|\\d+([.,]\\d{2})?\\s*[\\$\\£\\€\\¥]|\\d+([.,]\\d{2})?\\s*(USD|EUR|GBP|INR|JPY)/i;
  const allText = document.body.innerText || '';
  signals.hasPrice = priceRegex.test(allText);

  // Detect price range
  const priceRangeRegex = /[\\$\\£\\€]\\s*\\d+\\s*[-–]\\s*[\\$\\£\\€]?\\s*\\d+/;
  signals.hasPriceRange = priceRangeRegex.test(allText);

  // Detect Add to Cart button
  const buttons = document.querySelectorAll('button, a[role="button"], input[type="submit"], [class*="btn"], [class*="button"]');
  for (const btn of buttons) {
    const text = (btn.textContent || btn.value || '').toLowerCase();
    const classId = ((btn.className || '') + ' ' + (btn.id || '')).toLowerCase();

    // Add to cart detection
    if (text.match(/add\\s*(to)?\\s*(cart|bag|basket)/i) || classId.includes('add-to-cart') || classId.includes('addtocart')) {
      signals.hasAddToCart = true;
    }

    // Count CTAs
    if (text.match(/buy|order|subscribe|sign\\s*up|get\\s*started|try|add\\s*to|checkout|submit|register/i)) {
      signals.ctaCount++;
    }
  }

  // Detect variant selectors (size, color)
  const selects = document.querySelectorAll('select, [role="listbox"], [class*="variant"], [class*="option"], [class*="swatch"]');
  for (const sel of selects) {
    const text = (sel.textContent || '').toLowerCase();
    const classId = ((sel.className || '') + ' ' + (sel.id || '')).toLowerCase();
    if (text.match(/size|color|colour|variant|option/i) || classId.match(/size|color|colour|variant|option|swatch/i)) {
      signals.hasVariantSelectors = true;
      break;
    }
  }

  // Detect product images
  const images = document.querySelectorAll('img, picture');
  for (const img of images) {
    const classId = ((img.className || '') + ' ' + (img.id || '')).toLowerCase();
    const alt = (img.alt || '').toLowerCase();
    const src = (img.src || '').toLowerCase();
    if (classId.match(/product|gallery|main-image|hero-image/i) ||
        alt.match(/product/i) ||
        src.match(/product/i)) {
      signals.hasProductImages = true;
      break;
    }
  }

  // Detect product title (h1 that looks like a product name)
  const h1s = document.querySelectorAll('h1');
  for (const h1 of h1s) {
    const classId = ((h1.className || '') + ' ' + (h1.id || '')).toLowerCase();
    if (classId.match(/product|title|name/i)) {
      signals.hasProductTitle = true;
      break;
    }
    // Also check if h1 is near a price
    const parent = h1.closest('div, section, article');
    if (parent && priceRegex.test(parent.textContent || '')) {
      signals.hasProductTitle = true;
      break;
    }
  }

  // Detect product grid (PLP)
  const grids = document.querySelectorAll('[class*="product-grid"], [class*="product-list"], [class*="products"], [class*="grid"]');
  const productCards = document.querySelectorAll('[class*="product-card"], [class*="product-item"], [class*="product-tile"]');
  signals.productCount = productCards.length;
  signals.hasProductGrid = productCards.length > 2;

  // Detect forms
  const forms = document.querySelectorAll('form');
  signals.formCount = forms.length;

  for (const form of forms) {
    const text = (form.textContent || '').toLowerCase();
    const classId = ((form.className || '') + ' ' + (form.id || '')).toLowerCase();
    const action = (form.action || '').toLowerCase();

    // Lead form detection
    if (text.match(/contact|get\\s*(in)?\\s*touch|request|demo|quote|inquiry|enquiry/i) ||
        classId.match(/contact|lead|inquiry|demo/i)) {
      signals.hasLeadForm = true;
    }

    // Signup form detection
    if (text.match(/sign\\s*up|register|create\\s*account|join/i) ||
        classId.match(/signup|register|join/i) ||
        action.match(/signup|register/i)) {
      signals.hasSignupForm = true;
    }

    // Checkout form detection
    if (classId.match(/checkout|payment|billing|shipping/i) ||
        text.match(/credit\\s*card|payment\\s*method|billing\\s*address/i)) {
      signals.hasCheckoutForm = true;
    }
  }

  // Detect hero section
  const heroes = document.querySelectorAll('[class*="hero"], [class*="banner"], [class*="jumbotron"]');
  signals.hasHeroSection = heroes.length > 0;

  // Detect pricing table
  const pricingElements = document.querySelectorAll('[class*="pricing"], [class*="plans"], [class*="packages"]');
  signals.hasPricingTable = pricingElements.length > 0;

  // Detect cart items
  const cartItems = document.querySelectorAll('[class*="cart-item"], [class*="basket-item"], [class*="line-item"]');
  signals.hasCartItems = cartItems.length > 0;

  return signals;
})();
`;

/**
 * Detect content signals from page
 */
async function detectContentSignals(page: Page): Promise<Omit<PageSignals, 'urlPatterns'>> {
  try {
    const signals = await page.evaluate(SIGNAL_DETECTION_SCRIPT) as Omit<PageSignals, 'urlPatterns'>;
    return signals;
  } catch (error) {
    logger.warn('Failed to detect content signals', { error });
    return {
      hasProductTitle: false,
      hasPrice: false,
      hasPriceRange: false,
      hasAddToCart: false,
      hasProductImages: false,
      hasVariantSelectors: false,
      hasProductGrid: false,
      hasLeadForm: false,
      hasSignupForm: false,
      hasPricingTable: false,
      hasHeroSection: false,
      hasCheckoutForm: false,
      hasCartItems: false,
      productCount: 0,
      formCount: 0,
      ctaCount: 0,
    };
  }
}

// ============================================================================
// Page Type Classification
// ============================================================================

interface ClassificationResult {
  type: PageType;
  confidence: number;
  reasoning: string[];
}

/**
 * Classify page type based on signals
 */
function classifyPageType(signals: PageSignals): ClassificationResult {
  const scores: Record<PageType, { score: number; reasons: string[] }> = {
    pdp: { score: 0, reasons: [] },
    plp: { score: 0, reasons: [] },
    homepage: { score: 0, reasons: [] },
    lead_gen: { score: 0, reasons: [] },
    saas_landing: { score: 0, reasons: [] },
    checkout: { score: 0, reasons: [] },
    cart: { score: 0, reasons: [] },
    category: { score: 0, reasons: [] },
    search_results: { score: 0, reasons: [] },
    unknown: { score: 0, reasons: [] },
  };

  // PDP scoring
  if (signals.hasAddToCart) {
    scores.pdp.score += 35;
    scores.pdp.reasons.push('Has Add to Cart button');
  }
  if (signals.hasPrice && !signals.hasPriceRange) {
    scores.pdp.score += 20;
    scores.pdp.reasons.push('Has single price');
  }
  if (signals.hasProductTitle) {
    scores.pdp.score += 15;
    scores.pdp.reasons.push('Has product title');
  }
  if (signals.hasProductImages) {
    scores.pdp.score += 15;
    scores.pdp.reasons.push('Has product images');
  }
  if (signals.hasVariantSelectors) {
    scores.pdp.score += 15;
    scores.pdp.reasons.push('Has variant selectors');
  }
  if (signals.urlPatterns.includes('url_product_path')) {
    scores.pdp.score += 10;
    scores.pdp.reasons.push('URL indicates product page');
  }
  if (signals.productCount === 0 || signals.productCount === 1) {
    scores.pdp.score += 5;
    scores.pdp.reasons.push('Single product focus');
  }

  // PLP scoring
  if (signals.hasProductGrid) {
    scores.plp.score += 40;
    scores.plp.reasons.push('Has product grid');
  }
  if (signals.productCount > 3) {
    scores.plp.score += 25;
    scores.plp.reasons.push(`Multiple products (${signals.productCount})`);
  }
  if (signals.hasPriceRange) {
    scores.plp.score += 15;
    scores.plp.reasons.push('Has price range');
  }
  if (signals.urlPatterns.includes('url_category_path') || signals.urlPatterns.includes('url_listing_params')) {
    scores.plp.score += 15;
    scores.plp.reasons.push('URL indicates listing page');
  }

  // Checkout scoring
  if (signals.hasCheckoutForm) {
    scores.checkout.score += 50;
    scores.checkout.reasons.push('Has checkout form');
  }
  if (signals.urlPatterns.includes('url_checkout_path')) {
    scores.checkout.score += 30;
    scores.checkout.reasons.push('URL indicates checkout');
  }

  // Cart scoring
  if (signals.hasCartItems) {
    scores.cart.score += 50;
    scores.cart.reasons.push('Has cart items');
  }
  if (signals.urlPatterns.includes('url_cart_path')) {
    scores.cart.score += 30;
    scores.cart.reasons.push('URL indicates cart');
  }

  // Lead gen scoring
  if (signals.hasLeadForm) {
    scores.lead_gen.score += 40;
    scores.lead_gen.reasons.push('Has lead capture form');
  }
  if (signals.hasHeroSection && signals.formCount === 1) {
    scores.lead_gen.score += 20;
    scores.lead_gen.reasons.push('Hero + single form pattern');
  }
  if (signals.urlPatterns.includes('url_landing_path')) {
    scores.lead_gen.score += 15;
    scores.lead_gen.reasons.push('URL indicates landing page');
  }

  // SaaS landing scoring
  if (signals.hasPricingTable) {
    scores.saas_landing.score += 35;
    scores.saas_landing.reasons.push('Has pricing table');
  }
  if (signals.hasSignupForm) {
    scores.saas_landing.score += 25;
    scores.saas_landing.reasons.push('Has signup form');
  }
  if (signals.hasHeroSection) {
    scores.saas_landing.score += 15;
    scores.saas_landing.reasons.push('Has hero section');
  }
  if (signals.urlPatterns.includes('url_pricing_path')) {
    scores.saas_landing.score += 20;
    scores.saas_landing.reasons.push('URL indicates pricing page');
  }

  // Homepage scoring
  if (signals.urlPatterns.includes('url_homepage')) {
    scores.homepage.score += 40;
    scores.homepage.reasons.push('URL is homepage');
  }
  if (signals.hasHeroSection && !signals.hasLeadForm && !signals.hasAddToCart) {
    scores.homepage.score += 20;
    scores.homepage.reasons.push('Hero section without specific conversion action');
  }

  // Find winner
  let winner: PageType = 'unknown';
  let maxScore = 0;

  for (const [type, data] of Object.entries(scores) as [PageType, { score: number; reasons: string[] }][]) {
    if (data.score > maxScore) {
      maxScore = data.score;
      winner = type;
    }
  }

  // Confidence is the score normalized (100 is max possible)
  const confidence = Math.min(maxScore / 100, 1);

  return {
    type: winner,
    confidence,
    reasoning: scores[winner].reasons,
  };
}

/**
 * Determine business goal from page type
 */
function determineBusinessGoal(pageType: PageType): BusinessGoal {
  const goalMap: Record<PageType, BusinessGoal> = {
    pdp: 'purchase',
    plp: 'purchase',
    homepage: 'engagement',
    lead_gen: 'lead_capture',
    saas_landing: 'signup',
    checkout: 'purchase',
    cart: 'purchase',
    category: 'purchase',
    search_results: 'purchase',
    unknown: 'unknown',
  };

  return goalMap[pageType];
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Analyze page to understand its purpose and conversion goal
 */
export async function analyzePage(page: Page): Promise<PageAnalysis> {
  const url = page.url();

  // Gather signals
  const urlSignals = detectURLSignals(url);
  const contentSignals = await detectContentSignals(page);

  const signals: PageSignals = {
    ...contentSignals,
    urlPatterns: urlSignals,
  };

  // Classify page type
  const classification = classifyPageType(signals);

  // Determine business goal
  const businessGoal = determineBusinessGoal(classification.type);

  logger.info('Page analysis complete', {
    url,
    pageType: classification.type,
    confidence: classification.confidence,
    businessGoal,
  });

  return {
    pageType: classification.type,
    pageTypeConfidence: classification.confidence,
    businessGoal,
    signals,
    reasoning: classification.reasoning,
  };
}

/**
 * Quick page type check without full analysis
 */
export async function getPageType(page: Page): Promise<PageType> {
  const analysis = await analyzePage(page);
  return analysis.pageType;
}
