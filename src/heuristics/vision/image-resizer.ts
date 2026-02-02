/**
 * Image Resizer - Phase 21f
 *
 * Processes full-page screenshots and resizes if they exceed GPT-4o limits.
 * Uses sharp for efficient image processing.
 */

import sharp from 'sharp';
import type { FullPageScreenshotConfig, FullPageScreenshotResult } from './types.js';
import { DEFAULT_FULL_PAGE_SCREENSHOT_CONFIG } from './types.js';

/**
 * Process a full-page screenshot buffer and resize if necessary.
 *
 * @param buffer - Raw PNG buffer from Playwright screenshot
 * @param config - Configuration for resizing
 * @returns Processed screenshot result with base64 and metadata
 */
export async function processFullPageScreenshot(
  buffer: Buffer,
  config: Partial<FullPageScreenshotConfig> = {}
): Promise<FullPageScreenshotResult> {
  const mergedConfig = { ...DEFAULT_FULL_PAGE_SCREENSHOT_CONFIG, ...config };

  // Get original image metadata
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width ?? 1280;
  const originalHeight = metadata.height ?? 720;

  const originalDimensions = { width: originalWidth, height: originalHeight };

  // Check if resizing is needed
  if (originalHeight <= mergedConfig.maxImageHeight) {
    // No resize needed, return original
    const base64 = buffer.toString('base64');
    return {
      base64,
      originalDimensions,
      finalDimensions: { ...originalDimensions },
      wasResized: false,
      sizeBytes: buffer.length,
    };
  }

  // Calculate new dimensions maintaining aspect ratio
  const scale = mergedConfig.maxImageHeight / originalHeight;
  const newWidth = Math.round(originalWidth * scale);
  const newHeight = mergedConfig.maxImageHeight;

  // Resize the image
  const resizedBuffer = await sharp(buffer)
    .resize(newWidth, newHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ quality: mergedConfig.resizeQuality })
    .toBuffer();

  const base64 = resizedBuffer.toString('base64');

  return {
    base64,
    originalDimensions,
    finalDimensions: { width: newWidth, height: newHeight },
    wasResized: true,
    sizeBytes: resizedBuffer.length,
  };
}

/**
 * Get image dimensions from a buffer without fully processing it.
 *
 * @param buffer - Image buffer
 * @returns Width and height of the image
 */
export async function getImageDimensions(
  buffer: Buffer
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };
}
