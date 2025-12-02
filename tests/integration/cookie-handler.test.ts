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

  it('should handle pages without cookie popups', async () => {
    const page = browserManager.getPage();
    await page.goto('https://example.com', { waitUntil: 'load' });

    const result = await cookieHandler.dismiss(page);

    expect(result.dismissed).toBe(false);
    expect(result.mode).toBe('none');
  });

  it('should use heuristic for pages with common accept buttons', async () => {
    const page = browserManager.getPage();

    // Create a simple test page with an accept button
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <div id="cookie-banner" style="position: fixed; bottom: 0; width: 100%;">
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
});
