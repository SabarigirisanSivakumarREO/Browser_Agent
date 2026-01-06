/**
 * CRO Vision Analyzer Types - Phase 21c (T307)
 *
 * Types for GPT-4o Vision-based CRO heuristic analysis.
 */

import type { PageType } from '../../models/index.js';
import type { CROInsight, Severity, InsightCategory } from '../../models/cro-insight.js';
import type { ViewportInfo } from '../../models/page-state.js';

/**
 * Evaluation status for a heuristic
 */
export type EvaluationStatus = 'pass' | 'fail' | 'partial' | 'not_applicable';

/**
 * Configuration for CRO Vision Analyzer
 */
export interface CROVisionAnalyzerConfig {
  /** Vision model to use */
  model: 'gpt-4o' | 'gpt-4o-mini';
  /** Max tokens for response */
  maxTokens: number;
  /** Temperature for response (0.0-1.0) */
  temperature: number;
  /** Whether to include detailed observations */
  includeObservations: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_VISION_CONFIG: CROVisionAnalyzerConfig = {
  model: 'gpt-4o',
  maxTokens: 4096,
  temperature: 0.1,
  includeObservations: true,
};

/**
 * Evaluation result for a single heuristic
 */
export interface HeuristicEvaluation {
  /** Heuristic ID: PDP-PRICE-001 */
  heuristicId: string;
  /** Original principle text */
  principle: string;
  /** Evaluation status */
  status: EvaluationStatus;
  /** Issue severity from heuristic definition */
  severity: Severity;
  /** What the LLM observed in the screenshot */
  observation: string;
  /** If failed/partial, what's wrong */
  issue?: string;
  /** How to fix the issue */
  recommendation?: string;
  /** Confidence score 0-1 */
  confidence: number;
}

/**
 * Summary statistics for vision analysis
 */
export interface VisionAnalysisSummary {
  /** Total heuristics evaluated */
  totalHeuristics: number;
  /** Count of passed heuristics */
  passed: number;
  /** Count of failed heuristics */
  failed: number;
  /** Count of partially met heuristics */
  partial: number;
  /** Count of not applicable heuristics */
  notApplicable: number;
  /** Failed counts by severity */
  bySeverity: Record<Severity, number>;
}

/**
 * Complete vision analysis result
 */
export interface CROVisionAnalysisResult {
  /** Page type analyzed */
  pageType: PageType;
  /** Timestamp of analysis */
  analyzedAt: number;
  /** Whether screenshot was used */
  screenshotUsed: boolean;
  /** Viewport info used for analysis */
  viewport: ViewportInfo;
  /** Per-heuristic evaluations */
  evaluations: HeuristicEvaluation[];
  /** Transformed CROInsights for compatibility */
  insights: CROInsight[];
  /** Summary statistics */
  summary: VisionAnalysisSummary;
}

/**
 * Raw evaluation from LLM response (before transformation)
 */
export interface RawLLMEvaluation {
  heuristicId: string;
  status: string;
  observation: string;
  issue?: string;
  recommendation?: string;
  confidence: number;
}

/**
 * Expected LLM response structure
 */
export interface LLMVisionResponse {
  evaluations: RawLLMEvaluation[];
}

/**
 * Map heuristic ID prefix to InsightCategory
 */
export const HEURISTIC_TO_CATEGORY: Record<string, InsightCategory> = {
  'PDP-LAYOUT': 'friction',
  'PDP-IMAGE': 'value_prop',
  'PDP-PRICE': 'trust',
  'PDP-DESC': 'value_prop',
  'PDP-SPEC': 'value_prop',
  'PDP-REVIEW': 'trust',
  'PDP-SELECT': 'form',
  'PDP-CTA': 'cta',
  'PDP-MOBILE': 'friction',
  'PDP-UTILITY': 'navigation',
};

/**
 * Get InsightCategory from heuristic ID
 */
export function getInsightCategory(heuristicId: string): InsightCategory {
  // Extract prefix: PDP-LAYOUT-001 -> PDP-LAYOUT
  const prefix = heuristicId.split('-').slice(0, 2).join('-');
  return HEURISTIC_TO_CATEGORY[prefix] ?? 'heuristic';
}
