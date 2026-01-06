/**
 * Page Type Detector - Phase 21 (T287)
 *
 * Detects page type from page state using URL patterns,
 * element selectors, and keyword matching.
 */

import type { PageState } from '../models/index.js';
import type { PageType, PageTypeResult } from '../models/page-type.js';
import { PAGE_TYPE_SIGNALS, PAGE_TYPES } from '../models/page-type.js';
import { createLogger } from '../utils/index.js';

const logger = createLogger('PageTypeDetector');

/**
 * Configuration for page type detection
 */
export interface PageTypeDetectorConfig {
  /** Minimum confidence to return a page type (default: 0.5) */
  confidenceThreshold: number;
  /** Weight for URL pattern matches (default: 0.45) */
  urlWeight: number;
  /** Weight for element selector matches (default: 0.35) */
  elementWeight: number;
  /** Weight for keyword matches (default: 0.20) */
  keywordWeight: number;
}

const DEFAULT_CONFIG: PageTypeDetectorConfig = {
  confidenceThreshold: 0.5,
  urlWeight: 0.45,
  elementWeight: 0.35,
  keywordWeight: 0.20,
};

/**
 * Page type detector class
 */
export class PageTypeDetector {
  private config: PageTypeDetectorConfig;

  constructor(config: Partial<PageTypeDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Detect page type from page state
   * @param state - Current page state with DOM tree and URL
   */
  detect(state: PageState): PageTypeResult {
    // Special handling for homepage (root path)
    if (this.isHomepage(state.url)) {
      logger.info('Detected page type: homepage (root path)');
      return {
        type: 'homepage',
        confidence: 0.9,
        signals: ['Root URL path detected'],
      };
    }

    const scores: Map<PageType, { score: number; signals: string[] }> = new Map();

    // Initialize scores for all page types
    for (const type of PAGE_TYPES) {
      scores.set(type, { score: 0, signals: [] });
    }

    const url = state.url.toLowerCase();
    const pageText = this.extractPageText(state);

    // Check each page type
    for (const type of PAGE_TYPES) {
      if (type === 'other' || type === 'homepage') continue;

      const signals = PAGE_TYPE_SIGNALS[type];
      const entry = scores.get(type)!;

      // Check URL patterns
      const urlScore = this.checkUrlPatterns(url, signals.urlPatterns);
      if (urlScore > 0) {
        entry.score += urlScore * this.config.urlWeight;
        entry.signals.push(`URL pattern match (${(urlScore * 100).toFixed(0)}%)`);
      }

      // Check element selectors in DOM tree
      const elementScore = this.checkElementSelectors(state, signals.elementSelectors);
      if (elementScore > 0) {
        entry.score += elementScore * this.config.elementWeight;
        entry.signals.push(`Element selectors found (${(elementScore * 100).toFixed(0)}%)`);
      }

      // Check keywords in page text
      const keywordScore = this.checkKeywords(pageText, signals.keywords);
      if (keywordScore > 0) {
        entry.score += keywordScore * this.config.keywordWeight;
        entry.signals.push(`Keywords matched (${(keywordScore * 100).toFixed(0)}%)`);
      }
    }

    // Find highest scoring type
    let bestType: PageType = 'other';
    let bestScore = 0;
    let bestSignals: string[] = [];

    for (const [type, entry] of scores) {
      if (entry.score > bestScore) {
        bestScore = entry.score;
        bestType = type;
        bestSignals = entry.signals;
      }
    }

    // Check confidence threshold
    if (bestScore < this.config.confidenceThreshold) {
      logger.info(`Low confidence (${bestScore.toFixed(2)}), defaulting to 'other'`);
      return {
        type: 'other',
        confidence: bestScore,
        signals: bestSignals.length > 0 ? bestSignals : ['No strong signals detected'],
      };
    }

    logger.info(`Detected page type: ${bestType} (confidence: ${bestScore.toFixed(2)})`);
    return {
      type: bestType,
      confidence: bestScore,
      signals: bestSignals,
    };
  }

  /**
   * Check if URL is homepage (root path)
   */
  private isHomepage(url: string): boolean {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname;
      // Root paths: /, /index.html, /index.htm, /home
      return (
        path === '/' ||
        path === '' ||
        path === '/index.html' ||
        path === '/index.htm' ||
        path === '/home' ||
        path === '/home/'
      );
    } catch {
      return false;
    }
  }

  /**
   * Check URL against patterns
   * Returns 1.0 if any pattern matches (strong signal), 0 otherwise
   */
  private checkUrlPatterns(url: string, patterns: string[]): number {
    if (patterns.length === 0) return 0;

    for (const pattern of patterns) {
      if (url.includes(pattern.toLowerCase())) {
        // Any URL pattern match is a strong signal
        return 1.0;
      }
    }

    return 0;
  }

