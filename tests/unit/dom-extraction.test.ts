/**
 * Unit tests for DOM extraction module (Phase 14).
 */

import { describe, it, expect } from 'vitest';
import {
  CRO_SELECTORS,
  INTERACTIVE_TAGS,
  INTERACTIVE_ROLES,
  SKIP_TAGS,
  MAX_TEXT_LENGTH,
  DOMSerializer,
  type CROSelectorConfig,
  type RawDOMNode,
  type RawDOMTree,
  type SerializationResult,
} from '../../src/browser/dom/index.js';
import type { DOMTree, DOMNode } from '../../src/models/index.js';

// =============================================================================
// CRO_SELECTORS Tests
// =============================================================================

describe('CRO_SELECTORS', () => {
  it('should have all 10 CRO types defined (including Phase 25b)', () => {
    const types = Object.keys(CRO_SELECTORS);
    // Original 5 categories
    expect(types).toContain('cta');
    expect(types).toContain('form');
    expect(types).toContain('trust');
    expect(types).toContain('value_prop');
    expect(types).toContain('navigation');
    // Phase 25b: 5 new categories
    expect(types).toContain('price');
    expect(types).toContain('variant');
    expect(types).toContain('stock');
    expect(types).toContain('shipping');
    expect(types).toContain('gallery');
    expect(types).toHaveLength(10);
  });

  it('should have valid weight values (0-1) for all patterns', () => {
    for (const [type, patterns] of Object.entries(CRO_SELECTORS)) {
      for (const pattern of patterns) {
        expect(pattern.weight).toBeGreaterThanOrEqual(0);
        expect(pattern.weight).toBeLessThanOrEqual(1);
      }
    }
  });

  it('should have non-empty patterns for all selectors', () => {
    for (const [type, patterns] of Object.entries(CRO_SELECTORS)) {
      expect(patterns.length).toBeGreaterThan(0);
      for (const pattern of patterns) {
        expect(pattern.pattern).toBeTruthy();
        expect(pattern.type).toBeTruthy();
      }
    }
  });

  it('should have valid pattern types', () => {
    const validTypes = ['tag', 'class', 'id', 'attr', 'role', 'text'];
    for (const [type, patterns] of Object.entries(CRO_SELECTORS)) {
      for (const pattern of patterns) {
        expect(validTypes).toContain(pattern.type);
      }
    }
  });

  it('CTA selectors should include button patterns', () => {
    const ctaPatterns = CRO_SELECTORS.cta;
    const hasButtonTag = ctaPatterns.some(p => p.type === 'tag' && p.pattern === 'button');
    const hasButtonRole = ctaPatterns.some(p => p.type === 'role' && p.pattern === 'button');
    expect(hasButtonTag).toBe(true);
    expect(hasButtonRole).toBe(true);
  });

  it('form selectors should include input elements', () => {
    const formPatterns = CRO_SELECTORS.form;
    const hasInput = formPatterns.some(p => p.type === 'tag' && p.pattern === 'input');
    const hasForm = formPatterns.some(p => p.type === 'tag' && p.pattern === 'form');
    expect(hasInput).toBe(true);
    expect(hasForm).toBe(true);
  });

  it('navigation selectors should include nav element', () => {
    const navPatterns = CRO_SELECTORS.navigation;
    const hasNav = navPatterns.some(p => p.type === 'tag' && p.pattern === 'nav');
    expect(hasNav).toBe(true);
  });
});

// =============================================================================
// INTERACTIVE_TAGS Tests
// =============================================================================

describe('INTERACTIVE_TAGS', () => {
  it('should include button element', () => {
    expect(INTERACTIVE_TAGS).toContain('button');
  });

  it('should include anchor element', () => {
    expect(INTERACTIVE_TAGS).toContain('a');
  });

  it('should include form elements', () => {
    expect(INTERACTIVE_TAGS).toContain('input');
    expect(INTERACTIVE_TAGS).toContain('select');
    expect(INTERACTIVE_TAGS).toContain('textarea');
  });

  it('should include details/summary', () => {
    expect(INTERACTIVE_TAGS).toContain('details');
    expect(INTERACTIVE_TAGS).toContain('summary');
  });
});

