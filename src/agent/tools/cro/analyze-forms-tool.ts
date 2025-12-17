/**
 * Analyze Forms Tool
 *
 * Phase 17b (T094): Analyzes form elements for UX issues.
 * Checks field count, labels, input types, validation indicators, submit buttons.
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult, CROInsight, DOMNode } from '../../../models/index.js';

/**
 * Create a unique insight ID
 */
function createInsightId(): string {
  return randomUUID().slice(0, 8);
}

/**
 * Helper to coerce string/boolean to boolean (handles LLM passing "true"/"false")
 */
const coerceBoolean = z.preprocess((val) => {
  if (typeof val === 'string') {
    return val.toLowerCase() === 'true';
  }
  return val;
}, z.boolean());

/**
 * Parameter schema for analyze_forms tool
 */
export const AnalyzeFormsParamsSchema = z.object({
  formSelector: z.string().optional().describe('Optional CSS selector to filter forms'),
  includeHiddenFields: coerceBoolean.optional().default(false).describe('Include hidden form fields in analysis'),
});

export type AnalyzeFormsParams = z.infer<typeof AnalyzeFormsParamsSchema>;

/**
 * Insight type constants for form analysis
 */
const INSIGHT_TYPES = {
  FORM_FIELD_OVERLOAD: 'form_field_overload',
  MISSING_FIELD_LABEL: 'missing_field_label',
  MISSING_INPUT_TYPE: 'missing_input_type',
  NO_REQUIRED_INDICATOR: 'no_required_indicator',
  NO_ERROR_CONTAINER: 'no_error_container',
  NO_SUBMIT_BUTTON: 'no_submit_button',
} as const;

/**
 * Analyze Forms Tool Implementation
 */
export const analyzeFormsTool: Tool = {
  name: 'analyze_forms',
  description: 'Analyze form elements for UX issues: field count, labels, input types, validation, submit buttons. Returns insights about form usability.',
  parameters: AnalyzeFormsParamsSchema,

  async execute(context: ToolContext): Promise<ToolResult> {
    const params = context.params as AnalyzeFormsParams;
    const insights: CROInsight[] = [];
    const forms: DOMNode[] = [];

    // Collect form elements from DOM tree
    collectForms(context.state.domTree.root, forms);
    context.logger.debug(`Found ${forms.length} forms`);

    if (forms.length === 0) {
      return {
        success: true,
        insights: [],
        extracted: {
          totalForms: 0,
          totalFields: 0,
        },
      };
    }

    let totalFields = 0;

    for (const form of forms) {
      const fields = getFormFields(form, params.includeHiddenFields ?? false);
      totalFields += fields.length;

      // F001: Form Field Overload (>5 visible fields)
      if (fields.length > 5) {
        insights.push({
          id: createInsightId(),
          type: INSIGHT_TYPES.FORM_FIELD_OVERLOAD,
          severity: 'high',
          element: form.xpath,
          issue: `Form has ${fields.length} fields. Forms with >5 fields have higher abandonment rates`,
          recommendation: 'Reduce to essential fields only. Consider multi-step form or progressive disclosure',
          category: 'form',
          evidence: { text: `${fields.length} fields` },
        });
      }

      // Check each field
      for (const field of fields) {
        // F002: Missing field label
        if (!hasLabel(field, form)) {
          insights.push({
            id: createInsightId(),
            type: INSIGHT_TYPES.MISSING_FIELD_LABEL,
            severity: 'medium',
            element: field.xpath,
            issue: 'Input field missing visible label or placeholder',
            recommendation: 'Add descriptive label above field for clarity and accessibility',
            category: 'form',
          });
        }

        // F003: Missing input type (for INPUT elements)
        if (isInputElement(field) && !hasInputType(field)) {
          insights.push({
            id: createInsightId(),
            type: INSIGHT_TYPES.MISSING_INPUT_TYPE,
            severity: 'medium',
            element: field.xpath,
            issue: 'Input lacks type attribute, defaults to text',
            recommendation: 'Specify type (email, tel, number) for mobile keyboard optimization and validation',
            category: 'form',
          });
        }

        // F004: Required field without visual indicator
        if (isRequiredField(field) && !hasRequiredIndicator(field)) {
          insights.push({
            id: createInsightId(),
            type: INSIGHT_TYPES.NO_REQUIRED_INDICATOR,
            severity: 'low',
            element: field.xpath,
            issue: 'Required field lacks visual indicator (asterisk or "required" text)',
            recommendation: 'Add visual indicator like asterisk (*) to clearly show required fields',
            category: 'form',
          });
        }
      }

      // F005: No error container (check for error message area)
      if (!hasErrorContainer(form)) {
        insights.push({
          id: createInsightId(),
          type: INSIGHT_TYPES.NO_ERROR_CONTAINER,
          severity: 'low',
          element: form.xpath,
          issue: 'Form lacks dedicated error message container',
          recommendation: 'Add error message area near fields or at form top for validation feedback',
          category: 'form',
        });
      }

      // F006: No submit button
      if (!hasSubmitButton(form)) {
        insights.push({
          id: createInsightId(),
          type: INSIGHT_TYPES.NO_SUBMIT_BUTTON,
          severity: 'high',
          element: form.xpath,
          issue: 'Form has no visible submit button',
          recommendation: 'Add clear submit button with action-oriented text (e.g., "Submit Application" not "Submit")',
          category: 'form',
        });
      }
    }

    return {
      success: true,
      insights,
      extracted: {
        totalForms: forms.length,
        totalFields,
      },
    };
  },
};

