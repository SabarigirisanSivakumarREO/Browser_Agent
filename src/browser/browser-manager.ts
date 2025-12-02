/**
 * Browser Manager
 * Handles Playwright browser lifecycle management per constitution III.
 */

import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page } from 'playwright';
import type { BrowserConfig } from '../types/index.js';
import { createLogger } from '../utils/index.js';

const logger = createLogger('BrowserManager');

/**
 * Manages Playwright browser instance lifecycle.
 * Handles browser launch, context creation, and cleanup.
 */
export class BrowserManager {
  private readonly config: BrowserConfig;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  /**
   * Creates a new BrowserManager instance.
   * @param config - Browser configuration options
   */
  constructor(config: BrowserConfig) {
    this.config = config;
  }

  /**
   * Launches the browser with configured settings.
   * Creates a new browser context and page.
   */
  async launch(): Promise<void> {
    logger.info('Launching browser', {
      browserType: this.config.browserType,
      headless: this.config.headless,
    });

    try {
      // Select browser type
      const browserType = this.getBrowserType();

      // Launch browser with configuration
      this.browser = await browserType.launch({
        headless: this.config.headless,
      });

      // Create isolated browser context
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ignoreHTTPSErrors: true,
      });

      // Create new page
      this.page = await this.context.newPage();

      // Set default timeout
      this.page.setDefaultTimeout(this.config.timeout);

      logger.info('Browser launched successfully');
    } catch (err) {
      logger.errorWithStack('Failed to launch browser', err as Error);
      throw err;
    }
  }

  /**
   * Gets the Playwright browser type based on configuration.
   */
  private getBrowserType(): typeof chromium | typeof firefox | typeof webkit {
    switch (this.config.browserType) {
      case 'firefox':
        return firefox;
      case 'webkit':
        return webkit;
      case 'chromium':
      default:
        return chromium;
    }
  }

  /**
   * Returns the current browser context.
   * @throws Error if browser is not launched
   */
  getContext(): BrowserContext {
    if (!this.context) {
      throw new Error('Browser not launched. Call launch() first.');
    }
    return this.context;
  }

  /**
   * Returns the current page.
   * @throws Error if browser is not launched
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }
    return this.page;
  }

  /**
   * Checks if the browser is currently running.
   */
  isRunning(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  /**
   * Closes the browser and releases all resources.
   */
  async close(): Promise<void> {
    logger.info('Closing browser');

    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      logger.info('Browser closed successfully');
    } catch (err) {
      logger.errorWithStack('Error closing browser', err as Error);
      throw err;
    }
  }
}
