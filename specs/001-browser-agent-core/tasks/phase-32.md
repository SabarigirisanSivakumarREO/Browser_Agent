# Tasks: Phase 32 — Agent Loop with Plan-Act-Verify

**Spec**: `spec/requirements-phase32.md`
**Plan**: `plan/phase-32.md`
**Total Tasks**: 28 (T710-T737)
**Total Tests**: ~20 (14 unit + 6 integration)

## Phase 32a: Types & Pure Logic Modules

**Goal**: All interfaces + 3 pure-logic modules (no LLM, no browser). Fully unit-testable.

- [x] T710 Create `src/agent/agent-loop/types.ts` — all interfaces: `AgentLoopConfig`, `AgentLoopResult`, `ActionRecord`, `PerceivedState`, `InteractiveElement`, `PlannerOutput`, `VerificationResult`, `FailureType`, `DetectedFailure`, `ResolutionStrategy`, `RoutedFailure`, `BudgetStatus`. Export all as named types. Also export `AgentLoopDeps` interface: `{ llm: ChatOpenAI, page: Page, toolExecutor: ToolExecutor }`.

- [x] T711 Create `src/agent/agent-loop/json-utils.ts` — `extractJSON(text: string): Record<string, unknown> | null`. Strip markdown fences (`\`\`\`json...\`\`\``), find first `{` to last `}`, `JSON.parse`, return null on failure. Export named.

- [x] T712 Create `src/agent/agent-loop/failure-router.ts`:
  - `routeFailure(failure: DetectedFailure): RoutedFailure`
  - `detectFailure(toolName: string, result: ToolResult, domHashBefore: string, domHashAfter: string): DetectedFailure | null`
  - `READ_ONLY_TOOLS` const: `['extract_text', 'get_ax_tree', 'capture_viewport', 'get_screenshot']`
  - Detection logic: if `!result.success` + error contains "not found" → `ELEMENT_NOT_FOUND`. If DOM hash unchanged + tool NOT in READ_ONLY_TOOLS + result.success → `ACTION_HAD_NO_EFFECT`.
  - Routing logic: ELEMENT_NOT_FOUND + retries < 3 → REPLAN. ELEMENT_NOT_FOUND + retries >= 3 → TERMINATE. ACTION_HAD_NO_EFFECT → REPLAN_WITH_DIAGNOSTIC. BUDGET_EXCEEDED → TERMINATE.

- [x] T713 Create `src/agent/agent-loop/budget-controller.ts`:
  - `BudgetController` class: constructor(maxSteps: number, maxTimeMs: number)
  - `recordStep()`: increment step count
  - `getStatus()`: return `BudgetStatus` with steps used/remaining, time elapsed/remaining
  - `isExceeded()`: return true if steps >= maxSteps OR elapsed >= maxTimeMs
  - `get stepsUsed()`: getter
  - Uses `Date.now()` for time tracking (startTime set in constructor)

- [x] T714 Create `src/agent/agent-loop/confidence-decay.ts`:
  - `ConfidenceDecay` class: constructor(decayFactor = 0.05, escalationThreshold = 0.3)
  - `get current()`: return current confidence value
  - `decay()`: subtract decayFactor, clamp to 0
  - `shouldEscalate()`: return current < escalationThreshold
  - `reset()`: set back to 1.0 (after successful goal verification)

### 32a Tests

- [x] T715 [P] Create `tests/unit/agent-loop/json-utils.test.ts` — 3 tests:
  1. Extracts JSON from clean string
  2. Extracts JSON wrapped in markdown fences
  3. Returns null for invalid input

- [x] T716 [P] Create `tests/unit/agent-loop/failure-router.test.ts` — 4 tests:
  1. ELEMENT_NOT_FOUND + retries < 3 → REPLAN
  2. ELEMENT_NOT_FOUND + retries >= 3 → TERMINATE
  3. ACTION_HAD_NO_EFFECT → REPLAN_WITH_DIAGNOSTIC
  4. detectFailure: DOM unchanged on mutating tool → ACTION_HAD_NO_EFFECT

- [x] T717 [P] Create `tests/unit/agent-loop/budget-controller.test.ts` — 3 tests:
  1. Not exceeded initially
  2. Exceeded after maxSteps reached
  3. getStatus returns correct remaining counts

- [x] T718 [P] Create `tests/unit/agent-loop/confidence-decay.test.ts` — 4 tests:
  1. Starts at 1.0
  2. Decays by factor each step
  3. Signals escalation below threshold
  4. Never drops below 0, reset restores to 1.0

- [x] T719 Run `npm run typecheck && npx vitest run tests/unit/agent-loop/` — verify all 14 tests pass
- [x] T720 Commit: `feat(phase-32): add types, failure router, budget controller, confidence decay`

**Checkpoint**: All pure logic modules tested. 14 unit tests. No LLM/browser code yet.

---

## Phase 32b: Perceiver

**Goal**: Lightweight page state extraction for the planner.

