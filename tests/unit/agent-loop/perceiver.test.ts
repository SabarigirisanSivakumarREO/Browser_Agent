import { describe, it, expect, vi } from 'vitest';
import { perceivePage, computeDomHash } from '../../../src/agent/agent-loop/perceiver.js';

// Mock ax-tree-serializer
vi.mock('../../../src/browser/ax-tree-serializer.js', () => ({
  captureAccessibilityTree: vi.fn(),
}));

// Mock element-collector (Phase 35A)
vi.mock('../../../src/agent/agent-loop/element-collector.js', () => ({
  collectInteractiveElements: vi.fn().mockResolvedValue({
    elements: [],
    contentRegion: {
      hasMainLandmark: false,
      mainContentLinks: 0,
      mainContentButtons: 0,
      headerElements: 0,
      totalInteractive: 0,
    },
  }),
}));

import { captureAccessibilityTree } from '../../../src/browser/ax-tree-serializer.js';

const mockCaptureAx = vi.mocked(captureAccessibilityTree);

function createMockPage(overrides: {
  url?: string;
  title?: string;
  content?: string;
  axTree?: string | null;
  screenshotBuffer?: Buffer;
} = {}): unknown {
  const {
    url = 'https://example.com',
    title = 'Example',
    content = '<html><body>Hello</body></html>',
    screenshotBuffer = Buffer.from('fake-image'),
  } = overrides;

  return {
    url: () => url,
    title: () => Promise.resolve(title),
    content: () => Promise.resolve(content),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(''),
    screenshot: vi.fn().mockResolvedValue(screenshotBuffer),
  };
}

describe('perceivePage', () => {
  it('returns URL, title, domHash from mock page', async () => {
    const page = createMockPage({
      url: 'https://test.com/page',
      title: 'Test Page',
      content: '<html>test</html>',
    });
    mockCaptureAx.mockResolvedValue('button "Submit" role=button\nlink "Home" role=link\n'.repeat(100));

    const state = await perceivePage(page as never);

    expect(state.url).toBe('https://test.com/page');
    expect(state.title).toBe('Test Page');
    expect(state.domHash).toHaveLength(16);
    expect(state.domHash).toBe(computeDomHash('<html>test</html>'));
    expect(state.axTreeText).toBeTruthy();
  });

  it('detects cookie blocker from AX tree text', async () => {
    const page = createMockPage();
    mockCaptureAx.mockResolvedValue(
      'dialog "Cookie Consent"\nbutton "Accept All Cookies"\nbutton "Reject"\n'.repeat(20)
    );

    const state = await perceivePage(page as never);

    expect(state.hasBlocker).toBe(true);
    expect(state.blockerType).toBe('cookie_consent');
  });

  it('auto-includes screenshot when AX tree is short', async () => {
    const page = createMockPage();
    mockCaptureAx.mockResolvedValue('short');

    const state = await perceivePage(page as never);

    expect(state.screenshotBase64).toBeTruthy();
    expect(state.screenshotBase64).toBe(Buffer.from('fake-image').toString('base64'));
  });

  it('does not include screenshot when AX tree is long enough (non-agent mode)', async () => {
    const page = createMockPage();
    mockCaptureAx.mockResolvedValue('x'.repeat(600));

    const state = await perceivePage(page as never, false);

    expect(state.screenshotBase64).toBeUndefined();
  });

  it('always includes screenshot in agent mode', async () => {
    const page = createMockPage();
    mockCaptureAx.mockResolvedValue('x'.repeat(600));

    const state = await perceivePage(page as never, true);

    expect(state.screenshotBase64).toBeTruthy();
  });

  it('extracts page text in agent mode', async () => {
    const page = createMockPage();
    // Mock evaluate to return page text
    (page as { evaluate: ReturnType<typeof vi.fn> }).evaluate.mockResolvedValue('Product 1 - $99.99\nProduct 2 - $149.99');
    mockCaptureAx.mockResolvedValue('x'.repeat(600));

    const state = await perceivePage(page as never, true);

    expect(state.pageText).toBeTruthy();
  });

  it('includes contentRegion in result', async () => {
    const page = createMockPage();
    mockCaptureAx.mockResolvedValue('x'.repeat(600));

    const state = await perceivePage(page as never);

    expect(state.contentRegion).toBeDefined();
  });
});