// =============================================================================
// INTERACTIVE_ROLES Tests
// =============================================================================

describe('INTERACTIVE_ROLES', () => {
  it('should include button role', () => {
    expect(INTERACTIVE_ROLES).toContain('button');
  });

  it('should include link role', () => {
    expect(INTERACTIVE_ROLES).toContain('link');
  });

  it('should include form input roles', () => {
    expect(INTERACTIVE_ROLES).toContain('checkbox');
    expect(INTERACTIVE_ROLES).toContain('radio');
    expect(INTERACTIVE_ROLES).toContain('textbox');
    expect(INTERACTIVE_ROLES).toContain('combobox');
  });

  it('should include menu item role', () => {
    expect(INTERACTIVE_ROLES).toContain('menuitem');
  });

  it('should include slider role', () => {
    expect(INTERACTIVE_ROLES).toContain('slider');
  });
});

// =============================================================================
// SKIP_TAGS Tests
// =============================================================================

describe('SKIP_TAGS', () => {
  it('should include script and style tags', () => {
    expect(SKIP_TAGS).toContain('script');
    expect(SKIP_TAGS).toContain('style');
  });

  it('should include meta elements', () => {
    expect(SKIP_TAGS).toContain('meta');
    expect(SKIP_TAGS).toContain('link');
    expect(SKIP_TAGS).toContain('noscript');
  });

  it('should include SVG elements', () => {
    expect(SKIP_TAGS).toContain('svg');
    expect(SKIP_TAGS).toContain('path');
    expect(SKIP_TAGS).toContain('defs');
  });

  it('should include whitespace elements', () => {
    expect(SKIP_TAGS).toContain('br');
    expect(SKIP_TAGS).toContain('hr');
    expect(SKIP_TAGS).toContain('wbr');
  });
});

// =============================================================================
// MAX_TEXT_LENGTH Tests
// =============================================================================

describe('MAX_TEXT_LENGTH', () => {
  it('should be 100 characters (CR-015)', () => {
    expect(MAX_TEXT_LENGTH).toBe(100);
  });
});

// =============================================================================
// DOMSerializer Tests
// =============================================================================

