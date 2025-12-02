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
const SELECTOR_TIMEOUT = 1000;

/** Common button text patterns for heuristic matching */
const ACCEPT_TEXT_PATTERNS = ['accept', 'allow', 'agree', 'ok', 'got it', 'continue'];

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
   * Tries to dismiss cookie popup using text-based heuristic.
   * Looks for buttons with common accept text patterns.
   * @param page - Playwright page instance
   * @returns Result if button was found and clicked
   */
  private async tryHeuristic(page: Page): Promise<CookieConsentResult> {
    try {
      // Look for buttons with accept-like text (case-insensitive)
      for (const textPattern of ACCEPT_TEXT_PATTERNS) {
        const selector = `button:has-text("${textPattern}")`;
        const button = page.locator(selector).first();

        const isVisible = await button
          .isVisible({ timeout: SELECTOR_TIMEOUT })
          .catch(() => false);

        if (isVisible) {
          const buttonText = await button.textContent();
          logger.debug('Heuristic button found', {
            text: buttonText,
            pattern: textPattern,
          });

          await button.click({ timeout: SELECTOR_TIMEOUT });
          await page.waitForTimeout(300); // Wait for popup to close

          return {
            dismissed: true,
            mode: 'heuristic',
            buttonText: buttonText?.trim() || textPattern,
          };
        }
      }

      return { dismissed: false, mode: 'none' };
    } catch (err) {
      logger.debug('Heuristic method failed', { error: (err as Error).message });
      return { dismissed: false, mode: 'none' };
    }
  }
}
