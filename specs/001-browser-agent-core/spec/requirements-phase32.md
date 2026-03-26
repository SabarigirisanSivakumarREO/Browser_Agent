# Requirements: Phase 32 — Agent Loop with Plan-Act-Verify

**Phase**: 32
**Created**: 2026-03-24
**Status**: Draft
**Depends On**: Phase 31 (13 interaction tools)

## Overview

Add a plan-act-verify agent loop that enables the CRO agent to
autonomously complete multi-step browser tasks. The loop perceives
page state, asks the LLM to plan one action, executes it, verifies
the outcome (DOM change detection, goal checking), and routes failures
to recovery strategies. This transforms the agent from a one-shot
CRO analyzer into a goal-directed browser operator.

The new loop runs as an **alternative mode** (`--agent-mode`) alongside
the existing vision analysis pipeline. The existing CRO analysis
pipeline is NOT modified.

## Architecture Decision

**New module**: `src/agent/agent-loop/` — separate from existing
CRO agent orchestration. The existing `cro-agent.ts` gains a new
code path that delegates to the agent loop when `--agent-mode` is
active.

**Why separate module**: The CRO pipeline (collect→analyze→output) is
fundamentally different from a goal-directed loop
(perceive→plan→act→verify→repeat). Mixing them in `cro-agent.ts`
(already ~2000 lines) would violate the 500-line constitution limit
and create tangled control flow.

## User Stories

### US-32a: Single-Step Planning (P0)

As the agent loop, I need the LLM to observe the current page state
and output exactly ONE next tool action so the agent takes incremental
steps toward the goal.

**Acceptance Scenarios**:

1. **Given** a goal "Search Wikipedia for TypeScript" and the Wikipedia
   homepage, **When** the planner runs, **Then** it outputs
   `{ toolName: "type_text", toolParams: { elementIndex: 3, text: "TypeScript" } }`.
2. **Given** the last 5 actions and a failure context, **When** the
   planner runs, **Then** it avoids repeating the failed approach.
3. **Given** a blocker (cookie banner), **When** the planner runs,
   **Then** it prioritizes `dismiss_blocker` before other actions.

### US-32b: DOM Change Detection (P0)

As the agent loop, I need to detect whether an action actually changed
the page so I can identify `ACTION_HAD_NO_EFFECT` failures.

**Acceptance Scenarios**:

1. **Given** a click action, **When** the DOM hash is identical
   before/after, **Then** `ACTION_HAD_NO_EFFECT` is detected.
2. **Given** a `get_ax_tree` action (read-only), **When** the DOM
   hash is unchanged, **Then** no failure is detected (exempted).

### US-32c: Failure Routing (P0)

As the agent loop, I need a deterministic failure router that maps
failure types to recovery strategies without an LLM call.

**Acceptance Scenarios**:

1. **Given** `ELEMENT_NOT_FOUND` with fallbacks remaining, **Then**
   strategy is `TRY_ALTERNATIVE_REF`.
2. **Given** `ELEMENT_NOT_FOUND` with fallbacks exhausted, **Then**
   strategy is `REPLAN` (ask LLM to try different approach).
3. **Given** `ACTION_HAD_NO_EFFECT`, **Then** strategy is
   `REPLAN_WITH_DIAGNOSTIC` (include diagnostic context).
4. **Given** `BUDGET_EXCEEDED`, **Then** strategy is `TERMINATE`.

### US-32d: Goal Verification (P1)

As the agent loop, I need periodic LLM-based goal checking to know
when the task is complete — without checking every single step
(wasteful).

**Acceptance Scenarios**:

1. **Given** 3 steps have passed, **When** the verifier runs, **Then**
   it returns `{ goalSatisfied, confidence, reasoning }`.
2. **Given** `goalSatisfied: true` with `confidence > 0.7`, **Then**
   the loop terminates with SUCCESS.
3. **Given** a significant page change (URL changed), **When** the
   verifier runs early, **Then** it checks goal satisfaction.

### US-32e: Budget Control (P0)

As the agent loop, I need step/token/time budgets that terminate
the run cleanly when exceeded.

**Acceptance Scenarios**:

1. **Given** `maxSteps: 20` and step 20 reached, **Then** the loop
   terminates with `BUDGET_EXCEEDED`.
2. **Given** `maxTimeMs: 120000` and time exceeded, **Then** the loop
   terminates with `BUDGET_EXCEEDED`.

### US-32f: Confidence Decay (P1)

