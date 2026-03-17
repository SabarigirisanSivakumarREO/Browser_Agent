/**
 * Unit Tests for Phase 27B: Structured Element Refs (T619-T622)
 *
 * Tests:
 * 1. T619: elementRefs field in JSON schema examples (per-category + batched)
 * 2. T620: System prompts contain elementRefs instructions
 * 3. T621: populateElementRefs uses structured refs first, text scan fallback
 * 4. T622: Batch response parser carries elementRefs through
 */

import { describe, it, expect, vi } from 'vitest';
import {
  populateElementRefs,
  extractElementRefs,
} from '../../src/heuristics/category-analyzer.js';
import { buildBatchedSystemPrompt } from '../../src/heuristics/batch-prompt-builder.js';
import { parseBatchedResponse } from '../../src/heuristics/batch-response-parser.js';
import type { ViewportSnapshot } from '../../src/models/index.js';
import type { HeuristicEvaluation } from '../../src/heuristics/vision/types.js';
import type { HeuristicCategory } from '../../src/heuristics/knowledge/index.js';
import type { ElementMapping } from '../../src/browser/dom/coordinate-mapper.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function createMockElementMapping(overrides: Partial<ElementMapping> = {}): ElementMapping {
  return {
    index: 0,
    viewportId: 'V0-0',
    xpath: '/html/body/button[1]',
    text: 'Add to Cart',
    croType: 'cta',
    tagName: 'button',
    pageCoords: { x: 520, y: 380, width: 200, height: 48 },
    screenshotCoords: {
      x: 520, y: 380, width: 200, height: 48,
      isVisible: true, visibilityRatio: 1.0,
    },
    ...overrides,
  };
}

function createMockSnapshot(overrides: Partial<ViewportSnapshot> = {}): ViewportSnapshot {
  return {
    scrollPosition: 0,
    viewportIndex: 0,
    screenshot: { base64: 'mockBase64', capturedAt: Date.now() },
    dom: { serialized: '[0] button "Add to Cart"', elementCount: 1 },
    ...overrides,
  };
}

function createMockEvaluation(overrides: Partial<HeuristicEvaluation> = {}): HeuristicEvaluation {
  return {
    heuristicId: 'PDP-CTA-001',
    principle: 'CTA should be prominent',
    status: 'fail',
    severity: 'high',
    observation: 'The CTA button is below the fold',
    confidence: 0.85,
    ...overrides,
  };
}

