/**
 * Tool Registry
 *
 * Phase 15 (T074): Manages registration and lookup of CRO tools.
 * Provides LLM-friendly tool definitions for system prompts.
 */

import { z } from 'zod';
import type { Tool, ToolDefinitionForLLM } from './types.js';
import type { CROActionName } from '../../models/index.js';

/**
 * ToolRegistry - Central registry for CRO analysis tools
 *
 * Responsibilities:
 * - Register tools with duplicate detection
 * - Lookup tools by name
 * - Generate LLM-friendly tool definitions (JSON Schema)
 */
export class ToolRegistry {
  private readonly tools: Map<CROActionName, Tool> = new Map();

  /**
   * Register a tool
   * @param tool - Tool to register
   * @throws Error if tool with same name already registered
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   * @param name - Tool name
   * @returns Tool if found, undefined otherwise
   */
  get(name: CROActionName): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool is registered
   * @param name - Tool name
   * @returns true if registered
   */
  has(name: CROActionName): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tools
   * @returns Array of all tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool definitions for LLM system prompt (FR-037)
   *
   * Converts Zod schemas to JSON Schema for LLM consumption.
   * @returns Array of LLM-friendly tool definitions
   */
  getToolDefinitions(): ToolDefinitionForLLM[] {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      // Use Zod v4 native JSON Schema support
      parameters: z.toJSONSchema(tool.parameters) as Record<string, unknown>,
    }));
  }

  /**
   * Get count of registered tools
   * @returns Number of registered tools
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Clear all registered tools (for testing)
   */
  clear(): void {
    this.tools.clear();
  }
}
