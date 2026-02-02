/**
 * Prompt Builder
 *
 * Phase 16 (T078): Constructs system and user prompts for CRO agent LLM interaction.
 * CR-001-B: Added collection phase prompt support for unified vision integration.
 * T511: Added analysis phase prompts with DOM context and category-specific heuristics.
 * Injects tool definitions and formats page state for LLM consumption.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { ToolRegistry } from './tools/index.js';
import type { PageState, CROMemory, ViewportSnapshot, PageType } from '../models/index.js';
import type { CoverageTracker } from './coverage-tracker.js';
import { DOMSerializer } from '../browser/dom/index.js';
import type { HeuristicCategory } from '../heuristics/knowledge/index.js';

// Get directory path for loading template
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * PromptBuilder - Constructs prompts for CRO agent LLM interaction
 *
 * Responsibilities:
 * - Load and cache system prompt template
 * - Inject tool definitions into system prompt (FR-039)
 * - Build user messages with page state and memory (FR-040)
 * - CR-001-B: Support collection phase prompts
 */
export class PromptBuilder {
  private systemPromptTemplate: string;
  private collectionPromptTemplate: string;
  private cachedSystemPrompt: string | null = null;
  private cachedCollectionPrompt: string | null = null;
  private readonly serializer: DOMSerializer;

  constructor(private readonly registry: ToolRegistry) {
    this.systemPromptTemplate = this.loadTemplate();
    this.collectionPromptTemplate = this.loadCollectionTemplate();
    this.serializer = new DOMSerializer();
  }

  /**
   * Build complete system prompt with tools injected
   * Caches result since tools don't change during session
   */
  buildSystemPrompt(): string {
    if (this.cachedSystemPrompt) {
      return this.cachedSystemPrompt;
    }

    const toolsSection = this.formatToolsSection();
    this.cachedSystemPrompt = this.systemPromptTemplate.replace(
      '{{TOOLS_PLACEHOLDER}}',
      toolsSection
    );

    return this.cachedSystemPrompt;
  }

  /**
   * CR-001-B: Build collection phase system prompt
   * Only includes tools relevant to collection: scroll_page, capture_viewport, collection_done
   */
  buildCollectionSystemPrompt(): string {
    if (this.cachedCollectionPrompt) {
      return this.cachedCollectionPrompt;
    }

    const collectionTools = this.formatCollectionToolsSection();
    this.cachedCollectionPrompt = this.collectionPromptTemplate.replace(
      '{{TOOLS_PLACEHOLDER}}',
      collectionTools
    );

    return this.cachedCollectionPrompt;
  }

  /**
   * CR-001-B: Build user message for collection phase
   * Simpler than analysis phase - focuses on scroll position and capture progress
   */
  buildCollectionUserMessage(
    state: PageState,
    memory: CROMemory,
    snapshots: ViewportSnapshot[]
  ): string {
    const scrollPercent = state.scrollPosition.maxY > 0
      ? Math.round((state.scrollPosition.y / state.scrollPosition.maxY) * 100)
      : 0;

    const snapshotSummary = snapshots.length > 0
      ? snapshots.map((s, i) => `  [${i}] at ${s.scrollPosition}px: ${s.dom.elementCount} elements`).join('\n')
      : '  No snapshots yet';

    const memorySection = this.formatMemorySection(memory);

    return `<page_url>${state.url}</page_url>
<page_title>${state.title}</page_title>
<viewport>${state.viewport.width}x${state.viewport.height}</viewport>
<scroll_position>y:${state.scrollPosition.y}px, maxY:${state.scrollPosition.maxY}px, progress:${scrollPercent}%</scroll_position>

<collection_status>
Snapshots captured: ${snapshots.length}
${snapshotSummary}
</collection_status>

${memorySection}

Decide your next action. If at page top, capture first viewport. If not at bottom, scroll down and capture. If at bottom, call collection_done.
Respond with valid JSON only.`;
  }

