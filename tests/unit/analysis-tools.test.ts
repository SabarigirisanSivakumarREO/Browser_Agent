/**
 * Analysis Tools Unit Tests
 *
 * Phase 17b (T098a): Tests for analysis tools.
 * - analyze_forms: 12 tests
 * - detect_trust_signals: 10 tests
 * - assess_value_prop: 10 tests
 * - check_navigation: 8 tests
 * - find_friction: 6 tests
 * Total: 46 tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  analyzeFormsTool,
  AnalyzeFormsParamsSchema,
  analyzeTrustTool,
  AnalyzeTrustParamsSchema,
  analyzeValuePropTool,
  AnalyzeValuePropParamsSchema,
  checkNavigationTool,
  CheckNavigationParamsSchema,
  findFrictionTool,
  FindFrictionParamsSchema,
} from '../../src/agent/tools/cro/index.js';
import type { ToolContext } from '../../src/agent/tools/types.js';
import type { PageState, DOMNode, DOMTree, CROType } from '../../src/models/index.js';
import type { Page } from 'playwright';
import { createLogger } from '../../src/utils/logger.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create mock DOMNode with defaults
 */
function createMockDOMNode(overrides: Partial<DOMNode> = {}): DOMNode {
  return {
    tagName: 'div',
    xpath: '//div[1]',
    text: '',
    attributes: {},
    children: [],
    isVisible: true,
    isInteractive: false,
    croType: null,
    boundingBox: { x: 100, y: 100, width: 200, height: 50 },
    ...overrides,
  };
}

/**
 * Create mock DOMTree
 */
function createMockDOMTree(children: DOMNode[] = []): DOMTree {
  const root: DOMNode = {
    tagName: 'body',
    xpath: '//body',
    text: '',
    attributes: {},
    children,
    isVisible: true,
    isInteractive: false,
    croType: null,
  };

  return {
    root,
    interactiveCount: countByProperty(children, 'isInteractive'),
    croElementCount: countByCroType(children),
    totalNodeCount: countTotalNodes(root),
    extractedAt: Date.now(),
  };
}

function countByProperty(nodes: DOMNode[], prop: 'isInteractive' | 'isVisible'): number {
  let count = 0;
  for (const n of nodes) {
    if (n[prop]) count++;
    count += countByProperty(n.children, prop);
  }
  return count;
}

function countByCroType(nodes: DOMNode[]): number {
  let count = 0;
  for (const n of nodes) {
    if (n.croType !== null) count++;
    count += countByCroType(n.children);
  }
  return count;
}

function countTotalNodes(node: DOMNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countTotalNodes(child);
  }
  return count;
}

/**
 * Create mock PageState
 */
