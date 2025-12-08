/**
 * Find Friction Tool
 *
 * Phase 17b (T098): General friction point detector.
 * Runs lightweight checks across ALL CRO categories for quick overview.
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult, CROInsight, DOMNode, CROType } from '../../../models/index.js';

/**
 * Create a unique insight ID
 */
function createInsightId(): string {
  return randomUUID().slice(0, 8);
}

/**
 * CRO categories for friction analysis
 */
const CRO_CATEGORIES = ['cta', 'form', 'trust', 'value_prop', 'navigation'] as const;
type FrictionCategory = (typeof CRO_CATEGORIES)[number];

/**
 * Parameter schema for find_friction tool
 */
export const FindFrictionParamsSchema = z.object({
  categories: z
    .array(z.enum(CRO_CATEGORIES))
    .optional()
    .describe('Specific categories to check. If empty, checks all categories'),
});

export type FindFrictionParams = z.infer<typeof FindFrictionParamsSchema>;

/**
 * Insight type constants for friction analysis
 */
const INSIGHT_TYPES = {
  FRICTION_CTA: 'friction_cta',
  FRICTION_FORM: 'friction_form',
  FRICTION_TRUST: 'friction_trust',
  FRICTION_VALUE: 'friction_value',
  FRICTION_NAV: 'friction_nav',
} as const;

/**
 * Find Friction Tool Implementation
 */
export const findFrictionTool: Tool = {
  name: 'find_friction',
  description: 'Quick overview of friction points across all CRO categories. Use for initial assessment before deep analysis with specific tools.',
  parameters: FindFrictionParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as FindFrictionParams;
    const insights: CROInsight[] = [];

    // Determine which categories to check
    const categoriesToCheck = params.categories?.length ? params.categories : CRO_CATEGORIES;

    context.logger.debug(`Checking friction in categories: ${categoriesToCheck.join(', ')}`);

    const viewportHeight = context.state.viewport.height;
    let frictionScore = 0;
    const frictionDetails: Record<string, boolean> = {};

    // Check each category with ONE quick check
    for (const category of categoriesToCheck) {
      const result = checkCategoryFriction(context.state.domTree.root, category, viewportHeight);
      frictionDetails[category] = result.hasFriction;

      if (result.hasFriction) {
        frictionScore++;
        insights.push({
          id: createInsightId(),
          type: getInsightType(category),
          severity: result.severity,
          element: result.element || '',
          issue: result.issue,
          recommendation: result.recommendation,
          category: category === 'value_prop' ? 'value_prop' : category,
        });
      }
    }

    return {
      success: true,
      insights,
      extracted: {
        frictionScore,
        maxScore: categoriesToCheck.length,
        frictionDetails,
        categoriesChecked: categoriesToCheck.length,
      },
    };
  },
};

/**
 * Get insight type for category
 */
function getInsightType(category: FrictionCategory): string {
  switch (category) {
    case 'cta':
      return INSIGHT_TYPES.FRICTION_CTA;
    case 'form':
      return INSIGHT_TYPES.FRICTION_FORM;
    case 'trust':
      return INSIGHT_TYPES.FRICTION_TRUST;
    case 'value_prop':
      return INSIGHT_TYPES.FRICTION_VALUE;
    case 'navigation':
      return INSIGHT_TYPES.FRICTION_NAV;
  }
}

/**
 * Friction check result
 */
interface FrictionCheckResult {
  hasFriction: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  issue: string;
  recommendation: string;
  element?: string;
}

/**
 * Quick friction check for a single category
 */
function checkCategoryFriction(root: DOMNode, category: FrictionCategory, viewportHeight: number): FrictionCheckResult {
  switch (category) {
    case 'cta':
      return checkCTAFriction(root, viewportHeight);
    case 'form':
      return checkFormFriction(root);
    case 'trust':
      return checkTrustFriction(root, viewportHeight);
    case 'value_prop':
      return checkValuePropFriction(root);
    case 'navigation':
      return checkNavigationFriction(root);
  }
}

/**
 * Quick CTA friction check: No CTA above fold
 */
function checkCTAFriction(root: DOMNode, viewportHeight: number): FrictionCheckResult {
  const ctas: DOMNode[] = [];
  collectByType(root, 'cta', ctas);

  const aboveFoldCTAs = ctas.filter(cta => {
    const box = cta.boundingBox;
    return box && box.y < viewportHeight;
  });

  if (aboveFoldCTAs.length === 0) {
    return {
      hasFriction: true,
      severity: 'high',
      issue: 'No call-to-action visible above the fold',
      recommendation: 'Add prominent CTA in hero section to capture immediate attention',
    };
  }

  return { hasFriction: false, severity: 'low', issue: '', recommendation: '' };
}

