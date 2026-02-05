/**
 * LLM Input Capture Integration Tests - Phase 23 (T408)
 *
 * Tests for end-to-end LLM input capture flow:
 * - CapturedCategoryInputs structure
 * - LLMInputWriter saves to disk
 * - Data conversion from category to viewport format
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import type { CapturedCategoryInputs } from '../../src/heuristics/index.js';
import {
  LLMInputWriter,
  type LLMInputData,
} from '../../src/output/index.js';

// Mock fs for LLMInputWriter tests
vi.mock('fs/promises');
const mockMkdir = vi.mocked(fs.mkdir);
const mockWriteFile = vi.mocked(fs.writeFile);

describe('LLM Input Capture Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CapturedCategoryInputs structure', () => {
    it('validates captured inputs structure', () => {
      // Create a valid CapturedCategoryInputs object
      const captured: CapturedCategoryInputs = {
        categoryName: 'Product Imagery',
        systemPrompt: 'You are a CRO expert.',
        userPrompt: 'Analyze this page for issues.',
        screenshots: [
          { viewportIndex: 0, scrollPosition: 0, base64: 'screenshot0' },
          { viewportIndex: 1, scrollPosition: 720, base64: 'screenshot1' },
        ],
        domSnapshots: [
          { viewportIndex: 0, scrollPosition: 0, serialized: '<div>[0]</div>', elementCount: 5 },
          { viewportIndex: 1, scrollPosition: 720, serialized: '<div>[1]</div>', elementCount: 7 },
        ],
        timestamp: Date.now(),
      };

      // Verify structure
      expect(captured.categoryName).toBe('Product Imagery');
      expect(captured.screenshots).toHaveLength(2);
      expect(captured.domSnapshots).toHaveLength(2);
      expect(captured.screenshots[0]?.viewportIndex).toBe(0);
      expect(captured.domSnapshots[0]?.serialized).toContain('[0]');
    });

    it('converts CapturedCategoryInputs to LLMInputData array', () => {
      const captured: CapturedCategoryInputs = {
        categoryName: 'Test Category',
        systemPrompt: 'System prompt text',
        userPrompt: 'User prompt text',
        screenshots: [
          { viewportIndex: 0, scrollPosition: 0, base64: 'base64_0' },
          { viewportIndex: 1, scrollPosition: 720, base64: 'base64_1' },
        ],
        domSnapshots: [
          { viewportIndex: 0, scrollPosition: 0, serialized: 'dom_0', elementCount: 5 },
          { viewportIndex: 1, scrollPosition: 720, serialized: 'dom_1', elementCount: 7 },
        ],
        timestamp: 1706980000000,
      };

      // Convert to LLMInputData format (same logic as CLI)
      const llmInputData: LLMInputData[] = [];
      for (let i = 0; i < captured.screenshots.length; i++) {
        const screenshot = captured.screenshots[i];
        const domSnapshot = captured.domSnapshots[i];
        if (!screenshot || !domSnapshot) continue;

        llmInputData.push({
          viewportIndex: screenshot.viewportIndex,
          scrollPosition: screenshot.scrollPosition,
          domSnapshot: {
            serialized: domSnapshot.serialized,
            elementCount: domSnapshot.elementCount,
          },
          screenshotBase64: screenshot.base64,
          systemPrompt: captured.systemPrompt,
          userPrompt: captured.userPrompt,
          timestamp: captured.timestamp,
        });
      }

      expect(llmInputData).toHaveLength(2);
      expect(llmInputData[0]?.viewportIndex).toBe(0);
      expect(llmInputData[0]?.systemPrompt).toBe('System prompt text');
      expect(llmInputData[1]?.viewportIndex).toBe(1);
      expect(llmInputData[1]?.scrollPosition).toBe(720);
    });
  });

  describe('LLMInputWriter saving', () => {
    it('saves all inputs when given category data', async () => {
      const timestamp = '2026-02-03T10-30-00';
      const writer = new LLMInputWriter({ outputDir: './test-llm-inputs' });

      // Convert CapturedCategoryInputs to LLMInputData format
      const capturedInputs: CapturedCategoryInputs = {
        categoryName: 'Test Category',
        systemPrompt: 'You are a CRO expert.',
        userPrompt: 'Analyze this page.',
        screenshots: [
          { viewportIndex: 0, scrollPosition: 0, base64: 'base64data' },
          { viewportIndex: 1, scrollPosition: 720, base64: 'base64data2' },
        ],
        domSnapshots: [
          { viewportIndex: 0, scrollPosition: 0, serialized: '<div>0</div>', elementCount: 5 },
          { viewportIndex: 1, scrollPosition: 720, serialized: '<div>1</div>', elementCount: 7 },
        ],
        timestamp: Date.now(),
      };

      // Convert to LLMInputData array
      const llmInputs: LLMInputData[] = capturedInputs.screenshots.map((screenshot, i) => ({
        viewportIndex: screenshot.viewportIndex,
        scrollPosition: screenshot.scrollPosition,
        domSnapshot: capturedInputs.domSnapshots[i] ?? {},
        screenshotBase64: screenshot.base64,
        systemPrompt: capturedInputs.systemPrompt,
        userPrompt: capturedInputs.userPrompt,
        timestamp: capturedInputs.timestamp,
      }));

      const result = await writer.saveAll(llmInputs, timestamp);

      expect(result.success).toBe(true);
      // 1 system prompt + 2 DOM snapshots + 2 screenshots + 2 user prompts = 7 files
      expect(result.filesWritten).toBe(7);
      expect(result.outputDir).toContain('test-llm-inputs');
      expect(result.outputDir).toContain(timestamp);
    });

    it('does not save inputs when array is empty', async () => {
      const writer = new LLMInputWriter();
      const result = await writer.saveAll([], 'empty-session');

      expect(result.success).toBe(true);
      expect(result.filesWritten).toBe(0);
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('creates correct directory structure', async () => {
      const writer = new LLMInputWriter({ outputDir: './llm-inputs' });
      const timestamp = '2026-02-03T10-30-00';

      const llmInputs: LLMInputData[] = [{
        viewportIndex: 0,
        scrollPosition: 0,
        domSnapshot: { test: 'data' },
        screenshotBase64: 'base64',
        systemPrompt: 'system',
        userPrompt: 'user',
        timestamp: Date.now(),
      }];

      await writer.saveAll(llmInputs, timestamp);

      // Verify directories created
      const mkdirCalls = mockMkdir.mock.calls.map((c) => c[0] as string);
      expect(mkdirCalls.some((p) => p.includes('DOM-snapshots'))).toBe(true);
      expect(mkdirCalls.some((p) => p.includes('Screenshots'))).toBe(true);
      expect(mkdirCalls.some((p) => p.includes('Prompts'))).toBe(true);

      // Verify file paths
      const writeFileCalls = mockWriteFile.mock.calls.map((c) => c[0] as string);

      // DOM snapshot
      expect(writeFileCalls.some((p) =>
        p.includes('DOM-snapshots') && p.includes('viewport-0.json')
      )).toBe(true);

      // Screenshot
      expect(writeFileCalls.some((p) =>
        p.includes('Screenshots') && p.includes('viewport-0.png')
      )).toBe(true);

      // System prompt
      expect(writeFileCalls.some((p) =>
        p.includes('Prompts') && p.includes('system-prompt.txt')
      )).toBe(true);

      // User prompt
      expect(writeFileCalls.some((p) =>
        p.includes('Prompts') && p.includes('viewport-0-prompt.txt')
      )).toBe(true);
    });
  });
});
