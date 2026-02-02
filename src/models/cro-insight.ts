/**
 * CRO Insight Models
 *
 * Defines interfaces and Zod schemas for CRO analysis insights.
 */

import { z } from 'zod';

/**
 * Severity levels for CRO insights
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Reference to a DOM element with identifying information
 * (Imported from vision types for Evidence interface)
 */
export interface DOMElementRef {
  /** Index of the element in the DOM tree (as shown in serialized format [0], [1], etc.) */
  index: number;
  /** CSS selector for the element (if available) */
  selector?: string;
  /** XPath for the element (if available) */
  xpath?: string;
  /** Element type (tag name or CRO type like 'cta', 'form', etc.) */
  elementType: string;
  /** Text content of the element (truncated if long) */
  textContent?: string;
}

/**
 * Bounding box coordinates for an element in the screenshot
 * (Imported from vision types for Evidence interface)
 */
export interface BoundingBox {
  /** X coordinate (left edge) in pixels */
  x: number;
  /** Y coordinate (top edge) in pixels */
  y: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Which viewport snapshot this bounding box is relative to */
  viewportIndex: number;
}

/**
 * Evidence supporting the insight
 */
export interface Evidence {
  text?: string;                       // Element text or context
  screenshot?: string;                 // Base64 or file path (future)
  styles?: Record<string, string>;     // Relevant CSS
  selector?: string;                   // CSS selector for element

  // Phase 21h: Evidence Capture Fields
  /** Which viewport snapshot the evaluation came from (0-indexed) */
  viewportIndex?: number;
  /** Timestamp when evaluation was made (epoch milliseconds) */
  timestamp?: number;
  /** References to DOM elements mentioned in the evaluation */
  domElementRefs?: DOMElementRef[];
  /** Bounding box of the primary element related to this evaluation */
  boundingBox?: BoundingBox;
}

/**
 * CRO insight categories
 */
export type InsightCategory =
  | 'cta'
  | 'form'
  | 'trust'
  | 'value_prop'
  | 'navigation'
  | 'friction'
  | 'heuristic';

/**
 * Single CRO insight
 */
export interface CROInsight {
  id: string;                          // Unique ID (uuid or incremental)
  category: InsightCategory;
  type: string;                        // Specific issue type (e.g., "vague_cta_text")
  severity: Severity;
  element: string;                     // XPath
  issue: string;                       // Human-readable issue description
  recommendation: string;              // Actionable fix
  evidence?: Evidence;
  heuristicId?: string;                // If from heuristic rule (H001, H002, etc.)
  confidence?: number;                 // 0-1, if LLM-generated
}

/**
 * Zod schema for DOMElementRef validation
 */
export const DOMElementRefSchema = z.object({
  index: z.number(),
  selector: z.string().optional(),
  xpath: z.string().optional(),
  elementType: z.string(),
  textContent: z.string().optional(),
});

/**
 * Zod schema for BoundingBox validation
 */
export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  viewportIndex: z.number(),
});

/**
 * Zod schema for Evidence validation
 */
export const EvidenceSchema = z.object({
  text: z.string().optional(),
  screenshot: z.string().optional(),
  styles: z.record(z.string(), z.string()).optional(),
  selector: z.string().optional(),
  // Phase 21h: Evidence Capture Fields
  viewportIndex: z.number().optional(),
  timestamp: z.number().optional(),
  domElementRefs: z.array(DOMElementRefSchema).optional(),
  boundingBox: BoundingBoxSchema.optional(),
});

/**
 * Zod schema for CROInsight validation
 */
export const CROInsightSchema = z.object({
  id: z.string(),
  category: z.enum(['cta', 'form', 'trust', 'value_prop', 'navigation', 'friction', 'heuristic']),
  type: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  element: z.string(),
  issue: z.string().min(10, 'Issue must be at least 10 characters'),
  recommendation: z.string().min(10, 'Recommendation must be at least 10 characters'),
  evidence: EvidenceSchema.optional(),
  heuristicId: z.string().optional(),
  confidence: z.number().min(0, 'Confidence must be >= 0').max(1, 'Confidence must be <= 1').optional(),
});

/**
 * Type inference from Zod schema (for runtime validation)
 */
export type CROInsightValidated = z.infer<typeof CROInsightSchema>;
