/**
 * Browser Module Exports
 */

export { BrowserManager } from './browser-manager.js';
export { PageLoader, type PageLoaderConfig } from './page-loader.js';
export { CookieConsentHandler } from './cookie-handler.js';
export { COOKIE_CONSENT_PATTERNS } from './cookie-patterns.js';
export {
  captureAccessibilityTree,
  serializeAccessibilityNode,
  truncateToTokenBudget,
} from './ax-tree-serializer.js';
