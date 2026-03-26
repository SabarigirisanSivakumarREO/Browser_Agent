/**
 * Phase 34A Tests — Resilient Perceiver Navigation Handling
 *
 * T783: Tests for safeGetContent retry logic and degraded state.
 */

import { describe, it, expect, vi } from 'vitest';
import { perceivePage, computeDomHash, NAVIGATION_PENDING_HASH } from '../../../src/agent/agent-loop/perceiver.js';

vi.mock('../../../src/browser/ax-tree-serializer.js', () => ({
  captureAccessibilityTree: vi.fn().mockResolvedValue('button "OK" role=button\n'.repeat(50)),
}));

function createMockPage(overrides: {
  url?: string | (() => string);
  title?: string;
  content?: string | (() => Promise<string>);
  waitForLoadState?: () => Promise<void>;
} = {}): unknown {
  const {
    url = 'https://example.com',
    title = 'Example',
    content = '<html><body>Hello</body></html>',
    waitForLoadState = () => Promise.resolve(),
  } = overrides;

  return {
    url: typeof url === 'function' ? url : () => url,
    title: () => Promise.resolve(title),
    content: typeof content === 'function' ? content : () => Promise.resolve(content),
    waitForLoadState: vi.fn().mockImplementation(waitForLoadState),
    evaluate: vi.fn().mockResolvedValue([]),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake')),
  };
}

describe('perceivePage — navigation resilience (Phase 34A)', () => {
  it('succeeds on first try when page.content() works', async () => {
    const page = createMockPage({ content: '<html>ok</html>' });
    const state = await perceivePage(page as never);
    expect(state.domHash).toBe(computeDomHash('<html>ok</html>'));
    expect(state.domHash).not.toBe(NAVIGATION_PENDING_HASH);
  });

  it('retries and succeeds when page.content() fails once then succeeds', async () => {
    let callCount = 0;
    const contentFn = (): Promise<string> => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error('navigating'));
      return Promise.resolve('<html>retry-ok</html>');
    };
    const page = createMockPage({ content: contentFn });
    const state = await perceivePage(page as never);
    expect(state.domHash).toBe(computeDomHash('<html>retry-ok</html>'));
  });

  it('returns navigation-pending hash when all retries fail', async () => {
    const contentFn = (): Promise<string> => Promise.reject(new Error('navigating'));
    const page = createMockPage({ content: contentFn });
    const state = await perceivePage(page as never);
    expect(state.domHash).toBe(NAVIGATION_PENDING_HASH);
  });

  it('returns about:blank when page.url() throws', async () => {
    const urlFn = (): string => { throw new Error('crashed'); };
    const page = createMockPage({ url: urlFn });
    const state = await perceivePage(page as never);
    expect(state.url).toBe('about:blank');
  });

  it('NAVIGATION_PENDING_HASH is the expected sentinel value', () => {
    expect(NAVIGATION_PENDING_HASH).toBe('navigation-pending');
  });
});
