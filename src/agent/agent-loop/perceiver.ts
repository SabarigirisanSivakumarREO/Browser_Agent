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
import type { PerceivedState, InteractiveElement } from './types.js';

const AX_TREE_MAX_CHARS = 8000;
const AX_TREE_MIN_CHARS = 500;

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
 * @returns Lightweight perceived state
 */
export async function perceivePage(page: Page): Promise<PerceivedState> {
  // Wait briefly for any in-flight navigation to settle
  try {
    await page.waitForLoadState('load', { timeout: 3000 });
  } catch {
    // May timeout on slow pages — continue with whatever state we have
  }

  const url = page.url();
  let title = '';
  try {
    title = await page.title();
  } catch {
    // Title can fail during navigation — use empty string
  }

  // DOM hash
  const content = await page.content();
  const domHash = computeDomHash(content);

  // AX tree (truncated)
  let axTreeText: string | null = null;
  try {
    const raw = await captureAccessibilityTree(page, { maxTokens: 2000 });
    if (raw && raw.length > AX_TREE_MAX_CHARS) {
      axTreeText = raw.slice(0, AX_TREE_MAX_CHARS);
    } else {
      axTreeText = raw;
    }
  } catch {
    // AX tree capture can fail on some pages — continue without it
  }

  // Interactive elements (top 20 visible)
  let interactiveElements: InteractiveElement[] = [];
  try {
    interactiveElements = await page.evaluate(() => {
      const selectors =
        'a, button, input, select, textarea, [role="button"], [role="link"], [contenteditable]';
      const elements = Array.from(document.querySelectorAll(selectors));

      const results = [];

      for (let i = 0; i < elements.length && results.length < 20; i++) {
        const el = elements[i] as HTMLElement | undefined;
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const text = (el.innerText || el.getAttribute('aria-label') || '')
          .trim()
          .slice(0, 50);

        // Build a unique selector: prefer id, then name, then nth-of-type
        let selector = '';
        if (el.id) {
          selector = `//*[@id="${el.id}"]`;
        } else if (el.getAttribute('name')) {
          selector = `//${el.tagName.toLowerCase()}[@name="${el.getAttribute('name')}"]`;
        } else {
          // Count same-tag siblings before this element
          const parent = el.parentElement;
          if (parent) {
            const sameTag = Array.from(parent.children).filter(c => c.tagName === el.tagName);
            const pos = sameTag.indexOf(el) + 1;
            selector = `//${el.tagName.toLowerCase()}[${pos}]`;
          } else {
            selector = `//${el.tagName.toLowerCase()}`;
          }
        }

        results.push({
          index: results.length,
          tag: el.tagName.toLowerCase(),
          text,
          role: el.getAttribute('role') || undefined,
          type: el.getAttribute('type') || undefined,
          selector,
        });
      }
      return results;
    });
  } catch {
    // Evaluate can fail if page is navigating
  }

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

  // Screenshot fallback if AX tree is too short
  let screenshotBase64: string | undefined;
  if (!axTreeText || axTreeText.length < AX_TREE_MIN_CHARS) {
    try {
      const buffer = await page.screenshot({ type: 'jpeg', quality: 50 });
      screenshotBase64 = buffer.toString('base64');
    } catch {
      // Screenshot can fail on about:blank or crashed pages
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
  };
}
