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
 * Evidence supporting the insight
 */
export interface Evidence {
  text?: string;                       // Element text or context
  screenshot?: string;                 // Base64 or file path (future)
  styles?: Record<string, string>;     // Relevant CSS
  selector?: string;                   // CSS selector for element
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
 * Zod schema for Evidence validation
 */
export const EvidenceSchema = z.object({
  text: z.string().optional(),
  screenshot: z.string().optional(),
  styles: z.record(z.string(), z.string()).optional(),
  selector: z.string().optional(),
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
