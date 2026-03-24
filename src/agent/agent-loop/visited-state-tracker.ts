/**
 * Visited-State Tracker
 *
 * Phase 33a: Tracks URLs visited during the agent loop to prevent
 * circular navigation (redirect loops).
 */

/**
 * Normalize a URL for comparison: strip fragment, trailing slash, lowercase hostname.
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    let normalized = parsed.toString();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized.toLowerCase();
  } catch {
    // Invalid URL — return as-is lowercased
    return url.toLowerCase().replace(/#.*$/, '').replace(/\/$/, '');
  }
}

/**
 * Tracks page visits during an agent loop run.
 * Detects redirect loops and provides visit history for planner context.
 */
export class VisitedStateTracker {
  private readonly visits = new Map<string, number>();
  private readonly history: string[] = [];

  /** Record a page visit */
  recordVisit(url: string): void {
    const normalized = normalizeUrl(url);
    this.visits.set(normalized, (this.visits.get(normalized) ?? 0) + 1);
    this.history.push(normalized);
  }

  /** Get visit count for a URL */
  getVisitCount(url: string): number {
    return this.visits.get(normalizeUrl(url)) ?? 0;
  }

  /** Check if URL has been visited */
  hasVisited(url: string): boolean {
    return this.getVisitCount(url) > 0;
  }

  /** Get ordered visit history */
  getHistory(): string[] {
    return [...this.history];
  }

  /** Check if a URL has been visited enough times to indicate a loop */
  isLooping(url: string, threshold = 3): boolean {
    return this.getVisitCount(url) >= threshold;
  }

  /** Format visited URLs for inclusion in planner prompt */
  formatForPrompt(): string {
    if (this.visits.size === 0) return 'none';
    return Array.from(this.visits.entries())
      .map(([url, count]) => `${url} (${count}x)`)
      .join(', ');
  }
}
