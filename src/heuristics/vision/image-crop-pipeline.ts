/**
 * Image Crop Pipeline — Phase 30c (T659-T662)
 *
 * Category-aware auto-cropping with token-aware compression.
 * Crops screenshots to CRO-relevant regions per category, then
 * compresses to fit within a per-image token budget.
 */

import sharp from 'sharp';
import type { ElementMapping } from '../../browser/dom/coordinate-mapper.js';
import { computeCropRegion } from './category-crop-mapper.js';
import { calculateImageTokens, findOptimalDimensions } from './image-token-calculator.js';

/** Configuration for the crop pipeline */
export interface CropPipelineConfig {
  /** Maximum tokens per image (default: 300) */
  maxTokensPerImage: number;
  /** Padding around crop region in pixels (default: 50) */
  paddingPx: number;
  /** Minimum crop dimension in pixels (default: 100) */
  minCropSize: number;
  /** JPEG quality range [min, max] (default: [30, 70]) */
  jpegQualityRange: [number, number];
  /** Skip crop if region covers more than this ratio (default: 0.8) */
  coverageThreshold: number;
}

/** Default pipeline configuration */
export const DEFAULT_CROP_CONFIG: CropPipelineConfig = {
  maxTokensPerImage: 300,
  paddingPx: 50,
  minCropSize: 100,
  jpegQualityRange: [30, 70],
  coverageThreshold: 0.8,
};

/** Result from the crop pipeline */
export interface CropResult {
  /** Compressed image as base64 */
  base64: string;
  /** Estimated token cost */
  tokens: number;
  /** Whether cropping was applied (false = full image fallback) */
  cropped: boolean;
}

/**
 * Crop and compress a screenshot for a specific category.
 *
 * 1. Compute crop region from relevant elements
 * 2. Crop with sharp (or use full image if no region / >80% coverage)
 * 3. Find optimal dimensions within token budget
 * 4. Compress with best JPEG quality that fits
 *
 * @param screenshotBase64 - Full viewport screenshot as base64
 * @param category - Heuristic category name
 * @param visibleElements - Element mappings with screenshot coords
 * @param vpWidth - Viewport width
 * @param vpHeight - Viewport height
 * @param config - Pipeline configuration
 */
export async function cropForCategory(
  screenshotBase64: string,
  category: string,
  visibleElements: ElementMapping[],
  vpWidth: number,
  vpHeight: number,
  config?: Partial<CropPipelineConfig>
): Promise<CropResult> {
  const cfg = { ...DEFAULT_CROP_CONFIG, ...config };
  const buffer = Buffer.from(screenshotBase64, 'base64');

  // Step 1: Compute crop region
  const cropRegion = computeCropRegion(
    category,
    visibleElements,
    vpWidth,
    vpHeight,
    cfg.paddingPx,
    cfg.coverageThreshold,
    cfg.minCropSize
  );

  // Step 2: Crop or use full image
  let imageBuffer: Buffer;
  let imageWidth: number;
  let imageHeight: number;
  let cropped: boolean;

  if (cropRegion) {
    // Crop to relevant region
    imageBuffer = await sharp(buffer)
      .extract({
        left: cropRegion.x,
        top: cropRegion.y,
        width: cropRegion.width,
        height: cropRegion.height,
      })
      .toBuffer();
    imageWidth = cropRegion.width;
    imageHeight = cropRegion.height;
    cropped = true;
  } else {
    // Fallback: use full image
    const metadata = await sharp(buffer).metadata();
    imageBuffer = buffer;
    imageWidth = metadata.width ?? vpWidth;
    imageHeight = metadata.height ?? vpHeight;
    cropped = false;
  }

  // Step 3: Find optimal dimensions within token budget
  const optimal = findOptimalDimensions(
    imageWidth,
    imageHeight,
    cfg.maxTokensPerImage
  );

  // Step 4: Resize and compress with JPEG quality search
  const [minQuality, maxQuality] = cfg.jpegQualityRange;
  let quality = maxQuality;
  let compressedBuffer: Buffer;

  // Resize first
  const resized = await sharp(imageBuffer)
    .resize(optimal.width, optimal.height, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer();

  // Compress with decreasing quality until within budget
  compressedBuffer = await sharp(resized)
    .jpeg({ quality })
    .toBuffer();

  // If still over budget at max quality, step down
  while (quality > minQuality) {
    const currentTokens = calculateImageTokens(optimal.width, optimal.height);
    if (currentTokens <= cfg.maxTokensPerImage) break;
    quality -= 10;
    compressedBuffer = await sharp(resized)
      .jpeg({ quality: Math.max(quality, minQuality) })
      .toBuffer();
  }

  return {
    base64: compressedBuffer.toString('base64'),
    tokens: calculateImageTokens(optimal.width, optimal.height),
    cropped,
  };
}

/**
 * Compress a full-resolution screenshot to fit within a token budget.
 * Used for batched mode and when auto-crop is disabled.
 * No cropping — just resize + compress.
 */
export async function compressForLLM(
  screenshotBase64: string,
  maxTokens: number = 300,
  jpegQuality: number = 60
): Promise<{ base64: string; tokens: number }> {
  const buffer = Buffer.from(screenshotBase64, 'base64');
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 1280;
  const height = metadata.height ?? 800;

  const optimal = findOptimalDimensions(width, height, maxTokens);

  const compressed = await sharp(buffer)
    .resize(optimal.width, optimal.height, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: jpegQuality })
    .toBuffer();

  return {
    base64: compressed.toString('base64'),
    tokens: optimal.tokens,
  };
}
