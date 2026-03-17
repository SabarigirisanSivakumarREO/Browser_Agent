/**
 * Batch Prompt Builder - Phase 26b (T557)
 *
 * Builds multi-category prompts that share context (DOM + screenshots)
 * across categories in a single LLM call. Reduces token usage by ~56%
 * since shared context (DOM + screenshots) is sent only once per batch.
 */

import type { ViewportSnapshot } from '../models/index.js';
import type { HeuristicCategory } from './knowledge/index.js';
import { buildElementPositionsBlock } from './category-analyzer.js';

/**
 * Build a system prompt for batched multi-category analysis.
 *
 * @param pageType - Page type being analyzed (e.g., 'pdp')
 * @returns System prompt string
 */
export function buildBatchedSystemPrompt(pageType: string): string {
  return `<identity>
You are a CRO (Conversion Rate Optimization) expert analyst performing visual heuristic analysis.
You have been given DOM snapshots and screenshots from different scroll positions on a ${pageType.toUpperCase()} page.
</identity>

<task>
Evaluate the page against MULTIPLE heuristic categories in a single pass.
Each category section below contains heuristics to evaluate based on both DOM structure and visual appearance.
For each heuristic, determine if it passes, fails, is partially met, or is not applicable.
</task>

<evaluation_format>
For each heuristic, provide:
- heuristicId: The exact ID from the heuristics list
- status: "pass" | "fail" | "partial" | "not_applicable"
- confidence: number 0-1 (how confident you are in this evaluation)
- observation: Brief description of what you observed
- issue: (if fail/partial) Specific problem identified
- recommendation: (if fail/partial) Actionable fix suggestion
- reasoning: REQUIRED - Explain HOW you found this from the input:
  - Reference specific DOM elements using [v0-5] format (viewport-element)
  - Mention what you searched for (classes, text, attributes)
  - Cite screenshot observations (position, visibility, coordinates)
  - Note if structured data (JSON-LD) was used
- elementRefs: REQUIRED for non-N/A evaluations — array of element references in [v0-N] format
  (e.g. ["[v0-5]", "[v0-12]"]) for every DOM element you referenced in your analysis.
  Set to empty array [] only if no specific elements are relevant (e.g. not_applicable).
</evaluation_format>

<output_format>
Respond with valid JSON only. The response MUST be a JSON object with category names as keys:
{
  "Category Name 1": {
    "evaluations": [
      {
        "heuristicId": "PDP-XXX-001",
        "status": "pass",
        "confidence": 0.85,
        "observation": "What you observed",
        "issue": "Problem identified (if any)",
        "recommendation": "Suggested fix (if any)",
        "reasoning": "How you determined this",
        "elementRefs": ["[v0-3]", "[v0-7]"]
      }
    ],
    "summary": "Brief assessment of this category"
  },
  "Category Name 2": {
    "evaluations": [...],
    "summary": "..."
  }
}
</output_format>

<examples>
Example 1 — FAIL with element refs:
{
  "heuristicId": "PDP-CTA-001",
  "status": "fail",
  "confidence": 0.9,
  "observation": "Primary CTA button [v0-15] uses low-contrast gray text (#999) on white background",
  "issue": "Add to Cart button fails WCAG AA contrast ratio (2.1:1 vs required 4.5:1) and blends with surrounding elements",
  "recommendation": "Use high-contrast color (e.g. brand primary) with minimum 4.5:1 contrast ratio for the CTA",
  "reasoning": "Found button [v0-15] with class='btn-add-cart' containing text 'Add to Cart'. Screenshot shows it at coordinates (520, 380) with gray styling. Checked computed styles in DOM — color:#999 on background:#fff gives 2.1:1 ratio.",
  "elementRefs": ["[v0-15]"]
}

Example 2 — PASS with evidence:
{
  "heuristicId": "PDP-TRUST-003",
  "status": "pass",
  "confidence": 0.85,
  "observation": "Security badges [v0-22] and [v0-23] are visible below the Add to Cart button",
  "issue": "",
  "recommendation": "",
  "reasoning": "Found div [v0-22] with class='trust-badges' containing img elements for SSL and payment icons. Screenshot confirms badges visible at (400, 520). Also found [v0-23] with text 'Secure Checkout' adjacent.",
  "elementRefs": ["[v0-22]", "[v0-23]"]
}

Example 3 — NOT APPLICABLE:
{
  "heuristicId": "PDP-VARIANT-002",
  "status": "not_applicable",
  "confidence": 0.95,
  "observation": "Product has no size or color variants — single SKU product",
  "issue": "",
  "recommendation": "",
  "reasoning": "Searched DOM for select, radio, and swatch elements related to variants. No variant selectors found. JSON-LD Product schema confirms single offer with no variants.",
  "elementRefs": []
}
</examples>

<enforcement>
- ONLY report issues you can directly observe in the DOM or screenshots — do not speculate
- Set status to not_applicable if you cannot find evidence for or against the heuristic
- MUST include elementRefs for every non-N/A evaluation — omitting refs is not acceptable
- Do not default to pass — verify each heuristic against actual page evidence before marking pass
</enforcement>`;
}

