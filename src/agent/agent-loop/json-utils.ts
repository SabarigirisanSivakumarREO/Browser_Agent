/**
 * JSON Utilities for Agent Loop
 *
 * Phase 32 (T711): Extract JSON from LLM responses that may include
 * markdown fences or surrounding text.
 */

/**
 * Extract the first JSON object from a string.
 * Strips markdown code fences, then finds the outermost `{...}`.
 *
 * @param text - Raw LLM response text
 * @returns Parsed object or null on failure
 */
export function extractJSON(
  text: string
): Record<string, unknown> | null {
  if (!text) return null;

  // Strip markdown fences
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}
