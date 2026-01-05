/**
 * Integration tests for browser module.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserManager, PageLoader } from '../../src/browser/index.js';
import { HeadingExtractor } from '../../src/extraction/index.js';
import { DEFAULT_BROWSER_CONFIG } from '../../src/types/index.js';

describe('Browser Integration', () => {
  let browserManager: BrowserManager;

  beforeAll(async () => {
    browserManager = new BrowserManager({
      ...DEFAULT_BROWSER_CONFIG,
      headless: true, // Use headless for tests
    });
    await browserManager.launch();
  });

  afterAll(async () => {
    await browserManager.close();
  });

  describe('PageLoader', () => {
    it('should load example.com successfully', async () => {
      const page = browserManager.getPage();
      const loader = new PageLoader(page, { timeout: 30000 });

      const result = await loader.load('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy');

      expect(result.success).toBe(true);
      expect(result.title).toBe('Example Domain');
      expect(result.loadTimeMs).toBeDefined();
      expect(result.loadTimeMs).toBeGreaterThan(0);
    });

    it('should handle invalid URL', async () => {
      const page = browserManager.getPage();
      const loader = new PageLoader(page, { timeout: 30000 });

      const result = await loader.load('not-a-valid-url');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('should handle HTTP error status', async () => {
      const page = browserManager.getPage();
      const loader = new PageLoader(page, { timeout: 30000 });

      const result = await loader.load('https://httpstat.us/404');

      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });
  });

  describe('HeadingExtractor', () => {
    it('should extract heading from example.com', async () => {
      const page = browserManager.getPage();
      const loader = new PageLoader(page, { timeout: 30000 });
      const extractor = new HeadingExtractor();

      await loader.load('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy');
      const result = await extractor.extract(page);

      expect(result.totalCount).toBeGreaterThan(0);
      expect(result.headings.length).toBeGreaterThan(0);

      const h1 = result.headings.find((h) => h.level === 1);
      expect(h1).toBeDefined();
      expect(h1?.text).toBe('Example Domain');
    });

    it('should extract headings from HTML content', async () => {
      const page = browserManager.getPage();
      const extractor = new HeadingExtractor();

      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test</title></head>
          <body>
            <h1>Main Title</h1>
            <h2>Section One</h2>
            <p>Some content</p>
            <h2>Section Two</h2>
            <h3>Subsection</h3>
          </body>
        </html>
      `;

      const result = await extractor.extractFromHtml(html, page);

      expect(result.totalCount).toBe(4);
      expect(result.countByLevel).toEqual({ 1: 1, 2: 2, 3: 1 });

      expect(result.headings[0]?.text).toBe('Main Title');
      expect(result.headings[0]?.level).toBe(1);

      expect(result.headings[1]?.text).toBe('Section One');
      expect(result.headings[1]?.level).toBe(2);

      expect(result.headings[3]?.text).toBe('Subsection');
      expect(result.headings[3]?.level).toBe(3);
    });

    it('should preserve document order', async () => {
      const page = browserManager.getPage();
      const extractor = new HeadingExtractor();

      const html = `
        <h2>Second Level First</h2>
        <h1>First Level Second</h1>
        <h3>Third Level Third</h3>
      `;

      const result = await extractor.extractFromHtml(html, page);

      expect(result.headings[0]?.text).toBe('Second Level First');
      expect(result.headings[1]?.text).toBe('First Level Second');
      expect(result.headings[2]?.text).toBe('Third Level Third');

      // Verify indices are in order
      expect(result.headings[0]?.index).toBe(0);
      expect(result.headings[1]?.index).toBe(1);
      expect(result.headings[2]?.index).toBe(2);
    });

    it('should handle page with no headings', async () => {
      const page = browserManager.getPage();
      const extractor = new HeadingExtractor();

      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <p>No headings here</p>
            <div>Just divs and paragraphs</div>
          </body>
        </html>
      `;

      const result = await extractor.extractFromHtml(html, page);

      expect(result.totalCount).toBe(0);
      expect(result.headings).toEqual([]);
      expect(result.countByLevel).toEqual({});
    });

    it('should skip empty headings', async () => {
      const page = browserManager.getPage();
      const extractor = new HeadingExtractor();

      const html = `
        <h1>Valid Heading</h1>
        <h2></h2>
        <h2>   </h2>
        <h3>Another Valid</h3>
      `;

      const result = await extractor.extractFromHtml(html, page);

      expect(result.totalCount).toBe(2);
      expect(result.headings[0]?.text).toBe('Valid Heading');
      expect(result.headings[1]?.text).toBe('Another Valid');
    });
  });
});
