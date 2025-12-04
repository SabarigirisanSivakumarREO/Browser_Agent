/**
 * CRO element selector patterns for classification
 */

export interface CROSelectorPattern {
  type: 'tag' | 'class' | 'id' | 'attr' | 'role' | 'text';
  pattern: string;
  weight: number;  // 0-1, higher = more confident match
}

export interface CROSelectorConfig {
  cta: CROSelectorPattern[];
  form: CROSelectorPattern[];
  trust: CROSelectorPattern[];
  value_prop: CROSelectorPattern[];
  navigation: CROSelectorPattern[];
}

export const CRO_SELECTORS: CROSelectorConfig = {
  cta: [
    // Primary CTA patterns (high confidence)
    { type: 'tag', pattern: 'button', weight: 0.6 },
    { type: 'role', pattern: 'button', weight: 0.8 },
    { type: 'class', pattern: 'cta', weight: 0.9 },
    { type: 'class', pattern: 'btn-primary', weight: 0.85 },
    { type: 'class', pattern: 'btn-cta', weight: 0.9 },
    { type: 'attr', pattern: 'data-cta', weight: 0.95 },
    // Link-based CTAs
    { type: 'tag', pattern: 'a', weight: 0.3 },  // Low base, boosted by text
    { type: 'class', pattern: 'button', weight: 0.7 },
    // Text patterns (checked separately)
    { type: 'text', pattern: 'buy|order|subscribe|sign up|get started|try free|add to cart', weight: 0.8 },
  ],
  form: [
    { type: 'tag', pattern: 'form', weight: 0.9 },
    { type: 'tag', pattern: 'input', weight: 0.7 },
    { type: 'tag', pattern: 'select', weight: 0.7 },
    { type: 'tag', pattern: 'textarea', weight: 0.7 },
    { type: 'role', pattern: 'textbox', weight: 0.8 },
    { type: 'role', pattern: 'combobox', weight: 0.8 },
    { type: 'class', pattern: 'form', weight: 0.6 },
    { type: 'class', pattern: 'input', weight: 0.5 },
    { type: 'attr', pattern: 'data-form', weight: 0.9 },
  ],
  trust: [
    { type: 'class', pattern: 'trust', weight: 0.8 },
    { type: 'class', pattern: 'badge', weight: 0.6 },
    { type: 'class', pattern: 'testimonial', weight: 0.85 },
    { type: 'class', pattern: 'review', weight: 0.8 },
    { type: 'class', pattern: 'rating', weight: 0.8 },
    { type: 'class', pattern: 'guarantee', weight: 0.85 },
    { type: 'class', pattern: 'secure', weight: 0.7 },
    { type: 'class', pattern: 'certification', weight: 0.8 },
    { type: 'class', pattern: 'partner', weight: 0.6 },
    { type: 'class', pattern: 'client', weight: 0.5 },
    { type: 'class', pattern: 'logo', weight: 0.4 },
    { type: 'attr', pattern: 'data-trust', weight: 0.9 },
    { type: 'text', pattern: 'trusted by|verified|certified|secure|guarantee|money back', weight: 0.7 },
  ],
  value_prop: [
    { type: 'tag', pattern: 'h1', weight: 0.7 },
    { type: 'class', pattern: 'hero', weight: 0.85 },
    { type: 'class', pattern: 'headline', weight: 0.8 },
    { type: 'class', pattern: 'tagline', weight: 0.8 },
    { type: 'class', pattern: 'value-prop', weight: 0.9 },
    { type: 'class', pattern: 'benefit', weight: 0.75 },
    { type: 'class', pattern: 'feature', weight: 0.6 },
    { type: 'class', pattern: 'usp', weight: 0.85 },
    { type: 'attr', pattern: 'data-value-prop', weight: 0.95 },
  ],
  navigation: [
    { type: 'tag', pattern: 'nav', weight: 0.9 },
    { type: 'role', pattern: 'navigation', weight: 0.95 },
    { type: 'class', pattern: 'nav', weight: 0.7 },
    { type: 'class', pattern: 'menu', weight: 0.7 },
    { type: 'class', pattern: 'breadcrumb', weight: 0.85 },
    { type: 'class', pattern: 'header', weight: 0.5 },
    { type: 'class', pattern: 'footer', weight: 0.4 },
    { type: 'class', pattern: 'sidebar', weight: 0.5 },
    { type: 'attr', pattern: 'data-nav', weight: 0.9 },
  ],
};

/**
 * Interactive element detection patterns
 */
export const INTERACTIVE_TAGS = [
  'button', 'a', 'input', 'select', 'textarea', 'summary', 'details'
] as const;

export const INTERACTIVE_ROLES = [
  'button', 'link', 'checkbox', 'radio', 'textbox', 'combobox',
  'listbox', 'menuitem', 'tab', 'switch', 'slider'
] as const;

/**
 * Elements to skip during traversal (no CRO value)
 */
export const SKIP_TAGS = [
  'script', 'style', 'noscript', 'meta', 'link', 'svg', 'path',
  'defs', 'clipPath', 'symbol', 'use', 'br', 'hr', 'wbr'
] as const;

/**
 * Maximum text length for extraction (CR-015)
 */
export const MAX_TEXT_LENGTH = 100;