describe('DOMSerializer', () => {
  // Helper to create a minimal DOM tree
  function createMockDOMTree(nodes: Partial<DOMNode>[]): DOMTree {
    const children: DOMNode[] = nodes.map((n, i) => ({
      tagName: n.tagName || 'div',
      xpath: n.xpath || `/html/body/div[${i + 1}]`,
      text: n.text || '',
      isInteractive: n.isInteractive || false,
      isVisible: n.isVisible !== undefined ? n.isVisible : true,
      croType: n.croType || null,
      index: n.index,
      attributes: n.attributes,
      children: n.children || [],
    }));

    return {
      root: {
        tagName: 'body',
        xpath: '/html/body',
        text: '',
        isInteractive: false,
        isVisible: true,
        croType: null,
        children,
      },
      interactiveCount: nodes.filter(n => n.isInteractive).length,
      croElementCount: nodes.filter(n => n.croType).length,
      totalNodeCount: nodes.length + 1,
      extractedAt: Date.now(),
    };
  }

  describe('serialize()', () => {
    it('should format indexed elements correctly', () => {
      const tree = createMockDOMTree([
        { tagName: 'button', index: 0, text: 'Click me', isInteractive: true },
      ]);

      const serializer = new DOMSerializer();
      const result = serializer.serialize(tree);

      expect(result.text).toContain('[0]');
      expect(result.text).toContain('<button');
      expect(result.text).toContain('Click me');
      expect(result.elementCount).toBe(1);
    });

    it('should include CRO type annotations with confidence (Phase 25g)', () => {
      const tree = createMockDOMTree([
        { tagName: 'button', index: 0, text: 'Buy Now', croType: 'cta' },
      ]);

      const serializer = new DOMSerializer();
      const result = serializer.serialize(tree);

      // Phase 25g format: [cta:0.00] (confidence included)
      expect(result.text).toContain('[cta:');
    });

    it('should truncate at token limit', () => {
      // Create many elements to exceed token limit
      const nodes: Partial<DOMNode>[] = [];
      for (let i = 0; i < 1000; i++) {
        nodes.push({
          tagName: 'div',
          index: i,
          text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
          isInteractive: true,
        });
      }
      const tree = createMockDOMTree(nodes);

      const serializer = new DOMSerializer({ maxTokens: 500 });
      const result = serializer.serialize(tree);

      expect(result.truncated).toBe(true);
      // The serializer stops after exceeding the limit, so the final count may be slightly over
      // (the last element that triggers truncation will push it over)
      expect(result.estimatedTokens).toBeLessThan(600); // Within reasonable bounds
      expect(result.elementCount).toBeLessThan(1000); // Truncated before all elements
      expect(result.warning).toBeDefined();
    });

    it('should estimate tokens correctly (chars/4)', () => {
      const serializer = new DOMSerializer();

      expect(serializer.estimateTokens('')).toBe(0);
      expect(serializer.estimateTokens('test')).toBe(1);
      expect(serializer.estimateTokens('12345678')).toBe(2);
      expect(serializer.estimateTokens('123456789012')).toBe(3);
    });

    it('should skip hidden elements by default', () => {
      const tree = createMockDOMTree([
        { tagName: 'button', index: 0, text: 'Visible', isVisible: true },
        { tagName: 'button', index: 1, text: 'Hidden', isVisible: false },
      ]);

      const serializer = new DOMSerializer();
      const result = serializer.serialize(tree);

      expect(result.text).toContain('Visible');
      expect(result.text).not.toContain('Hidden');
      expect(result.elementCount).toBe(1);
    });

    it('should include hidden elements when configured', () => {
      const tree = createMockDOMTree([
        { tagName: 'button', index: 0, text: 'Visible', isVisible: true },
        { tagName: 'button', index: 1, text: 'Hidden', isVisible: false },
      ]);

      const serializer = new DOMSerializer({ includeHidden: true });
      const result = serializer.serialize(tree);

      expect(result.text).toContain('Visible');
      expect(result.text).toContain('Hidden');
      expect(result.elementCount).toBe(2);
    });

    it('should include attributes in output', () => {
      const tree = createMockDOMTree([
        {
          tagName: 'a',
          index: 0,
          text: 'Learn More',
          isInteractive: true,
          attributes: {
            class: 'btn-primary',
            id: 'cta-button',
            href: '/signup',
          },
        },
      ]);

      const serializer = new DOMSerializer();
      const result = serializer.serialize(tree);

      expect(result.text).toContain('class="btn-primary"');
      expect(result.text).toContain('id="cta-button"');
      expect(result.text).toContain('href="/signup"');
    });

    it('should apply indentation based on depth', () => {
      const childNode: DOMNode = {
        tagName: 'span',
        xpath: '/html/body/div/span',
        text: 'Nested',
        index: 1,
        isInteractive: true,
        isVisible: true,
        croType: null,
        children: [],
      };

      const tree: DOMTree = {
        root: {
          tagName: 'body',
          xpath: '/html/body',
          text: '',
          isInteractive: false,
          isVisible: true,
          croType: null,
          children: [{
            tagName: 'div',
            xpath: '/html/body/div',
            text: 'Parent',
            index: 0,
            isInteractive: true,
            isVisible: true,
            croType: null,
            children: [childNode],
          }],
        },
        interactiveCount: 2,
        croElementCount: 0,
        totalNodeCount: 3,
        extractedAt: Date.now(),
      };

      const serializer = new DOMSerializer({ indentSize: 2 });
      const result = serializer.serialize(tree);
      const lines = result.text.split('\n');

      // First indexed element should have minimal indent
      expect(lines[0]).toMatch(/^\s{0,2}\[0\]/);
      // Nested element should have more indent
      expect(lines[1]).toMatch(/^\s{2,4}\[1\]/);
    });
  });

  describe('serializeWithDiff()', () => {
    it('should mark new elements with asterisk', () => {
      const previous = createMockDOMTree([
        { tagName: 'button', index: 0, xpath: '/html/body/button[1]', text: 'Old' },
      ]);

      const current = createMockDOMTree([
        { tagName: 'button', index: 0, xpath: '/html/body/button[1]', text: 'Old' },
        { tagName: 'button', index: 1, xpath: '/html/body/button[2]', text: 'New' },
      ]);

      const serializer = new DOMSerializer();
      const result = serializer.serializeWithDiff(current, previous);

      const lines = result.text.split('\n');
      // First line should not have asterisk (exists in previous)
      expect(lines[0]).not.toMatch(/^\*/);
      // Second line should have asterisk (new element)
      expect(lines[1]).toMatch(/^\*/);
    });

    it('should not mark existing elements', () => {
      const tree = createMockDOMTree([
        { tagName: 'button', index: 0, xpath: '/html/body/button[1]', text: 'Same' },
      ]);

      const serializer = new DOMSerializer();
      const result = serializer.serializeWithDiff(tree, tree);

      expect(result.text).not.toContain('*');
    });
  });
});