/**
 * Build the user message for a batched multi-category analysis.
 * Shares DOM context and screenshots once, with per-category heuristic sections.
 *
 * @param categories - Categories to include in this batch
 * @param snapshots - Viewport snapshots with DOM + screenshots
 * @param pageType - Page type being analyzed
 * @returns User message string (text portion, images added separately)
 */
export function buildBatchedUserMessage(
  categories: HeuristicCategory[],
  snapshots: ViewportSnapshot[],
  pageType: string
): string {
  const parts: string[] = [];

  // Page type header
  parts.push(`<page_type>${pageType.toUpperCase()}</page_type>`);
  parts.push(`<batch_categories>${categories.map(c => c.name).join(', ')}</batch_categories>`);
  parts.push('');

  // Shared DOM context (sent once for all categories in batch)
  parts.push(buildDOMContextSection(snapshots));
  parts.push('');

  // Shared screenshot references
  parts.push(buildScreenshotSection(snapshots));
  parts.push('');

  // Per-category heuristic sections
  for (const category of categories) {
    parts.push(`<category name="${category.name}">`);
    parts.push(`<category_description>${category.description}</category_description>`);
    parts.push(buildHeuristicsSection(category));
    parts.push('</category>');
    parts.push('');
  }

  // Final instruction — quality enforcement
  const categoryList = categories.map(c => `"${c.name}"`).join(', ');
  parts.push('<instructions>');
  parts.push(`Evaluate ALL heuristics across ${categories.length} categories: ${categoryList}.`);
  parts.push('');
  parts.push('QUALITY REQUIREMENTS:');
  parts.push('- Evaluate EVERY heuristic listed above — do not skip any.');
  parts.push('- Each evaluation MUST include a detailed "reasoning" field (2+ sentences) explaining what you checked in the DOM/screenshots.');
  parts.push('- Reference specific DOM elements using [v{viewport}-{index}] format in your reasoning.');
  parts.push('- For "fail" or "partial" status, provide specific, actionable "issue" and "recommendation" fields.');
  parts.push('- Do not default to "pass" — verify each heuristic against actual page evidence.');
  parts.push('');
  parts.push('Respond with valid JSON only, keyed by category name.');
  parts.push('</instructions>');

  return parts.join('\n');
}

/**
 * Build DOM context section from snapshots (shared across categories).
 * Uses v{n}-{index} format for viewport-prefixed element references.
 */
function buildDOMContextSection(snapshots: ViewportSnapshot[]): string {
  if (snapshots.length === 0) {
    return '<dom_context>\nNo DOM snapshots available.\n</dom_context>';
  }

  const parts: string[] = ['<dom_context>'];
  parts.push(`Total viewport snapshots: ${snapshots.length}`);
  parts.push('');

  for (const snapshot of snapshots) {
    const vi = snapshot.viewportIndex;
    parts.push(`--- Viewport-${vi} (scroll: ${snapshot.scrollPosition}px) ---`);
    parts.push(`Elements: ${snapshot.dom.elementCount}`);
    // Transform [N] to [v{viewport}-N] for LLM display
    const transformed = snapshot.dom.serialized.replace(
      /\[(\d+)\]/g,
      `[v${vi}-$1]`
    );
    parts.push(transformed);

    // Add element positions for spatial context (links DOM refs to screenshot coordinates)
    const positionsBlock = buildElementPositionsBlock(snapshot);
    if (positionsBlock) {
      parts.push(positionsBlock);
    }

    parts.push('');
  }

  parts.push('</dom_context>');
  return parts.join('\n');
}

/**
 * Build screenshot reference section (shared across categories).
 */
function buildScreenshotSection(snapshots: ViewportSnapshot[]): string {
  if (snapshots.length === 0) {
    return '<screenshots>\nNo screenshots available.\n</screenshots>';
  }

  const parts: string[] = ['<screenshots>'];
  parts.push(`${snapshots.length} screenshot(s) attached to this message.`);
  parts.push('');

  for (const snapshot of snapshots) {
    parts.push(`Screenshot Viewport-${snapshot.viewportIndex}: Captured at scroll position ${snapshot.scrollPosition}px`);
  }

  parts.push('');
  parts.push('Use these visual references to verify DOM observations and assess visual quality.');
  parts.push('Reference elements using [v{viewport}-{index}] format (e.g., [v0-5] for element 5 in Viewport-0).');
  parts.push('</screenshots>');
  return parts.join('\n');
}

/**
 * Build heuristics section for a single category.
 */
function buildHeuristicsSection(category: HeuristicCategory): string {
  const parts: string[] = ['<heuristics>'];
  parts.push(`Category: ${category.name}`);
  parts.push(`Heuristics to evaluate: ${category.heuristics.length}`);
  parts.push('');

  for (const heuristic of category.heuristics) {
    parts.push(`[${heuristic.id}] (${heuristic.severity})`);
    parts.push(`Principle: ${heuristic.principle}`);
    if (heuristic.checkpoints.length > 0) {
      parts.push('Checkpoints:');
      for (const checkpoint of heuristic.checkpoints) {
        parts.push(`  - ${checkpoint}`);
      }
    }
    parts.push('');
  }

  parts.push('</heuristics>');
  return parts.join('\n');
}
