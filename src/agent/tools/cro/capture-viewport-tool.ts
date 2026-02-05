/**
 * Capture Viewport Tool - CR-001-B
 *
 * Captures both a screenshot and DOM snapshot at the current scroll position.
 * This dual capture enables cross-referencing between DOM elements and visual appearance
 * during the collection phase of the unified CRO agent.
 */

import { z } from 'zod';
import sharp from 'sharp';
import type { Tool, ToolContext } from '../types.js';
import type { ToolResult, ViewportSnapshot } from '../../../models/index.js';
import type { ViewportInfo } from '../../../models/page-state.js';
import { DOMExtractor } from '../../../browser/dom/extractor.js';
import { DOMSerializer } from '../../../browser/dom/serializer.js';
import { mapElementsToScreenshot, filterVisibleElements } from '../../../browser/dom/coordinate-mapper.js';
import { annotateFoldLine } from '../../../output/screenshot-annotator.js';

/**
 * Token budget for DOM serialization
 * Keep low since we also send screenshots and accumulate conversation history
 */
const DOM_TOKEN_BUDGET = 2000;

/**
 * Target image width for compressed screenshots
 * Smaller images = fewer tokens = lower cost
 */
const COMPRESSED_IMAGE_WIDTH = 384;

/**
 * JPEG quality for compressed screenshots (0-100)
 */
const JPEG_QUALITY = 50;

/**
 * Configuration for viewport capture
 * Phase 25d: Added annotateFoldLine for first viewport annotation
 */
export interface CaptureViewportConfig {
  /** Annotate fold line on first viewport (default: true) */
  annotateFoldLine: boolean;
  /** DOM token budget (default: 2000) */
  domTokenBudget: number;
  /** Compressed image width (default: 384) */
  compressedImageWidth: number;
  /** JPEG quality 0-100 (default: 50) */
  jpegQuality: number;
}

/**
 * Default capture viewport configuration
 */
export const DEFAULT_CAPTURE_VIEWPORT_CONFIG: CaptureViewportConfig = {
  annotateFoldLine: true,
  domTokenBudget: DOM_TOKEN_BUDGET,
  compressedImageWidth: COMPRESSED_IMAGE_WIDTH,
  jpegQuality: JPEG_QUALITY,
};

/**
 * Global capture viewport config (can be modified at runtime)
 */
let captureViewportConfig: CaptureViewportConfig = { ...DEFAULT_CAPTURE_VIEWPORT_CONFIG };

/**
 * Set capture viewport configuration
 */
export function setCaptureViewportConfig(config: Partial<CaptureViewportConfig>): void {
  captureViewportConfig = { ...captureViewportConfig, ...config };
}

/**
 * Get current capture viewport configuration
 */
export function getCaptureViewportConfig(): CaptureViewportConfig {
  return { ...captureViewportConfig };
}

/**
 * Compress a screenshot buffer to reduce base64 size
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
 * Zod schema for capture_viewport parameters
 */
export const CaptureViewportParamsSchema = z.object({
  reason: z.string().describe('Brief explanation of why you are capturing this viewport'),
});

export type CaptureViewportParams = z.infer<typeof CaptureViewportParamsSchema>;

/**
 * Extended tool result with viewport snapshot
 */
export interface CaptureViewportResult extends ToolResult {
  snapshot?: ViewportSnapshot;
}

/**
 * Capture viewport tool definition
 *
 * Captures DOM + screenshot at current scroll position for later analysis.
 * Used during the collection phase of the unified CRO agent.
 */