As the agent loop, I need a confidence score that decays with each
step so the agent escalates or terminates when it's clearly lost.

**Acceptance Scenarios**:

1. **Given** confidence starts at 1.0 with decay 0.05/step, **When**
   14 steps pass, **Then** confidence is 0.3 (escalation threshold).
2. **Given** confidence below threshold, **Then** the loop terminates.

### US-32g: Agent Mode CLI (P0)

As a user, I need `--agent-mode` flag to run a goal-directed task
instead of CRO analysis.

**Acceptance Scenarios**:

1. **Given** `npm run start -- --agent-mode "Go to wikipedia.org"`,
   **When** run, **Then** the agent navigates to Wikipedia.
2. **Given** `--agent-mode --verbose "Search for TypeScript"`,
   **When** run, **Then** step-by-step output shows plan+action+verify.
3. **Given** `--agent-mode --max-steps 10 "goal"`, **When** run,
   **Then** the agent stops after 10 steps.

### US-32h: Page State Perception (P0)

As the planner, I need a lightweight page state representation that
fits in the LLM context window without a full viewport capture.

**Acceptance Scenarios**:

1. **Given** a page, **When** `perceivePage()` runs, **Then** it
   returns: URL, title, AX tree (truncated), DOM hash, visible
   interactive elements summary, and optional screenshot.
2. **Given** a page with poor accessibility (<500 char AX tree),
   **When** perceived, **Then** a screenshot is auto-included.

## Functional Requirements

### Agent Loop Core

- **FR-32-001**: `runAgentLoop(config)` MUST accept: `{ goal, startUrl, maxSteps, maxTimeMs, llm, page, toolExecutor, verbose }`.
- **FR-32-002**: Loop MUST follow: budget check → perceive → plan → act → detect failure → verify goal → increment step.
- **FR-32-003**: Loop MUST terminate on: goal satisfied, budget exceeded, confidence below threshold, or unrecoverable failure.
- **FR-32-004**: Loop MUST return `AgentLoopResult` with: `status`, `stepsUsed`, `totalTimeMs`, `goalSatisfied`, `actionHistory`, `errors`, `terminationReason`.
- **FR-32-005**: Loop MUST wrap in top-level try/catch — browser crashes return structured result, never unhandled exception.

### Perceiver

- **FR-32-010**: `perceivePage(page)` MUST return `PerceivedState`: URL, title, domHash, axTreeText, interactiveElementsSummary, hasBlocker, screenshotBase64 (optional).
- **FR-32-011**: DOM hash MUST use SHA-256 of `page.content()` truncated to 16 hex chars.
- **FR-32-012**: AX tree MUST be truncated to 8000 chars (fits in LLM context with room for prompt).
- **FR-32-013**: If AX tree < 500 chars, auto-include screenshot as base64.
- **FR-32-014**: Blocker detection MUST use regex patterns on AX tree text (cookie, modal, loading — same approach as spec Phase 1A).
- **FR-32-015**: Interactive elements summary MUST list top 20 visible+interactive elements with index, tag, text, role.

### Planner

- **FR-32-020**: `planNextAction(llm, goal, perceivedState, actionHistory, failureContext, budget)` MUST return `{ reasoning, toolName, toolParams, expectedOutcome }`.
- **FR-32-021**: Planner system prompt MUST include: identity, rules (ONE action at a time, never repeat failed approach, dismiss blockers first), available tools list, 3 few-shot examples.
- **FR-32-022**: Planner user message MUST include: goal, current URL+title, AX tree, last 5 actions with results, failure context, budget remaining.
- **FR-32-023**: Planner MUST strip markdown fences (`\`\`\`json...\`\`\``) and extract first `{...}` JSON object from response.
- **FR-32-024**: On parse failure, planner MUST fallback to `{ toolName: "extract_text", toolParams: {} }` (safe diagnostic action).
- **FR-32-025**: Planner MUST receive the 13 interaction tools + extract_text + get_ax_tree in its tool list (NOT the 6 CRO analysis tools).

### Failure Detection & Routing

- **FR-32-030**: After each action, compare `domHashBefore` vs `domHashAfter`.
- **FR-32-031**: If DOM unchanged AND tool is mutating (not read-only), detect `ACTION_HAD_NO_EFFECT`.
- **FR-32-032**: Read-only tools exempt from DOM change check: `extract_text`, `get_ax_tree`, `get_screenshot`, `capture_viewport`.
- **FR-32-033**: If tool returns `success: false` with error containing "not found", detect `ELEMENT_NOT_FOUND`.
- **FR-32-034**: `routeFailure(failure)` MUST be pure logic (no LLM call):
  - `ELEMENT_NOT_FOUND` + retries < 3 → `REPLAN`
  - `ELEMENT_NOT_FOUND` + retries >= 3 → `TERMINATE`
  - `ACTION_HAD_NO_EFFECT` → `REPLAN_WITH_DIAGNOSTIC`
  - `BUDGET_EXCEEDED` → `TERMINATE`
