/**
 * Integration tests for DOM extraction module (Phase 14).
 *
 * Tests real browser extraction with various page types.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserManager, PageLoader } from '../../src/browser/index.js';
import { DOMExtractor, DOMSerializer } from '../../src/browser/dom/index.js';
import { DEFAULT_BROWSER_CONFIG } from '../../src/types/index.js';
import type { DOMTree, DOMNode } from '../../src/models/index.js';

describe('DOM Extraction Integration', () => {
  let browserManager: BrowserManager;
  let extractor: DOMExtractor;
  let serializer: DOMSerializer;

  beforeAll(async () => {
    browserManager = new BrowserManager({
      ...DEFAULT_BROWSER_CONFIG,
      headless: true,
    });
    await browserManager.launch();
    extractor = new DOMExtractor();
    serializer = new DOMSerializer();
  });

  afterAll(async () => {
    await browserManager.close();
  });

  // Helper to count indexed elements in a tree
  function countIndexedElements(node: DOMNode): number {
    let count = node.index !== undefined ? 1 : 0;
    for (const child of node.children) {
      count += countIndexedElements(child);
    }
    return count;
  }

  // Helper to find node by index
  function findNodeByIndex(node: DOMNode, index: number): DOMNode | null {
    if (node.index === index) return node;
    for (const child of node.children) {
      const found = findNodeByIndex(child, index);
      if (found) return found;
    }
    return null;
  }

  describe('DOMExtractor', () => {
    it('should extract DOM from example.com', async () => {
      const page = browserManager.getPage();
      const loader = new PageLoader(page, { timeout: 30000 });

      await loader.load('https://example.com');
      const tree = await extractor.extract(page);

      expect(tree).toBeDefined();
      expect(tree.root).toBeDefined();
      expect(tree.root.tagName).toBe('body');
      expect(tree.extractedAt).toBeGreaterThan(0);
      expect(tree.totalNodeCount).toBeGreaterThan(0);
    });

    it('should capture visible interactive elements', async () => {
      const page = browserManager.getPage();

      // Create a page with interactive elements
      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <body>
            <button id="btn1">Click Me</button>
            <a href="/link" id="link1">Go Here</a>
            <input type="text" id="input1" placeholder="Enter text">
            <select id="select1"><option>Option 1</option></select>
            <div>Non-interactive content</div>
          </body>
        </html>
      `);

      const tree = await extractor.extract(page);

      // Should have indexed the interactive elements
      expect(tree.interactiveCount).toBeGreaterThanOrEqual(4);

      // Check that indexed elements exist
      const indexedCount = countIndexedElements(tree.root);
      expect(indexedCount).toBeGreaterThanOrEqual(4);
    });

    it('should correctly classify CTA buttons', async () => {
      const page = browserManager.getPage();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <body>
            <button class="btn-primary cta">Buy Now</button>
            <button data-cta="true">Sign Up</button>
            <a href="/start" class="button cta">Get Started</a>
          </body>
        </html>
      `);

      const tree = await extractor.extract(page);

      // Find CTA elements
      let ctaCount = 0;
      const checkCTA = (node: DOMNode) => {
        if (node.croType === 'cta') ctaCount++;
        node.children.forEach(checkCTA);
      };
      checkCTA(tree.root);

      expect(ctaCount).toBeGreaterThanOrEqual(1);
      expect(tree.croElementCount).toBeGreaterThanOrEqual(1);
    });

    it('should correctly classify form inputs', async () => {
      const page = browserManager.getPage();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <body>
            <form id="signup">
              <input type="email" placeholder="Email">
              <input type="password" placeholder="Password">
              <textarea placeholder="Message"></textarea>
              <select name="country"><option>USA</option></select>
            </form>
          </body>
        </html>
      `);

      const tree = await extractor.extract(page);

      // Find form elements
      let formCount = 0;
      const checkForm = (node: DOMNode) => {
        if (node.croType === 'form') formCount++;
        node.children.forEach(checkForm);
      };
      checkForm(tree.root);

      expect(formCount).toBeGreaterThanOrEqual(1);
    });

    it('should handle hidden elements correctly', async () => {
      const page = browserManager.getPage();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <body>
            <button id="visible">Visible Button</button>
            <button id="hidden1" style="display: none">Hidden by display</button>
            <button id="hidden2" style="visibility: hidden">Hidden by visibility</button>
            <button id="hidden3" style="opacity: 0">Hidden by opacity</button>
            <button id="hidden4" aria-hidden="true">Hidden by aria</button>
          </body>
        </html>
      `);

      const tree = await extractor.extract(page);

      // Count visible indexed elements (only the visible button should be indexed)
      const indexedCount = countIndexedElements(tree.root);
      expect(indexedCount).toBe(1);
    });

    it('should skip elements outside viewport', async () => {
      const page = browserManager.getPage();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <body>
            <button id="visible" style="position: absolute; top: 50px;">Visible</button>
            <button id="offscreen" style="position: absolute; left: -9999px;">Off Screen</button>
          </body>
        </html>
      `);

      const tree = await extractor.extract(page);

      // Only the visible button should be indexed
      const indexedCount = countIndexedElements(tree.root);
      expect(indexedCount).toBe(1);
    });

    it('should complete within 10 seconds', async () => {
      const page = browserManager.getPage();
      const loader = new PageLoader(page, { timeout: 30000 });

      await loader.load('https://example.com');

      const startTime = Date.now();
      await extractor.extract(page);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10000);
    });

    it('should extract bounding boxes for indexed elements', async () => {
      const page = browserManager.getPage();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <body>
            <button style="width: 100px; height: 40px;">Click</button>
          </body>
        </html>
      `);

      const tree = await extractor.extract(page);
      const buttonNode = findNodeByIndex(tree.root, 0);

      expect(buttonNode).toBeDefined();
      expect(buttonNode?.boundingBox).toBeDefined();
      expect(buttonNode?.boundingBox?.width).toBeGreaterThan(0);
      expect(buttonNode?.boundingBox?.height).toBeGreaterThan(0);
    });

    it('should extract XPaths for elements', async () => {
      const page = browserManager.getPage();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <body>
            <div>
              <button>First</button>
              <button>Second</button>
            </div>
          </body>
        </html>
      `);

      const tree = await extractor.extract(page);

      // All nodes should have XPaths
      const checkXPath = (node: DOMNode) => {
        expect(node.xpath).toBeTruthy();
        expect(node.xpath.startsWith('/')).toBe(true);
        node.children.forEach(checkXPath);
      };
      checkXPath(tree.root);
    });

    it('should handle pages with navigation elements', async () => {
      const page = browserManager.getPage();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <body>
            <nav role="navigation">
              <a href="/home">Home</a>
              <a href="/about">About</a>
              <a href="/contact">Contact</a>
            </nav>
            <main>
              <h1>Content</h1>
            </main>
          </body>
        </html>
      `);

      const tree = await extractor.extract(page);

      // Should classify nav element
      let hasNavigation = false;
      const checkNav = (node: DOMNode) => {
        if (node.croType === 'navigation') hasNavigation = true;
        node.children.forEach(checkNav);
      };
      checkNav(tree.root);

      expect(hasNavigation).toBe(true);
    });

    it('should handle deeply nested elements', async () => {
      const page = browserManager.getPage();

      // Create deeply nested structure
      let html = '<div>';
      for (let i = 0; i < 20; i++) {
        html += '<div>';
      }
      html += '<button>Deeply Nested</button>';
      for (let i = 0; i < 20; i++) {
        html += '</div>';
      }
      html += '</div>';

      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <body>${html}</body>
        </html>
      `);

      const tree = await extractor.extract(page);

      // Should still find the button
      const buttonNode = findNodeByIndex(tree.root, 0);
      expect(buttonNode).toBeDefined();
      expect(buttonNode?.tagName).toBe('button');
    });
  });

  describe('DOMSerializer Integration', () => {
    it('should produce parseable output', async () => {
      const page = browserManager.getPage();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <body>
            <button class="cta">Buy Now</button>
            <input type="email" placeholder="Email">
            <a href="/learn-more">Learn More</a>
          </body>
        </html>
      `);

      const tree = await extractor.extract(page);
      const result = serializer.serialize(tree);

      // Output should contain index markers
      expect(result.text).toMatch(/\[\d+\]/);

      // Output should contain tag names
      expect(result.text).toMatch(/<(button|input|a)/);

      // Should have elements
      expect(result.elementCount).toBeGreaterThan(0);
    });

    it('should stay within token budget', async () => {
      const page = browserManager.getPage();
      const loader = new PageLoader(page, { timeout: 30000 });

      await loader.load('https://example.com');
      const tree = await extractor.extract(page);

      const customSerializer = new DOMSerializer({ maxTokens: 2000 });
      const result = customSerializer.serialize(tree);

      // Should either be within budget or be truncated
      if (result.truncated) {
        expect(result.warning).toBeDefined();
      } else {
        expect(result.estimatedTokens).toBeLessThan(2000);
      }
    });

    it('should mark new elements after content change', async () => {
      const page = browserManager.getPage();

      // Initial content
      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <body>
            <button id="original">Original</button>
          </body>
        </html>
      `);

      const tree1 = await extractor.extract(page);

      // Add new content
      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <body>
            <button id="original">Original</button>
            <button id="new">New Button</button>
          </body>
        </html>
      `);

      const tree2 = await extractor.extract(page);
      const diffResult = serializer.serializeWithDiff(tree2, tree1);

      // The new button should be marked
      expect(diffResult.text).toContain('*');
    });
  });
});