  /**
   * Build user message with current page state and memory context
   * @param state - Current page state
   * @param memory - Agent memory
   * @param coverageTracker - Optional coverage tracker for full_page mode (Phase 19d)
   */
  buildUserMessage(
    state: PageState,
    memory: CROMemory,
    coverageTracker?: CoverageTracker
  ): string {
    const serialized = this.serializer.serialize(state.domTree);

    const memorySection = this.formatMemorySection(memory);
    const warningSection = serialized.warning
      ? `\n<warning>${serialized.warning}</warning>\n`
      : '';
    const coverageSection = this.formatCoverageSection(coverageTracker);

    return `<page_url>${state.url}</page_url>
<page_title>${state.title}</page_title>
<viewport>${state.viewport.width}x${state.viewport.height}</viewport>
<scroll_position>x:${state.scrollPosition.x}, y:${state.scrollPosition.y}, maxY:${state.scrollPosition.maxY}</scroll_position>
${warningSection}${coverageSection}
<cro_elements count="${serialized.elementCount}" tokens="${serialized.estimatedTokens}">
${serialized.text}
</cro_elements>

${memorySection}

Analyze the page and decide your next action. Respond with valid JSON only.`;
  }

  /**
   * Format coverage section for user message (Phase 19d)
   */
  private formatCoverageSection(coverageTracker?: CoverageTracker): string {
    if (!coverageTracker) {
      return '';
    }

    const report = coverageTracker.getCoverageReport();
    return `
<coverage>
${report}
</coverage>
`;
  }

  /**
   * Format tools section for system prompt
   * Converts tool definitions to human-readable format
   */
  formatToolsSection(): string {
    const tools = this.registry.getToolDefinitions();

    if (tools.length === 0) {
      return 'No tools available.';
    }

    return tools
      .map((tool) => {
        const paramsStr = this.formatParameters(tool.parameters);
        return `**${tool.name}**
${tool.description}
Parameters: ${paramsStr}`;
      })
      .join('\n\n');
  }

  /**
   * CR-001-B: Format tools section for collection phase
   * Only includes collection-relevant tools
   */
  private formatCollectionToolsSection(): string {
    const collectionToolNames = ['scroll_page', 'capture_viewport', 'collection_done'];
    const tools = this.registry.getToolDefinitions()
      .filter(t => collectionToolNames.includes(t.name));

    if (tools.length === 0) {
      return 'No tools available.';
    }

    return tools
      .map((tool) => {
        const paramsStr = this.formatParameters(tool.parameters);
        return `**${tool.name}**
${tool.description}
Parameters: ${paramsStr}`;
      })
      .join('\n\n');
  }

  /**
   * Format memory section for user message
   */
  private formatMemorySection(memory: CROMemory): string {
    const parts: string[] = ['<memory>'];

    parts.push(`Current focus: ${memory.currentFocus}`);
    parts.push(`Steps completed: ${memory.stepHistory.length}`);
    parts.push(`Findings so far: ${memory.findings.length} insights`);

    if (memory.pagesSeen.length > 1) {
      parts.push(`Pages analyzed: ${memory.pagesSeen.length}`);
    }

    if (memory.errors.length > 0) {
      const recentErrors = memory.errors.slice(-2);
      parts.push(`Recent errors: ${recentErrors.join(', ')}`);
    }

    // Add recent step history summary (last 3 steps)
    if (memory.stepHistory.length > 0) {
      const recentSteps = memory.stepHistory.slice(-3);
      const stepSummary = recentSteps
        .map((s) => `Step ${s.step + 1}: ${s.action}${s.result.success ? ' (ok)' : ' (failed)'}`)
        .join('; ');
      parts.push(`Recent actions: ${stepSummary}`);
    }

    parts.push('</memory>');

    return parts.join('\n');
  }

