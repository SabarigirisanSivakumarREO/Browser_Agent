/**
 * Vision Prompt Builder - Phase 21g (T343) + Phase 21i (T371)
 *
 * Builds prompts for the vision agent with DOM context, heuristics,
 * and current state information.
 *
 * Phase 21i adds coordinate-aware DOM context formatting for visual analysis.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { PageType } from '../../models/index.js';
import type { VisionAgentState, HeuristicDefinition, ViewportSnapshot } from './types.js';
import type { VisionToolRegistry } from './tools/index.js';
import type { ElementMapping } from '../../browser/dom/coordinate-mapper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load the system prompt template
 */
function loadSystemPromptTemplate(): string {
  const promptPath = join(__dirname, '../../prompts/system-vision-agent.md');
  return readFileSync(promptPath, 'utf-8');
}

/**
 * Vision Prompt Builder class
 */
export class VisionPromptBuilder {
  private systemPromptTemplate: string;
  private toolRegistry: VisionToolRegistry;

  constructor(toolRegistry: VisionToolRegistry) {
    this.systemPromptTemplate = loadSystemPromptTemplate();
    this.toolRegistry = toolRegistry;
  }

  /**
   * Build the system prompt with tools injected
   */
  buildSystemPrompt(): string {
    // Format tools for the prompt
    const toolsText = this.toolRegistry.tools
      .map(tool => {
        const params = JSON.stringify(tool.parameters, null, 2);
        return `**${tool.name}**\n${tool.description}\nParameters:\n\`\`\`json\n${params}\n\`\`\``;
      })
      .join('\n\n');

    return this.systemPromptTemplate.replace('{{TOOLS_PLACEHOLDER}}', toolsText);
  }

  /**
   * Build user prompt with current context
   */
  buildUserPrompt(
    state: VisionAgentState,
    _pageType: PageType,
    heuristicDefinitions: Map<string, HeuristicDefinition>,
    latestSnapshot?: ViewportSnapshot
  ): string {
    const parts: string[] = [];

    // Current state section
    parts.push(this.formatCurrentState(state));

    // DOM context section (if we have a snapshot)
    if (latestSnapshot) {
      parts.push(this.formatDOMContext(latestSnapshot, state.viewport.height));
    }

    // Pending heuristics section
    parts.push(this.formatPendingHeuristics(state, heuristicDefinitions));

    // Instructions
    parts.push(this.formatInstructions(state, latestSnapshot));

    return parts.join('\n\n');
  }

  /**
   * Format current state information
   */
  private formatCurrentState(state: VisionAgentState): string {
    const scrollPercent = this.calculateScrollPercent(state);
    const coveragePercent = this.calculateCoveragePercent(state);
    const evaluated = state.evaluatedHeuristicIds.size;
    const total = state.allHeuristicIds.length;
    const snapshotCount = state.snapshots.length;

    return `<current_state>
Step: ${state.step}
Scroll Position: ${state.currentScrollY}px / ${state.pageHeight}px (${scrollPercent.toFixed(0)}%)
Viewport: ${state.viewport.width}x${state.viewport.height}px
Snapshots Captured: ${snapshotCount}
Heuristic Coverage: ${evaluated}/${total} (${coveragePercent.toFixed(0)}%)
</current_state>`;
  }

  /**
   * Format DOM context from latest snapshot
   */
  private formatDOMContext(snapshot: ViewportSnapshot, viewportHeight: number): string {
    // Phase 21i: Use coordinate-aware format if visibleElements available
    if (snapshot.visibleElements && snapshot.visibleElements.length > 0) {
      return this.formatDOMContextWithCoords(
        snapshot.visibleElements,
        snapshot.scrollPosition,
        viewportHeight
      );
    }

    // Fallback to original serialized format
    const serialized = snapshot.dom.serialized;
    const elementCount = snapshot.dom.elementCount;
    const tokenEstimate = Math.ceil(serialized.length / 4);

    // Calculate viewport coverage
    const coverageStart = snapshot.scrollPosition;
    const coverageEnd = snapshot.scrollPosition + viewportHeight;

    return `<dom_context tokens="${tokenEstimate}" elements="${elementCount}">
Viewport range: ${coverageStart}px to ${coverageEnd}px

${serialized}
</dom_context>`;
  }

