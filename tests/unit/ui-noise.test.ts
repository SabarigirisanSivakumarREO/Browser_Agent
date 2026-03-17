/**
 * Unit Tests for UI Noise Suppression - Phase 25h (T531)
 *
 * Tests that UI noise suppression correctly identifies and hides
 * interfering elements while preserving main content.
 */

import { describe, it, expect } from 'vitest';
import {
  getAllSuppressionSelectors,
} from '../../src/browser/cleanup/ui-noise.js';

describe('UI Noise Suppression', () => {
  describe('getAllSuppressionSelectors', () => {
    it('should return all selector categories', () => {
      const selectors = getAllSuppressionSelectors();

      expect(selectors).toHaveProperty('cookieBanners');
      expect(selectors).toHaveProperty('chatWidgets');
      expect(selectors).toHaveProperty('promoBars');
      expect(selectors).toHaveProperty('newsletterModals');
      expect(selectors).toHaveProperty('interstitials');
    });

    it('should have cookie banner selectors', () => {
      const selectors = getAllSuppressionSelectors();

      expect(selectors.cookieBanners).toContain('#cookie-banner');
      expect(selectors.cookieBanners).toContain('#onetrust-consent-sdk');
      expect(selectors.cookieBanners).toContain('.cookie-consent');
    });

    it('should have chat widget selectors', () => {
      const selectors = getAllSuppressionSelectors();

      expect(selectors.chatWidgets).toContain('#intercom-container');
      expect(selectors.chatWidgets).toContain('#drift-widget');
      expect(selectors.chatWidgets).toContain('.intercom-launcher');
    });

    it('should have promo bar selectors', () => {
      const selectors = getAllSuppressionSelectors();

      expect(selectors.promoBars).toContain('.promo-bar');
      expect(selectors.promoBars).toContain('.announcement-bar');
      expect(selectors.promoBars).toContain('.sticky-banner');
    });

    it('should have newsletter modal selectors', () => {
      const selectors = getAllSuppressionSelectors();

      expect(selectors.newsletterModals).toContain('#newsletter-modal');
      expect(selectors.newsletterModals).toContain('.email-capture');
      expect(selectors.newsletterModals).toContain('[class*="exit-intent"]');
    });

    it('should have interstitial selectors', () => {
      const selectors = getAllSuppressionSelectors();

      expect(selectors.interstitials).toContain('#overlay');
      expect(selectors.interstitials).toContain('.modal-overlay');
      expect(selectors.interstitials).toContain('.interstitial');
    });

    it('should not have selectors that target main content', () => {
      const selectors = getAllSuppressionSelectors();
      const allSelectors = Object.values(selectors).flat();

      // Should not target common content elements
      expect(allSelectors).not.toContain('main');
      expect(allSelectors).not.toContain('article');
      expect(allSelectors).not.toContain('.product');
      expect(allSelectors).not.toContain('.content');
      expect(allSelectors).not.toContain('#main');
    });

    it('should have unique selectors (no duplicates)', () => {
      const selectors = getAllSuppressionSelectors();
      const allSelectors = Object.values(selectors).flat();
      const uniqueSelectors = new Set(allSelectors);

      expect(allSelectors.length).toBe(uniqueSelectors.size);
    });

    it('should have valid CSS selectors', () => {
      const selectors = getAllSuppressionSelectors();
      const allSelectors = Object.values(selectors).flat();

      // All selectors should start with valid selector patterns
      for (const selector of allSelectors) {
        expect(selector).toMatch(/^[#.\[\w]/); // Starts with #, ., [, or word char
      }
    });
  });

  describe('Selector Patterns', () => {
    it('should include OneTrust cookie banner', () => {
      const selectors = getAllSuppressionSelectors();
      const onetrust = selectors.cookieBanners.filter(s => s.includes('onetrust'));

      expect(onetrust.length).toBeGreaterThan(0);
    });

    it('should include common chat platforms', () => {
      const selectors = getAllSuppressionSelectors();
      const chatSelectors = selectors.chatWidgets;

      // Check for major chat platforms
      const hasIntercom = chatSelectors.some(s => s.includes('intercom'));
      const hasDrift = chatSelectors.some(s => s.includes('drift'));
      const hasZendesk = chatSelectors.some(s => s.includes('zendesk') || s.includes('ze-snippet'));

      expect(hasIntercom).toBe(true);
      expect(hasDrift).toBe(true);
      expect(hasZendesk).toBe(true);
    });

    it('should include Klaviyo newsletter popup', () => {
      const selectors = getAllSuppressionSelectors();
      const klaviyo = selectors.newsletterModals.filter(s => s.includes('klaviyo'));

      expect(klaviyo.length).toBeGreaterThan(0);
    });

    it('should include exit intent patterns', () => {
      const selectors = getAllSuppressionSelectors();
      const exitIntent = selectors.newsletterModals.filter(s => s.includes('exit-intent'));

      expect(exitIntent.length).toBeGreaterThan(0);
    });
  });
});
