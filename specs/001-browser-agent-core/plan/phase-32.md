# Phase 32: Agent Loop with Plan-Act-Verify

**Date**: 2026-03-24
**Spec**: `spec/requirements-phase32.md`
**Tasks**: `tasks/phase-32.md`
**Depends On**: Phase 31 (13 interaction tools)

## Summary

Build a goal-directed agent loop: perceive → plan → act → verify →
repeat. Six focused modules (perceiver, planner, verifier,
failure-router, budget-controller, confidence-decay) plus the loop
orchestrator. Runs as `--agent-mode` alongside the existing CRO
pipeline without modifying it.

## Technical Context

**Existing infrastructure reused**:
- `ToolExecutor` + `ToolRegistry` — tool execution (26 tools)
- `captureAccessibilityTree()` — AX tree perception
- `CookieConsentHandler` — blocker detection already in dismiss_blocker tool
- `ChatOpenAI` from `@langchain/openai` — LLM client (gpt-4o-mini default)
- `createLogger()` — structured logging
- `BrowserManager` + `PageLoader` — browser lifecycle

**NOT reused** (too coupled to CRO pipeline):
- `StateManager` — tied to CRO phases, insights, coverage tracking
- `PromptBuilder` — tied to CRO tool descriptions and vision analysis
- `MessageManager` — reusable in principle but simple enough to inline

**LLM interaction pattern** (from existing cro-agent.ts):
```typescript
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';

const llm = new ChatOpenAI({
  modelName: MODEL_DEFAULTS.analysis, // 'gpt-4o-mini'
  temperature: 0,
  timeout: 60000,
});

const messages = [new SystemMessage(systemPrompt), new HumanMessage(userMessage)];
const response = await llm.invoke(messages);
const content = typeof response.content === 'string' ? response.content : '';
```

**JSON extraction pattern** (from existing parseAgentOutput):
```typescript
function extractJSON(text: string): Record<string, unknown> | null {
  // Strip markdown fences
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  // Find first { to last }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch { return null; }
}
```

## Module Architecture

```
src/agent/agent-loop/
├── index.ts                    # Barrel exports
├── agent-loop.ts               # Main loop orchestrator (~200 lines)
├── perceiver.ts                # Page state perception (~100 lines)
├── planner.ts                  # LLM single-action planning (~150 lines)
├── verifier.ts                 # LLM goal verification (~100 lines)
├── failure-router.ts           # Deterministic failure routing (~80 lines)
├── budget-controller.ts        # Step/time/token budget tracking (~60 lines)
├── confidence-decay.ts         # Linear confidence decay (~40 lines)
├── types.ts                    # All interfaces for this module (~80 lines)
└── json-utils.ts               # extractJSON utility (~30 lines)
```

**Total**: ~840 lines across 10 files (under 800 target for logic files).

## Sub-phases

### 32a: Types & Pure Logic Modules

**Files**:
- NEW: `src/agent/agent-loop/types.ts`
- NEW: `src/agent/agent-loop/failure-router.ts`
- NEW: `src/agent/agent-loop/budget-controller.ts`
- NEW: `src/agent/agent-loop/confidence-decay.ts`
- NEW: `src/agent/agent-loop/json-utils.ts`

These are pure logic — no LLM, no Playwright. Fully unit-testable.

