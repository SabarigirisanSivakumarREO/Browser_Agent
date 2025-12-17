/**
 * End-to-end workflow tests per SC-006.
 * Tests the complete workflow with 3 different URLs.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserAgent, DEFAULT_BROWSER_CONFIG } from '../../src/index.js';

describe('End-to-End Workflow', () => {
  let agent: BrowserAgent;

  beforeAll(() => {
    // Skip if no API key (allow tests to run without LangChain)
    const hasApiKey = process.env['OPENAI_API_KEY'] !== undefined;

    agent = new BrowserAgent({
      browser: {
        headless: true, // Headless for CI/CD
        timeout: 60000,
        browserType: 'chromium',
      },
      verbose: false,
    });

    // Only validate environment if we have the API key
    if (hasApiKey) {
      agent.validateEnvironment();
    }
  });

  afterAll(async () => {
    await agent.close();
  });

  describe('Test Case 1: Conversion.com', () => {
    it('should successfully load and extract from conversion.com', async () => {
      const result = await agent.processUrl('https://www.conversion.com/');

      // Verify page load success
      expect(result.success).toBe(true);
      expect(result.pageLoad.success).toBe(true);

      // Verify extraction
      expect(result.extraction).not.toBeNull();
      expect(result.extraction?.totalCount).toBeGreaterThan(0);

      // Verify no errors
      expect(result.error).toBeUndefined();
      expect(result.errorStage).toBeUndefined();

      // Verify timing
      expect(result.totalTimeMs).toBeGreaterThan(0);
      expect(result.totalTimeMs).toBeLessThan(60000);
    }, 90000);
  });

  describe('Test Case 2: Invespcro.com', () => {
    it('should handle invespcro.com page', async () => {
      const result = await agent.processUrl('https://www.invespcro.com/');

      // Verify page load success
      expect(result.pageLoad.success).toBe(true);

      // Should have multiple headings
      expect(result.extraction).not.toBeNull();
      expect(result.extraction?.totalCount).toBeGreaterThan(0);

      // Overall success
      expect(result.success).toBe(true);
    }, 90000);
  });

  describe('Test Case 3: NPDigital.com', () => {
    it('should handle npdigital.com page', async () => {
      const result = await agent.processUrl('https://www.npdigital.com/');

      // Verify page load success
      expect(result.pageLoad.success).toBe(true);

      // Should have headings
      expect(result.extraction).not.toBeNull();
      expect(result.extraction?.totalCount).toBeGreaterThan(0);

      // Overall success
      expect(result.success).toBe(true);
    }, 90000);
  });

  describe('Test Case 4: ROIHunt.in', () => {
    it('should handle roihunt.in CRO page', async () => {
      const result = await agent.processUrl('https://www.roihunt.in/conversion-rate-optimization-agency-in-india/');

      // Verify page load success
      expect(result.pageLoad.success).toBe(true);

      // Should have headings
      expect(result.extraction).not.toBeNull();
      expect(result.extraction?.totalCount).toBeGreaterThan(0);

      // Overall success
      expect(result.success).toBe(true);
    }, 90000);
  });

  describe('Test Case 5: WeAreTenet.com', () => {
    it('should handle wearetenet.com CRO services page', async () => {
      const result = await agent.processUrl('https://www.wearetenet.com/in/growth/conversion-rate-optimization-services');

      // Verify page load success
      expect(result.pageLoad.success).toBe(true);

      // Should have headings
      expect(result.extraction).not.toBeNull();
      expect(result.extraction?.totalCount).toBeGreaterThan(0);

      // Overall success
      expect(result.success).toBe(true);
    }, 90000);
  });

  describe('Batch processing', () => {
    it('should process multiple URLs and track success/failure counts', async () => {
      const urls = [
        'https://www.conversion.com/',
        'https://www.invespcro.com/',
        'https://www.npdigital.com/',
        'https://www.roihunt.in/conversion-rate-optimization-agency-in-india/',
        'https://www.wearetenet.com/in/growth/conversion-rate-optimization-services',
      ];

      const batch = await agent.processBatch(urls);

      // Verify batch statistics
      expect(batch.results.length).toBe(5);
      expect(batch.successCount).toBeGreaterThanOrEqual(1);
      expect(batch.totalTimeMs).toBeGreaterThan(0);

      // At least some URLs should succeed
      expect(batch.successCount + batch.failureCount).toBe(5);
    }, 300000); // Extended timeout for batch processing
  });

  describe('Output formatting', () => {
    it('should produce parseable console output', async () => {
      const result = await agent.processUrl('https://www.conversion.com/');
      const formatted = agent.formatResult(result);

      // Should contain key sections
      expect(formatted).toContain('BROWSER AGENT RESULTS');
      expect(formatted).toContain('conversion.com');
      expect(formatted).toContain('SUCCESS');
      expect(formatted).toContain('HEADINGS FOUND');

      // Should have box-drawing characters
      expect(formatted).toContain('┌');
      expect(formatted).toContain('└');
      expect(formatted).toContain('│');
    }, 90000);
  });

  describe('Cookie Consent Handling', () => {
    it('should attempt cookie consent dismissal on real sites', async () => {
      const result = await agent.processUrl('https://www.conversion.com/');

      // Should have page load result
      expect(result.pageLoad.success).toBe(true);

      // Cookie consent result should be present (even if not dismissed)
      expect(result.pageLoad.cookieConsent).toBeDefined();

      // Should have one of the expected modes
      expect(['cmp', 'heuristic', 'none']).toContain(result.pageLoad.cookieConsent?.mode);

      // If dismissed, should have additional context
      if (result.pageLoad.cookieConsent?.dismissed) {
        if (result.pageLoad.cookieConsent.mode === 'cmp') {
          expect(result.pageLoad.cookieConsent.cmpId).toBeDefined();
        } else if (result.pageLoad.cookieConsent.mode === 'heuristic') {
          expect(result.pageLoad.cookieConsent.buttonText).toBeDefined();
        }
      }

      // Extraction should still work regardless of cookie popup
      expect(result.success).toBe(true);
      expect(result.extraction).toBeDefined();
      expect(result.extraction?.totalCount).toBeGreaterThan(0);
    }, 90000);

    it('should respect --no-cookie-dismiss flag when disabled', async () => {
      // Create agent with cookie dismissal disabled
      const agentNoCookies = new BrowserAgent({
        browser: {
          ...DEFAULT_BROWSER_CONFIG,
          headless: true,
          dismissCookieConsent: false, // Disable cookie dismissal
        },
      });

      try {
        const result = await agentNoCookies.processUrl('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711');

        // Cookie consent should not be attempted
        expect(result.pageLoad.cookieConsent).toBeUndefined();

        // Page should still load successfully
        expect(result.pageLoad.success).toBe(true);
      } finally {
        await agentNoCookies.close();
      }
    }, 60000);
  });
});
