/**
 * Image Token Calculator — Phase 30a (T653)
 *
 * Calculates OpenAI vision API token costs based on the tile model:
 * images are split into 512x512 tiles, each costing 85 tokens,
 * plus 85 base tokens per image.
 */

/**
 * Calculate the token cost of an image at given dimensions.
 *
 * OpenAI vision model splits images into 512x512 tiles.
 * Cost = (number of tiles * 85) + 85 base tokens.
 */
export function calculateImageTokens(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 85; // Base cost only
  const tilesX = Math.ceil(width / 512);
  const tilesY = Math.ceil(height / 512);
  const tiles = tilesX * tilesY;
  return tiles * 85 + 85;
}

/**
 * Find the largest dimensions that fit within a token budget
 * while maintaining the original aspect ratio.
 *
 * Steps down by 10% increments until the token cost fits.
 * Returns the dimensions and resulting token count.
 */
export function findOptimalDimensions(
  originalWidth: number,
  originalHeight: number,
  maxTokens: number
): { width: number; height: number; tokens: number } {
  if (originalWidth <= 0 || originalHeight <= 0) {
    return { width: 0, height: 0, tokens: 85 };
  }

  const aspectRatio = originalWidth / originalHeight;

  // Start from original and step down
  let width = originalWidth;
  let height = originalHeight;
  let tokens = calculateImageTokens(width, height);

  while (tokens > maxTokens && width > 64) {
    // Reduce by 10%
    width = Math.round(width * 0.9);
    height = Math.round(width / aspectRatio);

    // Enforce minimums
    width = Math.max(width, 64);
    height = Math.max(height, 64);

    tokens = calculateImageTokens(width, height);
  }

  return { width, height, tokens };
}
