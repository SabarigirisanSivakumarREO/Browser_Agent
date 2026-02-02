/**
 * Vision Prompt Builder Unit Tests - Phase 21i (T371)
 *
 * Tests for coordinate-aware DOM context formatting.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VisionPromptBuilder } from '../../src/agent/vision/vision-prompt-builder.js';
import type { VisionToolRegistry } from '../../src/agent/vision/tools/index.js';
import type { ElementMapping, ScreenshotCoords } from '../../src/browser/dom/coordinate-mapper.js';

// Mock file system
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue(`
<identity>You are a CRO Vision Analyst.</identity>
{{TOOLS_PLACEHOLDER}}
<task>Analyze the page.</task>
  `),
}));

// Create mock tool registry
const createMockToolRegistry = (): VisionToolRegistry => ({
  tools: [
    {
      name: 'capture_viewport',
      description: 'Captures the current viewport',
      parameters: { type: 'object', properties: {} },
      execute: vi.fn(),
    },
  ],
  getToolSchemas: vi.fn().mockReturnValue([]),
  getTool: vi.fn(),
  hasTools: true,
  toolNames: ['capture_viewport'],
});

// Create mock element mapping
const createMockMapping = (
  index: number,
  tagName: string,
  text: string,
  coords: Partial<ScreenshotCoords> = {}
): ElementMapping => ({
  index,
  xpath: `/body/${tagName}[${index}]`,
  text,
  croType: 'cta',
  tagName,
  pageCoords: { x: coords.x ?? 100, y: (coords.y ?? 100) + 500, width: coords.width ?? 150, height: coords.height ?? 40 },
  screenshotCoords: {
    x: coords.x ?? 100,
    y: coords.y ?? 100,
    width: coords.width ?? 150,
    height: coords.height ?? 40,
    isVisible: coords.isVisible ?? true,
    visibilityRatio: coords.visibilityRatio ?? 1,
  },
});

describe('VisionPromptBuilder', () => {
  let builder: VisionPromptBuilder;

  beforeEach(() => {
    builder = new VisionPromptBuilder(createMockToolRegistry());
  });

  describe('formatDOMContextWithCoords', () => {
    // Test 1: Basic formatting
    it('should format visible elements with coordinates', () => {
      const visibleElements: ElementMapping[] = [
        createMockMapping(0, 'button', 'Add to Cart', { x: 100, y: 200, width: 150, height: 40 }),
        createMockMapping(1, 'a', 'Learn More', { x: 300, y: 350, width: 100, height: 30 }),
      ];

      const result = builder.formatDOMContextWithCoords(visibleElements, 500, 768);

      expect(result).toContain('[0] <button>');
      expect(result).toContain('"Add to Cart"');
      expect(result).toContain('(100, 200, 150×40)');
      expect(result).toContain('[1] <a>');
      expect(result).toContain('"Learn More"');
      expect(result).toContain('(300, 350, 100×30)');
    });

    // Test 2: CRO type label
    it('should include CRO type label in format', () => {
      const visibleElements: ElementMapping[] = [
        createMockMapping(0, 'button', 'Buy Now'),
      ];

      const result = builder.formatDOMContextWithCoords(visibleElements, 0, 768);

      expect(result).toContain('[cta]');
    });

    // Test 3: Viewport range header
    it('should include viewport range in header', () => {
      const visibleElements: ElementMapping[] = [
        createMockMapping(0, 'button', 'CTA'),
      ];

      const result = builder.formatDOMContextWithCoords(visibleElements, 500, 768);

      expect(result).toContain('Viewport range: 500px to 1268px');
    });

    // Test 4: Token estimate
    it('should include token estimate in header', () => {
      const visibleElements: ElementMapping[] = [
        createMockMapping(0, 'button', 'CTA'),
      ];

      const result = builder.formatDOMContextWithCoords(visibleElements, 0, 768);

      expect(result).toMatch(/tokens="\d+"/);
    });

    // Test 5: Element count
    it('should include element count in header', () => {
      const visibleElements: ElementMapping[] = [
        createMockMapping(0, 'button', 'One'),
        createMockMapping(1, 'button', 'Two'),
        createMockMapping(2, 'button', 'Three'),
      ];

      const result = builder.formatDOMContextWithCoords(visibleElements, 0, 768);

      expect(result).toContain('elements="3"');
    });

    // Test 6: Text truncation
    it('should truncate long text to 50 characters', () => {
      const longText = 'A'.repeat(100);
      const visibleElements: ElementMapping[] = [
        createMockMapping(0, 'button', longText),
      ];

      const result = builder.formatDOMContextWithCoords(visibleElements, 0, 768);

      expect(result).toContain('"' + 'A'.repeat(50) + '..."');
    });

    // Test 7: Partial visibility indicator
    it('should show visibility percentage for partially visible elements', () => {
      const visibleElements: ElementMapping[] = [
        createMockMapping(0, 'button', 'Partial', { visibilityRatio: 0.5 }),
      ];

      const result = builder.formatDOMContextWithCoords(visibleElements, 0, 768);

      expect(result).toContain('(50% visible)');
    });

    // Test 8: Format indicator
    it('should include format="coords" attribute', () => {
      const visibleElements: ElementMapping[] = [
        createMockMapping(0, 'button', 'CTA'),
      ];

      const result = builder.formatDOMContextWithCoords(visibleElements, 0, 768);

      expect(result).toContain('format="coords"');
    });

    // Test 9: Empty text handling
    it('should handle empty text with empty quotes', () => {
      const visibleElements: ElementMapping[] = [
        createMockMapping(0, 'img', ''),
      ];

      const result = builder.formatDOMContextWithCoords(visibleElements, 0, 768);

      expect(result).toContain('""');
    });

    // Test 10: Coordinate rounding
    it('should round coordinates to integers', () => {
      const visibleElements: ElementMapping[] = [
        createMockMapping(0, 'button', 'CTA', { x: 100.6, y: 200.4, width: 150.9, height: 40.1 }),
      ];

      const result = builder.formatDOMContextWithCoords(visibleElements, 0, 768);

      expect(result).toContain('(101, 200, 151×40)');
    });
  });
});