**Types** (types.ts):
```typescript
// Input to the agent loop
interface AgentLoopConfig {
  goal: string;
  startUrl?: string;
  maxSteps?: number;        // default: 20
  maxTimeMs?: number;        // default: 120000
  decayFactor?: number;      // default: 0.05
  escalationThreshold?: number; // default: 0.3
  verifyEveryNSteps?: number;  // default: 3
  verbose?: boolean;
}

// Output from the agent loop
interface AgentLoopResult {
  status: 'SUCCESS' | 'BUDGET_EXCEEDED' | 'CONFIDENCE_LOW' |
          'UNRECOVERABLE_FAILURE' | 'RUNNER_ERROR';
  goalSatisfied: boolean;
  stepsUsed: number;
  totalTimeMs: number;
  actionHistory: ActionRecord[];
  terminationReason: string;
  errors: string[];
  finalUrl: string;
  finalTitle: string;
}

// Per-step action record
interface ActionRecord {
  step: number;
  toolName: string;
  toolParams: Record<string, unknown>;
  reasoning: string;
  expectedOutcome: string;
  success: boolean;
  error?: string;
  domHashBefore: string;
  domHashAfter: string;
  durationMs: number;
  timestamp: string;
}

// Perceived page state (lightweight, no full DOM tree)
interface PerceivedState {
  url: string;
  title: string;
  domHash: string;
  axTreeText: string | null;     // truncated to 8000 chars
  interactiveElements: InteractiveElement[];  // top 20
  hasBlocker: boolean;
  blockerType?: string;
  screenshotBase64?: string;      // only if AX tree too short
}

interface InteractiveElement {
  index: number;
  tag: string;
  text: string;
  role?: string;
  type?: string;  // input type attribute
}

// Planner output
interface PlannerOutput {
  reasoning: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  expectedOutcome: string;
}

// Verifier output
interface VerificationResult {
  goalSatisfied: boolean;
  confidence: number;       // 0-1
  reasoning: string;
}

// Failure types
type FailureType = 'ELEMENT_NOT_FOUND' | 'ACTION_HAD_NO_EFFECT' | 'BUDGET_EXCEEDED';

interface DetectedFailure {
  type: FailureType;
  details: string;
  retryCount: number;
}

type ResolutionStrategy = 'REPLAN' | 'REPLAN_WITH_DIAGNOSTIC' | 'TERMINATE';

interface RoutedFailure {
  failure: DetectedFailure;
  strategy: ResolutionStrategy;
}

// Budget status
interface BudgetStatus {
  exceeded: boolean;
  budgetKind?: 'steps' | 'time' | 'tokens';
  stepsUsed: number;
  stepsRemaining: number;
  timeElapsedMs: number;
  timeRemainingMs: number;
}
```

**Failure Router** (failure-router.ts):
```typescript
const MAX_ELEMENT_RETRIES = 3;

export function routeFailure(failure: DetectedFailure): RoutedFailure {
  switch (failure.type) {
    case 'ELEMENT_NOT_FOUND':
      return failure.retryCount < MAX_ELEMENT_RETRIES
        ? { failure, strategy: 'REPLAN' }
        : { failure, strategy: 'TERMINATE' };
    case 'ACTION_HAD_NO_EFFECT':
      return { failure, strategy: 'REPLAN_WITH_DIAGNOSTIC' };
    case 'BUDGET_EXCEEDED':
      return { failure, strategy: 'TERMINATE' };
  }
}
```

**Budget Controller** (budget-controller.ts):
```typescript
export class BudgetController {
  constructor(maxSteps: number, maxTimeMs: number);
  recordStep(): void;
  getStatus(): BudgetStatus;
  isExceeded(): boolean;
}
```

**Confidence Decay** (confidence-decay.ts):
```typescript
export class ConfidenceDecay {
  constructor(decayFactor?: number, escalationThreshold?: number);
  get current(): number;
  decay(): void;          // called each step
  shouldEscalate(): boolean;
  reset(): void;          // on successful verification
}
```

### 32b: Perceiver

**Files**:
- NEW: `src/agent/agent-loop/perceiver.ts`

**Implementation**:
- Import `captureAccessibilityTree` from `../../browser/ax-tree-serializer.js`
- Import `createHash` from `crypto` for DOM hashing
- `perceivePage(page)`:
  1. `page.url()` + `await page.title()`
  2. DOM hash: `createHash('sha256').update(await page.content()).digest('hex').slice(0, 16)`
  3. AX tree: `captureAccessibilityTree(page, { maxTokens: 2000 })`
     truncated to 8000 chars
  4. Interactive elements: `page.evaluate()` script that finds top 20
     visible interactive elements with tag, text, role, index
  5. Blocker detection: regex on AX tree text for cookie/modal/loading
  6. If AX tree < 500 chars: capture screenshot base64

### 32c: Planner & Verifier

**Files**:
- NEW: `src/agent/agent-loop/planner.ts`
- NEW: `src/agent/agent-loop/verifier.ts`