  /**
   * Format JSON Schema parameters for display
   */
  private formatParameters(params: Record<string, unknown>): string {
    // Handle empty or minimal schema
    if (!params || Object.keys(params).length === 0) {
      return 'none';
    }

    // For JSON Schema, extract properties
    const properties = params.properties as Record<string, unknown> | undefined;
    if (!properties || Object.keys(properties).length === 0) {
      return 'none';
    }

    const required = (params.required as string[]) || [];

    const paramList = Object.entries(properties).map(([name, schema]) => {
      const schemaObj = schema as Record<string, unknown>;
      const type = schemaObj.type || 'any';
      const desc = schemaObj.description ? ` - ${schemaObj.description}` : '';
      const reqMarker = required.includes(name) ? ' (required)' : '';
      return `${name}: ${type}${reqMarker}${desc}`;
    });

    return paramList.length > 0 ? `\n  ${paramList.join('\n  ')}` : 'none';
  }

  /**
   * Load system prompt template from file
   */
  private loadTemplate(): string {
    try {
      const templatePath = join(__dirname, '..', 'prompts', 'system-cro.md');
      return readFileSync(templatePath, 'utf-8');
    } catch {
      // Return embedded fallback template if file not found
      return this.getFallbackTemplate();
    }
  }

  /**
   * CR-001-B: Load collection phase prompt template from file
   */
  private loadCollectionTemplate(): string {
    try {
      const templatePath = join(__dirname, '..', 'prompts', 'system-collection.md');
      return readFileSync(templatePath, 'utf-8');
    } catch {
      // Return embedded fallback template if file not found
      return this.getCollectionFallbackTemplate();
    }
  }

  /**
   * Fallback template if file cannot be loaded
   */
  private getFallbackTemplate(): string {
    return `<identity>
You are a CRO (Conversion Rate Optimization) expert analyst.
</identity>

<expertise>
- UX friction detection
- CTA optimization
- Form analysis
- Trust signal assessment
- Value proposition clarity
- Navigation usability
</expertise>

<output_format>
Respond with valid JSON:
{
  "thinking": "Your analysis reasoning",
  "evaluation_previous_goal": "Assessment of last action",
  "memory": "Brief plain-text notes of key findings (single string, NOT an object)",
  "next_goal": "What to analyze next",
  "action": { "name": "<tool_name>", "params": { } }
}
IMPORTANT: The "memory" field must be a plain text string, not an object or array.
</output_format>

<available_tools>
{{TOOLS_PLACEHOLDER}}
</available_tools>

<completion_criteria>
Call 'done' when all CRO aspects analyzed and no new elements after scrolling.
</completion_criteria>`;
  }

  /**
   * CR-001-B: Fallback template for collection phase
   */
  private getCollectionFallbackTemplate(): string {
    return `<identity>
You are a data collection agent for CRO analysis.
Your job is to capture viewport snapshots as you scroll through the page.
</identity>

<goal>
Collect visual and structural data from all sections of the page.
</goal>

<available_tools>
{{TOOLS_PLACEHOLDER}}
</available_tools>

<output_format>
Respond with valid JSON:
{
  "thinking": "Brief analysis of current position",
  "evaluation_previous_goal": "Did the last action succeed?",
  "memory": "Plain text notes about progress",
  "next_goal": "What to do next",
  "action": { "name": "<tool_name>", "params": { } }
}
</output_format>

<workflow>
1. capture_viewport → capture at current position
2. scroll_page down → reveal more content
3. Repeat until at bottom
4. collection_done → signal completion
</workflow>`;
  }