  /**
   * Format DOM context with screenshot coordinates for visible elements (Phase 21i T371)
   *
   * Format: [index] <tag> "text" → (x, y, width×height)
   * This helps the LLM cross-reference DOM elements with their visual position in the screenshot.
   */
  formatDOMContextWithCoords(
    visibleElements: ElementMapping[],
    scrollPosition: number,
    viewportHeight: number
  ): string {
    const coverageStart = scrollPosition;
    const coverageEnd = scrollPosition + viewportHeight;

    // Format each visible element with its coordinates
    const elementLines: string[] = [];

    for (const element of visibleElements) {
      const { index, tagName, text, croType, screenshotCoords } = element;

      // Truncate text for display (max 50 chars)
      const displayText = text
        ? `"${text.length > 50 ? text.slice(0, 50) + '...' : text}"`
        : '""';

      // Format CRO type if present
      const typeLabel = croType ? ` [${croType}]` : '';

      // Format coordinates: (x, y, width×height)
      const coords = screenshotCoords;
      const coordStr = `(${Math.round(coords.x)}, ${Math.round(coords.y)}, ${Math.round(coords.width)}×${Math.round(coords.height)})`;

      // Visibility indicator for partially visible elements
      const visibilityNote = coords.visibilityRatio < 1
        ? ` (${Math.round(coords.visibilityRatio * 100)}% visible)`
        : '';

      elementLines.push(`[${index}] <${tagName}>${typeLabel} ${displayText} → ${coordStr}${visibilityNote}`);
    }

    const tokenEstimate = Math.ceil(elementLines.join('\n').length / 4);

    return `<dom_context tokens="${tokenEstimate}" elements="${visibleElements.length}" format="coords">
Viewport range: ${coverageStart}px to ${coverageEnd}px
Coordinate format: [index] <tag> [cro-type] "text" → (x, y, width×height)

${elementLines.join('\n')}
</dom_context>`;
  }

  /**
   * Format pending heuristics list
   */
  private formatPendingHeuristics(
    state: VisionAgentState,
    heuristicDefinitions: Map<string, HeuristicDefinition>
  ): string {
    const pending = state.pendingHeuristicIds;
    const count = pending.length;

    if (count === 0) {
      return `<pending_heuristics count="0">
All heuristics have been evaluated. Call done to complete the analysis.
</pending_heuristics>`;
    }

    // Group by category prefix (PDP-CTA, PDP-PRICE, etc.)
    const grouped = new Map<string, string[]>();
    for (const id of pending) {
      const prefix = id.split('-').slice(0, 2).join('-');
      const list = grouped.get(prefix) ?? [];
      list.push(id);
      grouped.set(prefix, list);
    }

    // Format each group
    const groupTexts: string[] = [];
    for (const [prefix, ids] of grouped) {
      const heuristicsText = ids
        .map(id => {
          const def = heuristicDefinitions.get(id);
          if (def) {
            return `  ${id} [${def.severity}]: ${def.principle}`;
          }
          return `  ${id}: (definition not found)`;
        })
        .join('\n');
      groupTexts.push(`[${prefix}]\n${heuristicsText}`);
    }

    return `<pending_heuristics count="${count}">
${groupTexts.join('\n\n')}
</pending_heuristics>`;
  }

