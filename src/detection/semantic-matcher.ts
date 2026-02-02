/**
 * Semantic Matcher - Smart element classification
 *
 * Replaces substring matching with semantic understanding.
 * Fixes false positives like "nav" matching "unavailable".
 */

/**
 * Match result with confidence and evidence
 */
export interface MatchResult {
  matches: boolean;
  confidence: number;
  matchType: 'exact' | 'word_boundary' | 'semantic' | 'aria' | 'behavioral' | 'text' | 'none';
  evidence: string[];
}

/**
 * Signal from a single matching strategy
 */
interface MatchSignal {
  type: MatchResult['matchType'];
  confidence: number;
  evidence: string;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if pattern matches with word boundaries
 *
 * Valid matches (separated by - or _):
 *   "btn" matches "btn", "btn-primary", "submit-btn", "my-btn-large"
 *
 * Invalid matches (no separator):
 *   "btn" does NOT match "btnWrapper", "submitbtn"
 *   "nav" does NOT match "unavailable", "canvas"
 */
export function matchesWithWordBoundary(value: string, pattern: string): boolean {
  if (!value || !pattern) return false;

  const valueLower = value.toLowerCase();
  const patternLower = pattern.toLowerCase();

  // Exact match
  if (valueLower === patternLower) return true;

  // Word boundary match: pattern must be preceded/followed by separator or string boundary
  // Separators: - _ (common in CSS class names)
  const regex = new RegExp(
    `(^|[-_])${escapeRegex(patternLower)}([-_]|$)`
  );
  return regex.test(valueLower);
}

/**
 * Check if any class in the list matches the pattern with word boundaries
 */
export function classListMatchesPattern(classList: string[], pattern: string): MatchResult {
  for (const className of classList) {
    if (matchesWithWordBoundary(className, pattern)) {
      const isExact = className.toLowerCase() === pattern.toLowerCase();
      return {
        matches: true,
        confidence: isExact ? 0.95 : 0.85,
        matchType: isExact ? 'exact' : 'word_boundary',
        evidence: [`class="${className}" matches pattern "${pattern}"`],
      };
    }
  }

  return {
    matches: false,
    confidence: 0,
    matchType: 'none',
    evidence: [],
  };
}

/**
 * Semantic HTML element matching
 */
const SEMANTIC_MAPPINGS: Record<string, { tags: string[]; roles: string[] }> = {
  button: {
    tags: ['button'],
    roles: ['button'],
  },
  link: {
    tags: ['a'],
    roles: ['link'],
  },
  input: {
    tags: ['input', 'textarea'],
    roles: ['textbox', 'searchbox'],
  },
  select: {
    tags: ['select'],
    roles: ['combobox', 'listbox'],
  },
  navigation: {
    tags: ['nav'],
    roles: ['navigation'],
  },
  form: {
    tags: ['form'],
    roles: ['form'],
  },
  heading: {
    tags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    roles: ['heading'],
  },
  image: {
    tags: ['img', 'picture'],
    roles: ['img'],
  },
  list: {
    tags: ['ul', 'ol'],
    roles: ['list'],
  },
};

/**
 * Check if element matches semantic HTML patterns
 */
export function matchesSemanticHTML(
  tagName: string,
  role: string | null,
  intent: string
): MatchResult {
  const mapping = SEMANTIC_MAPPINGS[intent.toLowerCase()];
  if (!mapping) {
    return { matches: false, confidence: 0, matchType: 'none', evidence: [] };
  }

  const tagLower = tagName.toLowerCase();
  const roleLower = role?.toLowerCase() || '';

  // Tag match
  if (mapping.tags.includes(tagLower)) {
    return {
      matches: true,
      confidence: 0.9,
      matchType: 'semantic',
      evidence: [`<${tagName}> is semantic ${intent}`],
    };
  }

  // Role match
  if (roleLower && mapping.roles.includes(roleLower)) {
    return {
      matches: true,
      confidence: 0.95,
      matchType: 'aria',
      evidence: [`role="${role}" indicates ${intent}`],
    };
  }

  return { matches: false, confidence: 0, matchType: 'none', evidence: [] };
}

/**
 * Check ARIA attributes for intent
 */
export function matchesAriaIntent(attributes: Record<string, string>, intent: string): MatchResult {
  const ariaLabel = attributes['aria-label']?.toLowerCase() || '';
  const title = attributes['title']?.toLowerCase() || '';

  const intentLower = intent.toLowerCase();
  const intentVariants = getIntentVariants(intentLower);

  for (const variant of intentVariants) {
    if (ariaLabel.includes(variant) || title.includes(variant)) {
      return {
        matches: true,
        confidence: 0.85,
        matchType: 'aria',
        evidence: [`aria-label or title contains "${variant}"`],
      };
    }
  }

  return { matches: false, confidence: 0, matchType: 'none', evidence: [] };
}

/**
 * Get intent variants for fuzzy matching
 */
function getIntentVariants(intent: string): string[] {
  const variants: Record<string, string[]> = {
    cta: ['cta', 'call to action', 'action'],
    button: ['button', 'btn'],
    nav: ['nav', 'navigation', 'menu'],
    form: ['form', 'input', 'field'],
    trust: ['trust', 'secure', 'safe', 'verified', 'certified'],
    cart: ['cart', 'basket', 'bag', 'add to cart', 'add to bag'],
    buy: ['buy', 'purchase', 'order', 'checkout'],
    signup: ['sign up', 'signup', 'register', 'create account', 'join'],
    login: ['log in', 'login', 'sign in', 'signin'],
  };

  return variants[intent] || [intent];
}

/**
 * Check text content for intent patterns
 */
export function matchesTextIntent(text: string, intent: string): MatchResult {
  if (!text) {
    return { matches: false, confidence: 0, matchType: 'none', evidence: [] };
  }

  const textLower = text.toLowerCase().trim();
  const intentVariants = getIntentVariants(intent.toLowerCase());

  // Word boundary matching for text
  for (const variant of intentVariants) {
    const regex = new RegExp(`\\b${escapeRegex(variant)}\\b`, 'i');
    if (regex.test(textLower)) {
      return {
        matches: true,
        confidence: 0.8,
        matchType: 'text',
        evidence: [`text "${text}" contains "${variant}"`],
      };
    }
  }

  return { matches: false, confidence: 0, matchType: 'none', evidence: [] };
}

/**
 * Check behavioral signals (onclick, href patterns)
 */
export function matchesBehavioralIntent(
  attributes: Record<string, string>,
  hasOnClick: boolean,
  intent: string
): MatchResult {
  const href = attributes['href'] || '';
  const dataAction = attributes['data-action'] || '';
  const type = attributes['type'] || '';

  // Button-like behavior
  if (intent === 'button' || intent === 'cta') {
    if (hasOnClick) {
      return {
        matches: true,
        confidence: 0.7,
        matchType: 'behavioral',
        evidence: ['has onclick handler'],
      };
    }
    if (type === 'submit' || type === 'button') {
      return {
        matches: true,
        confidence: 0.85,
        matchType: 'behavioral',
        evidence: [`type="${type}"`],
      };
    }
  }

  // Cart intent
  if (intent === 'cart' || intent === 'add_to_cart') {
    if (href.includes('cart') || dataAction.includes('cart')) {
      return {
        matches: true,
        confidence: 0.8,
        matchType: 'behavioral',
        evidence: ['href or data-action references cart'],
      };
    }
  }

  return { matches: false, confidence: 0, matchType: 'none', evidence: [] };
}

/**
 * Combined semantic matching - uses multiple strategies
 */
export function matchesSemantically(
  element: {
    tagName: string;
    classList: string[];
    id: string;
    attributes: Record<string, string>;
    text: string;
    hasOnClick: boolean;
  },
  intent: string
): MatchResult {
  const signals: MatchSignal[] = [];

  // 1. Semantic HTML (highest priority)
  const semanticResult = matchesSemanticHTML(
    element.tagName,
    element.attributes['role'] || null,
    intent
  );
  if (semanticResult.matches) {
    signals.push({
      type: semanticResult.matchType,
      confidence: semanticResult.confidence,
      evidence: semanticResult.evidence[0] ?? '',
    });
  }

  // 2. Class matching with word boundaries
  const classResult = classListMatchesPattern(element.classList, intent);
  if (classResult.matches) {
    signals.push({
      type: classResult.matchType,
      confidence: classResult.confidence,
      evidence: classResult.evidence[0] ?? '',
    });
  }

  // 3. ID matching with word boundaries
  if (element.id && matchesWithWordBoundary(element.id, intent)) {
    signals.push({
      type: 'word_boundary',
      confidence: 0.8,
      evidence: `id="${element.id}" matches pattern "${intent}"`,
    });
  }

  // 4. ARIA attributes
  const ariaResult = matchesAriaIntent(element.attributes, intent);
  if (ariaResult.matches) {
    signals.push({
      type: ariaResult.matchType,
      confidence: ariaResult.confidence,
      evidence: ariaResult.evidence[0] ?? '',
    });
  }

  // 5. Text content
  const textResult = matchesTextIntent(element.text, intent);
  if (textResult.matches) {
    signals.push({
      type: textResult.matchType,
      confidence: textResult.confidence,
      evidence: textResult.evidence[0] ?? '',
    });
  }

  // 6. Behavioral signals
  const behavioralResult = matchesBehavioralIntent(
    element.attributes,
    element.hasOnClick,
    intent
  );
  if (behavioralResult.matches) {
    signals.push({
      type: behavioralResult.matchType,
      confidence: behavioralResult.confidence,
      evidence: behavioralResult.evidence[0] ?? '',
    });
  }

  // Combine signals
  if (signals.length === 0) {
    return { matches: false, confidence: 0, matchType: 'none', evidence: [] };
  }

  // Use highest confidence signal as primary, boost if multiple signals agree
  signals.sort((a, b) => b.confidence - a.confidence);
  const primary = signals[0]!;

  // Boost confidence if multiple signals (max 0.99)
  const boost = Math.min(0.05 * (signals.length - 1), 0.1);
  const finalConfidence = Math.min(primary.confidence + boost, 0.99);

  return {
    matches: true,
    confidence: finalConfidence,
    matchType: primary.type,
    evidence: signals.map(s => s.evidence),
  };
}

/**
 * CRO-specific element classification using semantic matching
 */
export type CROType = 'cta' | 'form' | 'trust' | 'value_prop' | 'navigation' | 'price' | 'product_image' | 'variant_selector';

export interface CROClassification {
  type: CROType | null;
  confidence: number;
  evidence: string[];
}

/**
 * CRO patterns with semantic matching
 */
const CRO_PATTERNS: Record<CROType, {
  semantic: string[];
  classes: string[];
  text: string[];
  tags: string[];
  attributes: string[];
}> = {
  cta: {
    semantic: ['button'],
    classes: ['cta', 'btn', 'button', 'action'],
    text: ['buy', 'order', 'subscribe', 'sign up', 'get started', 'try', 'add to cart', 'add to bag', 'checkout'],
    tags: ['button'],
    attributes: ['data-cta', 'data-action'],
  },
  form: {
    semantic: ['form', 'input', 'select'],
    classes: ['form', 'field', 'input'],
    text: [],
    tags: ['form', 'input', 'select', 'textarea'],
    attributes: ['data-form'],
  },
  trust: {
    semantic: [],
    classes: ['trust', 'badge', 'testimonial', 'review', 'rating', 'guarantee', 'secure', 'certification'],
    text: ['trusted', 'verified', 'certified', 'secure', 'guarantee', 'money back', 'star', 'review'],
    tags: [],
    attributes: ['data-trust', 'data-rating'],
  },
  value_prop: {
    semantic: ['heading'],
    classes: ['hero', 'headline', 'tagline', 'value-prop', 'benefit', 'usp'],
    text: [],
    tags: ['h1', 'h2'],
    attributes: ['data-value-prop'],
  },
  navigation: {
    semantic: ['navigation'],
    classes: ['nav', 'menu', 'breadcrumb', 'header', 'footer', 'sidebar'],
    text: [],
    tags: ['nav'],
    attributes: ['data-nav'],
  },
  price: {
    semantic: [],
    classes: ['price', 'cost', 'amount', 'sale'],
    text: [],
    tags: [],
    attributes: ['data-price', 'itemprop="price"'],
  },
  product_image: {
    semantic: ['image'],
    classes: ['product-image', 'gallery', 'product-photo', 'main-image'],
    text: [],
    tags: ['img'],
    attributes: ['data-product-image'],
  },
  variant_selector: {
    semantic: ['select'],
    classes: ['variant', 'option', 'size', 'color', 'swatch'],
    text: ['size', 'color', 'quantity'],
    tags: ['select'],
    attributes: ['data-variant', 'data-option'],
  },
};

/**
 * Classify element for CRO purposes using semantic matching
 */
export function classifyCROElement(element: {
  tagName: string;
  classList: string[];
  id: string;
  attributes: Record<string, string>;
  text: string;
  hasOnClick: boolean;
}): CROClassification {
  let bestMatch: CROClassification = { type: null, confidence: 0, evidence: [] };

  for (const [croType, patterns] of Object.entries(CRO_PATTERNS) as [CROType, typeof CRO_PATTERNS[CROType]][]) {
    const signals: { confidence: number; evidence: string }[] = [];

    // Check semantic HTML
    for (const semantic of patterns.semantic) {
      const result = matchesSemanticHTML(element.tagName, element.attributes['role'] || null, semantic);
      if (result.matches) {
        signals.push({ confidence: result.confidence, evidence: result.evidence[0] ?? '' });
      }
    }

    // Check tag directly
    if (patterns.tags.includes(element.tagName.toLowerCase())) {
      signals.push({ confidence: 0.7, evidence: `<${element.tagName}> tag` });
    }

    // Check classes with word boundary
    for (const pattern of patterns.classes) {
      const result = classListMatchesPattern(element.classList, pattern);
      if (result.matches) {
        signals.push({ confidence: result.confidence, evidence: result.evidence[0] ?? '' });
      }
    }

    // Check text patterns
    for (const textPattern of patterns.text) {
      const result = matchesTextIntent(element.text, textPattern);
      if (result.matches) {
        signals.push({ confidence: result.confidence, evidence: result.evidence[0] ?? '' });
      }
    }

    // Check attributes
    for (const attr of patterns.attributes) {
      if (attr.includes('=')) {
        const [name, value] = attr.split('=');
        if (name && value && element.attributes[name]?.includes(value.replace(/"/g, ''))) {
          signals.push({ confidence: 0.9, evidence: `${attr} attribute present` });
        }
      } else if (element.attributes[attr]) {
        signals.push({ confidence: 0.9, evidence: `${attr} attribute present` });
      }
    }

    if (signals.length > 0) {
      // Calculate combined confidence
      const maxConfidence = Math.max(...signals.map(s => s.confidence));
      const boost = Math.min(0.05 * (signals.length - 1), 0.1);
      const finalConfidence = Math.min(maxConfidence + boost, 0.99);

      if (finalConfidence > bestMatch.confidence) {
        bestMatch = {
          type: croType,
          confidence: finalConfidence,
          evidence: signals.map(s => s.evidence),
        };
      }
    }
  }

  return bestMatch.confidence >= 0.5 ? bestMatch : { type: null, confidence: 0, evidence: [] };
}
