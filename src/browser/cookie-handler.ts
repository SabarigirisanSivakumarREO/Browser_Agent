/**
 * Cookie Consent Handler
 * Detects and dismisses cookie consent popups per FR-011 to FR-014.
 */

import type { Page } from 'playwright';
import type { CookieConsentResult } from '../types/index.js';
import { COOKIE_CONSENT_PATTERNS } from './cookie-patterns.js';
import { createLogger } from '../utils/index.js';

const logger = createLogger('CookieConsentHandler');

/** Timeout for each selector attempt (ms) */
const SELECTOR_TIMEOUT = 2000;

/** Extended timeout for dynamic banners (Alpine.js, etc.) */
const DYNAMIC_BANNER_TIMEOUT = 2000;

/** Common button text patterns for heuristic matching */
const ACCEPT_TEXT_PATTERNS = ['accept', 'allow', 'agree', 'ok', 'got it', 'continue', 'save'];

/** Exclusion patterns - buttons containing these should NOT be clicked (social login, etc.) */
const EXCLUSION_PATTERNS = [
  // Social login providers
  'facebook',
  'google',
  'twitter',
  'apple',
  'linkedin',
  'instagram',
  'github',
  'microsoft',
  'amazon',
  // Authentication actions
  'login',
  'log in',
  'sign in',
  'sign up',
  'register',
  'create account',
  // Newsletter/marketing
  'subscribe',
  'newsletter',
  'save 10',
  'save 15',
  'save 20',
  '% off',
  'discount',
  'promo',
  'coupon',
  'get offer',
  'claim',
  'unlock',
  // Purchase actions
  'checkout',
  'buy now',
  'add to cart',
  'add to bag',
  'purchase',
  'shop now',
  'order now',
];

/** Aria-labeled banner selectors */
const ARIA_BANNER_SELECTORS = [
  '[role="region"][aria-label*="cookie" i]',
  '[aria-label*="cookie banner" i]',
  '[aria-label*="cookie" i][role="dialog"]',
  '[aria-label*="consent" i][role="dialog"]',
];

/** Cookie container indicators for context-aware button search */
const COOKIE_CONTAINER_INDICATORS = [
  // Exact class matches first (most specific, avoids false positives)
  '.cookies',
  '.cookie-banner',
  '.consent-banner',
  '.privacy-banner',
  '#cookie-notice',
  '#consent-notice',
  // Then attribute substring matches (broader, but may match unrelated elements)
  '[class*="cookie"]',
  '[class*="consent"]',
  '[class*="gdpr"]',
  '[class*="privacy"]',
  '[id*="cookie"]',
  '[id*="consent"]',
  '[id*="gdpr"]',
  '[id*="privacy"]',
  '[data-cookie]',
  '[data-consent]',
  '[data-gdpr]',
];

/**
 * Checks if button text should be excluded (social login, purchase buttons, etc.)
 * @param text - The button text to check
 * @returns True if the button should be excluded
 */
function shouldExcludeButton(text: string | null | undefined): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return EXCLUSION_PATTERNS.some(pattern => lowerText.includes(pattern));
}

/**
 * Handles automatic dismissal of cookie consent popups.
 * Uses known CMP patterns first, then falls back to heuristic text matching.
 */
export class CookieConsentHandler {
  /**
   * Attempts to dismiss cookie consent popup on the page.
   * @param page - Playwright page instance
   * @returns Result indicating if popup was dismissed and how
   */
  async dismiss(page: Page): Promise<CookieConsentResult> {
    logger.info('Attempting cookie consent dismissal', { url: page.url() });

    try {
      // Step 1: Try known CMP patterns
      const cmpResult = await this.tryKnownCMPs(page);
      if (cmpResult.dismissed) {
        logger.info('Cookie consent dismissed via CMP pattern', {
          url: page.url(),
          cmpId: cmpResult.cmpId,
        });
        return cmpResult;
      }

      // Step 2: Try heuristic text-based matching
      const heuristicResult = await this.tryHeuristic(page);
      if (heuristicResult.dismissed) {
        logger.info('Cookie consent dismissed via heuristic', {
          url: page.url(),
          buttonText: heuristicResult.buttonText,
        });
        return heuristicResult;
      }

      // No popup found or could not dismiss
      logger.info('No cookie consent popup detected', { url: page.url() });
      return { dismissed: false, mode: 'none' };
    } catch (err) {
      const error = err as Error;
      logger.warn('Cookie consent dismissal failed', {
        url: page.url(),
        error: error.message,
      });
      // Best-effort: don't fail the page load
      return { dismissed: false, mode: 'none' };
    }
  }

