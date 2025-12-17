/**
 * DOM Extraction Module
 */

// Selectors
export {
  CRO_SELECTORS,
  INTERACTIVE_TAGS,
  INTERACTIVE_ROLES,
  SKIP_TAGS,
  MAX_TEXT_LENGTH,
  type CROSelectorPattern,
  type CROSelectorConfig,
} from './cro-selectors.js';

// DOM tree building
export {
  DOM_TREE_SCRIPT,
  generateDOMTreeScript,
  type RawDOMNode,
  type RawDOMTree,
} from './build-dom-tree.js';

// Extractor
export {
  DOMExtractor,
  type DOMExtractorOptions,
} from './extractor.js';

// Serializer
export {
  DOMSerializer,
  SCAN_MODE_TOKEN_BUDGETS,
  type DOMSerializerOptions,
  type SerializationResult,
} from './serializer.js';

// DOM Merger (Phase 19b)
export { DOMMerger } from './dom-merger.js';
