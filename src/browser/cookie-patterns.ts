/**
 * Cookie Consent Management Platform (CMP) Patterns
 * Selector patterns for known cookie consent platforms.
 */

import type { CookieConsentPattern } from '../types/index.js';

/**
 * Known CMP patterns for automatic cookie consent dismissal.
 * Ordered by prevalence/popularity.
 */
export const COOKIE_CONSENT_PATTERNS: CookieConsentPattern[] = [
  // OneTrust - Very common, used by many enterprise sites
  {
    id: 'onetrust',
    detectSelector: '#onetrust-consent-sdk, #onetrust-banner-sdk',
    acceptSelector: '#onetrust-accept-btn-handler, button[id*="accept"]',
    frameHint: 'onetrust',
  },

  // Cookiebot - Popular in EU
  {
    id: 'cookiebot',
    detectSelector: '#CybotCookiebotDialog, #CookiebotWidget',
    acceptSelector: '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, .CybotCookiebotDialogBodyButton[data-action="allow-all"]',
  },

  // Usercentrics - Common in Germany
  {
    id: 'usercentrics',
    detectSelector: '#usercentrics-root, [data-usercentrics-cmp]',
    acceptSelector: '[data-testid="uc-accept-all-button"], button[aria-label*="Accept"]',
  },

  // TrustArc - Enterprise solution
  {
    id: 'trustarc',
    detectSelector: '#truste-consent-track, #teconsent',
    acceptSelector: '.truste-button2, .trustarc-agree-btn',
    frameHint: 'trustarc',
  },

  // Quantcast Choice - IAB TCF compliant
  {
    id: 'quantcast',
    detectSelector: '.qc-cmp-ui-container, #qc-cmp2-ui',
    acceptSelector: 'button[mode="primary"], .qc-cmp-button-primary',
  },

  // Didomi - French CMP
  {
    id: 'didomi',
    detectSelector: '#didomi-host, .didomi-popup',
    acceptSelector: '#didomi-notice-agree-button, button[aria-label*="agree"]',
  },

  // Osano - US-focused
  {
    id: 'osano',
    detectSelector: '.osano-cm-window, .osano-cm-dialog',
    acceptSelector: '.osano-cm-accept-all, button[data-osano="accept-all"]',
  },

  // Consent Manager (generic)
  {
    id: 'consent-manager',
    detectSelector: '.consent-manager, #consent-manager',
    acceptSelector: '.cm-btn-accept, button[data-action="accept"]',
  },
];
