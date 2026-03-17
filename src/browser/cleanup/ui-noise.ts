/**
 * UI Noise Suppression Module - Phase 25h (T523)
 *
 * Hides or masks UI elements that interfere with screenshot clarity:
 * - Cookie consent banners
 * - Chat widgets
 * - Sticky promo bars
 * - Newsletter modals
 * - Interstitials
 * - Pop-ups
 */

import type { Page } from 'playwright';
import { createLogger } from '../../utils/index.js';

const logger = createLogger('UINoiseSuppression');

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for UI noise suppression
 */
export interface UINoiseSuppressionConfig {
  /** Enable suppression (default: true) */
  enabled: boolean;
  /** Suppress cookie banners (default: true) */
  suppressCookieBanners: boolean;
  /** Suppress chat widgets (default: true) */
  suppressChatWidgets: boolean;
  /** Suppress sticky promo bars (default: true) */
  suppressPromoBarss: boolean;
  /** Suppress newsletter modals (default: true) */
  suppressNewsletterModals: boolean;
  /** Suppress interstitials and overlays (default: true) */
  suppressInterstitials: boolean;
  /** Custom selectors to hide (default: []) */
  customSelectors: string[];
  /** Timeout for suppression in ms (default: 2000) */
  timeoutMs: number;
}

/**
 * Result of UI noise suppression
 */
