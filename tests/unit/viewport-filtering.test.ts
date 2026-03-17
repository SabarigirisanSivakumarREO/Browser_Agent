/**
 * Unit Tests for Viewport Filtering - Phase 26c (T567)
 *
 * Tests for selectViewportsForCategory and filterDOMForViewports
 * in viewport-selector.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  selectViewportsForCategory,
  filterDOMForViewports,
  VIEWPORT_REQUIREMENTS,
} from '../../src/heuristics/viewport-selector.js';
import type { ViewportSnapshot } from '../../src/models/index.js';

// Helper to create mock snapshots with viewportIndex
function createMockSnapshots(count: number): ViewportSnapshot[] {
  return Array.from({ length: count }, (_, i) => ({
    viewportIndex: i,
    scrollPosition: i * 720,
    screenshot: { base64: `base64-screenshot-${i}`, width: 1280, height: 720 },
    dom: { serialized: `<div>viewport ${i}</div>`, elementCount: 5 },
  })) as unknown as ViewportSnapshot[];
}

describe('VIEWPORT_REQUIREMENTS', () => {
  it('should have requirements for all 10 PDP categories', () => {
    const expectedCategories = [
      'Layout & Structure',
      'Mobile Usability',
      'Pricing & Cost Transparency',
      'Description & Value Proposition',
      'Reviews & Social Proof',
      'Selection & Configuration',
      'Product Imagery & Media',
      'Specifications & Details',
      'CTA & Purchase Confidence',
      'Utility & Secondary Actions',
    ];

    for (const cat of expectedCategories) {
      expect(VIEWPORT_REQUIREMENTS[cat]).toBeDefined();
      expect(VIEWPORT_REQUIREMENTS[cat]!.mode).toBeDefined();
      expect(VIEWPORT_REQUIREMENTS[cat]!.maxViewports).toBeGreaterThan(0);
    }
  });
});

describe('selectViewportsForCategory', () => {
  const snapshots = createMockSnapshots(5); // viewports 0-4

  it('should return viewports 0-2 for custom mode categories (Mobile Usability)', () => {
    // Mobile Usability is custom [0,1,2], maxViewports: 3
    const result = selectViewportsForCategory('Mobile Usability', snapshots);

    expect(result.length).toBeLessThanOrEqual(3);
    const indices = result.map(s => s.viewportIndex);
    expect(indices.every(i => [0, 1, 2].includes(i))).toBe(true);
  });

  it('should return all viewports up to max for all-mode categories (Reviews & Social Proof)', () => {
    // Reviews & Social Proof is 'all', maxViewports: 4
    const result = selectViewportsForCategory('Reviews & Social Proof', snapshots);

    expect(result.length).toBeLessThanOrEqual(4);
    // Should include viewport 0 for hero context (star ratings)
    expect(result.some(s => s.viewportIndex === 0)).toBe(true);
  });

  it('should return specified indices for custom mode (Pricing & Cost Transparency)', () => {
    // Pricing & Cost Transparency is custom, indices: [0, 1, 2, 3], maxViewports: 4
    const result = selectViewportsForCategory('Pricing & Cost Transparency', snapshots);

    expect(result.length).toBeLessThanOrEqual(4);
    const indices = result.map(s => s.viewportIndex);
    expect(indices.every(i => [0, 1, 2, 3].includes(i))).toBe(true);
  });

  it('should cap at maxViewports', () => {
    // Utility & Secondary Actions is 'all', maxViewports: 5
    // With 10 snapshots, should cap at 5
    const manySnapshots = createMockSnapshots(10);
    const result = selectViewportsForCategory('Utility & Secondary Actions', manySnapshots);

    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('should handle insufficient viewports gracefully', () => {
    // Only 1 viewport, category expects custom [0,1,2] — should return available ones
    const singleSnapshot = createMockSnapshots(1);
    const result = selectViewportsForCategory('Mobile Usability', singleSnapshot);

    // Should still return at least 1 snapshot (viewport 0)
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.viewportIndex).toBe(0);
  });

  it('should return all viewports when category not found', () => {
    const result = selectViewportsForCategory('Unknown Category', snapshots);

    // Should return all snapshots as fallback
    expect(result.length).toBe(snapshots.length);
  });

  it('should return empty array when given empty snapshots', () => {
    const result = selectViewportsForCategory('Mobile Usability', []);
    expect(result.length).toBe(0);
  });
});

describe('filterDOMForViewports', () => {
  const sampleDOM = [
    '--- Viewport-0 (scroll: 0px) ---',
    'Elements: 10',
    '[0] div.hero',
    '[1] h1.title',
    '',
    '--- Viewport-1 (scroll: 720px) ---',
    'Elements: 8',
    '[0] div.content',
    '[1] p.description',
    '',
    '--- Viewport-2 (scroll: 1440px) ---',
    'Elements: 5',
    '[0] div.reviews',
    '[1] div.review-item',
  ].join('\n');

  it('should filter DOM to only include selected viewport sections', () => {
    // Select only viewport 0
    const selected = createMockSnapshots(1); // viewportIndex: 0
    const filtered = filterDOMForViewports(sampleDOM, selected);

    expect(filtered).toContain('Viewport-0');
    expect(filtered).not.toContain('Viewport-1');
    expect(filtered).not.toContain('Viewport-2');
  });

  it('should include multiple viewport sections when selected', () => {
    // Select viewports 0 and 2
    const selected = [
      createMockSnapshots(3)[0]!, // viewportIndex: 0
      createMockSnapshots(3)[2]!, // viewportIndex: 2
    ];
    const filtered = filterDOMForViewports(sampleDOM, selected);

    expect(filtered).toContain('Viewport-0');
    expect(filtered).not.toContain('Viewport-1');
    expect(filtered).toContain('Viewport-2');
  });

  it('should return full DOM when no viewport sections found', () => {
    const plainDOM = '<div>No viewport markers here</div>';
    const selected = createMockSnapshots(1);
    const filtered = filterDOMForViewports(plainDOM, selected);

    expect(filtered).toBe(plainDOM);
  });

  it('should return empty string when DOM is empty', () => {
    const selected = createMockSnapshots(1);
    const filtered = filterDOMForViewports('', selected);
    expect(filtered).toBe('');
  });

  it('should return DOM as-is when given empty snapshots', () => {
    const filtered = filterDOMForViewports(sampleDOM, []);
    expect(filtered).toBe(sampleDOM);
  });
});
