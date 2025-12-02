/**
 * Heading Extractor
 * Extracts h1-h6 heading elements from pages per FR-004.
 */

import type { Page } from 'playwright';
import type { Heading, ExtractionResult } from '../types/index.js';
import { isHeadingLevel } from '../types/index.js';
import { createLogger } from '../utils/index.js';

const logger = createLogger('HeadingExtractor');

/**
 * Extracts heading elements from web pages.
 * Uses Playwright's built-in selectors per constitution III.
 */
export class HeadingExtractor {
  /**
   * Extracts all heading elements (h1-h6) from a page.
   * @param page - Playwright page instance
   * @returns ExtractionResult with headings and statistics
   */
  async extract(page: Page): Promise<ExtractionResult> {
    logger.info('Extracting headings from page');

    try {
      // Use Playwright's locator to find all heading elements
      // Select all h1-h6 elements in document order
      const headingLocator = page.locator('h1, h2, h3, h4, h5, h6');

      // Get all heading elements
      const headingElements = await headingLocator.all();

      const headings: Heading[] = [];
      const countByLevel: Record<number, number> = {};

      // Process each heading element
      for (let index = 0; index < headingElements.length; index++) {
        const element = headingElements[index];

        if (!element) continue;

        // Get the tag name to determine heading level
        const tagName = await element.evaluate((el) => el.tagName.toLowerCase());
        const levelStr = tagName.replace('h', '');
        const level = parseInt(levelStr, 10);

        // Validate heading level
        if (!isHeadingLevel(level)) {
          logger.warn('Invalid heading level detected', { tagName, index });
          continue;
        }

        // Get text content, decoded and trimmed
        const text = await element.evaluate((el) => {
          // Get text content and normalize whitespace
          const rawText = el.textContent || '';
          return rawText.replace(/\s+/g, ' ').trim();
        });

        // Skip empty headings
        if (text.length === 0) {
          logger.debug('Skipping empty heading', { level, index });
          continue;
        }

        // Add heading to results
        headings.push({
          level,
          text,
          index: headings.length,
        });

        // Update count by level
        countByLevel[level] = (countByLevel[level] || 0) + 1;
      }

      const result: ExtractionResult = {
        headings,
        totalCount: headings.length,
        countByLevel,
      };

      logger.info('Extraction complete', {
        totalCount: result.totalCount,
        countByLevel: result.countByLevel,
      });

      return result;
    } catch (err) {
      logger.errorWithStack('Failed to extract headings', err as Error);
      throw err;
    }
  }

  /**
   * Extracts headings from an HTML string (for testing).
   * @param html - HTML content to extract from
   * @param page - Playwright page instance to use for parsing
   * @returns ExtractionResult with headings and statistics
   */
  async extractFromHtml(html: string, page: Page): Promise<ExtractionResult> {
    // Set the page content to the HTML string
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Use the standard extraction method
    return this.extract(page);
  }
}
