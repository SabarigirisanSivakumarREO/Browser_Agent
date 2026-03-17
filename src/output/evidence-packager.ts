/**
 * Evidence Packager - Phase 25g (T510)
 *
 * Builds EvidencePackage from collected viewport snapshots and DOM data.
 * Ensures deterministic ordering and generates warnings for missing PDP signals.
 */

import { createLogger } from '../utils/index.js';
import type { ViewportSnapshot } from '../models/agent-state.js';
import type { ScreenshotTile } from './tiled-screenshot.js';
import type { StructuredProductData } from '../browser/dom/structured-data.js';
import type { ElementBox } from '../browser/dom/coordinate-mapper.js';
import type { ScreenshotMode } from '../types/index.js';
import type { CROType, DOMTree } from '../models/dom-tree.js';
import {
  type EvidencePackage,
  type EvidenceElement,
  type EvidenceScreenshot,
  type ExtractionMetrics,
  createEmptyMetrics,
  generateRunId,
  generateViewportRef,
  generateScreenshotId,
} from '../types/evidence-schema.js';

const logger = createLogger('EvidencePackager');

// ═══════════════════════════════════════════════════════════════════════════════
// Input Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Input parameters for building an evidence package
 */
export interface BuildEvidenceInput {
  /** URL that was analyzed */
  url: string;
  /** Optional run ID (generated if not provided) */
  runId?: string;
  /** Screenshot mode used */
  mode: ScreenshotMode;
  /** Viewport dimensions */
  viewportWidth: number;
  viewportHeight: number;
  /** Total page height (null if unknown) */
  pageHeight: number | null;
  /** Viewport snapshots from collection phase */
  snapshots?: ViewportSnapshot[];
  /** Screenshot tiles from tiled mode */
  tiles?: ScreenshotTile[];
  /** Structured product data from JSON-LD */
  structuredData: StructuredProductData | null;
  /** Element bounding boxes from layout mapping */
  elementBoxes?: ElementBox[];
  /** Extraction start time for duration calculation */
  extractionStartTime?: number;
  /** Pre-computed DOM tree for element details */
  domTree?: DOMTree;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Warning Detection
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Expected CRO types for PDP pages
 */
const EXPECTED_PDP_TYPES: Array<Exclude<CROType, null>> = [
  'price',
  'cta',
  'gallery',
  'variant',
];

/**
 * Generate warnings for missing expected PDP signals
 */
function generateWarnings(
  elements: EvidenceElement[],
  structuredData: StructuredProductData | null
): string[] {
  const warnings: string[] = [];

  // Get detected CRO types
  const detectedTypes = new Set(elements.map(e => e.croType));

  // Check for missing expected types
  for (const expectedType of EXPECTED_PDP_TYPES) {
    if (!detectedTypes.has(expectedType)) {
      warnings.push(`Missing expected PDP signal: ${expectedType}`);
    }
  }

  // Warn if no structured data but price detected in DOM
  if (!structuredData?.price && detectedTypes.has('price')) {
    warnings.push('Price found in DOM but not in JSON-LD structured data');
  }

  // Warn if structured data has price but DOM doesn't
  if (structuredData?.price && !detectedTypes.has('price')) {
    warnings.push('Price in JSON-LD but not detected in visible DOM elements');
  }

  // Warn if no elements detected at all
  if (elements.length === 0) {
    warnings.push('No CRO elements detected on page');
  }

  // Warn about low confidence elements
  const lowConfidenceCount = elements.filter(e => e.confidence < 0.5).length;
  if (lowConfidenceCount > elements.length / 2) {
    warnings.push(`${lowConfidenceCount} elements have low confidence (<0.5)`);
  }

  return warnings;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Element Conversion
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert ElementBox to EvidenceElement
 */
function boxToEvidenceElement(
  box: ElementBox,
  domTree?: DOMTree
): EvidenceElement | null {
  // Skip if no CRO type (not a classified element)
  if (!box.croType) {
    return null;
  }

  // Get additional info from DOM tree if available
  let tagName = 'unknown';
  let text = '';
  let matchedPatterns: string[] | undefined;

  if (domTree?.elementLookup) {
    const entry = domTree.elementLookup[String(box.elementIndex)];
    if (entry) {
      tagName = entry.tag;
      matchedPatterns = entry.matchedPatterns;
    }
  }

  // Find the node in the tree for text content
  if (domTree?.root) {
    const foundNode = findNodeByIndex(domTree.root, box.elementIndex);
    if (foundNode) {
      text = foundNode.text || '';
      tagName = foundNode.tagName;
    }
  }

  return {
    index: box.elementIndex,
    viewportRef: generateViewportRef(box.viewportIndex, box.elementIndex),
    croType: box.croType,
    confidence: box.confidence,
    tagName,
    text: text.slice(0, 100), // Truncate for LLM token budget
    boundingBox: {
      x: box.x,
      y: box.y,
      width: box.w,
      height: box.h,
    },
    viewportIndices: [box.viewportIndex],
    screenshotRefs: [generateScreenshotId(box.viewportIndex, 'viewport')],
    matchedPatterns,
  };
}

/**
 * Find node in DOM tree by element index (recursive)
 */
function findNodeByIndex(
  node: { index?: number; tagName: string; text: string; children: unknown[] },
  targetIndex: number
): { tagName: string; text: string } | null {
  if (node.index === targetIndex) {
    return node;
  }
  for (const child of node.children) {
    const found = findNodeByIndex(child as typeof node, targetIndex);
    if (found) return found;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Screenshot Conversion
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert ViewportSnapshot to EvidenceScreenshot
 */
function snapshotToEvidence(
  snapshot: ViewportSnapshot,
  visibleIndices: number[]
): EvidenceScreenshot {
  return {
    id: generateScreenshotId(snapshot.viewportIndex, 'viewport'),
    viewportIndex: snapshot.viewportIndex,
    type: 'viewport',
    scrollY: snapshot.scrollPosition,
    startY: snapshot.scrollPosition,
    endY: snapshot.scrollPosition + 720, // Assuming standard viewport height
    width: 1280, // Standard width
    height: 720, // Standard viewport height
    isAboveFold: snapshot.viewportIndex === 0,
    timestamp: new Date(snapshot.screenshot.capturedAt).toISOString(),
    visibleElementIndices: visibleIndices,
    base64: snapshot.fullResolutionBase64 || snapshot.screenshot.base64,
  };
}

/**
 * Convert ScreenshotTile to EvidenceScreenshot
 */
function tileToEvidence(
  tile: ScreenshotTile,
  visibleIndices: number[]
): EvidenceScreenshot {
  return {
    id: generateScreenshotId(tile.index, 'tile'),
    viewportIndex: tile.index,
    type: 'tile',
    scrollY: tile.startY,
    startY: tile.startY,
    endY: tile.endY,
    width: tile.width,
    height: tile.height,
    isAboveFold: tile.isAboveFold,
    timestamp: new Date().toISOString(),
    visibleElementIndices: visibleIndices,
    base64: tile.base64,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Metrics Computation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute extraction metrics from evidence data
 */
function computeMetrics(
  elements: EvidenceElement[],
  screenshots: EvidenceScreenshot[],
  structuredData: StructuredProductData | null,
  pageHeight: number | null,
  extractionStartTime?: number,
  warningCount: number = 0
): ExtractionMetrics {
  const metrics = createEmptyMetrics();

  // Count elements by CRO type
  for (const element of elements) {
    if (element.croType in metrics.detectedCounts) {
      metrics.detectedCounts[element.croType]++;
    }
  }

  // Calculate mapped box coverage
  const elementsWithBoxes = elements.filter(
    e => e.boundingBox.width > 0 && e.boundingBox.height > 0
  ).length;
  metrics.mappedBoxCoverage = elements.length > 0
    ? elementsWithBoxes / elements.length
    : 0;

  // Calculate screenshot coverage (percentage of page covered)
  if (pageHeight && pageHeight > 0 && screenshots.length > 0) {
    const coveredHeight = screenshots.reduce((sum, s) => {
      return sum + (s.endY - s.startY);
    }, 0);
    // Account for overlap by capping at pageHeight
    metrics.screenshotCoverage = Math.min(1, coveredHeight / pageHeight);
  }

  // Structured data presence
  metrics.structuredDataPresence = structuredData ? 1 : 0;

  // Above fold coverage (elements visible in first viewport)
  const aboveFoldElements = elements.filter(e => e.viewportIndices.includes(0));
  const importantTypes: Array<Exclude<CROType, null>> = ['cta', 'price', 'value_prop'];
  const importantAboveFold = aboveFoldElements.filter(
    e => importantTypes.includes(e.croType)
  ).length;
  const totalImportant = elements.filter(
    e => importantTypes.includes(e.croType)
  ).length;
  metrics.aboveFoldCoverage = totalImportant > 0
    ? importantAboveFold / totalImportant
    : 0;

  // Warning count
  metrics.warningCount = warningCount;

  // Extraction duration
  if (extractionStartTime) {
    metrics.extractionDurationMs = Date.now() - extractionStartTime;
  }

  return metrics;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Builder Function
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a complete EvidencePackage from collected data
 *
 * @param input - Input data for building the package
 * @returns Complete EvidencePackage with deterministic ordering
 */
export function buildEvidencePackage(input: BuildEvidenceInput): EvidencePackage {
  const {
    url,
    runId,
    mode,
    viewportWidth,
    viewportHeight,
    pageHeight,
    snapshots = [],
    tiles = [],
    structuredData,
    elementBoxes = [],
    extractionStartTime,
    domTree,
  } = input;

  logger.debug('Building evidence package', {
    url,
    mode,
    snapshotCount: snapshots.length,
    tileCount: tiles.length,
    elementBoxCount: elementBoxes.length,
  });

  // Generate run ID if not provided
  const finalRunId = runId || generateRunId(new Date(), url);

  // Convert element boxes to evidence elements
  // Dedup by absolute page coordinates: same physical element across viewports
  // has identical absolute coords (computed via rect.y + window.scrollY in build-dom-tree.js)
  const elements: EvidenceElement[] = [];
  const seenDedupKeys = new Set<string>();

  // Sort by confidence descending, then by index for deterministic ordering
  const sortedBoxes = [...elementBoxes].sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return a.elementIndex - b.elementIndex;
  });

  for (const box of sortedBoxes) {
    // Dedup key: elementIndex + rounded absolute coordinates
    const dedupKey = `${box.elementIndex}-${Math.round(box.x)}-${Math.round(box.y)}`;

    if (seenDedupKeys.has(dedupKey)) {
      // Update existing element with additional viewport
      const existing = elements.find(
        e => e.index === box.elementIndex
          && Math.round(e.boundingBox.x) === Math.round(box.x)
          && Math.round(e.boundingBox.y) === Math.round(box.y)
      );
      if (existing && !existing.viewportIndices.includes(box.viewportIndex)) {
        existing.viewportIndices.push(box.viewportIndex);
        existing.screenshotRefs.push(generateScreenshotId(box.viewportIndex, 'viewport'));
      }
      continue;
    }

    const element = boxToEvidenceElement(box, domTree);
    if (element) {
      elements.push(element);
      seenDedupKeys.add(dedupKey);
    }
  }

  // Sort elements by index for stable ordering
  elements.sort((a, b) => a.index - b.index);

  // Build element index lookup for screenshot visible indices
  const elementsByViewport = new Map<number, number[]>();
  for (const element of elements) {
    for (const vIdx of element.viewportIndices) {
      if (!elementsByViewport.has(vIdx)) {
        elementsByViewport.set(vIdx, []);
      }
      elementsByViewport.get(vIdx)!.push(element.index);
    }
  }

  // Convert screenshots based on mode
  const screenshots: EvidenceScreenshot[] = [];

  if (mode === 'tiled' && tiles.length > 0) {
    // Tiled mode: use tiles
    for (const tile of tiles) {
      const visibleIndices = elementsByViewport.get(tile.index) || [];
      screenshots.push(tileToEvidence(tile, visibleIndices));
    }
  } else if (snapshots.length > 0) {
    // Viewport mode: use snapshots
    for (const snapshot of snapshots) {
      const visibleIndices = elementsByViewport.get(snapshot.viewportIndex) || [];
      screenshots.push(snapshotToEvidence(snapshot, visibleIndices));
    }
  }

  // Sort screenshots by viewport index
  screenshots.sort((a, b) => a.viewportIndex - b.viewportIndex);

  // Generate warnings
  const warnings = generateWarnings(elements, structuredData);

  // Compute metrics
  const metrics = computeMetrics(
    elements,
    screenshots,
    structuredData,
    pageHeight,
    extractionStartTime,
    warnings.length
  );

  // Build final package
  const evidencePackage: EvidencePackage = {
    schemaVersion: '1.0.0',
    url,
    runId: finalRunId,
    timestamp: new Date().toISOString(),
    mode,
    viewportHeight,
    viewportWidth,
    pageHeight,
    structuredData,
    elements,
    screenshots,
    metrics,
    warnings,
  };

  logger.info('Evidence package built', {
    runId: finalRunId,
    elementCount: elements.length,
    screenshotCount: screenshots.length,
    warningCount: warnings.length,
  });

  return evidencePackage;
}

/**
 * Write evidence package to JSON file
 */
export async function writeEvidenceJson(
  evidencePackage: EvidencePackage,
  outputPath: string
): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });

  // Write with deterministic key ordering
  const json = JSON.stringify(evidencePackage, null, 2);
  await fs.writeFile(outputPath, json, 'utf-8');

  logger.info('Evidence JSON written', { path: outputPath });
}
