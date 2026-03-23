/**
 * AX Tree Serializer — Phase 29 (T637)
 *
 * Captures, filters, and serializes the browser's accessibility tree
 * for inclusion in LLM prompts. Provides semantic context (ARIA roles,
 * computed names, element states) alongside DOM and screenshot data.
 */

import type { Page } from 'playwright';
import type { AXTreeSerializerConfig } from '../types/index.js';
import { DEFAULT_AX_TREE_CONFIG } from '../types/index.js';
import { createLogger } from '../utils/index.js';

const logger = createLogger('AXTreeSerializer');

/**
 * Playwright's accessibility snapshot node structure.
 */
interface AccessibilityNode {
  role: string;
  name: string;
  value?: string;
  description?: string;
  children?: AccessibilityNode[];
  disabled?: boolean;
  checked?: boolean | 'mixed';
  expanded?: boolean;
  focused?: boolean;
  selected?: boolean;
  required?: boolean;
  pressed?: boolean | 'mixed';
  level?: number;
  invalid?: string;
}

/**
 * Capture and serialize the accessibility tree from the current page.
 *
 * Returns a filtered, indented text representation of the AX tree
 * within the configured token budget, or null if capture fails or
 * the tree is empty.
 */
export async function captureAccessibilityTree(
  page: Page,
  config?: Partial<AXTreeSerializerConfig>
): Promise<string | null> {
  const cfg: AXTreeSerializerConfig = { ...DEFAULT_AX_TREE_CONFIG, ...config };

  try {
    const snapshot = await page.accessibility.snapshot({
      interestingOnly: cfg.interestingOnly,
    }) as AccessibilityNode | null;

    if (!snapshot) {
      logger.debug('Accessibility snapshot returned null');
      return null;
    }

    // Serialize the tree starting from the root's children
    // (root is usually the page/document node itself)
    const nodes = snapshot.children ?? [snapshot];
    const lines: string[] = [];

    for (const node of nodes) {
      serializeNode(node, 0, cfg, lines);
    }

    if (lines.length === 0) {
      logger.debug('No accessibility nodes after filtering');
      return null;
    }

    const serialized = lines.join('\n');
    return truncateToTokenBudget(serialized, cfg.maxTokens);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('Failed to capture accessibility tree', { error: msg });
    return null;
  }
}

/**
 * Filter a node: returns true if the node should be included.
 *
 * Excludes:
 * - Nodes with role "none" or "presentation" (decorative)
 * - Leaf nodes with no name and no children (empty decorative)
 */
export function filterNode(node: AccessibilityNode): boolean {
  const role = node.role?.toLowerCase() ?? '';

  // Exclude decorative roles
  if (role === 'none' || role === 'presentation') {
    return false;
  }

  // Exclude nameless leaf nodes (no children, no name)
  const hasChildren = node.children && node.children.length > 0;
  const hasName = node.name && node.name.trim().length > 0;

  if (!hasName && !hasChildren) {
    return false;
  }

  return true;
}

/**
 * Serialize a single accessibility node into indented text format.
 *
 * Format: `- role "name" [state1] [state2]`
 * Children are indented by `indentSize` spaces per level.
 */
export function serializeAccessibilityNode(
  node: AccessibilityNode,
  indent: number = 0,
  config?: Partial<AXTreeSerializerConfig>
): string {
  const cfg = { ...DEFAULT_AX_TREE_CONFIG, ...config };
  const lines: string[] = [];
  serializeNode(node, indent, cfg, lines);
  return lines.join('\n');
}

function serializeNode(
  node: AccessibilityNode,
  indent: number,
  cfg: AXTreeSerializerConfig,
  lines: string[]
): void {
  if (!filterNode(node)) {
    // Still recurse into children — a filtered parent may have
    // interesting children (e.g., generic container with buttons)
    if (node.children) {
      for (const child of node.children) {
        serializeNode(child, indent, cfg, lines);
      }
    }
    return;
  }

  const prefix = ' '.repeat(indent);
  let line = `${prefix}- ${node.role}`;

  // Add name if present
  if (node.name && node.name.trim().length > 0) {
    const name = node.name.length > 50
      ? node.name.slice(0, 47) + '...'
      : node.name;
    line += ` "${name}"`;
  }

  // Add level for headings
  if (node.level !== undefined) {
    line += ` [level=${node.level}]`;
  }

  // Add non-default state properties
  for (const state of cfg.includeStates) {
    const value = (node as Record<string, unknown>)[state];
    if (value === true) {
      line += ` [${state}]`;
    } else if (value === 'mixed') {
      line += ` [${state}=mixed]`;
    } else if (state === 'invalid' && value && value !== 'false') {
      line += ` [invalid]`;
    }
  }

  lines.push(line);

  // Recurse into children
  if (node.children) {
    for (const child of node.children) {
      serializeNode(child, indent + cfg.indentSize, cfg, lines);
    }
  }
}

/**
 * Truncate serialized text to fit within a token budget.
 *
 * Uses approximate tokenization (1 token ≈ 4 chars) and truncates
 * at the last complete line within budget, appending a count of
 * omitted lines.
 */
export function truncateToTokenBudget(
  text: string,
  maxTokens: number
): string {
  // Approximate token count: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4;

  if (text.length <= maxChars) {
    return text;
  }

  const lines = text.split('\n');
  const kept: string[] = [];
  let charCount = 0;

  for (const line of lines) {
    // +1 for the newline character
    if (charCount + line.length + 1 > maxChars) {
      break;
    }
    kept.push(line);
    charCount += line.length + 1;
  }

  const omitted = lines.length - kept.length;
  if (omitted > 0) {
    kept.push(`... (${omitted} more nodes)`);
  }

  return kept.join('\n');
}
