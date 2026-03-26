/**
 * Phase 34C Tests — Navigation-Aware Tools
 *
 * T794: Tests for press_key and click navigation handling.
 */

import { describe, it, expect, vi } from 'vitest';
import { waitForPossibleNavigation } from '../../../src/agent/tools/cro/tool-utils.js';

function createMockPage(opts: {
  urlSequence?: string[];
  waitForLoadState?: () => Promise<void>;
} = {}): { url: () => string; waitForLoadState: ReturnType<typeof vi.fn> } {
  const { urlSequence = ['https://page1.com'], waitForLoadState = () => Promise.resolve() } = opts;
  let callCount = 0;
  return {
    url: () => urlSequence[Math.min(callCount++, urlSequence.length - 1)]!,
    waitForLoadState: vi.fn().mockImplementation(waitForLoadState),
  };
}

describe('waitForPossibleNavigation (Phase 34C)', () => {
  it('detects navigation when URL changes and waits for load', async () => {
    const page = createMockPage({ urlSequence: ['https://page2.com'] });
    const result = await waitForPossibleNavigation(page as never, 'https://page1.com', 5000);
    expect(result.navigated).toBe(true);
    expect(page.waitForLoadState).toHaveBeenCalledWith('load', { timeout: 5000 });
  });

  it('returns no navigation when URL is unchanged', async () => {
    const page = createMockPage({ urlSequence: ['https://page1.com'] });
    const result = await waitForPossibleNavigation(page as never, 'https://page1.com', 5000);
    expect(result.navigated).toBe(false);
  });

  it('handles waitForLoadState timeout gracefully', async () => {
    const page = createMockPage({
      urlSequence: ['https://page2.com'],
      waitForLoadState: () => Promise.reject(new Error('timeout')),
    });
    const result = await waitForPossibleNavigation(page as never, 'https://page1.com', 1000);
    expect(result.navigated).toBe(true); // still detects navigation even on timeout
  });
});

describe('press_key navigation handling (Phase 34C)', () => {
  it('press_key Enter triggers navigation wait', async () => {
    // Import the tool
    const { pressKeyTool } = await import('../../../src/agent/tools/cro/press-key-tool.js');

    const page = {
      url: vi.fn()
        .mockReturnValueOnce('https://search.com')  // before press
        .mockReturnValueOnce('https://search.com/results'),  // after press
      keyboard: { press: vi.fn().mockResolvedValue(undefined) },
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
    };

    const context = {
      params: { key: 'Enter' },
      page,
      state: {} as never,
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };

    const result = await pressKeyTool.execute(context as never);

    expect(result.success).toBe(true);
    expect((result.extracted as { navigated: boolean }).navigated).toBe(true);
    expect(page.waitForLoadState).toHaveBeenCalled();
  });

  it('press_key Tab does not trigger navigation wait', async () => {
    const { pressKeyTool } = await import('../../../src/agent/tools/cro/press-key-tool.js');

    const page = {
      url: vi.fn().mockReturnValue('https://example.com'),
      keyboard: { press: vi.fn().mockResolvedValue(undefined) },
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
    };

    const context = {
      params: { key: 'Tab' },
      page,
      state: {} as never,
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };

    const result = await pressKeyTool.execute(context as never);

    expect(result.success).toBe(true);
    expect((result.extracted as { navigated: boolean }).navigated).toBe(false);
    expect(page.waitForLoadState).not.toHaveBeenCalled();
  });
});