export interface UINoiseSuppressionResult {
  /** Whether suppression was successful */
  success: boolean;
  /** Number of elements suppressed */
  suppressedCount: number;
  /** Categories of elements that were suppressed */
  suppressedCategories: string[];
  /** Selectors that matched */
  matchedSelectors: string[];
  /** Any errors encountered */
  errors: string[];
  /** Time taken in milliseconds */
  durationMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Selector Patterns
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Common selectors for cookie consent banners
 */
const COOKIE_BANNER_SELECTORS = [
  // ID patterns
  '#cookie-banner',
  '#cookie-consent',
  '#cookie-notice',
  '#cookie-popup',
  '#gdpr-banner',
  '#gdpr-consent',
  '#consent-banner',
  '#onetrust-consent-sdk',
  '#onetrust-banner-sdk',
  '#CybotCookiebotDialog',
  '#cookiescript_injected',
  '#sp-cc',
  // Class patterns
  '.cookie-banner',
  '.cookie-consent',
  '.cookie-notice',
  '.cookie-popup',
  '.gdpr-banner',
  '.consent-banner',
  '.cc-banner',
  '.cc-window',
  // Attribute patterns
  '[class*="cookie-consent"]',
  '[class*="cookie-banner"]',
  '[class*="gdpr-consent"]',
  '[data-testid*="cookie"]',
  '[aria-label*="cookie"]',
];

/**
 * Common selectors for chat widgets
 */
const CHAT_WIDGET_SELECTORS = [
  // ID patterns
  '#intercom-container',
  '#intercom-frame',
  '#drift-widget',
  '#drift-frame',
  '#hubspot-messages-iframe-container',
  '#tidio-chat',
  '#crisp-chatbox',
  '#ze-snippet',
  '#launcher',
  '#chat-widget',
  '#livechat-compact-container',
  '#fb-messenger-button',
  // Class patterns
  '.intercom-launcher',
  '.intercom-app',
  '.drift-widget',
  '.drift-frame-controller',
  '.freshdesk-widget',
  '.tawk-widget',
  '.zopim',
  '.olark-chat-button',
  '[class*="chat-widget"]',
  '[class*="livechat"]',
  // Frame patterns
  'iframe[src*="intercom"]',
  'iframe[src*="drift"]',
  'iframe[src*="hubspot"]',
  'iframe[src*="tidio"]',
  'iframe[src*="crisp"]',
  'iframe[src*="zendesk"]',
];

/**
 * Common selectors for sticky promo bars
 */
const PROMO_BAR_SELECTORS = [
  // Class patterns
  '.promo-bar',
  '.promo-banner',
  '.announcement-bar',
  '.header-banner',
  '.notification-bar',
  '.top-bar',
  '.sticky-banner',
  '.promotion-bar',
  '.sale-banner',
  '.discount-banner',
  '[class*="promo-bar"]',
  '[class*="announcement"]',
  // Common positions
  '[style*="position: fixed"][style*="top: 0"]',
  '[style*="position: sticky"][style*="top: 0"]',
];

/**
 * Common selectors for newsletter/signup modals
 */
const NEWSLETTER_MODAL_SELECTORS = [
  // ID patterns
  '#newsletter-modal',
  '#newsletter-popup',
  '#signup-modal',
  '#subscribe-modal',
  '#email-popup',
  '#klaviyo-popup',
  '#privy-popup',
  '#optinmonster-popup',
  // Class patterns
  '.newsletter-modal',
  '.newsletter-popup',
  '.signup-modal',
  '.subscribe-popup',
  '.email-capture',
  '.lead-capture',
  '.popup-modal',
  '.klaviyo-popup',
  '.privy-popup',
  '.optinmonster',
  '[class*="newsletter-popup"]',
  '[class*="email-signup"]',
  '[class*="exit-intent"]',
];

/**
 * Common selectors for interstitials and overlays
 */
const INTERSTITIAL_SELECTORS = [
  // ID patterns
  '#overlay',
  '#modal-overlay',
  '#popup-overlay',
  '#lightbox-overlay',
  // Class patterns
  '.modal-overlay',
  '.popup-overlay',
  '.lightbox-overlay',
  '.page-overlay',
  '.interstitial',
  '.splash-screen',
  '.loading-overlay',
  '[class*="overlay"][class*="modal"]',
  // Style patterns (generic overlays)
  '[style*="position: fixed"][style*="z-index"][style*="background"]',
];

// ═══════════════════════════════════════════════════════════════════════════════
// Default Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: UINoiseSuppressionConfig = {
  enabled: true,
  suppressCookieBanners: true,
  suppressChatWidgets: true,
  suppressPromoBarss: true,
  suppressNewsletterModals: true,
  suppressInterstitials: true,
  customSelectors: [],
  timeoutMs: 2000,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Suppression Function
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Suppress UI noise elements on the page
 *
 * This function hides elements that interfere with screenshot clarity
 * and analysis accuracy. It uses CSS `visibility: hidden` and `display: none`
 * to hide elements without affecting layout significantly.
 *
 * @param page - Playwright page instance
 * @param config - Suppression configuration
 * @returns Suppression result with details of what was hidden
 */
export async function suppressUINoiseElements(
  page: Page,
  config: Partial<UINoiseSuppressionConfig> = {}
): Promise<UINoiseSuppressionResult> {
  const startTime = Date.now();
  const fullConfig: UINoiseSuppressionConfig = { ...DEFAULT_CONFIG, ...config };

  if (!fullConfig.enabled) {
    return {
      success: true,
      suppressedCount: 0,
      suppressedCategories: [],
      matchedSelectors: [],
      errors: [],
      durationMs: 0,
    };
  }

  const selectorsToHide: string[] = [];
  const categories: string[] = [];

  // Build selector list based on config
  if (fullConfig.suppressCookieBanners) {
    selectorsToHide.push(...COOKIE_BANNER_SELECTORS);
    categories.push('cookie-banners');
  }
  if (fullConfig.suppressChatWidgets) {
    selectorsToHide.push(...CHAT_WIDGET_SELECTORS);
    categories.push('chat-widgets');
  }
  if (fullConfig.suppressPromoBarss) {
    selectorsToHide.push(...PROMO_BAR_SELECTORS);
    categories.push('promo-bars');
  }
  if (fullConfig.suppressNewsletterModals) {
    selectorsToHide.push(...NEWSLETTER_MODAL_SELECTORS);
    categories.push('newsletter-modals');
  }
  if (fullConfig.suppressInterstitials) {
    selectorsToHide.push(...INTERSTITIAL_SELECTORS);
    categories.push('interstitials');
  }
  if (fullConfig.customSelectors.length > 0) {
    selectorsToHide.push(...fullConfig.customSelectors);
    categories.push('custom');
  }

  const errors: string[] = [];
  let suppressedCount = 0;
  const matchedSelectors: string[] = [];

  try {
    // Execute suppression in browser context
    const result = await page.evaluate((selectors: string[]) => {
      const suppressed: string[] = [];
      let count = 0;

      for (const selector of selectors) {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            elements.forEach((el) => {
              const htmlEl = el as HTMLElement;
              // Use display: none for complete removal
              // This is more effective than visibility: hidden
              htmlEl.style.setProperty('display', 'none', 'important');
              htmlEl.style.setProperty('visibility', 'hidden', 'important');
              htmlEl.style.setProperty('opacity', '0', 'important');
              htmlEl.style.setProperty('pointer-events', 'none', 'important');
              count++;
            });
            suppressed.push(selector);
          }
        } catch {
          // Invalid selector - skip silently
        }
      }

      return { count, suppressed };
    }, selectorsToHide);

