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
 * Options for DOM extraction
 */
export interface DOMExtractorOptions {
  timeout?: number;           // Extraction timeout in ms (default: 10000)
  retryOnError?: boolean;     // Retry once on failure (default: true)
  freezeConfig?: Partial<DOMFreezeConfig>;  // Phase 25h: DOM freeze configuration
}

/**
 * Configuration for DOM freeze point (Phase 25h - T522)
 */
export interface DOMFreezeConfig {
  /** Enable freeze point before extraction (default: true) */
  enabled: boolean;
  /** Time to wait for animations to settle in ms (default: 500) */
  settleTimeMs: number;
  /** Maximum time to wait for freeze (default: 2000) */
  timeoutMs: number;
  /** Disable CSS animations and transitions (default: true) */
  disableAnimations: boolean;
}

const DEFAULT_OPTIONS: DOMExtractorOptions = {
  timeout: 10000,
  retryOnError: true,
};

const DEFAULT_FREEZE_CONFIG: DOMFreezeConfig = {
  enabled: true,
  settleTimeMs: 500,
  timeoutMs: 2000,
  disableAnimations: true,
};

/**
 * Phase 25h (T522): Freeze the DOM before extraction
 *
 * This reduces DOM drift between runs by:
 * 1. Waiting for a repaint cycle (requestAnimationFrame)
 * 2. Adding a settle delay for dynamic content
 * 3. Optionally disabling CSS animations/transitions
 *
 * @param page - Playwright page instance
 * @param config - Freeze configuration
 * @returns Promise that resolves when DOM is stabilized
 */
export async function freezeDOM(
  page: Page,
  config: Partial<DOMFreezeConfig> = {}
): Promise<{ frozenAt: number; animationsDisabled: boolean }> {
  const freezeConfig: DOMFreezeConfig = { ...DEFAULT_FREEZE_CONFIG, ...config };

  if (!freezeConfig.enabled) {
    return { frozenAt: Date.now(), animationsDisabled: false };
  }

  const startTime = Date.now();

  // Step 1: Disable CSS animations if configured
  let animationsDisabled = false;
  if (freezeConfig.disableAnimations) {
    try {
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
            scroll-behavior: auto !important;
          }
        `,
      });
      animationsDisabled = true;
      logger.debug('CSS animations disabled for DOM freeze');
    } catch (err) {
      logger.warn('Failed to disable CSS animations', {
        error: err instanceof Error ? err.message : 'Unknown',
      });
    }
  }

  // Step 2: Wait for repaint cycle + settle time
  try {
    const settleTimeMs = Math.min(freezeConfig.settleTimeMs, freezeConfig.timeoutMs);
    await page.evaluate((settleMs: number) => {
      return new Promise<void>((resolve) => {
        // Wait for next repaint
        requestAnimationFrame(() => {
          // Then wait settle time
          setTimeout(resolve, settleMs);
        });
      });
    }, settleTimeMs);
  } catch (err) {
    logger.warn('DOM freeze settle wait failed', {
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }

  const elapsed = Date.now() - startTime;
  logger.debug('DOM freeze complete', {
    durationMs: elapsed,
    animationsDisabled,
  });

  return {
    frozenAt: Date.now(),
    animationsDisabled,
  };
}

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
      // Phase 25h (T522): Freeze DOM before extraction for stability
      await freezeDOM(page, this.options.freezeConfig);

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
   * Builds elementLookup keyed by String(element.index)
   */
  private convertRawTree(raw: RawDOMTree, structuredData?: DOMTree['structuredData']): DOMTree {
    const elementLookup: Record<string, NodeIndexEntry> = {};

    const root = this.convertRawNode(raw.root, elementLookup);

    return {
      root,
      interactiveCount: raw.interactiveCount,
      croElementCount: raw.croElementCount,
      totalNodeCount: raw.totalNodeCount,
      extractedAt: raw.extractedAt,
      structuredData,
      elementLookup,
    };
  }

  /**
   * Convert raw node to typed DOMNode
   * Populates elementLookup keyed by String(element.index)
   */
  private convertRawNode(
    raw: RawDOMNode,
    elementLookup: Record<string, NodeIndexEntry>
  ): DOMNode {
    const node: DOMNode = {
      tagName: raw.tagName,
      xpath: raw.xpath,
      text: raw.text,
      isInteractive: raw.isInteractive,
      isVisible: raw.isVisible,
      croType: raw.croType as DOMNode['croType'],
      children: raw.children.map(child => this.convertRawNode(child, elementLookup)),
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

    // Add to elementLookup if element has an index (can be referenced by [v0-X])
    if (raw.index !== undefined) {
      const entry: NodeIndexEntry = { tag: raw.tagName };
      if (raw.croType) {
        entry.croType = raw.croType as Exclude<CROType, null>;
      }
      if (raw.croConfidence !== undefined) {
        entry.confidence = raw.croConfidence;
      }
      entry.index = raw.index;
      elementLookup[String(raw.index)] = entry;
    }

    return node;
  }
}
