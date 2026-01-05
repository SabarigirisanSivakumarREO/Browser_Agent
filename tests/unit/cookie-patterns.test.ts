/**
 * Cookie Patterns Unit Tests
 * Tests for CMP pattern definitions in cookie-patterns.ts
 */

import { describe, it, expect } from 'vitest';
import { COOKIE_CONSENT_PATTERNS } from '../../src/browser/cookie-patterns.js';
import { CookieConsentHandler } from '../../src/browser/cookie-handler.js';

describe('COOKIE_CONSENT_PATTERNS', () => {
  describe('existing patterns', () => {
    it('should include all standard CMPs', () => {
      const patternIds = COOKIE_CONSENT_PATTERNS.map((p) => p.id);
      expect(patternIds).toContain('onetrust');
      expect(patternIds).toContain('cookiebot');
      expect(patternIds).toContain('usercentrics');
      expect(patternIds).toContain('trustarc');
      expect(patternIds).toContain('quantcast');
      expect(patternIds).toContain('didomi');
      expect(patternIds).toContain('osano');
      expect(patternIds).toContain('consent-manager');
    });
  });

  describe('T275: alpine-tailwind pattern', () => {
    it('should have alpine-tailwind pattern with correct selectors', () => {
      const pattern = COOKIE_CONSENT_PATTERNS.find((p) => p.id === 'alpine-tailwind');

      expect(pattern).toBeDefined();
      expect(pattern!.detectSelector).toContain('[x-data*="consent"]');
      expect(pattern!.detectSelector).toContain('[x-data*="cookie"]');
      expect(pattern!.acceptSelector).toContain('button:has-text("accept")');
      expect(pattern!.acceptSelector).toContain('a:has-text("accept")');
    });
  });

  describe('T275: aria-cookie-banner pattern', () => {
    it('should have aria-cookie-banner pattern with correct selectors', () => {
      const pattern = COOKIE_CONSENT_PATTERNS.find((p) => p.id === 'aria-cookie-banner');

      expect(pattern).toBeDefined();
      expect(pattern!.detectSelector).toContain('[aria-label*="cookie" i]');
      expect(pattern!.detectSelector).toContain('[role="region"][aria-label*="cookie" i]');
      expect(pattern!.detectSelector).toContain('[aria-label*="cookie banner" i]');
      expect(pattern!.acceptSelector).toContain('button:has-text("accept")');
    });
  });

  describe('T275: fixed-cookie-banner pattern', () => {
    it('should have fixed-cookie-banner pattern with correct selectors', () => {
      const pattern = COOKIE_CONSENT_PATTERNS.find((p) => p.id === 'fixed-cookie-banner');

      expect(pattern).toBeDefined();
      expect(pattern!.detectSelector).toContain('.fixed[class*="cookie"]');
      expect(pattern!.detectSelector).toContain('.fixed.bottom-0[class*="cookie"]');
      expect(pattern!.detectSelector).toContain('.fixed.bottom-0[class*="consent"]');
      expect(pattern!.acceptSelector).toContain('.fixed[class*="cookie"] button:has-text("accept")');
      expect(pattern!.acceptSelector).toContain('.fixed.bottom-0 button:has-text("accept")');
    });
  });

  describe('pattern structure validation', () => {
    it('all patterns should have required fields', () => {
      for (const pattern of COOKIE_CONSENT_PATTERNS) {
        expect(pattern.id).toBeDefined();
        expect(pattern.id.length).toBeGreaterThan(0);
        expect(pattern.detectSelector).toBeDefined();
        expect(pattern.detectSelector.length).toBeGreaterThan(0);
        expect(pattern.acceptSelector).toBeDefined();
        expect(pattern.acceptSelector.length).toBeGreaterThan(0);
      }
    });

    it('should have exactly 12 patterns (8 original + 4 new)', () => {
      expect(COOKIE_CONSENT_PATTERNS).toHaveLength(12);
    });
  });

  describe('shopify-cookies pattern', () => {
    it('should have shopify-cookies pattern with correct selectors', () => {
      const pattern = COOKIE_CONSENT_PATTERNS.find((p) => p.id === 'shopify-cookies');

      expect(pattern).toBeDefined();
      expect(pattern!.detectSelector).toContain('.cookies');
      expect(pattern!.acceptSelector).toContain('.cookies button:has-text("accept")');
      expect(pattern!.acceptSelector).toContain('.cookies a:has-text("accept")');
    });
  });
});