  /**
   * T511: Build system prompt for analysis phase
   * Provides context about the analysis task and heuristic evaluation format
   */
  buildAnalysisSystemPrompt(pageType: PageType): string {
    return `<identity>
You are a CRO (Conversion Rate Optimization) expert analyst performing visual heuristic analysis.
You have been given DOM snapshots and screenshots from different scroll positions on a ${pageType.toUpperCase()} page.
</identity>

<task>
Evaluate the page against the provided heuristics based on both DOM structure and visual appearance.
For each heuristic, determine if it passes, fails, is partially met, or is not applicable.
</task>

<evaluation_format>
For each heuristic, provide:
- status: "pass" | "fail" | "partial" | "not_applicable"
- confidence: number 0-1 (how confident you are in this evaluation)
- observation: Brief description of what you observed
- issue: (if fail/partial) Specific problem identified
- recommendation: (if fail/partial) Actionable fix suggestion
- evidence: Element index or visual region supporting your evaluation
</evaluation_format>

<output_format>
Respond with valid JSON:
{
  "evaluations": [
    {
      "heuristicId": "PDP-IMAGERY-001",
      "status": "pass" | "fail" | "partial" | "not_applicable",
      "confidence": 0.85,
      "observation": "What you observed",
      "issue": "Problem identified (if any)",
      "recommendation": "Suggested fix (if any)",
      "evidence": "Element [5] or visual region"
    }
  ],
  "summary": "Brief overall assessment"
}
</output_format>`;
  }

  /**
   * T511: Build user message for category-specific analysis
   * Includes DOM context with element indices and screenshot references
   *
   * @param snapshots - Collected viewport snapshots with DOM + screenshots
   * @param category - Heuristic category to evaluate
   * @param pageType - Type of page being analyzed
   */
  buildAnalysisUserMessage(
    snapshots: ViewportSnapshot[],
    category: HeuristicCategory,
    pageType: PageType
  ): string {
    // Build DOM context section with element indices
    const domContext = this.buildDOMContextSection(snapshots);

    // Build heuristics section for this category
    const heuristicsSection = this.buildHeuristicsSection(category);

    // Build screenshot reference section
    const screenshotSection = this.buildScreenshotSection(snapshots);

    return `<page_type>${pageType.toUpperCase()}</page_type>
<analysis_category>${category.name}</analysis_category>
<category_description>${category.description}</category_description>

${domContext}

${screenshotSection}

${heuristicsSection}

Evaluate each heuristic in the "${category.name}" category using the DOM structure and screenshots provided.
Reference specific element indices [N] or screenshot regions in your evidence.
Respond with valid JSON only.`;
  }

  /**
   * T511: Build DOM context section with element indices
   * Combines DOM from all snapshots with scroll position context
   */
  private buildDOMContextSection(snapshots: ViewportSnapshot[]): string {
    if (snapshots.length === 0) {
      return '<dom_context>\nNo DOM snapshots available.\n</dom_context>';
    }

    const parts: string[] = ['<dom_context>'];
    parts.push(`Total viewport snapshots: ${snapshots.length}`);
    parts.push('');

    for (const snapshot of snapshots) {
      parts.push(`--- Viewport ${snapshot.viewportIndex} (scroll: ${snapshot.scrollPosition}px) ---`);
      parts.push(`Elements: ${snapshot.dom.elementCount}`);
      parts.push(snapshot.dom.serialized);
      parts.push('');
    }

    parts.push('</dom_context>');
    return parts.join('\n');
  }

  /**
   * T511: Build heuristics section for a category
   */
  private buildHeuristicsSection(category: HeuristicCategory): string {
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

  /**
   * T511: Build screenshot reference section
   * Provides context about which screenshots are available
   */
  private buildScreenshotSection(snapshots: ViewportSnapshot[]): string {
    if (snapshots.length === 0) {
      return '<screenshots>\nNo screenshots available.\n</screenshots>';
    }

    const parts: string[] = ['<screenshots>'];
    parts.push(`${snapshots.length} screenshot(s) attached to this message.`);
    parts.push('');

    for (const snapshot of snapshots) {
      parts.push(`Screenshot ${snapshot.viewportIndex}: Captured at scroll position ${snapshot.scrollPosition}px`);
    }

    parts.push('');
    parts.push('Use these visual references to verify DOM observations and assess visual quality.');
    parts.push('</screenshots>');
    return parts.join('\n');
  }

  /**
   * Clear cached system prompt (useful for testing)
   */
  clearCache(): void {
    this.cachedSystemPrompt = null;
    this.cachedCollectionPrompt = null;
  }

  /**
   * Get raw template (for testing)
   */
  getTemplate(): string {
    return this.systemPromptTemplate;
  }
}
