/**
 * Prompt Builder
 *
 * Phase 16 (T078): Constructs system and user prompts for CRO agent LLM interaction.
 * Injects tool definitions and formats page state for LLM consumption.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { ToolRegistry } from './tools/index.js';
import type { PageState, CROMemory } from '../models/index.js';
import { DOMSerializer } from '../browser/dom/index.js';

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
 */
export class PromptBuilder {
  private systemPromptTemplate: string;
  private cachedSystemPrompt: string | null = null;
  private readonly serializer: DOMSerializer;

  constructor(private readonly registry: ToolRegistry) {
    this.systemPromptTemplate = this.loadTemplate();
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
   * Build user message with current page state and memory context
   */
  buildUserMessage(state: PageState, memory: CROMemory): string {
    const serialized = this.serializer.serialize(state.domTree);

    const memorySection = this.formatMemorySection(memory);
    const warningSection = serialized.warning
      ? `\n<warning>${serialized.warning}</warning>\n`
      : '';

    return `<page_url>${state.url}</page_url>
<page_title>${state.title}</page_title>
<viewport>${state.viewport.width}x${state.viewport.height}</viewport>
<scroll_position>x:${state.scrollPosition.x}, y:${state.scrollPosition.y}, maxY:${state.scrollPosition.maxY}</scroll_position>
${warningSection}
<cro_elements count="${serialized.elementCount}" tokens="${serialized.estimatedTokens}">
${serialized.text}
</cro_elements>

${memorySection}

Analyze the page and decide your next action. Respond with valid JSON only.`;
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
  "memory": "Key findings to remember",
  "next_goal": "What to analyze next",
  "action": { "name": "<tool_name>", "params": { } }
}
</output_format>

<available_tools>
{{TOOLS_PLACEHOLDER}}
</available_tools>

<completion_criteria>
Call 'done' when all CRO aspects analyzed and no new elements after scrolling.
</completion_criteria>`;
  }

  /**
   * Clear cached system prompt (useful for testing)
   */
  clearCache(): void {
    this.cachedSystemPrompt = null;
  }

  /**
   * Get raw template (for testing)
   */
  getTemplate(): string {
    return this.systemPromptTemplate;
  }
}