function createMockPageState(overrides: Partial<PageState> = {}): PageState {
  return {
    url: 'https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711',
    title: 'Test Page',
    domTree: createMockDOMTree(),
    viewport: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false },
    scrollPosition: { x: 0, y: 0, maxX: 0, maxY: 2000 },
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Create mock Playwright Page
 */
function createMockPage(): Page {
  return {
    url: vi.fn().mockReturnValue('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711'),
    evaluate: vi.fn().mockResolvedValue(undefined),
  } as unknown as Page;
}

/**
 * Create mock ToolContext
 */
function createMockContext(stateOverrides: Partial<PageState> = {}): ToolContext {
  return {
    params: {},
    page: createMockPage(),
    state: createMockPageState(stateOverrides),
    logger: createLogger({ verbose: false }),
  };
}

/**
 * Create a form element with fields
 */
function createFormElement(options: {
  fieldCount?: number;
  hasLabels?: boolean;
  hasInputTypes?: boolean;
  hasSubmit?: boolean;
  hasRequired?: boolean;
  hasRequiredIndicator?: boolean;
} = {}): DOMNode {
  const {
    fieldCount = 3,
    hasLabels = true,
    hasInputTypes = true,
    hasSubmit = true,
    hasRequired = false,
    hasRequiredIndicator = false,
  } = options;

  const fields: DOMNode[] = [];

  for (let i = 0; i < fieldCount; i++) {
    const labelText = hasLabels ? 'placeholder="Enter value"' : '';
    const typeAttr = hasInputTypes ? 'type="email"' : '';
    const requiredAttr = hasRequired ? 'required aria-required="true"' : '';
    const indicator = hasRequiredIndicator ? '*' : '';

    fields.push(
      createMockDOMNode({
        tagName: 'INPUT',
        xpath: `//form/input[${i + 1}]`,
        text: `${indicator}${labelText} ${typeAttr} ${requiredAttr}`.trim(),
        croType: 'form',
        isVisible: true,
      })
    );
  }

  if (hasSubmit) {
    fields.push(
      createMockDOMNode({
        tagName: 'BUTTON',
        xpath: '//form/button[1]',
        text: 'type="submit" Submit',
        croType: 'form',
        isVisible: true,
      })
    );
  }

  return createMockDOMNode({
    tagName: 'FORM',
    xpath: '//form[1]',
    text: '',
    croType: 'form',
    isVisible: true,
    children: fields,
  });
}

/**
 * Create a trust element
 */
function createTrustElement(options: {
  type?: 'review' | 'badge' | 'guarantee' | 'certification';
  aboveFold?: boolean;
} = {}): DOMNode {
  const { type = 'badge', aboveFold = true } = options;

  const text = {
    review: 'customer-review rating stars 4.5',
    badge: 'trust-badge secure ssl verified',
    guarantee: 'money-back guarantee 30-day refund',
    certification: 'certification accredited iso-certified',
  }[type];

  return createMockDOMNode({
    tagName: 'DIV',
    xpath: `//div[@class="${type}"]`,
    text,
    croType: 'trust',
    isVisible: true,
    boundingBox: aboveFold
      ? { x: 100, y: 200, width: 150, height: 50 }
      : { x: 100, y: 1500, width: 150, height: 50 },
  });
}

/**
 * Create a value prop (heading) element
 */
function createHeadingElement(options: {
  level?: 1 | 2;
  text?: string;
} = {}): DOMNode {
  const { level = 1, text = 'Get 50% Off Your First Order' } = options;

  return createMockDOMNode({
    tagName: `H${level}`,
    xpath: `//h${level}[1]`,
    text,
    croType: 'value_prop',
    isVisible: true,
  });
}

/**
 * Create a navigation element
 */
function createNavElement(options: {
  hasNav?: boolean;
  hasBreadcrumbs?: boolean;
  hasSearch?: boolean;
  hasHomeLink?: boolean;
  depth?: number;
} = {}): DOMNode {
  const { hasNav = true, hasBreadcrumbs = false, hasSearch = false, hasHomeLink = false, depth = 2 } = options;

  const children: DOMNode[] = [];

  if (hasNav) {
    // Create nested UL for depth testing
    let ul: DOMNode = createMockDOMNode({
      tagName: 'UL',
      xpath: '//nav/ul[1]',
      text: '',
      isVisible: true,
      children: [],
    });

    let current = ul;
    for (let i = 1; i < depth; i++) {
      const nested = createMockDOMNode({
        tagName: 'UL',
        xpath: `//nav/ul/li/ul[${i}]`,
        text: '',
        isVisible: true,
        children: [],
      });
      current.children.push(createMockDOMNode({
        tagName: 'LI',
        xpath: `//nav/ul/li[${i}]`,
        text: 'Menu Item',
        isVisible: true,
        children: [nested],
      }));
      current = nested;
    }

    children.push(
      createMockDOMNode({
        tagName: 'NAV',
        xpath: '//nav[1]',
        text: 'role="navigation"',
        croType: 'navigation',
        isVisible: true,
        children: [ul],
      })
    );
  }

  if (hasBreadcrumbs) {
    children.push(
      createMockDOMNode({
        tagName: 'DIV',
        xpath: '//div[@class="breadcrumb"]',
        text: 'breadcrumb aria-label="breadcrumb"',
        croType: 'navigation',
        isVisible: true,
      })
    );
  }

  if (hasSearch) {
    children.push(
      createMockDOMNode({
        tagName: 'INPUT',
        xpath: '//input[@type="search"]',
        text: 'type="search" role="search"',
        croType: 'navigation',
        isVisible: true,
      })
    );
  }

  if (hasHomeLink) {
    children.push(
      createMockDOMNode({
        tagName: 'A',
        xpath: '//a[@class="logo"]',
        text: 'href="/" home logo',
        croType: 'navigation',
        isVisible: true,
      })
    );
  }

  return createMockDOMNode({
    tagName: 'HEADER',
    xpath: '//header[1]',
    text: '',
    isVisible: true,
    children,
  });
}

/**
 * Create CTA element
 */
function createCTAElement(aboveFold: boolean = true): DOMNode {
  return createMockDOMNode({
    tagName: 'BUTTON',
    xpath: '//button[1]',
    text: 'Buy Now',
    croType: 'cta',
    isVisible: true,
    boundingBox: aboveFold
      ? { x: 100, y: 200, width: 150, height: 50 }
      : { x: 100, y: 1500, width: 150, height: 50 },
  });
}

// ============================================================================
// ANALYZE FORMS TESTS (12)
// ============================================================================

describe('analyzeFormsTool', () => {
  // Test 1: form with 6 fields → F001 (form_field_overload)
  it('should detect form with too many fields (>5)', async () => {
    const form = createFormElement({ fieldCount: 6 });
    const context = createMockContext({
      domTree: createMockDOMTree([form]),
    });
    context.params = {};

    const result = await analyzeFormsTool.execute(context);

    expect(result.success).toBe(true);
    const overloadInsight = result.insights.find(i => i.type === 'form_field_overload');
    expect(overloadInsight).toBeDefined();
    expect(overloadInsight?.severity).toBe('high');
  });

  // Test 2: form with 4 fields → no F001
  it('should not flag form with 5 or fewer fields', async () => {
    const form = createFormElement({ fieldCount: 4 });
    const context = createMockContext({
      domTree: createMockDOMTree([form]),
    });
    context.params = {};

    const result = await analyzeFormsTool.execute(context);

    expect(result.success).toBe(true);
    const overloadInsight = result.insights.find(i => i.type === 'form_field_overload');
    expect(overloadInsight).toBeUndefined();
  });

  // Test 3: input without label → F002 (missing_field_label)
  it('should detect input without label', async () => {
    const form = createFormElement({ fieldCount: 1, hasLabels: false });
    const context = createMockContext({
      domTree: createMockDOMTree([form]),
    });
    context.params = {};

    const result = await analyzeFormsTool.execute(context);

    expect(result.success).toBe(true);
    const labelInsight = result.insights.find(i => i.type === 'missing_field_label');
    expect(labelInsight).toBeDefined();
  });

  // Test 4: input with placeholder → no F002
  it('should not flag input with placeholder', async () => {
    const form = createFormElement({ fieldCount: 1, hasLabels: true });
    const context = createMockContext({
      domTree: createMockDOMTree([form]),
    });
    context.params = {};

    const result = await analyzeFormsTool.execute(context);

    expect(result.success).toBe(true);
    const labelInsight = result.insights.find(i => i.type === 'missing_field_label');
    expect(labelInsight).toBeUndefined();
  });

  // Test 5: input without type → F003 (missing_input_type)
  it('should detect input without type attribute', async () => {
    const form = createFormElement({ fieldCount: 1, hasInputTypes: false });
    const context = createMockContext({
      domTree: createMockDOMTree([form]),
    });
    context.params = {};

    const result = await analyzeFormsTool.execute(context);

    expect(result.success).toBe(true);
    const typeInsight = result.insights.find(i => i.type === 'missing_input_type');
    expect(typeInsight).toBeDefined();
  });

  // Test 6: input with type="email" → no F003
  it('should not flag input with proper type', async () => {
    const form = createFormElement({ fieldCount: 1, hasInputTypes: true });
    const context = createMockContext({
      domTree: createMockDOMTree([form]),
    });
    context.params = {};

    const result = await analyzeFormsTool.execute(context);

    expect(result.success).toBe(true);
    const typeInsight = result.insights.find(i => i.type === 'missing_input_type');
    expect(typeInsight).toBeUndefined();
  });

  // Test 7: required without indicator → F004 (no_required_indicator)
  it('should detect required field without visual indicator', async () => {
    const form = createFormElement({ fieldCount: 1, hasRequired: true, hasRequiredIndicator: false });
    const context = createMockContext({
      domTree: createMockDOMTree([form]),
    });
    context.params = {};

    const result = await analyzeFormsTool.execute(context);

    expect(result.success).toBe(true);
    const requiredInsight = result.insights.find(i => i.type === 'no_required_indicator');
    expect(requiredInsight).toBeDefined();
  });

  // Test 8: form without submit → F006 (no_submit_button)
  it('should detect form without submit button', async () => {
    const form = createFormElement({ fieldCount: 2, hasSubmit: false });
    const context = createMockContext({
      domTree: createMockDOMTree([form]),
    });
    context.params = {};

    const result = await analyzeFormsTool.execute(context);

    expect(result.success).toBe(true);
    const submitInsight = result.insights.find(i => i.type === 'no_submit_button');
    expect(submitInsight).toBeDefined();
    expect(submitInsight?.severity).toBe('high');
  });

  // Test 9: form with button type=submit → no F006
  it('should not flag form with submit button', async () => {
    const form = createFormElement({ fieldCount: 2, hasSubmit: true });
    const context = createMockContext({
      domTree: createMockDOMTree([form]),
    });
    context.params = {};

    const result = await analyzeFormsTool.execute(context);

    expect(result.success).toBe(true);
    const submitInsight = result.insights.find(i => i.type === 'no_submit_button');
    expect(submitInsight).toBeUndefined();
  });

  // Test 10: multiple forms analyzed
  it('should analyze multiple forms on page', async () => {
    const form1 = createFormElement({ fieldCount: 6 }); // Should trigger F001
    const form2 = createFormElement({ fieldCount: 7 }); // Should also trigger F001
    const context = createMockContext({
      domTree: createMockDOMTree([form1, form2]),
    });
    context.params = {};

    const result = await analyzeFormsTool.execute(context);

    expect(result.success).toBe(true);
    const overloadInsights = result.insights.filter(i => i.type === 'form_field_overload');
    expect(overloadInsights.length).toBe(2);
    expect((result.extracted as { totalForms: number }).totalForms).toBe(2);
  });

  // Test 11: formSelector filters correctly (schema test)
  it('should accept formSelector parameter', () => {
    const result = AnalyzeFormsParamsSchema.safeParse({ formSelector: '#login-form' });
    expect(result.success).toBe(true);
  });

  // Test 12: empty page returns empty insights
  it('should return empty insights for page with no forms', async () => {
    const context = createMockContext({
      domTree: createMockDOMTree([]),
    });
    context.params = {};

    const result = await analyzeFormsTool.execute(context);

    expect(result.success).toBe(true);
    expect(result.insights).toEqual([]);
    expect((result.extracted as { totalForms: number }).totalForms).toBe(0);
  });
});

// ============================================================================
// ANALYZE TRUST TESTS (10)
// ============================================================================

describe('analyzeTrustTool', () => {
  // Test 1: page with trust badge → no TR003
  it('should not flag page with trust badges', async () => {
    const badge = createTrustElement({ type: 'badge', aboveFold: true });
    const context = createMockContext({
      domTree: createMockDOMTree([badge]),
    });
    context.params = { focusArea: 'full_page' };

    const result = await analyzeTrustTool.execute(context);

    expect(result.success).toBe(true);
    const badgeInsight = result.insights.find(i => i.type === 'no_security_badge');
    expect(badgeInsight).toBeUndefined();
  });

  // Test 2: page without trust badge → TR003
  it('should detect missing security badges', async () => {
    const context = createMockContext({
      domTree: createMockDOMTree([]),
    });
    context.params = { focusArea: 'full_page' };

    const result = await analyzeTrustTool.execute(context);

    expect(result.success).toBe(true);
    const badgeInsight = result.insights.find(i => i.type === 'no_security_badge');
    expect(badgeInsight).toBeDefined();
  });

  // Test 3: page with reviews → no TR002
  it('should not flag page with reviews', async () => {
    const review = createTrustElement({ type: 'review', aboveFold: true });
    const context = createMockContext({
      domTree: createMockDOMTree([review]),
    });
    context.params = {};

    const result = await analyzeTrustTool.execute(context);

    expect(result.success).toBe(true);
    const reviewInsight = result.insights.find(i => i.type === 'no_reviews');
    expect(reviewInsight).toBeUndefined();
  });

  // Test 4: page without reviews → TR002
  it('should detect missing reviews', async () => {
    const context = createMockContext({
      domTree: createMockDOMTree([]),
    });
    context.params = {};

    const result = await analyzeTrustTool.execute(context);

    expect(result.success).toBe(true);
    const reviewInsight = result.insights.find(i => i.type === 'no_reviews');
    expect(reviewInsight).toBeDefined();
  });

  // Test 5: page with guarantee → no TR004
  it('should not flag page with guarantees', async () => {
    const guarantee = createTrustElement({ type: 'guarantee', aboveFold: true });
    const context = createMockContext({
      domTree: createMockDOMTree([guarantee]),
    });
    context.params = {};

    const result = await analyzeTrustTool.execute(context);

    expect(result.success).toBe(true);
    const guaranteeInsight = result.insights.find(i => i.type === 'no_guarantees');
    expect(guaranteeInsight).toBeUndefined();
  });

  // Test 6: above_fold filters correctly
  it('should filter trust elements by above_fold area', async () => {
    const aboveFoldBadge = createTrustElement({ type: 'badge', aboveFold: true });
    const belowFoldReview = createTrustElement({ type: 'review', aboveFold: false });
    const context = createMockContext({
      domTree: createMockDOMTree([aboveFoldBadge, belowFoldReview]),
      viewport: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false },
    });
    context.params = { focusArea: 'above_fold' };

    const result = await analyzeTrustTool.execute(context);

    expect(result.success).toBe(true);
    expect((result.extracted as { aboveFoldCount: number }).aboveFoldCount).toBe(1);
  });

  // Test 7: full_page includes footer elements
  it('should include footer trust elements with full_page focus', async () => {
    const belowFoldTrust = createTrustElement({ type: 'badge', aboveFold: false });
    const context = createMockContext({
      domTree: createMockDOMTree([belowFoldTrust]),
    });
    context.params = { focusArea: 'full_page' };

    const result = await analyzeTrustTool.execute(context);

    expect(result.success).toBe(true);
    expect((result.extracted as { totalTrustElements: number }).totalTrustElements).toBe(1);
  });

  // Test 8: multiple trust signals detected
  it('should detect multiple trust signal types', async () => {
    const badge = createTrustElement({ type: 'badge', aboveFold: true });
    const review = createTrustElement({ type: 'review', aboveFold: true });
    const guarantee = createTrustElement({ type: 'guarantee', aboveFold: true });
    const context = createMockContext({
      domTree: createMockDOMTree([badge, review, guarantee]),
    });
    context.params = {};

    const result = await analyzeTrustTool.execute(context);

    expect(result.success).toBe(true);
    expect((result.extracted as { hasBadges: boolean }).hasBadges).toBe(true);
    expect((result.extracted as { hasReviews: boolean }).hasReviews).toBe(true);
    expect((result.extracted as { hasGuarantees: boolean }).hasGuarantees).toBe(true);
  });

  // Test 9: trust signal count in extracted
  it('should report trust signal count in extracted data', async () => {
    const badge = createTrustElement({ type: 'badge', aboveFold: true });
    const context = createMockContext({
      domTree: createMockDOMTree([badge]),
    });
    context.params = {};

    const result = await analyzeTrustTool.execute(context);

    expect(result.success).toBe(true);
    expect((result.extracted as { totalTrustElements: number }).totalTrustElements).toBe(1);
  });

  // Test 10: empty page returns all applicable insights
  it('should return all missing trust insights for empty page', async () => {
    const context = createMockContext({
      domTree: createMockDOMTree([]),
    });
    context.params = {};

    const result = await analyzeTrustTool.execute(context);

    expect(result.success).toBe(true);
    // Should have insights for: no_trust_above_fold, no_reviews, no_security_badge, no_guarantees, no_certifications
    expect(result.insights.length).toBeGreaterThanOrEqual(4);
  });
});