  /**
   * Tries to dismiss cookie popup using known CMP patterns.
   * @param page - Playwright page instance
   * @returns Result if CMP popup was found and dismissed
   */
  private async tryKnownCMPs(page: Page): Promise<CookieConsentResult> {
    for (const pattern of COOKIE_CONSENT_PATTERNS) {
      try {
        // Check if CMP is present (main page or iframe)
        const isPresent = await this.checkCMPPresence(page, pattern);
        if (!isPresent) {
          continue;
        }

        logger.debug('CMP detected', { cmpId: pattern.id, url: page.url() });

        // Try to click accept button
        const clicked = await this.clickAcceptButton(page, pattern);
        if (clicked) {
          // Wait a bit for popup to close
          await page.waitForTimeout(300);
          return { dismissed: true, mode: 'cmp', cmpId: pattern.id };
        }
      } catch (err) {
        // Continue to next pattern if this one fails
        logger.debug('CMP pattern failed', {
          cmpId: pattern.id,
          error: (err as Error).message,
        });
        continue;
      }
    }

    return { dismissed: false, mode: 'none' };
  }

  /**
   * Checks if CMP is present on page or in iframe.
   * @param page - Playwright page instance
   * @param pattern - CMP pattern to check
   * @returns True if CMP detected
   */
  private async checkCMPPresence(
    page: Page,
    pattern: { detectSelector: string; frameHint?: string }
  ): Promise<boolean> {
    // Check main page
    const mainPresent = await page
      .locator(pattern.detectSelector)
      .first()
      .isVisible({ timeout: SELECTOR_TIMEOUT })
      .catch(() => false);

    if (mainPresent) return true;

    // Check iframes if frameHint provided
    if (pattern.frameHint) {
      const frames = page.frames();
      for (const frame of frames) {
        const frameUrl = frame.url();
        if (frameUrl.includes(pattern.frameHint)) {
          const inFrame = await frame
            .locator(pattern.detectSelector)
            .first()
            .isVisible({ timeout: SELECTOR_TIMEOUT })
            .catch(() => false);
          if (inFrame) return true;
        }
      }
    }

    return false;
  }

