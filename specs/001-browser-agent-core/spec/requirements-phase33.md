# Phase 33: Agent Loop Reliability — AgentQ-Inspired Enhancements

**Date**: 2026-03-25
**Status**: Draft (revised after critical analysis)
**Depends on**: Phase 32 (agent loop with plan-act-verify)

## Problem

The Phase 32 agent loop uses greedy single-action planning. It succeeded
on a 3-step Wikipedia search but has unproven reliability on 10-25 step
tasks (e-commerce flows, multi-page forms, complex navigation).

Before adding expensive LLM techniques, we must:
1. Build concrete failing test cases that demonstrate the problem
2. Apply zero-cost improvements (better failure detection, element
   pre-validation, sub-goal decomposition)
3. Only then layer on LLM-based enhancements where gaps remain

## Phased Approach

```
33a: Zero-cost reliability (no extra LLM calls)
  ↓
33b: Sub-goal decomposition (1 LLM call upfront, not per-step)
  ↓
33c: Self-critique (1 extra LLM call/step, opt-in)
  ↓
33d: Multi-candidate generation (opt-in, only if 33a-c insufficient)
```

Each sub-phase is independently valuable. Stop early if reliability
targets are met.

---

## Phase 33a: Zero-Cost Reliability Improvements

**Goal**: Fix the most common failure modes with zero extra LLM calls.

### 33a-1: Element Pre-Validation

Before executing any action that targets an element, verify the element
exists and is interactable via a Playwright check (~5ms).

```typescript
async function preValidateElement(
  page: Page,
  toolName: string,
  toolParams: Record<string, unknown>,
  state: PerceivedState
): Promise<{ valid: boolean; error?: string }>
```

- Check: does the target element exist in DOM and have non-zero bounding box?
- If invalid: skip execution, return failure immediately (saves 10s timeout)
- Only applies to element-targeting tools (click, type_text, select_option,
  hover, drag_and_drop)
- Uses xpath from the PerceivedState interactive elements

**Impact**: Prevents the most common failure type (ELEMENT_NOT_FOUND)
and eliminates the 10-second Playwright timeout on missing elements.

### 33a-2: Enhanced Failure Detection

Expand the deterministic failure router to catch more failure types
without LLM calls:

| New failure type | Detection | Strategy |
|-----------------|-----------|----------|
| `WRONG_PAGE` | URL changed to login/error/404 page | REPLAN |
| `FORM_ERROR` | AX tree contains "error", "invalid", "required" near changed elements | REPLAN_WITH_DIAGNOSTIC |
| `REDIRECT_LOOP` | Same URL visited 3+ times in action history | TERMINATE |
| `PAGE_CRASHED` | page.url() throws or returns about:blank unexpectedly | TERMINATE |

```typescript
// Expanded failure detection
function detectFailure(
  toolName: string,
  result: ToolResult,
  domHashBefore: string,
  domHashAfter: string,
  preState: PerceivedState,
  postState: PerceivedState,
  actionHistory: ActionRecord[]
): DetectedFailure | null
```

### 33a-3: Visited-State Tracking

Prevent navigating in circles — the most common failure pattern on
multi-page tasks.

```typescript
interface VisitedStateTracker {
  recordVisit(url: string, domHash: string): void;
  getVisitCount(url: string): number;
  hasVisited(url: string): boolean;
  getHistory(): string[];  // ordered URL list for planner context
}
```

- Track URLs visited + visit count
- Include visited URLs in planner prompt: "VISITED PAGES: url1 (2x),
  url2 (1x)" so the LLM avoids revisiting
- Trigger `REDIRECT_LOOP` failure if same URL visited 3+ times

### 33a-4: Expanded Action History in Planner

Currently the planner sees last 5 actions. Expand context:

- Last 5 actions (unchanged)
- Visited URLs with visit counts (new, from tracker)
- Failed tool+element combinations (new): "click(elementIndex:3) failed
  2x — avoid this element"

Zero extra LLM calls — just richer prompt context.

### 33a Tests

- `element-pre-validator.test.ts` — 4 tests (valid element, missing
  element, non-interactive element, non-element tools skipped)
- `failure-router.test.ts` — 4 new tests (wrong page, form error,
  redirect loop, page crashed) added to existing file
- `visited-state-tracker.test.ts` — 3 tests (record/query, visit count,
  redirect loop detection)

---

## Phase 33b: Sub-Goal Decomposition

**Goal**: For complex tasks (10+ steps), decompose the goal into
sequential sub-goals with ONE upfront LLM call.

### Sub-Goal Planner

```typescript
interface SubGoal {
  description: string;
  successCriteria: string;  // observable condition to check
  estimatedSteps: number;
}

function decomposeGoal(
  llm: ChatOpenAI,
  goal: string,
  startUrl: string
): Promise<SubGoal[]>
```

**Prompt**:
```
Break this goal into 3-7 sequential sub-goals. Each sub-goal should
be achievable in 2-5 browser actions. Include observable success
criteria for each (URL contains X, element Y is visible, text Z appears).

GOAL: {goal}
START URL: {startUrl}
```

