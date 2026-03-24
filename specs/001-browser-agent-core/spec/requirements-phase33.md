# AgentQ-Inspired Agent Loop Enhancements

**Date**: 2026-03-24
**Status**: Approved design
**Depends on**: Phase 32 (agent loop with plan-act-verify)

## Problem

The Phase 32 agent loop uses greedy single-action planning: one LLM call produces one action per step. This works for simple 3-5 step tasks but degrades on 10-25 step tasks (e-commerce flows, multi-page form fills, complex navigation) because:

- Bad actions aren't prevented, only detected after execution
- The fixed linear confidence decay doesn't distinguish useful from useless actions
- Failure recovery relies on deterministic heuristics that miss subtle failures (e.g., click succeeded but opened wrong thing)
- The planner repeats unproductive patterns without within-run learning

## Solution

Incorporate three AgentQ-inspired techniques into the existing agent loop:

1. **Multi-candidate planning** — Generate 2-3 diverse candidate actions per step instead of 1
2. **LLM action scoring** — A separate critic LLM call ranks candidates before execution
3. **Post-execution self-critique** — LLM evaluates whether the executed action was useful, feeding back into the next step

No persistent trajectory storage or model fine-tuning in this phase. Learning is within-run only via critique history.

## Architecture

### Modified Loop Flow

```
while (budget not exceeded):
  1. BUDGET CHECK          — unchanged
  2. CONFIDENCE CHECK      — unchanged (decay rate now dynamic)
  3. PERCEIVE              — unchanged
  4. HANDLE BLOCKERS       — unchanged

  5. GENERATE CANDIDATES   — NEW: 2-3 candidates from LLM
  6. SCORE CANDIDATES      — NEW: separate LLM ranks them (skip if only 1)
  7. ACT                   — execute top-scored candidate
  8. RE-PERCEIVE           — unchanged
  9. RECORD                — unchanged, plus new optional fields on ActionRecord:
                              candidateScore?: number (final combined score)
                              candidateRank?: number (1=best, position among candidates)
                              critiqueResult?: CritiqueResult (post-execution evaluation)

  10. DETERMINISTIC ROUTER — unchanged (fast-path hard failures)
  11. SELF-CRITIQUE        — NEW: LLM evaluates outcome (skip if router fired or verifier runs)
  12. ADJUST CONFIDENCE    — NEW: dynamic decay from critic progressScore
  13. UPDATE CRITIQUE HISTORY — NEW: sliding window of last 3 critiques

  14. VERIFY GOAL          — unchanged
  15. UPDATE BUDGET        — unchanged
  16. SETTLE               — unchanged
```

### LLM Calls Per Step

| Step type | Calls | When |
|-----------|-------|------|
| Normal | 3 | generate + score + critique |
| Verification | 3 | generate + score + verify (skip critique) |
| Degraded (1 candidate) | 2 | generate + critique (skip scorer) |
| Hard failure | 1 | generate only, router handles rest |
| **Average** | **~2.5** | **2-3x current cost** |

## Components

### Candidate Generator (`candidate-generator.ts`, ~120 lines)

Replaces the single-action planner. Same inputs plus critique history.

**Interface:**
```typescript
// Extends PlannerOutput — a candidate is a plan + self-assessed score
interface ActionCandidate extends PlannerOutput {
  selfScore: number;  // 0-1, LLM's own confidence
}

// Conversion for fallback: wrap PlannerOutput as candidate
function plannerOutputToCandidate(plan: PlannerOutput): ActionCandidate {
  return { ...plan, selfScore: 0.5 };
}

function generateCandidates(
  llm: ChatOpenAI,
  goal: string,
  state: PerceivedState,
  recentActions: ActionRecord[],
  failureContext: RoutedFailure | null,
  budgetStatus: BudgetStatus,
  confidence: number,
  critiqueHistory: CritiqueResult[]
): Promise<ActionCandidate[]>
```

**Prompt additions** (vs current planner):
- Asks for 2-3 candidates instead of 1
- Includes critique history (last 3) so generator avoids flagged patterns
- Enforces diversity: "each candidate should use a DIFFERENT approach or target a DIFFERENT element"
- Each candidate includes a self-assessed confidence score

**Relationship to `planNextAction`**: The existing `planNextAction` function is **retained** as the fallback. When candidate generation fails entirely (LLM error, unparseable response), the loop calls `planNextAction` to get a single action, wraps it as `ActionCandidate` with `selfScore: 0.5`, and proceeds.

**Candidate count behavior**:
- If LLM returns fewer candidates than `candidateCount` (e.g., requests 3, parses 2), proceed with however many were parsed.
- If only 1 candidate parsed, skip the scorer (saves 1 LLM call).
- If 2+ candidates parsed, scorer always runs.
- If 0 candidates parsed, fall back to `planNextAction`.

### Action Scorer (`action-scorer.ts`, ~100 lines)

Independent critic that re-ranks candidates. The generator's self-scores are biased; the scorer provides an outside perspective.

**Interface:**
```typescript
interface ScoredCandidate {
  candidate: ActionCandidate;
  score: number;        // 0-1, scorer's evaluation
  risk: string;         // what could go wrong
  reversibility: string; // can we undo this if it fails?
}

function scoreCandidates(
  llm: ChatOpenAI,
  goal: string,
  candidates: ActionCandidate[],
  state: PerceivedState,
  recentActions: ActionRecord[],
  critiqueHistory: CritiqueResult[]
): Promise<ScoredCandidate[]>  // sorted best-first
```