**Planner system prompt** (embedded in planner.ts):
```
You are a browser automation agent. You observe the current page
state and decide the SINGLE next action to take toward the user's goal.

RULES:
- Take ONE action at a time. Never plan multiple steps.
- Always specify the expected observable outcome.
- If the page has a blocker (cookie banner, modal), dismiss it first.
- If an element wasn't found, try a different reference or scroll.
- If your last action had no effect, try a completely different approach.
- If the target element is not visible, try scrolling down first.

Available tools: [list of 15 interaction + perception tools]

Respond with JSON only:
{
  "reasoning": "why this action",
  "toolName": "tool_name",
  "toolParams": { ... },
  "expectedOutcome": "what should change"
}
```

**Planner user message template**:
```
GOAL: {goal}

CURRENT PAGE:
  URL: {url}
  Title: {title}

ACCESSIBILITY TREE:
{axTreeText}

INTERACTIVE ELEMENTS (top 20):
{elements formatted as: [index] <tag> "text" role=X type=Y}

RECENT ACTIONS (last 5):
  Step N: toolName({params}) → ✓/✗ {error or "success"}
  ...

FAILURE CONTEXT: {failureContext or "none"}
BUDGET: Step {step}/{maxSteps} | Confidence: {confidence}

What is the single next action?
```

**Verifier system prompt**:
```
You are a verification agent. Given the user's goal and current
page state, determine if the goal has been achieved.

Check OBSERVABLE conditions only: URL, visible text, element presence.
Do NOT assume success because actions executed without errors.

Respond with JSON only:
{
  "goalSatisfied": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "what you observed"
}
```

### 32d: Agent Loop Orchestrator

**Files**:
- NEW: `src/agent/agent-loop/agent-loop.ts`
- NEW: `src/agent/agent-loop/index.ts` (barrel)

**Pseudocode**:
```
export async function runAgentLoop(config, deps): AgentLoopResult {
  const budget = new BudgetController(config.maxSteps, config.maxTimeMs);
  const confidence = new ConfidenceDecay(config.decayFactor, config.escalationThreshold);
  const actionHistory: ActionRecord[] = [];
  let failureContext: RoutedFailure | null = null;
  let consecutiveFailures = 0;

  // Navigate to start URL
  if (config.startUrl) {
    await deps.toolExecutor.execute('go_to_url', { url: config.startUrl }, ctx);
  }

  try {
    while (true) {
      // 1. CHECK BUDGET
      if (budget.isExceeded()) return terminate('BUDGET_EXCEEDED', ...);
      if (confidence.shouldEscalate()) return terminate('CONFIDENCE_LOW', ...);

      // 2. PERCEIVE
      const preState = await perceivePage(deps.page);

      // 3. HANDLE BLOCKERS
      if (preState.hasBlocker) {
        await deps.toolExecutor.execute('dismiss_blocker', { strategy: 'auto' }, ctx);
        continue; // re-perceive after dismissal
      }

      // 4. PLAN
      const plan = await planNextAction(deps.llm, config.goal, preState,
        actionHistory.slice(-5), failureContext, budget.getStatus(), confidence.current);

      // 5. ACT
      const startTime = Date.now();
      const result = await deps.toolExecutor.execute(plan.toolName, plan.toolParams, ctx);
      const durationMs = Date.now() - startTime;

      // 6. RE-PERCEIVE
      const postState = await perceivePage(deps.page);

      // 7. RECORD
      actionHistory.push({
        step: budget.stepsUsed, toolName: plan.toolName,
        toolParams: plan.toolParams, reasoning: plan.reasoning,
        expectedOutcome: plan.expectedOutcome,
        success: result.success, error: result.error,
        domHashBefore: preState.domHash, domHashAfter: postState.domHash,
        durationMs, timestamp: new Date().toISOString(),
      });

      // 8. DETECT FAILURES
      const failure = detectFailure(plan.toolName, result, preState.domHash, postState.domHash);
      if (failure) {
        consecutiveFailures++;
        const routed = routeFailure({ ...failure, retryCount: consecutiveFailures });
        if (routed.strategy === 'TERMINATE') return terminate('UNRECOVERABLE_FAILURE', ...);
        failureContext = routed;
      } else {
        consecutiveFailures = 0;
        failureContext = null;
      }

      // 9. VERIFY GOAL (every N steps or after URL change)
      if (shouldVerify(budget.stepsUsed, config.verifyEveryNSteps, preState, postState)) {
        const verification = await verifyGoal(deps.llm, config.goal, postState, actionHistory);
        if (verification.goalSatisfied && verification.confidence > 0.7) {
          return { status: 'SUCCESS', goalSatisfied: true, ... };
        }
      }

      // 10. UPDATE
      budget.recordStep();
      confidence.decay();

      // 11. PROGRESS OUTPUT
      if (config.verbose) log step details

      // 12. SETTLE
      await sleep(500);
    }
  } catch (error) {
    return { status: 'RUNNER_ERROR', goalSatisfied: false, ... };
  }
}
```

