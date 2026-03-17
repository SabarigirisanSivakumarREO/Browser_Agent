/**
 * Signal Collector - Phase 25i (T536)
 *
 * Collects viewport validation signals during capture.
 * These signals are used by the cheap validator to detect
 * extraction issues without LLM calls.
 */

import type { Page } from 'playwright';
import type { ViewportValidatorSignals } from '../types/index.js';
import { createEmptyValidatorSignals } from '../types/index.js';
import { createLogger } from '../utils/index.js';

const logger = createLogger('SignalCollector');

// ═══════════════════════════════════════════════════════════════════════════════
// Signal Collection
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Collect validation signals from the current viewport.
 *
 * This function runs in-browser JavaScript to detect:
 * - Blank/placeholder images
 * - Lazy-load pending elements
 * - Loading spinners and skeleton UI
 * - Text placeholders
 * - Overlay elements
 *
 * @param page - Playwright page instance
 * @param viewportIndex - Current viewport index
 * @param mediaReadinessTimedOut - Whether media readiness check timed out
 * @param scrollPositionVerified - Whether scroll position was verified
 * @returns Collected signals
 */
export async function collectViewportSignals(
  page: Page,
  viewportIndex: number,
  mediaReadinessTimedOut: boolean = false,
  scrollPositionVerified: boolean = true
): Promise<ViewportValidatorSignals> {
  try {
    // Run signal collection in browser context
    const browserSignals = await page.evaluate(() => {
      const viewportHeight = window.innerHeight;
      const viewportTop = window.scrollY;
      const viewportBottom = viewportTop + viewportHeight;

      // ─────────────────────────────────────────────────────────────────────────
      // Image Analysis
      // ─────────────────────────────────────────────────────────────────────────
      const images = Array.from(document.querySelectorAll('img'));
      let blankImageCount = 0;
      let placeholderImageCount = 0;
      let totalImages = 0;
      let loadedImages = 0;
      let failedImages = 0;
      let lazyPendingCount = 0;

      const placeholderPatterns = [
        /placeholder/i,
        /loading/i,
        /spinner/i,
        /lazy/i,
        /blank/i,
        /data:image\/gif/i,
        /data:image\/png;base64,iVBOR/i, // 1x1 transparent PNG
        /1x1/i,
        /pixel/i,
      ];

      for (const img of images) {
        const rect = img.getBoundingClientRect();
        const absTop = rect.top + viewportTop;
        const absBottom = absTop + rect.height;

        // Skip images not in or near viewport
        if (absBottom < viewportTop - 50 || absTop > viewportBottom + 50) {
          continue;
        }

        // Skip tiny images (icons, tracking pixels)
        if (rect.width < 30 && rect.height < 30) {
          continue;
        }

        totalImages++;

        // Check if image has src
        const src = img.getAttribute('src') || '';
        const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '';

        // Blank image detection
        if (!src || src === '' || src === 'about:blank') {
          blankImageCount++;
          continue;
        }

        // Placeholder pattern detection
        if (placeholderPatterns.some((p) => p.test(src))) {
          placeholderImageCount++;
          continue;
        }

        // Lazy-load pending detection
        if (dataSrc && dataSrc !== src) {
          lazyPendingCount++;
        }

        // Load status
        if (img.complete) {
          if (img.naturalWidth === 0) {
            failedImages++;
          } else {
            loadedImages++;
          }
        } else {
          // Still loading = pending
          lazyPendingCount++;
        }
      }

      // ─────────────────────────────────────────────────────────────────────────
      // Spinner Detection
      // ─────────────────────────────────────────────────────────────────────────
      const spinnerSelectors = [
        '.spinner',
        '.loading-spinner',
        '.loader',
        '.loading',
        '[class*="spin"]',
        '[class*="loader"]',
        '.fa-spinner',
        '.fa-spin',
        '[role="progressbar"]',
        '.progress-circular',
        '.circular-progress',
        '.MuiCircularProgress-root',
        '.ant-spin',
      ];

      let spinnerDetected = false;
      for (const selector of spinnerSelectors) {
        try {
          const elements = Array.from(document.querySelectorAll(selector));
          for (const el of elements) {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);

            // Check if visible and in viewport
            if (
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              style.opacity !== '0' &&
              rect.width > 0 &&
              rect.height > 0 &&
              rect.top < viewportHeight &&
              rect.bottom > 0
            ) {
              spinnerDetected = true;
              break;
            }
          }
        } catch {
          // Invalid selector, skip
        }
        if (spinnerDetected) break;
      }

      // ─────────────────────────────────────────────────────────────────────────
      // Skeleton UI Detection
      // ─────────────────────────────────────────────────────────────────────────
      const skeletonSelectors = [
        '.skeleton',
        '.shimmer',
        '.placeholder',
        '[class*="skeleton"]',
        '[class*="shimmer"]',
        '.loading-placeholder',
        '.content-placeholder',
        '.MuiSkeleton-root',
        '.ant-skeleton',
        '.react-loading-skeleton',
      ];

      let skeletonDetected = false;
      for (const selector of skeletonSelectors) {
        try {
          const elements = Array.from(document.querySelectorAll(selector));
          for (const el of elements) {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);

            if (
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              rect.width > 50 &&
              rect.height > 20 &&
              rect.top < viewportHeight &&
              rect.bottom > 0
            ) {
              skeletonDetected = true;
              break;
            }
          }
        } catch {
          // Invalid selector, skip
        }
        if (skeletonDetected) break;
      }

      // ─────────────────────────────────────────────────────────────────────────
      // Text Placeholder Detection
      // ─────────────────────────────────────────────────────────────────────────
      const textPlaceholderPatterns = [
        /^Loading\.{0,3}$/i,
        /^Please wait\.{0,3}$/i,
        /^-{2,}$/,
        /^\.{3,}$/,
        /^\$-{1,}$/,
        /^TBD$/i,
        /^N\/A$/i,
        /^Coming soon$/i,
      ];

      const textPlaceholders: string[] = [];

      // Check price and key text elements
      const textSelectors = [
        '.price',
        '.product-price',
        '[class*="price"]',
        '.stock',
        '.availability',
        'h1',
        'h2',
        '.product-title',
        '.product-name',
      ];

      for (const selector of textSelectors) {
        try {
          const elements = Array.from(document.querySelectorAll(selector));
          for (const el of elements) {
            const text = el.textContent?.trim() || '';
            if (text && textPlaceholderPatterns.some((p) => p.test(text))) {
              textPlaceholders.push(text.slice(0, 20));
            }
          }
        } catch {
          // Skip invalid selectors
        }
      }

      // ─────────────────────────────────────────────────────────────────────────
      // Overlay Detection
      // ─────────────────────────────────────────────────────────────────────────
      const overlaySelectors = [
        '.modal',
        '.popup',
        '.overlay',
        '.dialog',
        '[role="dialog"]',
        '[aria-modal="true"]',
        '.cookie-banner',
        '.cookie-consent',
        '.gdpr',
        '.newsletter-popup',
        '.promo-modal',
        '#onetrust-banner-sdk',
        '.interstitial',
      ];

      let overlayStillVisible = false;
      for (const selector of overlaySelectors) {
        try {
          const elements = Array.from(document.querySelectorAll(selector));
          for (const el of elements) {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);

            if (
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              style.opacity !== '0' &&
              rect.width > 100 &&
              rect.height > 100
            ) {
              overlayStillVisible = true;
              break;
            }
          }
        } catch {
          // Skip invalid selectors
        }
        if (overlayStillVisible) break;
      }

      return {
        blankImageCount,
        placeholderImageCount,
        lazyPendingCount,
        spinnerDetected,
        skeletonDetected,
        textPlaceholders: textPlaceholders.slice(0, 5), // Limit to 5
        overlayStillVisible,
        totalImages,
        loadedImages,
        failedImages,
      };
    });

    // Combine browser signals with passed parameters
    const signals: ViewportValidatorSignals = {
      viewportIndex,
      blankImageCount: browserSignals.blankImageCount,
      placeholderImageCount: browserSignals.placeholderImageCount,
      lazyPendingCount: browserSignals.lazyPendingCount,
      spinnerDetected: browserSignals.spinnerDetected,
      skeletonDetected: browserSignals.skeletonDetected,
      textPlaceholders: browserSignals.textPlaceholders,
      overlayStillVisible: browserSignals.overlayStillVisible,
      mediaReadinessTimedOut,
      totalImages: browserSignals.totalImages,
      loadedImages: browserSignals.loadedImages,
      failedImages: browserSignals.failedImages,
      scrollPositionVerified,
    };

    logger.debug('Signals collected', {
      viewportIndex,
      blankImages: signals.blankImageCount,
      placeholders: signals.placeholderImageCount,
      spinner: signals.spinnerDetected,
      skeleton: signals.skeletonDetected,
      overlay: signals.overlayStillVisible,
    });

    return signals;
  } catch (error) {
    logger.warn('Failed to collect signals', {
      viewportIndex,
      error: error instanceof Error ? error.message : 'Unknown',
    });

    // Return empty signals on error
    const empty = createEmptyValidatorSignals(viewportIndex);
    empty.mediaReadinessTimedOut = mediaReadinessTimedOut;
    empty.scrollPositionVerified = scrollPositionVerified;
    return empty;
  }
}

/**
 * Quick check for critical issues (for early exit)
 */
export async function hasBlockingIssues(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      // Check for full-page overlay
      const overlays = Array.from(document.querySelectorAll(
        '.modal:not([style*="display: none"]), ' +
        '[role="dialog"]:not([style*="display: none"]), ' +
        '.overlay:not([style*="display: none"])'
      ));

      for (const overlay of overlays) {
        const rect = overlay.getBoundingClientRect();
        if (rect.width > window.innerWidth * 0.5 && rect.height > window.innerHeight * 0.5) {
          return true;
        }
      }

      return false;
    });
  } catch {
    return false;
  }
}