// =============================================================================
// RawDOMNode/RawDOMTree Type Tests
// =============================================================================

describe('RawDOMNode interface', () => {
  it('should accept valid raw node structure', () => {
    const node: RawDOMNode = {
      tagName: 'button',
      xpath: '/html/body/button',
      text: 'Click',
      isInteractive: true,
      isVisible: true,
      croType: 'cta',
      croConfidence: 0.9,
      index: 0,
      boundingBox: { x: 10, y: 20, width: 100, height: 40 },
      attributes: { class: 'btn' },
      children: [],
    };

    expect(node.tagName).toBe('button');
    expect(node.croType).toBe('cta');
    expect(node.croConfidence).toBe(0.9);
  });

  it('should accept node without optional fields', () => {
    const node: RawDOMNode = {
      tagName: 'div',
      xpath: '/html/body/div',
      text: '',
      isInteractive: false,
      isVisible: true,
      croType: null,
      children: [],
    };

    expect(node.index).toBeUndefined();
    expect(node.boundingBox).toBeUndefined();
    expect(node.attributes).toBeUndefined();
  });
});

describe('RawDOMTree interface', () => {
  it('should accept valid raw tree structure', () => {
    const tree: RawDOMTree = {
      root: {
        tagName: 'body',
        xpath: '/html/body',
        text: '',
        isInteractive: false,
        isVisible: true,
        croType: null,
        children: [],
      },
      interactiveCount: 5,
      croElementCount: 3,
      totalNodeCount: 100,
      indexedCount: 8,
      extractedAt: Date.now(),
      viewportWidth: 1920,
      viewportHeight: 1080,
      errors: [],
    };

    expect(tree.interactiveCount).toBe(5);
    expect(tree.croElementCount).toBe(3);
    expect(tree.viewportWidth).toBe(1920);
    expect(tree.errors).toHaveLength(0);
  });

  it('should accept tree with errors', () => {
    const tree: RawDOMTree = {
      root: {
        tagName: 'body',
        xpath: '/html/body',
        text: '',
        isInteractive: false,
        isVisible: true,
        croType: null,
        children: [],
      },
      interactiveCount: 0,
      croElementCount: 0,
      totalNodeCount: 1,
      indexedCount: 0,
      extractedAt: Date.now(),
      viewportWidth: 800,
      viewportHeight: 600,
      errors: ['Visibility check error: timeout'],
    };

    expect(tree.errors).toHaveLength(1);
    expect(tree.errors[0]).toContain('Visibility check error');
  });
});
