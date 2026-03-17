/**
 * DOM Extraction Module
 */

// Selectors (Phase 25g: added confidence aggregation)
export {
  CRO_SELECTORS,
  INTERACTIVE_TAGS,
  INTERACTIVE_ROLES,
  SKIP_TAGS,
  MAX_TEXT_LENGTH,
  aggregateConfidence,
  matchElementPatterns,
  getBestCROMatch,
  type CROSelectorPattern,
  type CROSelectorConfig,
  type AggregatedConfidence,
  type CROTypeKey,
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

// Coordinate Mapper (Phase 21i, Phase 25-fix: added generateViewportId, Phase 25g: added ElementBox)
export {
  toScreenshotCoords,
  mapElementsToScreenshot,
  filterVisibleElements,
  getElementByIndex,
  getElementsByIndices,
  generateViewportId,
  computeLayoutBoxes,
  getElementIndicesByCROType,
  collectAllElementIndices,
  type ScreenshotCoords,
  type ElementMapping,
  type ElementBox,
} from './coordinate-mapper.js';

// Structured Data (Phase 25c)
export {
  extractStructuredData,
  type StructuredProductData,
} from './structured-data.js';