export const captureViewportTool: Tool = {
  name: 'capture_viewport',
  description:
    'Captures a screenshot AND extracts the DOM at the current scroll position. ' +
    'Use this during the collection phase to gather visual and structural data. ' +
    'After capturing, scroll to reveal more content and capture again. ' +
    'Call collection_done when you have captured all viewports.',
  parameters: CaptureViewportParamsSchema,

  async execute(context: ToolContext): Promise<CaptureViewportResult> {
    const params = context.params as CaptureViewportParams;
    const { page, logger } = context;

    try {
      logger.debug('Capturing viewport', { reason: params.reason });

      // Get current scroll position and viewport dimensions
      const scrollInfo = await page.evaluate(`(() => ({
        scrollY: window.scrollY,
        pageHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        devicePixelRatio: window.devicePixelRatio || 1,
      }))()`);
      const { scrollY, pageHeight, viewportHeight, viewportWidth, devicePixelRatio } = scrollInfo as {
        scrollY: number;
        pageHeight: number;
        viewportHeight: number;
        viewportWidth: number;
        devicePixelRatio: number;
      };

      // Build ViewportInfo for coordinate mapping
      const viewport: ViewportInfo = {
        width: viewportWidth,
        height: viewportHeight,
        deviceScaleFactor: devicePixelRatio,
        isMobile: viewportWidth < 768,
      };

      // Capture screenshot as PNG
      const rawScreenshotBuffer = await page.screenshot({
        type: 'png',
        fullPage: false, // Just current viewport
      });

      // Phase 25d: Annotate fold line on first viewport (scrollY === 0)
      const isFirstViewport = scrollY === 0;
      let screenshotBuffer = rawScreenshotBuffer;

      if (isFirstViewport && captureViewportConfig.annotateFoldLine) {
        logger.debug('Annotating fold line on first viewport', { viewportHeight });
        const foldResult = await annotateFoldLine(rawScreenshotBuffer, {
          viewportHeight,
          showLabel: true,
        });
        if (foldResult.success && foldResult.annotatedBuffer) {
          screenshotBuffer = foldResult.annotatedBuffer;
          logger.debug('Fold line annotation applied');
        } else {
          logger.warn('Fold line annotation failed', { error: foldResult.error });
          // Continue with original screenshot
        }
      }

      // Compress to JPEG to reduce size
      const compressedBuffer = await compressScreenshot(screenshotBuffer);
      const screenshotBase64 = compressedBuffer.toString('base64');

      logger.debug('Screenshot compressed', {
        originalSize: `${(screenshotBuffer.length / 1024).toFixed(1)}KB`,
        compressedSize: `${(compressedBuffer.length / 1024).toFixed(1)}KB`,
        foldLineAnnotated: isFirstViewport && captureViewportConfig.annotateFoldLine,
      });

      // Extract and serialize DOM
      const extractor = new DOMExtractor();
      const serializer = new DOMSerializer({ maxTokens: DOM_TOKEN_BUDGET });
      const domTree = await extractor.extract(page);
      const serialized = serializer.serialize(domTree);

      // Phase 21i: Map DOM elements to screenshot coordinates
      const elementMappings = mapElementsToScreenshot(domTree, scrollY, viewport);
      const visibleElements = filterVisibleElements(elementMappings);

      logger.debug('Element mappings computed', {
        totalMappings: elementMappings.length,
        visibleElements: visibleElements.length,
      });

      // Create snapshot (viewportIndex will be set by caller)
      const snapshot: ViewportSnapshot = {
        scrollPosition: scrollY,
        viewportIndex: 0, // Will be updated by state manager
        screenshot: {
          base64: screenshotBase64,
          capturedAt: Date.now(),
        },
        dom: {
          serialized: serialized.text,
          elementCount: serialized.elementCount,
        },
        // Phase 21i: DOM-Screenshot coordinate mappings
        elementMappings,
        visibleElements,
      };

      logger.info('Viewport captured', {
        scrollY,
        domElements: snapshot.dom.elementCount,
        visibleElements: visibleElements.length,
        screenshotSize: `${(compressedBuffer.length / 1024).toFixed(1)}KB`,
        scrollProgress: `${((scrollY / Math.max(1, pageHeight - viewportHeight)) * 100).toFixed(0)}%`,
      });

      return {
        success: true,
        insights: [],
        snapshot,
        extracted: {
          scrollPosition: scrollY,
          domElements: snapshot.dom.elementCount,
          visibleElements: visibleElements.length,
          pageHeight,
          message: `Viewport captured at ${scrollY}px. DOM: ${snapshot.dom.elementCount} elements, ${visibleElements.length} visible. Scroll progress: ${((scrollY / Math.max(1, pageHeight - viewportHeight)) * 100).toFixed(0)}%`,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to capture viewport', { error: message });

      return {
        success: false,
        insights: [],
        error: `Failed to capture viewport: ${message}`,
      };
    }
  },
};
