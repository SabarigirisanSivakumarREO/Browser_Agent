/**
 * Unit tests for AX Tree Serializer — Phase 29 (T639)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  captureAccessibilityTree,
  serializeAccessibilityNode,
  truncateToTokenBudget,
  filterNode,
} from '../../src/browser/ax-tree-serializer.js';

// Mock logger to suppress output
vi.mock('../../src/utils/index.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    setVerbose: vi.fn(),
  }),
}));

function createMockPage(snapshot: unknown = null) {
  return {
    accessibility: {
      snapshot: vi.fn().mockResolvedValue(snapshot),
    },
  } as unknown as import('playwright').Page;
}

describe('AX Tree Serializer', () => {
  describe('filterNode', () => {
    it('should exclude nodes with role "none"', () => {
      expect(filterNode({ role: 'none', name: 'test' })).toBe(false);
    });

    it('should exclude nodes with role "presentation"', () => {
      expect(filterNode({ role: 'presentation', name: 'test' })).toBe(false);
    });

    it('should exclude nameless leaf nodes', () => {
      expect(filterNode({ role: 'generic', name: '' })).toBe(false);
    });

    it('should keep nodes with a name', () => {
      expect(filterNode({ role: 'button', name: 'Submit' })).toBe(true);
    });

    it('should keep landmarks without name but with children', () => {
      expect(filterNode({
        role: 'navigation',
        name: '',
        children: [{ role: 'link', name: 'Home' }],
      })).toBe(true);
    });
  });

  describe('serializeAccessibilityNode', () => {
    it('should serialize basic node with role and name', () => {
      const result = serializeAccessibilityNode({
        role: 'button',
        name: 'Add to Cart',
      });
      expect(result).toBe('- button "Add to Cart"');
    });

    it('should include non-default state properties', () => {
      const result = serializeAccessibilityNode({
        role: 'textbox',
        name: 'Email',
        required: true,
        invalid: 'true',
      });
      expect(result).toContain('[required]');
      expect(result).toContain('[invalid]');
    });

    it('should include disabled state', () => {
      const result = serializeAccessibilityNode({
        role: 'button',
        name: 'Submit',
        disabled: true,
      });
      expect(result).toContain('[disabled]');
    });

    it('should include checked state with mixed value', () => {
      const result = serializeAccessibilityNode({
        role: 'checkbox',
        name: 'Select all',
        checked: 'mixed',
      });
      expect(result).toContain('[checked=mixed]');
    });

    it('should include expanded state', () => {
      const result = serializeAccessibilityNode({
        role: 'combobox',
        name: 'Size',
        expanded: true,
      });
      expect(result).toContain('[expanded]');
    });

    it('should include selected state', () => {
      const result = serializeAccessibilityNode({
        role: 'option',
        name: 'Large',
        selected: true,
      });
      expect(result).toContain('[selected]');
    });

    it('should include pressed state', () => {
      const result = serializeAccessibilityNode({
        role: 'button',
        name: 'Bold',
        pressed: true,
      });
      expect(result).toContain('[pressed]');
    });

    it('should include heading level', () => {
      const result = serializeAccessibilityNode({
        role: 'heading',
        name: 'Product Title',
        level: 1,
      });
      expect(result).toContain('[level=1]');
    });

    it('should reflect hierarchy with indentation', () => {
      const result = serializeAccessibilityNode({
        role: 'navigation',
        name: 'Main',
        children: [
          { role: 'link', name: 'Home' },
          { role: 'link', name: 'Products' },
        ],
      });
      const lines = result.split('\n');
      expect(lines[0]).toBe('- navigation "Main"');
      expect(lines[1]).toBe('  - link "Home"');
      expect(lines[2]).toBe('  - link "Products"');
    });

    it('should truncate long names to 50 chars', () => {
      const longName = 'A'.repeat(100);
      const result = serializeAccessibilityNode({
        role: 'link',
        name: longName,
      });
      expect(result).toContain('...');
      expect(result).not.toContain(longName);
    });
  });

  describe('truncateToTokenBudget', () => {
    it('should return text unchanged when within budget', () => {
      const text = '- button "Submit"';
      expect(truncateToTokenBudget(text, 500)).toBe(text);
    });

    it('should truncate with indicator when exceeding budget', () => {
      const lines = Array.from({ length: 100 }, (_, i) =>
        `- button "Button ${i}"`
      ).join('\n');
      // 10 tokens = 40 chars, should only keep first few lines
      const result = truncateToTokenBudget(lines, 10);
      expect(result).toContain('... (');
      expect(result).toContain('more nodes)');
      expect(result.split('\n').length).toBeLessThan(100);
    });

    it('should truncate at complete line boundaries', () => {
      const text = '- nav "Main"\n- button "Buy"\n- link "Home"';
      const result = truncateToTokenBudget(text, 5); // ~20 chars
      // Should not have partial lines
      for (const line of result.split('\n')) {
        if (!line.startsWith('...')) {
          expect(line).toMatch(/^- /);
        }
      }
    });
  });

  describe('captureAccessibilityTree', () => {
    it('should return null for empty snapshot', async () => {
      const page = createMockPage(null);
      const result = await captureAccessibilityTree(page);
      expect(result).toBeNull();
    });

    it('should return null when snapshot throws error', async () => {
      const page = createMockPage(null);
      (page.accessibility.snapshot as ReturnType<typeof vi.fn>)
        .mockRejectedValue(new Error('AX tree unavailable'));
      const result = await captureAccessibilityTree(page);
      expect(result).toBeNull();
    });

    it('should serialize a valid snapshot', async () => {
      const page = createMockPage({
        role: 'WebArea',
        name: 'Test Page',
        children: [
          {
            role: 'navigation',
            name: 'Main',
            children: [
              { role: 'link', name: 'Home' },
            ],
          },
          { role: 'button', name: 'Buy Now' },
        ],
      });

      const result = await captureAccessibilityTree(page);
      expect(result).not.toBeNull();
      expect(result).toContain('navigation "Main"');
      expect(result).toContain('link "Home"');
      expect(result).toContain('button "Buy Now"');
    });

    it('should filter out decorative nodes', async () => {
      const page = createMockPage({
        role: 'WebArea',
        name: '',
        children: [
          { role: 'none', name: 'decorative' },
          { role: 'presentation', name: 'also decorative' },
          { role: 'button', name: 'Keep Me' },
        ],
      });

      const result = await captureAccessibilityTree(page);
      expect(result).not.toBeNull();
      expect(result).toContain('button "Keep Me"');
      expect(result).not.toContain('decorative');
    });

    it('should respect token budget config', async () => {
      const children = Array.from({ length: 50 }, (_, i) => ({
        role: 'link',
        name: `Link number ${i} with a fairly long name`,
      }));
      const page = createMockPage({
        role: 'WebArea',
        name: '',
        children,
      });

      const result = await captureAccessibilityTree(page, { maxTokens: 20 });
      expect(result).not.toBeNull();
      expect(result).toContain('more nodes)');
    });
  });
});
