/**
 * Agent Progress Formatter Unit Tests
 *
 * Phase 16-CLI (T090): Tests for AgentProgressFormatter.
 * 6 tests covering formatAnalysisStart, formatStepComplete, and formatAnalysisResult.
 */

import { describe, it, expect } from 'vitest';
import { AgentProgressFormatter } from '../../src/output/agent-progress-formatter.js';
import type { CROAnalysisResult } from '../../src/agent/cro-agent.js';
import type { CROInsight, Severity } from '../../src/models/index.js';

// Helper to create a mock CROInsight
const createMockInsight = (overrides: Partial<CROInsight> = {}): CROInsight => ({
  id: 'test-001',
  category: 'cta',
  type: 'weak_cta_text',
  severity: 'medium',
  element: '/html/body/button[1]',
  issue: 'Button has weak call-to-action text',
  recommendation: 'Use action-oriented text like "Get Started" or "Buy Now"',
  evidence: { text: 'Learn More' },
  ...overrides,
});

// Helper to create a mock CROAnalysisResult
const createMockResult = (overrides: Partial<CROAnalysisResult> = {}): CROAnalysisResult => ({
  url: 'https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711',
  success: true,
  insights: [],
  heuristicInsights: [],
  hypotheses: [],
  scores: {
    overall: 75,
    byCategory: {},
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
  },
  stepsExecuted: 5,
  totalTimeMs: 12500,
  terminationReason: 'Agent completed analysis',
  errors: [],
  pageTitle: 'Example Page',
  ...overrides,
});

describe('AgentProgressFormatter', () => {
  describe('formatAnalysisStart', () => {
    // Test 1: Format analysis start message
    it('should format analysis start message with URL and max steps', () => {
      const formatter = new AgentProgressFormatter({ useColors: false });

      const output = formatter.formatAnalysisStart('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711', 10);

      expect(output).toContain('CRO AGENT ANALYSIS');
      expect(output).toContain('URL: https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711');
      expect(output).toContain('Max Steps: 10');
      expect(output).toContain('Starting analysis...');
    });

    // Test 2: Format analysis start with different max steps
    it('should format analysis start with custom max steps value', () => {
      const formatter = new AgentProgressFormatter({ useColors: false });

      const output = formatter.formatAnalysisStart('https://test.com/page', 25);

      expect(output).toContain('https://test.com/page');
      expect(output).toContain('Max Steps: 25');
    });
  });

  describe('formatStepComplete', () => {
    // Test 3: Format step completion
    it('should format step completion with action and timing', () => {
      const formatter = new AgentProgressFormatter({ useColors: false });

      const output = formatter.formatStepComplete(3, 'analyze_ctas', 2, 150);

      expect(output).toContain('Step 3:');
      expect(output).toContain('analyze ctas');
      expect(output).toContain('150ms');
      expect(output).toContain('+2 insights');
    });

    // Test 4: Format step completion with zero insights
    it('should format step completion without insights message when none found', () => {
      const formatter = new AgentProgressFormatter({ useColors: false });

      const output = formatter.formatStepComplete(1, 'scroll_page', 0, 50);

      expect(output).toContain('Step 1:');
      expect(output).toContain('scroll page');
      expect(output).not.toContain('+0 insight');
    });
  });

  describe('formatAnalysisResult', () => {
    // Test 5: Format successful result with insights
    it('should format successful result with insights grouped by severity', () => {
      const formatter = new AgentProgressFormatter({ useColors: false, width: 80 });

      const insights: CROInsight[] = [
        createMockInsight({ severity: 'critical', issue: 'Critical CTA issue' }),
        createMockInsight({ severity: 'high', issue: 'High priority form issue' }),
        createMockInsight({ severity: 'medium', issue: 'Medium priority issue' }),
        createMockInsight({ severity: 'low', issue: 'Low priority issue' }),
      ];

      const result = createMockResult({
        insights,
        stepsExecuted: 8,
        totalTimeMs: 25000,
      });

      const output = formatter.formatAnalysisResult(result);

      // Header section
      expect(output).toContain('CRO ANALYSIS RESULTS');
      expect(output).toContain('URL: https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711');
      expect(output).toContain('Title: Example Page');
      expect(output).toContain('SUCCESS');
      expect(output).toContain('Steps Executed: 8');
      expect(output).toContain('Total Time: 25.00s');

      // Insights section - new format
      expect(output).toContain('INSIGHTS: 4 tool + 0 heuristic = 4 total');
      expect(output).toContain('CRITICAL (1)');
      expect(output).toContain('HIGH (1)');
      expect(output).toContain('MEDIUM (1)');
      expect(output).toContain('LOW (1)');

      // Insight content
      expect(output).toContain('Critical CTA issue');
      expect(output).toContain('High priority form issue');

      // Score section
      expect(output).toContain('CRO SCORE:');
    });

    // Test 6: Format failed result with errors
    it('should format failed result with error messages', () => {
      const formatter = new AgentProgressFormatter({ useColors: false });

      const result = createMockResult({
        success: false,
        insights: [],
        heuristicInsights: [],
        stepsExecuted: 2,
        totalTimeMs: 5000,
        terminationReason: 'Too many failures',
        errors: ['LLM timeout', 'Parse error: Invalid JSON'],
      });

      const output = formatter.formatAnalysisResult(result);

      expect(output).toContain('FAILED');
      expect(output).toContain('Steps Executed: 2');
      expect(output).toContain('Termination: Too many failures');
      expect(output).toContain('ERRORS:');
      expect(output).toContain('LLM timeout');
      expect(output).toContain('Parse error: Invalid JSON');
      expect(output).toContain('INSIGHTS FOUND: 0');
      expect(output).toContain('No CRO issues found');
    });
  });
});