/**
 * Quick form friction check: Form with >5 fields
 */
function checkFormFriction(root: DOMNode): FrictionCheckResult {
  const forms: DOMNode[] = [];
  collectByType(root, 'form', forms);

  // Check for forms with too many fields
  for (const form of forms) {
    if (form.tagName.toUpperCase() !== 'FORM') continue;

    const fields = countFormFields(form);
    if (fields > 5) {
      return {
        hasFriction: true,
        severity: 'high',
        issue: `Form has ${fields} fields, may cause abandonment`,
        recommendation: 'Reduce form to essential fields only',
        element: form.xpath,
      };
    }
  }

  return { hasFriction: false, severity: 'low', issue: '', recommendation: '' };
}

/**
 * Quick trust friction check: No trust signals
 */
function checkTrustFriction(root: DOMNode, viewportHeight: number): FrictionCheckResult {
  const trustElements: DOMNode[] = [];
  collectByType(root, 'trust', trustElements);

  const aboveFold = trustElements.filter(el => {
    const box = el.boundingBox;
    return box && box.y < viewportHeight;
  });

  if (aboveFold.length === 0) {
    return {
      hasFriction: true,
      severity: 'medium',
      issue: 'No trust signals visible above the fold',
      recommendation: 'Add trust badges or social proof near primary CTA',
    };
  }

  return { hasFriction: false, severity: 'low', issue: '', recommendation: '' };
}

/**
 * Quick value prop friction check: Missing or generic H1
 */
function checkValuePropFriction(root: DOMNode): FrictionCheckResult {
  const valueProps: DOMNode[] = [];
  collectByType(root, 'value_prop', valueProps);

  const h1Elements = valueProps.filter(el => el.tagName.toUpperCase() === 'H1');

  if (h1Elements.length === 0) {
    return {
      hasFriction: true,
      severity: 'high',
      issue: 'No H1 heading - primary value proposition unclear',
      recommendation: 'Add H1 that clearly communicates core benefit',
    };
  }

  // Check for generic H1
  const genericPatterns = [/^welcome$/i, /^home$/i, /^homepage$/i, /^about$/i];
  const h1Text = (h1Elements[0]?.text || '').trim();

  if (genericPatterns.some(p => p.test(h1Text))) {
    return {
      hasFriction: true,
      severity: 'medium',
      issue: `Generic H1: "${h1Text}" - fails to communicate value`,
      recommendation: 'Rewrite H1 to highlight specific benefit',
      element: h1Elements[0]?.xpath,
    };
  }

  return { hasFriction: false, severity: 'low', issue: '', recommendation: '' };
}

/**
 * Quick navigation friction check: No search
 */
function checkNavigationFriction(root: DOMNode): FrictionCheckResult {
  // Quick check for search functionality
  const hasSearch = checkForSearch(root);

  if (!hasSearch) {
    return {
      hasFriction: true,
      severity: 'medium',
      issue: 'No search functionality detected',
      recommendation: 'Add site search to help users find content quickly',
    };
  }

  return { hasFriction: false, severity: 'low', issue: '', recommendation: '' };
}

/**
 * Recursively collect elements by CRO type
 */
function collectByType(node: DOMNode, type: CROType, result: DOMNode[]): void {
  if (node.croType === type && node.isVisible) {
    result.push(node);
  }
  for (const child of node.children) {
    collectByType(child, type, result);
  }
}

/**
 * Count form fields in a form element
 */
function countFormFields(form: DOMNode): number {
  let count = 0;

  function countFields(node: DOMNode): void {
    const tagName = node.tagName.toUpperCase();
    if ((tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA') && node.isVisible) {
      // Don't count hidden inputs
      if (!(tagName === 'INPUT' && node.text?.includes('type="hidden"'))) {
        count++;
      }
    }
    for (const child of node.children) {
      countFields(child);
    }
  }

  countFields(form);
  return count;
}

/**
 * Check for search element in tree
 */
function checkForSearch(node: DOMNode): boolean {
  const text = (node.text || '').toLowerCase();

  if (text.includes('type="search"') || text.includes('role="search"')) {
    return true;
  }

  for (const child of node.children) {
    if (checkForSearch(child)) {
      return true;
    }
  }
  return false;
}

export default findFrictionTool;