**Scoring criteria** (in prompt):
- Does this action directly advance the goal, or is it a detour?
- Has a similar action already failed? (check recent actions)
- Is the target element likely to exist and be interactable?
- What's the risk if this action fails?

**Score combination**: `finalScore = 0.4 * selfScore + 0.6 * scorerScore`. Scorer weighted higher (less biased).

**Skip optimization**: If only 1 candidate, skip scorer entirely (saves 1 LLM call).

**Fallback on LLM error**: If scorer LLM call fails, return candidates sorted by generator's `selfScore` (original order). Log warning but don't block execution.

### Self-Critic (`self-critic.ts`, ~90 lines)

Post-execution evaluation. Catches subtle failures that deterministic detection misses.

**Interface:**
```typescript
interface CritiqueResult {
  actionWasUseful: boolean;
  progressScore: number;      // 0-1
  reasoning: string;
  suggestion?: string;        // what to try next if not useful
}

function critiqueAction(
  llm: ChatOpenAI,
  goal: string,
  action: ActionRecord,
  preState: PerceivedState,
  postState: PerceivedState,
  recentCritiques: CritiqueResult[]
): Promise<CritiqueResult>
```

**Evaluates**: Before/after page state (URL, title, AX tree), whether the observable change advances the goal.

**Feeds back into loop via:**
1. **Dynamic confidence** — `adjustFromCritique(progressScore)` **replaces** the normal `decay()` call on steps where critique runs. On steps where critique is skipped (hard failure, verification step), normal `decay()` is called instead. This prevents double-decay.
2. **Critique history** — Last `CRITIQUE_HISTORY_SIZE` (default: 3, configurable constant) critiques passed to generator and scorer so they avoid repeating unproductive patterns.

**Coexists with deterministic router**: Router handles hard failures (element not found, budget exceeded) instantly. Critic handles soft failures. Router runs first; critic only runs if router found no failure.

**Skip optimization**: Skip on steps where goal verifier runs (verification already evaluates progress).

**Fallback on LLM error**: If critique LLM call fails, return `{ actionWasUseful: true, progressScore: 0.5, reasoning: 'Critique unavailable' }` — neutral score, normal decay.

### Modified Confidence Decay

Add `adjustFromCritique(progressScore: number)` method to `ConfidenceDecay` class. This **replaces** `decay()` for the current step — they are never both called on the same step.

```typescript
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
```

## Config & CLI

**New config fields:**
```typescript
interface AgentLoopConfig {
  // ... existing
  candidateCount?: number;     // default: 3
  enableScoring?: boolean;     // default: false (opt-in via --action-scoring)
  enableCritique?: boolean;    // default: false (opt-in via --self-critique)
}
```

**CLI flags:**
```
--action-scoring        Enable multi-candidate scoring (opt-in per Constitution VI)
--self-critique         Enable post-action critique (opt-in per Constitution VI)
--candidates <n>        Number of candidates per step (default: 3, max: 5)
```

**Constitution VI compliance**: Both features are **opt-in** because they increase LLM cost 2-3x per step. The `--agent-mode` flag activates the base loop; `--action-scoring` and `--self-critique` layer on the AgentQ enhancements. Users can enable both with `--action-scoring --self-critique` or individually.

## File Structure

**New files (3):**
```
src/agent/agent-loop/
├── candidate-generator.ts   ~120 lines
├── action-scorer.ts         ~100 lines
├── self-critic.ts           ~90 lines
```

**Modified files (4):**
```
├── agent-loop.ts            ~30 lines changed
├── types.ts                 ~40 lines added
├── confidence-decay.ts      ~15 lines added
├── index.ts                 ~5 lines added
```

**New test files (4):**
```
tests/unit/agent-loop/
├── candidate-generator.test.ts   4 tests
├── action-scorer.test.ts         3 tests
├── self-critic.test.ts           4 tests

tests/integration/
├── agent-loop-scoring.test.ts    3 tests
```

**Totals**: ~310 new lines, ~90 modified lines, 14 new tests. All files under 500-line limit.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM-only scoring vs browser branching | LLM-only | Browser state save/restore is fragile (cookies, sessions, side effects). LLM scoring gets 80% of benefit at 20% complexity. |
| Persistent trajectory learning | Deferred | Keeps scope tight. Within-run learning via critique history is sufficient for this phase. Trajectory store is a natural next phase. |
| Target task complexity | 10-25 steps | Sweet spot where multi-candidate planning pays off. 5-step tasks work with greedy; 25+ needs hierarchical planning (future). |
| Cost budget | 2-3x current | ~2.5 LLM calls/step average. gpt-4o-mini keeps absolute cost low. |
| Scoring vs planning separation | Separate LLM calls | Generator's self-scores are biased. Independent scorer reduces overconfidence. |
| Critique vs verification | Coexist | Critique runs per-step for subtle failures. Verification runs every N steps for goal completion. Skip critique when verifier runs. |

## Success Criteria

- Agent completes a 10-step e-commerce browse+cart task that fails with greedy planning
- Multi-candidate scoring prevents >50% of "action had no effect" failures vs baseline
- Self-critique correctly identifies useless actions in >80% of cases
- All 1370 existing tests pass (zero regressions)
- Default behavior (no flags) is identical to Phase 32 greedy mode
- `--action-scoring --self-critique` enables full AgentQ enhancements
