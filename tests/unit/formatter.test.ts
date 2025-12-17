/**
 * Unit tests for ResultFormatter.
 */

import { describe, it, expect } from 'vitest';
import { ResultFormatter } from '../../src/output/formatter.js';
import type { AgentResult, BatchResult } from '../../src/types/index.js';

describe('ResultFormatter', () => {
  const formatter = new ResultFormatter(80);

  describe('formatResult', () => {
    it('should format successful result', () => {
      const result: AgentResult = {
        url: 'https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711',
        pageLoad: {
          success: true,
          title: 'Example Domain',
          url: 'https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711/',
          loadTimeMs: 1234,
        },
        extraction: {
          headings: [
            { level: 1, text: 'Example Domain', index: 0 },
            { level: 2, text: 'More Information', index: 1 },
          ],
          totalCount: 2,
          countByLevel: { 1: 1, 2: 1 },
        },
        processing: {
          summary: 'A simple example page with minimal content.',
          categories: ['Landing Page', 'Example'],
          insights: ['Page has basic structure', 'Minimal content'],
        },
        success: true,
        totalTimeMs: 5000,
      };

      const output = formatter.formatResult(result);

      expect(output).toContain('BROWSER AGENT RESULTS');
      expect(output).toContain('https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711');
      expect(output).toContain('SUCCESS');
      expect(output).toContain('1.23s');
      expect(output).toContain('HEADINGS FOUND: 2');
      expect(output).toContain('h1: 1');
      expect(output).toContain('h2: 1');
      expect(output).toContain('[h1] Example Domain');
      expect(output).toContain('LANGCHAIN INSIGHTS');
      expect(output).toContain('A simple example page');
      expect(output).toContain('Landing Page');
    });

    it('should format failed result with error', () => {
      const result: AgentResult = {
        url: 'https://invalid.example',
        pageLoad: {
          success: false,
          url: 'https://invalid.example',
          error: 'Page load timed out after 60000ms',
          loadTimeMs: 60000,
        },
        extraction: null,
        processing: null,
        success: false,
        error: 'Page load timed out after 60000ms',
        errorStage: 'load',
        totalTimeMs: 60000,
      };

      const output = formatter.formatResult(result);

      expect(output).toContain('FAILED');
      expect(output).toContain('ERROR');
      expect(output).toContain('load');
      expect(output).toContain('timed out');
    });

    it('should truncate long headings', () => {
      const longHeading = 'A'.repeat(100);
      const result: AgentResult = {
        url: 'https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711',
        pageLoad: { success: true, url: 'https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711/' },
        extraction: {
          headings: [{ level: 1, text: longHeading, index: 0 }],
          totalCount: 1,
          countByLevel: { 1: 1 },
        },
        processing: null,
        success: true,
        totalTimeMs: 1000,
      };

      const output = formatter.formatResult(result);

      // The heading text should be truncated (contain ellipsis)
      expect(output).toContain('...');
      // The full 100-char heading should not appear untruncated
      expect(output).not.toContain(longHeading);
    });

    it('should limit displayed headings to 10', () => {
      const headings = Array.from({ length: 15 }, (_, i) => ({
        level: 2 as const,
        text: `Heading ${i + 1}`,
        index: i,
      }));

      const result: AgentResult = {
        url: 'https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711',
        pageLoad: { success: true, url: 'https://in.burberry.com/relaxed-fit-gabardine-overshirt-p81108711/' },
        extraction: {
          headings,
          totalCount: 15,
          countByLevel: { 2: 15 },
        },
        processing: null,
        success: true,
        totalTimeMs: 1000,
      };

      const output = formatter.formatResult(result);

      expect(output).toContain('Heading 1');
      expect(output).toContain('Heading 10');
      expect(output).toContain('... and 5 more');
      expect(output).not.toContain('Heading 11');
    });
  });

  describe('formatBatch', () => {
    it('should format batch results', () => {
      const batch: BatchResult = {
        results: [
          {
            url: 'https://example1.com',
            pageLoad: { success: true, url: 'https://example1.com/' },
            extraction: { headings: [], totalCount: 0, countByLevel: {} },
            processing: { summary: 'Test', categories: [], insights: [] },
            success: true,
            totalTimeMs: 1000,
          },
          {
            url: 'https://example2.com',
            pageLoad: { success: false, url: 'https://example2.com/', error: 'Failed' },
            extraction: null,
            processing: null,
            success: false,
            error: 'Failed',
            errorStage: 'load',
            totalTimeMs: 500,
          },
        ],
        successCount: 1,
        failureCount: 1,
        totalTimeMs: 1500,
      };

      const output = formatter.formatBatch(batch);

      expect(output).toContain('BATCH PROCESSING RESULTS');
      expect(output).toContain('Total URLs: 2');
      expect(output).toContain('Success: 1');
      expect(output).toContain('Failed: 1');
      expect(output).toContain('[1/2]');
      expect(output).toContain('[2/2]');
    });
  });

  describe('formatError', () => {
    it('should format error message', () => {
      const output = formatter.formatError('Connection refused', 'load');

      expect(output).toContain('ERROR');
      expect(output).toContain('Stage: load');
      expect(output).toContain('Connection refused');
    });
  });
});
