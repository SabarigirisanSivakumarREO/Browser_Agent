/**
 * Agent Output Models
 *
 * Defines Zod schemas for validating LLM output and parsing utilities.
 */

import { z } from 'zod';
import { CROActionNames } from './tool-definition.js';

/**
 * Zod schema for LLM output validation
 */
export const CROAgentOutputSchema = z.object({
  thinking: z.string().describe('Your step-by-step analysis reasoning'),
  evaluation_previous_goal: z.string().describe('Assessment of whether last action succeeded'),
  memory: z.string().describe('Key findings to remember for next steps'),
  next_goal: z.string().describe('What CRO aspect to analyze next'),
  action: z.object({
    name: z.enum(CROActionNames),
    params: z.record(z.string(), z.any()).optional(),
  }),
});

/**
 * Inferred type from schema
 */
export type CROAgentOutput = z.infer<typeof CROAgentOutputSchema>;

/**
 * Parse result type
 */
export interface ParseResult {
  success: boolean;
  output?: CROAgentOutput;
  error?: string;
}

/**
 * Parse LLM response into validated CROAgentOutput
 *
 * Handles JSON extraction from markdown code blocks and validates
 * against the Zod schema.
 *
 * @param response - Raw LLM response string
 * @returns ParseResult with success status and parsed output or error
 */
export function parseAgentOutput(response: string): ParseResult {
  // Try to extract JSON from response (may be in markdown code block)
  let jsonStr = response.trim();

  // Handle ```json ... ``` or ``` ... ``` blocks
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch && jsonMatch[1]) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed: unknown = JSON.parse(jsonStr);
    const validated = CROAgentOutputSchema.parse(parsed);
    return { success: true, output: validated };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parse error',
    };
  }
}
