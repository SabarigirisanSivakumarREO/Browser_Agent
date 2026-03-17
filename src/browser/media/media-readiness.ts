/**
 * Media Readiness Checks - Phase 25h (T525)
 *
 * Implements per-viewport readiness checks for lazy-loaded media.
 * Ensures images and media are loaded before screenshot capture.
 */

import type { Page } from 'playwright';
import { createLogger } from '../../utils/index.js';

const logger = createLogger('MediaReadiness');

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for media readiness checks
 */
export interface MediaReadinessConfig {
  /** Enable readiness checks (default: true) */
  enabled: boolean;
  /** Maximum time to wait for media in ms (default: 3000) */
  timeoutMs: number;
  /** Check images (default: true) */
  checkImages: boolean;
  /** Check videos (default: false) */
  checkVideos: boolean;
  /** Check iframes (default: false) */
  checkIframes: boolean;
  /** Minimum image size to consider (default: 50px) */
  minImageSize: number;
  /** Poll interval for checking readiness (default: 100ms) */
  pollIntervalMs: number;
}

/**
 * Result of media readiness check
 */
export interface MediaReadinessResult {
  /** Whether all media is ready (or timeout reached) */
  ready: boolean;
  /** Whether we timed out waiting */
  timedOut: boolean;
  /** Number of images checked */
  imagesChecked: number;
  /** Number of images that are fully loaded */
  imagesLoaded: number;
  /** Number of images still pending */
  imagesPending: number;
  /** Number of images that failed to load */
  imagesFailed: number;
  /** Any warnings generated */
  warnings: string[];
  /** Time spent waiting in ms */
  waitTimeMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Default Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: MediaReadinessConfig = {
  enabled: true,
  timeoutMs: 3000,
  checkImages: true,
  checkVideos: false,
  checkIframes: false,
  minImageSize: 50,
  pollIntervalMs: 100,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Readiness Function
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wait for media elements to be ready in the current viewport
 *
 * This function checks if visible images have loaded and waits
 * for lazy-loaded images to appear. It has a configurable timeout
 * to prevent blocking forever on slow resources.
 *
 * @param page - Playwright page instance
 * @param config - Readiness configuration
 * @returns Readiness result with details
 */
export async function waitForMediaReadiness(
  page: Page,
  config: Partial<MediaReadinessConfig> = {}
): Promise<MediaReadinessResult> {
  const fullConfig: MediaReadinessConfig = { ...DEFAULT_CONFIG, ...config };

  if (!fullConfig.enabled) {
    return {
      ready: true,
      timedOut: false,
      imagesChecked: 0,
      imagesLoaded: 0,
      imagesPending: 0,
      imagesFailed: 0,
      warnings: [],
      waitTimeMs: 0,
    };
  }

  const startTime = Date.now();
  const warnings: string[] = [];

  try {
    // Poll until ready or timeout
    const result = await pollForReadiness(page, fullConfig, startTime);

    if (result.timedOut) {
      warnings.push(
        `Media readiness timed out after ${fullConfig.timeoutMs}ms. ` +
        `${result.imagesPending} images still loading.`
      );
    }

    const waitTimeMs = Date.now() - startTime;

    if (result.imagesFailed > 0) {
      warnings.push(`${result.imagesFailed} images failed to load`);
    }

    logger.debug('Media readiness check complete', {
      ready: !result.timedOut,
      waitTimeMs,
      imagesLoaded: result.imagesLoaded,
      imagesPending: result.imagesPending,
      imagesFailed: result.imagesFailed,
    });

    return {
      ready: !result.timedOut,
      timedOut: result.timedOut,
      imagesChecked: result.imagesChecked,
      imagesLoaded: result.imagesLoaded,
      imagesPending: result.imagesPending,
      imagesFailed: result.imagesFailed,
      warnings,
      waitTimeMs,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    warnings.push(`Media readiness check failed: ${errorMsg}`);
    logger.warn('Media readiness check error', { error: errorMsg });

    return {
      ready: false,
      timedOut: true,
      imagesChecked: 0,
      imagesLoaded: 0,
      imagesPending: 0,
      imagesFailed: 0,
      warnings,
      waitTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Poll for media readiness with timeout
 */
async function pollForReadiness(
  page: Page,
  config: MediaReadinessConfig,
  startTime: number
): Promise<{
  timedOut: boolean;
  imagesChecked: number;
  imagesLoaded: number;
  imagesPending: number;
  imagesFailed: number;
}> {
  const { timeoutMs, pollIntervalMs, minImageSize } = config;

  while (Date.now() - startTime < timeoutMs) {
    // Check current state
    const status = await page.evaluate((minSize: number) => {
      // Get all images in the viewport
      const images = Array.from(document.querySelectorAll('img'));
      const viewportHeight = window.innerHeight;
      const viewportTop = window.scrollY;
      const viewportBottom = viewportTop + viewportHeight;

      let checked = 0;
      let loaded = 0;
      let pending = 0;
      let failed = 0;

      for (const img of images) {
        const rect = img.getBoundingClientRect();
        const absTop = rect.top + viewportTop;
        const absBottom = absTop + rect.height;

        // Skip if not in or near current viewport
        if (absBottom < viewportTop - 100 || absTop > viewportBottom + 100) {
          continue;
        }

        // Skip tiny images (icons, tracking pixels)
        if (rect.width < minSize && rect.height < minSize) {
          continue;
        }

        checked++;

        // Check if loaded
        if (img.complete) {
          if (img.naturalWidth === 0) {
            // Broken image
            failed++;
          } else {
            loaded++;
          }
        } else {
          pending++;
        }
      }

      return { checked, loaded, pending, failed };
    }, minImageSize);

    // All images loaded or none found
    if (status.pending === 0) {
      return {
        timedOut: false,
        imagesChecked: status.checked,
        imagesLoaded: status.loaded,
        imagesPending: 0,
        imagesFailed: status.failed,
      };
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Timeout - get final state
  const finalStatus = await page.evaluate((minSize: number) => {
    const images = Array.from(document.querySelectorAll('img'));
    const viewportHeight = window.innerHeight;
    const viewportTop = window.scrollY;
    const viewportBottom = viewportTop + viewportHeight;

    let checked = 0;
    let loaded = 0;
    let pending = 0;
    let failed = 0;

    for (const img of images) {
      const rect = img.getBoundingClientRect();
      const absTop = rect.top + viewportTop;
      const absBottom = absTop + rect.height;

      if (absBottom < viewportTop - 100 || absTop > viewportBottom + 100) {
        continue;
      }

      if (rect.width < minSize && rect.height < minSize) {
        continue;
      }

      checked++;

      if (img.complete) {
        if (img.naturalWidth === 0) {
          failed++;
        } else {
          loaded++;
        }
      } else {
        pending++;
      }
    }

    return { checked, loaded, pending, failed };
  }, minImageSize);

  return {
    timedOut: true,
    imagesChecked: finalStatus.checked,
    imagesLoaded: finalStatus.loaded,
    imagesPending: finalStatus.pending,
    imagesFailed: finalStatus.failed,
  };
}

/**
 * Quick check if any media is still loading (no wait)
 */
export async function checkMediaStatus(
  page: Page
): Promise<{ total: number; loaded: number; pending: number }> {
  try {
    return await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      let total = 0;
      let loaded = 0;
      let pending = 0;

      for (const img of images) {
        const rect = img.getBoundingClientRect();
        // Skip tiny images
        if (rect.width < 50 && rect.height < 50) continue;

        total++;
        if (img.complete && img.naturalWidth > 0) {
          loaded++;
        } else {
          pending++;
        }
      }

      return { total, loaded, pending };
    });
  } catch {
    return { total: 0, loaded: 0, pending: 0 };
  }
}

/**
 * Force trigger lazy loading by scrolling element into view
 */
export async function triggerLazyLoad(
  page: Page,
  selector: string
): Promise<boolean> {
  try {
    await page.evaluate((sel: string) => {
      const element = document.querySelector(sel);
      if (element) {
        element.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    }, selector);
    return true;
  } catch {
    return false;
  }
}