**Integration with agent loop**:
- Called ONCE before the main loop starts
- The loop pursues sub-goals sequentially
- After each action, check if current sub-goal's success criteria are
  met (lightweight string/URL check, no LLM call)
- When sub-goal met, advance to next
- If stuck on a sub-goal for 5+ steps, skip it and try next
- Planner prompt includes: "CURRENT SUB-GOAL: {description}
  (sub-goal 2 of 5)"

**Cost**: 1 extra LLM call total (not per step). Negligible.

**When to decompose**: Only when `goal.length > 50` or goal contains
multiple verbs (heuristic for complex tasks). Simple goals like
"go to wikipedia" skip decomposition.

### 33b Tests

- `sub-goal-planner.test.ts` — 4 tests (decomposition, success criteria
  check, sub-goal advancement, skip on stuck)

---

## Phase 33c: Self-Critique

**Goal**: LLM evaluates each action's usefulness after execution.
Opt-in via `--self-critique` (Constitution VI: cost-increasing = opt-in).

### Self-Critic

```typescript
interface CritiqueResult {
  actionWasUseful: boolean;
  progressScore: number;      // 0-1
  reasoning: string;
  suggestion?: string;
}

function critiqueAction(
  llm: ChatOpenAI,
  goal: string,
  currentSubGoal: SubGoal | null,
  action: ActionRecord,
  preState: PerceivedState,
  postState: PerceivedState,
  recentCritiques: CritiqueResult[]
): Promise<CritiqueResult>
```

**Key improvement over original spec**: The critic evaluates against
the CURRENT SUB-GOAL (specific, observable) not the high-level goal
(vague). This dramatically improves accuracy.

**DOM-diff-aware evaluation**: The critic prompt includes concrete
state changes, not just URL/title:
```
STATE CHANGES:
  URL: {preUrl} → {postUrl}
  Title: {preTitle} → {postTitle}
  DOM hash: {changed/unchanged}
  New elements: {elements appearing in postState but not preState}
  Removed elements: {elements in preState but not postState}
  Interactive element count: {pre} → {post}
```

This fixes the critical flaw in the original spec where the critic
couldn't detect form fills (typing text doesn't change URL/title).

**Dynamic confidence**: `adjustFromCritique(progressScore)` **replaces**
`decay()` on steps where critique runs. Never both on same step.

```typescript
adjustFromCritique(progressScore: number): void {
  if (progressScore > 0.6) {
    this.value = Math.max(0, this.value - this.decayFactor * 0.5);
  } else if (progressScore < 0.3) {
    this.value = Math.max(0, this.value - this.decayFactor * 2);
  } else {
    this.value = Math.max(0, this.value - this.decayFactor);
  }
}
```

**Critique history**: Last `CRITIQUE_HISTORY_SIZE` (default: 3,
config constant) critiques included in planner context.

**Skip logic**: Skip critique when (a) deterministic router fired,
(b) goal verifier runs this step, or (c) `enableCritique` is false.

**Fallback**: LLM error → `{ actionWasUseful: true, progressScore: 0.5,
reasoning: 'Critique unavailable' }`.

**Cost**: +1 LLM call/step when enabled (~1.5x total).

### 33c Tests

- `self-critic.test.ts` — 4 tests (useful action, useless action,
  confidence adjustment, DOM-diff detection)
- `agent-loop-critique.test.ts` — 2 integration tests (critique
  improves replanning, skip logic works)

---

## Phase 33d: Multi-Candidate Generation

**Goal**: Generate 2-3 candidate actions and self-rank them. Only
implement if 33a-c leave measurable gaps on target tasks.

**Key change from original spec**: No separate scorer module. The
generator self-ranks candidates. The critical analysis showed that
asking the same model to score its own outputs from a different
prompt persona produces correlated rankings (estimated rho > 0.85),
making a separate scorer a wasted LLM call.

### Candidate Generator

```typescript
interface ActionCandidate extends PlannerOutput {
  selfScore: number;
  risk: string;
}

function generateCandidates(
  llm: ChatOpenAI,
  goal: string,
  currentSubGoal: SubGoal | null,
  state: PerceivedState,
  recentActions: ActionRecord[],
  failureContext: RoutedFailure | null,
  budgetStatus: BudgetStatus,
  confidence: number,
  critiqueHistory: CritiqueResult[],
  visitedUrls: string[]
): Promise<ActionCandidate[]>
```

**Prompt**: Ask for 2-3 candidates with self-assessed scores AND
risk assessment in a single call:
```
Propose 2-3 candidate actions. For each, rate confidence 0-1 and
identify what could go wrong. Each candidate MUST use a different
approach or target a different element.
```

**Deduplication**: If two candidates have same `toolName` +
same target `elementIndex`, keep only the higher-scored one.

**Relationship to `planNextAction`**: Retained as fallback. Generator
failure → call `planNextAction`, wrap as single candidate with
`selfScore: 0.5`.

