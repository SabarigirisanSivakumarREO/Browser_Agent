# Requirements: Phase 34 — Navigation-Aware Agent Loop

**Phase**: 34
**Created**: 2026-03-25
**Status**: Draft
**Root Cause**: Agent loop crashes when actions trigger page navigation — `page.content()` throws `Unable to retrieve content because the page is navigating`

## Problem Statement

The agent loop (Phase 32) has no navigation handling between action execution and page state perception. When an action triggers a full page navigation (e.g., pressing Enter on a search form, clicking a link), the perceiver attempts to read page content while the page is mid-navigation, causing an unrecoverable `RUNNER_ERROR`.

**Observed failure**: `--agent-mode "Go to Amazon India, search for best rated mechanical keyboard"` crashes after step 2 (press_key Enter) because the search submission navigates to a results page.

## Functional Requirements

### FR-001: Resilient Page Content Capture
- `perceivePage()` MUST NOT crash when `page.content()` fails during navigation
- `page.content()` MUST be wrapped in try/catch with retry-after-wait (up to 2 retries, 1s between)
- If all retries fail, perceiver MUST return a degraded state (empty content, URL + title only) instead of throwing

### FR-002: Post-Action Navigation Settlement
- After ANY tool execution, the agent loop MUST wait for navigation to settle BEFORE calling `perceivePage()`
- Settlement MUST detect whether the action triggered a URL change
- If URL changed: wait for `page.waitForLoadState('load')` with configurable timeout (default 10s)
- If URL unchanged: apply minimal settle delay (500ms) to handle SPA re-renders
- The existing `SETTLE_MS` delay at the bottom of the loop MUST be moved to before post-action `perceivePage()`

### FR-003: Navigation-Aware Key Press
- `press_key` tool MUST detect navigation-triggering keys (Enter, and any key while a form is focused)
- After pressing Enter, the tool MUST call `page.waitForLoadState('load', { timeout: 10000 })` inside a try/catch
- Timeout on waitForLoadState MUST NOT cause tool failure — it should return success with a `navigated` flag

### FR-004: Navigation-Aware Click
- `click` tool MUST default `waitForNavigation` to auto-detect mode instead of `false`
- Auto-detect: capture URL before click, check URL after click, if changed wait for load state
- Explicit `waitForNavigation: true/false` params MUST still override auto-detect

### FR-005: Tool Executor Navigation Hook
- `ToolExecutor.execute()` MUST capture `page.url()` before tool execution
- After tool execution, MUST compare URL to detect navigation
- MUST expose `{ navigated: boolean, previousUrl: string, currentUrl: string }` in the result metadata
- This provides a centralized navigation detection layer regardless of individual tool implementation

### FR-006: Perceiver Retry with Backoff
- `page.url()` call in perceiver MUST be wrapped in try/catch (currently bare)
- `page.content()` MUST retry up to 2 times with 1s delay between attempts
- `page.screenshot()` already has try/catch (no change needed)
- `page.evaluate()` for interactive elements already has try/catch (no change needed)

## Edge Cases

- SPA navigation via `pushState` / `replaceState` — URL changes but no `load` event fires. Settlement should use `waitForURL` or short delay instead.
- Amazon CAPTCHA / bot detection pages — perceiver should handle unexpected page states gracefully
- Slow-loading pages (>10s) — timeout should not kill the loop, just proceed with partial state
- Multiple rapid navigations (redirects) — settlement should wait for final destination

## Success Criteria

- **SC-001**: Agent completes the Amazon search task (navigate → type → search → extract) without crashing
- **SC-002**: No `RUNNER_ERROR` from navigation-related page.content() failures
- **SC-003**: Agent loop survives any action that triggers page navigation
- **SC-004**: All existing Phase 32/33 tests continue to pass (no regression)
- **SC-005**: Navigation settlement adds <2s overhead per step on non-navigating actions
