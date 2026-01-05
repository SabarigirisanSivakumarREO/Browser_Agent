/**
 * Cookie Consent Handler Integration Tests
 * Tests cookie consent dismissal with real CMPs
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserManager } from '../../src/browser/index.js';
import { CookieConsentHandler } from '../../src/browser/cookie-handler.js';
import { DEFAULT_BROWSER_CONFIG } from '../../src/types/index.js';

describe('CookieConsentHandler Integration', () => {
  let browserManager: BrowserManager;
  let cookieHandler: CookieConsentHandler;

  beforeAll(async () => {
    browserManager = new BrowserManager({
      ...DEFAULT_BROWSER_CONFIG,
      headless: true, // Run tests headless
    });
    await browserManager.launch();
    cookieHandler = new CookieConsentHandler();
  });

  afterAll(async () => {
    if (browserManager) {
      await browserManager.close();
    }
  });

  it('should handle Peregrine Clothing cookie banner appropriately', async () => {
    const page = browserManager.getPage();

    // Clear cookies to ensure fresh state
    await page.context().clearCookies();
    await page.goto('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy', { waitUntil: 'load' });

    // Wait a bit for dynamic banners to initialize
    await page.waitForTimeout(3000);

    const result = await cookieHandler.dismiss(page);

    // Phase 12b: Enhanced detection should handle the banner
    // If banner is present (fresh visit), it should be dismissed
    // If banner was already dismissed (cookies set), result should be false
    if (result.dismissed) {
      // Could be detected as CMP (shopify-cookies, alpine-tailwind) or heuristic
      expect(['cmp', 'heuristic']).toContain(result.mode);
      if (result.mode === 'cmp') {
        // Peregrine uses class="cookies" (shopify-cookies pattern)
        expect(['shopify-cookies', 'alpine-tailwind', 'aria-cookie-banner']).toContain(result.cmpId);
      }
    } else {
      // Banner might not be present if cookies already set or site changed
      expect(result.mode).toBe('none');
    }
  });

  it('should use heuristic for pages with common accept buttons', async () => {
    const page = browserManager.getPage();

    // Create a simple test page with an accept button inside a cookie-related container
    // Uses class containing "cookie" to trigger container heuristic
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <div id="cookie-banner" class="cookie-notice" style="position: fixed; bottom: 0; width: 100%;">
          <p>We use cookies</p>
          <button id="accept-btn">Accept</button>
        </div>
      </body>
      </html>
    `);

    const result = await cookieHandler.dismiss(page);

    expect(result.dismissed).toBe(true);
    expect(result.mode).toBe('heuristic');
    expect(result.buttonText).toContain('Accept');
  });

  it('should handle case-insensitive button text matching', async () => {
    const page = browserManager.getPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <button>ALLOW ALL COOKIES</button>
      </body>
      </html>
    `);

    const result = await cookieHandler.dismiss(page);

    expect(result.dismissed).toBe(true);
    expect(result.mode).toBe('heuristic');
  });

  it('should detect OneTrust CMP pattern', async () => {
    const page = browserManager.getPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <div id="onetrust-consent-sdk" style="display: block;">
          <button id="onetrust-accept-btn-handler">Accept All Cookies</button>
        </div>
      </body>
      </html>
    `);

    const result = await cookieHandler.dismiss(page);

    expect(result.dismissed).toBe(true);
    expect(result.mode).toBe('cmp');
    expect(result.cmpId).toBe('onetrust');
  });

  it('should detect Cookiebot CMP pattern', async () => {
    const page = browserManager.getPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <div id="CybotCookiebotDialog" style="display: block;">
          <button id="CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll">Allow all</button>
        </div>
      </body>
      </html>
    `);

    const result = await cookieHandler.dismiss(page);

    expect(result.dismissed).toBe(true);
    expect(result.mode).toBe('cmp');
    expect(result.cmpId).toBe('cookiebot');
  });

  it('should handle failure gracefully without crashing', async () => {
    const page = browserManager.getPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <p>No cookie popup here</p>
      </body>
      </html>
    `);

    // Should not throw
    const result = await cookieHandler.dismiss(page);

    expect(result).toBeDefined();
    expect(result.dismissed).toBe(false);
  });

  it('should find accept buttons with various text patterns', async () => {
    const page = browserManager.getPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <button>Got it</button>
      </body>
      </html>
    `);

    const result = await cookieHandler.dismiss(page);

    expect(result.dismissed).toBe(true);
    expect(result.mode).toBe('heuristic');
    expect(result.buttonText?.toLowerCase()).toContain('got it');
  });

  // T280: Enhanced Cookie Detection Tests

  it('should detect Alpine.js cookie banner (x-data attribute)', async () => {
    const page = browserManager.getPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <div x-data="consent(false)" class="fixed bottom-0 w-full">
          <p>We use cookies</p>
          <button>Accept</button>
        </div>
      </body>
      </html>
    `);

    const result = await cookieHandler.dismiss(page);

    expect(result.dismissed).toBe(true);
    expect(result.mode).toBe('cmp');
    expect(result.cmpId).toBe('alpine-tailwind');
  });

  it('should detect aria-label cookie banner', async () => {
    const page = browserManager.getPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <div role="region" aria-label="cookie banner" class="fixed bottom-0">
          <p>This site uses cookies</p>
          <button>Accept</button>
        </div>
      </body>
      </html>
    `);

    const result = await cookieHandler.dismiss(page);

    expect(result.dismissed).toBe(true);
    // Could be detected as CMP or heuristic depending on pattern match order
    expect(['cmp', 'heuristic']).toContain(result.mode);
  });

  it('should detect extended element types (anchor as button)', async () => {
    const page = browserManager.getPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <div class="cookie-notice">
          <p>Cookie notice</p>
          <a href="#" role="button">Accept cookies</a>
        </div>
      </body>
      </html>
    `);

    const result = await cookieHandler.dismiss(page);

    expect(result.dismissed).toBe(true);
    expect(result.mode).toBe('heuristic');
    expect(result.buttonText?.toLowerCase()).toContain('accept');
  });

  it('should still detect existing CMPs (regression test)', async () => {
    const page = browserManager.getPage();

    // Test Usercentrics pattern
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <div id="usercentrics-root" style="display: block;">
          <button data-testid="uc-accept-all-button">Accept All</button>
        </div>
      </body>
      </html>
    `);

    const result = await cookieHandler.dismiss(page);

    expect(result.dismissed).toBe(true);
    expect(result.mode).toBe('cmp');
    expect(result.cmpId).toBe('usercentrics');
  });

  it('should detect Shopify default cookie banner (class="cookies")', async () => {
    const page = browserManager.getPage();

    // Shopify's default cookie banner structure (as used by Peregrine Clothing)
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <div class="cookies" style="position: fixed; bottom: 0; width: 100%;">
          <h2>Cookies</h2>
          <p>We use cookies to improve your experience.</p>
          <button>Cookie Preferences</button>
          <button>Accept Cookie preferences</button>
        </div>
      </body>
      </html>
    `);

    const result = await cookieHandler.dismiss(page);

    expect(result.dismissed).toBe(true);
    expect(result.mode).toBe('cmp');
    expect(result.cmpId).toBe('shopify-cookies');
  });
});