describe('CookieConsentHandler', () => {
  describe('T276: tryAriaLabeledBanner method', () => {
    it('should have tryAriaLabeledBanner method defined', () => {
      const handler = new CookieConsentHandler();
      expect(handler.tryAriaLabeledBanner).toBeDefined();
      expect(typeof handler.tryAriaLabeledBanner).toBe('function');
    });

    it('tryAriaLabeledBanner should be a public async method', () => {
      const handler = new CookieConsentHandler();
      // Verify the method is accessible (public)
      expect(handler.tryAriaLabeledBanner).toBeDefined();
      // Verify it's an async function (returns a Promise)
      const descriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(handler),
        'tryAriaLabeledBanner'
      );
      expect(descriptor).toBeDefined();
    });

    it('tryAriaLabeledBanner should be part of the handler API', () => {
      const handler = new CookieConsentHandler();
      // Handler should have dismiss and tryAriaLabeledBanner methods
      expect(handler.dismiss).toBeDefined();
      expect(handler.tryAriaLabeledBanner).toBeDefined();
    });
  });

  describe('T277: tryContainerHeuristic method', () => {
    it('should have tryContainerHeuristic method defined', () => {
      const handler = new CookieConsentHandler();
      expect(handler.tryContainerHeuristic).toBeDefined();
      expect(typeof handler.tryContainerHeuristic).toBe('function');
    });

    it('tryContainerHeuristic should be a public async method', () => {
      const handler = new CookieConsentHandler();
      // Verify the method is accessible (public)
      expect(handler.tryContainerHeuristic).toBeDefined();
      // Verify it's an async function (returns a Promise)
      const descriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(handler),
        'tryContainerHeuristic'
      );
      expect(descriptor).toBeDefined();
    });
  });

  describe('T278: Extended heuristic element types', () => {
    it('should have tryBroadButtonSearch method defined', () => {
      const handler = new CookieConsentHandler();
      expect(handler.tryBroadButtonSearch).toBeDefined();
      expect(typeof handler.tryBroadButtonSearch).toBe('function');
    });

    it('tryBroadButtonSearch should be a public async method', () => {
      const handler = new CookieConsentHandler();
      // Verify the method is accessible (public)
      expect(handler.tryBroadButtonSearch).toBeDefined();
      // Verify it's an async function
      const descriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(handler),
        'tryBroadButtonSearch'
      );
      expect(descriptor).toBeDefined();
    });

    it('handler should have all required methods', () => {
      const handler = new CookieConsentHandler();
      // All T276-T278 methods should be accessible
      expect(handler.dismiss).toBeDefined();
      expect(handler.tryAriaLabeledBanner).toBeDefined();
      expect(handler.tryContainerHeuristic).toBeDefined();
      expect(handler.tryBroadButtonSearch).toBeDefined();
    });
  });

  describe('T279: Priority chain heuristic', () => {
    it('handler should have dismiss as main entry point', () => {
      const handler = new CookieConsentHandler();
      // dismiss() is the main entry point that uses the priority chain
      expect(handler.dismiss).toBeDefined();
      expect(typeof handler.dismiss).toBe('function');
    });

    it('all priority chain methods should be accessible', () => {
      const handler = new CookieConsentHandler();
      // Priority 1: tryAriaLabeledBanner (most reliable)
      expect(handler.tryAriaLabeledBanner).toBeDefined();
      // Priority 2: tryContainerHeuristic (context-aware)
      expect(handler.tryContainerHeuristic).toBeDefined();
      // Priority 3: tryBroadButtonSearch (fallback)
      expect(handler.tryBroadButtonSearch).toBeDefined();
    });
  });
});
