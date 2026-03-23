/**
 * Unit tests for Image Token Calculator — Phase 30a (T655)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateImageTokens,
  findOptimalDimensions,
} from '../../src/heuristics/vision/image-token-calculator.js';

describe('calculateImageTokens', () => {
  it('should calculate 170 tokens for 512x512 (1 tile + base)', () => {
    expect(calculateImageTokens(512, 512)).toBe(170); // 1*85 + 85
  });

  it('should calculate 255 tokens for 1024x512 (2 tiles + base)', () => {
    expect(calculateImageTokens(1024, 512)).toBe(255); // 2*85 + 85
  });

  it('should calculate 595 tokens for 1280x800 (3x2=6 tiles + base)', () => {
    // ceil(1280/512)=3, ceil(800/512)=2, tiles=6
    expect(calculateImageTokens(1280, 800)).toBe(595); // 6*85 + 85
  });

  it('should calculate 170 tokens for small images (1 tile min)', () => {
    expect(calculateImageTokens(100, 100)).toBe(170); // 1*85 + 85
  });

  it('should return base cost for zero dimensions', () => {
    expect(calculateImageTokens(0, 0)).toBe(85);
  });
});

describe('findOptimalDimensions', () => {
  it('should return original dimensions when within budget', () => {
    const result = findOptimalDimensions(512, 512, 200);
    expect(result.width).toBe(512);
    expect(result.height).toBe(512);
    expect(result.tokens).toBe(170);
  });

  it('should reduce dimensions to fit within budget', () => {
    // 1280x800 = 595 tokens, budget = 300
    const result = findOptimalDimensions(1280, 800, 300);
    expect(result.tokens).toBeLessThanOrEqual(300);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('should preserve aspect ratio', () => {
    const result = findOptimalDimensions(1280, 800, 300);
    const originalRatio = 1280 / 800;
    const resultRatio = result.width / result.height;
    // Allow 5% tolerance for rounding
    expect(Math.abs(resultRatio - originalRatio) / originalRatio).toBeLessThan(0.05);
  });

  it('should handle zero dimensions', () => {
    const result = findOptimalDimensions(0, 0, 300);
    expect(result.tokens).toBe(85);
  });
});
