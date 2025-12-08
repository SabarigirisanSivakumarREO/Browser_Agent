/**
 * Business Type Model - Phase 18a (T104)
 *
 * Defines business type classification for CRO analysis.
 * Different business types have different CRO priorities.
 */

/**
 * Supported business types for CRO analysis
 */
export type BusinessType =
  | 'ecommerce'
  | 'saas'
  | 'banking'
  | 'insurance'
  | 'travel'
  | 'media'
  | 'other';

/**
 * Result of business type detection
 */
export interface BusinessTypeResult {
  /** Detected business type */
  type: BusinessType;
  /** Confidence score 0-1 */
  confidence: number;
  /** Signals that led to detection */
  signals: string[];
}

/**
 * Detection signals for a business type
 */
export interface BusinessTypeSignals {
  /** URL patterns (regex strings) */
  urlPatterns: string[];
  /** CSS selectors for characteristic elements */
  elementSelectors: string[];
  /** Keywords in page content */
  keywords: string[];
}

/**
 * Business type detection patterns
 */
export const BUSINESS_TYPE_SIGNALS: Record<BusinessType, BusinessTypeSignals> = {
  ecommerce: {
    urlPatterns: [
      '/cart',
      '/checkout',
      '/product/',
      '/shop/',
      '/store/',
      '/buy/',
      '/add-to-cart',
    ],
    elementSelectors: [
      '[class*="cart"]',
      '[class*="basket"]',
      '[class*="product-price"]',
      '[class*="add-to-cart"]',
      '[class*="buy-now"]',
      'button[data-add-to-cart]',
      '.price',
      '[itemtype*="Product"]',
    ],
    keywords: [
      'add to cart',
      'buy now',
      'checkout',
      'shopping cart',
      'free shipping',
      'in stock',
      'out of stock',
      'price',
      'discount',
      'sale',
    ],
  },

  saas: {
    urlPatterns: ['/pricing', '/signup', '/trial', '/demo', '/features', '/integrations'],
    elementSelectors: [
      '[class*="pricing"]',
      '[class*="plan"]',
      '[class*="tier"]',
      '[class*="trial"]',
      '[class*="demo"]',
      '[class*="feature-list"]',
      '[class*="integration"]',
    ],
    keywords: [
      'free trial',
      'start trial',
      'pricing',
      'per month',
      'per user',
      'enterprise',
      'sign up',
      'get started',
      'request demo',
      'api',
      'integration',
      'workflow',
    ],
  },

  banking: {
    urlPatterns: ['/account', '/banking', '/loan', '/mortgage', '/credit', '/deposit'],
    elementSelectors: [
      '[class*="account"]',
      '[class*="balance"]',
      '[class*="transaction"]',
      '[class*="loan"]',
      '[class*="rate"]',
      '[class*="apr"]',
    ],
    keywords: [
      'account',
      'balance',
      'transfer',
      'loan',
      'mortgage',
      'interest rate',
      'apr',
      'credit card',
      'savings',
      'checking',
      'deposit',
    ],
  },

  insurance: {
    urlPatterns: ['/quote', '/coverage', '/policy', '/claim', '/insurance'],
    elementSelectors: [
      '[class*="quote"]',
      '[class*="premium"]',
      '[class*="coverage"]',
      '[class*="policy"]',
      '[class*="claim"]',
      '[class*="deductible"]',
    ],
    keywords: [
      'get quote',
      'coverage',
      'premium',
      'policy',
      'claim',
      'deductible',
      'insured',
      'liability',
      'comprehensive',
      'collision',
    ],
  },

  travel: {
    urlPatterns: ['/booking', '/flight', '/hotel', '/travel', '/destination', '/vacation'],
    elementSelectors: [
      '[class*="booking"]',
      '[class*="flight"]',
      '[class*="hotel"]',
      '[class*="destination"]',
      '[class*="travel-date"]',
      '[class*="room"]',
      '[class*="passenger"]',
    ],
    keywords: [
      'book now',
      'flight',
      'hotel',
      'destination',
      'check-in',
      'check-out',
      'traveler',
      'passenger',
      'itinerary',
      'vacation',
    ],
  },

  media: {
    urlPatterns: ['/article', '/news', '/blog', '/video', '/podcast', '/subscribe'],
    elementSelectors: [
      '[class*="article"]',
      '[class*="headline"]',
      '[class*="byline"]',
      '[class*="author"]',
      '[class*="subscribe"]',
      '[class*="newsletter"]',
      'article',
    ],
    keywords: [
      'subscribe',
      'newsletter',
      'read more',
      'article',
      'author',
      'published',
      'breaking news',
      'latest',
      'trending',
    ],
  },

  other: {
    urlPatterns: [],
    elementSelectors: [],
    keywords: [],
  },
};

/**
 * All valid business types
 */
export const BUSINESS_TYPES: BusinessType[] = [
  'ecommerce',
  'saas',
  'banking',
  'insurance',
  'travel',
  'media',
  'other',
];
