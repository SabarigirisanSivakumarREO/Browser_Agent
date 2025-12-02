/**
 * Page Loader
 * Handles URL navigation and page load detection per FR-002, FR-003.
 */

import type { Page } from 'playwright';
import type { PageLoadResult, WaitUntilStrategy } from '../types/index.js';
import { createLogger, validateUrl } from '../utils/index.js';
import { CookieConsentHandler } from './cookie-handler.js';

const logger = createLogger('PageLoader');

/**
 * Configuration for page loading.
 */
export interface PageLoaderConfig {
  /** Navigation timeout in milliseconds */
  timeout: number;
  /** Wait strategy for page loading (default: 'load') */
  waitUntil?: WaitUntilStrategy;
  /** Additional wait time for JS to render after load (default: 5000ms) */
  postLoadWait?: number;
  /** Auto-dismiss cookie consent popups (default: true) */
  dismissCookieConsent?: boolean;
}

/** Default post-load wait for JS rendering (ms) */
const DEFAULT_POST_LOAD_WAIT = 5000;

/**
 * Handles URL navigation and page loading.
 * Supports configurable wait strategy with hybrid approach for dynamic content.
 */
export class PageLoader {
  private readonly page: Page;
  private readonly config: PageLoaderConfig;
  private readonly waitUntil: WaitUntilStrategy;
  private readonly postLoadWait: number;
  private readonly cookieHandler: CookieConsentHandler;
  private readonly dismissCookieConsent: boolean;

  /**
   * Creates a new PageLoader instance.
   * @param page - Playwright page instance
   * @param config - Page loader configuration
   */
  constructor(page: Page, config: PageLoaderConfig) {
    this.page = page;
    this.config = config;
    this.waitUntil = config.waitUntil ?? 'load';
    this.postLoadWait = config.postLoadWait ?? DEFAULT_POST_LOAD_WAIT;
    this.dismissCookieConsent = config.dismissCookieConsent ?? true;
    this.cookieHandler = new CookieConsentHandler();
  }

  /**
   * Loads a URL and waits for the page to be ready.
   * @param url - The URL to navigate to
   * @returns PageLoadResult with success status and details
   */
  async load(url: string): Promise<PageLoadResult> {
    const startTime = Date.now();

    // Validate URL first
    const validation = validateUrl(url);
    if (!validation.valid) {
      logger.warn('Invalid URL provided', { url, error: validation.error });
      return {
        success: false,
        url,
        error: validation.error,
        loadTimeMs: Date.now() - startTime,
      };
    }

    const normalizedUrl = validation.normalizedUrl ?? url;
    logger.info('Loading URL', { url: normalizedUrl, waitUntil: this.waitUntil });

    try {
      // Try primary wait strategy
      const result = await this.tryLoad(normalizedUrl, this.waitUntil, startTime);
      if (result) return result;

      // This shouldn't happen, but handle gracefully
      return {
        success: false,
        url: normalizedUrl,
        error: 'Unknown load error',
        loadTimeMs: Date.now() - startTime,
      };
    } catch (err) {
      const error = err as Error;

      // Handle timeout with fallback for networkidle
      if (
        (error.name === 'TimeoutError' || error.message.includes('Timeout')) &&
        this.waitUntil === 'networkidle'
      ) {
        logger.warn('networkidle timed out, falling back to load strategy', {
          url: normalizedUrl,
        });

        try {
          const fallbackResult = await this.tryLoad(normalizedUrl, 'load', startTime);
          if (fallbackResult) return fallbackResult;
        } catch (fallbackErr) {
          // Fallback also failed, return timeout error
          logger.error('Fallback load strategy also failed', { url: normalizedUrl });
        }
      }

      const loadTimeMs = Date.now() - startTime;

      // Handle timeout error
      if (error.name === 'TimeoutError' || error.message.includes('Timeout')) {
        logger.error('Page load timed out', {
          url: normalizedUrl,
          timeout: this.config.timeout,
          waitUntil: this.waitUntil,
        });

        return {
          success: false,
          url: normalizedUrl,
          error: `Page load timed out after ${this.config.timeout}ms (strategy: ${this.waitUntil})`,
          loadTimeMs,
        };
      }

      logger.errorWithStack('Failed to load page', error, { url: normalizedUrl });

      return {
        success: false,
        url: normalizedUrl,
        error: error.message,
        loadTimeMs,
      };
    }
  }

  /**
   * Attempts to load URL with specified wait strategy.
   * Uses hybrid approach: primary wait strategy + short networkidle for JS rendering.
   * @returns PageLoadResult on success, null on failure (throws on timeout)
   */
  private async tryLoad(
    url: string,
    waitUntil: WaitUntilStrategy,
    startTime: number
  ): Promise<PageLoadResult | null> {
    const response = await this.page.goto(url, {
      timeout: this.config.timeout,
      waitUntil,
    });

    // Check for HTTP errors
    if (response && !response.ok()) {
      const statusCode = response.status();
      logger.warn('Page returned error status', {
        url,
        status: statusCode,
      });

      return {
        success: false,
        url: this.page.url(),
        error: `HTTP ${statusCode}: ${response.statusText()}`,
        loadTimeMs: Date.now() - startTime,
      };
    }

    // Hybrid approach: wait for JS to render dynamic content
    // Only apply if primary strategy is not already networkidle
    if (waitUntil !== 'networkidle' && this.postLoadWait > 0) {
      logger.info('Waiting for JS rendering', { postLoadWait: this.postLoadWait });
      try {
        await this.page.waitForLoadState('networkidle', {
          timeout: this.postLoadWait,
        });
        logger.info('Network idle reached');
      } catch {
        // Timeout is expected for sites with persistent connections
        logger.debug('Post-load networkidle timeout (expected for some sites)');
      }
    }

    // Dismiss cookie consent popups if enabled
    let cookieConsentResult;
    if (this.dismissCookieConsent) {
      cookieConsentResult = await this.cookieHandler.dismiss(this.page);
    }

    // Get page title
    const title = await this.page.title();
    const loadTimeMs = Date.now() - startTime;

    logger.info('Page loaded successfully', {
      url: this.page.url(),
      title,
      loadTimeMs,
      waitUntil,
    });

    return {
      success: true,
      title,
      url: this.page.url(),
      loadTimeMs,
      cookieConsent: cookieConsentResult,
    };
  }

  /**
   * Waits for the page to reach a stable state.
   * Useful after dynamic content interactions.
   */
  async waitForStable(): Promise<void> {
    await this.page.waitForLoadState('networkidle', {
      timeout: this.config.timeout,
    });
  }

  /**
   * Gets the current page URL.
   */
  getCurrentUrl(): string {
    return this.page.url();
  }

  /**
   * Gets the current page title.
   */
  async getTitle(): Promise<string> {
    return this.page.title();
  }
}
