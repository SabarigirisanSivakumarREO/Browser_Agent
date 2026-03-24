/**
 * Confidence Decay
 *
 * Phase 32 (T714): Linear confidence decay that terminates the agent
 * loop when the agent is clearly lost (confidence below threshold).
 */

/**
 * Tracks a confidence score that decays linearly each step.
 * Signals escalation (termination) when confidence drops below threshold.
 */
export class ConfidenceDecay {
  private readonly decayFactor: number;
  private readonly escalationThreshold: number;
  private value: number;

  constructor(decayFactor = 0.05, escalationThreshold = 0.3) {
    this.decayFactor = decayFactor;
    this.escalationThreshold = escalationThreshold;
    this.value = 1.0;
  }

  /** Current confidence value (0–1) */
  get current(): number {
    return this.value;
  }

  /** Apply one step of decay */
  decay(): void {
    this.value = Math.max(0, this.value - this.decayFactor);
  }

  /** True if confidence has dropped below the escalation threshold */
  shouldEscalate(): boolean {
    return this.value < this.escalationThreshold;
  }

  /**
   * Adjust confidence based on critic's progress score.
   * REPLACES decay() on steps where critique runs — never call both.
   * Phase 33c.
   */
  adjustFromCritique(progressScore: number): void {
    if (progressScore > 0.6) {
      // Good progress — decay at half rate
      this.value = Math.max(0, this.value - this.decayFactor * 0.5);
    } else if (progressScore < 0.3) {
      // Poor progress — decay at double rate
      this.value = Math.max(0, this.value - this.decayFactor * 2);
    } else {
      // Normal decay
      this.value = Math.max(0, this.value - this.decayFactor);
    }
  }

  /** Reset confidence to 1.0 (e.g. after successful goal verification) */
  reset(): void {
    this.value = 1.0;
  }
}