  /**
   * Attempts to click the accept button for a CMP.
   * @param page - Playwright page instance
   * @param pattern - CMP pattern with accept selector
   * @returns True if button was clicked
   */
  private async clickAcceptButton(
    page: Page,
    pattern: { acceptSelector: string; frameHint?: string }
  ): Promise<boolean> {
    // Try main page first
    const mainButton = page.locator(pattern.acceptSelector).first();
    const mainVisible = await mainButton
      .isVisible({ timeout: SELECTOR_TIMEOUT })
      .catch(() => false);

    if (mainVisible) {
      await mainButton.click({ timeout: SELECTOR_TIMEOUT });
      return true;
    }

    // Try iframes if frameHint provided
    if (pattern.frameHint) {
      const frames = page.frames();
      for (const frame of frames) {
        const frameUrl = frame.url();
        if (frameUrl.includes(pattern.frameHint)) {
          const frameButton = frame.locator(pattern.acceptSelector).first();
          const frameVisible = await frameButton
            .isVisible({ timeout: SELECTOR_TIMEOUT })
            .catch(() => false);

          if (frameVisible) {
            await frameButton.click({ timeout: SELECTOR_TIMEOUT });
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Tries to dismiss cookie popup using aria-labeled banners.
   * Most reliable for accessibility-focused sites and Alpine.js banners.
   * @param page - Playwright page instance
   * @returns Result if aria-labeled banner was found and dismissed
   */
  async tryAriaLabeledBanner(page: Page): Promise<CookieConsentResult> {
    try {
      // Wait for dynamic banners (Alpine.js) to initialize
      await page.waitForTimeout(DYNAMIC_BANNER_TIMEOUT);

      for (const bannerSelector of ARIA_BANNER_SELECTORS) {
        const banner = page.locator(bannerSelector).first();
        const bannerVisible = await banner
          .isVisible({ timeout: SELECTOR_TIMEOUT })
          .catch(() => false);

        if (bannerVisible) {
          logger.debug('Aria-labeled banner found', { selector: bannerSelector });

          // Look for accept button within the banner
          for (const textPattern of ACCEPT_TEXT_PATTERNS) {
            // Try button elements
            const buttonSelector = `${bannerSelector} button:has-text("${textPattern}")`;
            const button = page.locator(buttonSelector).first();
            const buttonVisible = await button
              .isVisible({ timeout: SELECTOR_TIMEOUT })
              .catch(() => false);

            if (buttonVisible) {
              const buttonText = await button.textContent();
              // Skip if button matches exclusion patterns
              if (shouldExcludeButton(buttonText)) {
                logger.debug('Skipping excluded button in aria banner', { text: buttonText });
                continue;
              }
              await button.click({ timeout: SELECTOR_TIMEOUT });
              await page.waitForTimeout(300);
              return {
                dismissed: true,
                mode: 'heuristic',
                buttonText: buttonText?.trim() || textPattern,
              };
            }

            // Try anchor elements (some banners use links)
            const linkSelector = `${bannerSelector} a:has-text("${textPattern}")`;
            const link = page.locator(linkSelector).first();
            const linkVisible = await link
              .isVisible({ timeout: SELECTOR_TIMEOUT })
              .catch(() => false);

            if (linkVisible) {
              const linkText = await link.textContent();
              // Skip if link matches exclusion patterns
              if (shouldExcludeButton(linkText)) {
                logger.debug('Skipping excluded link in aria banner', { text: linkText });
                continue;
              }
              await link.click({ timeout: SELECTOR_TIMEOUT });
              await page.waitForTimeout(300);
              return {
                dismissed: true,
                mode: 'heuristic',
                buttonText: linkText?.trim() || textPattern,
              };
            }
          }
        }
      }

      return { dismissed: false, mode: 'none' };
    } catch (err) {
      logger.debug('Aria-labeled banner method failed', {
        error: (err as Error).message,
      });
      return { dismissed: false, mode: 'none' };
    }
  }

  /**
   * Tries to dismiss cookie popup using container heuristic.
   * Searches within cookie-related containers for accept buttons.
   * More reliable than broad search as it limits scope to cookie-related elements.
   * @param page - Playwright page instance
   * @returns Result if container with accept button was found and dismissed
   */
  async tryContainerHeuristic(page: Page): Promise<CookieConsentResult> {
    try {
      for (const containerSelector of COOKIE_CONTAINER_INDICATORS) {
        const container = page.locator(containerSelector).first();

        // Check if element exists in DOM first
        const containerCount = await container.count().catch(() => 0);
        if (containerCount > 0) {
          logger.debug('Container found in DOM', { selector: containerSelector, count: containerCount });
        }

        const containerVisible = await container
          .isVisible({ timeout: SELECTOR_TIMEOUT })
          .catch(() => false);

        if (containerVisible) {
          logger.debug('Cookie container found', { selector: containerSelector });

          // Look for accept button within the container
          for (const textPattern of ACCEPT_TEXT_PATTERNS) {
            // Try button elements
            const buttonSelector = `${containerSelector} button:has-text("${textPattern}")`;
            const button = page.locator(buttonSelector).first();
            const buttonVisible = await button
              .isVisible({ timeout: SELECTOR_TIMEOUT })
              .catch(() => false);

            if (buttonVisible) {
              const buttonText = await button.textContent();
              // Skip if button matches exclusion patterns
              if (shouldExcludeButton(buttonText)) {
                logger.debug('Skipping excluded button in container', { text: buttonText });
                continue;
              }
              await button.click({ timeout: SELECTOR_TIMEOUT });
              await page.waitForTimeout(300);
              return {
                dismissed: true,
                mode: 'heuristic',
                buttonText: buttonText?.trim() || textPattern,
              };
            }

            // Try anchor elements
            const linkSelector = `${containerSelector} a:has-text("${textPattern}")`;
            const link = page.locator(linkSelector).first();
            const linkVisible = await link
              .isVisible({ timeout: SELECTOR_TIMEOUT })
              .catch(() => false);

            if (linkVisible) {
              const linkText = await link.textContent();
              // Skip if link matches exclusion patterns
              if (shouldExcludeButton(linkText)) {
                logger.debug('Skipping excluded link in container', { text: linkText });
                continue;
              }
              await link.click({ timeout: SELECTOR_TIMEOUT });
              await page.waitForTimeout(300);
              return {
                dismissed: true,
                mode: 'heuristic',
                buttonText: linkText?.trim() || textPattern,
              };
            }

            // Try role="button" elements (divs/spans with role="button")
            const roleButtonSelector = `${containerSelector} [role="button"]:has-text("${textPattern}")`;
            const roleButton = page.locator(roleButtonSelector).first();
            const roleButtonVisible = await roleButton
              .isVisible({ timeout: SELECTOR_TIMEOUT })
              .catch(() => false);

            if (roleButtonVisible) {
              const roleButtonText = await roleButton.textContent();
              // Skip if role button matches exclusion patterns
              if (shouldExcludeButton(roleButtonText)) {
                logger.debug('Skipping excluded role button in container', { text: roleButtonText });
                continue;
              }
              await roleButton.click({ timeout: SELECTOR_TIMEOUT });
              await page.waitForTimeout(300);
              return {
                dismissed: true,
                mode: 'heuristic',
                buttonText: roleButtonText?.trim() || textPattern,
              };
            }
          }
        }
      }

      return { dismissed: false, mode: 'none' };
    } catch (err) {
      logger.debug('Container heuristic method failed', {
        error: (err as Error).message,
      });
      return { dismissed: false, mode: 'none' };
    }
  }

  /**
   * Tries to dismiss cookie popup using text-based heuristic (broad search).
   * Looks for buttons and button-like elements with common accept text patterns.
   * Extended to support: button, a, div[role="button"], span[role="button"], [type="submit"]
   * @param page - Playwright page instance
   * @returns Result if button was found and clicked
   */
  async tryBroadButtonSearch(page: Page): Promise<CookieConsentResult> {
    // Extended element type selectors for broader matching
    const elementTypeSelectors = [
      'button',
      'a',
      'div[role="button"]',
      'span[role="button"]',
      '[type="submit"]',
      '[role="button"]',
    ];

    try {
      // Look for buttons with accept-like text (case-insensitive)
      for (const textPattern of ACCEPT_TEXT_PATTERNS) {
        for (const elementSelector of elementTypeSelectors) {
          const selector = `${elementSelector}:has-text("${textPattern}")`;
          const element = page.locator(selector).first();

          // First check if element exists in DOM
          const elementCount = await element.count().catch(() => 0);
          if (elementCount === 0) continue;

          // Try visibility check with shorter timeout
          const isVisible = await element
            .isVisible({ timeout: 500 })
            .catch(() => false);

          // Get element text for exclusion check
          const elementText = await element.textContent().catch(() => null);

          // Skip if button matches exclusion patterns (social login, purchase, etc.)
          if (shouldExcludeButton(elementText)) {
            logger.debug('Skipping excluded button', {
              text: elementText,
              pattern: textPattern,
              elementType: elementSelector,
            });
            continue;
          }

          // If visible, click immediately
          if (isVisible) {
            logger.debug('Heuristic element found (visible)', {
              text: elementText,
              pattern: textPattern,
              elementType: elementSelector,
            });

            await element.click({ timeout: SELECTOR_TIMEOUT });
            await page.waitForTimeout(300);

            return {
              dismissed: true,
              mode: 'heuristic',
              buttonText: elementText?.trim() || textPattern,
            };
          }

          // If element exists but not visible, try clicking anyway (some banners have tricky CSS)
          logger.debug('Heuristic element exists but not visible, attempting click', {
            pattern: textPattern,
            elementType: elementSelector,
          });

          try {
            await element.click({ force: true, timeout: SELECTOR_TIMEOUT });
            await page.waitForTimeout(300);

            return {
              dismissed: true,
              mode: 'heuristic',
              buttonText: elementText?.trim() || textPattern,
            };
          } catch {
            // Click failed, continue to next pattern
            continue;
          }
        }
      }

      return { dismissed: false, mode: 'none' };
    } catch (err) {
      logger.debug('Broad button search failed', { error: (err as Error).message });
      return { dismissed: false, mode: 'none' };
    }
  }

  /**
   * Tries to find and click accept button near a cookie-related sibling.
   * Looks for patterns like: Accept button next to "Cookie preferences" button.
   * @param page - Playwright page instance
   * @returns Result if button was found and clicked
   */
  async trySiblingButtonSearch(page: Page): Promise<CookieConsentResult> {
    try {
      // Strategy: Find a container that has BOTH an accept-like button AND a cookie-related button
      // Click accept first, then look for close button if banner still visible

      // Find container that has a "Cookie preferences" or similar button
      const containerSelectors = [
        'div:has(button:has-text("cookie preferences"))',
        'div:has(button:has-text("manage cookies"))',
        'div:has(button:has-text("cookie settings"))',
        'div:has(a:has-text("cookie preferences"))',
      ];

      for (const containerSel of containerSelectors) {
        const container = page.locator(containerSel).first();
        const containerCount = await container.count().catch(() => 0);

        if (containerCount > 0) {
          // Found a cookie-related container
          // First, try clicking Accept button
          const buttons = container.locator('button');
          const buttonCount = await buttons.count().catch(() => 0);

          for (let i = 0; i < buttonCount; i++) {
            const btn = buttons.nth(i);
            const btnText = (await btn.textContent().catch(() => ''))?.toLowerCase() || '';

            // Skip if button matches exclusion patterns (social login, purchase, etc.)
            if (shouldExcludeButton(btnText)) {
              logger.debug('Skipping excluded button in sibling search', { text: btnText, index: i });
              continue;
            }

            // Click the button that has "accept" but NOT "preferences" or "settings"
            if (
              btnText.includes('accept') &&
              !btnText.includes('preferences') &&
              !btnText.includes('settings') &&
              !btnText.includes('manage')
            ) {
              const fullText = await btn.textContent();
              logger.debug('Clicking accept button', { text: fullText, index: i });

              await btn.click({ force: true, timeout: SELECTOR_TIMEOUT });
              await page.waitForTimeout(500);

              // Check if banner is still visible, if so click Close/X button
              const stillVisible = await container.isVisible().catch(() => false);
              if (stillVisible) {
                // Look for close button (X button or "Close" text)
                const closeBtn = container.locator('button:has-text("close"), button[aria-label*="close" i], button:has(div:has-text("Close"))').first();
                const closeCount = await closeBtn.count().catch(() => 0);
                if (closeCount > 0) {
                  logger.debug('Banner still visible, clicking close button');
                  await closeBtn.click({ force: true, timeout: SELECTOR_TIMEOUT });
                  await page.waitForTimeout(300);
                }
              }

              return {
                dismissed: true,
                mode: 'heuristic',
                buttonText: fullText?.trim() || 'accept',
              };
            }
          }

          // If no accept button found, try clicking close button directly
          const closeBtn = container.locator('button:has-text("close"), button[aria-label*="close" i], button:has(div:has-text("Close"))').first();
          const closeCount = await closeBtn.count().catch(() => 0);
          if (closeCount > 0) {
            logger.debug('No accept button, clicking close button directly');
            await closeBtn.click({ force: true, timeout: SELECTOR_TIMEOUT });
            await page.waitForTimeout(300);
            return {
              dismissed: true,
              mode: 'heuristic',
              buttonText: 'close',
            };
          }
        }
      }

      return { dismissed: false, mode: 'none' };
    } catch (err) {
      logger.debug('Sibling button search failed', { error: (err as Error).message });
      return { dismissed: false, mode: 'none' };
    }
  }

  /**
   * Tries to dismiss cookie popup using prioritized heuristic chain.
   * Priority 1: tryAriaLabeledBanner() - most reliable for accessibility sites
   * Priority 2: tryContainerHeuristic() - context-aware search within cookie containers
   * Priority 3: trySiblingButtonSearch() - looks for accept near cookie-related buttons
   * Priority 4: tryBroadButtonSearch() - fallback broad search
   * @param page - Playwright page instance
   * @returns Result if button was found and clicked
   */
  private async tryHeuristic(page: Page): Promise<CookieConsentResult> {
    // Priority 1: Try aria-labeled banners (most reliable)
    const ariaResult = await this.tryAriaLabeledBanner(page);
    if (ariaResult.dismissed) {
      logger.debug('Cookie dismissed via aria-labeled banner');
      return ariaResult;
    }

    // Priority 2: Try container heuristic (context-aware)
    const containerResult = await this.tryContainerHeuristic(page);
    if (containerResult.dismissed) {
      logger.debug('Cookie dismissed via container heuristic');
      return containerResult;
    }

    // Priority 3: Try sibling button search (accept near cookie button)
    const siblingResult = await this.trySiblingButtonSearch(page);
    if (siblingResult.dismissed) {
      logger.debug('Cookie dismissed via sibling button search');
      return siblingResult;
    }

    // Priority 4: Try broad button search (fallback)
    const broadResult = await this.tryBroadButtonSearch(page);
    if (broadResult.dismissed) {
      logger.debug('Cookie dismissed via broad button search');
      return broadResult;
    }

    return { dismissed: false, mode: 'none' };
  }
}
