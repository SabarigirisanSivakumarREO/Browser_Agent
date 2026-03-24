# Tasks: Phase 33 — Agent Loop Reliability (AgentQ-Inspired)

**Spec**: `spec/requirements-phase33.md`
**Plan**: `plan/phase-33.md`
**Total Tasks**: 41 (T738-T778)
**Total Tests**: 27 (19 unit + 4 integration + 4 enhanced existing)

## Phase 33a: Zero-Cost Reliability

**Goal**: Fix common failure modes with zero extra LLM calls.

### 33a Types

- [x] T738 Add new types to `src/agent/agent-loop/types.ts`:
  - Expand `FailureType` union: add `'WRONG_PAGE' | 'FORM_ERROR' | 'REDIRECT_LOOP' | 'PAGE_CRASHED'`
  - Add `SubGoal` interface: `{ description: string; successCriteria: string; estimatedSteps: number }`
  - Add `CritiqueResult` interface: `{ actionWasUseful: boolean; progressScore: number; reasoning: string; suggestion?: string }`
  - Add `ActionCandidate` interface extending `PlannerOutput`: `{ selfScore: number; risk: string }`
  - Add to `AgentLoopConfig`: `enableSubGoals?: boolean`, `enableCritique?: boolean`, `enableMultiCandidate?: boolean`, `candidateCount?: number`
  - Add to `ActionRecord`: `candidateScore?: number`, `candidateRank?: number`, `critiqueResult?: CritiqueResult`
  - Add `CRITIQUE_HISTORY_SIZE` const = 3
  - Add `ELEMENT_TARGETING_TOOLS` const = `['click', 'type_text', 'select_option', 'hover', 'drag_and_drop']`

### 33a Element Pre-Validator

