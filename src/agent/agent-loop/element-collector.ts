/**
 * Viewport-Aware Element Collector
 *
 * Phase 35A (T797): Replaces the old 20-element DOM-order collection with
 * scored, region-aware collection that prioritises main-content elements
 * visible in the viewport.
 *
 * IMPORTANT: The page.evaluate callback must use plain JS (no TypeScript
 * annotations, no named function declarations) because tsx/esbuild injects
 * __name() decorators that don't exist in the browser context.
 */

import type { Page } from 'playwright';
import type {
  InteractiveElement,
  ContentRegion,
  ElementCollectionConfig,
} from './types.js';

/** Shape returned by the in-page evaluate function. */
interface RawElement {
  tag: string;
  text: string;
  role: string | null;
  type: string | null;
  selector: string;
  region: 'header' | 'main' | 'footer' | 'unknown';
  score: number;
  accessibleName: string;
  placeholder: string;
  group: string;
}

const DEFAULT_MAX_ELEMENTS = 50;
const DEFAULT_MAX_HEADER_ELEMENTS = 10;
const DEFAULT_TEXT_MAX_LENGTH = 80;

/**
 * Collect interactive elements from the page, scored by viewport visibility
 * and content-region relevance.
 *
 * @param page - Playwright Page instance
 * @param config - Optional caps and text-length limits
 * @returns Scored interactive elements and a content-region summary
 */
