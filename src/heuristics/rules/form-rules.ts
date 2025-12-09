/**
 * Form Heuristic Rules - Phase 18c (T108a, T108b)
 *
 * H003: form_field_overload - Form has >5 visible input fields
 * H004: missing_field_label - Input without associated label
 */

import type { HeuristicRule } from '../types.js';
import type { PageState, CROInsight, DOMNode } from '../../models/index.js';
import { v4 as uuid } from 'uuid';

/**
 * Maximum recommended form fields before overload
 */
const MAX_FORM_FIELDS = 5;

/**
 * Input tags that count as form fields
 */
const FORM_INPUT_TAGS = ['input', 'select', 'textarea'];

/**
 * Input types that don't count as visible fields
 */
const HIDDEN_INPUT_TYPES = ['hidden', 'submit', 'button', 'reset', 'image'];

/**
 * Find all form nodes in DOM tree
 */
function findFormNodes(node: DOMNode): DOMNode[] {
  const forms: DOMNode[] = [];

  if (node.tagName.toLowerCase() === 'form' && node.isVisible) {
    forms.push(node);
  }

  for (const child of node.children) {
    forms.push(...findFormNodes(child));
  }

  return forms;
}

/**
 * Find visible input fields within a form or node
 */
function findVisibleInputFields(node: DOMNode): DOMNode[] {
  const inputs: DOMNode[] = [];

  const tagName = node.tagName.toLowerCase();
  if (FORM_INPUT_TAGS.includes(tagName) && node.isVisible) {
    // Check if it's a hidden input type
    const inputType = node.attributes?.type?.toLowerCase() || 'text';
    if (!HIDDEN_INPUT_TYPES.includes(inputType)) {
      inputs.push(node);
    }
  }

  for (const child of node.children) {
    inputs.push(...findVisibleInputFields(child));
  }

  return inputs;
}

/**
 * Check if an input has an associated label
 */
function hasLabel(input: DOMNode, formNode: DOMNode): boolean {
  // Check for placeholder attribute
  if (input.attributes?.placeholder) {
    return true;
  }

  // Check for aria-label
  if (input.attributes?.['aria-label']) {
    return true;
  }

  // Check for aria-labelledby
  if (input.attributes?.['aria-labelledby']) {
    return true;
  }

  // Check for title attribute
  if (input.attributes?.title) {
    return true;
  }

  // Check for explicit label with for= attribute matching input id
  const inputId = input.attributes?.id;
  if (inputId) {
    const hasExplicitLabel = findLabelForId(formNode, inputId);
    if (hasExplicitLabel) {
      return true;
    }
  }

  // Check if input is wrapped in a label element
  // This would require parent tracking which we don't have,
  // so we rely on the above checks

  return false;
}

/**
 * Find if there's a label element with for= matching the given ID
 */
function findLabelForId(node: DOMNode, targetId: string): boolean {
  if (node.tagName.toLowerCase() === 'label') {
    if (node.attributes?.for === targetId || node.attributes?.htmlFor === targetId) {
      return true;
    }
  }

  for (const child of node.children) {
    if (findLabelForId(child, targetId)) {
      return true;
    }
  }

  return false;
}

/**
 * H003: Form Field Overload
 *
 * Forms with more than 5 visible fields can overwhelm users
 * and reduce completion rates.
 */
export const formFieldOverloadRule: HeuristicRule = {
  id: 'H003',
  name: 'form_field_overload',
  description: 'Forms with too many fields reduce completion rates',
  category: 'form',
  severity: 'high',
  businessTypes: [], // Applies to all business types

  check: (state: PageState): CROInsight | null => {
    const forms = findFormNodes(state.domTree.root);

    for (const form of forms) {
      const visibleInputs = findVisibleInputFields(form);
      const fieldCount = visibleInputs.length;

      if (fieldCount > MAX_FORM_FIELDS) {
        return {
          id: uuid(),
          category: 'form',
          type: 'form_field_overload',
          severity: 'high',
          element: form.xpath,
          issue: `Form has ${fieldCount} visible fields, which exceeds the recommended maximum of ${MAX_FORM_FIELDS}`,
          recommendation: `Reduce form fields to ${MAX_FORM_FIELDS} or fewer. Consider multi-step forms, removing optional fields, or using smart defaults`,
          evidence: {
            text: `${fieldCount} fields found: ${visibleInputs.map((i) => i.attributes?.name || i.tagName).join(', ')}`,
            selector: form.xpath,
          },
          heuristicId: 'H003',
        };
      }
    }

    return null;
  },
};

/**
 * H004: Missing Field Label
 *
 * Form inputs should have associated labels for accessibility
 * and clarity.
 */
export const missingFieldLabelRule: HeuristicRule = {
  id: 'H004',
  name: 'missing_field_label',
  description: 'Form inputs should have associated labels',
  category: 'form',
  severity: 'medium',
  businessTypes: [], // Applies to all business types

  check: (state: PageState): CROInsight | null => {
    const forms = findFormNodes(state.domTree.root);

    // Also check for standalone inputs not in forms
    const allInputs = findVisibleInputFields(state.domTree.root);

    // Check inputs within forms first
    for (const form of forms) {
      const inputs = findVisibleInputFields(form);

      for (const input of inputs) {
        if (!hasLabel(input, form)) {
          const inputName = input.attributes?.name || input.attributes?.id || 'unknown';
          return {
            id: uuid(),
            category: 'form',
            type: 'missing_field_label',
            severity: 'medium',
            element: input.xpath,
            issue: `Input field "${inputName}" has no associated label, placeholder, or aria-label`,
            recommendation:
              'Add a visible label, placeholder text, or aria-label to help users understand what to enter',
            evidence: {
              text: `Input type: ${input.attributes?.type || 'text'}, name: ${inputName}`,
              selector: input.xpath,
            },
            heuristicId: 'H004',
          };
        }
      }
    }

    // Check standalone inputs (not in any form)
    for (const input of allInputs) {
      // Skip if this input is within a form we already checked
      const isInForm = forms.some((form) =>
        input.xpath.startsWith(form.xpath.replace(/\[.*\]$/, ''))
      );

      if (!isInForm && !hasLabel(input, state.domTree.root)) {
        const inputName = input.attributes?.name || input.attributes?.id || 'unknown';
        return {
          id: uuid(),
          category: 'form',
          type: 'missing_field_label',
          severity: 'medium',
          element: input.xpath,
          issue: `Standalone input field "${inputName}" has no associated label`,
          recommendation:
            'Add a visible label, placeholder text, or aria-label to help users understand what to enter',
          evidence: {
            text: `Input type: ${input.attributes?.type || 'text'}, name: ${inputName}`,
            selector: input.xpath,
          },
          heuristicId: 'H004',
        };
      }
    }

    return null;
  },
};

/**
 * All form rules
 */
export const formRules: HeuristicRule[] = [formFieldOverloadRule, missingFieldLabelRule];