  /**
   * Format task instructions based on current state
   * Phase 21h (T361): Added instruction to include elementIndices in evaluations
   */
  private formatInstructions(state: VisionAgentState, _latestSnapshot?: ViewportSnapshot): string {
    const pending = state.pendingHeuristicIds.length;
    const snapshotCount = state.snapshots.length;
    const scrollPercent = this.calculateScrollPercent(state);
    const pageRequiresScroll = state.pageHeight > state.viewportHeight * 1.5;
    const minScrollRequired = 50;
    const scrollSufficient = scrollPercent >= minScrollRequired || !pageRequiresScroll;

    let taskInstruction: string;

    if (snapshotCount === 0) {
      // No snapshots yet - need to capture first
      taskInstruction = 'Start by capturing the current viewport with capture_viewport to get DOM and visual context.';
    } else if (pending === 0 && scrollSufficient) {
      // All done AND scroll is sufficient - can complete
      taskInstruction = 'All heuristics have been evaluated. Call done with a summary and coverageConfirmation=true.';
    } else if (pending === 0 && !scrollSufficient) {
      // All heuristics evaluated BUT need to scroll first for visual coverage
      taskInstruction = `All heuristics evaluated, but you've only scrolled ${Math.round(scrollPercent)}% of the page. ` +
        `You MUST scroll down to at least 50% to ensure thorough visual analysis. ` +
        `Use scroll_page("down"), then capture_viewport to verify visual elements below the fold.`;
    } else if (scrollPercent >= 95 && pending > 0) {
      // Near bottom but still pending - might need to re-scroll or just evaluate remaining
      taskInstruction = `You've scrolled through most of the page. Evaluate the remaining ${pending} heuristics based on all captured snapshots, or note them as not_applicable if they don't apply.`;
    } else if (pending > 20 && snapshotCount < 3) {
      // Many pending, few snapshots - need more exploration
      taskInstruction = `Many heuristics remain (${pending}). Continue capturing and scrolling to cover more page content before evaluating.`;
    } else {
      // Normal flow - evaluate what's visible, then scroll for more
      taskInstruction = `Evaluate the heuristics visible in this viewport (aim for 5-8 per batch), then scroll down to capture more content.`;
    }

    return `<task>
${taskInstruction}

Remember:
- Reference DOM elements by index in observations: "Element [0] shows..."
- Cross-reference DOM structure with visual appearance in screenshot
- For fail/partial status, include specific issue and recommendation
- Include elementIndices array with the indices of DOM elements you referenced (e.g., [0, 3, 5])
- Track progress: ${pending} heuristics remaining
</task>`;
  }

  /**
   * Calculate scroll percentage
   */
  private calculateScrollPercent(state: VisionAgentState): number {
    const maxScroll = Math.max(0, state.pageHeight - state.viewportHeight);
    if (maxScroll === 0) return 100;
    return Math.min(100, (state.currentScrollY / maxScroll) * 100);
  }

  /**
   * Calculate coverage percentage
   */
  private calculateCoveragePercent(state: VisionAgentState): number {
    if (state.allHeuristicIds.length === 0) return 100;
    return (state.evaluatedHeuristicIds.size / state.allHeuristicIds.length) * 100;
  }

  /**
   * Format image for vision API message
   * Uses 'low' detail to reduce token usage (high detail can use 500K+ tokens)
   */
  formatImageContent(base64: string): { type: 'image_url'; image_url: { url: string; detail: 'low' } } {
    return {
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${base64}`,
        detail: 'low',  // Low detail = ~85 tokens, high = can be 500K+
      },
    };
  }

  /**
   * Estimate tokens for a string
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Standalone Export Functions (for testing and direct usage)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format visible elements with coordinates for LLM prompt (Phase 21i T371)
 *
 * Standalone function for direct usage without creating VisionPromptBuilder instance.
 * Format: [index] <tag> [cro-type] "text" → (x, y, width×height)
 *
 * @param visibleElements - Array of ElementMapping objects for visible elements
 * @returns Formatted string with element coordinates for LLM context
 */
export function formatDOMContextWithCoords(visibleElements: ElementMapping[]): string {
  // Format each visible element with its coordinates
  const elementLines: string[] = [];

  for (const element of visibleElements) {
    const { index, tagName, text, croType, screenshotCoords } = element;

    // Truncate text for display (max 50 chars)
    const displayText = text
      ? `"${text.length > 50 ? text.slice(0, 50) + '...' : text}"`
      : '""';

    // Format CRO type if present
    const typeLabel = croType ? ` [${croType}]` : '';

    // Format coordinates: (x, y, width×height)
    const coords = screenshotCoords;
    const coordStr = `(${Math.round(coords.x)}, ${Math.round(coords.y)}, ${Math.round(coords.width)}×${Math.round(coords.height)})`;

    // Visibility indicator for partially visible elements
    const visibilityNote = coords.visibilityRatio < 1
      ? ` (${Math.round(coords.visibilityRatio * 100)}% visible)`
      : '';

    elementLines.push(`[${index}] <${tagName}>${typeLabel} ${displayText} → ${coordStr}${visibilityNote}`);
  }

  return elementLines.join('\n');
}
