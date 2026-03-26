/**
 * Perceiver — Page State Extraction
 *
 * Phase 32 (T721): Lightweight page state perception for the planner.
 * Extracts URL, title, DOM hash, AX tree, interactive elements,
 * blocker detection, and optional screenshot fallback.
 */

import { createHash } from 'crypto';
import type { Page } from 'playwright';
import { captureAccessibilityTree } from '../../browser/ax-tree-serializer.js';
import { collectInteractiveElements } from './element-collector.js';
import type { PerceivedState } from './types.js';

const AX_TREE_MAX_CHARS_DEFAULT = 8000;
const AX_TREE_MAX_CHARS_AGENT = 16000;
const AX_TREE_MAX_TOKENS_DEFAULT = 2000;
const AX_TREE_MAX_TOKENS_AGENT = 4000;

const CONTENT_RETRY_COUNT = 2;
const CONTENT_RETRY_DELAY_MS = 1000;

/** Navigation-pending sentinel used when page content cannot be read */
export const NAVIGATION_PENDING_HASH = 'navigation-pending';

/**
 * Safely retrieve page HTML content with retries.
 *
 * If `page.content()` throws (e.g. mid-navigation), retries up to
 * `CONTENT_RETRY_COUNT` times with a delay between attempts.
 * Returns empty string if all retries fail (degraded state).
 */
async function safeGetContent(page: Page): Promise<string> {
  for (let attempt = 0; attempt <= CONTENT_RETRY_COUNT; attempt++) {
    try {
      await page.waitForLoadState('load', { timeout: 3000 });
      return await page.content();
    } catch {
      if (attempt === CONTENT_RETRY_COUNT) return '';
      await new Promise((r) => setTimeout(r, CONTENT_RETRY_DELAY_MS));
    }
  }
  return '';
}

const BLOCKER_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /accept\s*cookies?/i, type: 'cookie_consent' },
  { pattern: /cookie\s*consent/i, type: 'cookie_consent' },
  { pattern: /accept\s*all/i, type: 'cookie_consent' },
  { pattern: /sign\s*in\s*to\s*continue/i, type: 'sign_in_wall' },
  { pattern: /captcha|recaptcha/i, type: 'captcha' },
];

/**
 * Compute a truncated SHA-256 hash of the page DOM content.
 *
 * @param content - Full page HTML content
 * @returns 16-char hex hash
 */
export function computeDomHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Perceive the current page state for the planner.
 *
 * @param page - Playwright page instance
 * @param agentMode - When true, uses expanded AX tree budget and always captures screenshot
 * @returns Lightweight perceived state
 */
export async function perceivePage(page: Page, agentMode = false): Promise<PerceivedState> {
  let url = '';
  try {
    url = page.url();
  } catch {
    url = 'about:blank';
  }

  let title = '';
  try {
    title = await page.title();
  } catch {
    // Title can fail during navigation — use empty string
  }

  // DOM hash — resilient to mid-navigation failures
  const content = await safeGetContent(page);
  const domHash = content ? computeDomHash(content) : NAVIGATION_PENDING_HASH;

  // AX tree (truncated — agent mode gets 2x budget)
  const axMaxChars = agentMode ? AX_TREE_MAX_CHARS_AGENT : AX_TREE_MAX_CHARS_DEFAULT;
  const axMaxTokens = agentMode ? AX_TREE_MAX_TOKENS_AGENT : AX_TREE_MAX_TOKENS_DEFAULT;
  let axTreeText: string | null = null;
  try {
    const raw = await captureAccessibilityTree(page, { maxTokens: axMaxTokens });
    if (raw && raw.length > axMaxChars) {
      axTreeText = raw.slice(0, axMaxChars);
    } else {
      axTreeText = raw;
    }
  } catch {
    // AX tree capture can fail on some pages — continue without it
  }

  // Interactive elements — viewport-aware scoring (Phase 35A)
  const { elements: interactiveElements, contentRegion } =
    await collectInteractiveElements(page, {
      maxElements: agentMode ? 50 : 20,
      maxHeaderElements: agentMode ? 10 : 15,
      textMaxLength: agentMode ? 80 : 50,
    });

  // Blocker detection from AX tree
  let hasBlocker = false;
  let blockerType: string | undefined;
  if (axTreeText) {
    for (const { pattern, type } of BLOCKER_PATTERNS) {
      if (pattern.test(axTreeText)) {
        hasBlocker = true;
        blockerType = type;
        break;
      }
    }
  }

  // Screenshot — always capture in agent mode (Phase 35E)
  let screenshotBase64: string | undefined;
  if (agentMode || !axTreeText || axTreeText.length < 500) {
    try {
      const buffer = await page.screenshot({ type: 'jpeg', quality: 50 });
      screenshotBase64 = buffer.toString('base64');
    } catch {
      // Screenshot can fail on about:blank or crashed pages
    }
  }

  // Page text — extract main content visible text (Phase 35F)
  let pageText: string | undefined;
  if (agentMode) {
    try {
      pageText = await page.evaluate(() => {
        const main = document.querySelector('main, [role="main"]') as HTMLElement | null;
        const text = (main || document.body).innerText || '';
        return text.slice(0, 2000);
      });
    } catch {
      // Can fail during navigation
    }
  }

  return {
    url,
    title,
    domHash,
    axTreeText,
    interactiveElements,
    hasBlocker,
    blockerType,
    screenshotBase64,
    pageText,
    contentRegion,
  };
}
