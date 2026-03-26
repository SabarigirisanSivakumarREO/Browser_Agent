# Implementation Plan: Phase 34 — Navigation-Aware Agent Loop

**Branch**: `main` (SPECIFY_FEATURE=001-browser-agent-core)
**Date**: 2026-03-25
**Spec**: `spec/requirements-phase34.md`
**Estimated Tasks**: 18

## Summary

Fix the agent loop's inability to handle page navigation after actions. The perceiver crashes on `page.content()` when a page is mid-navigation, and there is no settle delay between action execution and re-perception. This phase adds resilient content capture, centralized navigation detection in the tool executor, and navigation-aware behavior in `press_key` and `click` tools.

## Technical Context

**Language/Version**: TypeScript 5.x strict mode
**Primary Dependencies**: Playwright (page navigation APIs), Vitest (testing)
**Testing**: Vitest — unit tests for each changed module, integration test for full navigation flow
**Target**: Node.js 20+ LTS

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | ✅ | All changes within 500-line limit, focused modules |
| II. TypeScript Strict | ✅ | No new `any` types, Zod params unchanged |
| III. Perception Layer | ✅ | Perceiver made resilient, not changing data flow |
| IV. Error Handling | ✅ CORE | This phase directly improves error resilience |
| V. LLM Integration | ✅ | No LLM changes |
| VI. Cost & Performance | ✅ | Navigation settle adds <2s only when navigation detected |
| VII. Modular Architecture | ✅ | Changes in existing modules, no new modules |
| VIII. Testing Discipline | ✅ | Tests for all changes |
| IX. Security | ✅ | No security changes |
| X. Production Readiness | ✅ | Fixes a production crash |

## Architecture

### Change Map

```
src/agent/agent-loop/
├── perceiver.ts          # MODIFY — retry page.content(), guard page.url()
├── agent-loop.ts         # MODIFY — add post-action settle before re-perceive
├── types.ts              # MODIFY — add NavigationResult to PerceptionState
src/agent/tools/
├── tool-executor.ts      # MODIFY — pre/post URL capture, navigation detection
├── cro/
│   ├── press-key-tool.ts # MODIFY — waitForLoadState after Enter
│   ├── click-tool.ts     # MODIFY — auto-detect navigation, change default
│   └── tool-utils.ts     # MODIFY — add shared waitForNavigation helper
tests/
├── unit/
│   ├── agent-loop/
│   │   ├── perceiver-navigation.test.ts  # NEW — perceiver retry tests
│   │   └── agent-loop-settle.test.ts     # NEW — settle logic tests
│   └── tools/
│       └── navigation-tools.test.ts      # NEW — press_key/click navigation tests
└── integration/
    └── agent-navigation.test.ts          # NEW — full navigation flow test
```

### No New Files (code)

All implementation changes are in existing files. Only new test files are created.

One new shared utility function added to existing `tool-utils.ts`.

## Implementation Phases

### Phase 34A: Resilient Perceiver (FR-001, FR-006) — 5 tasks

**Goal**: Make `perceivePage()` crash-proof during navigation.

**Changes to `perceiver.ts`**:

1. Wrap `page.url()` (line 49) in try/catch — return `'about:blank'` on failure
2. Replace bare `page.content()` (line 58) with retry helper:
   ```typescript
   async function safeGetContent(page: Page, retries = 2, delayMs = 1000): Promise<string> {
     for (let i = 0; i <= retries; i++) {
       try {
         await page.waitForLoadState('load', { timeout: 3000 });
         return await page.content();
       } catch {
         if (i === retries) return '';  // degraded state
         await new Promise(r => setTimeout(r, delayMs));
       }
     }
     return '';
   }
   ```
3. When content is empty (degraded), set `domHash` to `'navigation-pending'` to signal the agent loop

**Tests**: `perceiver-navigation.test.ts` — 5 tests:
- page.content() succeeds on first try
- page.content() fails once, succeeds on retry
- page.content() fails all retries → returns empty content
- page.url() failure → returns 'about:blank'
- Degraded state has domHash = 'navigation-pending'

### Phase 34B: Post-Action Navigation Settlement (FR-002, FR-005) — 6 tasks

**Goal**: Detect navigation after any action and wait for the page to settle before re-perceiving.

**Changes to `tool-executor.ts`**:

