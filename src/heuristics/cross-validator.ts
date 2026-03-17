/**
 * DOM Cross-Validator - Phase 27G (T633)
 *
 * Validates LLM evaluations against DOM evidence.
 * When the LLM claims something is absent but the DOM shows it exists,
 * the evaluation's confidence is downgraded.
 */

import type { ViewportSnapshot } from '../models/index.js';
import type { HeuristicEvaluation } from './vision/types.js';
import type { ElementBox } from '../browser/dom/coordinate-mapper.js';

/**
 * Contradiction found between LLM claim and DOM evidence
 */
export interface CrossValidationFlag {
  /** The evaluation that was contradicted */
  heuristicId: string;
  /** What the LLM claimed */
  claim: string;
  /** What the DOM evidence shows */
  domEvidence: string;
  /** Original confidence before downgrade */
  originalConfidence: number;
  /** New confidence after downgrade */
  newConfidence: number;
}

/**
 * Result of cross-validation
 */
export interface CrossValidationResult {
  /** Total evaluations checked */
  totalChecked: number;
  /** Number of contradictions found */
  contradictionCount: number;
  /** Details of each contradiction */
  flags: CrossValidationFlag[];
}

/**
 * Mapping of heuristic ID prefixes to CRO types they reference.
 * When a heuristic in these categories claims something is missing/absent,
 * we check the DOM for elements of the corresponding croType.
 */
const HEURISTIC_CRO_TYPE_MAP: Record<string, string> = {
  'PDP-PRICE': 'price',
  'PDP-CTA': 'cta',
  'PDP-IMAGE': 'image',
  'PDP-REVIEW': 'review',
  'PDP-SELECT': 'variant',
  'PLP-CTA': 'cta',
  'PLP-PRICE': 'price',
  'PLP-GRID': 'image',
};

/** Phrases that indicate the LLM claims something is absent/missing */
const ABSENCE_PATTERNS = [
  /\bno\s+(?:visible|clear|obvious|prominent)?\s*(?:price|cta|button|image|review|rating|variant|selector)/i,
  /\bnot\s+(?:found|present|visible|displayed|shown|available)/i,
  /\babsent\b/i,
  /\bmissing\b/i,
  /\bcannot\s+(?:find|see|locate|identify)/i,
  /\bnowhere\b/i,
];

/** Confidence penalty multiplier when DOM contradicts LLM claim */
const CONTRADICTION_PENALTY = 0.5;

/**
 * Cross-validate LLM evaluations against DOM evidence from snapshots.
 *
 * Checks for contradictions where the LLM claims an element type is
 * absent but the DOM contains elements of that type.
 *
 * @param evaluations - LLM evaluation results to validate
 * @param snapshots - Viewport snapshots with DOM and layout data
 * @returns Validation result with any contradictions found
 */
export function crossValidateEvaluations(
  evaluations: HeuristicEvaluation[],
  snapshots: ViewportSnapshot[]
): CrossValidationResult {
  const flags: CrossValidationFlag[] = [];

  // Collect all CRO types found in DOM across all viewports
  const domCroTypes = collectDOMCroTypes(snapshots);

  for (const eval_ of evaluations) {
    // Only check fail/not_applicable evaluations that claim absence
    if (eval_.status !== 'fail' && eval_.status !== 'not_applicable') {
      continue;
    }

    // Get the CRO type this heuristic relates to
    const prefix = eval_.heuristicId.split('-').slice(0, 2).join('-');
    const expectedCroType = HEURISTIC_CRO_TYPE_MAP[prefix];
    if (!expectedCroType) continue;

    // Check if the LLM text claims absence
    const textToCheck = [eval_.observation, eval_.issue, eval_.reasoning]
      .filter(Boolean)
      .join(' ');

    const claimsAbsence = ABSENCE_PATTERNS.some(pattern => pattern.test(textToCheck));
    if (!claimsAbsence) continue;

    // Check if DOM actually has elements of this type
    const domCount = domCroTypes.get(expectedCroType) ?? 0;
    if (domCount > 0) {
      // Contradiction: LLM says absent, DOM has it
      const originalConfidence = eval_.confidence;
      const newConfidence = parseFloat((Math.max(0, originalConfidence * CONTRADICTION_PENALTY)).toFixed(2));

      flags.push({
        heuristicId: eval_.heuristicId,
        claim: `Claims ${expectedCroType} element is absent/missing`,
        domEvidence: `DOM contains ${domCount} element(s) with croType="${expectedCroType}"`,
        originalConfidence,
        newConfidence,
      });

      // Apply the downgrade
      eval_.confidence = newConfidence;
    }
  }

  return {
    totalChecked: evaluations.length,
    contradictionCount: flags.length,
    flags,
  };
}

/**
 * Collect all CRO element types found across all viewport snapshots.
 * Uses layoutBoxes (Phase 25g) which contain croType classifications.
 */
function collectDOMCroTypes(snapshots: ViewportSnapshot[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const snapshot of snapshots) {
    if (!snapshot.layoutBoxes) continue;
    for (const box of snapshot.layoutBoxes as ElementBox[]) {
      if (box.croType) {
        counts.set(box.croType, (counts.get(box.croType) ?? 0) + 1);
      }
    }
  }

  return counts;
}
