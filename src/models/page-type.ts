/**
 * Page Type Model - Phase 21 (T285)
 *
 * Defines page type classification for CRO analysis.
 * Different page types have different CRO priorities.
 */

/**
 * Supported page types for CRO analysis
 */
export type PageType =
  | 'pdp' // Product Detail Page
  | 'plp' // Product Listing Page / Category
  | 'homepage' // Homepage
  | 'cart' // Cart/Basket
  | 'checkout' // Checkout flow
  | 'account' // Account/Login pages
  | 'other'; // Unknown/other

/**
 * Result of page type detection
 */
export interface PageTypeResult {
  /** Detected page type */
  type: PageType;
  /** Confidence score 0-1 */
  confidence: number;
  /** Signals that led to detection */
  signals: string[];
}

/**
 * Detection signals for a page type
 */
export interface PageTypeSignals {
  /** URL patterns to match */
  urlPatterns: string[];
  /** CSS selectors for characteristic elements */
  elementSelectors: string[];
  /** Keywords in page content */
  keywords: string[];
}

/**
 * Page type detection patterns
 */
export const PAGE_TYPE_SIGNALS: Record<PageType, PageTypeSignals> = {
  pdp: {
    urlPatterns: [
      '/product/',
      '/products/',
      '/item/',
      '/p/',
      '/pd/',
      '/-p-',
      '/dp/', // Amazon style
      '/goods/',
      '.html', // Many PDPs end in .html
    ],
    elementSelectors: [
      '[itemtype*="Product"]',
      '[data-product-id]',
      '[data-sku]',
      '[data-product]',
      '[class*="product-detail"]',
      '[class*="pdp-"]',
      '[class*="product-page"]',
      '[class*="add-to-cart"]',
      '[class*="add-to-bag"]',
      '[class*="buy-now"]',
      '[class*="product-gallery"]',
      '[class*="product-image"]',
      '[class*="product-price"]',
      '[class*="variant-selector"]',
      '[class*="size-selector"]',
      '[class*="color-selector"]',
      '[class*="quantity-selector"]',
    ],
    keywords: [
      'add to cart',
      'add to bag',
      'buy now',
      'product details',
      'size guide',
      'delivery',
      'shipping',
      'returns',
      'in stock',
      'out of stock',
      'sku:',
      'item #',
    ],
  },

  plp: {
    urlPatterns: [
      '/category/',
      '/categories/',
      '/collection/',
      '/collections/',
      '/shop/',
      '/c/',
      '/browse/',
      '/search',
    ],
    elementSelectors: [
      '[class*="product-grid"]',
      '[class*="product-list"]',
      '[class*="product-card"]',
      '[class*="category-page"]',
      '[class*="collection-page"]',
      '[class*="filter-"]',
      '[class*="facet-"]',
      '[class*="sort-"]',
    ],
    keywords: [
      'filter',
      'sort by',
      'showing',
      'products',
      'results',
      'items',
      'view all',
      'load more',
    ],
  },

  homepage: {
    urlPatterns: [], // Root paths detected differently
    elementSelectors: [
      '[class*="hero"]',
      '[class*="featured"]',
      '[class*="home-"]',
      '[class*="banner"]',
      '[class*="carousel"]',
      '[class*="slider"]',
    ],
    keywords: ['welcome', 'shop now', 'discover', 'explore', 'new arrivals', 'trending'],
  },

  cart: {
    urlPatterns: ['/cart', '/basket', '/bag', '/shopping-cart'],
    elementSelectors: [
      '[class*="cart-item"]',
      '[class*="basket-item"]',
      '[class*="cart-product"]',
      '[class*="cart-total"]',
      '[class*="cart-summary"]',
    ],
    keywords: [
      'your cart',
      'your bag',
      'your basket',
      'subtotal',
      'checkout',
      'proceed to checkout',
      'remove item',
    ],
  },

  checkout: {
    urlPatterns: ['/checkout', '/payment', '/order', '/purchase', '/billing'],
    elementSelectors: [
      '[class*="checkout-"]',
      '[class*="payment-"]',
      '[class*="billing-"]',
      '[class*="shipping-form"]',
      '[class*="order-summary"]',
    ],
    keywords: [
      'billing address',
      'shipping address',
      'payment method',
      'credit card',
      'place order',
      'complete purchase',
      'order total',
    ],
  },

  account: {
    urlPatterns: ['/account', '/login', '/signin', '/sign-in', '/register', '/signup', '/my-account'],
    elementSelectors: [
      '[class*="login-"]',
      '[class*="signin-"]',
      '[class*="account-"]',
      '[class*="register-"]',
      '[class*="auth-"]',
    ],
    keywords: [
      'sign in',
      'log in',
      'create account',
      'register',
      'forgot password',
      'my orders',
      'my account',
    ],
  },

  other: {
    urlPatterns: [],
    elementSelectors: [],
    keywords: [],
  },
};

/**
 * All valid page types
 */
export const PAGE_TYPES: PageType[] = [
  'pdp',
  'plp',
  'homepage',
  'cart',
  'checkout',
  'account',
  'other',
];
