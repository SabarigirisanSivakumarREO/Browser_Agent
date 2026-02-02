/**
 * Agent Progress Formatter Unit Tests
 *
 * Phase 16-CLI (T090): Tests for AgentProgressFormatter.
 * Phase 21h (T360): Tests for evidence field display.
 * 10 tests total.
 */

import { describe, it, expect } from 'vitest';
import { AgentProgressFormatter } from '../../src/output/agent-progress-formatter.js';
import type { CROAnalysisResult } from '../../src/agent/cro-agent.js';
import type { CROInsight, Severity } from '../../src/models/index.js';
import type { CROVisionAnalysisResult, HeuristicEvaluation } from '../../src/heuristics/vision/types.js';

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
  url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
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

      const output = formatter.formatAnalysisStart('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy', 10);

      expect(output).toContain('CRO AGENT ANALYSIS');
      expect(output).toContain('URL: https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy');
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
      expect(output).toContain('URL: https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy');
      expect(output).toContain('Title: Example Page');
      expect(output).toContain('SUCCESS');
      expect(output).toContain('Steps Executed: 8');
      expect(output).toContain('Total Time: 25.00s');

      // Insights section - new format (CR-001-C: includes vision count)
      expect(output).toContain('INSIGHTS: 4 tool + 0 heuristic + 0 vision = 4 total');
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

  // Phase 21h (T360): Evidence field display tests
  describe('formatAnalysisResult with evidence fields', () => {
    // Test 7: Display viewportIndex and timestamp in evaluation details
    it('should display viewportIndex and timestamp for evaluations', () => {
      const formatter = new AgentProgressFormatter({ useColors: false, width: 100 });

      const timestamp = Date.now();
      const visionAnalysis: CROVisionAnalysisResult = {
        pageType: 'pdp',
        analyzedAt: timestamp,
        screenshotUsed: true,
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false },
        evaluations: [
          {
            heuristicId: 'PDP-CTA-001',
            principle: 'CTA should be prominent',
            status: 'fail',
            severity: 'critical',
            observation: 'CTA button is too small',
            issue: 'Button size is below recommended minimum',
            recommendation: 'Increase button size',
            confidence: 0.95,
            viewportIndex: 2,
            timestamp,
          },
        ],
        insights: [],
        summary: {
          totalHeuristics: 1,
          passed: 0,
          failed: 1,
          partial: 0,
          notApplicable: 0,
          bySeverity: { critical: 1, high: 0, medium: 0, low: 0 },
        },
      };

      const result = createMockResult({
        visionAnalysis,
        pageType: 'pdp',
      });

      const output = formatter.formatAnalysisResult(result);

      expect(output).toContain('viewport: 2');
      expect(output).toContain('Evidence:');
    });

    // Test 8: Display screenshotRef when available
    it('should display screenshotRef when available', () => {
      const formatter = new AgentProgressFormatter({ useColors: false, width: 100 });

      const visionAnalysis: CROVisionAnalysisResult = {
        pageType: 'pdp',
        analyzedAt: Date.now(),
        screenshotUsed: true,
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false },
        evaluations: [
          {
            heuristicId: 'PDP-PRICE-001',
            principle: 'Price should be visible',
            status: 'fail',
            severity: 'high',
            observation: 'Price is hidden',
            issue: 'Price below fold',
            confidence: 0.9,
            screenshotRef: './evidence/viewport_v00_y0_1234567890.png',
          },
        ],
        insights: [],
        summary: {
          totalHeuristics: 1,
          passed: 0,
          failed: 1,
          partial: 0,
          notApplicable: 0,
          bySeverity: { critical: 0, high: 1, medium: 0, low: 0 },
        },
      };

      const result = createMockResult({ visionAnalysis, pageType: 'pdp' });
      const output = formatter.formatAnalysisResult(result);

      expect(output).toContain('screenshot: ./evidence/viewport_v00_y0_1234567890.png');
    });

    // Test 9: Display domElementRefs with selectors
    it('should display domElementRefs with element details', () => {
      const formatter = new AgentProgressFormatter({ useColors: false, width: 100 });

      const visionAnalysis: CROVisionAnalysisResult = {
        pageType: 'pdp',
        analyzedAt: Date.now(),
        screenshotUsed: true,
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false },
        evaluations: [
          {
            heuristicId: 'PDP-IMAGE-001',
            principle: 'Product images should be high quality',
            status: 'partial',
            severity: 'medium',
            observation: 'Image quality is mixed',
            confidence: 0.85,
            domElementRefs: [
              { index: 0, elementType: 'img', textContent: undefined },
              { index: 3, elementType: 'cta', textContent: 'Add to Cart' },
            ],
          },
        ],
        insights: [],
        summary: {
          totalHeuristics: 1,
          passed: 0,
          failed: 0,
          partial: 1,
          notApplicable: 0,
          bySeverity: { critical: 0, high: 0, medium: 1, low: 0 },
        },
      };

      const result = createMockResult({ visionAnalysis, pageType: 'pdp' });
      const output = formatter.formatAnalysisResult(result);

      expect(output).toContain('Elements:');
      expect(output).toContain('[0] img');
      expect(output).toContain('[3] cta "Add to Cart"');
    });

    // Test 10: Display boundingBox coordinates
    it('should display boundingBox coordinates', () => {
      const formatter = new AgentProgressFormatter({ useColors: false, width: 100 });

      const visionAnalysis: CROVisionAnalysisResult = {
        pageType: 'pdp',
        analyzedAt: Date.now(),
        screenshotUsed: true,
        viewport: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false },
        evaluations: [
          {
            heuristicId: 'PDP-LAYOUT-001',
            principle: 'Layout should be balanced',
            status: 'fail',
            severity: 'low',
            observation: 'Layout is unbalanced',
            issue: 'Too much whitespace',
            confidence: 0.75,
            boundingBox: {
              x: 100,
              y: 250,
              width: 300,
              height: 150,
              viewportIndex: 1,
            },
          },
        ],
        insights: [],
        summary: {
          totalHeuristics: 1,
          passed: 0,
          failed: 1,
          partial: 0,
          notApplicable: 0,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 1 },
        },
      };

      const result = createMockResult({ visionAnalysis, pageType: 'pdp' });
      const output = formatter.formatAnalysisResult(result);

      expect(output).toContain('BoundingBox:');
      expect(output).toContain('x:100');
      expect(output).toContain('y:250');
      expect(output).toContain('300×150');
      expect(output).toContain('(viewport 1)');
    });
  });
});
