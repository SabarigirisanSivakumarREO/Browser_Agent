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
  // Phase 25b: Enhanced PDP selectors
  price: CROSelectorPattern[];
  variant: CROSelectorPattern[];
  stock: CROSelectorPattern[];
  shipping: CROSelectorPattern[];
  gallery: CROSelectorPattern[];
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
  // Phase 25b: Price selectors (T477)
  price: [
    { type: 'class', pattern: 'price', weight: 0.9 },
    { type: 'class', pattern: 'cost', weight: 0.8 },
    { type: 'class', pattern: 'amount', weight: 0.7 },
    { type: 'class', pattern: 'product-price', weight: 0.9 },
    { type: 'class', pattern: 'sale-price', weight: 0.9 },
    { type: 'class', pattern: 'regular-price', weight: 0.85 },
    { type: 'attr', pattern: 'data-price', weight: 0.95 },
    { type: 'attr', pattern: 'itemprop="price"', weight: 0.95 },
    { type: 'text', pattern: '₹|\\$|€|£|¥|USD|INR|EUR|GBP', weight: 0.6 },
  ],
  // Phase 25b: Variant selectors (T478)
  variant: [
    { type: 'class', pattern: 'swatch', weight: 0.9 },
    { type: 'class', pattern: 'variant', weight: 0.85 },
    { type: 'class', pattern: 'size-selector', weight: 0.9 },
    { type: 'class', pattern: 'color-selector', weight: 0.9 },
    { type: 'class', pattern: 'size-option', weight: 0.85 },
    { type: 'class', pattern: 'color-option', weight: 0.85 },
    { type: 'role', pattern: 'radiogroup', weight: 0.7 },
    { type: 'role', pattern: 'listbox', weight: 0.6 },
  ],
  // Phase 25b: Stock selectors (T479)
  stock: [
    { type: 'class', pattern: 'stock', weight: 0.9 },
    { type: 'class', pattern: 'availability', weight: 0.85 },
    { type: 'class', pattern: 'inventory', weight: 0.8 },
    { type: 'class', pattern: 'in-stock', weight: 0.9 },
    { type: 'class', pattern: 'out-of-stock', weight: 0.9 },
    { type: 'class', pattern: 'sold-out', weight: 0.9 },
    { type: 'text', pattern: 'in stock|out of stock|available|sold out|limited', weight: 0.8 },
  ],
  // Phase 25b: Shipping selectors (T480)
  shipping: [
    { type: 'class', pattern: 'shipping', weight: 0.9 },
    { type: 'class', pattern: 'delivery', weight: 0.85 },
    { type: 'class', pattern: 'fulfillment', weight: 0.8 },
    { type: 'class', pattern: 'shipping-info', weight: 0.9 },
    { type: 'class', pattern: 'delivery-info', weight: 0.9 },
    { type: 'text', pattern: 'free shipping|free delivery|ships|arrives|delivery by', weight: 0.7 },
  ],
  // Phase 25b: Gallery selectors (T481)
  gallery: [
    { type: 'class', pattern: 'gallery', weight: 0.9 },
    { type: 'class', pattern: 'product-image', weight: 0.85 },
    { type: 'class', pattern: 'product-gallery', weight: 0.9 },
    { type: 'class', pattern: 'carousel', weight: 0.7 },
    { type: 'class', pattern: 'thumbnail', weight: 0.8 },
    { type: 'class', pattern: 'image-gallery', weight: 0.9 },
    { type: 'class', pattern: 'product-images', weight: 0.9 },
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

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 25g: Confidence Aggregation (T507)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of confidence aggregation from multiple pattern matches
 */
export interface AggregatedConfidence {
  /** Combined confidence score 0-1 */
  confidence: number;
  /** Patterns that contributed to the match */
  matchedPatterns: string[];
}

/**
 * Aggregate confidence from multiple pattern matches (Phase 25g - T507)
 *
 * Uses weighted combination: confidence = 1 - ∏(1 - weight_i)
 * This means multiple hits increase confidence but never exceed 1.0
 *
 * @param matches - Array of pattern matches with their weights
 * @returns Aggregated confidence and list of matched patterns
 */
export function aggregateConfidence(
  matches: Array<{ pattern: string; weight: number }>
): AggregatedConfidence {
  if (matches.length === 0) {
    return { confidence: 0, matchedPatterns: [] };
  }

  // Single match - return as-is
  if (matches.length === 1) {
    const firstMatch = matches[0]!;
    return {
      confidence: Math.min(1, Math.max(0, firstMatch.weight)),
      matchedPatterns: [firstMatch.pattern],
    };
  }

  // Multiple matches - combine using probability union
  // P(A ∪ B) = 1 - (1 - P(A)) * (1 - P(B))
  let combinedProbability = 0;
  const matchedPatterns: string[] = [];

  for (const match of matches) {
    const weight = Math.min(1, Math.max(0, match.weight));
    combinedProbability = combinedProbability + weight - (combinedProbability * weight);
    matchedPatterns.push(match.pattern);
  }

  return {
    confidence: Math.min(1, Math.max(0, combinedProbability)),
    matchedPatterns,
  };
}

/**
 * CRO type with array of matched CRO categories
 */
export type CROTypeKey = keyof CROSelectorConfig;

/**
 * Match an element against all CRO patterns and return aggregated results
 *
 * @param element - Object with element properties to match against
 * @returns Map of CRO type to aggregated confidence
 */
export function matchElementPatterns(element: {
  tagName: string;
  classes: string;
  id: string;
  role: string;
  text: string;
  attributes: Record<string, string>;
}): Record<CROTypeKey, AggregatedConfidence> {
  const results: Record<string, AggregatedConfidence> = {};
  const tagName = element.tagName.toLowerCase();
  const classes = element.classes.toLowerCase();
  const id = element.id.toLowerCase();
  const role = element.role.toLowerCase();
  const text = element.text.toLowerCase();

  for (const [croType, patterns] of Object.entries(CRO_SELECTORS) as [CROTypeKey, CROSelectorPattern[]][]) {
    const matches: Array<{ pattern: string; weight: number }> = [];

    for (const pattern of patterns) {
      let matched = false;

      switch (pattern.type) {
        case 'tag':
          matched = tagName === pattern.pattern;
          break;
        case 'class':
          matched = classes.includes(pattern.pattern);
          break;
        case 'id':
          matched = id.includes(pattern.pattern);
          break;
        case 'attr':
          // Check if attribute exists or matches pattern like itemprop="price"
          if (pattern.pattern.includes('=')) {
            const parts = pattern.pattern.split('=');
            const attr = parts[0] ?? '';
            const val = parts[1] ?? '';
            matched = element.attributes[attr]?.toLowerCase().includes(val.replace(/"/g, '')) ?? false;
          } else {
            matched = pattern.pattern in element.attributes;
          }
          break;
        case 'role':
          matched = role === pattern.pattern;
          break;
        case 'text':
          const textPatterns = pattern.pattern.split('|');
          matched = textPatterns.some(p => {
            try {
              return new RegExp(p, 'i').test(text);
            } catch {
              return text.includes(p);
            }
          });
          break;
      }

      if (matched) {
        matches.push({ pattern: `${pattern.type}:${pattern.pattern}`, weight: pattern.weight });
      }
    }

    results[croType] = aggregateConfidence(matches);
  }

  return results as Record<CROTypeKey, AggregatedConfidence>;
}

/**
 * Get the best CRO type match for an element
 *
 * @param results - Results from matchElementPatterns
 * @param minConfidence - Minimum confidence to consider (default: 0.5)
 * @returns Best match or null if none meet threshold
 */
export function getBestCROMatch(
  results: Record<CROTypeKey, AggregatedConfidence>,
  minConfidence: number = 0.5
): { type: CROTypeKey; confidence: number; matchedPatterns: string[] } | null {
  let best: { type: CROTypeKey; confidence: number; matchedPatterns: string[] } | null = null;

  for (const [type, result] of Object.entries(results) as [CROTypeKey, AggregatedConfidence][]) {
    if (result.confidence >= minConfidence) {
      if (!best || result.confidence > best.confidence) {
        best = { type, confidence: result.confidence, matchedPatterns: result.matchedPatterns };
      }
    }
  }

  return best;
}
