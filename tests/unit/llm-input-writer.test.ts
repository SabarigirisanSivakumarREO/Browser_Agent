/**
 * LLM Input Writer Unit Tests - Phase 23 (T407)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  LLMInputWriter,
  createLLMInputWriter,
  type LLMInputData,
  DEFAULT_LLM_INPUT_CONFIG,
} from '../../src/output/llm-input-writer.js';

// Mock fs module
vi.mock('fs/promises');

describe('LLMInputWriter', () => {
  const mockMkdir = vi.mocked(fs.mkdir);
  const mockWriteFile = vi.mocked(fs.writeFile);

  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful behavior
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create test input data
  function createTestInput(viewportIndex: number, overrides?: Partial<LLMInputData>): LLMInputData {
    return {
      viewportIndex,
      scrollPosition: viewportIndex * 720,
      domSnapshot: {
        serialized: `<div>[${viewportIndex}] Test element</div>`,
        elementCount: viewportIndex + 5,
      },
      screenshotBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      systemPrompt: 'You are a CRO expert.',
      userPrompt: `Analyze viewport ${viewportIndex} for CRO issues.`,
      timestamp: Date.now(),
      ...overrides,
    };
  }

  it('creates directory structure with timestamp', async () => {
    const writer = new LLMInputWriter({ outputDir: './test-llm-inputs' });
    const inputs = [createTestInput(0)];
    const timestamp = '2026-02-03T10-30-00';

    await writer.saveAll(inputs, timestamp);

    // Should create three subdirectories
    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringContaining(path.join('test-llm-inputs', timestamp, 'DOM-snapshots')),
      { recursive: true }
    );
    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringContaining(path.join('test-llm-inputs', timestamp, 'Screenshots')),
      { recursive: true }
    );
    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringContaining(path.join('test-llm-inputs', timestamp, 'Prompts')),
      { recursive: true }
    );
  });

  it('saves DOM snapshot as JSON', async () => {
    const writer = new LLMInputWriter();
    const inputs = [createTestInput(0)];

    await writer.saveAll(inputs, 'test-session');

    // Find the DOM snapshot write call
    const domSnapshotCall = mockWriteFile.mock.calls.find((call) =>
      (call[0] as string).includes('viewport-0.json')
    );

    expect(domSnapshotCall).toBeDefined();
    const [filePath, content] = domSnapshotCall!;
    expect(filePath).toContain('DOM-snapshots');
    expect(filePath).toContain('viewport-0.json');

    // Verify JSON structure
    const parsed = JSON.parse(content as string);
    expect(parsed).toHaveProperty('viewportIndex', 0);
    expect(parsed).toHaveProperty('scrollPosition', 0);
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('dom');
  });

  it('saves screenshot as PNG', async () => {
    const writer = new LLMInputWriter();
    const inputs = [createTestInput(0)];

    await writer.saveAll(inputs, 'test-session');

    // Find the screenshot write call
    const screenshotCall = mockWriteFile.mock.calls.find((call) =>
      (call[0] as string).includes('viewport-0.png')
    );

    expect(screenshotCall).toBeDefined();
    const [filePath, content] = screenshotCall!;
    expect(filePath).toContain('Screenshots');
    expect(filePath).toContain('viewport-0.png');
    expect(content).toBeInstanceOf(Buffer);
  });

  it('saves system prompt once', async () => {
    const writer = new LLMInputWriter();
    const inputs = [
      createTestInput(0),
      createTestInput(1),
      createTestInput(2),
    ];

    await writer.saveAll(inputs, 'test-session');

    // Find system prompt write calls
    const systemPromptCalls = mockWriteFile.mock.calls.filter((call) =>
      (call[0] as string).includes('system-prompt.txt')
    );

    // System prompt should be saved only once
    expect(systemPromptCalls).toHaveLength(1);
    expect(systemPromptCalls[0]![1]).toBe('You are a CRO expert.');
  });

  it('saves user prompt per viewport', async () => {
    const writer = new LLMInputWriter();
    const inputs = [
      createTestInput(0),
      createTestInput(1),
    ];

    await writer.saveAll(inputs, 'test-session');

    // Find user prompt write calls
    const userPromptCalls = mockWriteFile.mock.calls.filter((call) => {
      const filePath = call[0] as string;
      return filePath.includes('-prompt.txt') && !filePath.includes('system-prompt');
    });

    expect(userPromptCalls).toHaveLength(2);

    // Check viewport-0 prompt
    const viewport0Call = userPromptCalls.find((call) =>
      (call[0] as string).includes('viewport-0-prompt.txt')
    );
    expect(viewport0Call).toBeDefined();
    expect(viewport0Call![1]).toContain('viewport 0');

    // Check viewport-1 prompt
    const viewport1Call = userPromptCalls.find((call) =>
      (call[0] as string).includes('viewport-1-prompt.txt')
    );
    expect(viewport1Call).toBeDefined();
    expect(viewport1Call![1]).toContain('viewport 1');
  });

  it('handles multiple viewports', async () => {
    const writer = new LLMInputWriter();
    const inputs = [
      createTestInput(0),
      createTestInput(1),
      createTestInput(2),
    ];

    const result = await writer.saveAll(inputs, 'multi-viewport-session');

    expect(result.success).toBe(true);
    // 1 system prompt + 3 DOM snapshots + 3 screenshots + 3 user prompts = 10 files
    expect(result.filesWritten).toBe(10);
    expect(result.errors).toHaveLength(0);
  });

  it('returns success with file count', async () => {
    const writer = new LLMInputWriter({ outputDir: './custom-dir' });
    const inputs = [createTestInput(0)];
    const timestamp = '2026-02-03T10-30-00';

    const result = await writer.saveAll(inputs, timestamp);

    expect(result.success).toBe(true);
    expect(result.outputDir).toContain('custom-dir');
    expect(result.outputDir).toContain(timestamp);
    // 1 system prompt + 1 DOM snapshot + 1 screenshot + 1 user prompt = 4 files
    expect(result.filesWritten).toBe(4);
    expect(result.errors).toHaveLength(0);
  });

  it('handles write errors gracefully', async () => {
    const writer = new LLMInputWriter();
    const inputs = [createTestInput(0)];

    // Mock DOM snapshot write failure
    mockWriteFile.mockImplementation(async (filePath) => {
      if ((filePath as string).includes('viewport-0.json')) {
        throw new Error('Disk full');
      }
    });

    const result = await writer.saveAll(inputs, 'error-session');

    // Should report partial success
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('DOM snapshot'))).toBe(true);
    // Other files should still be counted
    expect(result.filesWritten).toBeGreaterThan(0);
  });

  describe('factory function', () => {
    it('creates writer with default config', () => {
      const writer = createLLMInputWriter();
      const config = writer.getConfig();

      expect(config.outputDir).toBe(DEFAULT_LLM_INPUT_CONFIG.outputDir);
    });

    it('creates writer with custom config', () => {
      const writer = createLLMInputWriter({ outputDir: './custom-llm-inputs' });
      const config = writer.getConfig();

      expect(config.outputDir).toBe('./custom-llm-inputs');
    });
  });

  describe('edge cases', () => {
    it('handles empty inputs array', async () => {
      const writer = new LLMInputWriter();
      const result = await writer.saveAll([], 'empty-session');

      expect(result.success).toBe(true);
      expect(result.filesWritten).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('handles screenshot with data URL prefix', async () => {
      const writer = new LLMInputWriter();
      const inputs = [
        createTestInput(0, {
          screenshotBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        }),
      ];

      await writer.saveAll(inputs, 'data-url-session');

      // Should strip the data URL prefix and still save as buffer
      const screenshotCall = mockWriteFile.mock.calls.find((call) =>
        (call[0] as string).includes('viewport-0.png')
      );

      expect(screenshotCall).toBeDefined();
      expect(screenshotCall![1]).toBeInstanceOf(Buffer);
    });

    it('handles directory creation failure', async () => {
      mockMkdir.mockRejectedValueOnce(new Error('Permission denied'));

      const writer = new LLMInputWriter();
      const inputs = [createTestInput(0)];

      const result = await writer.saveAll(inputs, 'fail-session');

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes('directory structure'))).toBe(true);
    });
  });
});