### 32e: CLI Integration

**Files**:
- MODIFY: `src/cli.ts` — add `--agent-mode`, `--max-steps`, `--max-time`, `--start-url`
- MODIFY: `src/agent/cro-agent.ts` — add `agentMode` path in `analyze()`

**CLI parsing**:
```
--agent-mode <goal>     Run goal-directed agent loop
--max-steps <n>         Step budget (default: 20)
--max-time <ms>         Time budget (default: 120000)
--start-url <url>       Starting page (default: first positional URL)
```

When `--agent-mode` is active, `CROAgent.analyze()` delegates to
`runAgentLoop()` instead of the vision pipeline.

### 32f: Tests

**Unit tests** (pure logic, no browser):
- `tests/unit/agent-loop/failure-router.test.ts` — 4 tests
- `tests/unit/agent-loop/budget-controller.test.ts` — 3 tests
- `tests/unit/agent-loop/confidence-decay.test.ts` — 4 tests
- `tests/unit/agent-loop/json-utils.test.ts` — 3 tests
- `tests/unit/agent-loop/perceiver.test.ts` — 3 tests (mocked page)

**Integration tests** (with mocked LLM):
- `tests/integration/agent-loop.test.ts` — 3 tests:
  1. Simple navigation task succeeds
  2. Budget exceeded terminates cleanly
  3. Failure routing works end-to-end

## Dependencies

```
32a (types + pure logic) ← start immediately
  ↓
32b (perceiver) ← depends on 32a types
  ↓
32c (planner + verifier) ← depends on 32a types
  ↓
32d (loop orchestrator) ← depends on 32a + 32b + 32c
  ↓
32e (CLI) ← depends on 32d
  ↓
32f (tests) ← depends on all above
```

## Session Plan

- **Session 1**: 32a (types + pure logic + tests) — ~10 tasks, ~14 unit tests
- **Session 2**: 32b + 32c (perceiver + planner + verifier) — ~8 tasks, ~6 tests
- **Session 3**: 32d + 32e + 32f (loop + CLI + integration) — ~10 tasks, ~6 tests

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Planner chooses wrong tool | High | Medium | Few-shot examples, failure context in next call |
| LLM returns invalid JSON | Medium | Low | extractJSON fallback to diagnostic action |
| DOM hash changes on idle | Low | Medium | Exclude read-only tools, add small tolerance |
| Budget too small for complex tasks | Medium | Medium | Default 20 steps, configurable via CLI |
| Verifier false positive | Low | High | Require confidence > 0.7 for SUCCESS |
| Existing tests break | Low | High | New module is additive, CRO pipeline untouched |
| cro-agent.ts exceeds 500 lines | Already over | N/A | Agent loop is separate module, minimal changes to cro-agent.ts |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | ✅ | Each module < 200 lines, clear responsibility |
| II. TypeScript Strict | ✅ | Full type definitions in types.ts |
| III. Perception Layer | ✅ | perceiver.ts extends perception with DOM hash + blocker detection |
| IV. Error Handling | ✅ | Top-level catch, per-action error isolation, structured results |
| V. LLM Integration | ✅ | Single-step planning, token-aware, cost-optimized (gpt-4o-mini) |
| VI. Cost & Performance | ✅ | Verify every 3 steps (not every step), decay terminates lost agents |
| VII. Modular Architecture | ✅ | Separate module, barrel exports, no circular deps |
| VIII. Testing Discipline | ✅ | Pure logic fully unit-tested, integration tests for loop |
| IX. Security | ✅ | No secrets in logs, execute_js documented as user-responsibility |
| X. Production Readiness | ✅ | CLI flags, structured output, graceful shutdown |
