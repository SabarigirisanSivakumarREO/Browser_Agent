/**
 * DOM Extractor - Extracts DOM tree from page via script injection
 */

import type { Page } from 'playwright';
import type { DOMTree, DOMNode } from '../../models/index.js';
import { DOM_TREE_SCRIPT, type RawDOMTree, type RawDOMNode } from './build-dom-tree.js';
import { createLogger } from '../../utils/index.js';

const logger = createLogger('DOMExtractor');

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

      // Convert raw tree to typed DOMTree
      const domTree = this.convertRawTree(rawTree);

      logger.debug('DOM extraction complete', {
        totalNodes: rawTree.totalNodeCount,
        indexedElements: rawTree.indexedCount,
        interactiveElements: rawTree.interactiveCount,
        croElements: rawTree.croElementCount,
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
          return this.convertRawTree(rawTree);
        } catch (retryError) {
          throw new Error(`DOM extraction failed after retry: ${message}`);
        }
      }

      throw new Error(`DOM extraction failed: ${message}`);
    }
  }

  /**
   * Convert raw tree to typed DOMTree
   */
  private convertRawTree(raw: RawDOMTree): DOMTree {
    return {
      root: this.convertRawNode(raw.root),
      interactiveCount: raw.interactiveCount,
      croElementCount: raw.croElementCount,
      totalNodeCount: raw.totalNodeCount,
      extractedAt: raw.extractedAt,
    };
  }

  /**
   * Convert raw node to typed DOMNode
   */
  private convertRawNode(raw: RawDOMNode): DOMNode {
    const node: DOMNode = {
      tagName: raw.tagName,
      xpath: raw.xpath,
      text: raw.text,
      isInteractive: raw.isInteractive,
      isVisible: raw.isVisible,
      croType: raw.croType as DOMNode['croType'],
      children: raw.children.map(child => this.convertRawNode(child)),
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

    return node;
  }
}
