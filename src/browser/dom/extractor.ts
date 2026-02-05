/**
 * DOM Extractor - Extracts DOM tree from page via script injection
 */

import type { Page } from 'playwright';
import type { DOMTree, DOMNode, NodeIndexEntry, CROType } from '../../models/index.js';
import { DOM_TREE_SCRIPT, type RawDOMTree, type RawDOMNode } from './build-dom-tree.js';
import { extractStructuredData } from './structured-data.js';
import { createLogger } from '../../utils/index.js';

const logger = createLogger('DOMExtractor');

/**
 * Generate stable nodeId in format "n_001", "n_002", etc. (Phase 25g - T503)
 */
export function generateNodeId(counter: number): string {
  return `n_${String(counter).padStart(3, '0')}`;
}

/**
 * Options for DOM extraction
 */
export interface DOMExtractorOptions {
  timeout?: number;           // Extraction timeout in ms (default: 10000)
  retryOnError?: boolean;     // Retry once on failure (default: true)
}

const DEFAULT_OPTIONS: DOMExtractorOptions = {
  timeout: 10000,
  retryOnError: true,
};

/**
 * DOMExtractor - Injects script and extracts DOM tree from page
 */
export class DOMExtractor {
  private options: DOMExtractorOptions;

  constructor(options: Partial<DOMExtractorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Extract DOM tree from page
   */
  async extract(page: Page): Promise<DOMTree> {
    const startTime = Date.now();

    try {
      // Inject and execute script
      const rawTree = await page.evaluate(DOM_TREE_SCRIPT) as RawDOMTree;

      // Log any errors from script
      if (rawTree.errors.length > 0) {
        logger.warn('DOM extraction warnings', { errors: rawTree.errors });
      }

      // Extract structured data (JSON-LD Product schema) - Phase 25c
      const structuredData = await extractStructuredData(page);

      // Convert raw tree to typed DOMTree
      const domTree = this.convertRawTree(rawTree, structuredData);

      logger.debug('DOM extraction complete', {
        totalNodes: rawTree.totalNodeCount,
        indexedElements: rawTree.indexedCount,
        interactiveElements: rawTree.interactiveCount,
        croElements: rawTree.croElementCount,
        hasStructuredData: structuredData !== null,
        durationMs: Date.now() - startTime,
      });

      return domTree;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Retry once if enabled
      if (this.options.retryOnError) {
        logger.warn('DOM extraction failed, retrying...', { error: message });
        try {
          const rawTree = await page.evaluate(DOM_TREE_SCRIPT) as RawDOMTree;
          const structuredData = await extractStructuredData(page);
          return this.convertRawTree(rawTree, structuredData);
        } catch (retryError) {
          throw new Error(`DOM extraction failed after retry: ${message}`);
        }
      }

      throw new Error(`DOM extraction failed: ${message}`);
    }
  }

  /**
   * Convert raw tree to typed DOMTree
   * Phase 25g: Also builds nodeIndex for quick lookups
   */
  private convertRawTree(raw: RawDOMTree, structuredData?: DOMTree['structuredData']): DOMTree {
    const nodeIndex: Record<string, NodeIndexEntry> = {};
    const counter = { value: 1 };  // Mutable counter for node ID generation

    const root = this.convertRawNode(raw.root, counter, nodeIndex);

    return {
      root,
      interactiveCount: raw.interactiveCount,
      croElementCount: raw.croElementCount,
      totalNodeCount: raw.totalNodeCount,
      extractedAt: raw.extractedAt,
      structuredData,
      nodeIndex,
    };
  }

  /**
   * Convert raw node to typed DOMNode
   * Phase 25g: Assigns nodeId and populates nodeIndex
   */
  private convertRawNode(
    raw: RawDOMNode,
    counter: { value: number },
    nodeIndex: Record<string, NodeIndexEntry>
  ): DOMNode {
    // Generate nodeId for indexed/CRO elements (Phase 25g - T503)
    const shouldAssignNodeId = raw.index !== undefined || raw.croType !== null;
    const nodeId = shouldAssignNodeId ? generateNodeId(counter.value++) : undefined;

    const node: DOMNode = {
      tagName: raw.tagName,
      xpath: raw.xpath,
      nodeId,
      text: raw.text,
      isInteractive: raw.isInteractive,
      isVisible: raw.isVisible,
      croType: raw.croType as DOMNode['croType'],
      children: raw.children.map(child => this.convertRawNode(child, counter, nodeIndex)),
    };

    // Optional fields
    if (raw.index !== undefined) {
      node.index = raw.index;
    }
    if (raw.boundingBox) {
      node.boundingBox = raw.boundingBox;
    }
    if (raw.attributes) {
      node.attributes = raw.attributes;
    }
    if (raw.croConfidence !== undefined && raw.croType) {
      node.croClassification = {
        type: raw.croType as Exclude<DOMNode['croType'], null>,
        confidence: raw.croConfidence,
        matchedSelector: '', // Could be enhanced to track this
      };
    }

    // Add to nodeIndex if nodeId was assigned (Phase 25g - T504)
    if (nodeId) {
      const entry: NodeIndexEntry = { tag: raw.tagName };
      if (raw.croType) {
        entry.croType = raw.croType as Exclude<CROType, null>;
      }
      if (raw.croConfidence !== undefined) {
        entry.confidence = raw.croConfidence;
      }
      if (raw.index !== undefined) {
        entry.index = raw.index;
      }
      nodeIndex[nodeId] = entry;
    }

    return node;
  }
}
