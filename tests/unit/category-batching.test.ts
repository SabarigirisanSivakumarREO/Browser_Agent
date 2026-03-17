/**
 * Unit Tests for Category Batcher + Prompt Builder - Phase 26b (T562)
 *
 * Tests for groupCategoriesIntoBatches() and buildBatchedUserMessage/buildBatchedSystemPrompt.
 */

import { describe, it, expect } from 'vitest';
import {
  groupCategoriesIntoBatches,
  CATEGORY_BATCHES,
} from '../../src/heuristics/category-batcher.js';
import {
  buildBatchedSystemPrompt,
  buildBatchedUserMessage,
} from '../../src/heuristics/batch-prompt-builder.js';
import type { CategoryGroup } from '../../src/heuristics/category-grouper.js';
import type { ViewportSnapshot } from '../../src/models/index.js';
import type { HeuristicCategory } from '../../src/heuristics/knowledge/index.js';

// Helper: create a CategoryGroup with given name
function makeGroup(name: string, heuristicCount = 2): CategoryGroup {
  return {
    name,
    description: `${name} description`,
    heuristics: Array.from({ length: heuristicCount }, (_, i) => ({
      id: `PDP-${name.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
      principle: `Principle ${i + 1} for ${name}`,
      checkpoints: [`Check ${i + 1}`],
      severity: 'medium' as const,
      category: name,
    })),
    count: heuristicCount,
  };
}

// Helper: create a mock ViewportSnapshot
function makeSnapshot(index: number): ViewportSnapshot {
  return {
    viewportIndex: index,
    scrollPosition: index * 720,
    screenshot: { base64: `base64-screenshot-${index}`, width: 1280, height: 720 },
    dom: { serialized: `<div>[${index}] Button</div>`, elementCount: 3 },
  } as unknown as ViewportSnapshot;
}

describe('groupCategoriesIntoBatches', () => {
  it('should group related categories together using predefined batches', () => {
    // Provide categories that match the predefined CATEGORY_BATCHES
    const categories = [
      makeGroup('Layout & Structure'),
      makeGroup('Mobile Usability'),
      makeGroup('Pricing & Cost Transparency'),
      makeGroup('Description & Value Proposition'),
      makeGroup('Reviews & Social Proof'),
      makeGroup('Selection & Configuration'),
      makeGroup('Product Imagery & Media'),
      makeGroup('Specifications & Details'),
      makeGroup('CTA & Purchase Confidence'),
      makeGroup('Utility & Secondary Actions'),
    ];

    const batches = groupCategoriesIntoBatches(categories, 'related');

    // Should produce 5 batches (matching CATEGORY_BATCHES)
    expect(batches.length).toBe(5);

    // Batch 1: Layout & Structure + Mobile Usability
    expect(batches[0]!.map(g => g.name)).toEqual(['Layout & Structure', 'Mobile Usability']);

    // Batch 2: Pricing + Description
    expect(batches[1]!.map(g => g.name)).toEqual(['Pricing & Cost Transparency', 'Description & Value Proposition']);

    // All categories should be assigned
    const allNames = batches.flat().map(g => g.name);
    expect(allNames.length).toBe(10);
    for (const cat of categories) {
      expect(allNames).toContain(cat.name);
    }
  });

  it('should handle custom batch configuration', () => {
    const categories = [
      makeGroup('Alpha'),
      makeGroup('Beta'),
      makeGroup('Gamma'),
      makeGroup('Delta'),
    ];

    const customBatches = [
      ['Alpha', 'Beta'],
      ['Gamma', 'Delta'],
    ];

    const batches = groupCategoriesIntoBatches(categories, 'custom', customBatches);

    expect(batches.length).toBe(2);
    expect(batches[0]!.map(g => g.name)).toEqual(['Alpha', 'Beta']);
    expect(batches[1]!.map(g => g.name)).toEqual(['Gamma', 'Delta']);
  });

  it('should put unmatched categories in their own single-category batch', () => {
    const categories = [
      makeGroup('Layout & Structure'),
      makeGroup('Mobile Usability'),
      makeGroup('Custom New Category'), // Not in predefined batches
    ];

    const batches = groupCategoriesIntoBatches(categories, 'related');

    // Batch 1: Layout + Mobile (matched)
    // Batch 2: Custom New Category (unmatched, gets own batch)
    expect(batches.length).toBe(2);
    expect(batches[0]!.map(g => g.name)).toEqual(['Layout & Structure', 'Mobile Usability']);
    expect(batches[1]!.map(g => g.name)).toEqual(['Custom New Category']);
  });

  it('should filter empty batches when categories are missing', () => {
    // Only provide 1 of the 2 categories from each predefined batch
    const categories = [
      makeGroup('Layout & Structure'),
      makeGroup('Reviews & Social Proof'),
    ];

    const batches = groupCategoriesIntoBatches(categories, 'related');

    // Each category should appear in a batch, even if its pair is missing
    expect(batches.length).toBe(2);
    const allNames = batches.flat().map(g => g.name);
    expect(allNames).toContain('Layout & Structure');
    expect(allNames).toContain('Reviews & Social Proof');
  });
});

describe('buildBatchedSystemPrompt', () => {
  it('should include page type and evaluation format', () => {
    const prompt = buildBatchedSystemPrompt('pdp');

    expect(prompt).toContain('PDP');
    expect(prompt).toContain('CRO');
    expect(prompt).toContain('heuristicId');
    expect(prompt).toContain('status');
    expect(prompt).toContain('confidence');
    expect(prompt).toContain('Category Name 1');
    expect(prompt).toContain('evaluations');
  });
});

describe('buildBatchedUserMessage', () => {
  it('should include shared DOM context once with per-category heuristic sections', () => {
    const categories: HeuristicCategory[] = [
      {
        name: 'Layout & Structure',
        description: 'Page layout assessment',
        heuristics: [
          { id: 'PDP-LAY-001', principle: 'Clear layout', checkpoints: ['Grid structure'], severity: 'high', category: 'Layout & Structure' },
        ],
      },
      {
        name: 'Mobile Usability',
        description: 'Mobile experience assessment',
        heuristics: [
          { id: 'PDP-MOB-001', principle: 'Touch targets', checkpoints: ['Min 44px'], severity: 'medium', category: 'Mobile Usability' },
        ],
      },
    ];

    const snapshots = [makeSnapshot(0), makeSnapshot(1)];
    const message = buildBatchedUserMessage(categories, snapshots, 'pdp');

    // Shared DOM context section (once)
    expect(message).toContain('<dom_context>');
    expect(message).toContain('Viewport-0');
    expect(message).toContain('Viewport-1');
    expect(message).toContain('</dom_context>');

    // Shared screenshot section (once)
    expect(message).toContain('<screenshots>');
    expect(message).toContain('2 screenshot(s)');
    expect(message).toContain('</screenshots>');

    // Per-category sections
    expect(message).toContain('<category name="Layout & Structure">');
    expect(message).toContain('PDP-LAY-001');
    expect(message).toContain('Clear layout');

    expect(message).toContain('<category name="Mobile Usability">');
    expect(message).toContain('PDP-MOB-001');
    expect(message).toContain('Touch targets');

    // Element references transformed to v{n}-{index} format
    // Snapshot 0 DOM has [0] → [v0-0], Snapshot 1 DOM has [1] → [v1-1]
    expect(message).toContain('[v0-0]');
    expect(message).toContain('[v1-1]');

    // Final instruction
    expect(message).toContain('Evaluate ALL heuristics across 2 categories');
    expect(message).toContain('"Layout & Structure"');
    expect(message).toContain('"Mobile Usability"');
  });

  it('should handle empty snapshots gracefully', () => {
    const categories: HeuristicCategory[] = [
      {
        name: 'Test Category',
        description: 'Test',
        heuristics: [
          { id: 'PDP-TST-001', principle: 'Test principle', checkpoints: [], severity: 'low', category: 'Test Category' },
        ],
      },
    ];

    const message = buildBatchedUserMessage(categories, [], 'pdp');

    expect(message).toContain('No DOM snapshots available');
    expect(message).toContain('No screenshots available');
    expect(message).toContain('PDP-TST-001');
  });
});