1. Capture `page.url()` before `tool.execute()` call
2. After execution, capture `page.url()` again
3. If URL changed, call `page.waitForLoadState('load', { timeout: 10000 })` in try/catch
4. Return navigation metadata: `{ navigated: boolean, previousUrl: string, currentUrl: string }`
5. Add `navigationMeta` to `ToolExecutionResult` type

**Changes to `agent-loop.ts`**:

1. Move the `SETTLE_MS` delay from bottom of loop (line 486) to AFTER action execution, BEFORE `perceivePage()` (line 351)
2. If `toolExecutor.execute()` returns `navigated: true`, use longer settle (already handled by executor's waitForLoadState)
3. If `navigated: false`, apply minimal 500ms settle for DOM re-renders
4. If perceiver returns `domHash === 'navigation-pending'`, retry perceive once after 2s

**Changes to `types.ts`**:
1. Add `navigated?: boolean` to `ActionResult` or create `NavigationMeta` interface

**Tests**: `agent-loop-settle.test.ts` — 5 tests:
- Settle delay happens before re-perceive, not after
- URL change detected → longer settle applied
- No URL change → 500ms settle
- perceiver returns 'navigation-pending' → retry after 2s
- Navigation detection failure → graceful fallback

### Phase 34C: Navigation-Aware Tools (FR-003, FR-004) — 5 tasks

**Goal**: Make `press_key` and `click` handle navigation they trigger.

**Shared utility in `tool-utils.ts`**:
```typescript
export async function waitForPossibleNavigation(
  page: Page,
  previousUrl: string,
  timeoutMs = 10000
): Promise<{ navigated: boolean }> {
  try {
    const currentUrl = page.url();
    if (currentUrl !== previousUrl) {
      await page.waitForLoadState('load', { timeout: timeoutMs });
      return { navigated: true };
    }
  } catch { /* timeout is fine */ }
  return { navigated: false };
}
```

**Changes to `press-key-tool.ts`**:
1. Capture `page.url()` before `keyboard.press()`
2. After pressing Enter (or any key), call `waitForPossibleNavigation(page, prevUrl)` with 5s timeout
3. Return `navigated` flag in extracted result

**Changes to `click-tool.ts`**:
1. Change `waitForNavigation` param default from `false` to `'auto'` (new option)
2. When `'auto'`: capture URL before click, check after click, wait if changed
3. When `true`: existing Promise.race behavior (explicit wait)
4. When `false`: no wait (existing behavior)
5. Update `ClickParamsSchema` to accept `boolean | 'auto'`, default `'auto'`

**Tests**: `navigation-tools.test.ts` — 5 tests:
- press_key Enter triggers navigation wait
- press_key non-Enter keys skip navigation wait
- click auto-detect: URL changes → waits for load
- click auto-detect: URL unchanged → no wait
- click explicit true/false overrides auto-detect

### Phase 34D: Integration Test + Barrel Exports (FR all) — 2 tasks

**Goal**: Verify the full navigation flow end-to-end and update exports.

**Integration test** `agent-navigation.test.ts`:
- Mock a two-page flow: page1 has a search form, page2 is results
- Agent types query → presses Enter → page navigates → perceiver recovers → agent continues
- Verify no RUNNER_ERROR, agent reaches page2, extracts content

**Barrel exports**: Update `src/agent/tools/cro/index.ts` and `src/agent/agent-loop/index.ts` if any new exports added.

## Dependencies & Execution Order

```
Phase 34A (perceiver) ──┐
                         ├──▶ Phase 34D (integration test)
Phase 34B (settle + executor) ──┤
                         │
Phase 34C (tools) ───────┘
```

- 34A and 34C can run in parallel (different files)
- 34B depends on 34A (uses perceiver's degraded state signal)
- 34D depends on all three (integration test spans all changes)

## Complexity Tracking

No constitution violations. All changes are within existing modules with focused responsibilities.

## Risks

| Risk | Mitigation |
|------|------------|
| waitForLoadState adds latency to every step | Only applied when URL changes; 500ms for non-navigation |
| SPA pushState doesn't fire load event | Shared utility also uses URL comparison as signal |
| Playwright deprecated page.waitForNavigation | We use waitForLoadState instead, which is current API |
| click tool param change (auto) could break LLM planning | Backward compatible — boolean values still work, auto is new default |
