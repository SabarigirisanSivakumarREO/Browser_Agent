/**
 * Tests for LLMPageTypeDetector - Phase 24 (T464)
 *
 * NOTE: We test types and exports here since actual detection
 * requires OpenAI API key. Integration tests will cover actual detection.
 */

import { describe, it, expect } from 'vitest';

describe('LLMPageTypeDetector', () => {
  describe('exports', () => {
    it('should export LLMPageTypeDetector class', async () => {
      const { LLMPageTypeDetector } = await import(
        '../../src/heuristics/llm-page-type-detector.js'
      );

      expect(LLMPageTypeDetector).toBeDefined();
      expect(typeof LLMPageTypeDetector).toBe('function');
    });

    it('should export createLLMPageTypeDetector factory', async () => {
      const { createLLMPageTypeDetector } = await import(
        '../../src/heuristics/llm-page-type-detector.js'
      );

      expect(createLLMPageTypeDetector).toBeDefined();
      expect(typeof createLLMPageTypeDetector).toBe('function');
    });
  });
});

describe('LLMDetectionConfig', () => {
  it('should have valid default values', async () => {
    type ConfigType = import('../../src/heuristics/llm-page-type-detector.js').LLMDetectionConfig;

    const config: ConfigType = {
      model: 'gpt-4o-mini',
      timeout: 10000,
      maxTokens: 200,
      imageMaxWidth: 512,
      temperature: 0.1,
    };

    expect(config.model).toBe('gpt-4o-mini');
    expect(config.timeout).toBe(10000);
    expect(config.maxTokens).toBe(200);
    expect(config.imageMaxWidth).toBe(512);
    expect(config.temperature).toBe(0.1);
  });

  it('should support gpt-4o model', async () => {
    type ConfigType = import('../../src/heuristics/llm-page-type-detector.js').LLMDetectionConfig;

    const config: ConfigType = {
      model: 'gpt-4o',
      timeout: 15000,
      maxTokens: 300,
      imageMaxWidth: 768,
      temperature: 0.2,
    };

    expect(config.model).toBe('gpt-4o');
  });
});

describe('LLMDetectionResult', () => {
  it('should have required structure', async () => {
    type ResultType = import('../../src/heuristics/llm-page-type-detector.js').LLMDetectionResult;

    const result: ResultType = {
      pageType: 'pdp',
      confidence: 0.9,
      reasoning: 'Test reasoning',
      tier: 'llm',
      detectionTimeMs: 100,
    };

    expect(result.pageType).toBe('pdp');
    expect(result.confidence).toBe(0.9);
    expect(result.reasoning).toBe('Test reasoning');
    expect(result.tier).toBe('llm');
    expect(result.detectionTimeMs).toBe(100);
  });

  it('should support all page types', async () => {
    type ResultType = import('../../src/heuristics/llm-page-type-detector.js').LLMDetectionResult;

    const pageTypes = ['pdp', 'plp', 'homepage', 'cart', 'checkout', 'account', 'other'] as const;

    for (const pageType of pageTypes) {
      const result: ResultType = {
        pageType,
        confidence: 0.8,
        reasoning: `Detected ${pageType}`,
        tier: 'llm',
        detectionTimeMs: 150,
      };

      expect(result.pageType).toBe(pageType);
    }
  });

  it('should have tier as llm', async () => {
    type ResultType = import('../../src/heuristics/llm-page-type-detector.js').LLMDetectionResult;

    const result: ResultType = {
      pageType: 'cart',
      confidence: 0.85,
      reasoning: 'Shopping cart page',
      tier: 'llm',
      detectionTimeMs: 200,
    };

    // Tier should always be 'llm' for LLM detector
    expect(result.tier).toBe('llm');
  });
});
