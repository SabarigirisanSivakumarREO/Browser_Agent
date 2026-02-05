/**
 * Vision Prompt Builder - Phase 21c (T308)
 *
 * Builds prompts for GPT-4o Vision analysis with heuristics context.
 */

import type { ViewportInfo } from '../../models/page-state.js';
import type { PageTypeHeuristics, HeuristicCategory } from '../knowledge/index.js';

/**
 * Build the system prompt for CRO vision analysis
 */
export function buildSystemPrompt(): string {
  return `You are a CRO (Conversion Rate Optimization) expert specializing in ecommerce UX analysis based on Baymard Institute research.

Your task is to analyze page screenshots against specific UX heuristics and provide structured evaluations.

Guidelines:
- Be specific in observations - reference what you actually see in the screenshot
- Focus on user experience impact, not technical implementation
- "partial" status = some checkpoints met but not all
- "not_applicable" = cannot evaluate (e.g., no variants shown, no reviews section)
- Confidence: 0.9+ for clear cases, 0.7-0.9 when interpretation needed, <0.7 when uncertain
- Provide actionable recommendations that can be implemented by a design/dev team`;
}

/**
 * Build the main user prompt with heuristics context
 */
export function buildVisionPrompt(
  heuristics: PageTypeHeuristics,
  viewport: ViewportInfo
): string {
  const pageTypeName = heuristics.pageType.toUpperCase();
  const deviceType = viewport.isMobile ? 'Mobile' : 'Desktop';

  // Build heuristics section
  const heuristicsSection = buildHeuristicsSection(heuristics.categories);

  return `## Analysis Context

- **Page Type**: ${pageTypeName} (Product Detail Page)
- **Viewport**: ${viewport.width}x${viewport.height}px
- **Device**: ${deviceType}
- **Above Fold**: Content visible without scrolling (top ${viewport.height}px)

## Heuristics to Evaluate

${heuristicsSection}

## Task

Analyze the screenshot and evaluate EACH heuristic listed above. Return a JSON object with evaluations:

\`\`\`json
{
  "evaluations": [
    {
      "heuristicId": "PDP-LAYOUT-001",
      "status": "pass",
      "observation": "Page has clear vertical flow with product image on left, details on right",
      "reasoning": "Identified layout from screenshot: gallery container [v0-3] on left (x:0-640px), product details [v0-8] on right (x:640-1280px). DOM shows class='product-layout--two-column'.",
      "confidence": 0.95
    },
    {
      "heuristicId": "PDP-PRICE-001",
      "status": "fail",
      "observation": "Price is not visible in the screenshot without scrolling",
      "issue": "Price requires scrolling to view, not immediately visible above the fold",
      "recommendation": "Move price to be visible alongside product title in the hero section",
      "reasoning": "Searched DOM for price elements - found [v1-12] with class='price' at scroll position 850px. Not present in Viewport-0 (above fold). Screenshot confirms no price visible in first viewport.",
      "confidence": 0.92
    },
    {
      "heuristicId": "PDP-REVIEW-003",
      "status": "partial",
      "observation": "Reviews are visible but no filtering options shown",
      "issue": "Users cannot filter reviews by rating or relevance",
      "recommendation": "Add review filtering controls (by rating, date, verified purchase)",
      "reasoning": "Found reviews section [v0-25] with 5 review items. Searched for filter/sort controls - no elements with class containing 'filter', 'sort', or role='listbox' in reviews area.",
      "confidence": 0.85
    },
    {
      "heuristicId": "PDP-SELECT-002",
      "status": "not_applicable",
      "observation": "No variant selection visible - may be single variant product",
      "reasoning": "Searched DOM for variant selectors: no swatch, size-selector, color-option classes found. Structured data shows single SKU. Screenshot shows no selection UI.",
      "confidence": 0.80
    }
  ]
}
\`\`\`

## Response Requirements

1. Evaluate ALL ${heuristics.totalCount} heuristics
2. Include heuristicId exactly as shown (e.g., "PDP-PRICE-001")
3. Status must be: "pass", "fail", "partial", or "not_applicable"
4. Always include observation field with what you see
5. For "fail" and "partial" status, include issue and recommendation
6. **Always include reasoning** - explain HOW you found this:
   - Reference specific DOM elements using [v0-5] format
   - Mention what you searched for (classes, text, attributes)
   - Cite screenshot observations (position, visibility)
   - Note if structured data (JSON-LD) was used
7. Confidence between 0.0 and 1.0

Return ONLY the JSON object, no additional text.`;
}

/**
 * Build the heuristics section of the prompt
 */
function buildHeuristicsSection(categories: HeuristicCategory[]): string {
  return categories
    .map((category) => {
      const categoryHeader = `### ${category.name}\n${category.description}\n`;

      const heuristicsList = category.heuristics
        .map((h) => {
          const severityBadge = `[${h.severity.toUpperCase()}]`;
          const checkpoints = h.checkpoints.map((c) => `  - ${c}`).join('\n');

          return `**${h.id}** ${severityBadge}
> ${h.principle}

Checkpoints:
${checkpoints}`;
        })
        .join('\n\n');

      return `${categoryHeader}\n${heuristicsList}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Build a minimal prompt for testing (fewer tokens)
 */
export function buildMinimalPrompt(
  heuristics: PageTypeHeuristics,
  viewport: ViewportInfo
): string {
  const heuristicIds = heuristics.categories.flatMap((c) =>
    c.heuristics.map((h) => `${h.id}: ${h.principle}`)
  );

  return `Analyze this ${heuristics.pageType.toUpperCase()} page screenshot (${viewport.width}x${viewport.height}px, ${viewport.isMobile ? 'mobile' : 'desktop'}).

Evaluate these heuristics:
${heuristicIds.join('\n')}

Return JSON: {"evaluations": [{"heuristicId": "...", "status": "pass|fail|partial|not_applicable", "observation": "...", "issue?": "...", "recommendation?": "...", "confidence": 0.0-1.0}]}`;
}

/**
 * Estimate token count for a prompt (rough approximation)
 * ~4 chars per token on average
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
