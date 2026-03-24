# Phase 33: Agent Loop Reliability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve agent loop reliability for 10-25 step tasks through zero-cost failure prevention, sub-goal decomposition, self-critique, and multi-candidate generation — each phase independently valuable.

**Architecture:** Four incremental sub-phases (33a→b→c→d), cheapest first. 33a adds element pre-validation, enhanced failure detection, and visited-state tracking with zero extra LLM calls. 33b decomposes complex goals into sub-goals (1 upfront LLM call). 33c adds post-action self-critique (opt-in, +1 LLM call/step). 33d adds multi-candidate generation (opt-in, no extra LLM calls vs single plan).

**Tech Stack:** TypeScript 5.x, Playwright (element validation), LangChain/OpenAI (gpt-4o-mini), Vitest (testing), Zod (validation)

---

## Technical Context

**Existing infrastructure (from Phase 32):**
- `agent-loop.ts` (323 lines) — main perceive→plan→act→verify loop
- `failure-router.ts` (83 lines) — detects ELEMENT_NOT_FOUND, ACTION_HAD_NO_EFFECT
- `planner.ts` (157 lines) — single-action LLM planner
- `types.ts` (165 lines) — all interfaces
- `confidence-decay.ts` (42 lines) — linear decay
- `perceiver.ts` (160 lines) — page state extraction with xpath generation
- `verifier.ts` (105 lines) — LLM goal verification
- `budget-controller.ts` (63 lines) — step/time tracking

**Key patterns to follow:**
- Tools never throw — catch all, return `{ success: false, error }`
- Zod for external input validation
- `vi.hoisted()` for mock factories in tests
- `function` keyword for ChatOpenAI mock constructors
- Barrel exports in `index.ts`

**LLM call pattern:**
```typescript
const response = await llm.invoke([
  new SystemMessage(systemPrompt),
  new HumanMessage(userMessage),
]);
const content = typeof response.content === 'string' ? response.content : '';
const parsed = extractJSON(content);
```

## File Structure

### New Files (5)
```
src/agent/agent-loop/
├── element-pre-validator.ts     ~60 lines   (33a) — validate element exists before action
├── visited-state-tracker.ts     ~50 lines   (33a) — URL visit counting, loop detection
├── sub-goal-planner.ts          ~120 lines  (33b) — decompose goal into sub-goals
├── self-critic.ts               ~100 lines  (33c) — post-action LLM evaluation
├── candidate-generator.ts       ~130 lines  (33d) — multi-candidate action generation
```

### Modified Files (6)
```
├── failure-router.ts        +40 lines (33a: 4 new failure types)
├── types.ts                 +60 lines (all: new interfaces)
├── planner.ts               +15 lines (33a: visited URLs + failed combos in prompt)
├── agent-loop.ts            +50 lines (all: wire new components)
├── confidence-decay.ts      +15 lines (33c: adjustFromCritique method)
├── index.ts                 +10 lines (barrel exports)
```

### New Test Files (7)
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

## Dependencies

```
33a (zero-cost) ← start immediately
  ↓
33b (sub-goals) ← depends on 33a types
  ↓
33c (self-critique) ← depends on 33a + 33b types
  ↓
33d (multi-candidate) ← depends on 33a + 33b + 33c types
```

## Session Plan

- **Session 1**: 33a — types, element pre-validator, enhanced failure router, visited-state tracker, planner context enrichment, tests (~15 tasks)
- **Session 2**: 33b — sub-goal planner, loop integration, tests (~8 tasks)
- **Session 3**: 33c — self-critic, confidence adjustment, CLI, tests (~10 tasks)
- **Session 4**: 33d — candidate generator, loop integration, CLI, tests (~8 tasks)

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Code Quality | ✅ | All new files under 130 lines |
| II. TypeScript Strict | ✅ | Full interfaces in types.ts |
| III. Perception Layer | ✅ | Pre-validator extends perception |
| IV. Error Handling | ✅ | All new modules catch errors, never throw |
| V. LLM Integration | ✅ | Sub-goals: 1 call total. Critique: opt-in. |
| VI. Cost & Performance | ✅ | Sub-goals default ON (negligible). Critique/candidates opt-in. |
| VII. Modular Architecture | ✅ | Each component is a separate file with barrel exports |
| VIII. Testing Discipline | ✅ | 27 new tests, TDD approach |
| IX. Security | ✅ | No secrets in prompts |
| X. Production Readiness | ✅ | CLI flags, structured output |