    suppressedCount = result.count;
    matchedSelectors.push(...result.suppressed);

    if (suppressedCount > 0) {
      logger.info('UI noise elements suppressed', {
        count: suppressedCount,
        categories: categories.filter(c =>
          matchedSelectors.some(s => {
            if (c === 'cookie-banners') return COOKIE_BANNER_SELECTORS.includes(s);
            if (c === 'chat-widgets') return CHAT_WIDGET_SELECTORS.includes(s);
            if (c === 'promo-bars') return PROMO_BAR_SELECTORS.includes(s);
            if (c === 'newsletter-modals') return NEWSLETTER_MODAL_SELECTORS.includes(s);
            if (c === 'interstitials') return INTERSTITIAL_SELECTORS.includes(s);
            return false;
          })
        ),
        selectors: matchedSelectors.slice(0, 5), // Log first 5 for brevity
      });
    } else {
      logger.debug('No UI noise elements found to suppress');
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    errors.push(errorMsg);
    logger.warn('UI noise suppression failed', { error: errorMsg });
  }

  return {
    success: errors.length === 0,
    suppressedCount,
    suppressedCategories: matchedSelectors.length > 0 ? categories : [],
    matchedSelectors,
    errors,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Re-apply suppression (useful when overlays appear after scroll)
 *
 * This is a lighter-weight version that only targets common
 * dynamically-appearing elements.
 */
export async function refreshSuppression(
  page: Page
): Promise<{ count: number; success: boolean }> {
  try {
    const count = await page.evaluate(() => {
      // Target common dynamic elements
      const dynamicSelectors = [
        '#onetrust-consent-sdk',
        '.cookie-banner',
        '.cookie-consent',
        '#intercom-container',
        '.modal-overlay',
        '.popup-overlay',
        '[class*="newsletter-popup"]',
        '[class*="exit-intent"]',
      ];

      let hidden = 0;
      for (const selector of dynamicSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.style.display !== 'none') {
              htmlEl.style.setProperty('display', 'none', 'important');
              htmlEl.style.setProperty('visibility', 'hidden', 'important');
              hidden++;
            }
          });
        } catch {
          // Skip invalid selectors
        }
      }
      return hidden;
    });

    if (count > 0) {
      logger.debug('Refresh suppression applied', { count });
    }

    return { count, success: true };
  } catch (err) {
    logger.warn('Refresh suppression failed', {
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return { count: 0, success: false };
  }
}

/**
 * Get list of all suppression selectors (for debugging)
 */
export function getAllSuppressionSelectors(): Record<string, string[]> {
  return {
    cookieBanners: COOKIE_BANNER_SELECTORS,
    chatWidgets: CHAT_WIDGET_SELECTORS,
    promoBars: PROMO_BAR_SELECTORS,
    newsletterModals: NEWSLETTER_MODAL_SELECTORS,
    interstitials: INTERSTITIAL_SELECTORS,
  };
}