- [x] T721 Create `src/agent/agent-loop/perceiver.ts`:
  - `perceivePage(page: Page): Promise<PerceivedState>`
  - Implementation:
    1. `url = page.url()`, `title = await page.title()`
    2. DOM hash: `createHash('sha256').update(await page.content()).digest('hex').slice(0, 16)` (import from `crypto`)
    3. AX tree: `await captureAccessibilityTree(page, { maxTokens: 2000 })` from `../../browser/ax-tree-serializer.js`. Truncate to 8000 chars if longer.
    4. Interactive elements: `page.evaluate(() => { ... })` — script finds all visible `a, button, input, select, textarea, [role="button"], [role="link"], [contenteditable]` elements, returns top 20 with: index (order in DOM), tagName, innerText (truncated 50 chars), role attribute, type attribute.
    5. Blocker detection: regex test on AX tree for `accept\s*cookies?|cookie\s*consent|accept\s*all|sign\s*in\s*to\s*continue|captcha|recaptcha`. If match → `hasBlocker: true`, `blockerType` from pattern name.
    6. Screenshot fallback: if AX tree null or length < 500, capture `await page.screenshot({ type: 'jpeg', quality: 50 })` → base64.
  - Export: `perceivePage`, `computeDomHash`

- [x] T722 [P] Create `tests/unit/agent-loop/perceiver.test.ts` — 3 tests:
  1. Returns URL, title, domHash from mock page
  2. Detects cookie blocker from AX tree text
  3. Auto-includes screenshot when AX tree is short

- [x] T723 Run `npx vitest run tests/unit/agent-loop/perceiver.test.ts` — verify 3 pass
- [x] T724 Commit: `feat(phase-32): add perceiver module for page state extraction`

**Checkpoint**: Perceiver works. 17 unit tests cumulative.

---

## Phase 32c: Planner & Verifier

**Goal**: LLM-based single-action planning and goal verification.

- [x] T725 Create `src/agent/agent-loop/planner.ts`:
  - `planNextAction(llm, goal, state, recentActions, failureContext, budgetStatus, confidence): Promise<PlannerOutput>`
  - Build system prompt (embedded constant) with: identity, rules (one action, no repeats, dismiss blockers first, scroll if not visible), available tools list (15 interaction + perception tools from Phase 31), 3 few-shot examples.
  - Build user message from template with: goal, URL, title, AX tree, interactive elements, last 5 actions, failure context, budget remaining, confidence.
  - Call `llm.invoke([systemMessage, userMessage])`.
  - Parse response via `extractJSON()`. Validate has `toolName`, `toolParams`.
  - On parse failure: return fallback `{ reasoning: 'Parse failed, gathering info', toolName: 'extract_text', toolParams: {}, expectedOutcome: 'Get page text for next plan' }`.
  - Available tools for planner (NOT CRO analysis tools): `type_text`, `press_key`, `select_option`, `extract_text`, `hover`, `go_back`, `wait_for`, `dismiss_blocker`, `switch_tab`, `upload_file`, `execute_js`, `drag_and_drop`, `get_ax_tree`, `click`, `scroll_page`, `go_to_url`.
  - Export: `planNextAction`, `PLANNER_SYSTEM_PROMPT` (for testing)

- [x] T726 Create `src/agent/agent-loop/verifier.ts`:
  - `verifyGoal(llm, goal, state, actionHistory): Promise<VerificationResult>`
  - Build system prompt (embedded constant): check observable state only (URL, visible text, element presence), do not assume success from actions, return JSON `{ goalSatisfied, confidence, reasoning }`.
  - Build user message: goal, current URL+title, AX tree, action summary.
  - Call `llm.invoke(...)`, parse JSON.
  - On parse failure: return `{ goalSatisfied: false, confidence: 0, reasoning: 'Verification parse failed' }`.
  - `shouldVerify(step, everyN, preState, postState): boolean` — helper: true if `step % everyN === 0` OR `preState.url !== postState.url`.
  - Export: `verifyGoal`, `shouldVerify`, `VERIFIER_SYSTEM_PROMPT`

- [x] T727 Commit: `feat(phase-32): add planner and verifier with LLM integration`

**Checkpoint**: Planner + verifier implemented. Tested via integration tests in 32f.

---

## Phase 32d: Agent Loop Orchestrator

**Goal**: The main perceive→plan→act→verify loop.