  /**
   * Check DOM tree for element selectors
   * Returns partial score based on how many selectors match (normalized)
   */
  private checkElementSelectors(state: PageState, selectors: string[]): number {
    if (selectors.length === 0 || !state.domTree) return 0;

    // Flatten DOM tree to check all nodes
    const allNodes = this.flattenDomTree(state.domTree.root);
    let matches = 0;

    for (const selector of selectors) {
      // Simple selector matching against class names and attributes
      if (this.matchesSelector(allNodes, selector)) {
        matches++;
      }
    }

    // Return 1.0 if any match, scaled for multiple matches
    // 1 match = 0.5, 2+ matches = 1.0
    if (matches === 0) return 0;
    return matches >= 2 ? 1.0 : 0.5;
  }

  /**
   * Flatten DOM tree to array of nodes
   */
  private flattenDomTree(
    node: PageState['domTree']['root'],
    result: PageState['domTree']['root'][] = []
  ): PageState['domTree']['root'][] {
    result.push(node);
    if (node.children) {
      for (const child of node.children) {
        this.flattenDomTree(child, result);
      }
    }
    return result;
  }

  /**
   * Check if any node matches a selector pattern
   */
  private matchesSelector(nodes: PageState['domTree']['root'][], selector: string): boolean {
    const selectorLower = selector.toLowerCase();

    // Handle class attribute selectors like [class*="cart"]
    const classMatch = selectorLower.match(/\[class\*="([^"]+)"\]/);
    if (classMatch && classMatch[1]) {
      const classPattern = classMatch[1];
      return nodes.some((node) => {
        const className = node.attributes?.class || '';
        return className.toLowerCase().includes(classPattern);
      });
    }

    // Handle attribute selectors like [itemtype*="Product"] or [data-product-id]
    const attrContainsMatch = selectorLower.match(/\[([^\*\]]+)\*="([^"]+)"\]/);
    if (attrContainsMatch && attrContainsMatch[1] && attrContainsMatch[2]) {
      const attrName = attrContainsMatch[1];
      const attrValue = attrContainsMatch[2];
      return nodes.some((node) => {
        const attrVal = node.attributes?.[attrName] || '';
        return attrVal.toLowerCase().includes(attrValue.toLowerCase());
      });
    }

    // Handle attribute existence selectors like [data-product-id]
    const attrExistsMatch = selectorLower.match(/\[([^\]]+)\]/);
    if (attrExistsMatch && attrExistsMatch[1] && !attrExistsMatch[1].includes('*')) {
      const attrName = attrExistsMatch[1];
      return nodes.some((node) => {
        return node.attributes?.[attrName] !== undefined;
      });
    }

    // Handle tag selectors
    if (!selector.includes('[') && !selector.includes('.')) {
      const tagName = selectorLower.replace(/^\./, '');
      return nodes.some((node) => node.tagName.toLowerCase() === tagName);
    }

    // Handle class selectors like .price
    if (selector.startsWith('.')) {
      const className = selectorLower.slice(1);
      return nodes.some((node) => {
        const classes = (node.attributes?.class || '').toLowerCase().split(/\s+/);
        return classes.includes(className);
      });
    }

    return false;
  }

  /**
   * Check page text for keywords
   * Returns partial score based on how many keywords match
   */
  private checkKeywords(text: string, keywords: string[]): number {
    if (keywords.length === 0) return 0;

    const textLower = text.toLowerCase();
    let matches = 0;

    for (const keyword of keywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        matches++;
      }
    }

    // Return scaled score: 1 match = 0.4, 2 = 0.7, 3+ = 1.0
    if (matches === 0) return 0;
    if (matches === 1) return 0.4;
    if (matches === 2) return 0.7;
    return 1.0;
  }

  /**
   * Extract text content from page state
   */
  private extractPageText(state: PageState): string {
    const texts: string[] = [];

    // Add page title
    if (state.title) {
      texts.push(state.title);
    }

    // Add URL path
    texts.push(state.url);

    // Extract text from DOM tree
    if (state.domTree) {
      this.extractNodeText(state.domTree.root, texts);
    }

    return texts.join(' ');
  }

  /**
   * Recursively extract text from DOM node
   */
  private extractNodeText(node: PageState['domTree']['root'], texts: string[]): void {
    if (node.text) {
      texts.push(node.text);
    }
    if (node.children) {
      for (const child of node.children) {
        this.extractNodeText(child, texts);
      }
    }
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<PageTypeDetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): PageTypeDetectorConfig {
    return { ...this.config };
  }
}

/**
 * Create a new page type detector
 */
export function createPageTypeDetector(
  config?: Partial<PageTypeDetectorConfig>
): PageTypeDetector {
  return new PageTypeDetector(config);
}