**Cost**: Same as current planner (1 LLM call) — the prompt just
asks for multiple outputs. Scoring is built into generation, no
separate call.

**CLI**: `--multi-candidate` enables this (opt-in). `--candidates <n>`
sets count (default: 3, max: 5).

### 33d Tests

- `candidate-generator.test.ts` — 4 tests (multi-candidate parse,
  deduplication, fallback, diversity)
- `agent-loop-candidates.test.ts` — 2 integration tests

---

## Config & CLI

```typescript
interface AgentLoopConfig {
  // ... existing Phase 32 fields
  enableSubGoals?: boolean;       // default: true (zero extra cost per step)
  enableCritique?: boolean;       // default: false (opt-in, +1 LLM call/step)
  enableMultiCandidate?: boolean; // default: false (opt-in)
  candidateCount?: number;        // default: 3 (when multi-candidate enabled)
}
```

**CLI flags:**
```
--no-sub-goals          Disable sub-goal decomposition (default: on)
--self-critique         Enable post-action LLM critique (opt-in)
--multi-candidate       Enable multi-candidate generation (opt-in)
--candidates <n>        Candidates per step (default: 3, max: 5)
```

**Constitution VI compliance**: Sub-goal decomposition defaults ON
(1 LLM call total, negligible cost). Self-critique and multi-candidate
are opt-in (they increase per-step cost).

**Time budget**: When `--self-critique` enabled, automatically increase
`maxTimeMs` by 50% to account for extra LLM latency. Configurable
via `--max-time` override.

---

## File Structure

### New Files

```
src/agent/agent-loop/
├── element-pre-validator.ts     ~60 lines   (33a)
├── visited-state-tracker.ts     ~50 lines   (33a)
├── sub-goal-planner.ts          ~120 lines  (33b)
├── self-critic.ts               ~100 lines  (33c)
├── candidate-generator.ts       ~130 lines  (33d)
```

### Modified Files

```
├── agent-loop.ts            ~50 lines changed (all phases)
├── failure-router.ts        ~40 lines added (33a)
├── types.ts                 ~60 lines added (all phases)
├── confidence-decay.ts      ~15 lines added (33c)
├── planner.ts               ~10 lines changed (33a: richer context)
├── index.ts                 ~10 lines added (barrel exports)
```

### New Test Files

```
tests/unit/agent-loop/
├── element-pre-validator.test.ts      4 tests  (33a)
├── visited-state-tracker.test.ts      3 tests  (33a)
├── sub-goal-planner.test.ts           4 tests  (33b)
├── self-critic.test.ts                4 tests  (33c)
├── candidate-generator.test.ts        4 tests  (33d)

tests/integration/
├── agent-loop-critique.test.ts        2 tests  (33c)
├── agent-loop-candidates.test.ts      2 tests  (33d)
```

**Totals**: ~510 new lines, ~185 modified lines, 27 new tests.
All files under 500-line constitution limit.

---

## Prerequisite: Build Failing Test Cases

**Before implementing any sub-phase**, create a concrete test scenario
that demonstrates greedy planning failure:

1. **10-step e-commerce flow**: Navigate to product page → select size →
   add to cart → go to cart → verify item. Use a real or mock e-commerce
   site.
2. **Multi-page form**: Fill form across 3 pages with validation errors
   that require correction.
3. **Search + deep navigation**: Search → click result → navigate 3
   levels deep → extract specific info.

Run each with the Phase 32 greedy agent. Document which tasks fail
and why. This evidence drives which sub-phases are actually needed.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Phased approach | 33a→b→c→d | Stop early if targets met. Cheapest fixes first. |
| No separate scorer | Dropped | Same model + same info = correlated scores (estimated rho > 0.85). Generator self-ranking is sufficient. |
| Sub-goals before multi-candidate | Yes | 1 upfront LLM call > N per-step calls for planning horizon problems. |
| Element pre-validation | Playwright check | 5ms vs 10s timeout. Prevents #1 failure type at zero LLM cost. |
| Sub-goals default ON | Yes | 1 LLM call total, negligible cost. Constitution VI allows this. |
| Critique evaluates sub-goals | Yes | Specific observable criteria > vague high-level goal. Much more accurate. |
| DOM-diff in critic prompt | Yes | Fixes blind spot: form fills change DOM but not URL/title. |
| Time budget adjustment | Auto +50% when critique enabled | Prevents false timeouts from extra LLM latency. |
| Build failing tests first | Required | No speculative engineering. Evidence drives implementation. |

---

## Success Criteria

- Concrete failing test cases documented before implementation begins
- 33a alone reduces ELEMENT_NOT_FOUND failures by >80% (pre-validation)
- 33a alone eliminates redirect loop failures (visited-state tracking)
- 33b enables completion of 10-step tasks that fail without sub-goals
- 33c correctly identifies useless actions in >80% of cases (when enabled)
- All 1370 existing tests pass (zero regressions)
- Default behavior (no new flags) runs 33a+33b improvements automatically
- Phase 32 behavior exactly preserved with `--no-sub-goals`
