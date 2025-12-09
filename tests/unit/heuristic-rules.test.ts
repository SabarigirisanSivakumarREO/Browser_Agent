/**
 * Heuristic Rules Tests - Phase 18c
 *
 * Tests for all 10 heuristic rules (H001-H010).
 * Each rule has 2 tests: positive case (violation found), negative case (passes)
 */

import { describe, it, expect } from 'vitest';
import {
  vagueCTATextRule,
  noCTAAboveFoldRule,
  formFieldOverloadRule,
  missingFieldLabelRule,
  noTrustAboveFoldRule,
  noSecurityBadgeRule,
  unclearValuePropRule,
  headlineTooLongRule,
  noBreadcrumbsRule,
  noSearchEcommerceRule,
  allRules,
  createHeuristicEngine,
} from '../../src/heuristics/index.js';
import type { PageState, DOMNode, DOMTree } from '../../src/models/index.js';

// Helper to create a mock DOMNode
function createMockNode(overrides: Partial<DOMNode> = {}): DOMNode {
  return {
    tagName: 'div',
    xpath: '/html/body/div',
    text: '',
    isInteractive: false,
    isVisible: true,
    croType: null,
    children: [],
    ...overrides,
  };
}

// Helper to create a mock DOMTree
function createMockDOMTree(root: DOMNode): DOMTree {
  return {
    root,
    interactiveCount: 0,
    croElementCount: 0,
    totalNodeCount: 1,
    extractedAt: Date.now(),
  };
}

