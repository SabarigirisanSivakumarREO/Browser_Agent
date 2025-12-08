/**
 * Business Type Detector - Phase 18b (T106b)
 *
 * Detects business type from page state using URL patterns,
 * element selectors, and keyword matching.
 */

import type { PageState, BusinessType, BusinessTypeResult } from '../models/index.js';
import { BUSINESS_TYPE_SIGNALS, BUSINESS_TYPES } from '../models/index.js';
import { createLogger } from '../utils/index.js';

const logger = createLogger('BusinessTypeDetector');

/**
 * Configuration for business type detection
 */
export interface BusinessTypeDetectorConfig {
  /** Minimum confidence to return a business type (default: 0.6) */
  confidenceThreshold: number;
  /** Weight for URL pattern matches (default: 0.4) */
  urlWeight: number;
  /** Weight for element selector matches (default: 0.35) */
  elementWeight: number;
  /** Weight for keyword matches (default: 0.25) */
  keywordWeight: number;
}

const DEFAULT_CONFIG: BusinessTypeDetectorConfig = {
  confidenceThreshold: 0.6,
  urlWeight: 0.4,
  elementWeight: 0.35,
  keywordWeight: 0.25,
};

/**
 * Business type detector class
 */
export class BusinessTypeDetector {
  private config: BusinessTypeDetectorConfig;

  constructor(config: Partial<BusinessTypeDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Detect business type from page state
   * @param state - Current page state with DOM tree and URL
   */
  detect(state: PageState): BusinessTypeResult {
    const scores: Map<BusinessType, { score: number; signals: string[] }> = new Map();

    // Initialize scores for all business types
    for (const type of BUSINESS_TYPES) {
      scores.set(type, { score: 0, signals: [] });
    }

    const url = state.url.toLowerCase();
    const pageText = this.extractPageText(state);

    // Check each business type
    for (const type of BUSINESS_TYPES) {
      if (type === 'other') continue; // 'other' is fallback

      const signals = BUSINESS_TYPE_SIGNALS[type];
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
    let bestType: BusinessType = 'other';
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

    logger.info(`Detected business type: ${bestType} (confidence: ${bestScore.toFixed(2)})`);
    return {
      type: bestType,
      confidence: bestScore,
      signals: bestSignals,
    };
  }

  /**
   * Check URL against patterns
   */
  private checkUrlPatterns(url: string, patterns: string[]): number {
    if (patterns.length === 0) return 0;

    let matches = 0;
    for (const pattern of patterns) {
      if (url.includes(pattern.toLowerCase())) {
        matches++;
      }
    }

    return matches / patterns.length;
  }

  /**
   * Check DOM tree for element selectors
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

    return matches / selectors.length;
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

    // Handle itemtype selectors like [itemtype*="Product"]
    const attrMatch = selectorLower.match(/\[([^*]+)\*="([^"]+)"\]/);
    if (attrMatch && attrMatch[1] && attrMatch[2]) {
      const attrName = attrMatch[1];
      const attrValue = attrMatch[2];
      return nodes.some((node) => {
        const attrVal = node.attributes?.[attrName] || '';
        return attrVal.toLowerCase().includes(attrValue.toLowerCase());
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

    return matches / keywords.length;
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
  setConfig(config: Partial<BusinessTypeDetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): BusinessTypeDetectorConfig {
    return { ...this.config };
  }
}

/**
 * Create a new business type detector
 */
export function createBusinessTypeDetector(
  config?: Partial<BusinessTypeDetectorConfig>
): BusinessTypeDetector {
  return new BusinessTypeDetector(config);
}
