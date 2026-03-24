import { describe, it, expect } from 'vitest';
import { VisitedStateTracker, normalizeUrl } from '../../../src/agent/agent-loop/visited-state-tracker.js';

describe('normalizeUrl', () => {
  it('strips fragments and trailing slashes', () => {
    expect(normalizeUrl('https://Example.COM/page/#section')).toBe('https://example.com/page');
    expect(normalizeUrl('https://example.com/page/')).toBe('https://example.com/page');
  });
});

describe('VisitedStateTracker', () => {
  it('records visits and returns correct counts', () => {
    const tracker = new VisitedStateTracker();
    tracker.recordVisit('https://example.com/page1');
    tracker.recordVisit('https://example.com/page2');
    tracker.recordVisit('https://example.com/page1');

    expect(tracker.getVisitCount('https://example.com/page1')).toBe(2);
    expect(tracker.getVisitCount('https://example.com/page2')).toBe(1);
    expect(tracker.hasVisited('https://example.com/page1')).toBe(true);
    expect(tracker.hasVisited('https://example.com/page3')).toBe(false);
    expect(tracker.getHistory()).toHaveLength(3);
  });

  it('detects redirect loop at threshold', () => {
    const tracker = new VisitedStateTracker();
    tracker.recordVisit('https://example.com/loop');
    tracker.recordVisit('https://example.com/other');
    tracker.recordVisit('https://example.com/loop');
    expect(tracker.isLooping('https://example.com/loop')).toBe(false); // 2 < 3
    tracker.recordVisit('https://example.com/loop');
    expect(tracker.isLooping('https://example.com/loop')).toBe(true); // 3 >= 3
  });

  it('formats visited URLs for planner prompt', () => {
    const tracker = new VisitedStateTracker();
    expect(tracker.formatForPrompt()).toBe('none');
    tracker.recordVisit('https://example.com/a');
    tracker.recordVisit('https://example.com/a');
    const formatted = tracker.formatForPrompt();
    expect(formatted).toContain('(2x)');
  });
});
