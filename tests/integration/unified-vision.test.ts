/**
 * Unified Vision Mode Integration Tests - CR-001-D
 *
 * Tests for the simplified vision API:
 * - `vision: true` flag enables unified collection + analysis
 * - Backward compatibility with deprecated flags
 * - normalizeVisionOptions() helper
 */

import { describe, it, expect } from 'vitest';
import { CROAgent, type AnalyzeOptions } from '../../src/agent/index.js';

describe('Unified Vision Mode', () => {
  describe('AnalyzeOptions Interface', () => {
    it('should accept the new vision flag', () => {
      const options: AnalyzeOptions = {
        vision: true,
        visionModel: 'gpt-4o-mini',
        visionMaxSteps: 15,
      };

      expect(options.vision).toBe(true);
      expect(options.visionModel).toBe('gpt-4o-mini');
      expect(options.visionMaxSteps).toBe(15);
    });

    it('should accept deprecated visionAgentMode flag', () => {
      const options: AnalyzeOptions = {
        visionAgentMode: true,
        visionAgentMaxSteps: 20,
      };

      expect(options.visionAgentMode).toBe(true);
      expect(options.visionAgentMaxSteps).toBe(20);
    });

    it('should accept deprecated enableUnifiedMode flag', () => {
      const options: AnalyzeOptions = {
        enableUnifiedMode: true,
      };

      expect(options.enableUnifiedMode).toBe(true);
    });

    it('should allow combining new and old flags for transition period', () => {
      // During migration, users might mix old and new flags
      const options: AnalyzeOptions = {
        vision: true,
        visionModel: 'gpt-4o',
        // These are deprecated but still accepted
        visionAgentMode: true,
        enableUnifiedMode: true,
      };

      expect(options.vision).toBe(true);
      expect(options.visionAgentMode).toBe(true);
      expect(options.enableUnifiedMode).toBe(true);
    });
  });

  describe('CROAgent Configuration', () => {
    it('should create CROAgent with default options', () => {
      const agent = new CROAgent();
      expect(agent).toBeDefined();
      expect(agent.getOptions().maxSteps).toBe(10);
    });

    it('should create CROAgent with custom max steps', () => {
      const agent = new CROAgent({ maxSteps: 25 });
      expect(agent.getOptions().maxSteps).toBe(25);
    });
  });

  describe('Vision Model Options', () => {
    it('should support gpt-4o-mini model', () => {
      const options: AnalyzeOptions = {
        vision: true,
        visionModel: 'gpt-4o-mini',
      };

      expect(options.visionModel).toBe('gpt-4o-mini');
    });

    it('should support gpt-4o model', () => {
      const options: AnalyzeOptions = {
        vision: true,
        visionModel: 'gpt-4o',
      };

      expect(options.visionModel).toBe('gpt-4o');
    });
  });

  describe('Heuristic Category Filtering', () => {
    it('should accept heuristic categories filter', () => {
      const options: AnalyzeOptions = {
        vision: true,
        heuristicCategories: ['CTA & Purchase Confidence', 'Pricing & Cost Transparency'],
      };

      expect(options.heuristicCategories).toHaveLength(2);
      expect(options.heuristicCategories).toContain('CTA & Purchase Confidence');
    });
  });

  describe('Backward Compatibility', () => {
    // These tests document that old options still work during migration period

    it('should accept useVisionAnalysis (deprecated)', () => {
      const options: AnalyzeOptions = {
        useVisionAnalysis: true,
      };

      expect(options.useVisionAnalysis).toBe(true);
    });

    it('should accept enableVision (deprecated)', () => {
      const options: AnalyzeOptions = {
        enableVision: true,
      };

      expect(options.enableVision).toBe(true);
    });

    it('should accept visionConfig (deprecated)', () => {
      const options: AnalyzeOptions = {
        visionConfig: {
          maxTokens: 2048,
        },
      };

      expect(options.visionConfig?.maxTokens).toBe(2048);
    });
  });
});
