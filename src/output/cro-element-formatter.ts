/**
 * CRO Element Formatter
 * Formats DOM extraction results for console output.
 */

import type { DOMTree, DOMNode, CROType } from '../models/index.js';

/**
 * Result of CRO extraction for display
 */
export interface CROExtractionResult {
  url: string;
  success: boolean;
  error?: string;
  domTree?: DOMTree;
  loadTimeMs?: number;
  tokenUsage?: {
    used: number;
    budget: number;
  };
}

/**
 * Grouped CRO elements for display
 */
interface GroupedElements {
  cta: DOMNode[];
  form: DOMNode[];
  trust: DOMNode[];
  value_prop: DOMNode[];
  navigation: DOMNode[];
}

const CRO_TYPE_LABELS: Record<Exclude<CROType, null>, string> = {
  cta: 'CTAs',
  form: 'FORMS',
  trust: 'TRUST SIGNALS',
  value_prop: 'VALUE PROPS',
  navigation: 'NAVIGATION',
};

/**
 * Formats CRO extraction results for console output.
 */
export class CROElementFormatter {
  private readonly width: number;
  private readonly separator: string;

  constructor(width = 80) {
    this.width = width;
    this.separator = '='.repeat(width);
  }

  /**
   * Format CRO extraction result for display
   */
  format(result: CROExtractionResult): string {
    const lines: string[] = [];

    // Header
    lines.push(this.separator);
    lines.push(this.center('CRO ELEMENTS EXTRACTED'));
    lines.push(this.separator);

    // URL and Status
    lines.push(`URL: ${result.url}`);
    lines.push(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);

    if (result.loadTimeMs !== undefined) {
      lines.push(`Load Time: ${(result.loadTimeMs / 1000).toFixed(2)}s`);
    }

    // Error case
    if (!result.success && result.error) {
      lines.push('');
      lines.push(`ERROR: ${result.error}`);
      lines.push(this.separator);
      return lines.join('\n');
    }

    // DOM Tree data
    if (result.domTree) {
      const grouped = this.groupCROElements(result.domTree.root);
      lines.push('');

      // Display each CRO type
      for (const type of ['cta', 'form', 'trust', 'value_prop', 'navigation'] as const) {
        const elements = grouped[type];
        const label = CRO_TYPE_LABELS[type];
        lines.push(`${label} (${elements.length} found):`);

        if (elements.length === 0) {
          lines.push('  (none detected)');
        } else {
          // Show first 10 elements
          const display = elements.slice(0, 10);
          for (const el of display) {
            const indexStr = el.index !== undefined ? `[${el.index}]` : '[-]';
            const text = this.truncate(el.text || '(no text)', 40);
            const tag = `<${el.tagName.toLowerCase()}>`;
            lines.push(`  ${indexStr} ${tag} "${text}"`);
            lines.push(`      ${this.truncate(el.xpath, this.width - 8)}`);
          }
          if (elements.length > 10) {
            lines.push(`  ... and ${elements.length - 10} more`);
          }
        }
        lines.push('');
      }

      // Summary
      lines.push('SUMMARY:');
      const totalCRO = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
      lines.push(`├─ Total CRO Elements: ${totalCRO}`);
      lines.push(`├─ Interactive Elements: ${result.domTree.interactiveCount}`);
      lines.push(`└─ Total DOM Nodes: ${result.domTree.totalNodeCount}`);

      // Token usage if available
      if (result.tokenUsage) {
        const percent = Math.round((result.tokenUsage.used / result.tokenUsage.budget) * 100);
        lines.push('');
        lines.push(`Token Usage: ${result.tokenUsage.used.toLocaleString()} / ${result.tokenUsage.budget.toLocaleString()} (${percent}%)`);
      }
    }

    lines.push(this.separator);
    return lines.join('\n');
  }

  /**
   * Traverse DOM tree and group elements by CRO type
   */
  private groupCROElements(node: DOMNode): GroupedElements {
    const groups: GroupedElements = {
      cta: [],
      form: [],
      trust: [],
      value_prop: [],
      navigation: [],
    };

    this.collectCROElements(node, groups);
    return groups;
  }

  /**
   * Recursively collect CRO elements from tree
   */
  private collectCROElements(node: DOMNode, groups: GroupedElements): void {
    // Add this node if it's a CRO element
    if (node.croType && node.isVisible) {
      groups[node.croType].push(node);
    }

    // Recurse into children
    for (const child of node.children) {
      this.collectCROElements(child, groups);
    }
  }

  /**
   * Center text within width
   */
  private center(text: string): string {
    const padding = Math.max(0, this.width - text.length);
    const left = Math.floor(padding / 2);
    return ' '.repeat(left) + text;
  }

  /**
   * Truncate text to max length
   */
  private truncate(text: string, maxLen: number): string {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= maxLen) return cleaned;
    return cleaned.slice(0, maxLen - 3) + '...';
  }
}