function makeCategory(name: string, heuristicIds: string[]): HeuristicCategory {
  return {
    name,
    description: `${name} description`,
    heuristics: heuristicIds.map(id => ({
      id,
      principle: `Principle for ${id}`,
      checkpoints: [`Check for ${id}`],
      severity: 'medium' as const,
      category: name,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// T619: elementRefs in JSON schema
// ═══════════════════════════════════════════════════════════════════════════════

describe('T619: elementRefs in JSON schema', () => {
  it('per-category system prompt JSON example includes elementRefs field', async () => {
    // We test by importing and instantiating CategoryAnalyzer to get buildSystemPrompt output
    // Since buildSystemPrompt is private, we test via the prompt content in a category analysis
    // Instead, test the prompt string pattern directly by checking the module source
    const { CategoryAnalyzer } = await import('../../src/heuristics/category-analyzer.js');
    const analyzer = new CategoryAnalyzer();

    // Access private method via any cast — acceptable in test
    const systemPrompt = (analyzer as any).buildSystemPrompt('pdp');

    expect(systemPrompt).toContain('"elementRefs": ["[v0-3]", "[v0-7]"]');
  });

  it('batched system prompt JSON example includes elementRefs field', () => {
    const prompt = buildBatchedSystemPrompt('pdp');
    expect(prompt).toContain('"elementRefs": ["[v0-3]", "[v0-7]"]');
  });

  it('per-category system prompt describes elementRefs in evaluation_format', async () => {
    const { CategoryAnalyzer } = await import('../../src/heuristics/category-analyzer.js');
    const analyzer = new CategoryAnalyzer();
    const systemPrompt = (analyzer as any).buildSystemPrompt('pdp');

    expect(systemPrompt).toContain('elementRefs: REQUIRED for non-N/A evaluations');
    expect(systemPrompt).toContain('[v0-N] format');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T620: System prompt instructions for elementRefs
// ═══════════════════════════════════════════════════════════════════════════════

describe('T620: system prompt elementRefs instructions', () => {
  it('per-category prompt contains elementRefs instruction', async () => {
    const { CategoryAnalyzer } = await import('../../src/heuristics/category-analyzer.js');
    const analyzer = new CategoryAnalyzer();
    const systemPrompt = (analyzer as any).buildSystemPrompt('pdp');

    expect(systemPrompt).toContain('elementRefs');
    expect(systemPrompt).toContain('REQUIRED for non-N/A evaluations');
    expect(systemPrompt).toContain('array of element references');
  });

  it('batched prompt contains elementRefs instruction', () => {
    const prompt = buildBatchedSystemPrompt('pdp');

    expect(prompt).toContain('elementRefs');
    expect(prompt).toContain('REQUIRED for non-N/A evaluations');
    expect(prompt).toContain('array of element references');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T621: populateElementRefs uses structured refs first, text scan fallback
// ═══════════════════════════════════════════════════════════════════════════════

describe('T621: populateElementRefs with structured refs', () => {
  it('uses structured _structuredElementRefs when present', () => {
    const element = createMockElementMapping({
      index: 5, tagName: 'button', text: 'Add to Cart',
      xpath: '/html/body/div/button',
    });
    const snapshot = createMockSnapshot({
      viewportIndex: 0,
      visibleElements: [element],
    });

    const evaluation = createMockEvaluation({
      observation: 'CTA button is below the fold', // No [v0-5] ref in text
    });
    // Simulate what parseResponse does — attach structured refs
    (evaluation as any)._structuredElementRefs = ['[v0-5]'];

    populateElementRefs([evaluation], [snapshot]);

    expect(evaluation.domElementRefs).toBeDefined();
    expect(evaluation.domElementRefs).toHaveLength(1);
    expect(evaluation.domElementRefs![0]!.index).toBe(5);
    expect(evaluation.domElementRefs![0]!.elementType).toBe('button');
  });

  it('falls back to text scan when no structured refs', () => {
    const element = createMockElementMapping({
      index: 12, tagName: 'span', text: '£65.00',
    });
    const snapshot = createMockSnapshot({
      viewportIndex: 0,
      visibleElements: [element],
    });

    const evaluation = createMockEvaluation({
      observation: 'Price element [v0-12] shows £65.00',
      // No _structuredElementRefs
    });

    populateElementRefs([evaluation], [snapshot]);

    expect(evaluation.domElementRefs).toBeDefined();
    expect(evaluation.domElementRefs).toHaveLength(1);
    expect(evaluation.domElementRefs![0]!.index).toBe(12);
    expect(evaluation.domElementRefs![0]!.elementType).toBe('span');
  });

  it('cleans up _structuredElementRefs temporary field after processing', () => {
    const snapshot = createMockSnapshot({
      viewportIndex: 0,
      visibleElements: [createMockElementMapping({ index: 5, tagName: 'button' })],
    });

    const evaluation = createMockEvaluation({
      observation: 'CTA below fold',
    });
    (evaluation as any)._structuredElementRefs = ['[v0-5]'];

    populateElementRefs([evaluation], [snapshot]);

    // Temp field should be cleaned up
    expect((evaluation as any)._structuredElementRefs).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T622: Batch response parser carries elementRefs
// ═══════════════════════════════════════════════════════════════════════════════

describe('T622: batch response parser elementRefs', () => {
  it('parseBatchedResponse carries structured elementRefs to evaluations', () => {
    const categories = [makeCategory('Layout', ['PDP-LAY-001'])];

    const response = JSON.stringify({
      'Layout': {
        evaluations: [
          {
            heuristicId: 'PDP-LAY-001',
            status: 'fail',
            confidence: 0.9,
            observation: 'Grid is misaligned',
            reasoning: 'Found layout container with grid gap issues',
            elementRefs: ['[v0-3]', '[v0-7]'],
          },
        ],
        summary: 'Layout needs work',
      },
    });

    const results = parseBatchedResponse(response, categories);
    const eval_ = results[0]!.evaluations[0]!;

    // Should have _structuredElementRefs attached for populateElementRefs to use
    expect((eval_ as any)._structuredElementRefs).toEqual(['[v0-3]', '[v0-7]']);
  });

  it('parseBatchedResponse handles missing elementRefs gracefully', () => {
    const categories = [makeCategory('Layout', ['PDP-LAY-001'])];

    const response = JSON.stringify({
      'Layout': {
        evaluations: [
          {
            heuristicId: 'PDP-LAY-001',
            status: 'pass',
            confidence: 0.9,
            observation: 'Layout looks good',
            reasoning: 'Clean grid structure',
            // No elementRefs field
          },
        ],
        summary: 'Layout is fine',
      },
    });

    const results = parseBatchedResponse(response, categories);
    const eval_ = results[0]!.evaluations[0]!;

    // Should NOT have _structuredElementRefs
    expect((eval_ as any)._structuredElementRefs).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T623: Few-shot examples in system prompts
// ═══════════════════════════════════════════════════════════════════════════════

describe('T623: few-shot examples in system prompts', () => {
  it('per-category prompt contains 3 few-shot examples with elementRefs', async () => {
    const { CategoryAnalyzer } = await import('../../src/heuristics/category-analyzer.js');
    const analyzer = new CategoryAnalyzer();
    const systemPrompt = (analyzer as any).buildSystemPrompt('pdp');

    // Contains examples section
    expect(systemPrompt).toContain('<examples>');
    expect(systemPrompt).toContain('</examples>');

    // Contains all 3 status types
    expect(systemPrompt).toContain('"status": "fail"');
    expect(systemPrompt).toContain('"status": "pass"');
    expect(systemPrompt).toContain('"status": "not_applicable"');

    // Each example has elementRefs
    expect(systemPrompt).toContain('"elementRefs": ["[v0-15]"]');
    expect(systemPrompt).toContain('"elementRefs": ["[v0-22]", "[v0-23]"]');
    expect(systemPrompt).toContain('"elementRefs": []');
  });

  it('batched prompt contains 3 few-shot examples with elementRefs', () => {
    const prompt = buildBatchedSystemPrompt('pdp');

    expect(prompt).toContain('<examples>');
    expect(prompt).toContain('</examples>');
    expect(prompt).toContain('"status": "fail"');
    expect(prompt).toContain('"status": "pass"');
    expect(prompt).toContain('"status": "not_applicable"');
    expect(prompt).toContain('"elementRefs": ["[v0-15]"]');
    expect(prompt).toContain('"elementRefs": ["[v0-22]", "[v0-23]"]');
    expect(prompt).toContain('"elementRefs": []');
  });

  it('examples include reasoning field with element refs', async () => {
    const { CategoryAnalyzer } = await import('../../src/heuristics/category-analyzer.js');
    const analyzer = new CategoryAnalyzer();
    const systemPrompt = (analyzer as any).buildSystemPrompt('pdp');

    // Reasoning references specific elements
    expect(systemPrompt).toContain('Found button [v0-15]');
    expect(systemPrompt).toContain('Found div [v0-22]');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// T624: Enforcement instructions in system prompts
// ═══════════════════════════════════════════════════════════════════════════════

describe('T624: enforcement instructions in system prompts', () => {
  it('per-category prompt contains enforcement section with all rules', async () => {
    const { CategoryAnalyzer } = await import('../../src/heuristics/category-analyzer.js');
    const analyzer = new CategoryAnalyzer();
    const systemPrompt = (analyzer as any).buildSystemPrompt('pdp');

    expect(systemPrompt).toContain('<enforcement>');
    expect(systemPrompt).toContain('</enforcement>');
    expect(systemPrompt).toContain('ONLY report issues you can directly observe');
    expect(systemPrompt).toContain('Set status to not_applicable if you cannot find evidence');
    expect(systemPrompt).toContain('MUST include elementRefs for every non-N/A evaluation');
    expect(systemPrompt).toContain('Do not default to pass');
  });

  it('batched prompt contains enforcement section with all rules', () => {
    const prompt = buildBatchedSystemPrompt('pdp');

    expect(prompt).toContain('<enforcement>');
    expect(prompt).toContain('</enforcement>');
    expect(prompt).toContain('ONLY report issues you can directly observe');
    expect(prompt).toContain('Set status to not_applicable if you cannot find evidence');
    expect(prompt).toContain('MUST include elementRefs for every non-N/A evaluation');
    expect(prompt).toContain('Do not default to pass');
  });
});