- **FR-32-035**: Failure context MUST be included in next planner call so LLM can adapt.

### Goal Verifier

- **FR-32-040**: `verifyGoal(llm, goal, perceivedState, actionHistory)` MUST return `{ goalSatisfied, confidence, reasoning }`.
- **FR-32-041**: Verifier MUST check OBSERVABLE state only — URL, visible text, element presence. NOT assume success from action execution.
- **FR-32-042**: Goal verification MUST run: every 3 steps, OR after URL change, OR after significant DOM change (hash differs by >50%).
- **FR-32-043**: Goal satisfied + confidence > 0.7 MUST trigger loop termination with SUCCESS.

### Budget Controller

- **FR-32-050**: Track 3 budgets: steps (default 20), time (default 120s), tokens (optional).
- **FR-32-051**: `isExceeded()` MUST return `{ exceeded, budgetKind }`.
- **FR-32-052**: Budget check MUST be first action in each loop iteration.

### Confidence Decay

- **FR-32-060**: Confidence starts at 1.0, decays by `decayFactor` (default 0.05) per step.
- **FR-32-061**: Confidence MUST never drop below 0.
- **FR-32-062**: Confidence below `escalationThreshold` (default 0.3) MUST trigger termination.

### CLI Integration

- **FR-32-070**: `--agent-mode <goal>` CLI flag activates the agent loop instead of CRO analysis.
- **FR-32-071**: `--max-steps <n>` sets step budget (default 20).
- **FR-32-072**: `--max-time <ms>` sets time budget (default 120000).
- **FR-32-073**: `--start-url <url>` sets starting page (default: about:blank).
- **FR-32-074**: `--verbose` prints AX tree, planner prompt, and action results each step.
- **FR-32-075**: Step-by-step progress output: `Step N: toolName({params}) → ✓/✗ [confidence: 0.XX]`.

### Action History

- **FR-32-080**: Each action recorded as `ActionRecord`: `{ step, toolName, toolParams, success, error, domHashBefore, domHashAfter, durationMs, timestamp }`.
- **FR-32-081**: Action history MUST persist across the full run for post-mortem analysis.
- **FR-32-082**: Last 5 actions MUST be included in planner context.

## Non-Functional Requirements

- **NFR-32-001**: Agent loop module MUST be under 300 lines (delegate to sub-modules).
- **NFR-32-002**: Each sub-module (perceiver, planner, verifier, failure-router, budget, confidence) MUST be under 150 lines.
- **NFR-32-003**: Existing CRO analysis pipeline MUST NOT be modified (additive only).
- **NFR-32-004**: All new code MUST follow existing patterns: Zod validation, structured logger, barrel exports.
- **NFR-32-005**: Unit tests MUST cover all failure routing paths and budget edge cases.

## Edge Cases

- Browser crash mid-loop: top-level catch returns structured result
- LLM timeout: catch, record failure, continue loop (planner will see failure context)
- LLM returns invalid JSON: fallback to extract_text diagnostic action
- Goal already satisfied on first page: verifier detects immediately, 0-step success
- Empty AX tree on every page: auto-screenshot mode activates
- All tools fail repeatedly: confidence decay terminates after ~14 steps
- Page redirect after action: detected via URL change, logged in action history
- New tab opens: not auto-switched in Phase 32 (future: combine with switch_tab)
- Infinite scroll page: step budget prevents infinite loops
- Page with no interactive elements: planner should try scroll or navigate

## Success Criteria

- **SC-32-001**: Agent navigates to a URL and verifies arrival (1-step task).
- **SC-32-002**: Agent searches Wikipedia (3-5 step task): navigate → type → press Enter → verify.
- **SC-32-003**: Budget exceeded terminates cleanly (never crash).
- **SC-32-004**: DOM hash change detection has 0 false positives on read-only tools.
- **SC-32-005**: Failure router covers all 4 failure paths.
- **SC-32-006**: All 1327+ existing tests pass (zero regressions).
- **SC-32-007**: Agent loop module total < 800 lines across all files.
