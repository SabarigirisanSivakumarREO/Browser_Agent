/**
 * Tiled Screenshot Mode - Phase 25e (T493-T498)
 *
 * Captures full-page screenshots as overlapping tiles for comprehensive analysis.
 * This is an alternative to viewport-by-viewport capture, providing:
 * - Consistent tile heights for LLM token optimization
 * - Overlapping regions to prevent element clipping
 * - Above-fold annotation on the first tile
 */

import type { Page } from 'playwright';
import sharp from 'sharp';
import { createLogger } from '../utils/index.js';
import { annotateFoldLine, type FoldLineOptions } from './screenshot-annotator.js';
import {
  computeLayoutBoxes,
  getElementIndicesByCROType,
  type ElementBox,
} from '../browser/dom/coordinate-mapper.js';
import type { DOMTree } from '../models/dom-tree.js';
import type { CROType } from '../models/dom-tree.js';
// Phase 25h (T527): Media readiness checks
import { waitForMediaReadiness } from '../browser/media/index.js';

const logger = createLogger('TiledScreenshot');

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for tiled screenshot capture (T493)
 * Phase 25g: Added layout mapping options (T512)
 * Phase 25h: Added media readiness options (T527)
 */
export interface TiledScreenshotConfig {
  /** Maximum height of each tile in pixels (default: 1800) */
  maxTileHeight: number;
  /** Overlap between tiles in pixels (default: 100) */
  overlapPx: number;
  /** Maximum number of tiles to capture (default: 5) */
  maxTiles: number;
  /** Annotate first tile with fold line (default: true) */
  annotateFoldLine: boolean;
  /** Viewport height for fold line annotation (default: 800) */
  viewportHeight: number;
  /** Enable layout box mapping for evidence (default: true) */
  enableLayoutMapping: boolean;
  /** Maximum elements per CRO type for layout mapping (default: 20) */
  layoutMappingLimit: number;
  /** CRO types to map for layout boxes */
  layoutMappingTypes: Array<Exclude<CROType, null>>;
  /** Enable media readiness checks before capture (default: true) */
  waitForMediaReadiness: boolean;
  /** Timeout for media readiness check in ms (default: 3000) */
  mediaReadinessTimeoutMs: number;
}

/**
 * Default tiled screenshot configuration
 */
export const DEFAULT_TILED_CONFIG: TiledScreenshotConfig = {
  maxTileHeight: 1800,
  overlapPx: 100,
  maxTiles: 5,
  annotateFoldLine: true,
  viewportHeight: 800,
  enableLayoutMapping: true,
  layoutMappingLimit: 20,
  layoutMappingTypes: ['cta', 'price', 'variant', 'shipping', 'stock', 'gallery'],
  waitForMediaReadiness: true,
  mediaReadinessTimeoutMs: 3000,
};

/**
 * Represents a single screenshot tile (T493)
 * Phase 25g: Added layoutBoxes (T512)
 */
export interface ScreenshotTile {
  /** Zero-based index of this tile */
  index: number;
  /** Starting Y position in page coordinates */
  startY: number;
  /** Ending Y position in page coordinates */
  endY: number;
  /** Screenshot image buffer (PNG) */
  buffer: Buffer;
  /** Whether this tile is above the fold (first tile) */
  isAboveFold: boolean;
  /** Width of the tile in pixels */
  width: number;
  /** Height of the tile in pixels */
  height: number;
  /** Base64 encoded screenshot */
  base64?: string;
  /** Element bounding boxes visible in this tile (Phase 25g) */
  layoutBoxes?: ElementBox[];
}

/**
 * Result from tiled screenshot capture
 * Phase 25g: Added allLayoutBoxes for evidence packaging (T512)
 */
