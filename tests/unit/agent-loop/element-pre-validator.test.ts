/**
 * Tests for element-pre-validator
 *
 * Phase 33a (T740): Unit tests for preValidateElement function.
 */

import { describe, it, expect, vi } from 'vitest';
import { preValidateElement } from '../../../src/agent/agent-loop/element-pre-validator.js';
import type { PerceivedState } from '../../../src/agent/agent-loop/types.js';
import type { Page } from 'playwright';

const mockState: PerceivedState = {
  url: 'https://example.com',
  title: 'Test',
  domHash: 'abc',
  axTreeText: null,
  interactiveElements: [
    { index: 0, tag: 'button', text: 'Click me', selector: '//*[@id="btn"]' },
    { index: 1, tag: 'input', text: 'Search', selector: '//input[@name="q"]' },
  ],
  hasBlocker: false,
};

describe('preValidateElement', () => {
  it('returns valid for non-element tools without touching page', async () => {
    const mockPage = { locator: vi.fn() } as unknown as Page;

    const result = await preValidateElement(mockPage, 'scroll_page', {}, mockState);

    expect(result).toEqual({ valid: true });
    expect(mockPage.locator).not.toHaveBeenCalled();
  });

  it('returns invalid when element index not in perceived state', async () => {
    const mockPage = {
      locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(1) }),
    } as unknown as Page;

    const result = await preValidateElement(
      mockPage,
      'click',
      { elementIndex: 99 },
      mockState
    );

    expect(result.valid).toBe(false);
    expect(result.error).toContain('not in perceived state');
  });

  it('returns invalid when xpath not found in DOM', async () => {
    const mockPage = {
      locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(0) }),
    } as unknown as Page;

    const result = await preValidateElement(
      mockPage,
      'click',
      { elementIndex: 0 },
      mockState
    );

    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found in DOM');
  });

  it('returns valid when element exists in DOM', async () => {
    const mockPage = {
      locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(1) }),
    } as unknown as Page;

    const result = await preValidateElement(
      mockPage,
      'click',
      { elementIndex: 0 },
      mockState
    );

    expect(result).toEqual({ valid: true });
  });
});
