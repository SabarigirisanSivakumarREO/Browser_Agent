/**
 * DOM Tree Models for CRO Agent
 *
 * Defines interfaces for DOM extraction and CRO element classification.
 */

/**
 * Reusable bounding box type for element positioning
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * CRO element classification types
 * - cta: Call-to-action buttons/links
 * - form: Form elements and inputs
 * - trust: Trust signals (badges, testimonials, security icons)
 * - value_prop: Value proposition elements
 * - navigation: Navigation elements
 * - price: Product pricing elements (Phase 25b)
 * - variant: Product variant selectors (size, color) (Phase 25b)
 * - stock: Stock/availability indicators (Phase 25b)
 * - shipping: Shipping/delivery information (Phase 25b)
 * - gallery: Product image galleries (Phase 25b)
 * - null: Not a CRO-relevant element
 */
export type CROType = 'cta' | 'form' | 'trust' | 'value_prop' | 'navigation' | 'price' | 'variant' | 'stock' | 'shipping' | 'gallery' | null;

/**
 * Classification metadata for debugging and confidence tracking
 */
export interface CROClassification {
  type: Exclude<CROType, null>;
  confidence: number;        // 0-1 score
  matchedSelector: string;   // Which selector matched
}

/**
 * Single DOM node representation
 */
export interface DOMNode {
  tagName: string;
  xpath: string;
  index?: number;                        // Only for visible CRO elements
  text: string;                          // Truncated to 100 chars (CR-015)
  isInteractive: boolean;
  isVisible: boolean;
  croType: CROType;
  croClassification?: CROClassification; // Only if croType !== null
  boundingBox?: BoundingBox;             // Only if visible
  attributes?: Record<string, string>;   // Relevant attrs (class, id, role, href)
  children: DOMNode[];
}

/**
 * Structured product data from JSON-LD (Phase 25c)
 */
export interface StructuredProductData {
  name?: string;
  price?: number;
  currency?: string;
  availability?: string;
  rating?: number;
  reviewCount?: number;
  brand?: string;
  sku?: string;
  image?: string;
}

/**
 * Node index entry for quick lookups (Phase 25g)
 */
export interface NodeIndexEntry {
  tag: string;
  croType?: Exclude<CROType, null>;
  confidence?: number;
  index?: number;  // Element index if indexed
  matchedPatterns?: string[];  // Phase 25g: Patterns that matched for CRO classification
}

/**
 * Full DOM tree structure
 */
export interface DOMTree {
  root: DOMNode;
  interactiveCount: number;
  croElementCount: number;
  totalNodeCount: number;    // For debugging
  extractedAt: number;       // Timestamp
  structuredData?: StructuredProductData | null;  // JSON-LD Product schema (Phase 25c)
  elementLookup?: Record<string, NodeIndexEntry>;  // Quick lookup by String(element.index)
}
