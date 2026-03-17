/**
 * Model Configuration Tests - Phase 27A (T616)
 */
import { describe, it, expect } from 'vitest';
import { MODEL_DEFAULTS, type AnalysisModel } from '../../src/heuristics/model-config.js';

describe('MODEL_DEFAULTS', () => {
  it('should have analysis model set to gpt-4o', () => {
    expect(MODEL_DEFAULTS.analysis).toBe('gpt-4o-mini');
  });

  it('should have fast model set to gpt-4o-mini', () => {
    expect(MODEL_DEFAULTS.fast).toBe('gpt-4o-mini');
  });

  it('should be exported from heuristics index', async () => {
    const { MODEL_DEFAULTS: indexDefaults } = await import('../../src/heuristics/index.js');
    expect(indexDefaults).toBeDefined();
    expect(indexDefaults.analysis).toBe('gpt-4o-mini');
    expect(indexDefaults.fast).toBe('gpt-4o-mini');
  });

  it('should type-check AnalysisModel type', () => {
    const model: AnalysisModel = MODEL_DEFAULTS.analysis;
    expect(model).toBe('gpt-4o-mini');
    const fastModel: AnalysisModel = MODEL_DEFAULTS.fast;
    expect(fastModel).toBe('gpt-4o-mini');
  });
});
