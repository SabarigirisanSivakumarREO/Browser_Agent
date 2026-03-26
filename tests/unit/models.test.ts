/**
 * Unit tests for CRO Agent models (Phase 13a).
 */

import { describe, it, expect } from 'vitest';
import {
  CROInsightSchema,
  EvidenceSchema,
  CROActionNames,
  type CROInsight,
  type BoundingBox,
  type DOMNode,
  type DOMTree,
  type PageState,
  type ToolResult,
  type CROActionName,
} from '../../src/models/index.js';

describe('CROInsightSchema', () => {
  describe('valid insights', () => {
    it('should accept a valid CRO insight with all required fields', () => {
      const insight: CROInsight = {
        id: 'insight-001',
        category: 'cta',
        type: 'vague_cta_text',
        severity: 'high',
        element: '/html/body/button[1]',
        issue: 'CTA button text "Click here" is vague and non-descriptive',
        recommendation: 'Use action-oriented text like "Start Free Trial" or "Get Started"',
      };

      const result = CROInsightSchema.safeParse(insight);
      expect(result.success).toBe(true);
    });

    it('should accept insight with optional evidence', () => {
      const insight: CROInsight = {
        id: 'insight-002',
        category: 'form',
        type: 'missing_labels',
        severity: 'medium',
        element: '/html/body/form/input[1]',
        issue: 'Form input is missing an accessible label element',
        recommendation: 'Add a <label> element with for attribute matching input id',
        evidence: {
          text: '<input type="email" placeholder="Email">',
          selector: 'form input[type="email"]',
        },
      };

      const result = CROInsightSchema.safeParse(insight);
      expect(result.success).toBe(true);
    });

    it('should accept insight with confidence score', () => {
      const insight: CROInsight = {
        id: 'insight-003',
        category: 'trust',
        type: 'missing_security_badge',
        severity: 'low',
        element: '/html/body/footer',
        issue: 'No visible security badges or trust signals in checkout flow',
        recommendation: 'Add SSL badge, payment provider logos, or security certifications',
        confidence: 0.85,
      };

      const result = CROInsightSchema.safeParse(insight);
      expect(result.success).toBe(true);
    });

    it('should accept insight with heuristic ID', () => {
      const insight: CROInsight = {
        id: 'insight-004',
        category: 'heuristic',
        type: 'low_contrast_cta',
        severity: 'critical',
        element: '/html/body/main/button',
        issue: 'Primary CTA has insufficient color contrast ratio (2.1:1)',
        recommendation: 'Increase contrast ratio to at least 4.5:1 for WCAG AA compliance',
        heuristicId: 'H003',
      };

      const result = CROInsightSchema.safeParse(insight);
      expect(result.success).toBe(true);
    });

    it('should accept all valid severity levels', () => {
      const severities = ['critical', 'high', 'medium', 'low'] as const;

      for (const severity of severities) {
        const insight = {
          id: `test-${severity}`,
          category: 'cta',
          type: 'test',
          severity,
          element: '/html/body',
          issue: 'Test issue description here',
          recommendation: 'Test recommendation here',
        };

        const result = CROInsightSchema.safeParse(insight);
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid categories', () => {
      const categories = ['cta', 'form', 'trust', 'value_prop', 'navigation', 'friction', 'heuristic'] as const;

      for (const category of categories) {
        const insight = {
          id: `test-${category}`,
          category,
          type: 'test',
          severity: 'medium',
          element: '/html/body',
          issue: 'Test issue description here',
          recommendation: 'Test recommendation here',
        };

        const result = CROInsightSchema.safeParse(insight);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('invalid insights', () => {
    it('should reject insight with empty issue', () => {
      const insight = {
        id: 'invalid-001',
        category: 'cta',
        type: 'test',
        severity: 'high',
        element: '/html/body',
        issue: '',
        recommendation: 'Fix the issue by doing something specific',
      };

      const result = CROInsightSchema.safeParse(insight);
      expect(result.success).toBe(false);
    });

    it('should reject insight with issue shorter than 10 characters', () => {
      const insight = {
        id: 'invalid-002',
        category: 'cta',
        type: 'test',
        severity: 'high',
        element: '/html/body',
        issue: 'Too short',
        recommendation: 'Fix the issue by doing something specific',
      };

      const result = CROInsightSchema.safeParse(insight);
      expect(result.success).toBe(false);
    });

    it('should reject insight with recommendation shorter than 10 characters', () => {
      const insight = {
        id: 'invalid-003',
        category: 'cta',
        type: 'test',
        severity: 'high',
        element: '/html/body',
        issue: 'This is a valid issue description',
        recommendation: 'Fix it',
      };

      const result = CROInsightSchema.safeParse(insight);
      expect(result.success).toBe(false);
    });

    it('should reject insight with invalid severity', () => {
      const insight = {
        id: 'invalid-004',
        category: 'cta',
        type: 'test',
        severity: 'urgent', // Invalid
        element: '/html/body',
        issue: 'This is a valid issue description',
        recommendation: 'This is a valid recommendation',
      };

      const result = CROInsightSchema.safeParse(insight);
      expect(result.success).toBe(false);
    });

    it('should reject insight with invalid category', () => {
      const insight = {
        id: 'invalid-005',
        category: 'seo', // Invalid
        type: 'test',
        severity: 'high',
        element: '/html/body',
        issue: 'This is a valid issue description',
        recommendation: 'This is a valid recommendation',
      };

      const result = CROInsightSchema.safeParse(insight);
      expect(result.success).toBe(false);
    });

    it('should reject insight with confidence > 1', () => {
      const insight = {
        id: 'invalid-006',
        category: 'cta',
        type: 'test',
        severity: 'high',
        element: '/html/body',
        issue: 'This is a valid issue description',
        recommendation: 'This is a valid recommendation',
        confidence: 1.5,
      };

      const result = CROInsightSchema.safeParse(insight);
      expect(result.success).toBe(false);
    });

    it('should reject insight with confidence < 0', () => {
      const insight = {
        id: 'invalid-007',
        category: 'cta',
        type: 'test',
        severity: 'high',
        element: '/html/body',
        issue: 'This is a valid issue description',
        recommendation: 'This is a valid recommendation',
        confidence: -0.5,
      };

      const result = CROInsightSchema.safeParse(insight);
      expect(result.success).toBe(false);
    });

    it('should reject insight with missing required fields', () => {
      const insight = {
        id: 'invalid-008',
        category: 'cta',
        // Missing: type, severity, element, issue, recommendation
      };

      const result = CROInsightSchema.safeParse(insight);
      expect(result.success).toBe(false);
    });
  });
});

describe('EvidenceSchema', () => {
  it('should accept empty evidence object', () => {
    const result = EvidenceSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept evidence with all fields', () => {
    const evidence = {
      text: 'Button text content',
      screenshot: 'base64encodedstring',
      styles: { color: 'red', fontSize: '16px' },
      selector: 'button.cta-primary',
    };

    const result = EvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(true);
  });

  it('should accept evidence with partial fields', () => {
    const evidence = {
      text: 'Some text',
      selector: '.my-class',
    };

    const result = EvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(true);
  });

  // Phase 21h: Evidence Capture Tests
  describe('Phase 21h evidence fields', () => {
    it('should accept evidence with viewportIndex', () => {
      const evidence = {
        text: 'Some text',
        viewportIndex: 0,
      };

      const result = EvidenceSchema.safeParse(evidence);
      expect(result.success).toBe(true);
    });

    it('should accept evidence with timestamp', () => {
      const evidence = {
        text: 'Some text',
        timestamp: Date.now(),
      };

      const result = EvidenceSchema.safeParse(evidence);
      expect(result.success).toBe(true);
    });

    it('should accept evidence with domElementRefs', () => {
      const evidence = {
        text: 'Some text',
        domElementRefs: [
          { index: 0, elementType: 'button', textContent: 'Add to Bag' },
          { index: 5, elementType: 'cta', selector: '.cta-primary' },
        ],
      };

      const result = EvidenceSchema.safeParse(evidence);
      expect(result.success).toBe(true);
    });

    it('should accept evidence with boundingBox', () => {
      const evidence = {
        text: 'Some text',
        boundingBox: {
          x: 100,
          y: 200,
          width: 150,
          height: 50,
          viewportIndex: 0,
        },
      };

      const result = EvidenceSchema.safeParse(evidence);
      expect(result.success).toBe(true);
    });

    it('should accept evidence with all Phase 21h fields', () => {
      const evidence = {
        text: 'CTA button observed at position',
        selector: '.cta-primary',
        viewportIndex: 2,
        timestamp: 1706659200000,
        domElementRefs: [
          { index: 3, elementType: 'button', textContent: 'Add to Bag', xpath: '/html/body/button[1]' },
        ],
        boundingBox: {
          x: 120,
          y: 450,
          width: 200,
          height: 60,
          viewportIndex: 2,
        },
      };

      const result = EvidenceSchema.safeParse(evidence);
      expect(result.success).toBe(true);
    });

    it('should reject evidence with invalid domElementRefs (missing required fields)', () => {
      const evidence = {
        domElementRefs: [
          { index: 0 }, // Missing elementType
        ],
      };

      const result = EvidenceSchema.safeParse(evidence);
      expect(result.success).toBe(false);
    });

    it('should reject evidence with invalid boundingBox (missing required fields)', () => {
      const evidence = {
        boundingBox: {
          x: 100,
          y: 200,
          // Missing width, height, viewportIndex
        },
      };

      const result = EvidenceSchema.safeParse(evidence);
      expect(result.success).toBe(false);
    });
  });
});

describe('CROActionNames', () => {
  it('should contain all expected action names', () => {
    expect(CROActionNames).toContain('analyze_ctas');
    expect(CROActionNames).toContain('analyze_forms');
    expect(CROActionNames).toContain('detect_trust_signals');
    expect(CROActionNames).toContain('assess_value_prop');
    expect(CROActionNames).toContain('check_navigation');
    expect(CROActionNames).toContain('find_friction');
    expect(CROActionNames).toContain('scroll_page');
    expect(CROActionNames).toContain('go_to_url');
    expect(CROActionNames).toContain('done');
  });

  it('should have exactly 26 action names', () => {
    // 6 analysis + 3 navigation + 2 collection + 2 control + 13 interaction = 26
    expect(CROActionNames.length).toBe(26);
  });
});

describe('Type exports compile correctly', () => {
  it('should allow creating BoundingBox objects', () => {
    const box: BoundingBox = { x: 0, y: 0, width: 100, height: 50 };
    expect(box.x).toBe(0);
    expect(box.width).toBe(100);
  });

  it('should allow creating DOMNode objects', () => {
    const node: DOMNode = {
      tagName: 'button',
      xpath: '/html/body/button[1]',
      text: 'Click me',
      isInteractive: true,
      isVisible: true,
      croType: 'cta',
      children: [],
    };
    expect(node.tagName).toBe('button');
    expect(node.croType).toBe('cta');
  });

  it('should allow creating DOMTree objects', () => {
    const tree: DOMTree = {
      root: {
        tagName: 'html',
        xpath: '/html',
        text: '',
        isInteractive: false,
        isVisible: true,
        croType: null,
        children: [],
      },
      interactiveCount: 0,
      croElementCount: 0,
      totalNodeCount: 1,
      extractedAt: Date.now(),
    };
    expect(tree.totalNodeCount).toBe(1);
  });

  it('should allow creating ToolResult objects', () => {
    const result: ToolResult = {
      success: true,
      insights: [],
      executionTimeMs: 150,
    };
    expect(result.success).toBe(true);
  });

  it('should enforce CROActionName type', () => {
    const action: CROActionName = 'analyze_ctas';
    expect(CROActionNames.includes(action)).toBe(true);
  });
});
