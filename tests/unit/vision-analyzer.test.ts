/**
 * Vision Analyzer Unit Tests - Phase 21c (T312)
 *
 * Tests for CRO Vision Analyzer components including prompt building,
 * response parsing, and insight transformation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ViewportInfo } from '../../src/models/page-state.js';
import type { PageTypeHeuristics, HeuristicCategory } from '../../src/heuristics/knowledge/index.js';
import { loadHeuristics, clearKnowledgeCache } from '../../src/heuristics/knowledge/index.js';

// Import vision components
import {
  buildSystemPrompt,
  buildVisionPrompt,
  buildMinimalPrompt,
  estimateTokenCount,
} from '../../src/heuristics/vision/prompt-builder.js';

import {
  parseVisionResponse,
  validateCompleteness,
  VisionParseError,
} from '../../src/heuristics/vision/response-parser.js';

import {
  DEFAULT_VISION_CONFIG,
  getInsightCategory,
  HEURISTIC_TO_CATEGORY,
} from '../../src/heuristics/vision/types.js';

import type {
  HeuristicEvaluation,
  CROVisionAnalysisResult,
} from '../../src/heuristics/vision/types.js';

// Test fixtures
const mockViewport: ViewportInfo = {
  width: 1920,
  height: 1080,
  deviceScaleFactor: 1,
  isMobile: false,
};

const mockMobileViewport: ViewportInfo = {
  width: 375,
  height: 812,
  deviceScaleFactor: 2,
  isMobile: true,
};

// Mock LLM response for parsing tests
const mockLLMResponse = `{
  "evaluations": [
    {
      "heuristicId": "PDP-PRICE-001",
      "status": "pass",
      "observation": "Price is clearly visible at £85.00 near the product title",
      "confidence": 0.95
    },
    {
      "heuristicId": "PDP-CTA-001",
      "status": "fail",
      "observation": "Add to Bag button exists but is below the fold",
      "issue": "Primary CTA requires scrolling to access",
      "recommendation": "Move Add to Bag button above the fold near price",
      "confidence": 0.92
    },
    {
      "heuristicId": "PDP-REVIEW-003",
      "status": "partial",
      "observation": "Reviews visible but no filtering options",
      "issue": "Cannot filter by rating or verified purchase",
      "recommendation": "Add filter controls for reviews",
      "confidence": 0.85
    },
    {
      "heuristicId": "PDP-SELECT-002",
      "status": "not_applicable",
      "observation": "Single variant product - no selection needed",
      "confidence": 0.80
    }
  ]
}`;

describe('Vision Analyzer - Types', () => {
  describe('DEFAULT_VISION_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_VISION_CONFIG.model).toBe('gpt-4o');
      expect(DEFAULT_VISION_CONFIG.maxTokens).toBe(4096);
      expect(DEFAULT_VISION_CONFIG.temperature).toBe(0.1);
      expect(DEFAULT_VISION_CONFIG.includeObservations).toBe(true);
    });
  });

  describe('getInsightCategory', () => {
    it('should map PDP-PRICE to trust', () => {
      expect(getInsightCategory('PDP-PRICE-001')).toBe('trust');
    });

    it('should map PDP-CTA to cta', () => {
      expect(getInsightCategory('PDP-CTA-001')).toBe('cta');
    });

    it('should map PDP-IMAGE to value_prop', () => {
      expect(getInsightCategory('PDP-IMAGE-002')).toBe('value_prop');
    });

    it('should map PDP-LAYOUT to friction', () => {
      expect(getInsightCategory('PDP-LAYOUT-003')).toBe('friction');
    });

    it('should map PDP-SELECT to form', () => {
      expect(getInsightCategory('PDP-SELECT-001')).toBe('form');
    });

    it('should map PDP-MOBILE to friction', () => {
      expect(getInsightCategory('PDP-MOBILE-001')).toBe('friction');
    });

    it('should map unknown prefix to heuristic', () => {
      expect(getInsightCategory('UNKNOWN-001')).toBe('heuristic');
    });
  });

  describe('HEURISTIC_TO_CATEGORY', () => {
    it('should have all PDP category prefixes', () => {
      const expectedPrefixes = [
        'PDP-LAYOUT',
        'PDP-IMAGE',
        'PDP-PRICE',
        'PDP-DESC',
        'PDP-SPEC',
        'PDP-REVIEW',
        'PDP-SELECT',
        'PDP-CTA',
        'PDP-MOBILE',
        'PDP-UTILITY',
      ];

      for (const prefix of expectedPrefixes) {
        expect(HEURISTIC_TO_CATEGORY).toHaveProperty(prefix);
      }
    });
  });
});

describe('Vision Analyzer - Prompt Builder', () => {
  let heuristics: PageTypeHeuristics;

  beforeEach(() => {
    clearKnowledgeCache();
    heuristics = loadHeuristics('pdp');
  });

  describe('buildSystemPrompt', () => {
    it('should return a non-empty system prompt', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(100);
    });

    it('should mention CRO and Baymard', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('CRO');
      expect(prompt).toContain('Baymard');
    });

    it('should include evaluation guidelines', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('partial');
      expect(prompt).toContain('not_applicable');
      expect(prompt).toContain('Confidence');
    });
  });

  describe('buildVisionPrompt', () => {
    it('should include viewport dimensions', () => {
      const prompt = buildVisionPrompt(heuristics, mockViewport);
      expect(prompt).toContain('1920x1080');
    });

    it('should indicate desktop device', () => {
      const prompt = buildVisionPrompt(heuristics, mockViewport);
      expect(prompt).toContain('Desktop');
    });

    it('should indicate mobile device for mobile viewport', () => {
      const prompt = buildVisionPrompt(heuristics, mockMobileViewport);
      expect(prompt).toContain('Mobile');
      expect(prompt).toContain('375x812');
    });

    it('should include all heuristic IDs', () => {
      const prompt = buildVisionPrompt(heuristics, mockViewport);

      // Check for some known heuristic IDs
      expect(prompt).toContain('PDP-PRICE-001');
      expect(prompt).toContain('PDP-CTA-001');
      expect(prompt).toContain('PDP-LAYOUT-001');
    });

    it('should include severity badges', () => {
      const prompt = buildVisionPrompt(heuristics, mockViewport);
      expect(prompt).toContain('[CRITICAL]');
      expect(prompt).toContain('[HIGH]');
      expect(prompt).toContain('[MEDIUM]');
    });

    it('should include JSON output format example', () => {
      const prompt = buildVisionPrompt(heuristics, mockViewport);
      expect(prompt).toContain('"evaluations"');
      expect(prompt).toContain('"heuristicId"');
      expect(prompt).toContain('"status"');
    });

    it('should include category names and descriptions', () => {
      const prompt = buildVisionPrompt(heuristics, mockViewport);
      expect(prompt).toContain('Layout & Structure');
      expect(prompt).toContain('Pricing & Cost Transparency');
      expect(prompt).toContain('CTA & Purchase Confidence');
    });

    it('should request evaluation of all heuristics', () => {
      const prompt = buildVisionPrompt(heuristics, mockViewport);
      expect(prompt).toContain(`ALL ${heuristics.totalCount} heuristics`);
    });
  });

  describe('buildMinimalPrompt', () => {
    it('should be shorter than full prompt', () => {
      const fullPrompt = buildVisionPrompt(heuristics, mockViewport);
      const minimalPrompt = buildMinimalPrompt(heuristics, mockViewport);

      expect(minimalPrompt.length).toBeLessThan(fullPrompt.length);
    });

    it('should still include heuristic IDs', () => {
      const prompt = buildMinimalPrompt(heuristics, mockViewport);
      expect(prompt).toContain('PDP-PRICE-001');
    });
  });

  describe('estimateTokenCount', () => {
    it('should estimate tokens based on character count', () => {
      const text = 'This is a test string with 40 characters!';
      const estimate = estimateTokenCount(text);

      // ~4 chars per token, so 40 chars ≈ 10 tokens
      expect(estimate).toBeGreaterThanOrEqual(10);
      expect(estimate).toBeLessThanOrEqual(15);
    });

    it('should return higher count for longer text', () => {
      const short = 'Short text';
      const long = 'This is a much longer text that should have more tokens estimated for it because it contains many more characters.';

      expect(estimateTokenCount(long)).toBeGreaterThan(estimateTokenCount(short));
    });
  });
});

describe('Vision Analyzer - Response Parser', () => {
  let heuristics: PageTypeHeuristics;

  beforeEach(() => {
    clearKnowledgeCache();
    heuristics = loadHeuristics('pdp');
  });

  describe('parseVisionResponse', () => {
    it('should parse valid JSON response', () => {
      const evaluations = parseVisionResponse(mockLLMResponse, heuristics);

      expect(evaluations).toBeDefined();
      expect(Array.isArray(evaluations)).toBe(true);
    });

    it('should parse all evaluation statuses', () => {
      const evaluations = parseVisionResponse(mockLLMResponse, heuristics);

      const statuses = evaluations.map((e) => e.status);
      expect(statuses).toContain('pass');
      expect(statuses).toContain('fail');
      expect(statuses).toContain('partial');
      expect(statuses).toContain('not_applicable');
    });

    it('should include principle from knowledge base', () => {
      const evaluations = parseVisionResponse(mockLLMResponse, heuristics);

      const priceEval = evaluations.find((e) => e.heuristicId === 'PDP-PRICE-001');
      expect(priceEval?.principle).toBeTruthy();
      expect(priceEval?.principle).toContain('price');
    });

    it('should include severity from knowledge base', () => {
      const evaluations = parseVisionResponse(mockLLMResponse, heuristics);

      const priceEval = evaluations.find((e) => e.heuristicId === 'PDP-PRICE-001');
      expect(priceEval?.severity).toBe('critical');

      const ctaEval = evaluations.find((e) => e.heuristicId === 'PDP-CTA-001');
      expect(ctaEval?.severity).toBe('critical');
    });

    it('should include issue and recommendation for failures', () => {
      const evaluations = parseVisionResponse(mockLLMResponse, heuristics);

      const failedEval = evaluations.find(
        (e) => e.heuristicId === 'PDP-CTA-001'
      );
      expect(failedEval?.status).toBe('fail');
      expect(failedEval?.issue).toBeTruthy();
      expect(failedEval?.recommendation).toBeTruthy();
    });

    it('should handle JSON wrapped in markdown code block', () => {
      const wrappedResponse = '```json\n' + mockLLMResponse + '\n```';
      const evaluations = parseVisionResponse(wrappedResponse, heuristics);

      expect(evaluations.length).toBeGreaterThan(0);
    });

    it('should handle JSON with extra text around it', () => {
      const responseWithText =
        'Here is my analysis:\n' + mockLLMResponse + '\nHope this helps!';
      const evaluations = parseVisionResponse(responseWithText, heuristics);

      expect(evaluations.length).toBeGreaterThan(0);
    });

    it('should add missing heuristics as not_applicable', () => {
      const evaluations = parseVisionResponse(mockLLMResponse, heuristics);

      // Response only has 4 evaluations, should have 35 total
      expect(evaluations.length).toBe(heuristics.totalCount);

      // Missing ones should be not_applicable
      const notEvaluated = evaluations.filter(
        (e) => e.observation === 'Not evaluated - missing from LLM response'
      );
      expect(notEvaluated.length).toBe(heuristics.totalCount - 4);
    });

    it('should normalize status variations', () => {
      const responseWithVariations = `{
        "evaluations": [
          {"heuristicId": "PDP-PRICE-001", "status": "PASS", "observation": "test", "confidence": 0.9},
          {"heuristicId": "PDP-CTA-001", "status": "failed", "observation": "test", "confidence": 0.9},
          {"heuristicId": "PDP-REVIEW-001", "status": "n/a", "observation": "test", "confidence": 0.9}
        ]
      }`;

      const evaluations = parseVisionResponse(responseWithVariations, heuristics);

      const priceEval = evaluations.find((e) => e.heuristicId === 'PDP-PRICE-001');
      expect(priceEval?.status).toBe('pass');

      const ctaEval = evaluations.find((e) => e.heuristicId === 'PDP-CTA-001');
      expect(ctaEval?.status).toBe('fail');

      const reviewEval = evaluations.find((e) => e.heuristicId === 'PDP-REVIEW-001');
      expect(reviewEval?.status).toBe('not_applicable');
    });

    it('should normalize percentage confidence to 0-1', () => {
      const responseWithPercentage = `{
        "evaluations": [
          {"heuristicId": "PDP-PRICE-001", "status": "pass", "observation": "test", "confidence": 95}
        ]
      }`;

      const evaluations = parseVisionResponse(responseWithPercentage, heuristics);
      const priceEval = evaluations.find((e) => e.heuristicId === 'PDP-PRICE-001');

      expect(priceEval?.confidence).toBe(0.95);
    });

    it('should throw VisionParseError for invalid JSON', () => {
      expect(() => {
        parseVisionResponse('not valid json', heuristics);
      }).toThrow(VisionParseError);
    });

    it('should throw VisionParseError for missing evaluations array', () => {
      expect(() => {
        parseVisionResponse('{"data": "something"}', heuristics);
      }).toThrow(VisionParseError);
    });

    it('should skip evaluations with unknown heuristic IDs', () => {
      const responseWithUnknown = `{
        "evaluations": [
          {"heuristicId": "UNKNOWN-001", "status": "pass", "observation": "test", "confidence": 0.9},
          {"heuristicId": "PDP-PRICE-001", "status": "pass", "observation": "test", "confidence": 0.9}
        ]
      }`;

      const evaluations = parseVisionResponse(responseWithUnknown, heuristics);

      // Should not include the unknown one
      const unknownEval = evaluations.find((e) => e.heuristicId === 'UNKNOWN-001');
      expect(unknownEval).toBeUndefined();

      // Should include the valid one
      const priceEval = evaluations.find((e) => e.heuristicId === 'PDP-PRICE-001');
      expect(priceEval).toBeDefined();
    });
  });

  describe('validateCompleteness', () => {
    it('should report complete when all heuristics present', () => {
      const evaluations = parseVisionResponse(mockLLMResponse, heuristics);
      const result = validateCompleteness(evaluations, heuristics);

      // After parsing, missing ones are added, so should be complete
      expect(result.complete).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should report incomplete with missing list', () => {
      // Create minimal evaluations
      const partialEvaluations: HeuristicEvaluation[] = [
        {
          heuristicId: 'PDP-PRICE-001',
          principle: 'test',
          status: 'pass',
          severity: 'critical',
          observation: 'test',
          confidence: 0.9,
        },
      ];

      const result = validateCompleteness(partialEvaluations, heuristics);

      expect(result.complete).toBe(false);
      expect(result.missing.length).toBe(heuristics.totalCount - 1);
      expect(result.missing).not.toContain('PDP-PRICE-001');
    });
  });
});

describe('Vision Analyzer - Summary Calculation', () => {
  // Test summary calculation logic (indirectly through mock data)
  it('should count passed evaluations correctly', () => {
    const evaluations: HeuristicEvaluation[] = [
      { heuristicId: 'H1', principle: 'p1', status: 'pass', severity: 'high', observation: 'ok', confidence: 0.9 },
      { heuristicId: 'H2', principle: 'p2', status: 'pass', severity: 'medium', observation: 'ok', confidence: 0.9 },
      { heuristicId: 'H3', principle: 'p3', status: 'fail', severity: 'critical', observation: 'bad', confidence: 0.9 },
    ];

    const passed = evaluations.filter((e) => e.status === 'pass').length;
    expect(passed).toBe(2);
  });

  it('should count by severity for failed/partial', () => {
    const evaluations: HeuristicEvaluation[] = [
      { heuristicId: 'H1', principle: 'p1', status: 'fail', severity: 'critical', observation: 'bad', confidence: 0.9 },
      { heuristicId: 'H2', principle: 'p2', status: 'fail', severity: 'high', observation: 'bad', confidence: 0.9 },
      { heuristicId: 'H3', principle: 'p3', status: 'partial', severity: 'critical', observation: 'meh', confidence: 0.9 },
      { heuristicId: 'H4', principle: 'p4', status: 'pass', severity: 'critical', observation: 'ok', confidence: 0.9 },
    ];

    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };

    for (const e of evaluations) {
      if (e.status === 'fail' || e.status === 'partial') {
        bySeverity[e.severity]++;
      }
    }

    expect(bySeverity.critical).toBe(2);
    expect(bySeverity.high).toBe(1);
  });
});

describe('Vision Analyzer - Integration with Knowledge Base', () => {
  beforeEach(() => {
    clearKnowledgeCache();
  });

  it('should parse evaluations for all 35 PDP heuristics', () => {
    const heuristics = loadHeuristics('pdp');
    expect(heuristics.totalCount).toBe(35);

    const evaluations = parseVisionResponse(mockLLMResponse, heuristics);
    expect(evaluations.length).toBe(35);
  });

  it('should match heuristic severity from knowledge base', () => {
    const heuristics = loadHeuristics('pdp');

    // PDP-PRICE-001 and PDP-CTA-001 are critical
    const priceH = heuristics.categories
      .flatMap((c) => c.heuristics)
      .find((h) => h.id === 'PDP-PRICE-001');

    const ctaH = heuristics.categories
      .flatMap((c) => c.heuristics)
      .find((h) => h.id === 'PDP-CTA-001');

    expect(priceH?.severity).toBe('critical');
    expect(ctaH?.severity).toBe('critical');
  });

  it('should build prompts with correct heuristic count', () => {
    const heuristics = loadHeuristics('pdp');
    const prompt = buildVisionPrompt(heuristics, mockViewport);

    expect(prompt).toContain('35 heuristics');
  });
});
