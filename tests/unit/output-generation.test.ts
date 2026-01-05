/**
 * Output Generation Unit Tests - Phase 18d + Phase 18-CLI
 *
 * Tests for:
 * - HypothesisGenerator (7 tests)
 * - InsightDeduplicator (4 tests)
 * - InsightPrioritizer (3 tests)
 * - MarkdownReporter (4 tests)
 * - JSONExporter (3 tests)
 * - FileWriter (2 tests) - T119a
 *
 * Total: 23 tests
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  HypothesisGenerator,
  InsightDeduplicator,
  InsightPrioritizer,
  MarkdownReporter,
  JSONExporter,
  FileWriter,
} from '../../src/output/index.js';
import type { CROInsight, Hypothesis } from '../../src/models/index.js';

// ─── TEST FIXTURES ────────────────────────────────────────────────────────────

function createInsight(overrides: Partial<CROInsight> = {}): CROInsight {
  return {
    id: 'INS-001',
    category: 'cta',
    type: 'vague_cta_text',
    severity: 'high',
    element: '//button[@id="submit"]',
    issue: 'CTA button text "Click Here" is vague and does not convey action',
    recommendation: 'Replace with specific action text like "Get Free Quote"',
    ...overrides,
  };
}

function createInsightSet(): CROInsight[] {
  return [
    createInsight({ id: 'INS-001', severity: 'critical', type: 'no_cta_above_fold' }),
    createInsight({ id: 'INS-002', severity: 'high', type: 'vague_cta_text' }),
    createInsight({ id: 'INS-003', severity: 'medium', type: 'missing_field_label', category: 'form' }),
    createInsight({ id: 'INS-004', severity: 'low', type: 'headline_too_long', category: 'value_prop' }),
  ];
}

// ─── HYPOTHESIS GENERATOR TESTS ───────────────────────────────────────────────

describe('HypothesisGenerator', () => {
  let generator: HypothesisGenerator;

  beforeEach(() => {
    generator = new HypothesisGenerator();
  });

  it('generates hypothesis from high severity insight', () => {
    const insights = [createInsight({ severity: 'high' })];
    const hypotheses = generator.generate(insights);

    expect(hypotheses).toHaveLength(1);
    expect(hypotheses[0].id).toBe('H-001');
    expect(hypotheses[0].title).toContain('Fix');
    expect(hypotheses[0].hypothesis).toContain('will improve');
    expect(hypotheses[0].relatedInsights).toContain('INS-001');
  });

  it('skips low severity insight by default', () => {
    const insights = [createInsight({ severity: 'low' })];
    const hypotheses = generator.generate(insights);

    expect(hypotheses).toHaveLength(0);
  });

  it('includes medium severity when configured', () => {
    const generator = new HypothesisGenerator({ minSeverity: 'medium' });
    const insights = [createInsight({ severity: 'medium' })];
    const hypotheses = generator.generate(insights);

    expect(hypotheses).toHaveLength(1);
  });

  it('sorts hypotheses by priority (highest first)', () => {
    const insights = [
      createInsight({ id: 'INS-001', severity: 'high' }),
      createInsight({ id: 'INS-002', severity: 'critical' }),
    ];
    const hypotheses = generator.generate(insights);

    expect(hypotheses).toHaveLength(2);
    expect(hypotheses[0].priority).toBeGreaterThanOrEqual(hypotheses[1].priority);
  });

  it('formats hypothesis statement correctly', () => {
    const insights = [createInsight()];
    const hypotheses = generator.generate(insights);

    expect(hypotheses[0].hypothesis).toMatch(/^If we .+, then .+ will improve because .+$/);
  });

  it('returns empty array for empty insights', () => {
    const hypotheses = generator.generate([]);
    expect(hypotheses).toHaveLength(0);
  });

  it('maps insight category to correct metric', () => {
    const ctaInsight = createInsight({ category: 'cta' });
    const formInsight = createInsight({ category: 'form', id: 'INS-002' });

    const hypotheses = generator.generate([ctaInsight, formInsight]);

    expect(hypotheses[0].primaryMetric).toContain('rate');
    expect(hypotheses[1].primaryMetric).toContain('rate');
  });
});

// ─── INSIGHT DEDUPLICATOR TESTS ───────────────────────────────────────────────

describe('InsightDeduplicator', () => {
  let deduplicator: InsightDeduplicator;

  beforeEach(() => {
    deduplicator = new InsightDeduplicator();
  });

  it('removes exact duplicate (same type and element)', () => {
    const insights = [
      createInsight({ id: 'INS-001', type: 'vague_cta', element: '//button[1]' }),
      createInsight({ id: 'INS-002', type: 'vague_cta', element: '//button[1]' }),
    ];
    const result = deduplicator.deduplicate(insights);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('INS-001'); // Keeps first occurrence
  });

  it('keeps insights with different elements', () => {
    const insights = [
      createInsight({ id: 'INS-001', type: 'vague_cta', element: '//button[1]' }),
      createInsight({ id: 'INS-002', type: 'vague_cta', element: '//button[2]' }),
    ];
    const result = deduplicator.deduplicate(insights);

    expect(result).toHaveLength(2);
  });

  it('keeps insights with different types', () => {
    const insights = [
      createInsight({ id: 'INS-001', type: 'vague_cta', element: '//button[1]' }),
      createInsight({ id: 'INS-002', type: 'no_cta_above_fold', element: '//button[1]' }),
    ];
    const result = deduplicator.deduplicate(insights);

    expect(result).toHaveLength(2);
  });

  it('merges evidence from duplicates', () => {
    const insights = [
      createInsight({
        id: 'INS-001',
        type: 'vague_cta',
        element: '//button[1]',
        evidence: { text: 'Click Here' },
      }),
      createInsight({
        id: 'INS-002',
        type: 'vague_cta',
        element: '//button[1]',
        evidence: { selector: '.btn-primary' },
      }),
    ];
    const result = deduplicator.deduplicate(insights);

    expect(result).toHaveLength(1);
    expect(result[0].evidence?.text).toBe('Click Here');
    expect(result[0].evidence?.selector).toBe('.btn-primary');
  });
});

// ─── INSIGHT PRIORITIZER TESTS ────────────────────────────────────────────────

describe('InsightPrioritizer', () => {
  let prioritizer: InsightPrioritizer;

  beforeEach(() => {
    prioritizer = new InsightPrioritizer();
  });

  it('sorts by severity (critical > high > medium > low)', () => {
    const insights = [
      createInsight({ id: 'INS-001', severity: 'low' }),
      createInsight({ id: 'INS-002', severity: 'critical' }),
      createInsight({ id: 'INS-003', severity: 'medium' }),
      createInsight({ id: 'INS-004', severity: 'high' }),
    ];
    const result = prioritizer.prioritize(insights);

    expect(result[0].severity).toBe('critical');
    expect(result[1].severity).toBe('high');
    expect(result[2].severity).toBe('medium');
    expect(result[3].severity).toBe('low');
  });

  it('boosts business-critical types for ecommerce', () => {
    const insights = [
      createInsight({ id: 'INS-001', severity: 'high', type: 'some_other_issue' }),
      createInsight({ id: 'INS-002', severity: 'high', type: 'no_search_ecommerce' }),
    ];
    const result = prioritizer.prioritize(insights, 'ecommerce');

    // no_search_ecommerce should be boosted for ecommerce
    expect(result[0].type).toBe('no_search_ecommerce');
  });

  it('maintains stable sort for equal severity', () => {
    const insights = [
      createInsight({ id: 'INS-001', severity: 'high', type: 'type_a' }),
      createInsight({ id: 'INS-002', severity: 'high', type: 'type_b' }),
      createInsight({ id: 'INS-003', severity: 'high', type: 'type_c' }),
    ];
    const result = prioritizer.prioritize(insights);

    // Without business type boost, same severity should maintain original order
    expect(result[0].id).toBe('INS-001');
    expect(result[1].id).toBe('INS-002');
    expect(result[2].id).toBe('INS-003');
  });
});

// ─── MARKDOWN REPORTER TESTS ──────────────────────────────────────────────────

describe('MarkdownReporter', () => {
  let reporter: MarkdownReporter;

  beforeEach(() => {
    reporter = new MarkdownReporter();
  });

  it('includes all required sections', () => {
    const result = {
      url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
      pageTitle: 'Example Page',
      insights: createInsightSet(),
    };
    const markdown = reporter.generate(result);

    expect(markdown).toContain('# CRO Analysis Report');
    expect(markdown).toContain('## Executive Summary');
    expect(markdown).toContain('## Critical Issues');
    expect(markdown).toContain('## High Priority Issues');
    expect(markdown).toContain('## Medium Priority Issues');
    expect(markdown).toContain('## Low Priority Issues');
    expect(markdown).toContain('## Recommended A/B Tests');
  });

  it('handles empty insights gracefully', () => {
    const result = {
      url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
      insights: [],
    };
    const markdown = reporter.generate(result);

    expect(markdown).toContain('No critical issues found');
    expect(markdown).toContain('No high priority issues found');
    expect(markdown).toContain('No tests recommended');
  });

  it('formats hypotheses correctly', () => {
    const hypotheses: Hypothesis[] = [
      {
        id: 'H-001',
        title: 'Fix Vague CTA Text',
        hypothesis: 'If we improve CTA text, then CTR will improve',
        controlDescription: 'Current: vague text',
        treatmentDescription: 'Use specific action text',
        primaryMetric: 'Click-through rate',
        expectedImpact: 'high',
        priority: 8,
        relatedInsights: ['INS-001'],
      },
    ];
    const result = {
      url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
      insights: [],
      hypotheses,
    };
    const markdown = reporter.generate(result);

    expect(markdown).toContain('Test 1: Fix Vague CTA Text');
    expect(markdown).toContain('**Hypothesis**');
    expect(markdown).toContain('Click-through rate');
  });

  it('displays scores in executive summary', () => {
    const result = {
      url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
      insights: createInsightSet(),
      scores: {
        overall: 75,
        byCategory: { cta: 2 },
        criticalCount: 1,
        highCount: 1,
        mediumCount: 1,
        lowCount: 1,
      },
    };
    const markdown = reporter.generate(result);

    expect(markdown).toContain('**75/100**');
    expect(markdown).toContain('Critical Issues | 1');
    expect(markdown).toContain('High Priority | 1');
  });
});

// ─── JSON EXPORTER TESTS ──────────────────────────────────────────────────────

describe('JSONExporter', () => {
  let exporter: JSONExporter;

  beforeEach(() => {
    exporter = new JSONExporter();
  });

  it('exports valid JSON', () => {
    const result = {
      url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
      insights: createInsightSet(),
    };
    const json = exporter.export(result);

    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('includes all required fields', () => {
    const result = {
      url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
      pageTitle: 'Test Page',
      insights: createInsightSet(),
      hypotheses: [],
    };
    const data = exporter.exportAsObject(result);

    expect(data.meta.url).toBe('https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy');
    expect(data.meta.pageTitle).toBe('Test Page');
    expect(data.meta.analysisDate).toBeDefined();
    expect(data.scores.overall).toBeDefined();
    expect(data.insights.total).toBe(4);
    expect(data.insights.bySeverity.critical).toBeDefined();
    expect(data.insights.byCategory).toBeDefined();
    expect(data.hypotheses).toEqual([]);
  });

  it('groups insights by category', () => {
    const insights = [
      createInsight({ id: 'INS-001', category: 'cta' }),
      createInsight({ id: 'INS-002', category: 'cta' }),
      createInsight({ id: 'INS-003', category: 'form' }),
    ];
    const result = {
      url: 'https://www.peregrineclothing.co.uk/collections/polo-shirts/products/lynton-polo-shirt?colour=Navy',
      insights,
    };
    const data = exporter.exportAsObject(result);

    expect(data.insights.byCategory['cta']).toHaveLength(2);
    expect(data.insights.byCategory['form']).toHaveLength(1);
  });
});

// ─── FILE WRITER TESTS - T119a ─────────────────────────────────────────────────

describe('FileWriter', () => {
  const tempDir = join(tmpdir(), `cro-file-writer-test-${Date.now()}`);

  beforeEach(async () => {
    await mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('writes content to new file successfully', async () => {
    const writer = new FileWriter();
    const testContent = 'Test content for file writer';
    const testPath = join(tempDir, `test-new-${Date.now()}.txt`);

    const result = await writer.write(testContent, testPath);

    expect(result.success).toBe(true);
    expect(result.path).toBe(testPath);
    expect(result.overwrote).toBe(false);

    // Verify file content
    const content = await readFile(testPath, 'utf-8');
    expect(content).toBe(testContent);
  });

  it('detects overwrite on existing file', async () => {
    const writer = new FileWriter();
    const testPath = join(tempDir, `test-overwrite-${Date.now()}.txt`);

    // Write first time
    await writer.write('First content', testPath);

    // Write second time
    const result = await writer.write('Second content', testPath);

    expect(result.success).toBe(true);
    expect(result.overwrote).toBe(true);

    const content = await readFile(testPath, 'utf-8');
    expect(content).toBe('Second content');
  });
});
