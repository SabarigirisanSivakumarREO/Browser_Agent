/**
 * Injectable DOM traversal script
 *
 * This module exports a script string that can be injected via page.evaluate().
 * The script builds a serializable DOM tree with:
 * - XPath generation for each element
 * - Visibility detection (comprehensive)
 * - Interactivity detection
 * - CRO element classification
 * - Sequential indexing for visible CRO elements
 * - Bounding box extraction
 */

import { CRO_SELECTORS, INTERACTIVE_TAGS, INTERACTIVE_ROLES, SKIP_TAGS, MAX_TEXT_LENGTH } from './cro-selectors.js';

/**
 * Raw DOM node from browser (before TypeScript parsing)
 */
export interface RawDOMNode {
  tagName: string;
  xpath: string;
  index?: number;
  text: string;
  isInteractive: boolean;
  isVisible: boolean;
  croType: string | null;
  croConfidence?: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  attributes?: Record<string, string>;
  children: RawDOMNode[];
}

/**
 * Raw DOM tree from browser
 */
export interface RawDOMTree {
  root: RawDOMNode;
  interactiveCount: number;
  croElementCount: number;
  totalNodeCount: number;
  indexedCount: number;
  extractedAt: number;
  viewportWidth: number;
  viewportHeight: number;
  errors: string[];
}

/**
 * Generate injectable script with embedded selectors
 */