- [x] T728 Create `src/agent/agent-loop/agent-loop.ts`:
  - `runAgentLoop(config: AgentLoopConfig, deps: AgentLoopDeps): Promise<AgentLoopResult>`
  - Full loop as described in plan pseudocode:
    1. Budget check → terminate if exceeded
    2. Confidence check → terminate if below threshold
    3. Perceive page → `perceivePage(deps.page)`
    4. Handle blockers → dismiss_blocker + continue (re-perceive)
    5. Plan → `planNextAction(deps.llm, ...)`
    6. Act → `deps.toolExecutor.execute(plan.toolName, plan.toolParams, context)`
    7. Re-perceive → get post-action state
    8. Record action in history
    9. Detect failure → `detectFailure(...)` + `routeFailure(...)`
    10. If TERMINATE → return result
    11. Verify goal → `verifyGoal(...)` every N steps or after URL change
    12. If SUCCESS → return result
    13. Update budget + confidence
    14. Log progress if verbose
    15. Wait 500ms for page settle
  - Top-level try/catch → RUNNER_ERROR on unexpected exception
  - Build `ExecutionContext` for tool executor: `{ page: deps.page, state: buildMinimalPageState(perceivedState), verbose: config.verbose }`
  - `buildMinimalPageState(perceived)`: Convert `PerceivedState` to `PageState` shape that `ToolExecutor.execute()` expects (URL, title, domTree stub, viewport, scrollPosition, timestamp)

- [x] T729 Create `src/agent/agent-loop/index.ts` — barrel export: `runAgentLoop`, all types, `perceivePage`, `planNextAction`, `verifyGoal`, `routeFailure`, `detectFailure`, `BudgetController`, `ConfidenceDecay`, `extractJSON`.

- [x] T730 Run `npm run typecheck` — verify PASS
- [x] T731 Commit: `feat(phase-32): add agent loop orchestrator`

**Checkpoint**: Full loop implemented and compiles.

---

## Phase 32e: CLI Integration

**Goal**: `--agent-mode` flag wires everything together.

- [x] T732 Add CLI flags in `src/cli.ts`:
  - `--agent-mode <goal>` — string, mutually exclusive with `--vision`
  - `--max-steps <n>` — number, default 20
  - `--max-time <ms>` — number, default 120000
  - `--start-url <url>` — string, override first positional URL
  - Parse in existing arg parser section
  - When `agentMode` is set: skip CRO analysis, instead:
    1. Launch browser via `BrowserManager`
    2. Get page via `browserManager.getPage()`
    3. Create `ToolRegistry` via `createCRORegistry()`
    4. Create `ToolExecutor(registry)`
    5. Create `ChatOpenAI` with `MODEL_DEFAULTS.analysis`
    6. Call `runAgentLoop(config, { llm, page, toolExecutor })`
    7. Print result summary
    8. Close browser

- [x] T733 Add step-by-step progress output when `--verbose`:
  ```
  [Step 1] plan: type_text({ elementIndex: 3, text: "TypeScript" })
           reason: "Search input visible, typing query"
           result: ✓ (150ms)
           confidence: 0.95
  ```
  And final summary:
  ```
  ═══ Agent Loop Complete ═══
  Status: SUCCESS
  Steps: 4/20 | Time: 12.3s | Confidence: 0.80
  Goal: "Search Wikipedia for TypeScript"
  Final URL: https://en.wikipedia.org/wiki/TypeScript
  ═══════════════════════════
  ```

- [x] T734 Commit: `feat(phase-32): add --agent-mode CLI with verbose output`

**Checkpoint**: CLI wired. Agent loop runnable from command line.

---

## Phase 32f: Integration Tests & Regression

**Goal**: End-to-end tests + zero regressions.

- [x] T735 [P] Create `tests/integration/agent-loop.test.ts` — 3 integration tests (mocked LLM, real ToolExecutor):
  1. **Simple navigation**: mock LLM returns `go_to_url` then `done`-equivalent (verifier returns goalSatisfied), assert result.status === 'SUCCESS'
  2. **Budget exceeded**: config maxSteps=2, mock LLM returns 3 non-terminal actions, assert result.status === 'BUDGET_EXCEEDED'
  3. **Failure routing**: mock tool returns error "not found", assert failure detected and included in next planner call context

  Mock pattern: `vi.mock('@langchain/openai')` with ChatOpenAI.invoke returning canned JSON responses. Use real ToolExecutor with mock Page object.

- [x] T736 Run `npm test` — verify ALL 1327+ existing tests + ~20 new tests pass. Zero regressions.

- [x] T737 Update `specs/001-browser-agent-core/quickstart.md`:
  - Add Phase 32 to status section
  - Document `--agent-mode` usage
  - Update architecture description with agent loop module
  - Commit: `docs(phase-32): update quickstart with agent loop status`

**Checkpoint**: Phase 32 complete. All tests pass.

---

## Dependencies & Execution Order

- **32a** (T710-T720): No dependencies — start immediately
- **32b** (T721-T724): Depends on 32a types
- **32c** (T725-T727): Depends on 32a types, can parallel with 32b
- **32d** (T728-T731): Depends on 32a + 32b + 32c
- **32e** (T732-T734): Depends on 32d
- **32f** (T735-T737): Depends on 32d + 32e

## Session Plan

- **Session 1**: 32a (T710-T720) — 11 tasks, 14 unit tests
- **Session 2**: 32b + 32c (T721-T727) — 7 tasks, 3 unit tests
- **Session 3**: 32d + 32e + 32f (T728-T737) — 10 tasks, 3 integration tests
