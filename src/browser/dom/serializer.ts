/**
 * DOM Serializer - Converts DOM tree to LLM-friendly text format
 */

import type { DOMTree, DOMNode, ScanMode } from '../../models/index.js';
import { createLogger } from '../../utils/index.js';

const logger = createLogger('DOMSerializer');

/**
 * Token budgets for different scan modes (CR-025)
 */
export const SCAN_MODE_TOKEN_BUDGETS: Record<ScanMode, number> = {
  full_page: 32000,   // Larger budget for merged full-page DOM
  above_fold: 8000,   // Quick scan, original budget
  llm_guided: 8000,   // Original behavior
};

/**
 * Serialization options
 */
export interface DOMSerializerOptions {
  maxTokens?: number;          // Token budget (default: 8000)
  tokenWarningThreshold?: number;  // Warn at this % (default: 0.6 per CR-013)
  includeHidden?: boolean;     // Include hidden elements (default: false)
  indentSize?: number;         // Spaces per indent level (default: 2)
  scanMode?: ScanMode;         // Scan mode for dynamic token budget (default: llm_guided)
}

const DEFAULT_OPTIONS: DOMSerializerOptions = {
  maxTokens: 8000,
  tokenWarningThreshold: 0.6,
  includeHidden: false,
  indentSize: 2,
  scanMode: 'llm_guided',
};

/**
 * Serialization result with metadata
 */
export interface SerializationResult {
  text: string;
  estimatedTokens: number;
  elementCount: number;
  truncated: boolean;
  warning?: string;
}

/**
 * DOMSerializer - Converts DOM tree to text format for LLM consumption
 */
export class DOMSerializer {
  private options: DOMSerializerOptions;
  private warningEmitted: boolean = false;

  constructor(options: Partial<DOMSerializerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Estimate token count (rough: chars / 4)
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Serialize DOM tree to text
   * Format: [index]<tag attrs>text</tag>
   *
   * @param tree The DOM tree to serialize
   * @param mode Optional scan mode override for dynamic token budget
   */
  serialize(tree: DOMTree, mode?: ScanMode): SerializationResult {
    const lines: string[] = [];
    let elementCount = 0;
    let truncated = false;
    // Use mode parameter if provided, otherwise use options
    const effectiveScanMode = mode ?? this.options.scanMode ?? 'llm_guided';
    const maxTokens =
      this.options.maxTokens !== DEFAULT_OPTIONS.maxTokens
        ? this.options.maxTokens!
        : SCAN_MODE_TOKEN_BUDGETS[effectiveScanMode];
    const warningThreshold = this.options.tokenWarningThreshold!;
    this.warningEmitted = false;

    const processNode = (node: DOMNode, depth: number): boolean => {
      // Skip hidden unless configured
      if (!this.options.includeHidden && !node.isVisible) {
        // Still process children - they might be visible
        for (const child of node.children) {
          if (!processNode(child, depth)) return false;
        }
        return true;
      }

      // Only serialize indexed elements (visible CRO/interactive)
      if (node.index !== undefined) {
        const indent = ' '.repeat(depth * this.options.indentSize!);
        const line = this.formatNode(node, indent);
        lines.push(line);
        elementCount++;

        // Check token budget
        const currentText = lines.join('\n');
        const tokens = this.estimateTokens(currentText);

        if (tokens >= maxTokens) {
          truncated = true;
          return false;  // Stop processing
        }

        if (tokens >= maxTokens * warningThreshold && !this.warningEmitted) {
          logger.warn('DOM serialization approaching token limit', {
            tokens,
            maxTokens,
            percentage: Math.round((tokens / maxTokens) * 100),
          });
          this.warningEmitted = true;
        }
      }

      // Process children
      for (const child of node.children) {
        if (!processNode(child, depth + 1)) return false;
      }

      return true;
    };

    processNode(tree.root, 0);

    const text = lines.join('\n');
    const estimatedTokens = this.estimateTokens(text);

    const result: SerializationResult = {
      text,
      estimatedTokens,
      elementCount,
      truncated,
    };

    if (truncated) {
      result.warning = `Serialization truncated at ${maxTokens} tokens. ${elementCount} elements included.`;
    }

    return result;
  }

  /**
   * Format a single node
   */
  private formatNode(node: DOMNode, indent: string): string {
    const parts: string[] = [];

    // Index marker
    parts.push(`[${node.index}]`);

    // Tag with attributes
    let attrs = '';
    if (node.attributes) {
      const attrParts: string[] = [];
      if (node.attributes.class) attrParts.push(`class="${node.attributes.class}"`);
      if (node.attributes.id) attrParts.push(`id="${node.attributes.id}"`);
      if (node.attributes.href) attrParts.push(`href="${node.attributes.href}"`);
      if (node.attributes.type) attrParts.push(`type="${node.attributes.type}"`);
      if (node.attributes.role) attrParts.push(`role="${node.attributes.role}"`);
      attrs = attrParts.length > 0 ? ' ' + attrParts.join(' ') : '';
    }

    // CRO type annotation
    const croAnnotation = node.croType ? ` [${node.croType}]` : '';

    // Build line
    if (node.text) {
      parts.push(`<${node.tagName}${attrs}>${node.text}</${node.tagName}>${croAnnotation}`);
    } else {
      parts.push(`<${node.tagName}${attrs}>${croAnnotation}`);
    }

    return indent + parts.join('');
  }

  /**
   * Serialize for diff (mark new elements)
   */
  serializeWithDiff(current: DOMTree, previous: DOMTree): SerializationResult {
    // Get previous xpaths for comparison
    const previousXPaths = new Set<string>();
    const collectXPaths = (node: DOMNode) => {
      if (node.index !== undefined) {
        previousXPaths.add(node.xpath);
      }
      node.children.forEach(collectXPaths);
    };
    collectXPaths(previous.root);

    // Serialize current with markers
    const lines: string[] = [];
    let elementCount = 0;

    const processNode = (node: DOMNode, depth: number) => {
      if (node.index !== undefined && node.isVisible) {
        const indent = ' '.repeat(depth * this.options.indentSize!);
        const isNew = !previousXPaths.has(node.xpath);
        const marker = isNew ? '*' : '';
        const line = marker + this.formatNode(node, indent);
        lines.push(line);
        elementCount++;
      }

      node.children.forEach(child => processNode(child, depth + 1));
    };

    processNode(current.root, 0);

    const text = lines.join('\n');
    return {
      text,
      estimatedTokens: this.estimateTokens(text),
      elementCount,
      truncated: false,
    };
  }
}