export function generateDOMTreeScript(): string {
  // Serialize selectors for injection
  const selectorsJSON = JSON.stringify(CRO_SELECTORS);
  const interactiveTagsJSON = JSON.stringify(INTERACTIVE_TAGS);
  const interactiveRolesJSON = JSON.stringify(INTERACTIVE_ROLES);
  const skipTagsJSON = JSON.stringify(SKIP_TAGS);

  return `
  (function() {
    const CRO_SELECTORS = ${selectorsJSON};
    const INTERACTIVE_TAGS = ${interactiveTagsJSON};
    const INTERACTIVE_ROLES = ${interactiveRolesJSON};
    const SKIP_TAGS = ${skipTagsJSON};
    const MAX_TEXT_LENGTH = ${MAX_TEXT_LENGTH};

    let nodeIndex = 0;
    let totalNodes = 0;
    let interactiveCount = 0;
    let croElementCount = 0;
    const errors = [];

    /**
     * Generate XPath for an element
     */
    function getXPath(element) {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) return '';

      const parts = [];
      let current = element;

      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let index = 1;
        let sibling = current.previousSibling;

        while (sibling) {
          if (sibling.nodeType === Node.ELEMENT_NODE &&
              sibling.nodeName === current.nodeName) {
            index++;
          }
          sibling = sibling.previousSibling;
        }

        const tagName = current.nodeName.toLowerCase();
        const part = index > 1 ? tagName + '[' + index + ']' : tagName;
        parts.unshift(part);
        current = current.parentNode;
      }

      return '/' + parts.join('/');
    }

    /**
     * Comprehensive visibility detection
     */
    function isElementVisible(element) {
      try {
        // Must have bounding box
        const rect = element.getBoundingClientRect();
        if (!rect || rect.width === 0 || rect.height === 0) return false;

        // Check computed styles
        const style = window.getComputedStyle(element);

        // display: none
        if (style.display === 'none') return false;

        // visibility: hidden or collapse
        if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;

        // opacity: 0
        if (parseFloat(style.opacity) === 0) return false;

        // clip-path: inset(100%) or similar hiding
        if (style.clipPath === 'inset(100%)') return false;

        // transform: scale(0)
        if (style.transform && style.transform.includes('scale(0)')) return false;

        // Off-screen positioning
        if (rect.right < 0 || rect.bottom < 0) return false;
        if (rect.left > window.innerWidth || rect.top > window.innerHeight) return false;

        // aria-hidden
        if (element.getAttribute('aria-hidden') === 'true') return false;

        // Check parent visibility (limited depth for performance)
        let parent = element.parentElement;
        let depth = 0;
        while (parent && depth < 10) {
          const parentStyle = window.getComputedStyle(parent);
          if (parentStyle.display === 'none') return false;
          if (parentStyle.visibility === 'hidden') return false;
          if (parseFloat(parentStyle.opacity) === 0) return false;

          // Check overflow clipping
          if (parentStyle.overflow === 'hidden') {
            const parentRect = parent.getBoundingClientRect();
            if (rect.right < parentRect.left || rect.left > parentRect.right ||
                rect.bottom < parentRect.top || rect.top > parentRect.bottom) {
              return false;
            }
          }

          parent = parent.parentElement;
          depth++;
        }

        return true;
      } catch (e) {
        errors.push('Visibility check error: ' + e.message);
        return false;
      }
    }

    /**
     * Interactive element detection
     */
    function isElementInteractive(element) {
      const tagName = element.tagName.toLowerCase();

      // Check tag name
      if (INTERACTIVE_TAGS.includes(tagName)) return true;

      // Check ARIA role
      const role = element.getAttribute('role');
      if (role && INTERACTIVE_ROLES.includes(role)) return true;

      // Check onclick handler
      if (element.hasAttribute('onclick')) return true;
      if (element.onclick) return true;

      // Check cursor style
      try {
        const style = window.getComputedStyle(element);
        if (style.cursor === 'pointer') return true;
      } catch (e) {}

      // Check tabindex (makes element focusable/interactive)
      const tabindex = element.getAttribute('tabindex');
      if (tabindex && parseInt(tabindex) >= 0) return true;

      // Check contenteditable
      if (element.isContentEditable) return true;

      return false;
    }

    /**
     * Classify element as CRO type
     */
    function classifyCROElement(element, text) {
      const tagName = element.tagName.toLowerCase();
      const classes = (element.className || '').toString().toLowerCase();
      const role = (element.getAttribute('role') || '').toLowerCase();
      const textLower = text.toLowerCase();

      let bestMatch = { type: null, confidence: 0 };

      for (const [croType, patterns] of Object.entries(CRO_SELECTORS)) {
        for (const pattern of patterns) {
          let matched = false;
          let weight = pattern.weight;

          switch (pattern.type) {
            case 'tag':
              matched = tagName === pattern.pattern;
              break;
            case 'class':
              matched = classes.includes(pattern.pattern);
              break;
            case 'id':
              matched = (element.id || '').toLowerCase().includes(pattern.pattern);
              break;
            case 'attr':
              matched = element.hasAttribute(pattern.pattern);
              break;
            case 'role':
              matched = role === pattern.pattern;
              break;
            case 'text':
              const textPatterns = pattern.pattern.split('|');
              matched = textPatterns.some(p => textLower.includes(p));
              break;
          }

          if (matched && weight > bestMatch.confidence) {
            bestMatch = { type: croType, confidence: weight };
          }
        }
      }

      return bestMatch.confidence >= 0.5 ? bestMatch : { type: null, confidence: 0 };
    }

    /**
     * Extract text content (truncated)
     */
    function getElementText(element) {
      let text = '';

      // For inputs, get value or placeholder
      if (element.tagName.toLowerCase() === 'input') {
        text = element.value || element.placeholder || '';
      } else if (element.tagName.toLowerCase() === 'img') {
        text = element.alt || '';
      } else {
        // Get direct text content (not from children)
        for (const node of element.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent;
          }
        }
      }

      // Clean and truncate
      text = text.trim().replace(/\\s+/g, ' ');
      if (text.length > MAX_TEXT_LENGTH) {
        text = text.substring(0, MAX_TEXT_LENGTH - 3) + '...';
      }

      return text;
    }

    /**
     * Get relevant attributes
     */
    function getRelevantAttributes(element) {
      const attrs = {};
      const relevant = ['class', 'id', 'role', 'href', 'type', 'name', 'placeholder', 'aria-label', 'data-testid'];

      for (const name of relevant) {
        const value = element.getAttribute(name);
        if (value) {
          attrs[name] = value.length > 100 ? value.substring(0, 100) + '...' : value;
        }
      }

      return Object.keys(attrs).length > 0 ? attrs : undefined;
    }

    /**
     * Build DOM tree recursively
     */
    function buildTree(element) {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;

      const tagName = element.tagName.toLowerCase();

      // Skip non-valuable elements
      if (SKIP_TAGS.includes(tagName)) return null;

      totalNodes++;

      const text = getElementText(element);
      const isVisible = isElementVisible(element);
      const isInteractive = isElementInteractive(element);
      const croResult = classifyCROElement(element, text);

      if (isInteractive) interactiveCount++;
      if (croResult.type) croElementCount++;

      // Build node
      const node = {
        tagName,
        xpath: getXPath(element),
        text,
        isInteractive,
        isVisible,
        croType: croResult.type,
      };

      // Add confidence if CRO type detected
      if (croResult.type) {
        node.croConfidence = croResult.confidence;
      }

      // Assign index only to visible CRO or interactive elements
      if (isVisible && (croResult.type || isInteractive)) {
        node.index = nodeIndex++;

        // Add bounding box for indexed elements
        // Use absolute page coordinates (rect.y + scrollY) for multi-segment DOM merging
        const rect = element.getBoundingClientRect();
        node.boundingBox = {
          x: Math.round(rect.x + window.scrollX),
          y: Math.round(rect.y + window.scrollY),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      }

      // Add relevant attributes
      node.attributes = getRelevantAttributes(element);

      // Process children
      node.children = [];
      for (const child of element.children) {
        const childNode = buildTree(child);
        if (childNode) {
          node.children.push(childNode);
        }
      }

      return node;
    }

    // Build tree from body
    const root = buildTree(document.body);

    return {
      root: root || { tagName: 'body', xpath: '/html/body', text: '', isInteractive: false, isVisible: true, croType: null, children: [] },
      interactiveCount,
      croElementCount,
      totalNodeCount: totalNodes,
      indexedCount: nodeIndex,
      extractedAt: Date.now(),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      errors
    };
  })();
  `;
}

/**
 * Pre-generated script for performance
 */
export const DOM_TREE_SCRIPT = generateDOMTreeScript();
