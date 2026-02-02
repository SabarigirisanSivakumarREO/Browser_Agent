/**
 * Capture Viewport Tool - Phase 21g (T338) + Phase 21h (T361b)
 *
 * Captures both a screenshot and DOM tree at the current scroll position.
 * This dual capture enables cross-referencing between DOM elements and visual appearance.
 * Phase 21h adds bounding box extraction for evidence capture.
 */

import sharp from 'sharp';
import type { VisionToolDefinition, VisionToolContext, CaptureViewportInput, CaptureViewportOutput, ViewportSnapshot } from '../types.js';
import type { BoundingBox } from '../../../heuristics/vision/types.js';
import type { DOMTree, DOMNode } from '../../../models/dom-tree.js';
import { DOMExtractor } from '../../../browser/dom/extractor.js';
import { DOMSerializer } from '../../../browser/dom/serializer.js';
import { mapElementsToScreenshot, filterVisibleElements } from '../../../browser/dom/coordinate-mapper.js';
import { createLogger } from '../../../utils/index.js';
import type { Page } from 'playwright';

const logger = createLogger('CaptureViewportTool');

/**
 * Token budget for DOM serialization in vision agent
 * Keep very low since we also send screenshots and accumulate conversation history
 */
const VISION_DOM_TOKEN_BUDGET = 2000;

/**
 * Phase 21h (T361b): Extract bounding boxes for DOM elements using Playwright
 * Returns a map of element index to BoundingBox
 */
async function extractElementBoundingBoxes(
  page: Page,
  domTree: DOMTree,
  viewportIndex: number
): Promise<Map<number, BoundingBox>> {
  const boundingBoxMap = new Map<number, BoundingBox>();

  // Collect all elements with an index from the DOM tree
  const elementsWithIndex: { index: number; xpath: string }[] = [];

  const collectElements = (node: DOMNode) => {
    if (node.index !== undefined && node.xpath) {
      elementsWithIndex.push({ index: node.index, xpath: node.xpath });
    }
    if (node.children) {
      for (const child of node.children) {
        collectElements(child);
      }
    }
  };
  collectElements(domTree.root);

  // Get bounding boxes for each element
  for (const { index, xpath } of elementsWithIndex) {
    try {
      // Use xpath to locate element
      const locator = page.locator(`xpath=${xpath}`);
      const count = await locator.count();

      if (count > 0) {
        const box = await locator.first().boundingBox();
        if (box) {
          boundingBoxMap.set(index, {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            viewportIndex,
          });
        }
      }
    } catch (error) {
      // Element might not be visible or xpath might be invalid
      // Silently skip - this is expected for some elements
      logger.debug('Could not get bounding box for element', { index, xpath });
    }
  }

  logger.debug('Extracted bounding boxes', {
    total: elementsWithIndex.length,
    found: boundingBoxMap.size,
  });

  return boundingBoxMap;
}

/**
 * Target image width for compressed screenshots
 * Smaller images = fewer base64 characters = lower rate limit impact
 * 384px is sufficient for basic visual analysis while keeping size minimal
 */
const COMPRESSED_IMAGE_WIDTH = 384;

/**
 * JPEG quality for compressed screenshots (0-100)
 * 50% is sufficient for heuristic analysis while minimizing size
 */
const JPEG_QUALITY = 50;

/**
 * Compress a screenshot buffer to reduce base64 size
 * Uses JPEG format with reduced dimensions
 */