// ============================================================================
// ANALYZE VALUE PROP TESTS (10)
// ============================================================================

describe('analyzeValuePropTool', () => {
  // Test 1: page with single H1 → no VP001, VP002
  it('should not flag page with single valid H1', async () => {
    const h1 = createHeadingElement({ level: 1, text: 'Transform Your Business Today' });
    const context = createMockContext({
      domTree: createMockDOMTree([h1]),
    });
    context.params = {};

    const result = await analyzeValuePropTool.execute(context);

    expect(result.success).toBe(true);
    expect(result.insights.find(i => i.type === 'missing_h1')).toBeUndefined();
    expect(result.insights.find(i => i.type === 'multiple_h1')).toBeUndefined();
  });

  // Test 2: page with no H1 → VP001
  it('should detect missing H1', async () => {
    const h2 = createHeadingElement({ level: 2, text: 'Subheading' });
    const context = createMockContext({
      domTree: createMockDOMTree([h2]),
    });
    context.params = {};

    const result = await analyzeValuePropTool.execute(context);

    expect(result.success).toBe(true);
    const missingH1 = result.insights.find(i => i.type === 'missing_h1');
    expect(missingH1).toBeDefined();
    expect(missingH1?.severity).toBe('high');
  });

  // Test 3: page with 2 H1s → VP002
  it('should detect multiple H1 elements', async () => {
    const h1a = createHeadingElement({ level: 1, text: 'First H1' });
    const h1b = createHeadingElement({ level: 1, text: 'Second H1' });
    const context = createMockContext({
      domTree: createMockDOMTree([h1a, h1b]),
    });
    context.params = {};

    const result = await analyzeValuePropTool.execute(context);

    expect(result.success).toBe(true);
    const multipleH1 = result.insights.find(i => i.type === 'multiple_h1');
    expect(multipleH1).toBeDefined();
    expect(multipleH1?.severity).toBe('medium');
  });

  // Test 4: H1 = "Welcome" → VP003
  it('should detect generic headline', async () => {
    const h1 = createHeadingElement({ level: 1, text: 'Welcome' });
    const context = createMockContext({
      domTree: createMockDOMTree([h1]),
    });
    context.params = {};

    const result = await analyzeValuePropTool.execute(context);

    expect(result.success).toBe(true);
    const genericInsight = result.insights.find(i => i.type === 'generic_headline');
    expect(genericInsight).toBeDefined();
  });

  // Test 5: H1 = "Get 50% Off Your First Order" → no VP003
  it('should not flag specific benefit-focused headline', async () => {
    const h1 = createHeadingElement({ level: 1, text: 'Get 50% Off Your First Order' });
    const context = createMockContext({
      domTree: createMockDOMTree([h1]),
    });
    context.params = {};

    const result = await analyzeValuePropTool.execute(context);

    expect(result.success).toBe(true);
    const genericInsight = result.insights.find(i => i.type === 'generic_headline');
    expect(genericInsight).toBeUndefined();
  });

  // Test 6: H1 without H2 → VP004
  it('should detect missing subheadline', async () => {
    const h1 = createHeadingElement({ level: 1, text: 'Main Headline' });
    const context = createMockContext({
      domTree: createMockDOMTree([h1]),
    });
    context.params = { checkH1Only: false };

    const result = await analyzeValuePropTool.execute(context);

    expect(result.success).toBe(true);
    const noSubInsight = result.insights.find(i => i.type === 'no_subheadline');
    expect(noSubInsight).toBeDefined();
  });

  // Test 7: H1 with H2 → no VP004
  it('should not flag when H2 subheadline present', async () => {
    const h1 = createHeadingElement({ level: 1, text: 'Main Headline' });
    const h2 = createHeadingElement({ level: 2, text: 'Supporting Details' });
    const context = createMockContext({
      domTree: createMockDOMTree([h1, h2]),
    });
    context.params = {};

    const result = await analyzeValuePropTool.execute(context);

    expect(result.success).toBe(true);
    const noSubInsight = result.insights.find(i => i.type === 'no_subheadline');
    expect(noSubInsight).toBeUndefined();
  });

  // Test 8: H1 with 12 words → VP005
  it('should detect headline that is too long', async () => {
    const longText = 'This is a very long headline that contains way too many words for good readability';
    const h1 = createHeadingElement({ level: 1, text: longText });
    const context = createMockContext({
      domTree: createMockDOMTree([h1]),
    });
    context.params = {};

    const result = await analyzeValuePropTool.execute(context);

    expect(result.success).toBe(true);
    const longInsight = result.insights.find(i => i.type === 'headline_too_long');
    expect(longInsight).toBeDefined();
  });

  // Test 9: H1 with 8 words → no VP005
  it('should not flag headline with 10 or fewer words', async () => {
    const h1 = createHeadingElement({ level: 1, text: 'Save Time and Money With Our Solution' });
    const context = createMockContext({
      domTree: createMockDOMTree([h1]),
    });
    context.params = {};

    const result = await analyzeValuePropTool.execute(context);

    expect(result.success).toBe(true);
    const longInsight = result.insights.find(i => i.type === 'headline_too_long');
    expect(longInsight).toBeUndefined();
  });

  // Test 10: checkH1Only: true ignores H2-H6
  it('should skip H2 check when checkH1Only is true', async () => {
    const h1 = createHeadingElement({ level: 1, text: 'Main Headline' });
    const context = createMockContext({
      domTree: createMockDOMTree([h1]),
    });
    context.params = { checkH1Only: true };

    const result = await analyzeValuePropTool.execute(context);

    expect(result.success).toBe(true);
    // Should not report no_subheadline when checkH1Only is true
    const noSubInsight = result.insights.find(i => i.type === 'no_subheadline');
    expect(noSubInsight).toBeUndefined();
  });
});

