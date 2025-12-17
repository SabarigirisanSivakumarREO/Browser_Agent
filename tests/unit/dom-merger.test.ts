/**
 * DOM Merger Unit Tests - Phase 19b
 *
 * Tests for DOMMerger class that combines DOM snapshots from different scroll positions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DOMMerger } from '../../src/browser/dom/dom-merger.js';
import type { DOMTree, DOMNode } from '../../src/models/index.js';

describe('DOMMerger', () => {
  let merger: DOMMerger;

  beforeEach(() => {
    merger = new DOMMerger();
  });

  // Helper to create a minimal DOMNode
  function createNode(options: Partial<DOMNode> & { xpath: string }): DOMNode {
    return {
      tagName: options.tagName ?? 'div',
      xpath: options.xpath,
      index: options.index,
      text: options.text ?? '',
      isInteractive: options.isInteractive ?? false,
      isVisible: options.isVisible ?? true,
      croType: options.croType ?? null,
      boundingBox: options.boundingBox,
      attributes: options.attributes,
      children: options.children ?? [],
    };
  }

  // Helper to create a minimal DOMTree
  function createTree(
    root: DOMNode,
    counts?: { interactive?: number; cro?: number; total?: number }
  ): DOMTree {
    return {
      root,
      interactiveCount: counts?.interactive ?? 0,
      croElementCount: counts?.cro ?? 0,
      totalNodeCount: counts?.total ?? 1,
      extractedAt: Date.now(),
    };
  }

  describe('merge()', () => {
    it('should throw error for empty snapshots array', () => {
      expect(() => merger.merge([])).toThrow('No snapshots to merge');
    });

    it('should return single snapshot unchanged', () => {
      const root = createNode({
        xpath: '/html/body',
        tagName: 'body',
        children: [
          createNode({
            xpath: '/html/body/button[1]',
            tagName: 'button',
            index: 0,
            isInteractive: true,
            croType: 'cta',
            boundingBox: { x: 0, y: 100, width: 100, height: 40 },
          }),
        ],
      });
      const tree = createTree(root, { interactive: 1, cro: 1, total: 2 });

      const result = merger.merge([tree]);

      expect(result).toBe(tree);
    });

    it('should merge two DOM snapshots correctly', () => {
      // First snapshot: element at y=100
      const snapshot1 = createTree(
        createNode({
          xpath: '/html/body',
          tagName: 'body',
          children: [
            createNode({
              xpath: '/html/body/button[1]',
              tagName: 'button',
              index: 0,
              text: 'Buy Now',
              isInteractive: true,
              croType: 'cta',
              boundingBox: { x: 10, y: 100, width: 100, height: 40 },
            }),
          ],
        }),
        { interactive: 1, cro: 1, total: 2 }
      );

      // Second snapshot: element at y=800 (different scroll position)
      const snapshot2 = createTree(
        createNode({
          xpath: '/html/body',
          tagName: 'body',
          children: [
            createNode({
              xpath: '/html/body/form[1]',
              tagName: 'form',
              index: 0,
              text: '',
              isInteractive: true,
              croType: 'form',
              boundingBox: { x: 10, y: 800, width: 300, height: 200 },
            }),
          ],
        }),
        { interactive: 1, cro: 1, total: 2 }
      );

      const result = merger.merge([snapshot1, snapshot2]);

      // Should have both elements
      expect(result.root.children).toHaveLength(2);
      expect(result.root.children[0].xpath).toBe('/html/body/button[1]');
      expect(result.root.children[1].xpath).toBe('/html/body/form[1]');
    });

    it('should deduplicate elements by xpath', () => {
      // Same element appears in both snapshots (overlap area)
      const sharedButton = {
        xpath: '/html/body/button[1]',
        tagName: 'button',
        text: 'Buy Now',
        isInteractive: true,
        croType: 'cta' as const,
        boundingBox: { x: 10, y: 500, width: 100, height: 40 },
      };

      const snapshot1 = createTree(
        createNode({
          xpath: '/html/body',
          tagName: 'body',
          children: [createNode({ ...sharedButton, index: 0 })],
        }),
        { interactive: 1, cro: 1, total: 2 }
      );

      const snapshot2 = createTree(
        createNode({
          xpath: '/html/body',
          tagName: 'body',
          children: [
            createNode({ ...sharedButton, index: 0 }),
            createNode({
              xpath: '/html/body/div[1]',
              tagName: 'div',
              index: 1,
              isVisible: true,
              isInteractive: true,
              boundingBox: { x: 10, y: 700, width: 100, height: 40 },
            }),
          ],
        }),
        { interactive: 2, cro: 1, total: 3 }
      );

      const result = merger.merge([snapshot1, snapshot2]);

      // Should have 2 children (deduplicated button + new div)
      expect(result.root.children).toHaveLength(2);
      const xpaths = result.root.children.map((c) => c.xpath);
      expect(xpaths).toContain('/html/body/button[1]');
      expect(xpaths).toContain('/html/body/div[1]');
    });

    it('should preserve document order based on Y position', () => {
      // First snapshot has element at y=500
      const snapshot1 = createTree(
        createNode({
          xpath: '/html/body',
          tagName: 'body',
          children: [
            createNode({
              xpath: '/html/body/div[2]',
              tagName: 'div',
              index: 0,
              isVisible: true,
              isInteractive: true,
              boundingBox: { x: 10, y: 500, width: 100, height: 40 },
            }),
          ],
        })
      );

      // Second snapshot has elements at y=100 and y=900
      const snapshot2 = createTree(
        createNode({
          xpath: '/html/body',
          tagName: 'body',
          children: [
            createNode({
              xpath: '/html/body/div[1]',
              tagName: 'div',
              index: 0,
              isVisible: true,
              isInteractive: true,
              boundingBox: { x: 10, y: 100, width: 100, height: 40 },
            }),
            createNode({
              xpath: '/html/body/div[3]',
              tagName: 'div',
              index: 1,
              isVisible: true,
              isInteractive: true,
              boundingBox: { x: 10, y: 900, width: 100, height: 40 },
            }),
          ],
        })
      );

      const result = merger.merge([snapshot1, snapshot2]);

      // Should be ordered by Y position: div[1] (y=100), div[2] (y=500), div[3] (y=900)
      expect(result.root.children).toHaveLength(3);
      expect(result.root.children[0].xpath).toBe('/html/body/div[1]');
      expect(result.root.children[1].xpath).toBe('/html/body/div[2]');
      expect(result.root.children[2].xpath).toBe('/html/body/div[3]');
    });

    it('should recalculate indices after merge', () => {
      const snapshot1 = createTree(
        createNode({
          xpath: '/html/body',
          tagName: 'body',
          children: [
            createNode({
              xpath: '/html/body/button[1]',
              tagName: 'button',
              index: 0,
              isInteractive: true,
              isVisible: true,
              croType: 'cta',
              boundingBox: { x: 10, y: 100, width: 100, height: 40 },
            }),
          ],
        })
      );

      const snapshot2 = createTree(
        createNode({
          xpath: '/html/body',
          tagName: 'body',
          children: [
            createNode({
              xpath: '/html/body/button[2]',
              tagName: 'button',
              index: 0, // Same index in original snapshot
              isInteractive: true,
              isVisible: true,
              croType: 'cta',
              boundingBox: { x: 10, y: 800, width: 100, height: 40 },
            }),
          ],
        })
      );

      const result = merger.merge([snapshot1, snapshot2]);

      // Indices should be sequential after merge
      expect(result.root.children[0].index).toBe(0);
      expect(result.root.children[1].index).toBe(1);
    });

    it('should update count totals accurately', () => {
      const snapshot1 = createTree(
        createNode({
          xpath: '/html/body',
          tagName: 'body',
          children: [
            createNode({
              xpath: '/html/body/button[1]',
              tagName: 'button',
              index: 0,
              isInteractive: true,
              isVisible: true,
              croType: 'cta',
              boundingBox: { x: 10, y: 100, width: 100, height: 40 },
            }),
          ],
        }),
        { interactive: 1, cro: 1, total: 2 }
      );

      const snapshot2 = createTree(
        createNode({
          xpath: '/html/body',
          tagName: 'body',
          children: [
            createNode({
              xpath: '/html/body/form[1]',
              tagName: 'form',
              index: 0,
              isInteractive: true,
              isVisible: true,
              croType: 'form',
              boundingBox: { x: 10, y: 800, width: 300, height: 200 },
              children: [
                createNode({
                  xpath: '/html/body/form[1]/input[1]',
                  tagName: 'input',
                  index: 1,
                  isInteractive: true,
                  isVisible: true,
                  boundingBox: { x: 20, y: 850, width: 200, height: 30 },
                }),
              ],
            }),
          ],
        }),
        { interactive: 2, cro: 1, total: 3 }
      );

      const result = merger.merge([snapshot1, snapshot2]);

      // body + button + form + input = 4 nodes
      expect(result.totalNodeCount).toBe(4);
      // button (cta) + form (form) = 2 CRO elements
      expect(result.croElementCount).toBe(2);
      // button + form + input = 3 interactive
      expect(result.interactiveCount).toBe(3);
    });
  });
});
