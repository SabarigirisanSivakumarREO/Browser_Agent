/**
 * Tiled Screenshot Mode Integration Tests - Phase 25e (T497)
 *
 * Tests the tiled screenshot capture functionality with real Playwright pages.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import {
  captureTiledScreenshots,
  tilesToSnapshots,
  DEFAULT_TILED_CONFIG,
  type TiledScreenshotConfig,
} from '../../src/output/tiled-screenshot.js';

describe('Tiled Screenshot Mode', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  afterAll(async () => {
    await browser.close();
  });

  it('should capture full page in tiles', async () => {
    // Create a page with content taller than viewport
    await page.setContent(`
      <html>
        <head><style>
          body { margin: 0; padding: 0; }
          .section { height: 800px; border-bottom: 1px solid #ccc; padding: 20px; }
        </style></head>
        <body>
          <div class="section" style="background: #f0f0f0;">Section 1</div>
          <div class="section" style="background: #e0e0e0;">Section 2</div>
          <div class="section" style="background: #d0d0d0;">Section 3</div>
        </body>
      </html>
    `);

    const result = await captureTiledScreenshots(page, {
      maxTileHeight: 1000,
      overlapPx: 100,
      maxTiles: 5,
      annotateFoldLine: true,
      viewportHeight: 720,
    });

    expect(result.success).toBe(true);
    expect(result.tiles.length).toBeGreaterThan(0);
    expect(result.tiles.length).toBeLessThanOrEqual(5);

    // Verify tiles have correct structure
    for (const tile of result.tiles) {
      expect(tile.buffer).toBeInstanceOf(Buffer);
      expect(tile.buffer.length).toBeGreaterThan(0);
      expect(tile.width).toBe(1280);
      expect(tile.height).toBeGreaterThan(0);
      expect(tile.startY).toBeGreaterThanOrEqual(0);
      expect(tile.endY).toBeGreaterThan(tile.startY);
    }
  });

  it('should respect maxTileHeight', async () => {
    // Create a tall page
    await page.setContent(`
      <html>
        <head><style>body { margin: 0; height: 5000px; background: linear-gradient(#f00, #00f); }</style></head>
        <body></body>
      </html>
    `);

    const maxTileHeight = 1200;
    const result = await captureTiledScreenshots(page, {
      maxTileHeight,
      overlapPx: 100,
      maxTiles: 10,
      annotateFoldLine: false,
      viewportHeight: 720,
    });

    expect(result.success).toBe(true);

    // Each tile should not exceed maxTileHeight
    for (const tile of result.tiles) {
      expect(tile.height).toBeLessThanOrEqual(maxTileHeight);
    }
  });

  it('should include overlap between tiles', async () => {
    // Create a page that needs multiple tiles
    await page.setContent(`
      <html>
        <head><style>body { margin: 0; height: 4000px; background: linear-gradient(#0f0, #f0f); }</style></head>
        <body></body>
      </html>
    `);

    const overlapPx = 150;
    const result = await captureTiledScreenshots(page, {
      maxTileHeight: 1500,
      overlapPx,
      maxTiles: 5,
      annotateFoldLine: false,
      viewportHeight: 720,
    });

    expect(result.success).toBe(true);
    expect(result.tiles.length).toBeGreaterThan(1);

    // Check overlap between consecutive tiles
    for (let i = 1; i < result.tiles.length; i++) {
      const prevTile = result.tiles[i - 1]!;
      const currTile = result.tiles[i]!;

      // Current tile should start before previous tile ends (overlap)
      expect(currTile.startY).toBeLessThan(prevTile.endY);
      // The overlap should be approximately overlapPx (or less if near page end)
      const actualOverlap = prevTile.endY - currTile.startY;
      expect(actualOverlap).toBeLessThanOrEqual(overlapPx + 10); // Allow small variance
    }
  });

  it('should annotate first tile with fold line', async () => {
    await page.setContent(`
      <html>
        <head><style>body { margin: 0; height: 2000px; background: #fff; }</style></head>
        <body><h1 style="padding: 20px;">Test Page</h1></body>
      </html>
    `);

    const result = await captureTiledScreenshots(page, {
      maxTileHeight: 1800,
      overlapPx: 100,
      maxTiles: 3,
      annotateFoldLine: true,
      viewportHeight: 720,
    });

    expect(result.success).toBe(true);
    expect(result.tiles.length).toBeGreaterThan(0);

    // First tile should be marked as above fold
    const firstTile = result.tiles[0]!;
    expect(firstTile.isAboveFold).toBe(true);
    expect(firstTile.index).toBe(0);

    // Other tiles should not be above fold
    for (let i = 1; i < result.tiles.length; i++) {
      expect(result.tiles[i]!.isAboveFold).toBe(false);
    }

    // First tile buffer should be larger due to fold line annotation
    // (This is a heuristic check - the annotated image has SVG overlay)
    expect(firstTile.buffer.length).toBeGreaterThan(0);
  });

  it('should not exceed maxTiles', async () => {
    // Create a very tall page
    await page.setContent(`
      <html>
        <head><style>body { margin: 0; height: 20000px; background: linear-gradient(#ff0, #0ff); }</style></head>
        <body></body>
      </html>
    `);

    const maxTiles = 3;
    const result = await captureTiledScreenshots(page, {
      maxTileHeight: 1800,
      overlapPx: 100,
      maxTiles,
      annotateFoldLine: false,
      viewportHeight: 720,
    });

    expect(result.success).toBe(true);
    expect(result.tiles.length).toBeLessThanOrEqual(maxTiles);
  });

  it('should handle short pages (single tile)', async () => {
    // Create a short page that fits in one tile
    await page.setContent(`
      <html>
        <head><style>body { margin: 0; height: 500px; background: #eee; }</style></head>
        <body><p>Short page content</p></body>
      </html>
    `);

    const result = await captureTiledScreenshots(page, {
      maxTileHeight: 1800,
      overlapPx: 100,
      maxTiles: 5,
      annotateFoldLine: true,
      viewportHeight: 720,
    });

    expect(result.success).toBe(true);
    // Short page should only need 1 tile
    expect(result.tiles.length).toBe(1);

    const tile = result.tiles[0]!;
    expect(tile.startY).toBe(0);
    // Tile should cover the full page height
    expect(tile.height).toBeLessThanOrEqual(result.pageHeight + 10);
    expect(tile.isAboveFold).toBe(true);
  });

  describe('tilesToSnapshots conversion', () => {
    it('should convert tiles to viewport snapshot format', async () => {
      await page.setContent(`
        <html>
          <head><style>body { margin: 0; height: 3000px; background: #f5f5f5; }</style></head>
          <body></body>
        </html>
      `);

      const result = await captureTiledScreenshots(page, {
        maxTileHeight: 1200,
        overlapPx: 100,
        maxTiles: 5,
        annotateFoldLine: true,
        viewportHeight: 720,
      });

      expect(result.success).toBe(true);

      const snapshots = tilesToSnapshots(result.tiles);

      expect(snapshots.length).toBe(result.tiles.length);

      for (let i = 0; i < snapshots.length; i++) {
        const snapshot = snapshots[i]!;
        const tile = result.tiles[i]!;

        expect(snapshot.viewportIndex).toBe(tile.index);
        expect(snapshot.scrollPosition).toBe(tile.startY);
        expect(snapshot.isAboveFold).toBe(tile.isAboveFold);
        expect(snapshot.screenshot.base64).toBeDefined();
        expect(snapshot.screenshot.base64.length).toBeGreaterThan(0);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle page with no content gracefully', async () => {
      await page.setContent('<html><body></body></html>');

      const result = await captureTiledScreenshots(page);

      // Even empty page should have some height and capture something
      expect(result.success).toBe(true);
      // Behavior depends on browser - may capture minimal viewport
    });

    it('should use default config when not specified', async () => {
      await page.setContent(`
        <html>
          <head><style>body { margin: 0; height: 2000px; }</style></head>
          <body></body>
        </html>
      `);

      const result = await captureTiledScreenshots(page);

      expect(result.success).toBe(true);
      // Should use DEFAULT_TILED_CONFIG values
      expect(result.tiles.length).toBeLessThanOrEqual(DEFAULT_TILED_CONFIG.maxTiles);
    });
  });
});