async function compressScreenshot(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(COMPRESSED_IMAGE_WIDTH, null, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

/**
 * JSON Schema for capture_viewport parameters
 */
const CAPTURE_VIEWPORT_SCHEMA = {
  type: 'object',
  properties: {
    reason: {
      type: 'string',
      description: 'Brief explanation of why you are capturing this viewport (e.g., "Initial capture at page top", "Capturing after scroll to see CTA")',
    },
  },
  required: ['reason'],
  additionalProperties: false,
};

/**
 * Create the capture_viewport tool
 */
export function createCaptureViewportTool(): VisionToolDefinition {
  const extractor = new DOMExtractor();
  const serializer = new DOMSerializer({ maxTokens: VISION_DOM_TOKEN_BUDGET });

  return {
    name: 'capture_viewport',
    description:
      'Captures a screenshot AND extracts the DOM tree at the current scroll position. ' +
      'Use this to get visual and structural context for heuristic evaluation. ' +
      'Returns both image data and serialized DOM elements with indexes [0], [1], etc. ' +
      'You should capture each viewport before evaluating heuristics for that region.',
    parameters: CAPTURE_VIEWPORT_SCHEMA,

    async execute(input: unknown, context: VisionToolContext): Promise<CaptureViewportOutput> {
      const params = input as CaptureViewportInput;
      const { page, state } = context;

      try {
        logger.debug('Capturing viewport', { reason: params.reason, scrollY: state.currentScrollY });

        // Capture screenshot as PNG
        const rawScreenshotBuffer = await page.screenshot({
          type: 'png',
          fullPage: false,  // Just current viewport
        });

        // Compress to JPEG with reduced dimensions to minimize base64 size
        // This significantly reduces the rate limit impact (500KB PNG -> ~20KB JPEG)
        const compressedBuffer = await compressScreenshot(rawScreenshotBuffer);
        const screenshotBase64 = compressedBuffer.toString('base64');

        logger.info('Screenshot compressed', {
          originalSize: `${(rawScreenshotBuffer.length / 1024).toFixed(1)}KB`,
          compressedSize: `${(compressedBuffer.length / 1024).toFixed(1)}KB`,
          base64Tokens: Math.ceil(compressedBuffer.length * 1.33 / 4),
        });

        // Extract DOM
        const domTree = await extractor.extract(page);

        // Serialize DOM with token budget
        const serialized = serializer.serialize(domTree);

        // Phase 21h (T361b): Extract bounding boxes for elements
        const viewportIndex = state.snapshots.length;
        const elementBoundingBoxes = await extractElementBoundingBoxes(page, domTree, viewportIndex);

        // Phase 21i: Map DOM elements to screenshot coordinates
        // This enables viewport-scoped DOM context (only visible elements)
        const viewport = {
          width: state.viewport.width,
          height: state.viewport.height,
          deviceScaleFactor: state.viewport.deviceScaleFactor ?? 1,
          isMobile: state.viewport.isMobile ?? false,
        };
        const elementMappings = mapElementsToScreenshot(domTree, state.currentScrollY, viewport);
        const visibleElements = filterVisibleElements(elementMappings);

        logger.debug('Element mappings computed', {
          totalMappings: elementMappings.length,
          visibleElements: visibleElements.length,
        });

        // Create snapshot
        const snapshot: ViewportSnapshot = {
          scrollPosition: state.currentScrollY,
          viewportIndex,
          screenshot: {
            base64: screenshotBase64,
            capturedAt: Date.now(),
          },
          dom: {
            tree: domTree,
            serialized: serialized.text,
            elementCount: serialized.elementCount,
          },
          heuristicsEvaluated: [],
          // Phase 21h: Include element bounding boxes for evidence capture
          elementBoundingBoxes: elementBoundingBoxes.size > 0 ? elementBoundingBoxes : undefined,
          // Phase 21i: DOM-Screenshot coordinate mappings for viewport-scoped context
          elementMappings,
          visibleElements,
        };

        logger.debug('Viewport captured', {
          viewportIndex: snapshot.viewportIndex,
          scrollPosition: snapshot.scrollPosition,
          domElements: snapshot.dom.elementCount,
          visibleElements: visibleElements.length,
          screenshotSize: screenshotBase64.length,
        });

        // Return success with snapshot for internal state management
        // But DON'T include full screenshot in tool result (would inflate message context)
        return {
          success: true,
          snapshot,  // Full snapshot for agent state
          // Clean summary for tool result message (excludes base64 image)
          message: `Viewport captured at scroll position ${state.currentScrollY}px. DOM: ${snapshot.dom.elementCount} elements total, ${visibleElements.length} visible in this viewport. Screenshot ready for analysis.`,
        };

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to capture viewport', { error: message });

        return {
          success: false,
          error: `Failed to capture viewport: ${message}`,
        };
      }
    },
  };
}