export async function collectInteractiveElements(
  page: Page,
  config?: ElementCollectionConfig,
): Promise<{ elements: InteractiveElement[]; contentRegion: ContentRegion }> {
  const maxElements = config?.maxElements ?? DEFAULT_MAX_ELEMENTS;
  const maxHeaderElements = config?.maxHeaderElements ?? DEFAULT_MAX_HEADER_ELEMENTS;
  const textMaxLength = config?.textMaxLength ?? DEFAULT_TEXT_MAX_LENGTH;

  try {
    // All logic inside page.evaluate uses plain JS to avoid tsx __name injection.
    // No function declarations, no TypeScript type annotations inside the callback.
    const raw = await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (opts: any) => {
        const maxLen = opts.textMaxLength;

        // --- Find main content region ---
        let mainEl =
          document.querySelector('main') ||
          document.querySelector('[role="main"]');

        if (!mainEl) {
          let best = null;
          let bestCount = 0;
          const divs = document.querySelectorAll('div');
          for (let di = 0; di < divs.length; di++) {
            const c = divs[di]!.querySelectorAll('*').length;
            if (c > bestCount) { bestCount = c; best = divs[di]!; }
          }
          mainEl = best;
        }

        const hasMainLandmark = !!(
          document.querySelector('main') ||
          document.querySelector('[role="main"]')
        );

        // --- Collect interactive elements ---
        const sel = 'a, button, input, select, textarea, [role="button"], [role="link"], [contenteditable]';
        const nodes = document.querySelectorAll(sel);
        const vh = window.innerHeight;
        const results = [];

        for (let ni = 0; ni < nodes.length; ni++) {
          const node = nodes[ni]!;
          const rect = node.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;

          const tag = node.tagName.toLowerCase();
          const ariaLabel = node.getAttribute('aria-label');
          const rawText = (node as HTMLElement).innerText || '';
          const trimmed = rawText.trim().replace(/\s+/g, ' ');
          const text = trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
          const accName = ariaLabel
            ? (ariaLabel.length > maxLen ? ariaLabel.slice(0, maxLen) : ariaLabel)
            : text;

          // Determine region by walking ancestors
          let region = 'unknown';
          let cur = node.parentElement;
          while (cur) {
            const tn = cur.tagName;
            const rl = cur.getAttribute('role');
            if (tn === 'HEADER' || rl === 'banner' || tn === 'NAV' || rl === 'navigation') {
              region = 'header'; break;
            }
            if (tn === 'FOOTER' || rl === 'contentinfo') {
              region = 'footer'; break;
            }
            cur = cur.parentElement;
          }
          if (region === 'unknown' && mainEl && mainEl.contains(node)) {
            region = 'main';
          }

          // Score
          let score = 0;
          if (rect.top >= 0 && rect.top <= vh) score += 10;
          if (mainEl && mainEl.contains(node)) score += 8;
          if (text.length > 3) score += 5;
          if (tag === 'a') {
            var href = node.getAttribute('href');
            if (href && href.indexOf('javascript:') !== 0) score += 3;
          }
          if (ariaLabel) score += 2;
          // Form inputs get a boost — they're essential for interaction
          if (tag === 'input' || tag === 'textarea' || tag === 'select') score += 6;
          // Search inputs get a large boost — they're critical for goal-directed tasks
          if (node.getAttribute('role') === 'searchbox' || (tag === 'input' && (node.getAttribute('type') === 'text' || node.getAttribute('type') === 'search') && placeholder)) score += 15;
          if (region === 'header') score -= 5;

          // Build selector: id > aria-label > data-testid > scoped CSS path
          let selector = tag;
          if (node.id) {
            selector = '#' + CSS.escape(node.id);
          } else if (ariaLabel) {
            const s = '[aria-label="' + CSS.escape(ariaLabel) + '"]';
            if (document.querySelectorAll(s).length === 1) selector = s;
          }
          if (selector === tag) {
            const testId = node.getAttribute('data-testid');
            if (testId) {
              const s = '[data-testid="' + CSS.escape(testId) + '"]';
              if (document.querySelectorAll(s).length === 1) selector = s;
            }
          }
          if (selector === tag) {
            // Scoped CSS path from closest id ancestor or body
            const parts = [];
            let pathEl = node as Element | null;
            while (pathEl && pathEl !== document.body) {
              const parent = pathEl.parentElement;
              if (!parent) break;
              const ptag = pathEl.tagName.toLowerCase();
              const siblings = [];
              for (let si = 0; si < parent.children.length; si++) {
                if (parent.children[si]!.tagName === pathEl.tagName) siblings.push(parent.children[si]);
              }
              const idx = Array.prototype.indexOf.call(parent.children, pathEl) + 1;
              const nth = siblings.length > 1 ? ':nth-child(' + idx + ')' : '';
              parts.unshift(ptag + nth);
              if (pathEl.id) {
                parts[0] = '#' + CSS.escape(pathEl.id);
                break;
              }
              pathEl = parent;
            }
            if (parts.length > 0) selector = parts.join(' > ');
          }

          // Capture placeholder for inputs
          var placeholder = node.getAttribute('placeholder') || '';
          if (placeholder.length > maxLen) placeholder = placeholder.slice(0, maxLen);

          // Detect element group — find nearest <form>, [role="search"], or common container
          var group = '';
          var groupEl = node.parentElement;
          for (var gi = 0; gi < 5 && groupEl; gi++) {
            var gTag = groupEl.tagName;
            var gRole = groupEl.getAttribute('role');
            var gLabel = groupEl.getAttribute('aria-label');
            if (gTag === 'FORM') {
              group = gLabel || groupEl.getAttribute('name') || groupEl.id || 'form';
              break;
            }
            if (gRole === 'search') {
              group = gLabel || 'search-bar';
              break;
            }
            if (gRole === 'dialog' || gRole === 'alertdialog') {
              group = gLabel || 'dialog';
              break;
            }
            groupEl = groupEl.parentElement;
          }

          results.push({
            tag: tag,
            text: text,
            role: node.getAttribute('role'),
            type: node.getAttribute('type'),
            selector: selector,
            region: region,
            score: score,
            accessibleName: accName,
            placeholder: placeholder,
            group: group,
          });
        }

        // Sort by score descending
        results.sort(function(a, b) { return b.score - a.score; });

        return { elements: results, hasMainLandmark: hasMainLandmark };
      },
      { textMaxLength },
    );

    // --- Post-processing: apply caps ---
    const headerElements: RawElement[] = [];
    const nonHeaderElements: RawElement[] = [];

    for (const rawEl of raw.elements) {
      const el = rawEl as RawElement;
      if (el.region === 'header') {
        headerElements.push(el);
      } else {
        nonHeaderElements.push(el);
      }
    }

    const cappedHeader = headerElements.slice(0, maxHeaderElements);
    const remaining = maxElements - cappedHeader.length;
    const cappedContent = nonHeaderElements.slice(0, Math.max(0, remaining));

    // Merge: content first (higher scores), then header
    const merged = [...cappedContent, ...cappedHeader];
    merged.sort((a, b) => b.score - a.score);

    // Re-index 0..N
    const elements: InteractiveElement[] = merged.map((el, idx) => ({
      index: idx,
      tag: el.tag,
      text: el.text,
      role: el.role ?? undefined,
      type: el.type ?? undefined,
      selector: el.selector,
      region: el.region as InteractiveElement['region'],
      score: el.score,
      accessibleName: el.accessibleName,
      placeholder: el.placeholder || undefined,
      group: el.group || undefined,
    }));

    // Build ContentRegion summary from raw (uncapped) elements
    const allRaw = raw.elements;
    const contentRegion: ContentRegion = {
      hasMainLandmark: raw.hasMainLandmark,
      mainContentLinks: allRaw.filter((e) => e.region === 'main' && e.tag === 'a').length,
      mainContentButtons: allRaw.filter(
        (e) => e.region === 'main' && (e.tag === 'button' || e.role === 'button'),
      ).length,
      headerElements: allRaw.filter((e) => e.region === 'header').length,
      totalInteractive: allRaw.length,
    };

    return { elements, contentRegion };
  } catch (err) {
    // Never throw — return empty on failure
    const msg = err instanceof Error ? err.message : String(err);
    if (typeof process !== 'undefined' && process.env?.['NODE_ENV'] !== 'test') {
      // eslint-disable-next-line no-console
      console.error(`[element-collector] evaluate failed: ${msg}`);
    }
    return {
      elements: [],
      contentRegion: {
        hasMainLandmark: false,
        mainContentLinks: 0,
        mainContentButtons: 0,
        headerElements: 0,
        totalInteractive: 0,
      },
    };
  }
}