/**
 * Recursively collect form elements from DOM tree
 */
function collectForms(node: DOMNode, result: DOMNode[]): void {
  if (node.croType === 'form' && node.tagName.toUpperCase() === 'FORM' && node.isVisible) {
    result.push(node);
  }
  for (const child of node.children) {
    collectForms(child, result);
  }
}

/**
 * Get form fields from a form element
 */
function getFormFields(form: DOMNode, includeHidden: boolean): DOMNode[] {
  const fields: DOMNode[] = [];
  collectFormFields(form, fields, includeHidden);
  return fields;
}

/**
 * Recursively collect form fields
 */
function collectFormFields(node: DOMNode, result: DOMNode[], includeHidden: boolean): void {
  const tagName = node.tagName.toUpperCase();
  const isField = tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA';

  if (isField) {
    // Check if it's a hidden field
    const isHiddenInput = tagName === 'INPUT' && node.text?.includes('type="hidden"');

    if (includeHidden || (!isHiddenInput && node.isVisible)) {
      result.push(node);
    }
  }

  for (const child of node.children) {
    collectFormFields(child, result, includeHidden);
  }
}

/**
 * Check if field has a visible label or placeholder
 */
function hasLabel(field: DOMNode, form: DOMNode): boolean {
  // Check for placeholder attribute in text (simplified)
  if (field.text?.includes('placeholder=')) {
    return true;
  }

  // Check for aria-label
  if (field.text?.includes('aria-label=')) {
    return true;
  }

  // Check for associated LABEL element (would need to look at siblings/parent)
  // Simplified: check if there's a label element nearby with matching id/for
  return hasAssociatedLabel(field, form);
}

/**
 * Check for associated label element
 */
function hasAssociatedLabel(_field: DOMNode, form: DOMNode): boolean {
  // Look for label elements in the form
  const labels: DOMNode[] = [];
  collectLabels(form, labels);

  // Check if any label's for attribute matches field's id
  // Simplified check based on xpath proximity
  return labels.length > 0;
}

/**
 * Collect LABEL elements
 */
function collectLabels(node: DOMNode, result: DOMNode[]): void {
  if (node.tagName.toUpperCase() === 'LABEL' && node.isVisible) {
    result.push(node);
  }
  for (const child of node.children) {
    collectLabels(child, result);
  }
}

/**
 * Check if node is an INPUT element
 */
function isInputElement(node: DOMNode): boolean {
  return node.tagName.toUpperCase() === 'INPUT';
}

/**
 * Check if input has type attribute specified
 */
function hasInputType(node: DOMNode): boolean {
  // Check for type attribute in the text representation
  const text = node.text?.toLowerCase() || '';

  // Common input types that would be specified
  const types = ['type="email"', 'type="password"', 'type="tel"', 'type="number"', 'type="date"', 'type="url"', 'type="search"'];

  return types.some(t => text.includes(t));
}

/**
 * Check if field is marked as required
 */
function isRequiredField(node: DOMNode): boolean {
  const text = node.text?.toLowerCase() || '';
  return text.includes('required') || text.includes('aria-required="true"');
}

/**
 * Check if required field has visual indicator
 */
function hasRequiredIndicator(node: DOMNode): boolean {
  const text = node.text || '';
  // Check for asterisk or "required" text near the field
  return text.includes('*') || text.toLowerCase().includes('(required)');
}

/**
 * Check if form has error container
 */
function hasErrorContainer(form: DOMNode): boolean {
  // Look for common error container patterns
  const errorPatterns = ['error', 'alert', 'invalid', 'validation'];

  function checkForErrors(node: DOMNode): boolean {
    const text = node.text?.toLowerCase() || '';
    const xpath = node.xpath?.toLowerCase() || '';

    if (errorPatterns.some(p => text.includes(p) || xpath.includes(p))) {
      return true;
    }

    for (const child of node.children) {
      if (checkForErrors(child)) {
        return true;
      }
    }
    return false;
  }

  return checkForErrors(form);
}

/**
 * Check if form has a submit button
 */
function hasSubmitButton(form: DOMNode): boolean {
  function checkForSubmit(node: DOMNode): boolean {
    const tagName = node.tagName.toUpperCase();
    const text = node.text?.toLowerCase() || '';

    // Check for button with type="submit" or input type="submit"
    if (tagName === 'BUTTON' || tagName === 'INPUT') {
      if (text.includes('type="submit"') || text.includes('submit')) {
        return true;
      }
    }

    // Check for button elements (default type is submit in forms)
    if (tagName === 'BUTTON' && node.isVisible) {
      return true;
    }

    for (const child of node.children) {
      if (checkForSubmit(child)) {
        return true;
      }
    }
    return false;
  }

  return checkForSubmit(form);
}

export default analyzeFormsTool;
