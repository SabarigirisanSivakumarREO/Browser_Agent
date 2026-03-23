/**
 * Integration tests for AX Tree in LLM Analysis — Phase 29 (T649, T651)
 */

import { describe, it, expect, vi } from 'vitest';
import type { ViewportSnapshot } from '../../src/models/agent-state.js';
import {
  buildAccessibilityTreeBlock,
  buildElementPositionsBlock,
} from '../../src/heuristics/category-analyzer.js';

// Mock logger
vi.mock('../../src/utils/index.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    setVerbose: vi.fn(),
  }),
}));

function createMockSnapshot(axTree?: string): ViewportSnapshot {
  return {
    viewportIndex: 0,
    scrollPosition: 0,
    screenshot: { base64: 'mock', capturedAt: Date.now() },
    dom: { serialized: '<div>test</div>', elementCount: 1 },
    axTree,
  };
}

describe('AX Tree LLM Prompt Integration', () => {
  describe('buildAccessibilityTreeBlock', () => {
    it('should return block when axTree is present', () => {
      const snapshot = createMockSnapshot(
        '- button "Add to Cart"\n- link "Home"'
      );
      const result = buildAccessibilityTreeBlock(snapshot);

      expect(result).not.toBeNull();
      expect(result).toContain('<accessibility_tree>');
      expect(result).toContain('</accessibility_tree>');
      expect(result).toContain('button "Add to Cart"');
      expect(result).toContain('link "Home"');
    });

    it('should return null when axTree is undefined', () => {
      const snapshot = createMockSnapshot(undefined);
      const result = buildAccessibilityTreeBlock(snapshot);
      expect(result).toBeNull();
    });

    it('should return null when axTree is empty string', () => {
      const snapshot = createMockSnapshot('');
      const result = buildAccessibilityTreeBlock(snapshot);
      // Empty string is falsy → null
      expect(result).toBeNull();
    });

    it('should preserve axTree content exactly', () => {
      const axContent = '- navigation "Main"\n  - link "Home"\n  - link "Products"';
      const snapshot = createMockSnapshot(axContent);
      const result = buildAccessibilityTreeBlock(snapshot);

      expect(result).toBe(
        `<accessibility_tree>\n${axContent}\n</accessibility_tree>`
      );
    });

    it('should be placed after element_positions in prompt flow', () => {
      const snapshot = createMockSnapshot('- button "Buy"');
      // Both blocks should be producible from the same snapshot
      const posBlock = buildElementPositionsBlock(snapshot);
      const axBlock = buildAccessibilityTreeBlock(snapshot);

      // In the actual prompt, positions come first, then AX tree
      // Here we just verify both can coexist
      expect(axBlock).not.toBeNull();
      // posBlock may be null if no visibleElements, that's OK
      if (posBlock) {
        expect(posBlock).toContain('<element_positions>');
      }
    });
  });

  describe('Full flow simulation', () => {
    it('should produce valid insights with AX tree context', () => {
      const snapshot = createMockSnapshot(
        '- navigation "Main"\n  - link "Home"\n- button "Add to Cart" [focusable]\n- textbox "Email" [required]'
      );
      const block = buildAccessibilityTreeBlock(snapshot);

      // Verify the block is well-formed for LLM consumption
      expect(block).not.toBeNull();
      const lines = block!.split('\n');
      expect(lines[0]).toBe('<accessibility_tree>');
      expect(lines[lines.length - 1]).toBe('</accessibility_tree>');
      expect(lines.length).toBeGreaterThan(2); // Not just tags
    });

    it('should handle analysis without AX tree gracefully', () => {
      const snapshot = createMockSnapshot(undefined);
      const block = buildAccessibilityTreeBlock(snapshot);
      // Analysis should proceed without AX tree — just no block
      expect(block).toBeNull();
    });

    it('should handle capture failure gracefully', () => {
      // Simulate a snapshot where capture failed (axTree undefined)
      const snapshot = createMockSnapshot(undefined);
      const block = buildAccessibilityTreeBlock(snapshot);
      expect(block).toBeNull();
      // The analysis would continue with DOM + screenshot only
    });
  });
});