// Helper to create a mock PageState
function createMockPageState(rootNode: DOMNode, overrides: Partial<PageState> = {}): PageState {
  return {
    url: 'https://example.com',
    title: 'Test Page',
    domTree: createMockDOMTree(rootNode),
    viewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      isMobile: false,
    },
    scrollPosition: {
      x: 0,
      y: 0,
      maxX: 0,
      maxY: 2000,
    },
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('Heuristic Rules', () => {
  describe('allRules', () => {
    it('should export all 10 rules', () => {
      expect(allRules).toHaveLength(10);
      const ruleIds = allRules.map((r) => r.id);
      expect(ruleIds).toContain('H001');
      expect(ruleIds).toContain('H002');
      expect(ruleIds).toContain('H003');
      expect(ruleIds).toContain('H004');
      expect(ruleIds).toContain('H005');
      expect(ruleIds).toContain('H006');
      expect(ruleIds).toContain('H007');
      expect(ruleIds).toContain('H008');
      expect(ruleIds).toContain('H009');
      expect(ruleIds).toContain('H010');
    });
  });

  describe('createHeuristicEngine', () => {
    it('should create engine with all 10 rules pre-loaded', () => {
      const engine = createHeuristicEngine();
      expect(engine.getRuleCount()).toBe(10);
    });
  });

  // ==========================================================================
  // H001: Vague CTA Text
  // ==========================================================================
  describe('H001: vague_cta_text', () => {
    it('should flag CTA with vague text like "Submit"', () => {
      const ctaNode = createMockNode({
        tagName: 'button',
        xpath: '/html/body/button',
        text: 'Submit',
        isInteractive: true,
        croType: 'cta',
        boundingBox: { x: 100, y: 200, width: 100, height: 40 },
      });
      const root = createMockNode({ children: [ctaNode] });
      const state = createMockPageState(root);

      const insight = vagueCTATextRule.check(state, 'other');

      expect(insight).not.toBeNull();
      expect(insight?.type).toBe('vague_cta_text');
      expect(insight?.severity).toBe('medium');
      expect(insight?.heuristicId).toBe('H001');
    });

    it('should pass CTA with specific text like "Get Free Quote"', () => {
      const ctaNode = createMockNode({
        tagName: 'button',
        xpath: '/html/body/button',
        text: 'Get Free Quote',
        isInteractive: true,
        croType: 'cta',
        boundingBox: { x: 100, y: 200, width: 100, height: 40 },
      });
      const root = createMockNode({ children: [ctaNode] });
      const state = createMockPageState(root);

      const insight = vagueCTATextRule.check(state, 'other');

      expect(insight).toBeNull();
    });
  });

  // ==========================================================================
  // H002: No CTA Above Fold
  // ==========================================================================
  describe('H002: no_cta_above_fold', () => {
    it('should flag page with no CTA above fold', () => {
      const ctaNode = createMockNode({
        tagName: 'button',
        xpath: '/html/body/button',
        text: 'Buy Now',
        isInteractive: true,
        croType: 'cta',
        boundingBox: { x: 100, y: 1500, width: 100, height: 40 }, // Below 1080 fold
      });
      const root = createMockNode({ children: [ctaNode] });
      const state = createMockPageState(root);

      const insight = noCTAAboveFoldRule.check(state, 'other');

      expect(insight).not.toBeNull();
      expect(insight?.type).toBe('no_cta_above_fold');
      expect(insight?.severity).toBe('high');
    });

    it('should pass page with CTA at top', () => {
      const ctaNode = createMockNode({
        tagName: 'button',
        xpath: '/html/body/button',
        text: 'Buy Now',
        isInteractive: true,
        croType: 'cta',
        boundingBox: { x: 100, y: 200, width: 100, height: 40 }, // Above 1080 fold
      });
      const root = createMockNode({ children: [ctaNode] });
      const state = createMockPageState(root);

      const insight = noCTAAboveFoldRule.check(state, 'other');

      expect(insight).toBeNull();
    });
  });

  // ==========================================================================
  // H003: Form Field Overload
  // ==========================================================================
  describe('H003: form_field_overload', () => {
    it('should flag form with 7 fields', () => {
      const inputs = Array.from({ length: 7 }, (_, i) =>
        createMockNode({
          tagName: 'input',
          xpath: `/html/body/form/input[${i + 1}]`,
          text: '',
          isInteractive: true,
          attributes: { type: 'text', name: `field${i}` },
        })
      );
      const formNode = createMockNode({
        tagName: 'form',
        xpath: '/html/body/form',
        children: inputs,
      });
      const root = createMockNode({ children: [formNode] });
      const state = createMockPageState(root);

      const insight = formFieldOverloadRule.check(state, 'other');

      expect(insight).not.toBeNull();
      expect(insight?.type).toBe('form_field_overload');
      expect(insight?.severity).toBe('high');
    });

    it('should pass form with 3 fields', () => {
      const inputs = Array.from({ length: 3 }, (_, i) =>
        createMockNode({
          tagName: 'input',
          xpath: `/html/body/form/input[${i + 1}]`,
          text: '',
          isInteractive: true,
          attributes: { type: 'text', name: `field${i}` },
        })
      );
      const formNode = createMockNode({
        tagName: 'form',
        xpath: '/html/body/form',
        children: inputs,
      });
      const root = createMockNode({ children: [formNode] });
      const state = createMockPageState(root);

      const insight = formFieldOverloadRule.check(state, 'other');

      expect(insight).toBeNull();
    });
  });

  // ==========================================================================
  // H004: Missing Field Label
  // ==========================================================================
  describe('H004: missing_field_label', () => {
    it('should flag input without label', () => {
      const inputNode = createMockNode({
        tagName: 'input',
        xpath: '/html/body/form/input',
        text: '',
        isInteractive: true,
        attributes: { type: 'text', name: 'email' },
      });
      const formNode = createMockNode({
        tagName: 'form',
        xpath: '/html/body/form',
        children: [inputNode],
      });
      const root = createMockNode({ children: [formNode] });
      const state = createMockPageState(root);

      const insight = missingFieldLabelRule.check(state, 'other');

      expect(insight).not.toBeNull();
      expect(insight?.type).toBe('missing_field_label');
      expect(insight?.severity).toBe('medium');
    });

    it('should pass input with placeholder', () => {
      const inputNode = createMockNode({
        tagName: 'input',
        xpath: '/html/body/form/input',
        text: '',
        isInteractive: true,
        attributes: { type: 'text', name: 'email', placeholder: 'Enter your email' },
      });
      const formNode = createMockNode({
        tagName: 'form',
        xpath: '/html/body/form',
        children: [inputNode],
      });
      const root = createMockNode({ children: [formNode] });
      const state = createMockPageState(root);

      const insight = missingFieldLabelRule.check(state, 'other');

      expect(insight).toBeNull();
    });
  });

  // ==========================================================================
  // H005: No Trust Above Fold
  // ==========================================================================
  describe('H005: no_trust_above_fold', () => {
    it('should flag page without trust above fold', () => {
      const trustNode = createMockNode({
        tagName: 'div',
        xpath: '/html/body/div/trust',
        text: 'Trusted by 1000+ companies',
        croType: 'trust',
        boundingBox: { x: 100, y: 1500, width: 200, height: 50 }, // Below fold
      });
      const root = createMockNode({ children: [trustNode] });
      const state = createMockPageState(root);

      const insight = noTrustAboveFoldRule.check(state, 'other');

      expect(insight).not.toBeNull();
      expect(insight?.type).toBe('no_trust_above_fold');
      expect(insight?.severity).toBe('medium');
    });

    it('should pass page with trust badge at top', () => {
      const trustNode = createMockNode({
        tagName: 'div',
        xpath: '/html/body/div/trust',
        text: 'Trusted by 1000+ companies',
        croType: 'trust',
        boundingBox: { x: 100, y: 200, width: 200, height: 50 }, // Above fold
      });
      const root = createMockNode({ children: [trustNode] });
      const state = createMockPageState(root);

      const insight = noTrustAboveFoldRule.check(state, 'other');

      expect(insight).toBeNull();
    });
  });

  // ==========================================================================
  // H006: No Security Badge
  // ==========================================================================
  describe('H006: no_security_badge', () => {
    it('should flag checkout page without security badge', () => {
      const root = createMockNode({
        tagName: 'body',
        xpath: '/html/body',
        children: [
          createMockNode({
            tagName: 'div',
            text: 'Complete your purchase',
          }),
        ],
      });
      const state = createMockPageState(root, {
        url: 'https://shop.example.com/checkout',
        title: 'Checkout - Shop',
      });

      const insight = noSecurityBadgeRule.check(state, 'ecommerce');

      expect(insight).not.toBeNull();
      expect(insight?.type).toBe('no_security_badge');
      expect(insight?.severity).toBe('high');
    });

    it('should pass checkout page with security badge', () => {
      const root = createMockNode({
        tagName: 'body',
        xpath: '/html/body',
        children: [
          createMockNode({
            tagName: 'img',
            text: '',
            attributes: { alt: 'SSL Secure', class: 'security-badge' },
          }),
        ],
      });
      const state = createMockPageState(root, {
        url: 'https://shop.example.com/checkout',
        title: 'Checkout - Shop',
      });

      const insight = noSecurityBadgeRule.check(state, 'ecommerce');

      expect(insight).toBeNull();
    });
  });

  // ==========================================================================
  // H007: Unclear Value Prop
  // ==========================================================================
  describe('H007: unclear_value_prop', () => {
    it('should flag page with generic "Welcome" H1', () => {
      const h1Node = createMockNode({
        tagName: 'h1',
        xpath: '/html/body/h1',
        text: 'Welcome',
      });
      const root = createMockNode({ children: [h1Node] });
      const state = createMockPageState(root);

      const insight = unclearValuePropRule.check(state, 'other');

      expect(insight).not.toBeNull();
      expect(insight?.type).toBe('unclear_value_prop');
      expect(insight?.severity).toBe('high');
    });

    it('should pass page with specific H1', () => {
      const h1Node = createMockNode({
        tagName: 'h1',
        xpath: '/html/body/h1',
        text: 'Save 50% on Car Insurance Today',
      });
      const root = createMockNode({ children: [h1Node] });
      const state = createMockPageState(root);

      const insight = unclearValuePropRule.check(state, 'other');

      expect(insight).toBeNull();
    });
  });

  // ==========================================================================
  // H008: Headline Too Long
  // ==========================================================================
  describe('H008: headline_too_long', () => {
    it('should flag H1 with 15 words', () => {
      const h1Node = createMockNode({
        tagName: 'h1',
        xpath: '/html/body/h1',
        text: 'This is a very long headline that has way too many words and should be shortened for better readability',
      });
      const root = createMockNode({ children: [h1Node] });
      const state = createMockPageState(root);

      const insight = headlineTooLongRule.check(state, 'other');

      expect(insight).not.toBeNull();
      expect(insight?.type).toBe('headline_too_long');
      expect(insight?.severity).toBe('low');
    });

    it('should pass H1 with 6 words', () => {
      const h1Node = createMockNode({
        tagName: 'h1',
        xpath: '/html/body/h1',
        text: 'Save Money on Insurance Today',
      });
      const root = createMockNode({ children: [h1Node] });
      const state = createMockPageState(root);

      const insight = headlineTooLongRule.check(state, 'other');

      expect(insight).toBeNull();
    });
  });

  // ==========================================================================
  // H009: No Breadcrumbs
  // ==========================================================================
  describe('H009: no_breadcrumbs', () => {
    it('should flag product page without breadcrumb', () => {
      const root = createMockNode({
        tagName: 'body',
        xpath: '/html/body',
        children: [
          createMockNode({
            tagName: 'div',
            text: 'Product Name',
          }),
        ],
      });
      const state = createMockPageState(root, {
        url: 'https://shop.example.com/product/123',
      });

      const insight = noBreadcrumbsRule.check(state, 'ecommerce');

      expect(insight).not.toBeNull();
      expect(insight?.type).toBe('no_breadcrumbs');
      expect(insight?.severity).toBe('low');
    });

    it('should pass product page with breadcrumb', () => {
      const root = createMockNode({
        tagName: 'body',
        xpath: '/html/body',
        children: [
          createMockNode({
            tagName: 'nav',
            attributes: { class: 'breadcrumb' },
            text: 'Home > Category > Product',
          }),
        ],
      });
      const state = createMockPageState(root, {
        url: 'https://shop.example.com/product/123',
      });

      const insight = noBreadcrumbsRule.check(state, 'ecommerce');

      expect(insight).toBeNull();
    });
  });

  // ==========================================================================
  // H010: No Search Ecommerce
  // ==========================================================================
  describe('H010: no_search_ecommerce', () => {
    it('should flag ecommerce site without search', () => {
      const root = createMockNode({
        tagName: 'body',
        xpath: '/html/body',
        children: [
          createMockNode({
            tagName: 'header',
            text: 'Shop Name',
          }),
        ],
      });
      const state = createMockPageState(root, {
        url: 'https://shop.example.com',
      });

      const insight = noSearchEcommerceRule.check(state, 'ecommerce');

      expect(insight).not.toBeNull();
      expect(insight?.type).toBe('no_search_ecommerce');
      expect(insight?.severity).toBe('medium');
    });

    it('should pass ecommerce site with search', () => {
      const root = createMockNode({
        tagName: 'body',
        xpath: '/html/body',
        children: [
          createMockNode({
            tagName: 'input',
            attributes: { type: 'search', placeholder: 'Search products' },
          }),
        ],
      });
      const state = createMockPageState(root, {
        url: 'https://shop.example.com',
      });

      const insight = noSearchEcommerceRule.check(state, 'ecommerce');

      expect(insight).toBeNull();
    });
  });
});
