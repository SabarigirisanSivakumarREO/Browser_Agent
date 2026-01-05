**Navigation**: [Index](./index.md) | [Previous](./phases-01-09.md) | [Next](./phases-13-14.md)

---

## Phase 10: Bug Fixes & Improvements (Post-Implementation)

**Purpose**: Runtime issues discovered during testing

- [x] T036 Add `@playwright/browser-chromium` to package.json dependencies
- [x] T037 Add `ignoreHTTPSErrors: true` to browser context in browser-manager.ts
- [x] T038 Add dotenv config import to vitest.config.ts
- [x] T039 Update e2e test URLs to use real CRO agency websites

**Checkpoint**: All e2e tests pass, application works with real websites

---

## Phase 11: Wait Strategy & Dynamic Content (Post-Implementation)

**Purpose**: Fix timeout issues and improve dynamic content extraction

- [x] T040 Change default wait strategy from `networkidle` to `load`
- [x] T041 Add `--wait-until` CLI flag for user override
- [x] T042 Implement hybrid wait strategy in PageLoader
- [x] T043 Add `--post-load-wait` CLI flag for JS rendering wait
- [x] T044 Add `postLoadWait` to BrowserConfig type and defaults

**Checkpoint**: Dynamic content sites extract all headings correctly

---

## Phase 12: Cookie Consent Handling (User Story 5)

**Purpose**: Auto-dismiss cookie consent popups before extraction

- [x] T045 [US5] Add `dismissCookieConsent` to BrowserConfig in src/types/index.ts
- [x] T046 [US5] Add `--no-cookie-dismiss` CLI flag to src/cli.ts
- [x] T047 [US5] Create src/browser/cookie-patterns.ts with CMP selector patterns
- [x] T048 [US5] Create src/browser/cookie-handler.ts with CookieConsentHandler class
- [x] T049 [US5] Update src/browser/index.ts to export CookieConsentHandler
- [x] T050 [US5] Integrate CookieConsentHandler into PageLoader
- [x] T051 [US5] Wire `dismissCookieConsent` config through BrowserAgent to PageLoader
- [x] T052 [P] [US5] Create tests/integration/cookie-handler.test.ts
- [x] T053 [US5] Update e2e tests to verify cookie popups don't block extraction

**Checkpoint**: Sites with cookie popups have them dismissed before extraction

---

## Phase 12b: Enhanced Cookie Consent Detection ✅

**Purpose**: Improve cookie detection for Shopify themes, Alpine.js banners, and aria-labeled regions

**Root Cause**: Peregrine Clothing (Shopify + Alpine.js + Tailwind) cookie banner not detected despite visible "Accept" button. Banner uses `aria-label="cookie banner"` and `x-data="consent(false)"` which current patterns don't match.

### Tasks

- [x] T275 [US5] Add 3 new CMP patterns to cookie-patterns.ts
  - `alpine-tailwind`: `[x-data*="consent"]`, `[x-data*="cookie"]`
  - `aria-cookie-banner`: `[aria-label*="cookie" i]`, `[role="region"][aria-label*="cookie"]`
  - `fixed-cookie-banner`: `.fixed[class*="cookie"]`, `.fixed.bottom-0`
  - Tests: 3 unit tests for new patterns

- [x] T276 [US5] Create `tryAriaLabeledBanner()` method in cookie-handler.ts
  - Search for `[role="region"][aria-label*="cookie" i]`
  - Search for `[aria-label*="cookie banner" i]`
  - Wait 2000ms for dynamic banners (Alpine.js)
  - Tests: 3 unit tests

- [x] T277 [US5] Create `tryContainerHeuristic()` method in cookie-handler.ts
  - Define COOKIE_CONTAINER_INDICATORS array
  - Search within containers for accept buttons
  - Tests: 2 unit tests

- [x] T278 [US5] Extend heuristic element types
  - Add 'a', 'div[role="button"]', 'span[role="button"]', '[type="submit"]' to search
  - Add 'save' to ACCEPT_TEXT_PATTERNS (for preference dialogs)
  - Update SELECTOR_TIMEOUT from 1000ms to 2000ms
  - Tests: 3 unit tests

- [x] T279 [US5] Refactor `tryHeuristic()` to use priority chain
  - Priority 1: `tryAriaLabeledBanner()` (most reliable)
  - Priority 2: `tryContainerHeuristic()` (context-aware)
  - Priority 3: `tryBroadButtonSearch()` (fallback, existing logic)
  - Tests: 2 unit tests

- [x] T280 [P] [US5] Update tests/integration/cookie-handler.test.ts
  - Add test for Alpine.js banner detection
  - Add test for aria-label banner detection
  - Add test for extended element types
  - Add regression test for existing CMPs
  - Tests: 4 integration tests

- [x] T281 [US5] Add Peregrine Clothing e2e test case
  - Test URL: https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy
  - Verify banner dismissed before DOM extraction
  - Tests: 1 e2e test

**Checkpoint**: `npm run start -- https://www.peregrineclothing.co.uk/...` dismisses cookie banner successfully ✅

**Test Totals**: 17 unit tests

---

## Phase 12c: Peregrine Cookie Banner Fix ✅

**Purpose**: Fix cookie banner dismissal for Peregrine Clothing site where Accept button doesn't close banner

**Root Cause**: Peregrine Clothing banner uses plain `<div>` container with no identifying classes. The Accept button saves preferences but doesn't visually close the banner - the Close (X) button is required.

### Tasks

- [x] T282 [US5] Add `trySiblingButtonSearch()` method to cookie-handler.ts
  - Find container with "Cookie preferences" button
  - Locate Accept button within same container
  - Exclude buttons containing "preferences", "settings", "manage"
  - Two-step: click Accept, then click Close if banner still visible

- [x] T283 [US5] Add `shopify-cookies` CMP pattern to cookie-patterns.ts
  - Detect: `.cookies`, `div.cookies`, `section.cookies`
  - Accept: `.cookies button:has-text("accept")`, `.cookies a:has-text("accept")`
  - Reorder COOKIE_CONTAINER_INDICATORS for priority (exact match first)

- [x] T284 [US5] Improve `tryBroadButtonSearch()` with force-click fallback
  - Check element count before visibility check
  - Reduce visibility timeout to 500ms
  - Try force-click if element exists but not visible

**Checkpoint**: Cookie banner elements removed from DOM after dismissal ✅

**Test Totals**: 12 integration tests (29 total with unit tests)

---
