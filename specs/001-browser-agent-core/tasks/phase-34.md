# Tasks: Phase 34 — Navigation-Aware Agent Loop

**Input**: `spec/requirements-phase34.md`, `plan/phase-34.md`
**Total**: 18 tasks (T779-T796)
**Tests**: 4 test files, ~18 tests

---

## Phase 34A: Resilient Perceiver (5 tasks)

**Goal**: Make `perceivePage()` crash-proof during page navigation
**Independent Test**: Perceiver never throws on mid-navigation pages

- [x] T779 [P] Add `safeGetContent(page, retries, delayMs)` helper in `src/agent/agent-loop/perceiver.ts` — retry `page.content()` up to 2 times with 1s delay, return empty string on exhaustion
- [x] T780 [P] Wrap `page.url()` in try/catch in `src/agent/agent-loop/perceiver.ts` — return `'about:blank'` on failure
- [x] T781 Replace bare `page.content()` call with `safeGetContent()` in `src/agent/agent-loop/perceiver.ts` (depends T779)
- [x] T782 Set `domHash` to `'navigation-pending'` when content is empty in `src/agent/agent-loop/perceiver.ts` (depends T781)
- [x] T783 Create `tests/unit/agent-loop/perceiver-navigation.test.ts` — 5 tests: first-try success, retry success, all retries fail, url failure, degraded domHash (depends T779-T782)

**Checkpoint**: Perceiver never crashes on navigation — returns degraded state instead

---

## Phase 34B: Post-Action Navigation Settlement (6 tasks)

**Goal**: Detect navigation after actions and settle before re-perceiving
**Independent Test**: Agent loop waits for navigation before perceiving post-action state

- [x] T784 Add `NavigationMeta` interface (`navigated`, `previousUrl`, `currentUrl`) to `src/agent/agent-loop/types.ts`
- [x] T785 Capture pre/post URL in `ToolExecutor.execute()` in `src/agent/tools/tool-executor.ts`, call `page.waitForLoadState('load', { timeout: 10000 })` on URL change, return `NavigationMeta` (depends T784)
- [x] T786 Move `SETTLE_MS` delay in `src/agent/agent-loop/agent-loop.ts` from bottom of loop to after action execution, before post-action `perceivePage()` call
- [x] T787 Add navigation-aware settle in `src/agent/agent-loop/agent-loop.ts` — if `navigated: true` skip extra settle (executor already waited), if `false` apply 500ms settle (depends T785, T786)
- [x] T788 Add retry logic in `src/agent/agent-loop/agent-loop.ts` — if perceiver returns `domHash === 'navigation-pending'`, wait 2s and retry perceive once (depends T782, T787)
- [x] T789 Create `tests/unit/agent-loop/agent-loop-settle.test.ts` — 5 tests: settle before re-perceive, URL change settle, no-change settle, navigation-pending retry, detection failure fallback (depends T784-T788)

**Checkpoint**: Agent loop survives navigation-triggering actions without RUNNER_ERROR

---

## Phase 34C: Navigation-Aware Tools (5 tasks)

**Goal**: `press_key` and `click` handle navigation they trigger
**Independent Test**: Enter keypress and link clicks wait for navigation to complete

- [x] T790 [P] Add `waitForPossibleNavigation(page, previousUrl, timeoutMs)` shared helper in `src/agent/tools/cro/tool-utils.ts` — compares URLs, waits for load state if changed, returns `{ navigated: boolean }`
- [x] T791 Update `press_key` tool in `src/agent/tools/cro/press-key-tool.ts` — capture URL before press, call `waitForPossibleNavigation()` after pressing Enter (depends T790)
- [x] T792 Update `click` tool `ClickParamsSchema` in `src/agent/tools/cro/click-tool.ts` — change `waitForNavigation` to accept `boolean | 'auto'`, default `'auto'` (depends T790)
- [x] T793 Implement auto-detect navigation in `click` tool in `src/agent/tools/cro/click-tool.ts` — capture URL before click, check after, wait if changed; preserve existing `true`/`false` behavior (depends T792)
- [x] T794 Create `tests/unit/tools/navigation-tools.test.ts` — 5 tests: Enter navigation wait, non-Enter skip, click auto-detect URL change, click auto-detect no change, click explicit override (depends T790-T793)

**Checkpoint**: Tools that trigger navigation wait for page load before returning

---

## Phase 34D: Integration Test + Exports (2 tasks)

**Goal**: Verify full navigation flow and update barrel exports

- [x] T795 Create `tests/integration/agent-navigation.test.ts` — mock two-page flow (search form → results page), verify agent types → presses Enter → page navigates → perceiver recovers → agent continues without RUNNER_ERROR (depends T783, T789, T794)
- [x] T796 Update barrel exports in `src/agent/agent-loop/index.ts` and `src/agent/tools/cro/index.ts` if any new exports added (depends T790, T784)

**Checkpoint**: Full navigation scenario passes end-to-end

---

## Dependencies & Execution Order

```
T779, T780 (parallel) → T781 → T782 → T783
T784 → T785 → T786 → T787 → T788 → T789
T790 (parallel with 34A) → T791, T792 → T793 → T794
T783, T789, T794 → T795, T796
```

- **34A** and **34C** can start in parallel (different files)
- **34B** depends on 34A (T782 navigation-pending signal)
- **34D** depends on all three phases

## Summary

| Phase | Tasks | Count | Files Modified | New Test Files |
|-------|-------|-------|----------------|----------------|
| 34A | T779-T783 | 5 | perceiver.ts | perceiver-navigation.test.ts |
| 34B | T784-T789 | 6 | types.ts, tool-executor.ts, agent-loop.ts | agent-loop-settle.test.ts |
| 34C | T790-T794 | 5 | tool-utils.ts, press-key-tool.ts, click-tool.ts | navigation-tools.test.ts |
| 34D | T795-T796 | 2 | index.ts (×2) | agent-navigation.test.ts |
| **Total** | **T779-T796** | **18** | **7 modified** | **4 new test files (~18 tests)** |