- [x] T739 Create `src/agent/agent-loop/element-pre-validator.ts`:
  - `preValidateElement(page: Page, toolName: string, toolParams: Record<string, unknown>, state: PerceivedState): Promise<{ valid: boolean; error?: string }>`
  - If `toolName` not in `ELEMENT_TARGETING_TOOLS`, return `{ valid: true }` (skip)
  - Extract `elementIndex` from `toolParams` (handle both `elementIndex` and `index` keys)
  - Find matching element in `state.interactiveElements` by index
  - If no match: return `{ valid: false, error: 'Element with index N not in perceived state' }`
  - If match: use element's `selector` (xpath) to check `page.locator(\`xpath=${selector}\`).count()` with 1s timeout
  - If count === 0: return `{ valid: false, error: 'Element xpath not found in DOM' }`
  - If count > 0: return `{ valid: true }`
  - Wrap all in try/catch — on error return `{ valid: true }` (don't block execution on validation failure)
  - Export: `preValidateElement`

- [x] T740 [P] Create `tests/unit/agent-loop/element-pre-validator.test.ts` — 4 tests:
  1. Returns valid for non-element tools (scroll_page, press_key)
  2. Returns invalid when element index not in perceived state
  3. Returns invalid when xpath not found in DOM (mock page.locator.count → 0)
  4. Returns valid when element exists (mock page.locator.count → 1)

### 33a Enhanced Failure Detection

- [x] T741 Modify `src/agent/agent-loop/failure-router.ts`:
  - Change `detectFailure` signature to accept `preState`, `postState`, `actionHistory` params
  - Add `WRONG_PAGE` detection: if `postState.url` matches `/login|signin|error|404|403|unauthorized/i` and `preState.url` did not → `WRONG_PAGE`
  - Add `FORM_ERROR` detection: if `postState.axTreeText` contains `/\b(error|invalid|required|failed)\b/i` near changed content and `preState.axTreeText` did not → `FORM_ERROR`
  - Add `REDIRECT_LOOP` detection: count occurrences of `postState.url` in `actionHistory` domain-normalized URLs — if >= 3 → `REDIRECT_LOOP`
  - Add `PAGE_CRASHED` detection: if `postState.url === 'about:blank'` and `preState.url !== 'about:blank'` → `PAGE_CRASHED`
  - Update `routeFailure`: `WRONG_PAGE` → `REPLAN`, `FORM_ERROR` → `REPLAN_WITH_DIAGNOSTIC`, `REDIRECT_LOOP` → `TERMINATE`, `PAGE_CRASHED` → `TERMINATE`
  - Keep existing ELEMENT_NOT_FOUND and ACTION_HAD_NO_EFFECT logic unchanged

- [x] T742 [P] Add 4 tests to `tests/unit/agent-loop/failure-router.test.ts`:
  1. Detects WRONG_PAGE when URL changes to login page
  2. Detects FORM_ERROR when AX tree gains error text
  3. Detects REDIRECT_LOOP when same URL visited 3+ times
  4. Detects PAGE_CRASHED when URL becomes about:blank

### 33a Visited-State Tracker

- [x] T743 Create `src/agent/agent-loop/visited-state-tracker.ts`:
  - `VisitedStateTracker` class:
    - `private visits: Map<string, number>` (normalized URL → count)
    - `private history: string[]` (ordered visit list)
    - `recordVisit(url: string): void` — normalize URL (strip fragment, trailing slash), increment count, append to history
    - `getVisitCount(url: string): number` — return count for normalized URL
    - `hasVisited(url: string): boolean` — return count > 0
    - `getHistory(): string[]` — return history array
    - `isLooping(url: string, threshold?: number): boolean` — return count >= (threshold ?? 3)
    - `formatForPrompt(): string` — return "url1 (2x), url2 (1x)" for planner context
  - Helper: `normalizeUrl(url: string): string` — strip fragment (#...), strip trailing slash, lowercase hostname
  - Export: `VisitedStateTracker`, `normalizeUrl`

- [x] T744 [P] Create `tests/unit/agent-loop/visited-state-tracker.test.ts` — 3 tests:
  1. Records visits and returns correct counts
  2. Normalizes URLs (strips fragments, trailing slashes)
  3. Detects redirect loop at threshold

### 33a Planner Context Enrichment

- [x] T745 Modify `src/agent/agent-loop/planner.ts`:
  - Add `visitedUrls?: string` and `failedCombos?: string` params to `planNextAction`
  - Add to user message template after FAILURE CONTEXT:
    ```
    VISITED PAGES: {visitedUrls or 'none'}
    FAILED COMBINATIONS: {failedCombos or 'none'}
    ```
  - Add helper: `formatFailedCombos(history: ActionRecord[]): string` — extracts failed tool+elementIndex pairs with counts: "click(elementIndex:3) failed 2x, type_text(elementIndex:5) failed 1x"

### 33a Loop Integration

- [x] T746 Modify `src/agent/agent-loop/agent-loop.ts` for 33a:
  - Import `preValidateElement`, `VisitedStateTracker`
  - Create `VisitedStateTracker` instance at loop start
  - After PERCEIVE step: `visitedTracker.recordVisit(preState.url)`
  - Before ACT step: call `preValidateElement(deps.page, plan.toolName, plan.toolParams, preState)`. If invalid: record action as failed, set failure context, skip execution, continue loop
  - Pass `preState`, `postState`, `actionHistory` to expanded `detectFailure` call
  - Pass `visitedTracker.formatForPrompt()` and `formatFailedCombos(actionHistory)` to `planNextAction`

- [x] T747 Run `npm run typecheck` — verify 0 new errors in agent-loop files

### 33a Tests & Commit

- [x] T748 Run `npx vitest run tests/unit/agent-loop/` — verify all tests pass (existing 22 + 11 new = 33)
- [x] T749 Commit: `feat(phase-33a): add element pre-validation, enhanced failure detection, visited-state tracking`

**Checkpoint**: Zero-cost reliability improvements complete. 33 unit tests.

---

## Phase 33b: Sub-Goal Decomposition

**Goal**: Decompose complex goals into sequential sub-goals with 1 upfront LLM call.

- [x] T750 Create `src/agent/agent-loop/sub-goal-planner.ts`:
  - `DECOMPOSE_PROMPT` const with system prompt: "Break this goal into 3-7 sequential sub-goals..."
  - `shouldDecompose(goal: string): boolean` — return true if `goal.length > 50` or goal matches `/\b(and|then|after|next|finally)\b/i` (multiple verbs heuristic)
  - `decomposeGoal(llm: ChatOpenAI, goal: string, startUrl: string): Promise<SubGoal[]>` — call LLM, parse JSON array, validate each has description + successCriteria + estimatedSteps. On parse failure: return single sub-goal wrapping the whole goal.
  - `checkSubGoalCompletion(subGoal: SubGoal, state: PerceivedState): boolean` — check if successCriteria matches current state: URL contains string, title contains string, or element text visible. Simple string matching, no LLM.
  - Export: `decomposeGoal`, `shouldDecompose`, `checkSubGoalCompletion`, `DECOMPOSE_PROMPT`

- [x] T751 [P] Create `tests/unit/agent-loop/sub-goal-planner.test.ts` — 4 tests:
  1. `shouldDecompose` returns true for complex goals, false for simple
  2. `decomposeGoal` parses valid LLM response into SubGoal array
  3. `checkSubGoalCompletion` matches URL-based criteria
  4. `decomposeGoal` returns single fallback sub-goal on parse failure

### 33b Loop Integration

- [x] T752 Modify `src/agent/agent-loop/agent-loop.ts` for 33b:
  - Add config: `enableSubGoals` defaults to `true`
  - Before main loop, if `enableSubGoals && shouldDecompose(config.goal)`:
    - Call `decomposeGoal(deps.llm, config.goal, config.startUrl)`
    - Log sub-goals if verbose
  - Track `currentSubGoalIndex` and `stepsOnCurrentSubGoal` counters
  - After each action: call `checkSubGoalCompletion(currentSubGoal, postState)` — if true, advance to next sub-goal, reset step counter, log progress
  - If `stepsOnCurrentSubGoal >= 5`: skip to next sub-goal (stuck detection)
  - Pass `currentSubGoal.description` to planner in prompt context (add `currentSubGoal?: string` param to `planNextAction`)

- [x] T753 Modify `src/agent/agent-loop/planner.ts`:
  - Add `currentSubGoal?: string` param
  - Add to user message: `CURRENT SUB-GOAL: {subGoal} (sub-goal N of M)` or `CURRENT SUB-GOAL: (none — pursuing full goal directly)`

- [x] T754 Add CLI flags in `src/cli.ts`:
  - `--no-sub-goals` → `enableSubGoals: false`

- [x] T755 Run typecheck + tests: `npm run typecheck && npx vitest run tests/unit/agent-loop/`
- [x] T756 Commit: `feat(phase-33b): add sub-goal decomposition for complex tasks`

**Checkpoint**: Sub-goal decomposition complete. 37 unit tests.

---

## Phase 33c: Self-Critique

**Goal**: LLM evaluates action usefulness post-execution. Opt-in.

- [ ] T757 Create `src/agent/agent-loop/self-critic.ts`:
  - `CRITIC_SYSTEM_PROMPT` const — evaluator prompt checking observable state changes against sub-goal
  - `computeStateDiff(preState: PerceivedState, postState: PerceivedState): string` — format DOM-diff-aware changes: URL change, title change, DOM hash changed/unchanged, new/removed interactive elements, element count change
  - `critiqueAction(llm, goal, currentSubGoal, action, preState, postState, recentCritiques): Promise<CritiqueResult>` — build prompt with state diff, call LLM, parse JSON. On failure: return `{ actionWasUseful: true, progressScore: 0.5, reasoning: 'Critique unavailable' }`
  - `shouldCritique(enableCritique: boolean, routerFired: boolean, verifierWillRun: boolean): boolean` — return `enableCritique && !routerFired && !verifierWillRun`
  - Export: `critiqueAction`, `shouldCritique`, `computeStateDiff`, `CRITIC_SYSTEM_PROMPT`

- [ ] T758 [P] Create `tests/unit/agent-loop/self-critic.test.ts` — 4 tests:
  1. Useful action: progressScore > 0.6 when URL changed toward goal
  2. Useless action: progressScore < 0.3 when DOM unchanged
  3. DOM-diff detection: `computeStateDiff` reports element count change and new elements
  4. Fallback: returns neutral result on LLM parse failure

- [ ] T759 Modify `src/agent/agent-loop/confidence-decay.ts`:
  - Add `adjustFromCritique(progressScore: number): void` method
  - progressScore > 0.6: decay at half rate (`this.decayFactor * 0.5`)
  - progressScore < 0.3: decay at double rate (`this.decayFactor * 2`)
  - Otherwise: normal decay rate
  - Clamp to 0

- [ ] T760 [P] Add 2 tests to `tests/unit/agent-loop/confidence-decay.test.ts`:
  1. `adjustFromCritique` with high progress decays slower than normal
  2. `adjustFromCritique` with low progress decays faster than normal

### 33c Loop Integration

- [ ] T761 Modify `src/agent/agent-loop/agent-loop.ts` for 33c:
  - Import `critiqueAction`, `shouldCritique`
  - Track `critiqueHistory: CritiqueResult[]` (sliding window of CRITIQUE_HISTORY_SIZE)
  - After failure detection (step 10), determine if verifier will run this step
  - If `shouldCritique(config.enableCritique, routerFired, verifierWillRun)`:
    - Call `critiqueAction(...)` with current sub-goal context
    - Append to `critiqueHistory` (trim to CRITIQUE_HISTORY_SIZE)
    - Call `confidence.adjustFromCritique(critique.progressScore)` instead of `confidence.decay()`
    - Store critique in ActionRecord: `record.critiqueResult = critique`
  - Else: call `confidence.decay()` as before
  - Pass `critiqueHistory` to `planNextAction` (add param)
  - When `--self-critique` enabled: auto-increase maxTimeMs by 50%

- [ ] T762 Modify `src/agent/agent-loop/planner.ts`:
  - Add `critiqueHistory?: CritiqueResult[]` param
  - Add to user message:
    ```
    RECENT CRITIQUES:
      Step N: progressScore=0.8, "action was useful because..."
      Step M: progressScore=0.2, suggestion: "try different element"
    ```

- [ ] T763 Add CLI flags in `src/cli.ts`:
  - `--self-critique` → `enableCritique: true`

- [ ] T764 [P] Create `tests/integration/agent-loop-critique.test.ts` — 2 tests:
  1. Critique runs and adjusts confidence (mock LLM returns progressScore, verify confidence adjusted)
  2. Critique skipped when deterministic router fires (verify only 1 LLM call: planner)

- [ ] T765 Run typecheck + full agent-loop tests
- [ ] T766 Commit: `feat(phase-33c): add self-critique with DOM-diff awareness`

**Checkpoint**: Self-critique complete. 43 tests total.

---

## Phase 33d: Multi-Candidate Generation

**Goal**: Generate 2-3 candidates per step with self-ranking. Opt-in.

- [ ] T767 Create `src/agent/agent-loop/candidate-generator.ts`:
  - `CANDIDATE_PROMPT_SUFFIX` const — "Propose 2-3 candidate actions. For each, rate confidence 0-1 and identify risk..."
  - `generateCandidates(llm, goal, currentSubGoal, state, recentActions, failureContext, budgetStatus, confidence, critiqueHistory, visitedUrls): Promise<ActionCandidate[]>`
  - Build prompt: same context as planner + candidate suffix
  - Parse JSON `{ candidates: [...] }` array
  - Validate each has toolName, toolParams, selfScore
  - Deduplication: if two candidates have same toolName + same elementIndex → keep higher selfScore
  - Sort by selfScore descending
  - On failure: fall back to `planNextAction`, wrap result as `ActionCandidate` with `selfScore: 0.5, risk: 'fallback'`
  - Export: `generateCandidates`, `plannerOutputToCandidate`, `deduplicateCandidates`

- [ ] T768 [P] Create `tests/unit/agent-loop/candidate-generator.test.ts` — 4 tests:
  1. Parses multi-candidate JSON response correctly
  2. Deduplicates candidates with same toolName + elementIndex
  3. Falls back to planNextAction on parse failure
  4. Sorts candidates by selfScore descending

### 33d Loop Integration

- [ ] T769 Modify `src/agent/agent-loop/agent-loop.ts` for 33d:
  - If `config.enableMultiCandidate`:
    - Replace `planNextAction` call with `generateCandidates` call
    - Execute top candidate (index 0)
    - Store `candidateScore` and `candidateRank` on ActionRecord
    - Log all candidates if verbose
  - Else: use existing `planNextAction` (unchanged)

- [ ] T770 Add CLI flags in `src/cli.ts`:
  - `--multi-candidate` → `enableMultiCandidate: true`
  - `--candidates <n>` → `candidateCount: n` (default 3, validate 1-5)

- [ ] T771 [P] Create `tests/integration/agent-loop-candidates.test.ts` — 2 tests:
  1. Multi-candidate mode: generates 3 candidates, executes top-scored
  2. Fallback: when generation fails, falls back to single plan

- [ ] T772 Run typecheck + full agent-loop tests
- [ ] T773 Commit: `feat(phase-33d): add multi-candidate generation with self-ranking`

**Checkpoint**: Multi-candidate generation complete. 49 tests total.

---

## Phase 33e: Barrel Exports, Regression & Docs

- [ ] T774 Update `src/agent/agent-loop/index.ts` — add exports for all new modules:
  - `preValidateElement` from element-pre-validator
  - `VisitedStateTracker`, `normalizeUrl` from visited-state-tracker
  - `decomposeGoal`, `shouldDecompose`, `checkSubGoalCompletion` from sub-goal-planner
  - `critiqueAction`, `shouldCritique`, `computeStateDiff` from self-critic
  - `generateCandidates`, `deduplicateCandidates` from candidate-generator
  - All new types: `SubGoal`, `CritiqueResult`, `ActionCandidate`

- [ ] T775 Run `npm test` — verify ALL 1370+ existing tests + ~27 new tests pass. Zero regressions.

- [ ] T776 Update `specs/001-browser-agent-core/quickstart.md`:
  - Add Phase 33 to status section
  - Document new CLI flags: `--no-sub-goals`, `--self-critique`, `--multi-candidate`, `--candidates`
  - Update test count

- [ ] T777 Update `CLAUDE.md`:
  - Add Phase 33 to Current Status
  - Update tool count / module description for agent-loop

- [ ] T778 Commit: `docs(phase-33): update quickstart and CLAUDE.md with Phase 33 status`

**Checkpoint**: Phase 33 complete. All tests pass.

---

## Dependencies & Execution Order

- **33a** (T738-T749): No dependencies — start immediately
- **33b** (T750-T756): Depends on 33a types (T738)
- **33c** (T757-T766): Depends on 33a + 33b types
- **33d** (T767-T773): Depends on 33a + 33b + 33c types
- **33e** (T774-T778): Depends on all above

## Session Plan

- **Session 1**: 33a (T738-T749) — 12 tasks, 11 new tests
- **Session 2**: 33b (T750-T756) — 7 tasks, 4 new tests
- **Session 3**: 33c (T757-T766) — 10 tasks, 8 new tests
- **Session 4**: 33d + 33e (T767-T778) — 12 tasks, 6 new tests + regression