export interface TiledScreenshotResult {
  /** Whether capture was successful */
  success: boolean;
  /** Captured tiles */
  tiles: ScreenshotTile[];
  /** Total page height */
  pageHeight: number;
  /** Error message if failed */
  error?: string;
  /** Time taken to capture all tiles */
  captureTimeMs: number;
  /** All layout boxes across all tiles (Phase 25g) */
  allLayoutBoxes?: ElementBox[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate tile boundaries for full-page capture
 */
function calculateTileBoundaries(
  pageHeight: number,
  config: TiledScreenshotConfig
): Array<{ startY: number; endY: number }> {
  const tiles: Array<{ startY: number; endY: number }> = [];

  if (pageHeight <= 0) {
    return tiles;
  }

  let currentY = 0;
  let tileIndex = 0;

  while (currentY < pageHeight && tileIndex < config.maxTiles) {
    const startY = currentY;
    // End Y is either maxTileHeight from start or the page bottom
    const endY = Math.min(startY + config.maxTileHeight, pageHeight);

    tiles.push({ startY, endY });

    // Move to next tile position, accounting for overlap
    // If this is the last tile (reaches page bottom), don't add another
    if (endY >= pageHeight) {
      break;
    }

    // Next tile starts at (endY - overlapPx)
    currentY = endY - config.overlapPx;
    tileIndex++;
  }

  return tiles;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Capture full page as overlapping tiles (T494)
 * Phase 25g: Added optional domTree parameter for layout mapping (T512)
 *
 * @param page - Playwright page instance
 * @param config - Tiled screenshot configuration
 * @param domTree - Optional DOM tree for layout box computation
 * @returns Array of screenshot tiles with optional layout boxes
 */
export async function captureTiledScreenshots(
  page: Page,
  config: Partial<TiledScreenshotConfig> = {},
  domTree?: DOMTree
): Promise<TiledScreenshotResult> {
  const startTime = Date.now();
  const mergedConfig: TiledScreenshotConfig = { ...DEFAULT_TILED_CONFIG, ...config };

  logger.debug('Starting tiled screenshot capture', {
    maxTileHeight: mergedConfig.maxTileHeight,
    overlapPx: mergedConfig.overlapPx,
    maxTiles: mergedConfig.maxTiles,
  });

  try {
    // Get page dimensions
    const pageDimensions = await page.evaluate(() => ({
      pageHeight: document.documentElement.scrollHeight,
      pageWidth: document.documentElement.scrollWidth,
    }));

    const { pageHeight } = pageDimensions;

    if (pageHeight <= 0) {
      return {
        success: false,
        tiles: [],
        pageHeight: 0,
        error: 'Page has no height',
        captureTimeMs: Date.now() - startTime,
      };
    }

    logger.debug('Page dimensions', { pageHeight });

    // Calculate tile boundaries
    const boundaries = calculateTileBoundaries(pageHeight, mergedConfig);

    if (boundaries.length === 0) {
      return {
        success: false,
        tiles: [],
        pageHeight,
        error: 'No tiles to capture',
        captureTimeMs: Date.now() - startTime,
      };
    }

    logger.debug('Calculated tile boundaries', { count: boundaries.length });

    // Scroll to top first
    await page.evaluate('window.scrollTo(0, 0)');
    await new Promise((r) => setTimeout(r, 100));

    // Phase 25h (T527): Wait for media readiness before capture
    if (mergedConfig.waitForMediaReadiness) {
      const readinessResult = await waitForMediaReadiness(page, {
        timeoutMs: mergedConfig.mediaReadinessTimeoutMs,
        minImageSize: 50,
      });

      if (readinessResult.timedOut && readinessResult.imagesPending > 0) {
        logger.warn('Media readiness timed out for tiled capture', {
          imagesPending: readinessResult.imagesPending,
          waitTimeMs: readinessResult.waitTimeMs,
        });
      } else {
        logger.debug('Media readiness complete for tiled capture', {
          imagesLoaded: readinessResult.imagesLoaded,
          waitTimeMs: readinessResult.waitTimeMs,
        });
      }
    }

    // Take full-page screenshot once
    const fullScreenshot = await page.screenshot({
      type: 'png',
      fullPage: true,
    });

    const fullMetadata = await sharp(fullScreenshot).metadata();
    const fullWidth = fullMetadata.width || 1280;
    const fullHeight = fullMetadata.height || pageHeight;

    // Phase 25g: Prepare for layout box computation (T512)
    let allElementIndices: number[] = [];
    if (mergedConfig.enableLayoutMapping && domTree?.elementLookup) {
      try {
        const elementIndicesByType = getElementIndicesByCROType(
          domTree,
          mergedConfig.layoutMappingTypes,
          mergedConfig.layoutMappingLimit
        );
        for (const indices of Object.values(elementIndicesByType)) {
          allElementIndices.push(...indices);
        }
        logger.debug('Layout mapping element indices collected', { count: allElementIndices.length });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.warn('Failed to collect element indices for layout mapping', { error: errMsg });
      }
    }

    // Capture each tile
    const tiles: ScreenshotTile[] = [];
    const allLayoutBoxes: ElementBox[] = [];

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i]!;
      const isFirstTile = i === 0;

      // Calculate actual height within image bounds
      const actualEndY = Math.min(boundary.endY, fullHeight);
      const actualHeight = actualEndY - boundary.startY;

      if (actualHeight <= 0) {
        logger.warn('Skipping tile with zero height', { index: i });
        continue;
      }

      // Extract tile from full screenshot
      let tileBuffer = await sharp(fullScreenshot)
        .extract({
          left: 0,
          top: boundary.startY,
          width: fullWidth,
          height: actualHeight,
        })
        .png()
        .toBuffer();

      // Annotate first tile with fold line if configured
      if (isFirstTile && mergedConfig.annotateFoldLine) {
        const foldOptions: FoldLineOptions = {
          viewportHeight: mergedConfig.viewportHeight,
          showLabel: true,
        };

        const foldResult = await annotateFoldLine(tileBuffer, foldOptions);

        if (foldResult.success && foldResult.annotatedBuffer) {
          tileBuffer = foldResult.annotatedBuffer;
          logger.debug('Fold line annotated on first tile');
        } else {
          logger.warn('Failed to annotate fold line', { error: foldResult.error });
        }
      }

      // Phase 25g: Compute layout boxes for elements visible in this tile (T512)
      let tileLayoutBoxes: ElementBox[] | undefined;
      if (mergedConfig.enableLayoutMapping && domTree && allElementIndices.length > 0) {
        try {
          // Compute boxes relative to tile's scroll position
          const boxes = await computeLayoutBoxes(
            page,
            allElementIndices,
            domTree,
            boundary.startY,
            i, // viewportIndex = tile index
            actualHeight
          );

          // Filter to only include boxes visible in this tile
          tileLayoutBoxes = boxes.filter(box => box.isVisible);

          if (tileLayoutBoxes.length > 0) {
            allLayoutBoxes.push(...tileLayoutBoxes);
            logger.debug('Layout boxes computed for tile', {
              tileIndex: i,
              boxCount: tileLayoutBoxes.length,
            });
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : 'Unknown error';
          logger.warn('Failed to compute layout boxes for tile', { tileIndex: i, error: errMsg });
          // Continue without layout boxes for this tile
        }
      }

      const tile: ScreenshotTile = {
        index: i,
        startY: boundary.startY,
        endY: actualEndY,
        buffer: tileBuffer,
        isAboveFold: isFirstTile,
        width: fullWidth,
        height: actualHeight,
        base64: tileBuffer.toString('base64'),
        layoutBoxes: tileLayoutBoxes,
      };

      tiles.push(tile);

      logger.debug('Captured tile', {
        index: i,
        startY: boundary.startY,
        endY: actualEndY,
        height: actualHeight,
        layoutBoxCount: tileLayoutBoxes?.length ?? 0,
      });
    }

    const captureTimeMs = Date.now() - startTime;

    logger.info('Tiled screenshot capture complete', {
      tilesCapture: tiles.length,
      pageHeight,
      captureTimeMs,
      totalLayoutBoxes: allLayoutBoxes.length,
    });

    return {
      success: true,
      tiles,
      pageHeight,
      captureTimeMs,
      allLayoutBoxes: allLayoutBoxes.length > 0 ? allLayoutBoxes : undefined,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to capture tiled screenshots', { error: errorMsg });

    return {
      success: false,
      tiles: [],
      pageHeight: 0,
      error: errorMsg,
      captureTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Convert screenshot tiles to viewport snapshots format
 * for compatibility with existing analysis pipeline
 */
export function tilesToSnapshots(
  tiles: ScreenshotTile[]
): Array<{
  viewportIndex: number;
  scrollPosition: number;
  screenshot: { base64: string };
  isAboveFold: boolean;
}> {
  return tiles.map((tile) => ({
    viewportIndex: tile.index,
    scrollPosition: tile.startY,
    screenshot: { base64: tile.base64 || tile.buffer.toString('base64') },
    isAboveFold: tile.isAboveFold,
  }));
}
