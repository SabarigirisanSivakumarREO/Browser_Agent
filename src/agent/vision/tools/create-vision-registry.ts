/**
 * Vision Tool Registry Factory - Phase 21g (T342)
 *
 * Creates and configures the tool registry for the vision agent.
 */

import type { VisionToolDefinition } from '../types.js';
import { createCaptureViewportTool } from './capture-viewport-tool.js';
import { createScrollPageTool } from './scroll-page-tool.js';
import { createEvaluateBatchTool } from './evaluate-batch-tool.js';
import { createVisionDoneTool } from './vision-done-tool.js';

/**
 * Registry of vision agent tools
 */
export interface VisionToolRegistry {
  /** All registered tools */
  tools: VisionToolDefinition[];
  /** Get tool by name */
  getTool(name: string): VisionToolDefinition | undefined;
  /** Get all tool names */
  getToolNames(): string[];
  /** Get tools as JSON Schema for LLM */
  getToolSchemas(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

/**
 * Create a vision tool registry with all tools
 */
export function createVisionToolRegistry(): VisionToolRegistry {
  const tools: VisionToolDefinition[] = [
    createCaptureViewportTool(),
    createScrollPageTool(),
    createEvaluateBatchTool(),
    createVisionDoneTool(),
  ];

  const toolMap = new Map<string, VisionToolDefinition>();
  for (const tool of tools) {
    toolMap.set(tool.name, tool);
  }

  return {
    tools,

    getTool(name: string): VisionToolDefinition | undefined {
      return toolMap.get(name);
    },

    getToolNames(): string[] {
      return tools.map(t => t.name);
    },

    getToolSchemas(): Array<{
      type: 'function';
      function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      };
    }> {
      return tools.map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
    },
  };
}