// ============================================================================
// CHECK NAVIGATION TESTS (8)
// ============================================================================

describe('checkNavigationTool', () => {
  // Test 1: page with <nav> → no NAV001
  it('should not flag page with main navigation', async () => {
    const nav = createNavElement({ hasNav: true });
    const context = createMockContext({
      domTree: createMockDOMTree([nav]),
    });
    context.params = {};

    const result = await checkNavigationTool.execute(context);

    expect(result.success).toBe(true);
    const noNavInsight = result.insights.find(i => i.type === 'no_main_nav');
    expect(noNavInsight).toBeUndefined();
  });

  // Test 2: page without nav → NAV001
  it('should detect missing main navigation', async () => {
    const context = createMockContext({
      domTree: createMockDOMTree([]),
    });
    context.params = {};

    const result = await checkNavigationTool.execute(context);

    expect(result.success).toBe(true);
    const noNavInsight = result.insights.find(i => i.type === 'no_main_nav');
    expect(noNavInsight).toBeDefined();
    expect(noNavInsight?.severity).toBe('high');
  });

  // Test 3: product page with breadcrumbs → no NAV002
  it('should not flag page with breadcrumbs', async () => {
    const nav = createNavElement({ hasNav: true, hasBreadcrumbs: true });
    const context = createMockContext({
      url: 'https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711/products/item-123',
      domTree: createMockDOMTree([nav]),
    });
    context.params = {};

    const result = await checkNavigationTool.execute(context);

    expect(result.success).toBe(true);
    const noBreadcrumbs = result.insights.find(i => i.type === 'no_breadcrumbs');
    expect(noBreadcrumbs).toBeUndefined();
  });

  // Test 4: product page without breadcrumbs → NAV002
  it('should detect missing breadcrumbs on non-home page', async () => {
    const nav = createNavElement({ hasNav: true, hasBreadcrumbs: false });
    const context = createMockContext({
      url: 'https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711/products/item-123',
      domTree: createMockDOMTree([nav]),
    });
    context.params = {};

    const result = await checkNavigationTool.execute(context);

    expect(result.success).toBe(true);
    const noBreadcrumbs = result.insights.find(i => i.type === 'no_breadcrumbs');
    expect(noBreadcrumbs).toBeDefined();
  });

  // Test 5: page with search → no NAV003
  it('should not flag page with search', async () => {
    const nav = createNavElement({ hasNav: true, hasSearch: true });
    const context = createMockContext({
      domTree: createMockDOMTree([nav]),
    });
    context.params = {};

    const result = await checkNavigationTool.execute(context);

    expect(result.success).toBe(true);
    const noSearch = result.insights.find(i => i.type === 'no_search');
    expect(noSearch).toBeUndefined();
  });

  // Test 6: page without search → NAV003
  it('should detect missing search functionality', async () => {
    const nav = createNavElement({ hasNav: true, hasSearch: false });
    const context = createMockContext({
      domTree: createMockDOMTree([nav]),
    });
    context.params = {};

    const result = await checkNavigationTool.execute(context);

    expect(result.success).toBe(true);
    const noSearch = result.insights.find(i => i.type === 'no_search');
    expect(noSearch).toBeDefined();
  });

  // Test 7: deep nav (4 levels) → NAV004
  it('should detect deep navigation nesting', async () => {
    const nav = createNavElement({ hasNav: true, depth: 5 });
    const context = createMockContext({
      domTree: createMockDOMTree([nav]),
    });
    context.params = {};

    const result = await checkNavigationTool.execute(context);

    expect(result.success).toBe(true);
    const deepNav = result.insights.find(i => i.type === 'deep_nav_nesting');
    expect(deepNav).toBeDefined();
  });

  // Test 8: nav menu depth in extracted
  it('should report nav depth in extracted data', async () => {
    const nav = createNavElement({ hasNav: true, depth: 2 });
    const context = createMockContext({
      domTree: createMockDOMTree([nav]),
    });
    context.params = {};

    const result = await checkNavigationTool.execute(context);

    expect(result.success).toBe(true);
    expect((result.extracted as { navDepth: number }).navDepth).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// FIND FRICTION TESTS (6)
// ============================================================================

describe('findFrictionTool', () => {
  // Test 1: page with issues in all categories → 4 insights (form friction needs >5 fields to trigger)
  it('should detect friction across all categories', async () => {
    // Empty page - no CTA, no trust, no H1, no search
    // Note: Form friction only triggers for forms with >5 fields, not for missing forms
    const context = createMockContext({
      domTree: createMockDOMTree([]),
    });
    context.params = {};

    const result = await findFrictionTool.execute(context);

    expect(result.success).toBe(true);
    // 4 friction points: CTA (no above fold), trust (no above fold), value (no H1), nav (no search)
    // Form friction doesn't trigger on empty page (only triggers for forms with >5 fields)
    expect(result.insights.length).toBe(4);
    expect((result.extracted as { frictionScore: number }).frictionScore).toBe(4);
  });

  // Test 2: clean page → 0 insights
  it('should return no friction for well-optimized page', async () => {
    const cta = createCTAElement(true);
    const form = createFormElement({ fieldCount: 3 });
    const trust = createTrustElement({ type: 'badge', aboveFold: true });
    const h1 = createHeadingElement({ level: 1, text: 'Transform Your Business' });
    const nav = createNavElement({ hasNav: true, hasSearch: true });

    const context = createMockContext({
      domTree: createMockDOMTree([cta, form, trust, h1, nav]),
    });
    context.params = {};

    const result = await findFrictionTool.execute(context);

    expect(result.success).toBe(true);
    expect(result.insights.length).toBe(0);
    expect((result.extracted as { frictionScore: number }).frictionScore).toBe(0);
  });

  // Test 3: categories filter works
  it('should filter by specified categories', async () => {
    const context = createMockContext({
      domTree: createMockDOMTree([]),
    });
    context.params = { categories: ['cta', 'form'] };

    const result = await findFrictionTool.execute(context);

    expect(result.success).toBe(true);
    // Should only check 2 categories
    expect((result.extracted as { categoriesChecked: number }).categoriesChecked).toBe(2);
    // Only CTA friction triggers (no above fold CTA), form friction doesn't trigger on empty page
    expect(result.insights.length).toBe(1);
  });

  // Test 4: friction score calculated
  it('should calculate friction score correctly', async () => {
    // Page with CTA but missing other elements
    const cta = createCTAElement(true);
    const context = createMockContext({
      domTree: createMockDOMTree([cta]),
    });
    context.params = {};

    const result = await findFrictionTool.execute(context);

    expect(result.success).toBe(true);
    // Should have 3 friction points (trust, value, nav)
    // Note: form friction doesn't trigger on empty page (only for forms with >5 fields)
    expect((result.extracted as { frictionScore: number }).frictionScore).toBe(3);
    expect((result.extracted as { maxScore: number }).maxScore).toBe(5);
  });

  // Test 5: each friction type has category
  it('should assign correct insight types per category', async () => {
    // Create a page with form that has >5 fields to trigger form friction
    const form = createFormElement({ fieldCount: 7 });
    const context = createMockContext({
      domTree: createMockDOMTree([form]),
    });
    context.params = {};

    const result = await findFrictionTool.execute(context);

    expect(result.success).toBe(true);
    const types = result.insights.map(i => i.type);
    expect(types).toContain('friction_cta');
    expect(types).toContain('friction_form');
    expect(types).toContain('friction_trust');
    expect(types).toContain('friction_value');
    expect(types).toContain('friction_nav');
  });

  // Test 6: empty categories param checks all
  it('should check all categories when none specified', async () => {
    // Create form with >5 fields to trigger form friction
    const form = createFormElement({ fieldCount: 7 });
    const context = createMockContext({
      domTree: createMockDOMTree([form]),
    });
    context.params = { categories: [] };

    const result = await findFrictionTool.execute(context);

    expect(result.success).toBe(true);
    // Empty array should default to all categories
    expect((result.extracted as { categoriesChecked: number }).categoriesChecked).toBe(5);
    // All 5 friction types should be detected
    expect(result.insights.length).toBe(5);
  });
});

// ============================================================================
// SCHEMA VALIDATION TESTS
// ============================================================================

describe('Parameter Schema Validation', () => {
  it('AnalyzeFormsParamsSchema should apply defaults', () => {
    const result = AnalyzeFormsParamsSchema.parse({});
    expect(result.includeHiddenFields).toBe(false);
  });

  it('AnalyzeTrustParamsSchema should apply default focusArea', () => {
    const result = AnalyzeTrustParamsSchema.parse({});
    expect(result.focusArea).toBe('full_page');
  });

  it('AnalyzeValuePropParamsSchema should apply default checkH1Only', () => {
    const result = AnalyzeValuePropParamsSchema.parse({});
    expect(result.checkH1Only).toBe(false);
  });

  it('CheckNavigationParamsSchema should apply default includeFooter', () => {
    const result = CheckNavigationParamsSchema.parse({});
    expect(result.includeFooter).toBe(true);
  });

  it('FindFrictionParamsSchema should accept empty categories', () => {
    const result = FindFrictionParamsSchema.safeParse({ categories: [] });
    expect(result.success).toBe(true);
  });
});
